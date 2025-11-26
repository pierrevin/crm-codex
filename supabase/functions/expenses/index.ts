import { serve } from 'https://deno.land/std@0.207.0/http/server.ts'
import { encode as encodeBase64 } from 'https://deno.land/std@0.207.0/encoding/base64.ts'

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseClient } from '../_shared/database.ts'
import { verifyAccessToken } from '../_shared/jwt.ts'

type ExpenseStatus = 'PENDING' | 'PROCESSED' | 'VERIFIED' | 'REJECTED'

const GOOGLE_PROCESSOR_ID = Deno.env.get('GOOGLE_DOCUMENT_AI_PROCESSOR_ID') ?? ''
const GOOGLE_CLIENT_EMAIL = Deno.env.get('GOOGLE_CLIENT_EMAIL') ?? ''
const GOOGLE_PRIVATE_KEY = (Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')
const STORAGE_BUCKET = Deno.env.get('SUPABASE_STORAGE_BUCKET') ?? 'expenses'

interface ExpensePayload {
  supplierName?: string
  invoiceNumber?: string
  invoiceDate?: string
  amountHT?: number
  amountTTC?: number
  vatAmount?: number
  vatRate?: number
  accountCode?: string
  accountLabel?: string
  companyId?: string | null
  notes?: string | null
  status?: ExpenseStatus
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) {
    return corsResponse
  }

  try {
    const url = new URL(req.url)
    const method = req.method.toUpperCase()
    const rawPath = url.pathname
    const path = normalizePath(rawPath)

    if (method === 'GET' && (path === '/' || path === '')) {
      const user = await authenticateUser(req)
      return json(await listExpenses(url.searchParams, user?.id), 200)
    }

    if (method === 'GET' && path.startsWith('/') && path !== '/') {
      const id = path.slice(1)
      return json(await getExpense(id), 200)
    }

    // Accepter à la fois /functions/v1/expenses/scan et /scan
    if (method === 'POST' && (path === '/scan' || rawPath.endsWith('/expenses/scan'))) {
      const user = await authenticateUser(req)
      if (!user) {
        return json({ message: 'Unauthorized' }, 401)
      }
      return json(await scanExpense(req, user.id), 200)
    }

    if (method === 'PUT' && path.startsWith('/') && path !== '/') {
      const id = path.slice(1)
      const user = await authenticateUser(req)
      if (!user) {
        return json({ message: 'Unauthorized' }, 401)
      }
      return json(await updateExpense(id, await req.json(), user.id), 200)
    }

    if (method === 'DELETE' && path.startsWith('/') && path !== '/') {
      const id = path.slice(1)
      const user = await authenticateUser(req)
      if (!user) {
        return json({ message: 'Unauthorized' }, 401)
      }
      return json(await deleteExpense(id, user.id), 200)
    }

    return json({ message: 'Not found' }, 404)
  } catch (error) {
    console.error('Expenses function error:', error)
    return json({ message: error.message ?? 'Unexpected error' }, 500)
  }
})

function normalizePath(pathname: string) {
  const base = '/functions/v1/expenses'
  if (pathname.startsWith(base)) {
    return pathname.slice(base.length) || '/'
  }
  return pathname || '/'
}

function json(body: Record<string, unknown> | any[], status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

async function authenticateUser(req: Request) {
  const userHeader = req.headers.get('x-user-authorization') ?? ''
  if (!userHeader.startsWith('Bearer ')) return null

  const token = userHeader.slice(7)
  if (!token) return null

  // Vérifier le JWT généré par nos Edge Functions (auth/login)
  const payload = await verifyAccessToken(token)
  if (!payload?.userId) {
    console.warn('User auth failed: invalid access token')
    return null
  }

  return { id: payload.userId }
}

async function scanExpense(req: Request, userId: string) {
  const formData = await req.formData()
  const file = formData.get('file')
  const accountCode = formData.get('accountCode')?.toString()

  if (!(file instanceof File)) {
    throw new Error('File is required')
  }

  const arrayBuffer = await file.arrayBuffer()
  const fileBytes = new Uint8Array(arrayBuffer)
  const mimeType = file.type || 'application/octet-stream'

  let ocrDocument: any = null
  let parsedData: any = {}

  try {
    ocrDocument = await processDocumentAi(fileBytes, mimeType)
    parsedData = await parseExpenseData(ocrDocument, file.name ?? '', supabaseClient)
  } catch (error) {
    console.error('Document AI failed, fallback to manual data', error)
    parsedData = {
      accountCode: accountCode ?? '6267',
      accountLabel: getAccountLabel(accountCode ?? '6267'),
      notes: 'OCR indisponible, veuillez compléter manuellement'
    }
  }

  const fileUrl = await uploadToStorage(fileBytes, file.name || `capture-${Date.now()}.jpg`, mimeType, userId)

  const insertPayload: ExpensePayload = {
    supplierName: parsedData.supplierName ?? null,
    invoiceNumber: parsedData.invoiceNumber ?? null,
    invoiceDate: parsedData.invoiceDate ? new Date(parsedData.invoiceDate).toISOString() : null,
    amountHT: parsedData.amountHT ?? null,
    amountTTC: parsedData.amountTTC ?? null,
    vatAmount: parsedData.vatAmount ?? null,
    vatRate: parsedData.vatRate ?? null,
    accountCode: accountCode ?? parsedData.accountCode ?? '6267',
    accountLabel: parsedData.accountLabel ?? getAccountLabel(accountCode ?? parsedData.accountCode ?? '6267'),
    companyId: parsedData.companyId ?? null,
    status: 'PENDING',
    notes: parsedData.notes ?? null
  }

  const { data, error } = await supabaseClient
    .from('Expense')
    .insert({
      // Générer un id côté Edge Function car la colonne n'a pas de défaut en base
      id: crypto.randomUUID(),
      ...serializeExpensePayload(insertPayload),
      fileUrl,
      fileName: file.name ?? null,
      fileType: mimeType,
      rawOcrData: ocrDocument,
      userId
    })
    .select('*, company:Company(*), user:User(id,email)')
    .single()

  if (error) {
    console.error('Error inserting expense', error)
    throw new Error(error.message)
  }

  return data
}

async function listExpenses(params: URLSearchParams, defaultUserId?: string) {
  let query = supabaseClient
    .from('Expense')
    .select('*, company:Company(*), user:User(id,email)')
    .order('createdAt', { ascending: false })

  const userId = params.get('userId') ?? defaultUserId
  if (userId) {
    query = query.eq('userId', userId)
  }
  const status = params.get('status')
  if (status) {
    query = query.eq('status', status)
  }
  const companyId = params.get('companyId')
  if (companyId) {
    query = query.eq('companyId', companyId)
  }
  const startDate = params.get('startDate')
  if (startDate) {
    query = query.gte('invoiceDate', startDate)
  }
  const endDate = params.get('endDate')
  if (endDate) {
    query = query.lte('invoiceDate', endDate)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return data ?? []
}

async function getExpense(id: string) {
  const { data, error } = await supabaseClient
    .from('Expense')
    .select('*, company:Company(*), user:User(id,email)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  // Si aucune dépense ne correspond, on renvoie simplement null
  // pour éviter une erreur 500 côté frontend.
  return data ?? null
}

async function updateExpense(id: string, payload: ExpensePayload, userId: string) {
  const expense = await getExpense(id)
  if (expense?.userId && expense.userId !== userId) {
    throw new Error('Vous n\'êtes pas autorisé à modifier cette dépense.')
  }

  const updateData = serializeExpensePayload(payload)

  const { data, error } = await supabaseClient
    .from('Expense')
    .update(updateData)
    .eq('id', id)
    .select('*, company:Company(*), user:User(id,email)')
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return data
}

async function deleteExpense(id: string, userId: string) {
  const expense = await getExpense(id)
  if (expense?.userId && expense.userId !== userId) {
    throw new Error('Vous n\'êtes pas autorisé à supprimer cette dépense.')
  }

  if (expense?.fileUrl) {
    try {
      await deleteFromStorage(expense.fileUrl)
    } catch (storageError) {
      console.error('Erreur suppression fichier', storageError)
    }
  }

  const { error } = await supabaseClient.from('Expense').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  return { success: true }
}

function serializeExpensePayload(payload: ExpensePayload) {
  const data: Record<string, unknown> = {}
  if (payload.supplierName !== undefined) data.supplierName = payload.supplierName
  if (payload.invoiceNumber !== undefined) data.invoiceNumber = payload.invoiceNumber
  if (payload.invoiceDate !== undefined && payload.invoiceDate !== null) {
    data.invoiceDate = new Date(payload.invoiceDate).toISOString()
  } else if (payload.invoiceDate === null) {
    data.invoiceDate = null
  }
  if (payload.amountHT !== undefined) data.amountHT = payload.amountHT
  if (payload.amountTTC !== undefined) data.amountTTC = payload.amountTTC
  if (payload.vatAmount !== undefined) data.vatAmount = payload.vatAmount
  if (payload.vatRate !== undefined) data.vatRate = payload.vatRate
  if (payload.accountCode !== undefined) data.accountCode = payload.accountCode
  if (payload.accountLabel !== undefined) data.accountLabel = payload.accountLabel
  if (payload.companyId !== undefined) data.companyId = payload.companyId
  if (payload.notes !== undefined) data.notes = payload.notes
  if (payload.status !== undefined) data.status = payload.status
  return data
}

async function uploadToStorage(bytes: Uint8Array, fileName: string, mimeType: string, userId: string) {
  const now = new Date()
  const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${userId}/${Date.now()}-${fileName}`
  const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: false
  })
  if (error) {
    throw new Error(`Upload Supabase Storage échoué: ${error.message}`)
  }

  const { data: urlData, error: urlError } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 31536000)

  if (urlError || !urlData?.signedUrl) {
    throw new Error(urlError?.message ?? 'Impossible de générer l\'URL signée')
  }

  return urlData.signedUrl
}

async function deleteFromStorage(fileUrl: string) {
  const parts = fileUrl.split('/')
  const idx = parts.findIndex((p) => p === STORAGE_BUCKET)
  if (idx === -1) return
  const path = parts.slice(idx + 1).join('/')
  await supabaseClient.storage.from(STORAGE_BUCKET).remove([path])
}

async function processDocumentAi(fileBytes: Uint8Array, mimeType: string) {
  if (!GOOGLE_PROCESSOR_ID) {
    throw new Error('GOOGLE_DOCUMENT_AI_PROCESSOR_ID manquant')
  }

  const regionMatch = GOOGLE_PROCESSOR_ID.match(/locations\/([^/]+)/)
  const region = regionMatch ? regionMatch[1] : 'us'
  const endpoint = region === 'eu' ? 'https://eu-documentai.googleapis.com' : 'https://documentai.googleapis.com'
  const token = await getGoogleAccessToken()

  const response = await fetch(`${endpoint}/v1/${GOOGLE_PROCESSOR_ID}:process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rawDocument: {
        content: encodeBase64(fileBytes),
        mimeType
      },
      skipHumanReview: true
    })
  })

  const result = await response.json()
  if (!response.ok) {
    console.error('Document AI error', result)
    throw new Error(result.error?.message ?? 'Document AI error')
  }

  if (!result.document) {
    throw new Error('Document AI n\'a pas retourné de document')
  }

  return result.document
}

async function getGoogleAccessToken() {
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Identifiants Google manquants')
  }

  const tokenUrl = 'https://oauth2.googleapis.com/token'
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: GOOGLE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUrl,
    exp: now + 3600,
    iat: now
  }

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(GOOGLE_PRIVATE_KEY),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  )

  const encoder = new TextEncoder()
  const data = encoder.encode(
    `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data)
  const jwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}.${base64UrlEncode(signature)}`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error ?? 'Impossible d\'obtenir le token Google')
  }

  return result.access_token
}

function pemToArrayBuffer(pem: string) {
  const cleaned = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\\s+/g, '')
  const binary = atob(cleaned)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer.buffer
}

function base64UrlEncode(input: string | ArrayBuffer) {
  let str: string
  if (typeof input === 'string') {
    str = btoa(unescape(encodeURIComponent(input)))
  } else {
    const bytes = new Uint8Array(input)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    str = btoa(binary)
  }
  return str.replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_')
}

async function parseExpenseData(document: any, fileName: string, supabase: typeof supabaseClient) {
  const data = extractExpenseData(document)
  const company = data.supplierName ? await findSupplierByName(data.supplierName, supabase) : null
  const accountCode = determineAccountCode({ ...data, fileName })

  return {
    ...data,
    companyId: company?.id ?? null,
    accountCode,
    accountLabel: getAccountLabel(accountCode)
  }
}

function extractExpenseData(document: any) {
  const entities = document?.entities ?? []
  const data: Record<string, any> = {}

  for (const entity of entities) {
    const type = entity.type
    let value = entity.mentionText ?? entity.textAnchor?.textSegments?.[0]?.text

    if (entity.normalizedValue) {
      if (entity.normalizedValue.moneyValue) {
        const money = entity.normalizedValue.moneyValue
        value = money.units ?? 0
        if (money.nanos) {
          value = Number(`${money.units ?? 0}.${money.nanos.toString().padStart(9, '0')}`)
        }
      } else if (entity.normalizedValue.dateValue) {
        const date = entity.normalizedValue.dateValue
        value = new Date(date.year, (date.month || 1) - 1, date.day || 1)
      } else if (entity.normalizedValue.textValue) {
        value = entity.normalizedValue.textValue
      }
    }

    switch (type) {
      case 'supplier_name':
      case 'vendor_name':
      case 'merchant_name':
      case 'supplier':
      case 'vendor':
      case 'merchant':
        if (!data.supplierName) data.supplierName = value
        break
      case 'invoice_number':
      case 'invoice_id':
      case 'receipt_id':
      case 'invoice_id_number':
      case 'receipt_number':
        if (!data.invoiceNumber) data.invoiceNumber = value
        break
      case 'invoice_date':
      case 'receipt_date':
      case 'purchase_date':
      case 'invoice_date_invoice_date':
      case 'receipt_date_receipt_date':
        if (!data.invoiceDate) data.invoiceDate = parseDate(value)
        break
      case 'net_amount':
      case 'amount_ht':
      case 'subtotal':
      case 'line_item_amount':
      case 'net_amount_net_amount':
        if (!data.amountHT) data.amountHT = parseAmount(value)
        break
      case 'total_amount':
      case 'amount_ttc':
      case 'total':
      case 'invoice_total':
      case 'total_amount_total_amount':
        if (!data.amountTTC) data.amountTTC = parseAmount(value)
        break
      case 'tax_amount':
      case 'vat_amount':
      case 'tax':
      case 'total_tax_amount':
      case 'tax_amount_tax_amount':
        if (!data.vatAmount) data.vatAmount = parseAmount(value)
        break
      case 'tax_rate':
      case 'vat_rate':
      case 'tax_rate_tax_rate':
        if (!data.vatRate) data.vatRate = parseRate(value)
        break
    }
  }

  if (data.amountHT && data.amountTTC && !data.vatAmount) {
    data.vatAmount = Number(data.amountTTC) - Number(data.amountHT)
    data.vatRate = data.amountHT > 0 ? Number(data.vatAmount) / Number(data.amountHT) : null
  }

  if (data.amountHT && data.vatAmount && !data.vatRate) {
    data.vatRate = Number(data.vatAmount) / Number(data.amountHT)
  }

  return data
}

function parseAmount(value: any): number | null {
  if (!value) return null
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.')
  const amount = parseFloat(cleaned)
  return isNaN(amount) ? null : amount
}

function parseRate(value: any): number | null {
  if (!value) return null
  if (typeof value === 'number') return value > 1 ? value / 100 : value
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.')
  const rate = parseFloat(cleaned)
  if (isNaN(rate)) return null
  return rate > 1 ? rate / 100 : rate
}

function parseDate(value: any): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value.year) {
    return new Date(value.year, (value.month || 1) - 1, value.day || 1).toISOString()
  }
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

async function findSupplierByName(name: string, supabase: typeof supabaseClient) {
  const cleaned = name.trim()
  if (!cleaned) return null

  const normalized = cleaned
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .toLowerCase()

  const exact = await supabase
    .from('Company')
    .select('id')
    .eq('name', cleaned)
    .limit(1)
    .maybeSingle()
  if (exact.data) return exact.data

  const normalizedMatch = await supabase
    .from('Company')
    .select('id, name')
    .ilike('name', `%${normalized}%`)
    .limit(1)
    .maybeSingle()
  if (normalizedMatch.data) return normalizedMatch.data

  const words = normalized.split(' ').filter((w) => w.length > 2)
  for (const word of words) {
    const partial = await supabase
      .from('Company')
      .select('id')
      .ilike('name', `%${word}%`)
      .limit(1)
      .maybeSingle()
    if (partial.data) return partial.data
  }

  if (words.length > 1) {
    const first = words[0]
    const firstMatch = await supabase
      .from('Company')
      .select('id')
      .ilike('name', `${first}%`)
      .limit(1)
      .maybeSingle()
    if (firstMatch.data) return firstMatch.data
  }

  return null
}

function determineAccountCode(data: { supplierName?: string; fileName?: string; invoiceNumber?: string }) {
  const supplier = (data.supplierName ?? '').toLowerCase()
  const file = (data.fileName ?? '').toLowerCase()
  const invoice = (data.invoiceNumber ?? '').toLowerCase()

  const normalize = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const normalizedSupplier = normalize(supplier)
  const normalizedFile = normalize(file)
  const normalizedInvoice = normalize(invoice)

  const matches = (keywords: string[]) =>
    keywords.some(
      (kw) =>
        normalizedSupplier.includes(kw) ||
        normalizedFile.includes(kw) ||
        normalizedInvoice.includes(kw)
    )

  const rules: Record<string, string[]> = {
    '6221': ['avocat', 'expert comptable', 'consultant', 'notaire', 'audit', 'lawyer', 'advisory'],
    '6224': ['publicite', 'marketing', 'communication', 'google ads', 'facebook', 'linkedin', 'seo', 'sem'],
    '6227': ['salon', 'congres', 'conference', 'seminaire', 'event', 'exposition'],
    '6228': ['formation', 'training', 'certification', 'cours', 'mooc', 'elearning'],
    '6241': ['transport', 'livraison', 'fret', 'logistique', 'dhl', 'ups', 'chronopost'],
    '6242': ['taxi', 'uber', 'bolt', 'sncf', 'train', 'metro', 'bus', 'location voiture', 'air france'],
    '6251': ['restaurant', 'cafe', 'brasserie', 'mcdonald', 'kfc', 'boulangerie', 'traiteur'],
    '6254': ['deplacement', 'mission', 'voyage', 'travel', 'kilometre', 'indemnite'],
    '6255': ['hotel', 'airbnb', 'booking', 'ibis', 'novotel', 'mercure', 'hebergement'],
    '6261': ['banque', 'bank', 'bnp', 'lcl', 'caisse epargne', 'credit agricole', 'stripe', 'paypal'],
    '6262': ['assurance', 'axa', 'maif', 'macif', 'allianz', 'generali', 'groupama'],
    '6263': ['sage', 'cegid', 'compta', 'paie', 'rh', 'gestion'],
    '6264': ['orange', 'sfr', 'bouygues', 'free', 'internet', 'telecom', 'poste', 'colissimo'],
    '6267': ['nettoyage', 'cleaning', 'maintenance', 'reparation', 'plomberie', 'securite'],
    '6061': ['station', 'essence', 'total', 'shell', 'diesel', 'carburant'],
    '6062': ['papeterie', 'fourniture', 'bureau', 'cartridge', 'cartouche', 'office'],
    '6063': ['microsoft', 'google', 'amazon', 'aws', 'azure', 'ovh', 'github', 'slack', 'notion', 'figma', 'zoom', 'saas']
  }

  for (const [code, keywords] of Object.entries(rules)) {
    if (matches(keywords)) {
      return code
    }
  }

  return '6267'
}

function getAccountLabel(code: string) {
  const labels: Record<string, string> = {
    '6221': 'Honoraires',
    '6224': 'Publicité et marketing',
    '6227': 'Frais de salons / événements',
    '6228': 'Formation du personnel',
    '6241': 'Transports de biens',
    '6242': 'Transports de personnes',
    '6251': 'Frais de restauration',
    '6254': 'Frais de déplacement',
    '6255': 'Frais de logement',
    '6261': 'Services bancaires',
    '6262': 'Assurances',
    '6263': 'Services administratifs',
    '6264': 'Télécom & poste',
    '6267': 'Services extérieurs divers',
    '6061': 'Carburant',
    '6062': 'Fournitures de bureau',
    '6063': 'Services informatiques'
  }
  return labels[code] ?? 'Autres charges'
}

