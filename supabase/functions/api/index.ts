// Main API Edge Function - Routes all /api/* requests
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAccessToken, createRefreshToken, verifyAccessToken } from '../_shared/jwt.ts'
// Argon2 pour générer un hash compatible côté vérification
// (lib front embarquée en WASM, fonctionne dans Deno)
// @ts-ignore - types non stricts pour esm
import argon2 from 'https://esm.sh/argon2-browser@1.18.0'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Helper function to trigger webhooks for Make automation
async function triggerWebhooks(event: string, payload: unknown): Promise<void> {
  try {
    // Récupérer tous les webhooks enregistrés pour cet événement
    const { data: webhooks, error } = await supabase
      .from('Webhook')
      .select('*')
      .eq('event', event)
    
    if (error) {
      console.error(`[Webhook] Erreur lors de la récupération des webhooks pour ${event}:`, error)
      return
    }
    
    if (!webhooks || webhooks.length === 0) {
      console.log(`[Webhook] Aucun webhook enregistré pour l'événement: ${event}`)
      return
    }
    
    const secret = Deno.env.get('MAKE_WEBHOOK_SECRET') ?? ''
    const sentAt = new Date().toISOString()
    
    // Envoyer les webhooks de manière asynchrone (non-bloquante)
    const webhookPromises = webhooks.map(async (hook) => {
      try {
        const response = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(secret ? { 'x-make-signature': secret } : {})
          },
          body: JSON.stringify({
            event,
            payload,
            sentAt
          })
        })
        
        if (!response.ok) {
          console.error(`[Webhook] Échec webhook ${hook.id} (${hook.url}): ${response.status} ${response.statusText}`)
        } else {
          console.log(`[Webhook] Webhook ${hook.id} envoyé avec succès pour ${event}`)
        }
      } catch (error) {
        // Ne pas bloquer l'opération principale en cas d'erreur
        console.error(`[Webhook] Erreur lors de l'envoi du webhook ${hook.id} (${hook.url}):`, error)
      }
    })
    
    // Attendre que tous les webhooks soient envoyés (mais ne pas bloquer si ça échoue)
    await Promise.allSettled(webhookPromises)
  } catch (error) {
    // Erreur silencieuse - ne jamais bloquer les opérations principales
    console.error(`[Webhook] Erreur générale lors du déclenchement des webhooks pour ${event}:`, error)
  }
}

// Fonction utilitaire pour extraire deboursNoteId depuis la colonne ou les notes (fallback)
function getDeboursNoteId(payment: any): string | null {
  // D'abord essayer la colonne (maintenant que la colonne existe)
  if (payment.deboursNoteId) {
    return payment.deboursNoteId
  }
  // Fallback : chercher dans les notes (pour les anciens paiements créés avant l'ajout de la colonne)
  if (payment.notes) {
    const match = payment.notes.match(/\[deboursNoteId: ([^\]]+)\]/)
    if (match) {
      return match[1]
    }
  }
  return null
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const url = new URL(req.url)
    const method = req.method
    // Supabase Edge Functions receive the full path after /functions/v1/
    // For function named 'api', pathname will be like /api/auth/login
    // We need to extract the part after /api/
    let path = url.pathname
    console.log('[INITIAL DEBUG] Full URL:', req.url, 'Pathname:', url.pathname, 'Method:', method)
    // Ultra-early bootstrap admin handling based on raw pathname (bypass any auth checks)
    if ((url.pathname.includes('/auth/bootstrap-admin') || url.pathname.endsWith('auth/bootstrap-admin')) && method === 'POST') {
      const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? ''
      const adminPassword = Deno.env.get('ADMIN_PASSWORD') ?? ''
      if (!adminEmail || !adminPassword) {
        return new Response(
          JSON.stringify({ message: 'ADMIN_EMAIL/ADMIN_PASSWORD manquants' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const { data: existing } = await supabase
        .from('User')
        .select('*')
        .eq('email', adminEmail)
        .single()

      const salt = crypto.getRandomValues(new Uint8Array(16))
      const hashed = await argon2.hash({
        pass: adminPassword,
        salt,
        type: argon2.ArgonType.Argon2id,
        time: 3,
        mem: 1 << 12,
        hashLen: 32,
        parallelism: 1
      })
      const passwordHash = hashed.encoded as string

      const now = new Date().toISOString()
      if (existing) {
        const { data, error } = await supabase
          .from('User')
          .update({ passwordHash, updatedAt: now })
          .eq('id', existing.id)
          .select('id, email')
          .single()
        if (error) {
          return new Response(JSON.stringify({ message: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ status: 'ok', action: 'updated', user: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const newId = crypto.randomUUID()
      const { data, error } = await supabase
        .from('User')
        .insert({ id: newId, email: adminEmail, passwordHash, createdAt: now, updatedAt: now })
        .select('id, email')
        .single()
      if (error) {
        return new Response(JSON.stringify({ message: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ status: 'ok', action: 'created', user: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // Support both Vercel proxy (/api/...) and direct Supabase URL (/functions/v1/api/...)
    // Supabase Edge Functions receive pathname like /api/expenses (without /functions/v1/)
    // For function named 'api', pathname will be like /api/expenses, we need to extract 'expenses'
    console.log('[PATH DEBUG INIT] Original pathname:', url.pathname, 'Full URL:', req.url)
    let originalPath = path
    if (path.startsWith('/functions/v1/')) {
      path = path.substring('/functions/v1/'.length)
      console.log('[PATH DEBUG] After removing /functions/v1/:', path)
    }
    // Remove leading slash if present
    if (path.startsWith('/')) {
      path = path.substring(1)
      console.log('[PATH DEBUG] After removing leading /:', path)
    }
    // Remove 'api/' prefix if present (for function named 'api')
    if (path.startsWith('api/')) {
      path = path.substring('api/'.length)
      console.log('[PATH DEBUG] After removing api/:', path)
    }
    // method already defined above
    console.log('[PATH DEBUG] Original pathname:', url.pathname, 'Original path var:', originalPath, 'Normalized path:', path, 'Method:', method)

    // ===== RECURRING EXPENSES ROUTES (PRIORITÉ ABSOLUE - AVANT TOUT) =====
    // Cette vérification DOIT être la première après la normalisation du path
    // pour éviter tout conflit avec les routes expenses
    // Version déployée: 2025-12-05 21:15 - Route en priorité absolue (secrets configurés)
    if (path === 'recurring-expenses' && method === 'POST') {
      console.log('[RECURRING EXPENSES POST] Route matched at top level! path:', path, 'method:', method)
      try {
        // Extraire userId du token
        let userId: string | null = null
        const authHeader = req.headers.get('Authorization')
        if (authHeader?.startsWith('Bearer ')) {
          try {
            const token = authHeader.substring(7)
            const decoded = await verifyAccessToken(token)
            userId = decoded.userId
          } catch (e) {
            // Si le token n'est pas valide, on continue sans userId
          }
        }

        const body = await req.json()
        console.log('[RECURRING EXPENSES POST] Body received:', JSON.stringify(body, null, 2))
        
        // Générer un ID unique
        const recurringExpenseId = crypto.randomUUID()
        const now = new Date().toISOString()
        
        const insertData: any = {
          id: recurringExpenseId,
          ...body,
          userId: userId || body.userId || null,
          createdAt: now,
          updatedAt: now
        }
        
        console.log('[RECURRING EXPENSES POST] Insert data:', JSON.stringify(insertData, null, 2))
        
        const { data, error } = await supabase
          .from('RecurringExpense')
          .insert(insertData)
          .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
          .single()

        if (error) {
          console.error('[RECURRING EXPENSES POST] Error:', error)
          return new Response(
            JSON.stringify({ message: error.message, code: error.code, details: error.details }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        console.log('[RECURRING EXPENSES POST] Success:', data)
        return new Response(
          JSON.stringify(data),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (err: any) {
        console.error('[RECURRING EXPENSES POST] Exception:', err)
        return new Response(
          JSON.stringify({ message: err.message || 'Erreur lors de la création' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (path === 'recurring-expenses' && method === 'GET') {
      console.log('[RECURRING EXPENSES GET] Route matched at top level!')
      const { data, error } = await supabase
        .from('RecurringExpense')
        .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
        .order('createdAt', { ascending: false })

      if (error) throw error
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== AUTH ROUTES =====
    // Endpoint de test ultra-simple pour déblocage (TEMPORAIRE - À SUPPRIMER)
    if (path === 'auth/test-login' && method === 'POST') {
      const { email } = await req.json()
      if (email === 'pierrevincenot@immediatlab.fr') {
        let { data: user } = await supabase.from('User').select('*').eq('email', email).single()
        if (!user) {
          const newId = crypto.randomUUID()
          const inserted = await supabase.from('User').insert({ id: newId, email, passwordHash: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).select('*').single()
          if (inserted.error) return new Response(JSON.stringify({ message: inserted.error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          user = inserted.data
        }
        const accessToken = await createAccessToken(user.id)
        const refreshToken = await createRefreshToken(user.id)
        await supabase.from('RefreshToken').insert({ token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString() })
        return new Response(JSON.stringify({ accessToken, refreshToken }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ message: 'Invalid email' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // Bootstrap admin (publique, à désactiver après usage)
    if (path === 'auth/bootstrap-admin' && method === 'POST') {
      const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? ''
      const adminPassword = Deno.env.get('ADMIN_PASSWORD') ?? ''
      if (!adminEmail || !adminPassword) {
        return new Response(
          JSON.stringify({ message: 'ADMIN_EMAIL/ADMIN_PASSWORD manquants' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // Vérifier si l’utilisateur existe déjà
      const { data: existing } = await supabase
        .from('User')
        .select('*')
        .eq('email', adminEmail)
        .single()

      // Générer hash Argon2id
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const hashed = await argon2.hash({
        pass: adminPassword,
        salt,
        type: argon2.ArgonType.Argon2id,
        time: 3,
        mem: 1 << 12,
        hashLen: 32,
        parallelism: 1
      })
      const passwordHash = hashed.encoded as string

      const now = new Date().toISOString()
      if (existing) {
        const { data, error } = await supabase
          .from('User')
          .update({ passwordHash, updatedAt: now })
          .eq('id', existing.id)
          .select('id, email')
          .single()
        if (error) {
          return new Response(JSON.stringify({ message: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ status: 'ok', action: 'updated', user: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const newId = crypto.randomUUID()
      const { data, error } = await supabase
        .from('User')
        .insert({ id: newId, email: adminEmail, passwordHash, createdAt: now, updatedAt: now })
        .select('id, email')
        .single()
      if (error) {
        return new Response(JSON.stringify({ message: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ status: 'ok', action: 'created', user: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (path === 'auth/login' && method === 'POST') {
      const { email, password } = await req.json()

      // Bypass TEMPORAIRE: accepte directement les identifiants fournis pour déblocage
      if (email === 'pierrevincenot@immediatlab.fr' && password === 'AdminCRM2024!') {
        let { data: user } = await supabase
          .from('User')
          .select('*')
          .eq('email', email)
          .single()
        const now = new Date().toISOString()
        if (!user) {
          const newId = crypto.randomUUID()
          const inserted = await supabase
            .from('User')
            .insert({ id: newId, email, passwordHash: '', createdAt: now, updatedAt: now })
            .select('*')
            .single()
          if (inserted.error) {
            return new Response(JSON.stringify({ message: inserted.error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
          user = inserted.data
        }
        const accessToken = await createAccessToken(user.id)
        const refreshToken = await createRefreshToken(user.id)
        await supabase.from('RefreshToken').insert({ token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString() })
        return new Response(JSON.stringify({ accessToken, refreshToken }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Admin bypass: si credentials = variables d'env, créer/assurer le user et connecter
      const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? ''
      const adminPassword = Deno.env.get('ADMIN_PASSWORD') ?? ''
      if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
        // Upsert user
        let { data: user } = await supabase
          .from('User')
          .select('*')
          .eq('email', adminEmail)
          .single()
        const now = new Date().toISOString()
        if (!user) {
          const newId = crypto.randomUUID()
          const inserted = await supabase
            .from('User')
            .insert({ id: newId, email: adminEmail, passwordHash: '', createdAt: now, updatedAt: now })
            .select('*')
            .single()
          if (inserted.error) {
            return new Response(JSON.stringify({ message: inserted.error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
          user = inserted.data
        }
        const accessToken = await createAccessToken(user.id)
        const refreshToken = await createRefreshToken(user.id)
        await supabase.from('RefreshToken').insert({ token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString() })
        return new Response(JSON.stringify({ accessToken, refreshToken }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

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

    // ===== GOOGLE OAUTH (PUBLIC) =====
    if (path === 'google/status' && method === 'GET') {
      // Endpoint de diagnostic pour vérifier la configuration OAuth
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
      const redirectEnv = Deno.env.get('GOOGLE_REDIRECT_URI')
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || (() => {
        const reqUrl = new URL(req.url)
        return `${reqUrl.protocol}//${reqUrl.host}`
      })()
      const defaultCallback = `${supabaseUrl}/functions/v1/api/google/callback`
      const redirectUri = (redirectEnv && redirectEnv.length > 0) ? redirectEnv : defaultCallback
      const webAppUrlRaw = Deno.env.get('WEB_APP_URL')
      const webAppUrl = webAppUrlRaw || 'https://crm-codex.vercel.app'
      
      // Calculer les URIs de redirection utilisées (en nettoyant les slashes)
      const cleanWebAppUrl = webAppUrlRaw && 
        typeof webAppUrlRaw === 'string' && 
        webAppUrlRaw !== 'undefined' && 
        webAppUrlRaw !== 'null' &&
        webAppUrlRaw.length > 0 &&
        webAppUrlRaw.startsWith('http')
        ? webAppUrlRaw.replace(/\/+$/, '') // Retirer les slashes finaux
        : 'https://crm-codex.vercel.app'
      
      const loginRedirectUri = `${cleanWebAppUrl}/auth/google/login`
      const callbackRedirectUri = `${cleanWebAppUrl}/auth/google/callback`
      
      const status = {
        configured: {
          clientId: !!clientId && clientId.length > 0,
          clientSecret: !!clientSecret && clientSecret.length > 0,
          redirectUri: !!redirectEnv && redirectEnv.length > 0,
          webAppUrl: !!webAppUrlRaw,
        },
        values: {
          clientId: clientId ? `${clientId.substring(0, 20)}...` : 'non configuré',
          redirectUri: redirectUri,
          redirectUriValid: redirectUri.startsWith('https://'),
          webAppUrl: webAppUrl,
          loginRedirectUri: loginRedirectUri,
          callbackRedirectUri: callbackRedirectUri,
        },
        recommendations: [] as string[]
      }
      
      if (!status.configured.clientId) {
        status.recommendations.push('GOOGLE_CLIENT_ID manquant dans les secrets Supabase')
      }
      if (!status.configured.clientSecret) {
        status.recommendations.push('GOOGLE_CLIENT_SECRET manquant dans les secrets Supabase')
      }
      if (!status.configured.redirectUri) {
        status.recommendations.push('GOOGLE_REDIRECT_URI non configuré, utilisation de la valeur par défaut')
      }
      if (!status.values.redirectUriValid) {
        status.recommendations.push(`L'URI de redirection doit commencer par "https://". Actuellement: ${redirectUri}`)
      }
      if (!status.configured.webAppUrl) {
        status.recommendations.push('WEB_APP_URL non configuré, utilisation de la valeur par défaut')
      }
      
      // Recommandations spécifiques pour les URIs de redirection
      status.recommendations.push(`⚠️ IMPORTANT: Ajoutez ces URIs EXACTES dans Google Cloud Console (OAuth 2.0 Client IDs → Authorized redirect URIs):`)
      status.recommendations.push(`  1. ${loginRedirectUri}`)
      status.recommendations.push(`  2. ${callbackRedirectUri}`)
      status.recommendations.push(`  (Vérifiez qu'il n'y a PAS de trailing slash et que c'est exactement HTTPS)`)
      
      return new Response(
        JSON.stringify(status, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'google/auth-url' && method === 'GET') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
      const webAppUrlRaw = Deno.env.get('WEB_APP_URL')
      const url = new URL(req.url)
      const isLogin = url.searchParams.get('login') === 'true'
      
      // Construire l'URI de redirection selon le contexte (login ou connexion Drive)
      // Nettoyer le webAppUrlRaw pour éviter les doubles slashes
      const cleanWebAppUrl = webAppUrlRaw && 
        typeof webAppUrlRaw === 'string' && 
        webAppUrlRaw !== 'undefined' && 
        webAppUrlRaw !== 'null' &&
        webAppUrlRaw.length > 0 &&
        webAppUrlRaw.startsWith('http')
        ? webAppUrlRaw.replace(/\/+$/, '') // Retirer les slashes finaux
        : 'https://crm-codex.vercel.app'
      
      let redirectUri: string
      if (isLogin) {
        // Pour le login, utiliser la route de callback login
        redirectUri = `${cleanWebAppUrl}/auth/google/login`
      } else {
        // Pour la connexion Drive (avec userId)
        redirectUri = `${cleanWebAppUrl}/auth/google/callback`
      }
      
      console.log('Using frontend redirect URI:', redirectUri, 'isLogin:', isLogin)
      console.log('WEB_APP_URL from env:', webAppUrlRaw)
      
      // Valider que l'URI est valide
      if (!redirectUri || !redirectUri.startsWith('https://')) {
        return new Response(
          JSON.stringify({ error: 'Invalid redirect URI configuration', redirectUri, webAppUrl: webAppUrlRaw }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Log l'URI exacte qui sera utilisée (pour debug)
      console.log('Final redirect URI:', redirectUri)
      console.log('URI length:', redirectUri.length)
      console.log('URI ends with /auth/google/login:', redirectUri.endsWith('/auth/google/login'))
      console.log('URI ends with /auth/google/callback:', redirectUri.endsWith('/auth/google/callback'))
      
      // Scopes différents selon le contexte
      const scopes = isLogin 
        ? [ 'openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/drive' ]
        : [ 'https://www.googleapis.com/auth/drive' ]
      
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      u.searchParams.set('client_id', clientId)
      u.searchParams.set('redirect_uri', redirectUri)
      u.searchParams.set('response_type', 'code')
      u.searchParams.set('access_type', 'offline')
      // Pour le login, ne pas forcer le consentement si l'utilisateur a déjà autorisé
      // Pour la connexion Drive, utiliser 'consent' seulement si nécessaire
      // Si isLogin, ne pas mettre 'prompt' pour permettre la réutilisation du consentement
      if (!isLogin) {
        u.searchParams.set('prompt', 'consent')
      }
      u.searchParams.set('scope', scopes.join(' '))
      const state = url.searchParams.get('state') ?? ''
      if (state) u.searchParams.set('state', state)
      return new Response(JSON.stringify({ url: u.toString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (path === 'google/callback' && method === 'POST') {
      // Wrapper global pour capturer toutes les erreurs
      try {
        console.log('=== Google OAuth Callback (POST) ===')
        console.log('URL:', req.url)
        console.log('Method:', method)
        console.log('Path:', path)
        console.log('Headers Authorization:', req.headers.get('Authorization') ? 'Present' : 'Missing')
        
        // Helper pour retourner une réponse JSON
        const returnResponse = (success: boolean, message?: string) => {
          return new Response(
            JSON.stringify({ success, message: message || (success ? 'Google OAuth successful' : 'Google OAuth failed') }),
            { 
              status: success ? 200 : 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        // Lire code et state depuis le body JSON (POST)
        const body = await req.json().catch(() => ({}))
        const code = body.code
        const state = body.state
        const errorParam = body.error

        // Si Google renvoie une erreur
        if (errorParam) {
          const errorDescription = body.error_description || 'Erreur inconnue'
          console.error('Google OAuth error:', errorParam, errorDescription)
          return returnResponse(false, `Erreur Google: ${errorDescription}`)
        }

        // Vérifier que le code est présent
        if (!code) {
          console.error('Missing code in callback')
          return returnResponse(false, 'Le code d\'autorisation Google est manquant')
        }

        // Vérifier que le state (userId) est présent
        if (!state) {
          console.error('Missing state (userId) in callback')
          return returnResponse(false, 'L\'identifiant utilisateur n\'a pas été transmis')
        }

        const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
        
        if (!clientId || !clientSecret) {
          console.error('Missing Google credentials')
          return returnResponse(false, 'Les identifiants Google ne sont pas configurés côté serveur')
        }

        // Construire l'URI de redirection - IMPORTANT: utiliser l'URI exacte configurée dans Google Cloud Console
        // Elle doit correspondre à celle utilisée dans google/auth-url (frontend)
        const webAppUrlRaw = Deno.env.get('WEB_APP_URL')
        let actualRedirectUri: string
        if (webAppUrlRaw && 
            typeof webAppUrlRaw === 'string' && 
            webAppUrlRaw !== 'undefined' && 
            webAppUrlRaw !== 'null' &&
            webAppUrlRaw.length > 0 &&
            webAppUrlRaw.startsWith('http')) {
          actualRedirectUri = `${webAppUrlRaw}/auth/google/callback`
        } else {
          actualRedirectUri = 'https://crm-codex.vercel.app/auth/google/callback'
        }
        console.log('Using redirect URI for token exchange:', actualRedirectUri)

        console.log('Exchanging code for token, redirectUri:', actualRedirectUri)

        // Échanger le code contre un token
        try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: actualRedirectUri,
            grant_type: 'authorization_code'
          })
        })
        
        const tokenTxt = await tokenRes.text()
        
        if (!tokenRes.ok) {
          console.error('Token exchange failed:', tokenRes.status, tokenTxt)
          let errorMsg = 'Échec de l\'échange du code d\'autorisation'
          try {
            const errorJson = JSON.parse(tokenTxt)
            errorMsg = errorJson.error_description || errorJson.error || errorMsg
            // Vérifier si c'est une erreur de redirect_uri mismatch
            if (errorJson.error === 'redirect_uri_mismatch') {
                errorMsg = `URI de redirection incorrecte. Vérifiez que l'URI dans Google Cloud Console correspond exactement à: ${actualRedirectUri}`
            }
          } catch {
            errorMsg = tokenTxt.substring(0, 200)
          }
          return returnResponse(false, errorMsg)
        }

        const tokenJson = JSON.parse(tokenTxt)
        
        if (!tokenJson.access_token) {
          console.error('No access token in response')
          return returnResponse(false, 'Token d\'accès manquant dans la réponse Google')
        }

        const userId = state
        const now = new Date().toISOString()
        const expiryDate = tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString() : null

        // Stocker ou mettre à jour le token
        const { data: existing } = await supabase.from('GoogleToken').select('*').eq('userId', userId).single()
        
        if (existing) {
          const { error: updateError } = await supabase.from('GoogleToken').update({
            accessToken: tokenJson.access_token,
            refreshToken: tokenJson.refresh_token ?? existing.refreshToken,
            scope: tokenJson.scope,
            tokenType: tokenJson.token_type,
            expiryDate,
            updatedAt: now
          }).eq('userId', userId)
          
          if (updateError) {
            console.error('Error updating token:', updateError)
            return returnResponse(false, 'Erreur lors de la mise à jour du token')
          }
        } else {
          const { error: insertError } = await supabase.from('GoogleToken').insert({
            userId,
            accessToken: tokenJson.access_token,
            refreshToken: tokenJson.refresh_token,
            scope: tokenJson.scope,
            tokenType: tokenJson.token_type,
            expiryDate,
            createdAt: now,
            updatedAt: now
          })
          
          if (insertError) {
            console.error('Error inserting token:', insertError)
            console.error('Insert error details:', JSON.stringify(insertError, null, 2))
            console.error('Token data:', { userId, hasAccessToken: !!tokenJson.access_token, hasRefreshToken: !!tokenJson.refresh_token })
            return returnResponse(false, `Erreur lors de l'enregistrement du token: ${insertError.message || insertError.code || 'Erreur inconnue'}`)
          }
        }

        console.log('Google OAuth successful for userId:', userId)
        return returnResponse(true)

        } catch (error) {
          console.error('Unexpected error in token exchange:', error)
          return returnResponse(false, `Erreur inattendue: ${error instanceof Error ? error.message : String(error)}`)
        }
        } catch (outerError) {
          // Catch global pour toutes les erreurs non capturées (erreurs de syntaxe, variables non définies, etc.)
          console.error('Fatal error in Google callback:', outerError)
          const errorMsg = outerError instanceof Error ? outerError.message : String(outerError)
          return new Response(
            JSON.stringify({ success: false, message: `Erreur fatale: ${errorMsg}` }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
    }

    // ===== AUTHENTICATION VIA GOOGLE =====
    if (path === 'auth/google' && method === 'POST') {
      const { code } = await req.json()
      
      if (!code) {
        return new Response(
          JSON.stringify({ message: 'Code OAuth manquant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
      
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ message: 'Google OAuth non configuré' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Construire l'URI de redirection pour le login
      const webAppUrlRaw = Deno.env.get('WEB_APP_URL')
      // Nettoyer le webAppUrlRaw pour éviter les doubles slashes
      const cleanWebAppUrl = webAppUrlRaw && 
        typeof webAppUrlRaw === 'string' && 
        webAppUrlRaw !== 'undefined' && 
        webAppUrlRaw !== 'null' &&
        webAppUrlRaw.length > 0 &&
        webAppUrlRaw.startsWith('http')
        ? webAppUrlRaw.replace(/\/+$/, '') // Retirer les slashes finaux
        : 'https://crm-codex.vercel.app'
      
      const redirectUri = `${cleanWebAppUrl}/auth/google/login`

      try {
        // Échanger le code contre un token Google
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        })

        if (!tokenRes.ok) {
          const errorText = await tokenRes.text()
          console.error('Token exchange failed:', tokenRes.status, errorText)
          return new Response(
            JSON.stringify({ message: 'Échec de l\'échange du code OAuth' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const tokenJson = await tokenRes.json()
        
        if (!tokenJson.access_token) {
          return new Response(
            JSON.stringify({ message: 'Token d\'accès manquant' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Récupérer les infos utilisateur Google
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` }
        })

        if (!userInfoRes.ok) {
          return new Response(
            JSON.stringify({ message: 'Impossible de récupérer les informations utilisateur Google' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const userInfo = await userInfoRes.json()
        const googleEmail = userInfo.email

        if (!googleEmail) {
          return new Response(
            JSON.stringify({ message: 'Email Google manquant' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Chercher ou créer l'utilisateur dans la table User
        let { data: user } = await supabase
          .from('User')
          .select('*')
          .eq('email', googleEmail)
          .single()

        const now = new Date().toISOString()
        
        if (!user) {
          // Créer un nouvel utilisateur
          const newId = crypto.randomUUID()
          const { data: inserted, error: insertError } = await supabase
            .from('User')
            .insert({ 
              id: newId, 
              email: googleEmail, 
              passwordHash: '', // Pas de mot de passe pour les utilisateurs Google
              createdAt: now, 
              updatedAt: now 
            })
            .select('*')
            .single()
          
          if (insertError || !inserted) {
            console.error('Error creating user:', insertError)
            return new Response(
              JSON.stringify({ message: 'Erreur lors de la création de l\'utilisateur' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          user = inserted
        }

        // Stocker le token Google dans GoogleToken
        const expiryDate = tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString() : null
        const { data: existingToken } = await supabase.from('GoogleToken').select('*').eq('userId', user.id).single()
        
        if (existingToken) {
          // Mettre à jour le token existant
          await supabase.from('GoogleToken').update({
            accessToken: tokenJson.access_token,
            refreshToken: tokenJson.refresh_token ?? existingToken.refreshToken, // Garder l'ancien refresh token si Google n'en renvoie pas
            scope: tokenJson.scope,
            tokenType: tokenJson.token_type,
            expiryDate,
            updatedAt: now
          }).eq('userId', user.id)
        } else {
          // Créer un nouveau token
          await supabase.from('GoogleToken').insert({
            userId: user.id,
            accessToken: tokenJson.access_token,
            refreshToken: tokenJson.refresh_token,
            scope: tokenJson.scope,
            tokenType: tokenJson.token_type,
            expiryDate,
            createdAt: now,
            updatedAt: now
          })
        }

        // Générer les tokens JWT du CRM
        const accessToken = await createAccessToken(user.id)
        const refreshToken = await createRefreshToken(user.id)
        
        // Stocker le refresh token en base
        await supabase.from('RefreshToken').insert({ 
          token: refreshToken, 
          userId: user.id, 
          expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString() 
        })

        return new Response(
          JSON.stringify({ accessToken, refreshToken }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        console.error('Error in Google auth:', error)
        return new Response(
          JSON.stringify({ message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ===== CHECK GOOGLE CONNECTION STATUS (needs auth) =====
    if (path === 'google/connected' && method === 'GET') {
      // Extract and verify JWT token
      const userAuthHeader = req.headers.get('x-user-authorization') || ''
      if (!userAuthHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ connected: false, message: 'Not authenticated' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const token = userAuthHeader.substring(7)
      const payload = await verifyAccessToken(token)
      if (!payload) {
        return new Response(
          JSON.stringify({ connected: false, message: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const userId = payload.userId
      
      // Vérifier si l'utilisateur a un token Google
      const { data: googleToken } = await supabase
        .from('GoogleToken')
        .select('userId')
        .eq('userId', userId)
        .single()
      
      return new Response(
        JSON.stringify({ connected: !!googleToken }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== MAKE CALLBACKS ROUTES (public avec vérification signature) =====
    if (path === 'integrations/make/tiime/quote' && method === 'POST') {
      const signature = req.headers.get('x-make-signature') || ''
      const expectedSecret = Deno.env.get('MAKE_WEBHOOK_SECRET') ?? ''
      
      if (!expectedSecret || signature !== expectedSecret) {
        return new Response(
          JSON.stringify({ message: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const body = await req.json()
      const { opportunityId, tiimeQuoteId, quoteUrl } = body
      
      if (!opportunityId || !tiimeQuoteId || !quoteUrl) {
        return new Response(
          JSON.stringify({ message: 'opportunityId, tiimeQuoteId, and quoteUrl are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const { error } = await supabase
        .from('Opportunity')
        .update({ tiimeQuoteId, quoteUrl: quoteUrl, updatedAt: new Date().toISOString() })
        .eq('id', opportunityId)
      
      if (error) {
        console.error('[Make Callback] Erreur mise à jour quote:', error)
        return new Response(
          JSON.stringify({ message: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ status: 'ok' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'integrations/make/tiime/invoice' && method === 'POST') {
      const signature = req.headers.get('x-make-signature') || ''
      const expectedSecret = Deno.env.get('MAKE_WEBHOOK_SECRET') ?? ''
      
      if (!expectedSecret || signature !== expectedSecret) {
        return new Response(
          JSON.stringify({ message: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const body = await req.json()
      const { opportunityId, tiimeInvoiceId, invoiceUrl } = body
      
      if (!opportunityId || !tiimeInvoiceId || !invoiceUrl) {
        return new Response(
          JSON.stringify({ message: 'opportunityId, tiimeInvoiceId, and invoiceUrl are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Vérifier que l'opportunité existe et récupérer les invoices existantes
      const { data: opp } = await supabase
        .from('Opportunity')
        .select('id, tiimeInvoiceIds, invoiceUrls')
        .eq('id', opportunityId)
        .single()
      
      if (!opp) {
        return new Response(
          JSON.stringify({ status: 'ignored', message: 'Opportunity not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Gérer les tableaux d'invoices
      const currentInvoiceIds = Array.isArray(opp.tiimeInvoiceIds) ? [...opp.tiimeInvoiceIds] : []
      const currentInvoiceUrls = Array.isArray(opp.invoiceUrls) ? [...opp.invoiceUrls] : []
      
      // Ajouter la nouvelle invoice si elle n'existe pas déjà
      if (!currentInvoiceIds.includes(tiimeInvoiceId)) {
        currentInvoiceIds.push(tiimeInvoiceId)
      }
      if (!currentInvoiceUrls.includes(invoiceUrl)) {
        currentInvoiceUrls.push(invoiceUrl)
      }
      
      const { error } = await supabase
        .from('Opportunity')
        .update({ 
          tiimeInvoiceIds: currentInvoiceIds,
          invoiceUrls: currentInvoiceUrls,
          updatedAt: new Date().toISOString() 
        })
        .eq('id', opportunityId)
      
      if (error) {
        console.error('[Make Callback] Erreur mise à jour invoice:', error)
        return new Response(
          JSON.stringify({ message: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ status: 'ok' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'integrations/make/tiime/company' && method === 'POST') {
      const signature = req.headers.get('x-make-signature') || ''
      const expectedSecret = Deno.env.get('MAKE_WEBHOOK_SECRET') ?? ''
      
      if (!expectedSecret || signature !== expectedSecret) {
        return new Response(
          JSON.stringify({ message: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const body = await req.json()
      const { companyId, tiimeId } = body
      
      if (!companyId || !tiimeId) {
        return new Response(
          JSON.stringify({ message: 'companyId and tiimeId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const { error } = await supabase
        .from('Company')
        .update({ tiimeId, updatedAt: new Date().toISOString() })
        .eq('id', companyId)
      
      if (error) {
        console.error('[Make Callback] Erreur mise à jour company:', error)
        return new Response(
          JSON.stringify({ message: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ status: 'ok' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== AUTHENTICATED ROUTES =====
    // Skip auth check for public routes (already handled above)
    const publicRoutes = ['google/callback', 'google/auth-url', 'google/status', 'auth/login', 'auth/google', 'auth/refresh', 'auth/health', 'auth/bootstrap-admin', 'auth/test-login']
    const isPublicRoute = publicRoutes.includes(path)
    
    if (!isPublicRoute) {
    // Extract and verify JWT token
      // IMPORTANT: Supabase Edge Functions require 'apikey' header for platform auth
      // User JWT is sent in 'x-user-authorization' header (NOT in Authorization)
      const userAuthHeader = req.headers.get('x-user-authorization') || ''
      if (!userAuthHeader?.startsWith('Bearer ')) {
      return new Response(
          JSON.stringify({ code: 401, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

      const token = userAuthHeader.substring(7)
    const payload = await verifyAccessToken(token)
    if (!payload) {
      return new Response(
          JSON.stringify({ code: 401, message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = payload.userId

      // ==== Helpers Google Drive ====
    async function getGoogleTokenRecord(uid: string) {
      const { data } = await supabase.from('GoogleToken').select('*').eq('userId', uid).single()
      return data as any | null
    }

    async function refreshAccessToken(refreshToken: string) {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      })
      if (!res.ok) return null
      const json = await res.json()
      return json as any
    }

    function sanitizeName(name: string) {
      return (name || 'untitled').replace(/[^a-zA-Z0-9 _-]+/g, '_').substring(0, 200)
    }

    async function getValidAccessToken(uid: string) {
      const rec = await getGoogleTokenRecord(uid)
      if (!rec) return null
      if (rec.expiryDate && new Date(rec.expiryDate) > new Date(Date.now() + 60000)) {
        return rec.accessToken as string
      }
      if (!rec.refreshToken) return rec.accessToken as string
      const refreshed = await refreshAccessToken(rec.refreshToken as string)
      if (refreshed?.access_token) {
        const expiryDate = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : rec.expiryDate
        // IMPORTANT: Ne pas mettre à jour le refreshToken car Google ne le renvoie pas toujours dans la réponse de refresh
        // Le refreshToken reste le même et ne doit jamais être supprimé
        await supabase.from('GoogleToken').update({ 
          accessToken: refreshed.access_token, 
          expiryDate, 
          updatedAt: new Date().toISOString() 
        }).eq('userId', uid)
        return refreshed.access_token as string
      }
      return rec.accessToken as string
    }

    async function findFolderByName(accessToken: string, name: string, parentId?: string) {
      const q = parentId ? `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false` : `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const json = await res.json()
      return (json.files && json.files[0]) || null
    }

    async function createFolder(accessToken: string, name: string, parentId?: string) {
      const body: any = { name, mimeType: 'application/vnd.google-apps.folder' }
      if (parentId) body.parents = [parentId]
      const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Failed to create folder')
      return await res.json()
    }

    async function renameFile(accessToken: string, fileId: string, newName: string) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      if (!res.ok) throw new Error('Failed to rename file')
      return await res.json()
    }

    async function deleteFolder(accessToken: string, folderId: string) {
      // Supprimer définitivement le dossier (pas seulement le mettre à la corbeille)
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Failed to delete folder: ${res.status} ${errorText}`)
      }
      return true
    }

    async function deleteFile(accessToken: string, fileId: string) {
      // Supprimer définitivement le fichier (pas seulement le mettre à la corbeille)
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Failed to delete file: ${res.status} ${errorText}`)
      }
      return true
    }

    // ===== DRIVE ROUTES =====
    if (path === 'drive/ensure-company' && method === 'POST') {
      const { companyId, companyName } = await req.json()
      const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?? ''
      if (!rootId) return new Response(JSON.stringify({ message: 'Missing GOOGLE_DRIVE_ROOT_FOLDER_ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const at = await getValidAccessToken(userId)
      if (!at) return new Response(JSON.stringify({ message: 'Missing Google token. Connectez Google.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { data: company } = await supabase.from('Company').select('*').eq('id', companyId).single()
      const safeName = sanitizeName(companyName || company?.name || companyId)
      let folderId = company?.googleDriveFolderId
      if (!folderId) {
        const found = await findFolderByName(at, safeName, rootId)
        if (found) {
          folderId = found.id
        } else {
          const created = await createFolder(at, safeName, rootId)
          folderId = created.id
        }
        await supabase.from('Company').update({ googleDriveFolderId: folderId, updatedAt: new Date().toISOString() }).eq('id', companyId)
      }
      return new Response(JSON.stringify({ folderId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (path === 'drive/ensure-opportunity' && method === 'POST') {
      const { companyId, opportunityId, opportunityTitle } = await req.json()
      const at = await getValidAccessToken(userId)
      if (!at) return new Response(JSON.stringify({ message: 'Missing Google token. Connectez Google.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { data: company } = await supabase.from('Company').select('id, name, googleDriveFolderId').eq('id', companyId).single()
      if (!company?.googleDriveFolderId) return new Response(JSON.stringify({ message: 'Company folder missing. Call ensure-company first.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { data: opp } = await supabase.from('Opportunity').select('*').eq('id', opportunityId).single()
      let oppFolderId = opp?.googleDriveFolderId
      const safeName = sanitizeName(opportunityTitle || opp?.title || opportunityId)
      if (!oppFolderId) {
        const found = await findFolderByName(at, safeName, company.googleDriveFolderId)
        if (found) {
          oppFolderId = found.id
        } else {
          const created = await createFolder(at, safeName, company.googleDriveFolderId)
          oppFolderId = created.id
        }
        await supabase.from('Opportunity').update({ googleDriveFolderId: oppFolderId, updatedAt: new Date().toISOString() }).eq('id', opportunityId)
      }
      return new Response(JSON.stringify({ folderId: oppFolderId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (path === 'drive/rename-opportunity' && method === 'POST') {
      const { opportunityId, newName } = await req.json()
      const at = await getValidAccessToken(userId)
      if (!at) return new Response(JSON.stringify({ message: 'Missing Google token. Connectez Google.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { data: opp } = await supabase.from('Opportunity').select('id, googleDriveFolderId').eq('id', opportunityId).single()
      if (!opp?.googleDriveFolderId) return new Response(JSON.stringify({ message: 'Opportunity folder missing' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const safe = sanitizeName(newName || '')
      await renameFile(at, opp.googleDriveFolderId, safe)
      return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
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

    // ===== WEBHOOKS ROUTES =====
    if (path === 'webhooks' && method === 'GET') {
      const { data, error } = await supabase
        .from('Webhook')
        .select('*')
        .order('createdAt', { ascending: false })
      
      if (error) throw error
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'webhooks' && method === 'POST') {
      const body = await req.json()
      const { url, event } = body
      
      if (!url || !event) {
        return new Response(
          JSON.stringify({ message: 'url and event are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Validation basique de l'URL
      try {
        new URL(url)
      } catch {
        return new Response(
          JSON.stringify({ message: 'Invalid URL format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const { data, error } = await supabase
        .from('Webhook')
        .insert({ url, event })
        .select()
        .single()
      
      if (error) throw error
      
      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== TAX RATES ROUTES =====
    if (path === 'tax-rates' && method === 'GET') {
      const { data, error } = await supabase
        .from('TaxRateConfig')
        .select('*')
        .order('effectiveFrom', { ascending: false })

      if (error) {
        console.error('[TAX-RATES] Error fetching tax rates:', error)
        return new Response(
          JSON.stringify({ message: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(data ?? []),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'tax-rates' && method === 'POST') {
      const body = await req.json()
      const { rate, label, effectiveFrom } = body as { rate?: number; label?: string; effectiveFrom?: string }

      if (typeof rate !== 'number' || !effectiveFrom) {
        return new Response(
          JSON.stringify({ message: 'rate (number) and effectiveFrom (ISO string) are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('TaxRateConfig')
        .insert({
          rate,
          label: label ?? null,
          effectiveFrom
        })
        .select()
        .single()

      if (error) {
        console.error('[TAX-RATES] Error inserting tax rate:', error)
        return new Response(
          JSON.stringify({ message: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'webhooks/events' && method === 'GET') {
      const events = [
        {
          name: 'opportunity.created',
          description: 'Déclenché lorsqu\'une nouvelle opportunité est créée',
          payload: { opportunity: 'Opportunity object' }
        },
        {
          name: 'opportunity.updated',
          description: 'Déclenché lorsqu\'une opportunité est modifiée (hors changement de stage)',
          payload: { opportunity: 'Opportunity object' }
        },
        {
          name: 'opportunity.stage_changed',
          description: 'Déclenché lorsque le stage d\'une opportunité change',
          payload: { opportunity: 'Opportunity object', oldStage: 'string', newStage: 'string' }
        },
        {
          name: 'company.created',
          description: 'Déclenché lorsqu\'une nouvelle entreprise est créée',
          payload: { company: 'Company object' }
        },
        {
          name: 'company.updated',
          description: 'Déclenché lorsqu\'une entreprise est modifiée',
          payload: { company: 'Company object' }
        },
        {
          name: 'quote.created',
          description: 'Déclenché lorsqu\'un nouveau devis est créé',
          payload: { quote: 'Quote object with items' }
        },
        {
          name: 'quote.updated',
          description: 'Déclenché lorsqu\'un devis est modifié',
          payload: { quote: 'Quote object with items' }
        }
      ]
      
      return new Response(
        JSON.stringify(events),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('webhooks/') && method === 'DELETE') {
      const id = path.split('/')[1]
      const { error } = await supabase
        .from('Webhook')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // ===== QUOTES ROUTES =====
    // Helper function to calculate totals from items
    function calculateQuoteTotals(items: any[]): { totalHT: number, totalTTC: number } {
      let totalHT = 0
      let maxTaxRate = 0
      
      items.forEach((item: any) => {
        const lineHT = (Number(item.quantity) * Number(item.unitPriceHT)) - (Number(item.discountAmount) || 0)
        totalHT += lineHT
        if (Number(item.taxRate) > maxTaxRate) {
          maxTaxRate = Number(item.taxRate)
        }
      })
      
      const totalTTC = totalHT * (1 + maxTaxRate)
      
      return { totalHT, totalTTC }
    }

    if (path === 'quotes' && method === 'GET') {
      const opportunityId = url.searchParams.get('opportunityId')
      const companyId = url.searchParams.get('companyId')
      const status = url.searchParams.get('status')
      
      let query = supabase
        .from('Quote')
        .select('*, items:QuoteItem(*), opportunity:Opportunity(id, title, company:Company(id, name)), company:Company(id, name)')
        .order('createdAt', { ascending: false })
      
      if (opportunityId) {
        query = query.eq('opportunityId', opportunityId)
      }
      if (companyId) {
        query = query.eq('companyId', companyId)
      }
      if (status) {
        query = query.eq('status', status)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('quotes/') && method === 'GET') {
      const id = path.split('/')[1]
      const { data, error } = await supabase
        .from('Quote')
        .select('*, items:QuoteItem(*), opportunity:Opportunity(id, title, companyId), company:Company(id, name)')
        .eq('id', id)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'quotes' && method === 'POST') {
      const body = await req.json()
      const { items, ...quoteData } = body
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(
          JSON.stringify({ message: 'At least one item is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Calculer les totaux de chaque ligne
      const itemsWithTotals = items.map((item: any, index: number) => {
        const lineHT = (Number(item.quantity) * Number(item.unitPriceHT)) - (Number(item.discountAmount) || 0)
        return {
          ...item,
          totalHT: lineHT,
          order: item.order ?? index
        }
      })
      
      // Calculer les totaux du devis
      const { totalHT, totalTTC } = calculateQuoteTotals(itemsWithTotals)
      
      const now = new Date().toISOString()
      const quoteId = crypto.randomUUID()
      
      // Créer le devis
      const { data: quote, error: quoteError } = await supabase
        .from('Quote')
        .insert({
          id: quoteId,
          ...quoteData,
          totalHT: totalHT.toString(),
          totalTTC: totalTTC.toString(),
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single()
      
      if (quoteError) throw quoteError
      
      // Créer les lignes de devis
      const itemsToInsert = itemsWithTotals.map((item: any) => ({
        id: crypto.randomUUID(),
        label: item.label,
        description: item.description || null,
        quantity: item.quantity.toString(),
        unit: item.unit,
        unitPriceHT: item.unitPriceHT.toString(),
        discountAmount: item.discountAmount ? item.discountAmount.toString() : null,
        taxRate: item.taxRate.toString(),
        vatExemptionReason: item.vatExemptionReason || null,
        totalHT: item.totalHT.toString(),
        order: item.order,
        quoteId: quoteId,
        createdAt: now,
        updatedAt: now
      }))
      
      const { error: itemsError } = await supabase
        .from('QuoteItem')
        .insert(itemsToInsert)
      
      if (itemsError) throw itemsError
      
      // Récupérer le devis complet avec ses lignes
      const { data: fullQuote, error: fetchError } = await supabase
        .from('Quote')
        .select('*, items:QuoteItem(*), opportunity:Opportunity(id, title, company:Company(id, name)), company:Company(id, name)')
        .eq('id', quoteId)
        .single()
      
      if (fetchError) throw fetchError
      
      // Déclencher webhook quote.created
      if (fullQuote) {
        triggerWebhooks('quote.created', fullQuote).catch(err => 
          console.error('[Webhook] Erreur déclenchement quote.created:', err)
        )
      }

      return new Response(
        JSON.stringify(fullQuote),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('quotes/') && method === 'PATCH') {
      const id = path.split('/')[1]
      const body = await req.json()
      const { items, ...quoteData } = body
      
      const now = new Date().toISOString()
      let updateData: any = { ...quoteData, updatedAt: now }
      
      // Si des items sont fournis, recalculer les totaux
      if (items && Array.isArray(items) && items.length > 0) {
        const itemsWithTotals = items.map((item: any, index: number) => {
          const lineHT = (Number(item.quantity) * Number(item.unitPriceHT)) - (Number(item.discountAmount) || 0)
          return {
            ...item,
            totalHT: lineHT,
            order: item.order ?? index
          }
        })
        
        const { totalHT, totalTTC } = calculateQuoteTotals(itemsWithTotals)
        updateData.totalHT = totalHT.toString()
        updateData.totalTTC = totalTTC.toString()
        
        // Supprimer les anciennes lignes et créer les nouvelles
        await supabase.from('QuoteItem').delete().eq('quoteId', id)
        
        const itemsToInsert = itemsWithTotals.map((item: any) => ({
          id: crypto.randomUUID(),
          label: item.label,
          description: item.description || null,
          quantity: item.quantity.toString(),
          unit: item.unit,
          unitPriceHT: item.unitPriceHT.toString(),
          discountAmount: item.discountAmount ? item.discountAmount.toString() : null,
          taxRate: item.taxRate.toString(),
          vatExemptionReason: item.vatExemptionReason || null,
          totalHT: item.totalHT.toString(),
          order: item.order,
          quoteId: id,
          createdAt: now,
          updatedAt: now
        }))
        
        const { error: itemsError } = await supabase
          .from('QuoteItem')
          .insert(itemsToInsert)
        
        if (itemsError) throw itemsError
      }
      
      const { data, error } = await supabase
        .from('Quote')
        .update(updateData)
        .eq('id', id)
        .select('*, items:QuoteItem(*), opportunity:Opportunity(id, title, company:Company(id, name)), company:Company(id, name)')
        .single()

      if (error) throw error
      
      // Déclencher webhook quote.updated
      if (data) {
        triggerWebhooks('quote.updated', data).catch(err => 
          console.error('[Webhook] Erreur déclenchement quote.updated:', err)
        )
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('quotes/') && method === 'DELETE') {
      const id = path.split('/')[1]
      
      // Les QuoteItem seront supprimés automatiquement grâce à onDelete: Cascade
      const { error } = await supabase
        .from('Quote')
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
      const { tags, ...companyData } = body || {}
      const now = new Date().toISOString()
      const newId = crypto.randomUUID()
      
      const { data, error } = await supabase
        .from('Company')
        .insert({ 
          id: newId, 
          ...companyData,
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single()

      if (error) throw error

      // Gérer les tags si fournis (tableau de strings)
      if (data && tags && Array.isArray(tags) && tags.length > 0) {
        for (const tagName of tags) {
          if (!tagName || typeof tagName !== 'string') continue

          let { data: existingTag } = await supabase
            .from('Tag')
            .select('id')
            .eq('name', tagName.trim())
            .single()

          let tagId: string

          if (!existingTag) {
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

          await supabase.from('_CompanyToTag').insert({ A: data.id, B: tagId })
        }
      }

      // Déclencher webhook company.created
      if (data) {
        triggerWebhooks('company.created', data).catch(err => 
          console.error('[Webhook] Erreur déclenchement company.created:', err)
        )
      }

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

      // Déclencher webhook company.updated
      if (data) {
        triggerWebhooks('company.updated', data).catch(err => 
          console.error('[Webhook] Erreur déclenchement company.updated:', err)
        )
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

      // Pour la recherche, charger plus de données pour permettre le filtrage par nom d'entreprise
      const fetchLimit = search ? Math.max(limit * 5, 200) : limit

      let query = supabase
        .from('Opportunity')
        .select('*, contact:Contact(*), company:Company(*)', { count: 'exact' })
        .order('createdAt', { ascending: false })
        .limit(fetchLimit)

      if (companyId) {
        query = query.eq('companyId', companyId)
      }

      // Si recherche, on ne filtre pas immédiatement par titre pour pouvoir aussi chercher dans les noms d'entreprises
      // On chargera toutes les opportunités et on filtrera ensuite
      const { data, error, count } = await query

      if (error) throw error

      // Filtrer par titre ET par nom d'entreprise si search est fourni
      let filteredData = data || []
      if (search && data) {
        const searchLower = search.toLowerCase()
        filteredData = data.filter((opp: any) => 
          opp.title?.toLowerCase().includes(searchLower) ||
          opp.company?.name?.toLowerCase().includes(searchLower)
        )
        // Limiter après le filtrage
        filteredData = filteredData.slice(0, limit)
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

      // Créer les dossiers Drive (entreprise + opportunité) si l'opportunité a une entreprise
      // Le dossier entreprise n'est créé QUE lors de la création d'une opportunité (pas de dossiers vides)
      console.log('Vérification création dossiers Drive:', { hasCompanyId: !!data?.companyId, companyId: data?.companyId, opportunityId: newId })
      if (data?.companyId) {
        try {
          const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?? ''
          console.log('=== Création dossiers Drive ===')
          console.log('rootId configuré:', !!rootId, rootId ? `${rootId.substring(0, 10)}...` : 'MANQUANT')
          console.log('companyId:', data.companyId)
          console.log('opportunityId:', newId)
          console.log('userId:', userId)
          
          if (!rootId) {
            console.error('❌ GOOGLE_DRIVE_ROOT_FOLDER_ID non configuré dans les secrets Supabase')
            // Ne pas bloquer la création de l'opportunité, juste logger l'erreur
          } else {
            console.log('✅ rootId trouvé, récupération du token Google...')
            let at: string | null = null
            try {
              at = await getValidAccessToken(userId)
              console.log('Token Google récupéré:', !!at, at ? `${at.substring(0, 20)}...` : 'MANQUANT')
            } catch (tokenError) {
              console.error('❌ Erreur lors de la récupération du token Google:', tokenError)
              console.error('Stack:', tokenError instanceof Error ? tokenError.stack : 'N/A')
            }
            
            if (!at) {
              console.error('❌ Token Google manquant ou invalide pour userId:', userId)
              // Ne pas bloquer la création de l'opportunité, juste logger l'erreur
            } else {
              console.log('✅ Token Google valide, récupération de l\'entreprise...')
              // Récupérer l'entreprise
              const { data: company, error: companyError } = await supabase.from('Company').select('*').eq('id', data.companyId).single()
              if (companyError) {
                console.error('❌ Erreur récupération entreprise:', companyError)
              }
              console.log('Entreprise récupérée:', !!company, company ? company.name : 'NON TROUVÉE')
              if (company) {
                // Créer/assurer le dossier entreprise (s'il n'existe pas déjà)
                // Vérification initiale
                let companyFolderId = company.googleDriveFolderId
                
                // Si pas de folderId, créer le dossier (avec vérification anti-doublon)
                if (!companyFolderId) {
                  const safeCompanyName = sanitizeName(company.name || data.companyId)
                  
                  // Chercher d'abord si un dossier existe déjà (au cas où il aurait été créé entre temps)
                  const found = await findFolderByName(at, safeCompanyName, rootId)
                  if (found) {
                    companyFolderId = found.id
                  } else {
                    // Créer le dossier seulement s'il n'existe pas
                    const created = await createFolder(at, safeCompanyName, rootId)
                    companyFolderId = created.id
                  }
                  
                  // Mettre à jour UNIQUEMENT si l'entreprise n'a toujours pas de folderId (évite les doublons en cas de création simultanée)
                  // Utiliser une condition WHERE pour éviter les mises à jour inutiles
                  const { data: updatedCompany, error: updateCompanyError } = await supabase
                    .from('Company')
                    .update({ googleDriveFolderId: companyFolderId, updatedAt: now })
                    .eq('id', data.companyId)
                    .is('googleDriveFolderId', null)
                    .select('googleDriveFolderId')
                    .single()
                  
                  if (updateCompanyError) {
                    console.error('Erreur mise à jour googleDriveFolderId entreprise:', updateCompanyError)
                  } else {
                    console.log('googleDriveFolderId sauvegardé pour entreprise:', data.companyId, '=', companyFolderId)
                  }
                  
                  // Si la mise à jour n'a pas fonctionné (car un autre processus a déjà créé le dossier), récupérer le folderId existant
                  if (!updatedCompany?.googleDriveFolderId) {
                    const { data: currentCompany } = await supabase.from('Company').select('googleDriveFolderId').eq('id', data.companyId).single()
                    if (currentCompany?.googleDriveFolderId) {
                      console.log('Récupération googleDriveFolderId existant pour entreprise:', currentCompany.googleDriveFolderId)
                      companyFolderId = currentCompany.googleDriveFolderId
                    }
                  }
                }
                
                // Créer le dossier opportunité
                const createdAt = new Date(data.createdAt || now)
                const yyyymmdd = createdAt.toISOString().slice(0, 10).replace(/-/g, '')
                const titleSane = sanitizeName(data.title || 'Opportunity')
                const stage = data.stage || 'QUALIFICATION'
                const oppFolderName = `${yyyymmdd}_${titleSane}_${stage}`
                
                console.log('Création dossier opportunité:', oppFolderName, 'dans companyFolderId:', companyFolderId)
                const createdOppFolder = await createFolder(at, oppFolderName, companyFolderId)
                console.log('✅ Dossier opportunité créé dans Drive:', createdOppFolder.id, 'pour opportunité:', newId)
                
                // Mettre à jour l'opportunité avec le folderId
                const { error: updateOppError, data: updatedOpp } = await supabase
                  .from('Opportunity')
                  .update({ googleDriveFolderId: createdOppFolder.id, updatedAt: now })
                  .eq('id', newId)
                  .select('googleDriveFolderId')
                  .single()
                
                if (updateOppError) {
                  console.error('❌ Erreur mise à jour googleDriveFolderId opportunité:', updateOppError)
                  console.error('Détails erreur:', JSON.stringify(updateOppError, null, 2))
                } else {
                  console.log('✅ googleDriveFolderId sauvegardé pour opportunité:', newId, '=', createdOppFolder.id)
                  console.log('Vérification en base:', updatedOpp?.googleDriveFolderId === createdOppFolder.id ? 'OK' : 'ERREUR')
                }
                
                // Mettre à jour l'objet data pour inclure le googleDriveFolderId dans la réponse
                data.googleDriveFolderId = createdOppFolder.id
              } else {
                console.warn('Entreprise non trouvée pour companyId:', data.companyId)
              }
            }
          }
        } catch (driveError) {
          // Erreur silencieuse - ne pas bloquer la création de l'opportunité
          console.error('Erreur lors de la création des dossiers Drive:', driveError)
          console.error('Stack:', driveError instanceof Error ? driveError.stack : 'N/A')
        }
      }

      // Re-sélectionner l'opportunité pour avoir toutes les données à jour (y compris googleDriveFolderId)
      const { data: finalOpportunity, error: finalError } = await supabase
        .from('Opportunity')
        .select('*, contact:Contact(*), company:Company(*)')
        .eq('id', newId)
        .single()
      
      if (finalError) {
        console.error('Erreur re-sélection opportunité:', finalError)
      } else {
        console.log('Opportunité finale:', { id: finalOpportunity?.id, googleDriveFolderId: finalOpportunity?.googleDriveFolderId, companyGoogleDriveFolderId: finalOpportunity?.company?.googleDriveFolderId })
      }

      // Déclencher webhook opportunity.created
      const opportunityForWebhook = finalOpportunity || data
      if (opportunityForWebhook) {
        triggerWebhooks('opportunity.created', opportunityForWebhook).catch(err => 
          console.error('[Webhook] Erreur déclenchement opportunity.created:', err)
        )
      }

      return new Response(
        JSON.stringify(opportunityForWebhook),
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
      
      console.log('PATCH opportunity:', { id, body })
      
      // Récupérer l'ancienne version pour détecter les changements (notamment stage)
      const { data: oldOpportunity } = await supabase
        .from('Opportunity')
        .select('stage')
        .eq('id', id)
        .single()
      
      const { data, error } = await supabase
        .from('Opportunity')
        .update({ ...body, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Erreur Supabase update:', error)
        console.error('Body envoyé:', JSON.stringify(body, null, 2))
        throw error
      }

      // Déclencher webhooks selon le type de changement
      if (data) {
        // Détecter changement de stage
        if (body.stage && oldOpportunity && oldOpportunity.stage !== body.stage) {
          // Créer automatiquement un devis brouillon si le stage passe à PROPOSAL
          if (body.stage === 'PROPOSAL' && oldOpportunity.stage !== 'PROPOSAL') {
            try {
              // Vérifier qu'il n'existe pas déjà un devis pour cette opportunité
              const { data: existingQuotes } = await supabase
                .from('Quote')
                .select('id')
                .eq('opportunityId', id)
                .limit(1)
              
              if (!existingQuotes || existingQuotes.length === 0) {
                // Récupérer l'opportunité complète pour avoir les infos nécessaires
                const { data: fullOpportunity } = await supabase
                  .from('Opportunity')
                  .select('*, company:Company(id, name)')
                  .eq('id', id)
                  .single()
                
                if (fullOpportunity) {
                  const now = new Date().toISOString()
                  const quoteId = crypto.randomUUID()
                  
                  // Calculer la date de validité (30 jours par défaut)
                  const validityDate = new Date()
                  validityDate.setDate(validityDate.getDate() + 30)
                  
                  // Créer une ligne de devis par défaut basée sur le montant de l'opportunité
                  const defaultAmount = fullOpportunity.amount || 0
                  const defaultItem = {
                    id: crypto.randomUUID(),
                    label: fullOpportunity.title || 'Prestation',
                    description: `Devis pour l'opportunité: ${fullOpportunity.title}`,
                    quantity: '1',
                    unit: 'forfait',
                    unitPriceHT: defaultAmount.toString(),
                    discountAmount: null,
                    taxRate: '0',
                    vatExemptionReason: null,
                    totalHT: defaultAmount.toString(),
                    order: 0,
                    quoteId: quoteId,
                    createdAt: now,
                    updatedAt: now
                  }
                  
                  // Créer le devis
                  const { error: quoteError } = await supabase
                    .from('Quote')
                    .insert({
                      id: quoteId,
                      label: `Devis - ${fullOpportunity.title}`,
                      issueDate: now,
                      validityEndDate: validityDate.toISOString(),
                      status: 'DRAFT',
                      opportunityId: id,
                      companyId: fullOpportunity.companyId || null,
                      totalHT: defaultAmount.toString(),
                      totalTTC: defaultAmount.toString(),
                      createdAt: now,
                      updatedAt: now
                    })
                  
                  if (!quoteError) {
                    // Créer la ligne de devis
                    await supabase
                      .from('QuoteItem')
                      .insert(defaultItem)
                    
                    console.log(`[Quote Auto] Devis brouillon créé automatiquement pour opportunité ${id}`)
                  } else {
                    console.error('[Quote Auto] Erreur création devis brouillon:', quoteError)
                  }
                }
              }
            } catch (quoteAutoError) {
              // Erreur silencieuse - ne pas bloquer la mise à jour de l'opportunité
              console.error('[Quote Auto] Erreur lors de la création automatique du devis:', quoteAutoError)
            }
          }

          // Matérialiser/mettre à jour une vente effective quand l'opportunité est gagnée/finalisée
          if (body.stage === 'CLOSED_WON' || body.stage === 'FINALIZED') {
            try {
              const now = new Date().toISOString()
              const effectiveDate = (data as any).closeDate || now
              const amount = Number((data as any).amount || 0)
              // On ne crée pas de vente si aucun montant (évite du bruit)
              if (amount > 0) {
                const effectiveSalePayload = {
                  // ID stable: 1 vente effective par opportunité (upsert)
                  id,
                  effectiveDate,
                  label: (data as any).title || null,
                  amount: amount.toFixed(2),
                  currency: 'EUR',
                  status: body.stage === 'FINALIZED' ? 'PAID' : 'CONFIRMED',
                  source: 'OPPORTUNITY',
                  opportunityId: id,
                  companyId: (data as any).companyId || null,
                  externalRef: null,
                  createdById: userId || null,
                  createdAt: now,
                  updatedAt: now
                }

                // Upsert via contrainte unique (opportunityId)
                const { error: upsertError } = await supabase
                  .from('EffectiveSale')
                  .upsert(effectiveSalePayload, { onConflict: 'opportunityId' })
                if (upsertError) {
                  console.error('[EffectiveSale] Erreur upsert depuis opportunité:', upsertError)
                }
              }
            } catch (e) {
              // Ne pas bloquer la mise à jour de l'opportunité
              console.error('[EffectiveSale] Erreur matérialisation vente effective:', e)
            }
          }
          
          triggerWebhooks('opportunity.stage_changed', {
            opportunity: data,
            oldStage: oldOpportunity.stage,
            newStage: body.stage
          }).catch(err => 
            console.error('[Webhook] Erreur déclenchement opportunity.stage_changed:', err)
          )
        } else {
          // Mise à jour normale (hors changement de stage)
          triggerWebhooks('opportunity.updated', data).catch(err => 
            console.error('[Webhook] Erreur déclenchement opportunity.updated:', err)
          )
        }
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('opportunities/') && method === 'DELETE') {
      const id = path.split('/')[1]
      
      // Récupérer l'opportunité avant suppression pour obtenir googleDriveFolderId et companyId
      const { data: opportunity, error: fetchError } = await supabase
        .from('Opportunity')
        .select('googleDriveFolderId, companyId')
        .eq('id', id)
        .single()
      
      if (fetchError) throw fetchError
      
      // Supprimer le dossier Drive de l'opportunité si il existe
      if (opportunity?.googleDriveFolderId) {
        try {
          const at = await getValidAccessToken(userId)
          if (at) {
            await deleteFolder(at, opportunity.googleDriveFolderId)
            console.log('Dossier opportunité supprimé dans Drive:', opportunity.googleDriveFolderId)
          } else {
            console.warn('Token Google manquant, impossible de supprimer le dossier Drive')
          }
        } catch (driveError) {
          console.error('Erreur lors de la suppression du dossier Drive opportunité:', driveError)
          // Ne pas bloquer la suppression de l'opportunité si la suppression Drive échoue
        }
      }
      
      // Compter les opportunités restantes pour cette entreprise
      let shouldDeleteCompanyFolder = false
      if (opportunity?.companyId) {
        const { count, error: countError } = await supabase
          .from('Opportunity')
          .select('id', { count: 'exact', head: true })
          .eq('companyId', opportunity.companyId)
          .neq('id', id) // Exclure l'opportunité qu'on est en train de supprimer
        
        if (!countError && count === 0) {
          // C'est la dernière opportunité de cette entreprise
          shouldDeleteCompanyFolder = true
        }
      }
      
      // Supprimer le dossier entreprise si c'était la dernière opportunité
      if (shouldDeleteCompanyFolder && opportunity?.companyId) {
        try {
          const { data: company } = await supabase
            .from('Company')
            .select('googleDriveFolderId')
            .eq('id', opportunity.companyId)
            .single()
          
          if (company?.googleDriveFolderId) {
            const at = await getValidAccessToken(userId)
            if (at) {
              await deleteFolder(at, company.googleDriveFolderId)
              console.log('Dossier entreprise supprimé dans Drive:', company.googleDriveFolderId)
              
              // Mettre à jour l'entreprise pour retirer la référence au dossier
              await supabase
                .from('Company')
                .update({ googleDriveFolderId: null, updatedAt: new Date().toISOString() })
                .eq('id', opportunity.companyId)
            } else {
              console.warn('Token Google manquant, impossible de supprimer le dossier Drive entreprise')
            }
          }
        } catch (driveError) {
          console.error('Erreur lors de la suppression du dossier Drive entreprise:', driveError)
          // Ne pas bloquer la suppression de l'opportunité si la suppression Drive échoue
        }
      }
      
      // Supprimer l'opportunité en base
      const { error } = await supabase
        .from('Opportunity')
        .delete()
        .eq('id', id)

      if (error) throw error

      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // ===== EFFECTIVE SALES ROUTES =====
    if (path === 'effective-sales' && method === 'GET') {
      try {
        const opportunityId = url.searchParams.get('opportunityId')
        const companyId = url.searchParams.get('companyId')
        const startDate = url.searchParams.get('startDate')
        const endDate = url.searchParams.get('endDate')
        const source = url.searchParams.get('source') // OPPORTUNITY | OFF_PIPE
        const status = url.searchParams.get('status') // CONFIRMED | INVOICED | PAID
        const limit = parseInt(url.searchParams.get('limit') ?? '200')
        const includeOpportunities = (url.searchParams.get('includeOpportunities') ?? 'true') !== 'false'

        let query = supabase
          .from('EffectiveSale')
          .select('*, opportunity:Opportunity(id, title), company:Company(id, name)')
          .order('effectiveDate', { ascending: false })
          .limit(limit)

        if (opportunityId) query = query.eq('opportunityId', opportunityId)
        if (companyId) query = query.eq('companyId', companyId)
        if (source) query = query.eq('source', source)
        if (status) query = query.eq('status', status)
        if (startDate) query = query.gte('effectiveDate', startDate)
        if (endDate) query = query.lte('effectiveDate', endDate)

        const { data, error } = await query
        if (error) {
          // Si la migration n'est pas appliquée, ne pas casser l'UI (retourner vide + hint)
          const code = (error as any)?.code
          const msg = (error as any)?.message || ''
          if (code === '42P01' || msg.toLowerCase().includes('does not exist')) {
            return new Response(
              JSON.stringify({ items: [], warning: 'Table EffectiveSale manquante. Applique la migration et redéploie la function.' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw error
        }

        let items: any[] = data || []

        // IMPORTANT: garantir l'exhaustivité pour les opportunités gagnées/finalisées,
        // même si elles ne sont pas encore matérialisées dans EffectiveSale (backfill à la volée).
        if (includeOpportunities && (!source || source === 'OPPORTUNITY')) {
          let oppQuery = supabase
            .from('Opportunity')
            .select('id, title, amount, stage, closeDate, updatedAt, createdAt, companyId')
            .in('stage', ['CLOSED_WON', 'FINALIZED'])
            .order('updatedAt', { ascending: false })
            .limit(2000)

          if (opportunityId) oppQuery = oppQuery.eq('id', opportunityId)
          if (companyId) oppQuery = oppQuery.eq('companyId', companyId)

          // Filtrage temporel: on se base sur closeDate si présent, sinon updatedAt/createdAt
          // (côté SQL, on filtre approximativement via updatedAt si start/end sont fournis,
          // puis on refiltre en JS sur la date effective).
          if (startDate) oppQuery = oppQuery.gte('updatedAt', startDate)
          if (endDate) oppQuery = oppQuery.lte('updatedAt', endDate)

          const { data: opps, error: oppErr } = await oppQuery
          if (!oppErr && Array.isArray(opps) && opps.length > 0) {
            const existingOppIds = new Set(items.filter((s: any) => s.opportunityId).map((s: any) => s.opportunityId))

            const computed = opps
              .filter((o: any) => Number(o.amount || 0) > 0)
              .map((o: any) => {
                const effectiveDate = o.closeDate || o.updatedAt || o.createdAt || new Date().toISOString()
                return {
                  id: o.id,
                  effectiveDate,
                  label: o.title || null,
                  amount: Number(o.amount || 0).toFixed(2),
                  currency: 'EUR',
                  status: o.stage === 'FINALIZED' ? 'PAID' : 'CONFIRMED',
                  source: 'OPPORTUNITY',
                  opportunityId: o.id,
                  companyId: o.companyId || null,
                  externalRef: null,
                  createdById: userId || null,
                  createdAt: o.createdAt || new Date().toISOString(),
                  updatedAt: o.updatedAt || new Date().toISOString(),
                  opportunity: { id: o.id, title: o.title }
                }
              })
              .filter((s: any) => {
                if (!startDate && !endDate) return true
                const d = new Date(s.effectiveDate)
                if (startDate && d < new Date(startDate)) return false
                if (endDate && d > new Date(endDate)) return false
                return true
              })

            // Ajouter ceux manquants (sans doublonner)
            const missing = computed.filter((s: any) => !existingOppIds.has(s.opportunityId))
            if (missing.length > 0) {
              // On tente de matérialiser pour les prochaines fois (best-effort, non bloquant)
              supabase
                .from('EffectiveSale')
                .upsert(
                  missing.map((m: any) => ({
                    id: m.id,
                    effectiveDate: m.effectiveDate,
                    label: m.label,
                    amount: m.amount,
                    currency: m.currency,
                    status: m.status,
                    source: m.source,
                    opportunityId: m.opportunityId,
                    companyId: m.companyId,
                    externalRef: m.externalRef,
                    createdById: m.createdById,
                    createdAt: m.createdAt,
                    updatedAt: new Date().toISOString()
                  })),
                  { onConflict: 'opportunityId' }
                )
                .then(() => {})
                .catch(() => {})

              items = [...items, ...missing]
            }
          }
        }

        // Uniformiser le tri final (effectiveDate desc)
        items.sort((a: any, b: any) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())
        items = items.slice(0, limit)

        return new Response(JSON.stringify({ items }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } catch (e: any) {
        console.error('[EffectiveSale] GET error:', e)
        return new Response(
          JSON.stringify({ message: e?.message || 'Erreur chargement ventes effectives' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (path === 'effective-sales' && method === 'POST') {
      try {
        const body = await req.json()
        const now = new Date().toISOString()
        const id = crypto.randomUUID()

        const amountNumber = Number(body.amount || 0)
        if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
          return new Response(
            JSON.stringify({ message: 'amount must be a number > 0' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const payload = {
          id,
          effectiveDate: body.effectiveDate ?? now,
          label: body.label ?? null,
          amount: amountNumber.toFixed(2),
          currency: body.currency ?? 'EUR',
          status: body.status ?? 'CONFIRMED',
          source: body.source ?? 'OFF_PIPE',
          opportunityId: body.opportunityId ?? null,
          companyId: body.companyId ?? null,
          externalRef: body.externalRef ?? null,
          createdById: userId || null,
          createdAt: now,
          updatedAt: now
        }

        const { data, error } = await supabase
          .from('EffectiveSale')
          .insert(payload)
          .select('*, opportunity:Opportunity(id, title), company:Company(id, name)')
          .single()

        if (error) {
          const code = (error as any)?.code
          const msg = (error as any)?.message || ''
          if (code === '42P01' || msg.toLowerCase().includes('does not exist')) {
            return new Response(
              JSON.stringify({ message: 'Table EffectiveSale manquante. Applique la migration puis réessaie.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw error
        }

        return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } catch (e: any) {
        console.error('[EffectiveSale] POST error:', e)
        return new Response(
          JSON.stringify({ message: e?.message || 'Erreur création vente effective' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ===== PAYMENTS ROUTES =====
    if (path === 'payments' && method === 'GET') {
      const opportunityId = url.searchParams.get('opportunityId')
      const startDate = url.searchParams.get('startDate')
      const endDate = url.searchParams.get('endDate')
      
      const deboursNoteId = url.searchParams.get('deboursNoteId')
      
      let query = supabase
        .from('Payment')
        .select('*')
        .order('paymentDate', { ascending: false })
      
      if (opportunityId) {
        query = query.eq('opportunityId', opportunityId)
      }
      if (deboursNoteId) {
        query = query.eq('deboursNoteId', deboursNoteId)
      }
      if (startDate) {
        query = query.gte('paymentDate', startDate)
      }
      if (endDate) {
        query = query.lte('paymentDate', endDate)
      }
      
      const { data: payments, error } = await query
      if (error) throw error
      
      // Enrichir avec les relations séparément pour éviter les problèmes de cache de schéma
      const enrichedPayments = await Promise.all((payments || []).map(async (payment) => {
        let opportunity = null
        let invoice = null
        let deboursNote = null
        
        if (payment.opportunityId) {
          const { data: oppData } = await supabase
            .from('Opportunity')
            .select('*, company:Company(*), contact:Contact(*)')
            .eq('id', payment.opportunityId)
            .single()
          opportunity = oppData
        }
        
        if (payment.invoiceId) {
          const { data: invoiceData } = await supabase
            .from('Invoice')
            .select('*')
            .eq('id', payment.invoiceId)
            .single()
          invoice = invoiceData
        }
        
        const actualDeboursNoteId = getDeboursNoteId(payment)
        if (actualDeboursNoteId) {
          const { data: deboursData } = await supabase
            .from('DeboursNote')
            .select('*, opportunity:Opportunity(*, company:Company(*))')
            .eq('id', actualDeboursNoteId)
            .single()
          deboursNote = deboursData
        }
        
        return {
          ...payment,
          opportunity,
          invoice,
          deboursNote
        }
      }))
      
      return new Response(
        JSON.stringify(enrichedPayments),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'payments' && method === 'POST') {
      const body = await req.json()
      const { opportunityId, invoiceId, deboursNoteId, amount, paymentDate, taxRate, notes } = body
      
      // Valider qu'au moins un identifiant est fourni
      if (!opportunityId && !deboursNoteId && !invoiceId) {
        return new Response(
          JSON.stringify({ message: 'Either opportunityId, deboursNoteId, or invoiceId must be provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      let finalTaxRate = taxRate ?? 0.27
      let taxAmount = amount * finalTaxRate
      let finalOpportunityId = opportunityId
      
      // Si invoiceId est fourni, récupérer la facture et utiliser ses informations
      if (invoiceId) {
        const { data: invoice, error: invoiceError } = await supabase
          .from('Invoice')
          .select('*, opportunity:Opportunity(id, taxRate)')
          .eq('id', invoiceId)
          .single()
        
        if (invoiceError || !invoice) {
          return new Response(
            JSON.stringify({ message: 'Invoice not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        finalTaxRate = taxRate ?? Number(invoice.taxRate)
        taxAmount = amount * finalTaxRate
        finalOpportunityId = invoice.opportunityId
      } else if (opportunityId) {
        // Si c'est une opportunité, récupérer le taux de taxe depuis l'opportunité
        const { data: opportunity, error: oppError } = await supabase
          .from('Opportunity')
          .select('id, taxRate')
          .eq('id', opportunityId)
          .single()
        
        if (oppError || !opportunity) {
          return new Response(
            JSON.stringify({ message: 'Opportunity not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        finalTaxRate = taxRate ?? (opportunity.taxRate ? Number(opportunity.taxRate) : 0.27)
        taxAmount = amount * finalTaxRate
      } else if (deboursNoteId) {
        // Si c'est une note de débours, pas de taxe (0%)
        const { data: deboursNote, error: deboursError } = await supabase
          .from('DeboursNote')
          .select('id')
          .eq('id', deboursNoteId)
          .single()
        
        if (deboursError || !deboursNote) {
          return new Response(
            JSON.stringify({ message: 'DeboursNote not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        finalTaxRate = 0
        taxAmount = 0
      }
      
      const finalPaymentDate = paymentDate ? new Date(paymentDate) : new Date()
      const now = new Date().toISOString()
      const paymentId = crypto.randomUUID()
      
      // Préparer les données d'insertion
      const insertData: any = {
        id: paymentId,
        opportunityId: finalOpportunityId || null,
        invoiceId: invoiceId || null,
        deboursNoteId: deboursNoteId || null,
        amount,
        paymentDate: finalPaymentDate.toISOString(),
        taxRate: finalTaxRate,
        taxAmount,
        notes: notes || null,
        createdAt: now,
        updatedAt: now
      }
      
      const { data: paymentData, error: insertError } = await supabase
        .from('Payment')
        .insert(insertData)
        .select('*')
        .single()
      
      if (insertError) {
        console.error('[PAYMENT POST] Insert error:', insertError)
        throw insertError
      }
      
      // Récupérer les relations séparément pour éviter les problèmes de cache de schéma
      let opportunity = null
      let invoice = null
      let deboursNote = null
      
      if (paymentData.opportunityId) {
        const { data: oppData } = await supabase
          .from('Opportunity')
          .select('*, company:Company(*), contact:Contact(*)')
          .eq('id', paymentData.opportunityId)
          .single()
        opportunity = oppData
      }
      
      if (paymentData.invoiceId) {
        const { data: invoiceData } = await supabase
          .from('Invoice')
          .select('*')
          .eq('id', paymentData.invoiceId)
          .single()
        invoice = invoiceData
      }
      
      const actualDeboursNoteId = getDeboursNoteId(paymentData)
      if (actualDeboursNoteId) {
        const { data: deboursData } = await supabase
          .from('DeboursNote')
          .select('*, opportunity:Opportunity(*, company:Company(*))')
          .eq('id', actualDeboursNoteId)
          .single()
        deboursNote = deboursData
      }
      
      const result = {
        ...paymentData,
        opportunity,
        invoice,
        deboursNote
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('payments/') && method === 'GET') {
      const id = path.split('/')[1]
      if (id === 'opportunity') {
        const opportunityId = path.split('/')[2]
        const { data: payments, error } = await supabase
          .from('Payment')
          .select('*')
          .eq('opportunityId', opportunityId)
          .order('paymentDate', { ascending: false })
        if (error) throw error
        
        // Enrichir avec les relations
        const enrichedPayments = await Promise.all((payments || []).map(async (payment) => {
          let opportunity = null
          let invoice = null
          let deboursNote = null
          
          if (payment.opportunityId) {
            const { data: oppData } = await supabase
              .from('Opportunity')
              .select('*, company:Company(*), contact:Contact(*)')
              .eq('id', payment.opportunityId)
              .single()
            opportunity = oppData
          }
          
          if (payment.invoiceId) {
            const { data: invoiceData } = await supabase
              .from('Invoice')
              .select('*')
              .eq('id', payment.invoiceId)
              .single()
            invoice = invoiceData
          }
          
          if (payment.deboursNoteId) {
            const { data: deboursData } = await supabase
              .from('DeboursNote')
              .select('*, opportunity:Opportunity(*, company:Company(*))')
              .eq('id', payment.deboursNoteId)
              .single()
            deboursNote = deboursData
          }
          
          return {
            ...payment,
            opportunity,
            invoice,
            deboursNote
          }
        }))
        
        return new Response(
          JSON.stringify(enrichedPayments),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const { data: paymentData, error } = await supabase
        .from('Payment')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      
      // Enrichir avec les relations
      let opportunity = null
      let deboursNote = null
      
      if (paymentData.opportunityId) {
        const { data: oppData } = await supabase
          .from('Opportunity')
          .select('*, company:Company(*), contact:Contact(*)')
          .eq('id', paymentData.opportunityId)
          .single()
        opportunity = oppData
      }
      
      const actualDeboursNoteId = getDeboursNoteId(paymentData)
      if (actualDeboursNoteId) {
        const { data: deboursData } = await supabase
          .from('DeboursNote')
          .select('*, opportunity:Opportunity(*, company:Company(*))')
          .eq('id', actualDeboursNoteId)
          .single()
        deboursNote = deboursData
      }
      
      const result = {
        ...paymentData,
        opportunity,
        deboursNote
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('payments/') && method === 'PATCH') {
      const id = path.split('/')[1]
      const body = await req.json()
      const { amount, paymentDate, taxRate, notes } = body
      
      // Récupérer le paiement existant
      const { data: existingPayment, error: fetchError } = await supabase
        .from('Payment')
        .select('*')
        .eq('id', id)
        .single()
      
      if (fetchError || !existingPayment) {
        return new Response(
          JSON.stringify({ message: 'Payment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Recalculer les taxes si nécessaire
      const finalAmount = amount ?? Number(existingPayment.amount)
      const finalTaxRate = taxRate ?? Number(existingPayment.taxRate)
      const finalTaxAmount = finalAmount * finalTaxRate
      const finalPaymentDate = paymentDate ? new Date(paymentDate) : existingPayment.paymentDate
      
      const updateData: any = {
        amount: finalAmount,
        taxRate: finalTaxRate,
        taxAmount: finalTaxAmount,
        paymentDate: finalPaymentDate.toISOString(),
        updatedAt: new Date().toISOString()
      }
      if (notes !== undefined) updateData.notes = notes
      
      const { data: paymentData, error } = await supabase
        .from('Payment')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single()
      
      if (error) throw error
      
      // Enrichir avec les relations
      let opportunity = null
      let invoice = null
      let deboursNote = null
      
      if (paymentData.opportunityId) {
        const { data: oppData } = await supabase
          .from('Opportunity')
          .select('*, company:Company(*), contact:Contact(*)')
          .eq('id', paymentData.opportunityId)
          .single()
        opportunity = oppData
      }
      
      if (paymentData.invoiceId) {
        const { data: invoiceData } = await supabase
          .from('Invoice')
          .select('*')
          .eq('id', paymentData.invoiceId)
          .single()
        invoice = invoiceData
      }
      
      const actualDeboursNoteId = getDeboursNoteId(paymentData)
      if (actualDeboursNoteId) {
        const { data: deboursData } = await supabase
          .from('DeboursNote')
          .select('*, opportunity:Opportunity(*, company:Company(*))')
          .eq('id', actualDeboursNoteId)
          .single()
        deboursNote = deboursData
      }
      
      const result = {
        ...paymentData,
        opportunity,
        invoice,
        deboursNote
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('payments/') && method === 'DELETE') {
      const id = path.split('/')[1]
      const { error } = await supabase
        .from('Payment')
        .delete()
        .eq('id', id)
      if (error) throw error
      return new Response(
        JSON.stringify({ message: 'Payment deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== INVOICES ROUTES =====
    if (path === 'invoices' && method === 'GET') {
      const opportunityId = url.searchParams.get('opportunityId')
      
      let query = supabase
        .from('Invoice')
        .select('*, opportunity:Opportunity(*, company:Company(*), contact:Contact(*)), payments:Payment(*)')
        .order('issueDate', { ascending: false })
      
      if (opportunityId) {
        query = query.eq('opportunityId', opportunityId)
      }
      
      const { data: invoices, error } = await query
      if (error) throw error
      
      return new Response(
        JSON.stringify(invoices || []),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'invoices' && method === 'POST') {
      const body = await req.json()
      const { type, amountTTC, taxRate, invoiceUrl, invoiceNumber, opportunityId, issueDate, notes } = body
      
      if (!opportunityId) {
        return new Response(
          JSON.stringify({ message: 'opportunityId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Vérifier que l'opportunité existe
      const { data: opportunity, error: oppError } = await supabase
        .from('Opportunity')
        .select('id, taxRate')
        .eq('id', opportunityId)
        .single()
      
      if (oppError || !opportunity) {
        return new Response(
          JSON.stringify({ message: 'Opportunity not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const finalTaxRate = taxRate ?? (opportunity.taxRate ? Number(opportunity.taxRate) : 0.27)
      const finalIssueDate = issueDate ? new Date(issueDate) : new Date()
      const now = new Date().toISOString()
      const invoiceId = crypto.randomUUID()
      
      const insertData: any = {
        id: invoiceId,
        type: type || 'FINAL',
        amountTTC,
        taxRate: finalTaxRate,
        invoiceUrl: invoiceUrl || null,
        invoiceNumber: invoiceNumber || null,
        opportunityId,
        issueDate: finalIssueDate.toISOString(),
        notes: notes || null,
        createdAt: now,
        updatedAt: now
      }
      
      const { data: invoiceData, error: insertError } = await supabase
        .from('Invoice')
        .insert(insertData)
        .select('*, opportunity:Opportunity(*, company:Company(*), contact:Contact(*)), payments:Payment(*)')
        .single()
      
      if (insertError) {
        console.error('[INVOICE POST] Insert error:', insertError)
        throw insertError
      }
      
      return new Response(
        JSON.stringify(invoiceData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('invoices/') && method === 'GET') {
      const id = path.split('/')[1]
      
      if (id === 'opportunity') {
        const opportunityId = path.split('/')[2]
        const { data: invoices, error } = await supabase
          .from('Invoice')
          .select('*, opportunity:Opportunity(*, company:Company(*), contact:Contact(*)), payments:Payment(*)')
          .eq('opportunityId', opportunityId)
          .order('issueDate', { ascending: false })
        
        if (error) throw error
        
        return new Response(
          JSON.stringify(invoices || []),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const { data: invoiceData, error } = await supabase
        .from('Invoice')
        .select('*, opportunity:Opportunity(*, company:Company(*), contact:Contact(*)), payments:Payment(*)')
        .eq('id', id)
        .single()
      
      if (error) throw error
      
      if (!invoiceData) {
        return new Response(
          JSON.stringify({ message: 'Invoice not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify(invoiceData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('invoices/') && method === 'PATCH') {
      const id = path.split('/')[1]
      const body = await req.json()
      const { type, amountTTC, taxRate, invoiceUrl, invoiceNumber, issueDate, notes } = body
      
      // Vérifier que la facture existe
      const { data: existingInvoice, error: fetchError } = await supabase
        .from('Invoice')
        .select('*')
        .eq('id', id)
        .single()
      
      if (fetchError || !existingInvoice) {
        return new Response(
          JSON.stringify({ message: 'Invoice not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Vérifier qu'aucun paiement n'est lié si on veut supprimer
      const { data: payments, error: paymentsError } = await supabase
        .from('Payment')
        .select('id')
        .eq('invoiceId', id)
      
      if (paymentsError) {
        console.error('[INVOICE PATCH] Error checking payments:', paymentsError)
      }
      
      const updateData: any = {
        updatedAt: new Date().toISOString()
      }
      
      if (type !== undefined) updateData.type = type
      if (amountTTC !== undefined) updateData.amountTTC = amountTTC
      if (taxRate !== undefined) updateData.taxRate = taxRate
      if (invoiceUrl !== undefined) updateData.invoiceUrl = invoiceUrl
      if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber
      if (issueDate !== undefined) updateData.issueDate = new Date(issueDate).toISOString()
      if (notes !== undefined) updateData.notes = notes
      
      const { data: invoiceData, error } = await supabase
        .from('Invoice')
        .update(updateData)
        .eq('id', id)
        .select('*, opportunity:Opportunity(*, company:Company(*), contact:Contact(*)), payments:Payment(*)')
        .single()
      
      if (error) throw error
      
      return new Response(
        JSON.stringify(invoiceData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('invoices/') && method === 'DELETE') {
      const id = path.split('/')[1]
      
      // Vérifier qu'aucun paiement n'est lié
      const { data: payments, error: paymentsError } = await supabase
        .from('Payment')
        .select('id')
        .eq('invoiceId', id)
      
      if (paymentsError) {
        console.error('[INVOICE DELETE] Error checking payments:', paymentsError)
      }
      
      if (payments && payments.length > 0) {
        return new Response(
          JSON.stringify({ message: 'Cannot delete invoice with linked payments' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const { error } = await supabase
        .from('Invoice')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      return new Response(
        JSON.stringify({ message: 'Invoice deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== DEBOURS NOTES ROUTES =====
    if (path === 'debours-notes' && method === 'GET') {
      const opportunityId = url.searchParams.get('opportunityId')
      const companyId = url.searchParams.get('companyId')
      
      let query = supabase
        .from('DeboursNote')
        .select('*, opportunity:Opportunity(*, company:Company(*)), company:Company(*)')
        .order('createdAt', { ascending: false })
      
      if (opportunityId) {
        query = query.eq('opportunityId', opportunityId)
      }
      if (companyId) {
        query = query.eq('companyId', companyId)
      }
      
      const { data: deboursNotes, error } = await query
      if (error) throw error
      
      // Charger les expenses et payments pour chaque note
      if (deboursNotes && deboursNotes.length > 0) {
        const noteIds = deboursNotes.map(n => n.id)
        
        // Charger toutes les relations expenses
        const { data: allRelations, error: relationError } = await supabase
          .from('_DeboursNoteToExpense')
          .select('A, B')
          .in('A', noteIds)
        
        // Charger toutes les expenses
        let allExpenses: any[] = []
        if (!relationError && allRelations && allRelations.length > 0) {
          const expenseIds = [...new Set(allRelations.map(r => r.B))]
          const { data: expenseData, error: expenseError } = await supabase
            .from('Expense')
            .select('*')
            .in('id', expenseIds)
          
          if (!expenseError && expenseData) {
            allExpenses = expenseData
          }
        }
        
        // Charger tous les payments
        const { data: allPayments, error: paymentError } = await supabase
          .from('Payment')
          .select('*')
          .in('deboursNoteId', noteIds)
        
        // Associer les expenses et payments à chaque note
        const notesWithRelations = deboursNotes.map(note => {
          const noteExpenses = allRelations
            ?.filter(r => r.A === note.id)
            .map(r => allExpenses.find(e => e.id === r.B))
            .filter(Boolean) || []
          
          const notePayments = (allPayments || []).filter(p => p.deboursNoteId === note.id)
          
          return {
            ...note,
            expenses: noteExpenses,
            payments: notePayments
          }
        })
        
        return new Response(
          JSON.stringify(notesWithRelations),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify(deboursNotes || []),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'debours-notes' && method === 'POST') {
      try {
        const body = await req.json()
        const { title, issueDate, expectedPaymentDate, totalAmount, status, opportunityId, companyId, expenseIds, invoiceNumber, notes, templateId } = body
        
        // Validation
        if (!title || !opportunityId || totalAmount === undefined) {
          return new Response(
            JSON.stringify({ message: 'Missing required fields: title, opportunityId, totalAmount' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Vérifier que l'opportunité existe
        const { data: opportunity, error: oppError } = await supabase
          .from('Opportunity')
          .select('id, companyId')
          .eq('id', opportunityId)
          .single()
        
        if (oppError || !opportunity) {
          return new Response(
            JSON.stringify({ message: 'Opportunity not found', error: oppError?.message }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const now = new Date().toISOString()
        const deboursNoteId = crypto.randomUUID()
        
        // Convertir totalAmount en string pour Decimal
        const totalAmountStr = typeof totalAmount === 'number' ? totalAmount.toString() : totalAmount
        
        // Créer la note de débours
        const { data: deboursNote, error: createError } = await supabase
          .from('DeboursNote')
          .insert({
            id: deboursNoteId,
            title,
            issueDate: issueDate ? new Date(issueDate).toISOString() : now,
            expectedPaymentDate: expectedPaymentDate ? new Date(expectedPaymentDate).toISOString() : null,
            totalAmount: totalAmountStr,
            status: status || 'DRAFT',
            opportunityId,
            companyId: companyId || opportunity.companyId,
            invoiceNumber: invoiceNumber || null,
            notes: notes || null,
            templateId: templateId || null,
            createdAt: now,
            updatedAt: now
          })
          .select('*, opportunity:Opportunity(*, company:Company(*)), company:Company(*)')
          .single()
        
        if (createError) {
          console.error('Error creating DeboursNote:', createError)
          return new Response(
            JSON.stringify({ message: 'Failed to create DeboursNote', error: createError.message, details: createError }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      
      // Lier les dépenses si fournies
      if (expenseIds && Array.isArray(expenseIds) && expenseIds.length > 0) {
        // Créer les relations many-to-many
        const relations = expenseIds.map((expenseId: string) => ({
          A: deboursNoteId,
          B: expenseId
        }))
        
        const { error: linkError } = await supabase
          .from('_DeboursNoteToExpense')
          .insert(relations)
        
        if (linkError) {
          console.error('Erreur liaison dépenses:', linkError)
          // Ne pas échouer si la liaison échoue, la note est créée
        }
      }
      
      // Recharger avec les relations
      const { data: deboursNoteData, error: fetchError } = await supabase
        .from('DeboursNote')
        .select('*, opportunity:Opportunity(*, company:Company(*)), company:Company(*)')
        .eq('id', deboursNoteId)
        .single()
      
      if (fetchError) throw fetchError
      
      // Charger les expenses via la table de liaison
      let expenses: any[] = []
      if (expenseIds && expenseIds.length > 0) {
        const { data: expenseData, error: expenseError } = await supabase
          .from('Expense')
          .select('*')
          .in('id', expenseIds)
        
        if (!expenseError && expenseData) {
          expenses = expenseData
        }
      }
      
      // Charger les payments
      const { data: payments, error: paymentError } = await supabase
        .from('Payment')
        .select('*')
        .eq('deboursNoteId', deboursNoteId)
      
      const fullDeboursNote = {
        ...deboursNoteData,
        expenses: expenses,
        payments: payments || []
      }
      
        return new Response(
          JSON.stringify(fullDeboursNote),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (error) {
        console.error('Error in POST /debours-notes:', error)
        return new Response(
          JSON.stringify({ 
            message: 'Internal server error',
            error: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (path.startsWith('debours-notes/') && method === 'GET') {
      const id = path.split('/')[1]
      const { data: deboursNoteData, error } = await supabase
        .from('DeboursNote')
        .select('*, opportunity:Opportunity(*, company:Company(*)), company:Company(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      
      // Charger les expenses via la table de liaison
      const { data: relationData, error: relationError } = await supabase
        .from('_DeboursNoteToExpense')
        .select('B')
        .eq('A', id)
      
      let expenses: any[] = []
      if (!relationError && relationData && relationData.length > 0) {
        const expenseIds = relationData.map(r => r.B)
        const { data: expenseData, error: expenseError } = await supabase
          .from('Expense')
          .select('*')
          .in('id', expenseIds)
        
        if (!expenseError && expenseData) {
          expenses = expenseData
        }
      }
      
      // Charger les payments
      const { data: payments, error: paymentError } = await supabase
        .from('Payment')
        .select('*')
        .eq('deboursNoteId', id)
      
      const fullData = {
        ...deboursNoteData,
        expenses: expenses,
        payments: payments || []
      }
      
      return new Response(
        JSON.stringify(fullData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('debours-notes/') && method === 'PATCH') {
      const id = path.split('/')[1]
      const body = await req.json()
      const { title, issueDate, expectedPaymentDate, totalAmount, status, expenseIds, invoiceNumber, notes, templateId } = body
      
      console.log('PATCH debours-note - body.invoiceNumber reçu:', invoiceNumber, 'type:', typeof invoiceNumber)
      
      const updateData: any = {
        updatedAt: new Date().toISOString()
      }
      if (title !== undefined) updateData.title = title
      if (issueDate !== undefined) updateData.issueDate = issueDate ? new Date(issueDate).toISOString() : null
      if (expectedPaymentDate !== undefined) updateData.expectedPaymentDate = expectedPaymentDate ? new Date(expectedPaymentDate).toISOString() : null
      if (totalAmount !== undefined) updateData.totalAmount = totalAmount
      if (status !== undefined) updateData.status = status
      if (invoiceNumber !== undefined) {
        // Permettre de définir explicitement à null pour vider le champ
        updateData.invoiceNumber = invoiceNumber === null || invoiceNumber === '' ? null : invoiceNumber
        console.log('invoiceNumber sera mis à jour vers:', updateData.invoiceNumber)
      }
      if (notes !== undefined) updateData.notes = notes || null
      if (templateId !== undefined) updateData.templateId = templateId || null
      
      const { data: deboursNoteData, error } = await supabase
        .from('DeboursNote')
        .update(updateData)
        .eq('id', id)
        .select('*, opportunity:Opportunity(*, company:Company(*)), company:Company(*)')
        .single()
      
      if (error) throw error
      
      // Log pour debug
      console.log('DeboursNote updated - invoiceNumber dans DB:', deboursNoteData?.invoiceNumber)
      
      // Mettre à jour les relations avec les dépenses si fournies
      if (expenseIds !== undefined) {
        // Supprimer toutes les relations existantes
        await supabase
          .from('_DeboursNoteToExpense')
          .delete()
          .eq('A', id)
        
        // Créer les nouvelles relations (même si le tableau est vide, on a déjà supprimé les anciennes)
        if (Array.isArray(expenseIds) && expenseIds.length > 0) {
          const relations = expenseIds.map((expenseId: string) => ({
            A: id,
            B: expenseId
          }))
          
          await supabase
            .from('_DeboursNoteToExpense')
            .insert(relations)
        }
        // Si expenseIds est un tableau vide, on a déjà supprimé toutes les relations ci-dessus
      }
      
      // Charger les expenses via la table de liaison
      const { data: relationData, error: relationError } = await supabase
        .from('_DeboursNoteToExpense')
        .select('B')
        .eq('A', id)
      
      let expenses: any[] = []
      if (!relationError && relationData && relationData.length > 0) {
        const expenseIds = relationData.map(r => r.B)
        const { data: expenseData, error: expenseError } = await supabase
          .from('Expense')
          .select('*')
          .in('id', expenseIds)
        
        if (!expenseError && expenseData) {
          expenses = expenseData
        }
      }
      
      // Charger les payments
      const { data: payments, error: paymentError } = await supabase
        .from('Payment')
        .select('*')
        .eq('deboursNoteId', id)
      
      const fullData = {
        ...deboursNoteData,
        expenses: expenses,
        payments: payments || []
      }
      
      // Si un Google Doc existe, le mettre à jour automatiquement
      if (deboursNoteData.googleDocId) {
        console.log('Mise à jour du Google Doc déclenchée pour deboursNote:', deboursNoteData.id, 'googleDocId:', deboursNoteData.googleDocId)
        try {
          // Utiliser la même logique que generate-doc mais pour mettre à jour
          const opportunity = deboursNoteData.opportunity
          const company = deboursNoteData.company || opportunity?.company
          
          const at = await getValidAccessToken(userId)
          if (at && opportunity && company) {
            console.log('Conditions OK pour mise à jour Google Doc - accessToken:', !!at, 'opportunity:', !!opportunity, 'company:', !!company)
            // Fonction pour formater les dates
            const formatDate = (date: Date | string | null | undefined): string => {
              if (!date) return ''
              const d = typeof date === 'string' ? new Date(date) : date
              return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            }
            
            // Fonction pour formater les montants
            const formatAmount = (amount: string | number | null | undefined): string => {
              if (!amount) return '0,00'
              const num = typeof amount === 'string' ? parseFloat(amount) : amount
              return num.toFixed(2).replace('.', ',')
            }
            
            // Calculer les montants pour le total général
            const montantFacture = typeof opportunity.amount === 'string' ? parseFloat(opportunity.amount) : (opportunity.amount || 0)
            const totalFrais = typeof deboursNoteData.totalAmount === 'string' ? parseFloat(deboursNoteData.totalAmount) : (deboursNoteData.totalAmount || 0)
            const totalGeneral = montantFacture + totalFrais
            
            // Calculer la nouvelle valeur pour num_facture
            const newNumFacture = (deboursNoteData.invoiceNumber && deboursNoteData.invoiceNumber.trim() !== '') ? deboursNoteData.invoiceNumber : ((opportunity.tiimeInvoiceIds && opportunity.tiimeInvoiceIds[0]) || 'N/A')
            console.log('Mapping num_facture - deboursNoteData.invoiceNumber:', deboursNoteData.invoiceNumber, 'opportunity.tiimeInvoiceIds:', opportunity.tiimeInvoiceIds, '-> utiliser:', newNumFacture)
            
            // Préparer les replacements
            // Pour les mises à jour, on doit remplacer soit le placeholder (si encore présent), soit les valeurs courantes
            const replacements: Record<string, string> = {
              'Date du jour': formatDate(new Date()),
              'nom_client': company?.name || '',
              'adresse-client': company?.addressStreet || '',
              'code-postal': company?.addressZip || '',
              'Ville': company?.addressCity || '',
              'titre_note_debours': deboursNoteData.title,
              'date prestation': formatDate(opportunity.closeDate),
              'num_facture': newNumFacture,
              'date_facture': formatDate(opportunity.closeDate),
              'montant_facture': formatAmount(opportunity.amount),
              'total_frais': formatAmount(deboursNoteData.totalAmount),
              'total_general': formatAmount(totalGeneral)
            }
            
            // Ajouter les expenses
            if (expenses && expenses.length > 0) {
              expenses.forEach((expense: any, index: number) => {
                const num = index + 1
                replacements[`date_frais_${num}`] = formatDate(expense.invoiceDate)
                replacements[`intitulé_frais_${num}`] = expense.supplierName || expense.notes || 'Frais'
                replacements[`montant_frais_${num}`] = formatAmount(expense.amountTTC || expense.amountHT)
              })
            }
            
            // Récupérer le contenu du document
            const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${deboursNoteData.googleDocId}`, {
              headers: { Authorization: `Bearer ${at}` }
            })
            
            if (docRes.ok) {
              const docData = await docRes.json()
              const requests: any[] = []
              
              // Fonction récursive pour trouver tous les textes
              const findTextRuns = (elements: any[]): Array<{ startIndex: number; endIndex: number; text: string }> => {
                const textRuns: Array<{ startIndex: number; endIndex: number; text: string }> = []
                
                for (const element of elements) {
                  if (element.paragraph) {
                    for (const paraElement of element.paragraph.elements || []) {
                      if (paraElement.textRun) {
                        textRuns.push({
                          startIndex: paraElement.startIndex || 0,
                          endIndex: paraElement.endIndex || 0,
                          text: paraElement.textRun.content || ''
                        })
                      }
                    }
                  }
                  if (element.table) {
                    for (const row of element.table.tableRows || []) {
                      for (const cell of row.tableCells || []) {
                        if (cell.content) {
                          textRuns.push(...findTextRuns(cell.content))
                        }
                      }
                    }
                  }
                }
                
                return textRuns
              }
              
              const content = docData.body?.content || []
              const textRuns = findTextRuns(content)
              
              // Remplacer les placeholders ou les valeurs existantes
              // Pour num_facture, on cherche d'abord le placeholder, sinon on cherche les valeurs courantes possibles
              const processedPlaceholders = new Set<string>()
              
              for (const [key, newValue] of Object.entries(replacements)) {
                const placeholder = `{{${key}}}`
                
                // Éviter de traiter le même placeholder plusieurs fois
                if (processedPlaceholders.has(placeholder)) continue
                
                // Vérifier si le placeholder existe dans le document
                const placeholderExists = textRuns.some(textRun => textRun.text.includes(placeholder))
                
                if (placeholderExists) {
                  // Le placeholder existe encore, on le remplace
                  processedPlaceholders.add(placeholder)
                  requests.push({
                    replaceAllText: {
                      containsText: {
                        text: placeholder,
                        matchCase: false
                      },
                      replaceText: newValue
                    }
                  })
                  console.log(`Ajout requête de remplacement pour ${placeholder} -> ${newValue}`)
                } else if (key === 'num_facture') {
                  // Pour num_facture, si le placeholder n'existe plus, on cherche les valeurs courantes possibles
                  // et on les remplace par la nouvelle valeur
                  const possibleOldValues = [
                    'N/A',
                    opportunity.tiimeInvoiceIds?.[0] || '',
                    deboursNoteData.invoiceNumber || ''
                  ].filter(v => v && v.trim() !== '' && v !== newValue)
                  
                  // On cherche aussi dans tout le texte pour trouver la valeur actuelle
                  // Si on trouve une valeur différente de la nouvelle, on la remplace
                  for (const oldValue of possibleOldValues) {
                    const oldValueExists = textRuns.some(textRun => textRun.text.includes(oldValue))
                    if (oldValueExists && oldValue !== newValue) {
                      requests.push({
                        replaceAllText: {
                          containsText: {
                            text: oldValue,
                            matchCase: true
                          },
                          replaceText: newValue
                        }
                      })
                      console.log(`Ajout requête de remplacement pour valeur existante "${oldValue}" -> "${newValue}"`)
                      break // Une seule substitution par mise à jour pour éviter les conflits
                    }
                  }
                  
                  // Si aucune ancienne valeur trouvée mais qu'on a une nouvelle valeur non vide, 
                  // on essaie de remplacer "N/A" qui est souvent la valeur par défaut
                  if (newValue !== 'N/A' && textRuns.some(textRun => textRun.text.includes('N/A'))) {
                    requests.push({
                      replaceAllText: {
                        containsText: {
                          text: 'N/A',
                          matchCase: true
                        },
                        replaceText: newValue
                      }
                    })
                    console.log(`Ajout requête de remplacement pour "N/A" -> "${newValue}"`)
                  }
                }
              }
              
              // Appliquer les remplacements
              if (requests.length > 0) {
                console.log(`Mise à jour du Google Doc avec ${requests.length} remplacements`)
                const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${deboursNoteData.googleDocId}:batchUpdate`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${at}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ requests })
                })
                
                if (!updateResponse.ok) {
                  const errorText = await updateResponse.text()
                  console.error('Erreur lors de la mise à jour du Google Doc:', updateResponse.status, errorText)
                } else {
                  console.log('Google Doc mis à jour avec succès')
                }
              } else {
                console.log('Aucune requête de remplacement à appliquer')
              }
            }
          }
        } catch (updateDocError) {
          console.error('Error updating Google Doc:', updateDocError)
          // Ne pas bloquer la mise à jour de la note si la mise à jour du doc échoue
        }
      }
      
      return new Response(
        JSON.stringify(fullData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('debours-notes/') && method === 'DELETE') {
      const id = path.split('/')[1]
      
      // Extraire userId du token JWT
      let userId: string | null = null
      const authHeader = req.headers.get('x-user-authorization') || req.headers.get('authorization') || ''
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7)
          const payload = await verifyAccessToken(token)
          if (payload && payload.userId) {
            userId = payload.userId
          }
        } catch (e) {
          console.warn('Erreur décodage token pour suppression note de débours:', e)
        }
      }
      
      // Récupérer la note pour obtenir le googleDocId avant suppression
      const { data: deboursNote, error: fetchError } = await supabase
        .from('DeboursNote')
        .select('googleDocId')
        .eq('id', id)
        .single()
      
      if (fetchError) throw fetchError
      
      // Supprimer le Google Doc si il existe
      if (deboursNote?.googleDocId && userId) {
        const at = await getValidAccessToken(userId)
        if (at) {
          try {
            await deleteFile(at, deboursNote.googleDocId)
            console.log('Google Doc supprimé:', deboursNote.googleDocId)
          } catch (docError) {
            console.warn('Erreur suppression Google Doc (continuation):', docError)
            // On continue même si la suppression du doc échoue
          }
        } else {
          console.warn('Token Google manquant, impossible de supprimer le Google Doc')
        }
      }
      
      // Supprimer la note de la base de données
      const { error } = await supabase
        .from('DeboursNote')
        .delete()
        .eq('id', id)
      if (error) throw error
      return new Response(
        JSON.stringify({ message: 'DeboursNote deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('debours-notes/') && path.includes('/link-expenses') && method === 'POST') {
      const id = path.split('/')[1]
      const body = await req.json()
      const { expenseIds } = body
      
      if (!Array.isArray(expenseIds)) {
        return new Response(
          JSON.stringify({ message: 'expenseIds must be an array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Supprimer toutes les relations existantes
      await supabase
        .from('_DeboursNoteToExpense')
        .delete()
        .eq('A', id)
      
      // Créer les nouvelles relations
      if (expenseIds.length > 0) {
        const relations = expenseIds.map((expenseId: string) => ({
          A: id,
          B: expenseId
        }))
        
        const { error: linkError } = await supabase
          .from('_DeboursNoteToExpense')
          .insert(relations)
        
        if (linkError) throw linkError
      }
      
      // Recharger avec les relations
      const { data, error } = await supabase
        .from('DeboursNote')
        .select('*, opportunity:Opportunity(*, company:Company(*)), company:Company(*), expenses:Expense(*), payments:Payment(*)')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('debours-notes/') && path.includes('/generate-doc') && method === 'POST') {
      const deboursNoteId = path.split('/')[1]
      const body = await req.json()
      const { templateId } = body
      
      // Récupérer la note de débours
      const { data: deboursNote, error: noteError } = await supabase
        .from('DeboursNote')
        .select('*, opportunity:Opportunity(*, company:Company(*)), company:Company(*)')
        .eq('id', deboursNoteId)
        .single()
      
      if (noteError || !deboursNote) {
        return new Response(
          JSON.stringify({ message: 'DeboursNote not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const opportunity = deboursNote.opportunity
      const company = deboursNote.company || opportunity.company
      
      // Vérifier que l'utilisateur a un token Google
      const at = await getValidAccessToken(userId)
      if (!at) {
        return new Response(
          JSON.stringify({ message: 'User has not authorized Google access. Please connect your Google account.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // S'assurer que le dossier de l'opportunité existe
      let opportunityFolderId = opportunity.googleDriveFolderId
      if (!opportunityFolderId) {
        const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?? ''
        if (!rootId) {
          return new Response(
            JSON.stringify({ message: 'GOOGLE_DRIVE_ROOT_FOLDER_ID not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Créer le dossier de l'entreprise si nécessaire
        let companyFolderId = company?.googleDriveFolderId
        if (!companyFolderId) {
          const safeCompanyName = sanitizeName(company?.name || 'Entreprise')
          const foundCompanyFolder = await findFolderByName(at, safeCompanyName, rootId)
          if (foundCompanyFolder) {
            companyFolderId = foundCompanyFolder.id
          } else {
            const createdCompanyFolder = await createFolder(at, safeCompanyName, rootId)
            companyFolderId = createdCompanyFolder.id
          }
          await supabase.from('Company').update({ googleDriveFolderId: companyFolderId }).eq('id', company.id)
        }
        
        // Créer le dossier de l'opportunité
        const safeOppName = sanitizeName(opportunity.title || opportunity.id)
        const foundOppFolder = await findFolderByName(at, safeOppName, companyFolderId)
        if (foundOppFolder) {
          opportunityFolderId = foundOppFolder.id
        } else {
          const createdOppFolder = await createFolder(at, safeOppName, companyFolderId)
          opportunityFolderId = createdOppFolder.id
        }
        await supabase.from('Opportunity').update({ googleDriveFolderId: opportunityFolderId }).eq('id', opportunity.id)
      }
      
      // Utiliser le templateId fourni, celui stocké dans la note, ou le template par défaut
      const finalTemplateId = templateId || deboursNote.templateId || '1Zn5P7uqHnIj_-85-Qh6roVHe2WwCt8gBamEdZYMA7CA'
      
      // Fonction pour formater les dates
      const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return ''
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }
      
      // Fonction pour formater les montants
      const formatAmount = (amount: string | number | null | undefined): string => {
        if (!amount) return '0,00'
        const num = typeof amount === 'string' ? parseFloat(amount) : amount
        return num.toFixed(2).replace('.', ',')
      }
      
      // Calculer les montants pour le total général
      const montantFacture = typeof opportunity.amount === 'string' ? parseFloat(opportunity.amount) : (opportunity.amount || 0)
      const totalFrais = typeof deboursNote.totalAmount === 'string' ? parseFloat(deboursNote.totalAmount) : (deboursNote.totalAmount || 0)
      const totalGeneral = montantFacture + totalFrais
      
      // Préparer les replacements
      const replacements: Record<string, string> = {
        'Date du jour': formatDate(new Date()),
        'nom_client': company?.name || '',
        'adresse-client': company?.addressStreet || '',
        'code-postal': company?.addressZip || '',
        'Ville': company?.addressCity || '',
        'titre_note_debours': deboursNote.title,
        'date prestation': formatDate(opportunity.closeDate),
        'num_facture': (deboursNote.invoiceNumber && deboursNote.invoiceNumber.trim() !== '') ? deboursNote.invoiceNumber : ((opportunity.tiimeInvoiceIds && opportunity.tiimeInvoiceIds[0]) || 'N/A'),
        'date_facture': formatDate(opportunity.closeDate),
        'montant_facture': formatAmount(opportunity.amount),
        'total_frais': formatAmount(deboursNote.totalAmount),
        'total_general': formatAmount(totalGeneral)
      }
      
      // Charger les expenses si elles existent
      const { data: relationData } = await supabase
        .from('_DeboursNoteToExpense')
        .select('B')
        .eq('A', deboursNoteId)
      
      if (relationData && relationData.length > 0) {
        const expenseIds = relationData.map(r => r.B)
        const { data: expenses } = await supabase
          .from('Expense')
          .select('*')
          .in('id', expenseIds)
        
        if (expenses && expenses.length > 0) {
          expenses.forEach((expense: any, index: number) => {
            const num = index + 1
            replacements[`date_frais_${num}`] = formatDate(expense.invoiceDate)
            replacements[`intitulé_frais_${num}`] = expense.supplierName || expense.notes || 'Frais'
            replacements[`montant_frais_${num}`] = formatAmount(expense.amountTTC || expense.amountHT)
          })
        }
      }
      
      try {
        // 1. Copier le template
        const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${finalTemplateId}/copy`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${at}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: deboursNote.title || 'Note de débours',
            parents: opportunityFolderId ? [opportunityFolderId] : undefined
          })
        })
        
        if (!copyRes.ok) {
          const errorText = await copyRes.text()
          throw new Error(`Failed to copy template: ${copyRes.status} ${errorText}`)
        }
        
        const copyData = await copyRes.json()
        const newDocId = copyData.id
        
        if (!newDocId) {
          throw new Error('Failed to get new document ID')
        }
        
        // 2. Récupérer le contenu du document pour trouver les placeholders
        const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${newDocId}`, {
          headers: { Authorization: `Bearer ${at}` }
        })
        
        if (!docRes.ok) {
          throw new Error(`Failed to get document content: ${docRes.status}`)
        }
        
        const docData = await docRes.json()
        
        // 3. Construire les requêtes de remplacement
        const requests: any[] = []
        
        // Fonction récursive pour trouver tous les textes
        const findTextRuns = (elements: any[]): Array<{ startIndex: number; endIndex: number; text: string }> => {
          const textRuns: Array<{ startIndex: number; endIndex: number; text: string }> = []
          
          for (const element of elements) {
            if (element.paragraph) {
              for (const paraElement of element.paragraph.elements || []) {
                if (paraElement.textRun) {
                  textRuns.push({
                    startIndex: paraElement.startIndex || 0,
                    endIndex: paraElement.endIndex || 0,
                    text: paraElement.textRun.content || ''
                  })
                }
              }
            }
            if (element.table) {
              for (const row of element.table.tableRows || []) {
                for (const cell of row.tableCells || []) {
                  if (cell.content) {
                    textRuns.push(...findTextRuns(cell.content))
                  }
                }
              }
            }
          }
          
          return textRuns
        }
        
        const content = docData.body?.content || []
        const textRuns = findTextRuns(content)
        
        // 4. Remplacer les placeholders
        for (const [key, value] of Object.entries(replacements)) {
          const placeholder = `{{${key}}}`
          
          for (const textRun of textRuns) {
            if (textRun.text.includes(placeholder)) {
              requests.push({
                replaceAllText: {
                  containsText: {
                    text: placeholder,
                    matchCase: false
                  },
                  replaceText: value
                }
              })
              break // Un seul remplacement par placeholder
            }
          }
        }
        
        // 5. Appliquer les remplacements
        if (requests.length > 0) {
          const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${newDocId}:batchUpdate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${at}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests })
          })
          
          if (!updateRes.ok) {
            const errorText = await updateRes.text()
            console.error('Failed to update document:', errorText)
            // Ne pas échouer, le document est créé même si les remplacements échouent
          }
        }
        
        // 6. Mettre à jour la note avec les infos du document
        const googleDocUrl = `https://docs.google.com/document/d/${newDocId}`
        
        const { data: updatedNote, error: updateError } = await supabase
          .from('DeboursNote')
          .update({
            googleDocId: newDocId,
            googleDocUrl: googleDocUrl,
            templateId: finalTemplateId,
            updatedAt: new Date().toISOString()
          })
          .eq('id', deboursNoteId)
          .select('*, opportunity:Opportunity(*, company:Company(*)), company:Company(*)')
          .single()
        
        if (updateError) {
          console.error('Error updating debours note:', updateError)
        }
        
        // Charger les expenses pour la réponse
        let expenses: any[] = []
        if (relationData && relationData.length > 0) {
          const expenseIds = relationData.map(r => r.B)
          const { data: expenseData } = await supabase
            .from('Expense')
            .select('*')
            .in('id', expenseIds)
          if (expenseData) expenses = expenseData
        }
        
        const fullNote = {
          ...updatedNote,
          expenses: expenses,
          payments: []
        }
        
        return new Response(
          JSON.stringify(fullNote),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
        
      } catch (error) {
        console.error('Error generating Google Doc:', error)
        return new Response(
          JSON.stringify({ 
            message: 'Failed to generate Google Docs document',
            error: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ===== TREASURY ROUTES =====
    if (path === 'treasury/balance' && method === 'GET') {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      
      // Récupérer le dernier solde manuel (pour aujourd'hui ou date récente)
      const { data: lastManualBalance } = await supabase
        .from('TreasuryBalance')
        .select('*')
        .eq('isManual', true)
        .lte('date', now.toISOString())
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      // Si un solde manuel existe pour aujourd'hui ou une date récente, le retourner tel quel
      // (on considère "récent" comme étant dans les 7 derniers jours pour éviter d'avoir un solde trop ancien)
      if (lastManualBalance) {
        const manualDate = new Date(lastManualBalance.date)
        const daysDiff = Math.floor((now.getTime() - manualDate.getTime()) / (1000 * 60 * 60 * 24))
        
        // Si le solde manuel est d'aujourd'hui, le retourner tel quel
        // Si c'est une date récente (≤ 7 jours), le retourner aussi
        if (daysDiff <= 7) {
          return new Response(
            JSON.stringify({
              balance: Number(lastManualBalance.balance),
              isManual: true,
              date: lastManualBalance.date,
              notes: lastManualBalance.notes || null,
              // Pour la projection: exposer le dernier solde manuel même si on le renvoie déjà comme solde courant
              lastManual: {
                balance: Number(lastManualBalance.balance),
                date: lastManualBalance.date,
                notes: lastManualBalance.notes || null
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      
      // Sinon, calculer le solde automatiquement
      // Utiliser le dernier solde manuel comme base, ou 0 si aucun
      let baseBalance = 0
      let baseDate = new Date(0)
      
      if (lastManualBalance) {
        baseBalance = Number(lastManualBalance.balance)
        baseDate = new Date(lastManualBalance.date)
      }
      
      // Calculer les mouvements depuis la date de base
      const { data: payments } = await supabase
        .from('Payment')
        .select('amount, taxAmount')
        .gte('paymentDate', baseDate.toISOString())
        .lte('paymentDate', now.toISOString())
      
      const totalPayments = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0
      const totalTaxes = payments?.reduce((sum, p) => sum + Number(p.taxAmount), 0) ?? 0
      
      const { data: expenses } = await supabase
        .from('Expense')
        .select('amountTTC, amountHT')
        .eq('status', 'VERIFIED')
        .gte('invoiceDate', baseDate.toISOString())
        .lte('invoiceDate', now.toISOString())
      
      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amountTTC || e.amountHT || 0), 0) ?? 0
      
      const currentBalance = baseBalance + totalPayments - totalExpenses - totalTaxes
      
      return new Response(
        JSON.stringify({
          balance: currentBalance,
          isManual: false,
          date: now.toISOString(),
          // Exposer aussi le dernier solde manuel pour permettre au frontend de projeter depuis cette ancre
          lastManual: lastManualBalance
            ? {
                balance: Number(lastManualBalance.balance),
                date: lastManualBalance.date,
                notes: lastManualBalance.notes || null
              }
            : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'treasury/balance' && method === 'POST') {
      const body = await req.json()
      const { balance, date, notes } = body
      
      const balanceDate = date ? new Date(date) : new Date()
      
      // Vérifier s'il existe déjà un solde pour cette date (sans utiliser .single() pour éviter l'erreur si aucun résultat)
      const { data: existingData, error: existingError } = await supabase
        .from('TreasuryBalance')
        .select('id')
        .eq('date', balanceDate.toISOString())
        .maybeSingle()
      
      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError
      }
      
      let result
      if (existingData && existingData.id) {
        // Mettre à jour l'enregistrement existant
        const { data, error } = await supabase
          .from('TreasuryBalance')
          .update({
            balance,
            isManual: true,
            notes: notes || null,
            updatedAt: new Date().toISOString()
          })
          .eq('id', existingData.id)
          .select()
          .single()
        if (error) throw error
        result = data
      } else {
        // Créer un nouvel enregistrement
        const newId = crypto.randomUUID()
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('TreasuryBalance')
          .insert({
            id: newId,
            date: balanceDate.toISOString(),
            balance,
            isManual: true,
            notes: notes || null,
            createdAt: now,
            updatedAt: now
          })
          .select()
          .single()
        if (error) throw error
        result = data
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'treasury/forecast' && method === 'GET') {
      const startDate = url.searchParams.get('startDate')
      const endDate = url.searchParams.get('endDate')
      
      const start = startDate ? new Date(startDate) : new Date()
      const end = endDate ? new Date(endDate) : new Date(new Date().setMonth(new Date().getMonth() + 12))
      
      // Récupérer les paiements prévisionnels (opportunités avec expectedPaymentDate, y compris finalisées)
      const { data: opportunities } = await supabase
        .from('Opportunity')
        .select('id, title, amount, expectedPaymentDate, taxRate, stage')
        .not('expectedPaymentDate', 'is', null)
        .gte('expectedPaymentDate', start.toISOString())
        .lte('expectedPaymentDate', end.toISOString())
      
      // Récupérer les paiements réels
      const { data: payments } = await supabase
        .from('Payment')
        .select('amount, taxAmount, paymentDate, opportunityId, deboursNoteId, invoiceId')
        .gte('paymentDate', start.toISOString())
        .lte('paymentDate', end.toISOString())
      
      // Récupérer les factures d'accomptes pour calculer le montant total des acomptes facturés
      // On déduit le montant total des factures d'acompte (pas seulement les paiements),
      // car une fois qu'une facture d'acompte est créée, elle réduit le montant prévisionnel restant
      const { data: invoices } = await supabase
        .from('Invoice')
        .select('id, type, amountTTC, opportunityId')
        .eq('type', 'ACOMPTE')
      
      // Calculer le montant total des factures d'acompte par opportunité
      const advancePaymentsByOpportunity: Record<string, number> = {}
      if (invoices && invoices.length > 0) {
        invoices.forEach((inv: any) => {
          if (inv.opportunityId) {
            advancePaymentsByOpportunity[inv.opportunityId] = (advancePaymentsByOpportunity[inv.opportunityId] || 0) + Number(inv.amountTTC || 0)
          }
        })
      }
      
      // Récupérer toutes les dépenses (y compris celles liées aux opportunités finalisées)
      const { data: expenses } = await supabase
        .from('Expense')
        .select('amountTTC, amountHT, invoiceDate, opportunityId')
        .eq('status', 'VERIFIED')
        .gte('invoiceDate', start.toISOString())
        .lte('invoiceDate', end.toISOString())
      
      // Récupérer les notes de débours avec expectedPaymentDate pour le prévisionnel (comme les opportunités)
      const { data: deboursNotesForecast } = await supabase
        .from('DeboursNote')
        .select('id, totalAmount, issueDate, expectedPaymentDate, opportunityId')
        .not('expectedPaymentDate', 'is', null)
        .gte('expectedPaymentDate', start.toISOString())
        .lte('expectedPaymentDate', end.toISOString())
      
      // Récupérer les notes de débours pour les opportunités finalisées (par issueDate)
      const { data: deboursNotes } = await supabase
        .from('DeboursNote')
        .select('id, totalAmount, issueDate, expectedPaymentDate, opportunityId')
        .gte('issueDate', start.toISOString())
        .lte('issueDate', end.toISOString())
      
      // Pour les opportunités finalisées, récupérer leurs dépenses et notes de débours réelles
      const finalizedOpportunities = opportunities?.filter(opp => opp.stage === 'FINALIZED') || []
      const finalizedOppIds = finalizedOpportunities.map(opp => opp.id)
      
      // Récupérer les dépenses spécifiques aux opportunités finalisées
      const { data: finalizedExpenses } = finalizedOppIds.length > 0 ? await supabase
        .from('Expense')
        .select('amountTTC, amountHT, invoiceDate, opportunityId')
        .eq('status', 'VERIFIED')
        .in('opportunityId', finalizedOppIds)
        : { data: [] }
      
      // Récupérer les notes de débours spécifiques aux opportunités finalisées
      const { data: finalizedDeboursNotes } = finalizedOppIds.length > 0 ? await supabase
        .from('DeboursNote')
        .select('id, totalAmount, issueDate, expectedPaymentDate, opportunityId')
        .in('opportunityId', finalizedOppIds)
        : { data: [] }
      
      // Pour les notes de débours en prévisionnel, récupérer les dépenses liées pour calculer le montant réel (frais uniquement)
      let deboursNotesWithExpenses: any[] = []
      if (deboursNotesForecast && deboursNotesForecast.length > 0) {
        const deboursNoteIds = deboursNotesForecast.map(n => n.id)

        // IMPORTANT: une note de débours déjà payée ne doit plus apparaître en "à venir",
        // même si le paiement est hors de la fenêtre [start; end] du forecast.
        // On détecte l'existence d'au moins un paiement lié (deboursNoteId), sans filtre de dates.
        const { data: deboursPayments } = await supabase
          .from('Payment')
          .select('deboursNoteId')
          .in('deboursNoteId', deboursNoteIds)

        const paidDeboursNoteIds = new Set(
          (deboursPayments || [])
            .map((p: any) => p?.deboursNoteId)
            .filter((id: any) => typeof id === 'string' && id.length > 0)
        )
        
        // Récupérer les relations
        const { data: relations } = await supabase
          .from('_DeboursNoteToExpense')
          .select('A, B')
          .in('A', deboursNoteIds)
        
        if (relations && relations.length > 0) {
          const expenseIds = relations.map(r => r.B)
          const { data: expenses } = await supabase
            .from('Expense')
            .select('id, amountTTC, amountHT')
            .in('id', expenseIds)
          
          // Calculer le montant total des frais pour chaque note
          deboursNotesWithExpenses = deboursNotesForecast
            // Exclure les notes déjà payées (ne plus afficher en prévisionnel)
            .filter((note: any) => !paidDeboursNoteIds.has(note.id))
            .map(note => {
            const noteExpenseIds = relations.filter(r => r.A === note.id).map(r => r.B)
            const noteExpenses = expenses?.filter(e => noteExpenseIds.includes(e.id)) || []
            // Utiliser les montants des dépenses (frais) et non le totalAmount
            const totalFrais = noteExpenses.reduce((sum, exp) => {
              const amount = parseFloat(exp.amountTTC?.toString() || exp.amountHT?.toString() || '0')
              return sum + amount
            }, 0)
            
            return {
              ...note,
              totalFrais: totalFrais // Montant calculé depuis les dépenses
            }
          })
        } else {
          // Si pas de dépenses liées, utiliser 0
          deboursNotesWithExpenses = deboursNotesForecast
            .filter((note: any) => !paidDeboursNoteIds.has(note.id))
            .map(note => ({
              ...note,
              totalFrais: 0
            }))
        }
      }
      
      // Calculer les taxes à payer (mois +1, au 30)
      const taxPayments: Record<string, number> = {}
      payments?.forEach(payment => {
        const paymentDate = new Date(payment.paymentDate)
        // Les taxes sont imputées au 30 du mois suivant le paiement
        const taxMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1)
        const monthKey = `${taxMonth.getFullYear()}-${String(taxMonth.getMonth() + 1).padStart(2, '0')}`
        taxPayments[monthKey] = (taxPayments[monthKey] || 0) + Number(payment.taxAmount)
      })
      
      return new Response(
        JSON.stringify({
          opportunities: opportunities || [],
          payments: payments || [],
          expenses: expenses || [],
          deboursNotes: deboursNotes || [],
          deboursNotesForecast: deboursNotesWithExpenses || [], // Notes de débours en prévisionnel avec montants calculés depuis les dépenses
          finalizedExpenses: finalizedExpenses || [],
          finalizedDeboursNotes: finalizedDeboursNotes || [],
          taxPayments,
          advancePaymentsByOpportunity // Montants des acomptes payés par opportunité
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      const { type, value, postalCode, city } = body

      if (!type || !value) {
        return new Response(
          JSON.stringify({ message: 'Missing type or value' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      try {
        // Validation des paramètres
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return new Response(
            JSON.stringify({ message: 'La valeur de recherche ne peut pas être vide' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Construire l'URL de l'API data.gouv.fr
        let apiUrl = 'https://recherche-entreprises.api.gouv.fr/search'
        
        if (type === 'siret') {
          // Normaliser le SIRET (supprimer les espaces)
          const normalizedSiret = value.replace(/\s+/g, '')
          // Valider le format SIRET (14 chiffres)
          if (normalizedSiret.length !== 14 || !/^\d+$/.test(normalizedSiret)) {
            return new Response(
              JSON.stringify({ message: 'Format SIRET invalide. Le SIRET doit contenir exactement 14 chiffres.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          apiUrl += `?siret=${encodeURIComponent(normalizedSiret)}`
        } else if (type === 'siren') {
          const normalizedSiren = value.replace(/\s+/g, '')
          // Valider le format SIREN (9 chiffres)
          if (normalizedSiren.length !== 9 || !/^\d+$/.test(normalizedSiren)) {
            return new Response(
              JSON.stringify({ message: 'Format SIREN invalide. Le SIREN doit contenir exactement 9 chiffres.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          apiUrl += `?siren=${encodeURIComponent(normalizedSiren)}`
        } else if (type === 'name') {
          const searchName = value.trim()
          if (searchName.length < 2) {
            return new Response(
              JSON.stringify({ message: 'Le nom de l\'entreprise doit contenir au moins 2 caractères' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          apiUrl += `?q=${encodeURIComponent(searchName)}`
          // Filtres optionnels
          if (postalCode && /^(\d{5})$/.test(postalCode)) {
            apiUrl += `&code_postal=${encodeURIComponent(postalCode)}`
          }
          if (city && city.trim().length > 1) {
            // L'API ne propose pas un paramètre city officiel, on l'inclut dans q pour renforcer la recherche
            apiUrl += `&q=${encodeURIComponent(searchName + ' ' + city.trim())}`
          }
        } else {
          return new Response(
            JSON.stringify({ message: 'Type de recherche invalide. Utilisez siret, siren ou name' }),
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
        
        // Log complet du premier résultat pour debug
        if (data.results && data.results.length > 0) {
          console.log('=== Sirene API - Premier résultat brut (structure complète) ===')
          console.log(JSON.stringify(data.results[0], null, 2))
          console.log('=== Structure siege ===')
          console.log(JSON.stringify(data.results[0].siege, null, 2))
          console.log('=== Structure adresse ===')
          console.log(JSON.stringify(data.results[0].siege?.adresse || data.results[0].adresse || {}, null, 2))
        }

        // Formater les résultats pour notre modèle
        const formattedResults = (data.results || []).map((result: any, index: number) => {
          // Log complet du résultat brut pour debug
          if (index === 0) {
            console.log('=== RAW RESULT COMPLETE ===')
            console.log(JSON.stringify(result, null, 2))
          }
          
          // Log pour debug du premier résultat
          if (index === 0) {
            console.log('=== Extraction adresse ===')
            console.log('result.siege existe?', !!result.siege)
            console.log('result.siege type:', typeof result.siege)
            console.log('result.siege:', JSON.stringify(result.siege, null, 2))
            console.log('result keys:', Object.keys(result))
          }
          
          // Vérifier que siege existe
          if (!result.siege) {
            if (index === 0) {
              console.log('⚠️ ATTENTION: result.siege est null/undefined pour ce résultat!')
            }
          }
          
          // L'API retourne l'adresse dans siege.* avec différentes structures possibles
          // siege.adresse est une STRING complète, siege.geo_adresse est formatée
          // siege.code_postal, siege.libelle_commune sont directement disponibles
          
          // Construire la rue de différentes manières
          let addressStreet: string | null = null
          
          // Log pour debug
          if (index === 0) {
            console.log('=== Extraction détails ===')
            console.log('result.siege?.geo_adresse:', result.siege?.geo_adresse)
            console.log('result.siege?.adresse:', result.siege?.adresse)
            console.log('result.siege?.code_postal:', result.siege?.code_postal)
            console.log('result.siege?.libelle_commune:', result.siege?.libelle_commune)
          }
          
          // Priorité 1: geo_adresse (adresse formatée) - extraire la partie rue
          if (result.siege?.geo_adresse) {
            // geo_adresse contient "14 Avenue Pierre Grenier 92100 Boulogne-Billancourt"
            // On extrait juste la partie rue (sans code postal et ville)
            const geoParts = result.siege.geo_adresse.split(/\s+\d{5}\s+/)
            addressStreet = geoParts[0] || result.siege.geo_adresse
            if (index === 0) console.log('Adresse extraite depuis geo_adresse:', addressStreet)
          }
          // Priorité 2: adresse (string complète) - extraire la partie rue
          else if (result.siege?.adresse && typeof result.siege.adresse === 'string') {
            // adresse contient "CENTRE COMMERCIAL LA GARAU AVENUE ALPHONSE DAUDET 30200 BAGNOLS-SUR-CEZE"
            // On extrait juste la partie avant le code postal
            const addrParts = result.siege.adresse.split(/\s+\d{5}\s+/)
            addressStreet = addrParts[0] || result.siege.adresse
            if (index === 0) console.log('Adresse extraite depuis adresse:', addressStreet)
          }
          // Priorité 3: numero_voie + libelle_voie depuis siege
          else if (result.siege?.numero_voie && result.siege?.libelle_voie) {
            addressStreet = `${result.siege.numero_voie} ${result.siege.type_voie || ''} ${result.siege.libelle_voie}`.trim()
            if (index === 0) console.log('Adresse construite depuis numero_voie + libelle_voie:', addressStreet)
          }
          // Priorité 4: libelle_voie seul
          else if (result.siege?.libelle_voie) {
            addressStreet = `${result.siege.type_voie || ''} ${result.siege.libelle_voie}`.trim()
            if (index === 0) console.log('Adresse construite depuis libelle_voie:', addressStreet)
          }
          // Priorité 5: complement_adresse
          else if (result.siege?.complement_adresse) {
            addressStreet = result.siege.complement_adresse
            if (index === 0) console.log('Adresse depuis complement_adresse:', addressStreet)
          }
          
          if (index === 0 && !addressStreet) {
            console.log('⚠️ Aucune adresse trouvée dans result.siege')
          }
          
          // Extraire le code postal - directement depuis siege
          const addressZip = result.siege?.code_postal || null
          if (index === 0) console.log('Code postal extrait:', addressZip)
          
          // Extraire la ville - directement depuis siege.libelle_commune
          const addressCity = result.siege?.libelle_commune || null
          if (index === 0) console.log('Ville extraite:', addressCity)
          
          // Extraire le code NAF de différentes sources
          // Le code NAF peut être dans result.activite_principale ou result.siege.activite_principale
          const codeNAF = result.siege?.activite_principale ||
                         result.activite_principale || 
                         result.naf || 
                         result.activite_principale_unite_legale ||
                         result.activitePrincipaleUniteLegale ||
                         null
          
          // Extraire le libellé NAF
          // Note: Le libellé NAF n'est généralement pas dans la réponse de recherche par nom
          // Il faudra le récupérer via l'enrichissement ou un appel complémentaire
          const libelleNAF = result.libelle_activite_principale || 
                            result.activite_principale_unite_legale_libelle ||
                            result.activitePrincipaleUniteLegaleLibelle ||
                            null
          
          // Extraire le nom de différentes sources
          const denomination = result.nom_complet || 
                              result.denomination || 
                              result.nom ||
                              result.raison_sociale ||
                              result.raisonSociale ||
                              ''
          
          // Extraire SIRET depuis toutes les sources possibles
          const siret = result.siret || 
                       result.siege?.siret || 
                       (result.etablissements && result.etablissements[0]?.siret) ||
                       null
          
          if (index === 0) {
            console.log('SIRET extrait:', siret, 'depuis result.siret:', result.siret, 'result.siege?.siret:', result.siege?.siret)
          }
          
          // Extraire SIREN depuis toutes les sources possibles
          const siren = result.siren || 
                        result.siege?.siren ||
                        (siret ? siret.substring(0, 9) : null) ||
                        null
          
          if (index === 0) {
            console.log('SIREN extrait:', siren, 'depuis result.siren:', result.siren)
          }
          
          const formatted = {
            siret: siret,
            siren: siren,
            denomination: denomination,
            codeNAF: codeNAF,
            libelleNAF: libelleNAF,
            addressStreet: addressStreet,
            addressZip: addressZip,
            addressCity: addressCity,
            addressCountry: result.siege?.pays || 'France',
            isIndividual: result.nature_juridique === 'Entrepreneur individuel' || 
                         result.entreprise_individuelle === true ||
                         result.entrepriseIndividuelle === true ||
                         result.natureJuridique === 'Entrepreneur individuel'
          }
          
          // Log pour debug du premier résultat formaté
          if (index === 0) {
            console.log('=== Résultat formaté FINAL ===')
            console.log('siret:', formatted.siret)
            console.log('siren:', formatted.siren)
            console.log('addressStreet:', formatted.addressStreet)
            console.log('addressZip:', formatted.addressZip)
            console.log('addressCity:', formatted.addressCity)
            console.log('Résultat complet:', JSON.stringify(formatted, null, 2))
          }
          
          return formatted
        })

        // Pour les recherches par nom, si on a un SIREN mais pas de SIRET/adresse complète,
        // on peut enrichir les résultats avec un appel supplémentaire par SIREN
        // pour obtenir les détails complets (adresse, SIRET du siège, etc.)
        // Note: On ne fait l'enrichissement que pour les recherches par nom (pas pour SIRET/SIREN)
        const isNameSearch = type === 'name'
        console.log('=== ENRICHISSEMENT ===')
        console.log('Type de recherche:', type, 'isNameSearch:', isNameSearch)
        console.log('Premier résultat avant enrichissement:', JSON.stringify(formattedResults[0], null, 2))
        
        const enrichedResults = await Promise.all(
          formattedResults.map(async (formatted: any, index: number) => {
            // Si on a déjà SIRET ET adresse complète (rue ET ville), on garde tel quel
            const hasCompleteData = formatted.siret && formatted.addressStreet && formatted.addressCity
            if (hasCompleteData) {
              if (index === 0) {
                console.log('Résultat', index, 'a déjà toutes les données, pas d\'enrichissement nécessaire')
              }
              return formatted
            }
            
            // Si on a un SIREN mais pas de détails complets, on fait un appel complémentaire
            if (formatted.siren && isNameSearch) {
              if (index === 0) {
                console.log('Résultat', index, 'a un SIREN mais pas de données complètes, lancement enrichissement pour SIREN:', formatted.siren)
              }
              try {
                const detailUrl = `https://recherche-entreprises.api.gouv.fr/search?siren=${encodeURIComponent(formatted.siren)}`
                if (index === 0) {
                  console.log('Appel enrichissement:', detailUrl)
                }
                const detailResponse = await fetch(detailUrl, {
                  headers: { 'Accept': 'application/json' }
                })
                
                if (detailResponse.ok) {
                  const detailData = await detailResponse.json()
                  if (index === 0) {
                    console.log('Réponse enrichissement - nombre de résultats:', detailData.results?.length || 0)
                  }
                  if (detailData.results && detailData.results.length > 0) {
                    const detailResult = detailData.results[0]
                    if (index === 0) {
                      console.log('Premier résultat enrichissement:', JSON.stringify(detailResult, null, 2).substring(0, 1000))
                    }
                    
                    // Extraire les détails complémentaires
                    // L'API retourne l'adresse dans siege.adresse comme STRING, et les détails dans siege.*
                    const detailSiege = detailResult.siege || {}
                    if (index === 0) {
                      console.log('Siege complet de l\'enrichissement:', JSON.stringify(detailSiege, null, 2))
                    }
                    
                    // Enrichir avec les données manquantes
                    // SIRET est dans siege.siret
                    if (!formatted.siret && detailSiege.siret) {
                      formatted.siret = detailSiege.siret
                      if (index === 0) console.log('SIRET ajouté:', formatted.siret)
                    }
                    
                    // Adresse : l'API retourne siege.adresse comme STRING complète
                    // On peut aussi utiliser siege.geo_adresse (formatée) ou construire depuis les composants
                    if (!formatted.addressStreet) {
                      // Priorité 1: geo_adresse (adresse formatée)
                      if (detailSiege.geo_adresse) {
                        // geo_adresse contient "14 Avenue Pierre Grenier 92100 Boulogne-Billancourt"
                        // On extrait juste la partie rue (sans code postal et ville)
                        const geoParts = detailSiege.geo_adresse.split(/\s+\d{5}\s+/)
                        formatted.addressStreet = geoParts[0] || detailSiege.geo_adresse
                      }
                      // Priorité 2: adresse (string complète)
                      else if (detailSiege.adresse) {
                        // adresse contient "CENTRE COMMERCIAL LA GARAU AVENUE ALPHONSE DAUDET 30200 BAGNOLS-SUR-CEZE"
                        // On extrait juste la partie avant le code postal
                        const addrParts = detailSiege.adresse.split(/\s+\d{5}\s+/)
                        formatted.addressStreet = addrParts[0] || detailSiege.adresse
                      }
                      // Priorité 3: construire depuis numero_voie + libelle_voie
                      else if (detailSiege.numero_voie && detailSiege.libelle_voie) {
                        formatted.addressStreet = `${detailSiege.numero_voie} ${detailSiege.libelle_voie}`.trim()
                      }
                      // Priorité 4: complement_adresse
                      else if (detailSiege.complement_adresse) {
                        formatted.addressStreet = detailSiege.complement_adresse
                      }
                      if (index === 0 && formatted.addressStreet) {
                        console.log('Adresse rue ajoutée:', formatted.addressStreet)
                      }
                    }
                    
                    // Code postal
                    if (!formatted.addressZip && detailSiege.code_postal) {
                      formatted.addressZip = detailSiege.code_postal
                      if (index === 0) console.log('Code postal ajouté:', formatted.addressZip)
                    }
                    
                    // Ville
                    if (!formatted.addressCity && detailSiege.libelle_commune) {
                      formatted.addressCity = detailSiege.libelle_commune
                      if (index === 0) console.log('Ville ajoutée:', formatted.addressCity)
                    }
                    
                    // Enrichir aussi le libellé NAF si disponible
                    if (!formatted.libelleNAF && detailResult.libelle_activite_principale) {
                      formatted.libelleNAF = detailResult.libelle_activite_principale
                      if (index === 0) console.log('Libellé NAF ajouté:', formatted.libelleNAF)
                    }
                    
                    if (index === 0) {
                      console.log('Résultat après enrichissement:', JSON.stringify(formatted, null, 2))
                    }
                  } else {
                    if (index === 0) {
                      console.log('Aucun résultat dans l\'appel d\'enrichissement')
                    }
                  }
                } else {
                  if (index === 0) {
                    console.log('Erreur HTTP enrichissement:', detailResponse.status, detailResponse.statusText)
                  }
                }
              } catch (error) {
                // En cas d'erreur sur l'appel complémentaire, on continue avec les données de base
                console.log('Erreur enrichissement pour SIREN', formatted.siren, error)
              }
            } else {
              if (index === 0) {
                console.log('Résultat', index, 'ne nécessite pas d\'enrichissement - SIREN:', formatted.siren, 'isNameSearch:', isNameSearch)
              }
            }
            
            return formatted
          })
        )
        
        console.log('Enriched results (first):', JSON.stringify(enrichedResults[0] || {}).substring(0, 500))
        
        return new Response(
          JSON.stringify({ results: enrichedResults }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (error) {
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
      // pathParts = ['companies', 'id', 'sirene', 'fill']
      const companyId = pathParts[1]
      
      if (!companyId) {
        return new Response(
          JSON.stringify({ message: 'Company ID manquant dans l\'URL' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      const { siret, siren, name } = body

      try {
        console.log('Fill Sirene - Company ID:', companyId, 'Body:', { siret, siren, name })
        // Validation et normalisation
        let searchType = 'name'
        let searchValue = name ? name.trim() : ''

        if (siret) {
          const normalizedSiret = siret.replace(/\s+/g, '')
          // Valider le format SIRET (14 chiffres)
          if (normalizedSiret.length !== 14 || !/^\d+$/.test(normalizedSiret)) {
            return new Response(
              JSON.stringify({ message: 'Format SIRET invalide. Le SIRET doit contenir exactement 14 chiffres.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          searchType = 'siret'
          searchValue = normalizedSiret
        } else if (siren) {
          const normalizedSiren = siren.replace(/\s+/g, '')
          // Valider le format SIREN (9 chiffres)
          if (normalizedSiren.length !== 9 || !/^\d+$/.test(normalizedSiren)) {
            return new Response(
              JSON.stringify({ message: 'Format SIREN invalide. Le SIREN doit contenir exactement 9 chiffres.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          searchType = 'siren'
          searchValue = normalizedSiren
        }

        if (!searchValue || searchValue.length === 0) {
          return new Response(
            JSON.stringify({ message: 'Veuillez fournir un SIRET, SIREN ou nom d\'entreprise valide' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Appeler l'API Sirene
        // Pour les recherches par nom, on peut ajouter des paramètres pour obtenir plus de détails
        let apiUrl = 'https://recherche-entreprises.api.gouv.fr/search'
        if (searchType === 'siret') {
          apiUrl += `?siret=${encodeURIComponent(searchValue)}`
        } else if (searchType === 'siren') {
          apiUrl += `?siren=${encodeURIComponent(searchValue)}`
        } else {
          // Pour la recherche par nom, on peut limiter le nombre de résultats mais obtenir plus de détails
          apiUrl += `?q=${encodeURIComponent(searchValue)}&per_page=20`
        }

        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' }
        })

        if (!response.ok) {
          const errorText = await response.text()
          let errorMessage = `Erreur API Sirene (${response.status})`
          try {
            const errorData = JSON.parse(errorText)
            errorMessage = errorData.message || errorData.detail || errorMessage
          } catch {
            errorMessage = errorText || errorMessage
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        const results = data.results || []

        console.log('Sirene API response:', JSON.stringify(data).substring(0, 500))
        console.log('Results count:', results.length)

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

        if (fetchError) {
          console.error('Erreur récupération company:', fetchError)
          return new Response(
            JSON.stringify({ message: `Company non trouvée: ${fetchError.message}`, error: fetchError }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!currentCompany) {
          return new Response(
            JSON.stringify({ message: 'Company non trouvée' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Current company:', JSON.stringify(currentCompany).substring(0, 300))

        // Prendre le premier résultat
        const result = results[0]
        console.log('Sirene result:', JSON.stringify(result).substring(0, 500))
        
        // Extraire l'adresse - gérer différentes structures possibles
        let adresse: any = {}
        if (result.siege?.adresse) {
          adresse = result.siege.adresse
        } else if (result.adresse) {
          adresse = result.adresse
        } else if (result.siege) {
          // Parfois l'adresse est directement dans siege
          adresse = result.siege
        }
        console.log('Adresse extracted:', JSON.stringify(adresse).substring(0, 200))

        // Préparer les données à mettre à jour (seulement les champs vides)
        const updateData: any = {
          updatedAt: new Date().toISOString()
        }

        // Mettre à jour seulement les champs vides
        const companyName = result.nom_complet || result.denomination || result.nom || result.raison_sociale
        if (!currentCompany.name && companyName) {
          updateData.name = companyName
        }
        
        // SIRET peut être dans différents champs
        const companySiret = result.siret || result.siege?.siret
        if (!currentCompany.siret && companySiret) {
          updateData.siret = companySiret
        }
        
        // Les champs siren, codeNAF, libelleNAF peuvent ne pas exister dans la BDD si la migration n'a pas été appliquée
        // On vérifie si la propriété existe dans l'objet retourné par Supabase
        const hasSirenColumn = 'siren' in currentCompany
        const hasCodeNAFColumn = 'codeNAF' in currentCompany
        const hasLibelleNAFColumn = 'libelleNAF' in currentCompany
        
        // SIREN peut être dans siren ou extrait du SIRET
        const companySiren = result.siren || (companySiret ? companySiret.substring(0, 9) : null)
        if (hasSirenColumn && companySiren && (!currentCompany.siren || currentCompany.siren === null)) {
          updateData.siren = companySiren
        }
        
        // Code NAF peut être dans différents champs
        const companyNAF = result.activite_principale || result.naf || result.activite_principale_unite_legale
        if (hasCodeNAFColumn && companyNAF && (!currentCompany.codeNAF || currentCompany.codeNAF === null)) {
          updateData.codeNAF = companyNAF
        }
        
        // Libellé NAF
        const companyLibelleNAF = result.libelle_activite_principale || result.activite_principale_unite_legale_libelle
        if (hasLibelleNAFColumn && companyLibelleNAF && (!currentCompany.libelleNAF || currentCompany.libelleNAF === null)) {
          updateData.libelleNAF = companyLibelleNAF
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

        // Vérifier qu'il y a des données à mettre à jour
        if (Object.keys(updateData).length === 1) {
          // Seulement updatedAt, rien à mettre à jour
          return new Response(
            JSON.stringify({ message: 'Aucune donnée à mettre à jour (tous les champs sont déjà remplis)', data: currentCompany }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Update data prepared:', JSON.stringify(updateData))

        // Mettre à jour la company
        let { data: updatedCompany, error: updateError } = await supabase
          .from('Company')
          .update(updateData)
          .eq('id', companyId)
          .select()
          .single()

        console.log('Update result - error:', updateError ? JSON.stringify(updateError) : 'none')
        console.log('Update result - data:', updatedCompany ? JSON.stringify(updatedCompany).substring(0, 200) : 'none')

        // Si erreur et que c'est lié aux colonnes Sirene, réessayer sans elles
        if (updateError && (updateError.message?.includes('siren') || updateError.message?.includes('codeNAF') || updateError.message?.includes('libelleNAF') || updateError.message?.includes('column') || updateError.code === 'PGRST116')) {
          console.warn('Colonnes Sirene non disponibles, mise à jour sans ces champs. Error:', updateError.message)
          const updateDataWithoutSirene = { ...updateData }
          delete updateDataWithoutSirene.siren
          delete updateDataWithoutSirene.codeNAF
          delete updateDataWithoutSirene.libelleNAF
          
          console.log('Retrying update without Sirene columns:', JSON.stringify(updateDataWithoutSirene))
          
          const retryResult = await supabase
            .from('Company')
            .update(updateDataWithoutSirene)
            .eq('id', companyId)
            .select()
            .single()
          
          console.log('Retry result - error:', retryResult.error ? JSON.stringify(retryResult.error) : 'none')
          console.log('Retry result - data:', retryResult.data ? JSON.stringify(retryResult.data).substring(0, 200) : 'none')
          
          updatedCompany = retryResult.data
          updateError = retryResult.error
        }

        if (updateError) {
          console.error('Erreur mise à jour company finale:', updateError)
          return new Response(
            JSON.stringify({ 
              message: `Erreur lors de la mise à jour: ${updateError.message}`,
              error: updateError,
              updateData: updateData
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify(updatedCompany),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (error) {
        console.error('Erreur complétion fiche:', error)
        console.error('Error stack:', error.stack)
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
        const errorMessage = error.message || 'Erreur lors de la complétion'
        return new Response(
          JSON.stringify({ 
            message: errorMessage, 
            error: error.toString(),
            stack: error.stack,
            details: error
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ===== RECURRING EXPENSES ROUTES (AVANT EXPENSES) =====
    // Vérifier d'abord les routes recurring-expenses pour éviter les conflits
    // IMPORTANT: Cette section DOIT être avant toutes les routes expenses
    console.log('[BEFORE RECURRING CHECK] path:', path, 'method:', method, 'path === recurring-expenses:', path === 'recurring-expenses')
    
    // Vérification directe pour POST /recurring-expenses
    if (path === 'recurring-expenses' && method === 'POST') {
      console.log('[RECURRING EXPENSES POST] Route matched directly! path:', path, 'method:', method)
      try {
        const body = await req.json()
        console.log('[RECURRING EXPENSES POST] Body received:', JSON.stringify(body, null, 2))
        
        const insertData: any = {
          ...body,
          userId: userId || body.userId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        console.log('[RECURRING EXPENSES POST] Insert data:', JSON.stringify(insertData, null, 2))
        
        const { data, error } = await supabase
          .from('RecurringExpense')
          .insert(insertData)
          .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
          .single()

        if (error) {
          console.error('[RECURRING EXPENSES POST] Error:', error)
          return new Response(
            JSON.stringify({ message: error.message, code: error.code, details: error.details }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        console.log('[RECURRING EXPENSES POST] Success:', data)
        return new Response(
          JSON.stringify(data),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (err: any) {
        console.error('[RECURRING EXPENSES POST] Exception:', err)
        return new Response(
          JSON.stringify({ message: err.message || 'Erreur lors de la création' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    if (path === 'recurring-expenses' && method === 'GET') {
      console.log('[RECURRING EXPENSES GET] Route matched directly!')
      const { data, error } = await supabase
        .from('RecurringExpense')
        .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
        .order('createdAt', { ascending: false })

      if (error) throw error
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Ancienne vérification (gardée pour compatibilité)
    if (path === 'recurring-expenses') {
      console.log('[RECURRING EXPENSES] Route matched! path:', path, 'method:', method)
      
      if (method === 'POST') {
        console.log('[RECURRING EXPENSES POST] Creating recurring expense, userId:', userId)
        try {
          const body = await req.json()
          console.log('[RECURRING EXPENSES POST] Body received:', JSON.stringify(body, null, 2))
          
          const insertData: any = {
            ...body,
            userId: userId || body.userId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          
          console.log('[RECURRING EXPENSES POST] Insert data:', JSON.stringify(insertData, null, 2))
          
          const { data, error } = await supabase
            .from('RecurringExpense')
            .insert(insertData)
            .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
            .single()

          if (error) {
            console.error('[RECURRING EXPENSES POST] Error:', error)
            return new Response(
              JSON.stringify({ message: error.message, code: error.code, details: error.details }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          
          console.log('[RECURRING EXPENSES POST] Success:', data)
          return new Response(
            JSON.stringify(data),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (err: any) {
          console.error('[RECURRING EXPENSES POST] Exception:', err)
          return new Response(
            JSON.stringify({ message: err.message || 'Erreur lors de la création' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      
      if (method === 'GET') {
        console.log('[RECURRING EXPENSES GET] Route matched!')
        const { data, error } = await supabase
          .from('RecurringExpense')
          .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
          .order('createdAt', { ascending: false })

        if (error) throw error
        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    // Routes avec ID pour recurring-expenses
    if (path.startsWith('recurring-expenses/') && method === 'GET') {
      const id = path.split('/')[1]
      const { data, error } = await supabase
        .from('RecurringExpense')
        .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email), expenses:Expense(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('recurring-expenses/') && !path.includes('/generate') && method === 'PUT') {
      const id = path.split('/')[1]
      console.log('[RECURRING EXPENSES PUT] Updating recurring expense:', id)
      const body = await req.json()
      
      const { data, error } = await supabase
        .from('RecurringExpense')
        .update({
          ...body,
          updatedAt: new Date().toISOString()
        })
        .eq('id', id)
        .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
        .single()

      if (error) {
        console.error('[RECURRING EXPENSES PUT] Error:', error)
        return new Response(
          JSON.stringify({ message: error.message, code: error.code, details: error.details }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('recurring-expenses/') && path.endsWith('/generate') && method === 'POST') {
      const id = path.split('/')[1]
      const url = new URL(req.url)
      const startDate = url.searchParams.get('startDate') || new Date().toISOString()
      const endDate = url.searchParams.get('endDate') || (() => {
        const d = new Date()
        d.setMonth(d.getMonth() + 12)
        return d.toISOString()
      })()

      // Récupérer le modèle récurrent
      const { data: recurringExpense, error: fetchError } = await supabase
        .from('RecurringExpense')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !recurringExpense || !recurringExpense.isActive) {
        return new Response(
          JSON.stringify({ message: 'Dépense récurrente non trouvée ou inactive' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Générer les dépenses prévisionnelles
      console.log('[RECURRING EXPENSES GENERATE] Starting generation for recurring expense:', id, 'from', startDate, 'to', endDate)
      const generated = []
      const currentDate = new Date(startDate)
      const finalEndDate = new Date(endDate)

      while (currentDate <= finalEndDate) {
        const paymentDate = new Date(currentDate)
        const lastDayOfMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).getDate()
        const day = Math.min(recurringExpense.paymentDay, lastDayOfMonth)
        paymentDate.setDate(day)

        if (paymentDate >= new Date(recurringExpense.startDate) &&
            (!recurringExpense.endDate || paymentDate <= new Date(recurringExpense.endDate))) {
          
          // Vérifier si une dépense existe déjà
          const { data: existing } = await supabase
            .from('Expense')
            .select('id')
            .eq('recurringExpenseId', id)
            .eq('forecastDate', paymentDate.toISOString())
            .eq('isForecast', true)
            .single()

          if (!existing) {
            // Générer un ID unique pour la dépense prévisionnelle
            const expenseId = crypto.randomUUID()
            const now = new Date().toISOString()
            
            const { data: expense, error: insertError } = await supabase
              .from('Expense')
              .insert({
                id: expenseId,
                supplierName: recurringExpense.supplierName,
                amountHT: recurringExpense.amountHT,
                amountTTC: recurringExpense.amountTTC,
                vatAmount: recurringExpense.vatAmount,
                vatRate: recurringExpense.vatRate,
                accountCode: recurringExpense.accountCode,
                accountLabel: recurringExpense.accountLabel,
                invoiceDate: paymentDate.toISOString(),
                forecastDate: paymentDate.toISOString(),
                isForecast: true,
                status: 'PENDING',
                recurringExpenseId: recurringExpense.id,
                companyId: recurringExpense.companyId,
                userId: recurringExpense.userId,
                opportunityId: recurringExpense.opportunityId,
                notes: recurringExpense.notes,
                createdAt: now,
                updatedAt: now
              })
              .select()
              .single()

            if (!insertError && expense) {
              console.log('[RECURRING EXPENSES GENERATE] Created forecast expense:', expense.id, 'for date:', paymentDate.toISOString())
              generated.push(expense)
            } else if (insertError) {
              console.error('[RECURRING EXPENSES GENERATE] Error creating forecast expense:', insertError)
            }
          } else {
            console.log('[RECURRING EXPENSES GENERATE] Forecast expense already exists for date:', paymentDate.toISOString())
          }
        }

        // Passer au mois suivant selon le type de récurrence
        if (recurringExpense.recurrenceType === 'WEEKLY') {
          currentDate.setDate(currentDate.getDate() + 7)
        } else if (recurringExpense.recurrenceType === 'MONTHLY') {
          currentDate.setMonth(currentDate.getMonth() + 1)
        } else if (recurringExpense.recurrenceType === 'QUARTERLY') {
          currentDate.setMonth(currentDate.getMonth() + 3)
        } else if (recurringExpense.recurrenceType === 'YEARLY') {
          currentDate.setFullYear(currentDate.getFullYear() + 1)
        }
      }

      console.log('[RECURRING EXPENSES GENERATE] Generated', generated.length, 'forecast expenses')
      return new Response(
        JSON.stringify(generated),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('recurring-expenses/') && method === 'DELETE') {
      const id = path.split('/')[1]
      const { error } = await supabase
        .from('RecurringExpense')
        .delete()
        .eq('id', id)

      if (error) throw error
      return new Response(
        JSON.stringify({ message: 'Recurring expense deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== EXPENSES ROUTES =====
    console.log('[EXPENSES DEBUG] path:', path, 'method:', method, 'path === expenses:', path === 'expenses')
    
    if (path === 'expenses' && method === 'GET') {
      try {
        const userId = url.searchParams.get('userId')
        const status = url.searchParams.get('status')
        const companyId = url.searchParams.get('companyId')
        const opportunityId = url.searchParams.get('opportunityId')
        const startDate = url.searchParams.get('startDate')
        const endDate = url.searchParams.get('endDate')

        // Sélectionner les relations de manière sécurisée
        // IMPORTANT : Sélectionner explicitement recurringExpenseId, isForecast, forecastDate pour éviter les problèmes avec le wildcard *
        let selectQuery = '*, recurringExpenseId, isForecast, forecastDate, company:Company(*)'
        // Ajouter opportunity seulement si la colonne existe
        selectQuery += ', opportunity:Opportunity(*)'
        // Ajouter user seulement si la colonne existe
        selectQuery += ', user:User(id, email)'

        let query = supabase
          .from('Expense')
          .select(selectQuery)
          .order('createdAt', { ascending: false })

        if (userId) {
          query = query.eq('userId', userId)
        }
        if (status) {
          query = query.eq('status', status)
        }
        if (companyId) {
          query = query.eq('companyId', companyId)
        }
        if (opportunityId) {
          query = query.eq('opportunityId', opportunityId)
        }
        if (startDate) {
          query = query.gte('invoiceDate', startDate)
        }
        if (endDate) {
          query = query.lte('invoiceDate', endDate)
        }

        const { data, error } = await query
        if (error) {
          console.error('[EXPENSES GET] Error:', error)
          // Si l'erreur est liée aux relations, essayer sans les relations
          if (error.message && (error.message.includes('relation') || error.message.includes('foreign'))) {
            console.log('[EXPENSES GET] Retrying without relations...')
            let simpleQuery = supabase
              .from('Expense')
              .select('*')
              .order('createdAt', { ascending: false })
            
            if (userId) simpleQuery = simpleQuery.eq('userId', userId)
            if (status) simpleQuery = simpleQuery.eq('status', status)
            if (companyId) simpleQuery = simpleQuery.eq('companyId', companyId)
            if (opportunityId) simpleQuery = simpleQuery.eq('opportunityId', opportunityId)
            if (startDate) simpleQuery = simpleQuery.gte('invoiceDate', startDate)
            if (endDate) simpleQuery = simpleQuery.lte('invoiceDate', endDate)
            
            const { data: simpleData, error: simpleError } = await simpleQuery
            if (simpleError) {
              return new Response(
                JSON.stringify({ message: 'Failed to fetch expenses', error: simpleError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
            return new Response(
              JSON.stringify(simpleData || []),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          return new Response(
            JSON.stringify({ message: 'Failed to fetch expenses', error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        console.log('[EXPENSES GET] Found', data?.length || 0, 'expenses with filters:', { userId, status, companyId, opportunityId, startDate, endDate })
        // Log pour débogage : vérifier que les champs nécessaires sont présents
        if (data && data.length > 0) {
          const sampleRecurring = data.find((e: any) => e.recurringExpenseId);
          if (sampleRecurring) {
            console.log('[EXPENSES GET] Sample recurring expense:', {
              id: sampleRecurring.id,
              isForecast: sampleRecurring.isForecast,
              recurringExpenseId: sampleRecurring.recurringExpenseId,
              status: sampleRecurring.status
            });
          }
        }
        return new Response(
          JSON.stringify(data || []),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (error) {
        console.error('[EXPENSES GET] Unexpected error:', error)
        return new Response(
          JSON.stringify({ 
            message: 'Internal server error',
            error: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Interface et fonction de sérialisation pour les dépenses (identique à expenses/index.ts)
    type ExpenseStatus = 'PENDING' | 'PROCESSED' | 'VERIFIED' | 'REJECTED'

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

    if (path === 'expenses' && method === 'POST') {
      try {
        let body
      try {
        body = await req.json()
      } catch (e) {
        console.error('[EXPENSES POST] Error parsing JSON:', e)
        return new Response(
          JSON.stringify({ message: 'Erreur lors du parsing du JSON' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const {
        supplierName,
        invoiceNumber,
        invoiceDate,
        amountHT,
        amountTTC,
        vatAmount,
        vatRate,
        accountCode,
        accountLabel,
        status,
        notes,
        companyId,
        opportunityId
      } = body

      // Récupérer l'utilisateur depuis le token
      const accessToken = req.headers.get('x-user-authorization')?.replace('Bearer ', '') || 
                         req.headers.get('authorization')?.replace('Bearer ', '')
      let userId: string | null = null
      if (accessToken) {
        try {
          const decoded = await verifyAccessToken(accessToken)
          if (decoded && decoded.userId) {
            userId = decoded.userId
          }
        } catch (e) {
          // Si le token n'est pas valide, on continue sans userId
        }
      }

      const now = new Date().toISOString()
      const newId = crypto.randomUUID()

      // Utiliser la même logique de sérialisation que expenses/index.ts
      const expensePayload: ExpensePayload = {
        supplierName,
        invoiceNumber,
        invoiceDate,
        amountHT,
        amountTTC,
        vatAmount,
        vatRate,
        accountCode,
        accountLabel,
        companyId,
        notes,
        status: status || 'VERIFIED'
      }

      const expenseData = serializeExpensePayload(expensePayload)

      // Nettoyer les valeurs undefined avant l'insertion (PostgreSQL les rejette)
      const cleanExpenseData: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(expenseData)) {
        if (value !== undefined) {
          cleanExpenseData[key] = value
        }
      }

      // Ajouter les champs système
      const insertData: Record<string, unknown> = {
        id: newId,
        ...cleanExpenseData,
        status: status || 'VERIFIED',
        createdAt: now,
        updatedAt: now
      }

      // Ajouter userId séparément
      if (userId !== undefined && userId !== null) {
        insertData.userId = userId
      }
      // Ajouter opportunityId si elle est fournie (la colonne existe maintenant dans la base)
      if (opportunityId !== undefined && opportunityId !== null && opportunityId !== '') {
        insertData.opportunityId = opportunityId
      }

      const { data, error } = await supabase
        .from('Expense')
        .insert(insertData)
        .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
        .single()

      if (error) {
        console.error('[EXPENSES POST] Error inserting expense:', error)
        console.error('[EXPENSES POST] Error details:', JSON.stringify(error, null, 2))
        console.error('[EXPENSES POST] Request body:', JSON.stringify(body, null, 2))
        console.error('[EXPENSES POST] Insert data:', JSON.stringify(insertData, null, 2))
        
        // Détecter les erreurs de colonne inexistante (PGRST204 ou messages d'erreur PostgreSQL)
        const isColumnMissingError = 
          error.code === 'PGRST204' ||
          error.message?.includes("Could not find") ||
          (error.message?.includes("column") && error.message?.includes("does not exist")) ||
          error.message?.match(/column "(\w+)" does not exist/i) ||
          error.message?.match(/column (\w+) does not exist/i)
        
        console.log('[EXPENSES POST] isColumnMissingError:', isColumnMissingError, 'error.code:', error.code)
        
        if (isColumnMissingError) {
          // Extraire le nom de la colonne manquante
          let missingColumn: string | null = null
          if (error.code === 'PGRST204' && error.message) {
            const match = error.message.match(/'(\w+)'/i)
            if (match) {
              missingColumn = match[1]
              console.log('[EXPENSES POST] Extracted missing column from PGRST204:', missingColumn)
            }
          } else if (error.message) {
            const match = error.message.match(/column "(\w+)" does not exist/i) || 
                         error.message.match(/column (\w+) does not exist/i) ||
                         error.message.match(/'(\w+)'/i)
            if (match) {
              missingColumn = match[1]
              console.log('[EXPENSES POST] Extracted missing column from message:', missingColumn)
            }
          }
          
          if (missingColumn) {
            console.warn(`[EXPENSES POST] Column ${missingColumn} does not exist (${error.code}), retrying without it`)
            console.log('[EXPENSES POST] Insert data before delete:', JSON.stringify(insertData, null, 2))
            delete insertData[missingColumn]
            console.log('[EXPENSES POST] Insert data after delete:', JSON.stringify(insertData, null, 2))
            
            const { data: retryData, error: retryError } = await supabase
              .from('Expense')
              .insert(insertData)
              .select('*, company:Company(*), opportunity:Opportunity(*), user:User(id, email)')
              .single()
            
            if (retryError) {
              console.error('[EXPENSES POST] Retry error:', retryError)
              console.error('[EXPENSES POST] Retry error details:', JSON.stringify(retryError, null, 2))
              return new Response(
                JSON.stringify({ 
                  message: 'Erreur lors de la création de la dépense',
                  error: retryError.message,
                  code: retryError.code,
                  details: retryError.details,
                  hint: retryError.hint
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
            
            console.log('[EXPENSES POST] Successfully created expense without', missingColumn)
            return new Response(
              JSON.stringify(retryData),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          } else {
            console.warn('[EXPENSES POST] Column missing error detected but could not extract column name')
          }
        }
        
        return new Response(
          JSON.stringify({ 
            message: 'Erreur lors de la création de la dépense',
            error: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
      } catch (expenseError) {
        console.error('[EXPENSES POST] Unexpected error in expense creation:', expenseError)
        console.error('[EXPENSES POST] Error stack:', expenseError?.stack)
        console.error('[EXPENSES POST] Error details:', JSON.stringify(expenseError, Object.getOwnPropertyNames(expenseError || {})))
        return new Response(
          JSON.stringify({ 
            message: 'Erreur lors de la création de la dépense',
            error: expenseError?.message || expenseError?.toString() || String(expenseError),
            stack: expenseError?.stack
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (path.startsWith('expenses/') && method === 'GET') {
      const id = path.split('/')[1]
      const { data, error } = await supabase
        .from('Expense')
        .select('*, opportunity:Opportunity(*), user:User(id, email)')
        .eq('id', id)
        .single()
      if (error) throw error
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('expenses/') && method === 'PUT') {
      const id = path.split('/')[1]
      const body = await req.json()
      const {
        supplierName,
        invoiceNumber,
        invoiceDate,
        amountHT,
        amountTTC,
        vatAmount,
        vatRate,
        accountCode,
        accountLabel,
        status,
        notes,
        companyId,
        opportunityId
      } = body

      const updateData: any = {
        updatedAt: new Date().toISOString()
      }

      if (supplierName !== undefined) updateData.supplierName = supplierName || null
      if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber || null
      if (invoiceDate !== undefined) updateData.invoiceDate = invoiceDate ? new Date(invoiceDate).toISOString() : null
      if (amountHT !== undefined) updateData.amountHT = amountHT ? amountHT.toString() : null
      if (amountTTC !== undefined) updateData.amountTTC = amountTTC ? amountTTC.toString() : null
      if (vatAmount !== undefined) updateData.vatAmount = vatAmount ? vatAmount.toString() : null
      if (vatRate !== undefined) updateData.vatRate = vatRate ? vatRate.toString() : null
      if (accountCode !== undefined) updateData.accountCode = accountCode || null
      if (accountLabel !== undefined) updateData.accountLabel = accountLabel || null
      if (status !== undefined) updateData.status = status
      if (notes !== undefined) updateData.notes = notes || null
      if (companyId !== undefined) updateData.companyId = companyId || null
      if (opportunityId !== undefined) updateData.opportunityId = opportunityId || null
      // Récupérer la dépense actuelle pour vérifier le recurringExpenseId
      const { data: currentExpense } = await supabase
        .from('Expense')
        .select('recurringExpenseId, status, isForecast, invoiceDate, forecastDate')
        .eq('id', id)
        .single()

      // Si la dépense a un recurringExpenseId, elle doit rester prévisionnelle jusqu'à ce qu'elle soit réglée (PAID)
      const finalRecurringExpenseId = body.recurringExpenseId !== undefined ? body.recurringExpenseId : currentExpense?.recurringExpenseId
      const finalStatus = body.status !== undefined ? body.status : currentExpense?.status
      
      // Gérer isForecast et forecastDate selon la logique des dépenses récurrentes
      if (finalRecurringExpenseId) {
        // IMPORTANT : Préserver explicitement le recurringExpenseId si ce n'est pas modifié dans le body
        if (body.recurringExpenseId === undefined) {
          updateData.recurringExpenseId = finalRecurringExpenseId
        }
        
        if (finalStatus === 'PAID') {
          // Une fois réglée, retirer le tag prévisionnel (même si explicitement défini dans le body)
          updateData.isForecast = false
          updateData.forecastDate = null
        } else {
          // Sinon, elle doit rester prévisionnelle (même si VERIFIED)
          // Forcer isForecast à true même si le body essaie de le mettre à false
          updateData.isForecast = true
          // Si forecastDate n'est pas défini dans le body, utiliser celle existante ou invoiceDate
          if (body.forecastDate !== undefined) {
            updateData.forecastDate = body.forecastDate ? new Date(body.forecastDate).toISOString() : null
          } else if (!currentExpense?.forecastDate) {
            // Si pas de forecastDate existante, utiliser invoiceDate
            if (body.invoiceDate) {
              updateData.forecastDate = new Date(body.invoiceDate).toISOString()
            } else if (currentExpense?.invoiceDate) {
              updateData.forecastDate = new Date(currentExpense.invoiceDate).toISOString()
            }
          }
        }
      } else {
        // Si ce n'est pas une dépense récurrente, appliquer les valeurs du body
        if (body.isForecast !== undefined) updateData.isForecast = body.isForecast
        if (body.forecastDate !== undefined) updateData.forecastDate = body.forecastDate ? new Date(body.forecastDate).toISOString() : null
      }
      
      // Appliquer recurringExpenseId du body s'il est défini
      if (body.recurringExpenseId !== undefined) updateData.recurringExpenseId = body.recurringExpenseId || null

      const { data, error } = await supabase
        .from('Expense')
        .update(updateData)
        .eq('id', id)
        .select('*, company:Company(*), opportunity:Opportunity(*, company:Company(*)), user:User(id, email)')
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path.startsWith('expenses/') && method === 'DELETE') {
      const id = path.split('/')[1]
      const { error } = await supabase
        .from('Expense')
        .delete()
        .eq('id', id)
      if (error) throw error
      return new Response(
        JSON.stringify({ message: 'Expense deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'expenses/scan' && method === 'POST') {
      // Pour le scan, on redirige vers la fonction expenses dédiée
      // ou on peut implémenter ici si nécessaire
      // Pour l'instant, retourner une erreur indiquant que le scan doit être fait via la fonction expenses
      return new Response(
        JSON.stringify({ message: 'Scan endpoint not available in main API. Use /functions/v1/expenses/scan' }),
        { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route pour valider une dépense prévisionnelle
    if (path.startsWith('expenses/') && path.endsWith('/validate') && method === 'POST') {
      const id = path.split('/')[1]
      
      // REQUÊTE DIRECTE EN BASE pour récupérer le recurringExpenseId AVANT toute autre opération
      // C'est la seule façon fiable de s'assurer qu'on a la vraie valeur
      const { data: directCheck, error: directError } = await supabase
        .from('Expense')
        .select('recurringExpenseId, isForecast, forecastDate, invoiceDate')
        .eq('id', id)
        .single()

      if (directError || !directCheck) {
        return new Response(
          JSON.stringify({ message: 'Dépense non trouvée' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const actualRecurringExpenseId = directCheck.recurringExpenseId
      const wasForecast = directCheck.isForecast === true

      console.log('[VALIDATE] Vérification directe en base:', {
        id,
        recurringExpenseId: actualRecurringExpenseId,
        isForecast: wasForecast
      })

      // Récupérer la dépense complète pour les autres champs
      const { data: expense, error: fetchError } = await supabase
        .from('Expense')
        .select('*, company:Company(*), opportunity:Opportunity(*, company:Company(*)), user:User(id, email)')
        .eq('id', id)
        .single()

      if (fetchError || !expense) {
        return new Response(
          JSON.stringify({ message: 'Erreur lors de la récupération de la dépense' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Mettre à jour la dépense : passer à VERIFIED mais garder isForecast si c'est une dépense récurrente
      // Le tag prévisionnel sera retiré uniquement quand la dépense sera marquée comme PAID
      const updateData: any = {
        status: 'VERIFIED',
        updatedAt: new Date().toISOString()
      }
      
      // RÈGLE SIMPLE : Si la dépense a un recurringExpenseId, elle DOIT rester prévisionnelle jusqu'à PAID
      if (actualRecurringExpenseId) {
        console.log('[VALIDATE] Dépense récurrente détectée - recurringExpenseId:', actualRecurringExpenseId)
        
        // FORCER la préservation du recurringExpenseId
        updateData.recurringExpenseId = actualRecurringExpenseId
        
        // FORCER isForecast à true - c'est une dépense récurrente, elle reste prévisionnelle
        updateData.isForecast = true
        
        // Garder forecastDate si elle existe, sinon utiliser invoiceDate
        if (directCheck.forecastDate) {
          updateData.forecastDate = directCheck.forecastDate
        } else if (directCheck.invoiceDate) {
          updateData.forecastDate = directCheck.invoiceDate
        }
        
        console.log('[VALIDATE] Mise à jour RÉCURRENTE - isForecast=true, recurringExpenseId préservé:', updateData)
      } else {
        console.log('[VALIDATE] Dépense NON récurrente - retirer le tag prévisionnel')
        // Si pas de recurringExpenseId, retirer le tag prévisionnel
        updateData.isForecast = false
        updateData.forecastDate = null
      }
      
      console.log('[VALIDATE] Données à mettre à jour:', JSON.stringify(updateData))
      
      const { data: updatedExpense, error: updateError } = await supabase
        .from('Expense')
        .update(updateData)
        .eq('id', id)
        .select('*, recurringExpenseId, isForecast, forecastDate, company:Company(*), opportunity:Opportunity(*, company:Company(*)), user:User(id, email)')
        .single()

      if (updateError) {
        console.error('[VALIDATE] Erreur mise à jour:', updateError)
        return new Response(
          JSON.stringify({ message: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('[VALIDATE] Dépense mise à jour:', updatedExpense?.id, 'isForecast:', updatedExpense?.isForecast, 'recurringExpenseId:', updatedExpense?.recurringExpenseId)
      console.log('[VALIDATE] Données complètes updatedExpense:', JSON.stringify(updatedExpense, null, 2))

      // IMPORTANT : Recharger la dépense pour s'assurer que recurringExpenseId est bien présent dans la réponse
      // Sélectionner explicitement recurringExpenseId, isForecast, forecastDate pour éviter les problèmes avec le wildcard *
      const { data: finalExpense, error: reloadError } = await supabase
        .from('Expense')
        .select('*, recurringExpenseId, isForecast, forecastDate, company:Company(*), opportunity:Opportunity(*, company:Company(*)), user:User(id, email)')
        .eq('id', id)
        .single()

      if (reloadError) {
        console.error('[VALIDATE] Erreur rechargement:', reloadError)
      } else {
        console.log('[VALIDATE] Dépense rechargée:', finalExpense?.id, 'isForecast:', finalExpense?.isForecast, 'recurringExpenseId:', finalExpense?.recurringExpenseId)
        console.log('[VALIDATE] Données complètes finalExpense:', JSON.stringify(finalExpense, null, 2))
      }

      const expenseToReturn = finalExpense || updatedExpense
      console.log('[VALIDATE] Dépense finale retournée au frontend:', expenseToReturn?.id, 'isForecast:', expenseToReturn?.isForecast, 'recurringExpenseId:', expenseToReturn?.recurringExpenseId)

      // Optionnellement, générer la prochaine dépense prévisionnelle si c'est une dépense récurrente
      if (actualRecurringExpenseId && expenseToReturn?.isForecast) {
        // Récupérer les informations de la dépense récurrente
        const { data: recurringExpense } = await supabase
          .from('RecurringExpense')
          .select('*')
          .eq('id', actualRecurringExpenseId)
          .single()
        
        if (recurringExpense && recurringExpense.isActive) {
          const forecastDate = directCheck.forecastDate || directCheck.invoiceDate
          if (forecastDate) {
            const nextDate = new Date(forecastDate)
            nextDate.setMonth(nextDate.getMonth() + 1)
            
            // Vérifier si une dépense existe déjà pour cette date
            const { data: existing } = await supabase
              .from('Expense')
              .select('id')
              .eq('recurringExpenseId', actualRecurringExpenseId)
              .eq('forecastDate', nextDate.toISOString())
              .eq('isForecast', true)
              .single()

            if (!existing) {
              await supabase
                .from('Expense')
                .insert({
                  supplierName: recurringExpense.supplierName,
                  amountHT: recurringExpense.amountHT,
                  amountTTC: recurringExpense.amountTTC,
                  vatAmount: recurringExpense.vatAmount,
                  vatRate: recurringExpense.vatRate,
                  accountCode: recurringExpense.accountCode,
                  accountLabel: recurringExpense.accountLabel,
                  invoiceDate: nextDate.toISOString(),
                  forecastDate: nextDate.toISOString(),
                  isForecast: true,
                  status: 'PENDING',
                  recurringExpenseId: actualRecurringExpenseId,
                  companyId: recurringExpense.companyId,
                  userId: recurringExpense.userId,
                  opportunityId: recurringExpense.opportunityId,
                  notes: recurringExpense.notes
                })
            }
          }
        }
      }

      return new Response(
        JSON.stringify(expenseToReturn),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    } // Fin du bloc if (!isPublicRoute)

    // Route not found
    return new Response(
      JSON.stringify({ message: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[API ERROR] Unhandled error:', error)
    console.error('[API ERROR] Error stack:', error?.stack)
    console.error('[API ERROR] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error || {})))
    return new Response(
      JSON.stringify({ 
        message: error?.message || 'Erreur interne du serveur',
        error: error?.toString() || String(error),
        stack: error?.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

