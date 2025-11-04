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

      const { data, error } = await query

      if (error) throw error

      return new Response(
        JSON.stringify({ data: data, items: data, total: data?.length ?? 0 }),
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
      const { data, error } = await supabase
        .from('Contact')
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
      const { data, error } = await supabase
        .from('Company')
        .select('*')
        .order('createdAt', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify(data),
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

    if (path.startsWith('companies/') && method === 'GET') {
      const id = path.split('/')[1]
      
      // Récupérer la company avec contacts et opportunités filtrés par companyId
      const { data: company, error: companyError } = await supabase
        .from('Company')
        .select('*')
        .eq('id', id)
        .single()

      if (companyError) throw companyError

      // Récupérer les contacts de cette company
      const { data: contacts, error: contactsError } = await supabase
        .from('Contact')
        .select('*')
        .eq('companyId', id)

      if (contactsError) throw contactsError

      // Récupérer les opportunités de cette company
      const { data: opportunities, error: opportunitiesError } = await supabase
        .from('Opportunity')
        .select('*')
        .eq('companyId', id)

      if (opportunitiesError) throw opportunitiesError

      // Récupérer les tags (relation many-to-many)
      const { data: tags, error: tagsError } = await supabase
        .from('_CompanyToTag')
        .select('*, Tag(*)')
        .eq('A', id)

      let tagNames: string[] = []
      if (!tagsError && tags) {
        tagNames = tags.map((t: any) => t.Tag?.name).filter(Boolean)
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
      const { data, error } = await supabase
        .from('Company')
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

    // ===== OPPORTUNITIES ROUTES =====
    if (path === 'opportunities' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') ?? '20')
      const companyId = url.searchParams.get('companyId')

      let query = supabase
        .from('Opportunity')
        .select('*, contact:Contact(*), company:Company(*)')
        .order('createdAt', { ascending: false })
        .limit(limit)

      if (companyId) {
        query = query.eq('companyId', companyId)
      }

      const { data, error } = await query

      if (error) throw error

      return new Response(
        JSON.stringify({ data: data, items: data, total: data?.length ?? 0 }),
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

