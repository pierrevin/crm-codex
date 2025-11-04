// Main API Edge Function - Routes all /api/* requests
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAccessToken, createRefreshToken, verifyAccessToken } from '../_shared/jwt.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const url = new URL(req.url)
    // Supabase Edge Functions receive the full path after /functions/v1/
    // For function named 'api', pathname will be like /api/auth/login
    // We need to extract the part after /api/
    let path = url.pathname
    if (path.startsWith('/api/')) {
      path = path.substring(5) // Remove '/api/' prefix
    } else if (path.startsWith('/')) {
      path = path.substring(1) // Remove leading slash
    }
    const method = req.method

    // ===== AUTH ROUTES =====
    if (path === 'auth/login' && method === 'POST') {
      const { email, password } = await req.json()

      // Get user from database
      const { data: user, error } = await supabase
        .from('User')
        .select('*')
        .eq('email', email)
        .single()

      if (error || !user) {
        return new Response(
          JSON.stringify({ message: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify password using SQL function
      const { data: isValid, error: verifyError } = await supabase.rpc('verify_password', {
        user_id: user.id,
        password: password
      })

      if (verifyError || !isValid) {
        return new Response(
          JSON.stringify({ message: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate tokens
      const accessToken = await createAccessToken(user.id)
      const refreshToken = await createRefreshToken(user.id)

      // Store refresh token
      await supabase.from('RefreshToken').insert({
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })

      return new Response(
        JSON.stringify({ accessToken, refreshToken }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'auth/refresh' && method === 'POST') {
      const { refreshToken } = await req.json()

      // Verify refresh token exists and is valid
      const { data: tokenRecord } = await supabase
        .from('RefreshToken')
        .select('*')
        .eq('token', refreshToken)
        .single()

      if (!tokenRecord || new Date(tokenRecord.expiresAt) < new Date()) {
        return new Response(
          JSON.stringify({ message: 'Invalid refresh token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate new tokens
      const newAccessToken = await createAccessToken(tokenRecord.userId)
      const newRefreshToken = await createRefreshToken(tokenRecord.userId)

      // Delete old refresh token and insert new one
      await supabase.from('RefreshToken').delete().eq('token', refreshToken)
      await supabase.from('RefreshToken').insert({
        token: newRefreshToken,
        userId: tokenRecord.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })

      return new Response(
        JSON.stringify({ accessToken: newAccessToken, refreshToken: newRefreshToken }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'auth/health' && method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== AUTHENTICATED ROUTES =====
    // Extract and verify JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.substring(7)
    const payload = await verifyAccessToken(token)
    if (!payload) {
      return new Response(
        JSON.stringify({ message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = payload.userId

    // ===== USER ROUTES =====
    if (path === 'users/me' && method === 'GET') {
      const { data: user } = await supabase
        .from('User')
        .select('id, email, createdAt, updatedAt')
        .eq('id', userId)
        .single()

      return new Response(
        JSON.stringify(user),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== CONTACTS ROUTES =====
    if (path === 'contacts' && method === 'GET') {
      const search = url.searchParams.get('search')
      const companyId = url.searchParams.get('companyId')
      const limit = parseInt(url.searchParams.get('limit') ?? '20')

      let query = supabase
        .from('Contact')
        .select('*, company:Company(*)', { count: 'exact' })
        .order('createdAt', { ascending: false })
        .limit(limit)

      if (companyId) {
        query = query.eq('companyId', companyId)
      }

      if (search) {
        query = query.or(`firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      return new Response(
        JSON.stringify({ data: data, items: data, total: count ?? data?.length ?? 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'contacts' && method === 'POST') {
      const body = await req.json()
      const now = new Date().toISOString()
      const newId = crypto.randomUUID()
      
      const { data, error } = await supabase
        .from('Contact')
        .insert({ 
          id: newId, 
          ...body, 
          ownerId: userId,
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('contacts/') && method === 'GET') {
      const id = path.split('/')[1]
      const { data, error } = await supabase
        .from('Contact')
        .select('*, company:Company(*)')
        .eq('id', id)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('contacts/') && method === 'PATCH') {
      const id = path.split('/')[1]
      const body = await req.json()
      
      // Nettoyer le body : convertir les valeurs vides en null pour les champs optionnels
      const cleanedBody: any = { ...body }
      // Convertir les chaînes vides en null pour les champs optionnels
      const optionalFields = ['lastName', 'email', 'phone', 'mobilePhone', 'title', 'jobTitle', 'industry', 'linkedinUrl', 'funnelStep', 'companyId']
      for (const field of optionalFields) {
        if (cleanedBody[field] === '') {
          cleanedBody[field] = null
        }
      }

      const { data, error } = await supabase
        .from('Contact')
        .update({ ...cleanedBody, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('contacts/') && method === 'DELETE') {
      const id = path.split('/')[1]
      const { error } = await supabase
        .from('Contact')
        .delete()
        .eq('id', id)

      if (error) throw error

      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // ===== COMPANIES ROUTES =====
    if (path === 'companies' && method === 'GET') {
      const search = url.searchParams.get('search')
      
      // Charger toutes les companies
      let query = supabase
        .from('Company')
        .select('*')
        .order('createdAt', { ascending: false })

      if (search) {
        query = query.or(`name.ilike.%${search}%,domain.ilike.%${search}%`)
      }

      const { data: companies, error: companiesError } = await query

      if (companiesError) throw companiesError

      if (!companies || companies.length === 0) {
        return new Response(
          JSON.stringify([]),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Récupérer tous les IDs des companies
      const companyIds = companies.map(c => c.id)

      // Récupérer tous les counts en batch avec seulement 2 requêtes au lieu de 2N
      const [contactsRes, opportunitiesRes] = await Promise.all([
        supabase.from('Contact').select('companyId').in('companyId', companyIds),
        supabase.from('Opportunity').select('companyId').in('companyId', companyIds)
      ])

      // Compter par companyId côté JavaScript
      const contactsByCompany = (contactsRes.data || []).reduce((acc: any, c: any) => {
        if (c.companyId) {
          acc[c.companyId] = (acc[c.companyId] || 0) + 1
        }
        return acc
      }, {})

      const opportunitiesByCompany = (opportunitiesRes.data || []).reduce((acc: any, o: any) => {
        if (o.companyId) {
          acc[o.companyId] = (acc[o.companyId] || 0) + 1
        }
        return acc
      }, {})

      // Combiner les résultats
      const companiesWithCount = companies.map((company: any) => ({
        ...company,
        _count: {
          contacts: contactsByCompany[company.id] || 0,
          opportunities: opportunitiesByCompany[company.id] || 0
        }
      }))

      return new Response(
        JSON.stringify(companiesWithCount),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'companies' && method === 'POST') {
      const body = await req.json()
      const now = new Date().toISOString()
      const newId = crypto.randomUUID()
      
      const { data, error } = await supabase
        .from('Company')
        .insert({ 
          id: newId, 
          ...body,
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('companies/') && method === 'GET' && !path.includes('/merge')) {
      const id = path.split('/')[1]
      
      // Exécuter toutes les requêtes en parallèle pour optimiser les performances
      const [companyRes, contactsRes, opportunitiesRes, tagsRes] = await Promise.all([
        supabase.from('Company').select('*').eq('id', id).single(),
        supabase.from('Contact').select('*').eq('companyId', id),
        supabase.from('Opportunity').select('*').eq('companyId', id),
        supabase.from('_CompanyToTag').select('*, Tag(*)').eq('A', id)
      ])

      if (companyRes.error) throw companyRes.error
      if (contactsRes.error) throw contactsRes.error
      if (opportunitiesRes.error) throw opportunitiesRes.error

      const company = companyRes.data
      const contacts = contactsRes.data || []
      const opportunities = opportunitiesRes.data || []

      let tagNames: string[] = []
      if (!tagsRes.error && tagsRes.data) {
        tagNames = tagsRes.data.map((t: any) => t.Tag?.name).filter(Boolean)
      }

      const result = {
        ...company,
        contacts: contacts || [],
        opportunities: opportunities || [],
        tags: tagNames
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('companies/') && method === 'PATCH') {
      const id = path.split('/')[1]
      const body = await req.json()
      const { tags, ...updateData } = body

      // Nettoyer le body : convertir les valeurs vides en null pour les champs optionnels
      const cleanedUpdateData: any = { ...updateData }
      // Convertir les chaînes vides en null pour les champs optionnels
      const optionalFields = ['domain', 'addressStreet', 'addressZip', 'addressCity', 'addressCountry', 'siret', 'vatNumber', 'linkedinUrl', 'salesNavigatorUrl', 'notes']
      for (const field of optionalFields) {
        if (cleanedUpdateData[field] === '') {
          cleanedUpdateData[field] = null
        }
      }

      // Mettre à jour la company (sans les tags)
      const { data, error } = await supabase
        .from('Company')
        .update({ ...cleanedUpdateData, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Gérer les tags si fournis (tableau de strings)
      if (tags && Array.isArray(tags)) {
        // Supprimer toutes les relations existantes
        await supabase.from('_CompanyToTag').delete().eq('A', id)

        // Créer ou récupérer les tags et créer les relations
        for (const tagName of tags) {
          if (!tagName || typeof tagName !== 'string') continue

          // Chercher ou créer le tag
          let { data: existingTag } = await supabase
            .from('Tag')
            .select('id')
            .eq('name', tagName.trim())
            .single()

          let tagId: string

          if (!existingTag) {
            // Créer le tag
            const slug = tagName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
            const { data: newTag, error: createError } = await supabase
              .from('Tag')
              .insert({ name: tagName.trim(), slug })
              .select('id')
              .single()

            if (createError) {
              console.error('Erreur création tag:', createError)
              continue
            }
            tagId = newTag.id
          } else {
            tagId = existingTag.id
          }

          // Créer la relation
          await supabase.from('_CompanyToTag').insert({ A: id, B: tagId })
        }
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('companies/') && path.includes('/merge') && method === 'POST') {
      const pathParts = path.split('/')
      const id = pathParts[1]
      const { mergeCompanyId } = await req.json()

      if (!mergeCompanyId || id === mergeCompanyId) {
        return new Response(
          JSON.stringify({ message: 'Invalid merge company ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Vérifier que les deux companies existent
      const { data: mainCompany, error: mainError } = await supabase
        .from('Company')
        .select('*')
        .eq('id', id)
        .single()

      if (mainError || !mainCompany) {
        return new Response(
          JSON.stringify({ message: 'Main company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: mergeCompany, error: mergeError } = await supabase
        .from('Company')
        .select('*')
        .eq('id', mergeCompanyId)
        .single()

      if (mergeError || !mergeCompany) {
        return new Response(
          JSON.stringify({ message: 'Company to merge not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Déplacer les contacts
      const { error: contactsError } = await supabase
        .from('Contact')
        .update({ companyId: id })
        .eq('companyId', mergeCompanyId)

      if (contactsError) throw contactsError

      // Déplacer les opportunités
      const { error: opportunitiesError } = await supabase
        .from('Opportunity')
        .update({ companyId: id })
        .eq('companyId', mergeCompanyId)

      if (opportunitiesError) throw opportunitiesError

      // Fusionner les champs optionnels (si la principale est vide)
      const updateData: any = {}
      if (!mainCompany.domain && mergeCompany.domain) updateData.domain = mergeCompany.domain
      if (!mainCompany.externalRef && mergeCompany.externalRef) updateData.externalRef = mergeCompany.externalRef
      if (!mainCompany.addressStreet && mergeCompany.addressStreet) updateData.addressStreet = mergeCompany.addressStreet
      if (!mainCompany.addressZip && mergeCompany.addressZip) updateData.addressZip = mergeCompany.addressZip
      if (!mainCompany.addressCity && mergeCompany.addressCity) updateData.addressCity = mergeCompany.addressCity
      if (!mainCompany.addressCountry && mergeCompany.addressCountry) updateData.addressCountry = mergeCompany.addressCountry
      if (!mainCompany.siret && mergeCompany.siret) updateData.siret = mergeCompany.siret
      if (!mainCompany.vatNumber && mergeCompany.vatNumber) updateData.vatNumber = mergeCompany.vatNumber
      if (!mainCompany.linkedinUrl && mergeCompany.linkedinUrl) updateData.linkedinUrl = mergeCompany.linkedinUrl
      if (!mainCompany.salesNavigatorUrl && mergeCompany.salesNavigatorUrl) updateData.salesNavigatorUrl = mergeCompany.salesNavigatorUrl
      if (mergeCompany.notes) {
        updateData.notes = mainCompany.notes
          ? `${mainCompany.notes}\n\n--- Fusionné depuis "${mergeCompany.name}" ---\n${mergeCompany.notes}`
          : mergeCompany.notes
      }
      updateData.statusClient = mainCompany.statusClient || mergeCompany.statusClient
      updateData.statusProspect = mainCompany.statusProspect || mergeCompany.statusProspect
      updateData.statusSupplier = mainCompany.statusSupplier || mergeCompany.statusSupplier

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date().toISOString()
        const { error: updateError } = await supabase
          .from('Company')
          .update(updateData)
          .eq('id', id)

        if (updateError) throw updateError
      }

      // Supprimer la company fusionnée
      const { error: deleteError } = await supabase
        .from('Company')
        .delete()
        .eq('id', mergeCompanyId)

      if (deleteError) throw deleteError

      return new Response(
        JSON.stringify({ message: 'Companies merged successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('companies/') && method === 'DELETE') {
      const id = path.split('/')[1]
      const { error } = await supabase
        .from('Company')
        .delete()
        .eq('id', id)

      if (error) throw error

      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // ===== STATS ROUTE (pour Dashboard optimisé) =====
    if (path === 'stats' && method === 'GET') {
      // Récupérer les counts totaux et quelques opportunités récentes seulement
      const [contactsCount, companiesCount, opportunitiesCount, allOppsRes, recentOppsRes] = await Promise.all([
        supabase.from('Contact').select('id', { count: 'exact', head: true }),
        supabase.from('Company').select('id', { count: 'exact', head: true }),
        supabase.from('Opportunity').select('id', { count: 'exact', head: true }),
        // Charger seulement les champs nécessaires pour les calculs (pas tous les champs)
        supabase.from('Opportunity').select('stage, amount'),
        supabase.from('Opportunity').select('*').order('createdAt', { ascending: false }).limit(5)
      ])

      const totalOpportunities = opportunitiesCount.count ?? 0
      const opportunities = allOppsRes.data || []
      const recentOpportunities = recentOppsRes.data || []

      // Calculer les stats par stage
      const oppsByStage = opportunities.reduce((acc: any, opp: any) => {
        acc[opp.stage] = (acc[opp.stage] || 0) + 1
        return acc
      }, {})

      // Calculer les valeurs
      const pipelineValue = opportunities
        .filter((o: any) => o.stage !== 'CLOSED_LOST')
        .reduce((sum: number, opp: any) => sum + (Number(opp.amount) || 0), 0)

      const wonValue = opportunities
        .filter((o: any) => o.stage === 'CLOSED_WON')
        .reduce((sum: number, opp: any) => sum + (Number(opp.amount) || 0), 0)

      const netRevenue = wonValue * 0.73

      return new Response(
        JSON.stringify({
          totalContacts: contactsCount.count ?? 0,
          totalCompanies: companiesCount.count ?? 0,
          totalOpportunities: totalOpportunities,
          pipelineValue,
          wonValue,
          netRevenue,
          opportunitiesByStage: oppsByStage,
          recentOpportunities
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== OPPORTUNITIES ROUTES =====
    if (path === 'opportunities' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') ?? '20')
      const companyId = url.searchParams.get('companyId')
      const search = url.searchParams.get('search')

      let query = supabase
        .from('Opportunity')
        .select('*, contact:Contact(*), company:Company(*)', { count: 'exact' })
        .order('createdAt', { ascending: false })
        .limit(limit)

      if (companyId) {
        query = query.eq('companyId', companyId)
      }

      if (search) {
        // Recherche dans title uniquement côté serveur (Supabase ne supporte pas bien les recherches dans relations avec or)
        query = query.ilike('title', `%${search}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      // Filtrer aussi par company name si search est fourni (filtrage côté client après avoir chargé les relations)
      let filteredData = data || []
      if (search && data) {
        const searchLower = search.toLowerCase()
        filteredData = data.filter((opp: any) => 
          opp.title?.toLowerCase().includes(searchLower) ||
          opp.company?.name?.toLowerCase().includes(searchLower)
        )
      }

      return new Response(
        JSON.stringify({ data: filteredData, items: filteredData, total: count ?? filteredData?.length ?? 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'opportunities' && method === 'POST') {
      const body = await req.json()
      const now = new Date().toISOString()
      const newId = crypto.randomUUID()
      
      const { data, error } = await supabase
        .from('Opportunity')
        .insert({ 
          id: newId, 
          ...body, 
          ownerId: userId,
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('opportunities/') && method === 'GET') {
      const id = path.split('/')[1]
      const { data, error } = await supabase
        .from('Opportunity')
        .select('*, contact:Contact(*), company:Company(*)')
        .eq('id', id)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('opportunities/') && method === 'PATCH') {
      const id = path.split('/')[1]
      const body = await req.json()
      const { data, error } = await supabase
        .from('Opportunity')
        .update({ ...body, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('opportunities/') && method === 'DELETE') {
      const id = path.split('/')[1]
      const { error } = await supabase
        .from('Opportunity')
        .delete()
        .eq('id', id)

      if (error) throw error

      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // ===== ACTIVITIES ROUTES =====
    if (path === 'activities' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') ?? '20')

      const { data, error } = await supabase
        .from('Activity')
        .select('*, contact:Contact(*), opportunity:Opportunity(*)')
        .order('createdAt', { ascending: false })
        .limit(limit)

      if (error) throw error

      return new Response(
        JSON.stringify({ items: data, total: data?.length ?? 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'activities' && method === 'POST') {
      const body = await req.json()
      const now = new Date().toISOString()
      const newId = crypto.randomUUID()
      
      const { data, error } = await supabase
        .from('Activity')
        .insert({ 
          id: newId, 
          ...body, 
          userId,
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('activities/') && method === 'GET') {
      const id = path.split('/')[1]
      const { data, error } = await supabase
        .from('Activity')
        .select('*, contact:Contact(*), opportunity:Opportunity(*)')
        .eq('id', id)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('activities/') && method === 'PATCH') {
      const id = path.split('/')[1]
      const body = await req.json()
      const { data, error } = await supabase
        .from('Activity')
        .update({ ...body, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== SIRENE API ROUTES =====
    if (path === 'companies/sirene/search' && method === 'POST') {
      const body = await req.json()
      const { type, value } = body

      if (!type || !value) {
        return new Response(
          JSON.stringify({ message: 'Missing type or value' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      try {
        // Construire l'URL de l'API data.gouv.fr
        let apiUrl = 'https://recherche-entreprises.api.gouv.fr/search'
        
        if (type === 'siret') {
          // Normaliser le SIRET (supprimer les espaces)
          const normalizedSiret = value.replace(/\s+/g, '')
          apiUrl += `?siret=${encodeURIComponent(normalizedSiret)}`
        } else if (type === 'siren') {
          const normalizedSiren = value.replace(/\s+/g, '')
          apiUrl += `?siren=${encodeURIComponent(normalizedSiren)}`
        } else if (type === 'name') {
          apiUrl += `?q=${encodeURIComponent(value)}`
        } else {
          return new Response(
            JSON.stringify({ message: 'Invalid type. Use siret, siren, or name' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Appeler l'API data.gouv.fr
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        const data = await response.json()

        // Formater les résultats pour notre modèle
        const formattedResults = (data.results || []).map((result: any) => {
          // Extraire l'adresse si disponible
          const adresse = result.siege?.adresse || result.adresse || {}
          
          return {
            siret: result.siret,
            siren: result.siren,
            denomination: result.nom_complet || result.denomination,
            codeNAF: result.activite_principale || result.naf,
            libelleNAF: result.libelle_activite_principale || null,
            addressStreet: adresse.numero_voie ? `${adresse.numero_voie} ${adresse.type_voie || ''} ${adresse.libelle_voie || ''}`.trim() : (adresse.ligne_1 || null),
            addressZip: adresse.code_postal || null,
            addressCity: adresse.ville || adresse.localite || null,
            addressCountry: 'France',
            isIndividual: result.nature_juridique === 'Entrepreneur individuel' || result.entreprise_individuelle === true
          }
        })

        return new Response(
          JSON.stringify({ results: formattedResults }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (error: any) {
        console.error('Erreur appel API Sirene:', error)
        return new Response(
          JSON.stringify({ message: error.message || 'Erreur lors de la recherche' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Endpoint pour compléter une fiche existante
    if (path.startsWith('companies/') && path.includes('/sirene/fill') && method === 'POST') {
      const pathParts = path.split('/')
      const companyId = pathParts[1]
      const body = await req.json()
      const { siret, siren, name } = body

      try {
        // Déterminer le type de recherche
        let searchType = 'name'
        let searchValue = name

        if (siret) {
          searchType = 'siret'
          searchValue = siret.replace(/\s+/g, '')
        } else if (siren) {
          searchType = 'siren'
          searchValue = siren.replace(/\s+/g, '')
        }

        if (!searchValue) {
          return new Response(
            JSON.stringify({ message: 'Missing siret, siren, or name' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Appeler l'API Sirene
        let apiUrl = 'https://recherche-entreprises.api.gouv.fr/search'
        if (searchType === 'siret') {
          apiUrl += `?siret=${encodeURIComponent(searchValue)}`
        } else if (searchType === 'siren') {
          apiUrl += `?siren=${encodeURIComponent(searchValue)}`
        } else {
          apiUrl += `?q=${encodeURIComponent(searchValue)}`
        }

        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' }
        })

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        const data = await response.json()
        const results = data.results || []

        if (results.length === 0) {
          return new Response(
            JSON.stringify({ message: 'Aucune entreprise trouvée' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Récupérer la company actuelle pour ne mettre à jour que les champs vides
        const { data: currentCompany, error: fetchError } = await supabase
          .from('Company')
          .select('*')
          .eq('id', companyId)
          .single()

        if (fetchError) throw fetchError

        // Prendre le premier résultat
        const result = results[0]
        const adresse = result.siege?.adresse || result.adresse || {}

        // Préparer les données à mettre à jour (seulement les champs vides)
        const updateData: any = {
          updatedAt: new Date().toISOString()
        }

        // Mettre à jour seulement les champs vides
        if (!currentCompany.name && (result.nom_complet || result.denomination)) {
          updateData.name = result.nom_complet || result.denomination
        }
        if (!currentCompany.siret && result.siret) {
          updateData.siret = result.siret
        }
        if (!currentCompany.siren && result.siren) {
          updateData.siren = result.siren
        }
        if (!currentCompany.codeNAF && (result.activite_principale || result.naf)) {
          updateData.codeNAF = result.activite_principale || result.naf
        }
        if (!currentCompany.libelleNAF && result.libelle_activite_principale) {
          updateData.libelleNAF = result.libelle_activite_principale
        }

        // Adresse - seulement si vide
        if (!currentCompany.addressStreet && (adresse.numero_voie || adresse.ligne_1)) {
          const street = adresse.numero_voie 
            ? `${adresse.numero_voie} ${adresse.type_voie || ''} ${adresse.libelle_voie || ''}`.trim()
            : adresse.ligne_1
          if (street) updateData.addressStreet = street
        }
        if (!currentCompany.addressZip && adresse.code_postal) {
          updateData.addressZip = adresse.code_postal
        }
        if (!currentCompany.addressCity && (adresse.ville || adresse.localite)) {
          updateData.addressCity = adresse.ville || adresse.localite
        }
        if (!currentCompany.addressCountry) {
          updateData.addressCountry = 'France'
        }

        // Mettre à jour la company
        const { data: updatedCompany, error } = await supabase
          .from('Company')
          .update(updateData)
          .eq('id', companyId)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify(updatedCompany),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (error: any) {
        console.error('Erreur complétion fiche:', error)
        return new Response(
          JSON.stringify({ message: error.message || 'Erreur lors de la complétion' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Route not found
    return new Response(
      JSON.stringify({ message: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

