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
    if (path.startsWith('/functions/v1/')) {
      path = path.substring('/functions/v1/'.length)
    }
    if (path.startsWith('api/')) {
      path = path.substring('api/'.length)
    } else if (path.startsWith('/api/')) {
      path = path.substring('/api/'.length)
    } else if (path.startsWith('/')) {
      path = path.substring(1)
    }
    // method already defined above

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
      const webAppUrl = Deno.env.get('WEB_APP_URL') || 'https://crm-codex.vercel.app'
      
      const status = {
        configured: {
          clientId: !!clientId && clientId.length > 0,
          clientSecret: !!clientSecret && clientSecret.length > 0,
          redirectUri: !!redirectEnv && redirectEnv.length > 0,
          webAppUrl: !!Deno.env.get('WEB_APP_URL'),
        },
        values: {
          clientId: clientId ? `${clientId.substring(0, 20)}...` : 'non configuré',
          redirectUri: redirectUri,
          redirectUriValid: redirectUri.startsWith('https://'),
          webAppUrl: webAppUrl,
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
      
      return new Response(
        JSON.stringify(status, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === 'google/auth-url' && method === 'GET') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
      const webAppUrlRaw = Deno.env.get('WEB_APP_URL')
      
      // Construire l'URI de redirection vers le frontend (solution professionnelle)
      // Le frontend recevra le code OAuth et appellera ensuite l'Edge Function avec les bons headers
      let redirectUri: string
      if (webAppUrlRaw && 
          typeof webAppUrlRaw === 'string' && 
          webAppUrlRaw !== 'undefined' && 
          webAppUrlRaw !== 'null' &&
          webAppUrlRaw.length > 0 &&
          webAppUrlRaw.startsWith('http')) {
        redirectUri = `${webAppUrlRaw}/auth/google/callback`
      } else {
        // Fallback vers valeur par défaut
        redirectUri = 'https://crm-codex.vercel.app/auth/google/callback'
      }
      
      console.log('Using frontend redirect URI:', redirectUri)
      
      // Valider que l'URI est valide
      if (!redirectUri || !redirectUri.startsWith('https://')) {
        return new Response(
          JSON.stringify({ error: 'Invalid redirect URI configuration', redirectUri }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const scopes = [ 'https://www.googleapis.com/auth/drive' ]
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      u.searchParams.set('client_id', clientId)
      u.searchParams.set('redirect_uri', redirectUri)
      u.searchParams.set('response_type', 'code')
      u.searchParams.set('access_type', 'offline')
      u.searchParams.set('prompt', 'consent')
      u.searchParams.set('scope', scopes.join(' '))
      const state = new URL(req.url).searchParams.get('state') ?? ''
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
            return returnResponse(false, 'Erreur lors de l\'enregistrement du token')
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

    // ===== AUTHENTICATED ROUTES =====
    // Skip auth check for public routes (already handled above)
    const publicRoutes = ['google/callback', 'google/auth-url', 'google/status', 'auth/login', 'auth/refresh', 'auth/health', 'auth/bootstrap-admin', 'auth/test-login']
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
        await supabase.from('GoogleToken').update({ accessToken: refreshed.access_token, expiryDate, updatedAt: new Date().toISOString() }).eq('userId', uid)
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
      } catch (error: any) {
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
    } // Fin du bloc if (!isPublicRoute)

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

