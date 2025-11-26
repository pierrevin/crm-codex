#!/bin/bash

# 🚀 Script de déploiement Supabase Edge Functions

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   🚀 Déploiement CRM Codex sur Supabase                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI n'est pas installé"
    echo "Installez-le avec : brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI détecté"
echo ""

# Vérifier le token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "⚠️  SUPABASE_ACCESS_TOKEN n'est pas défini"
    echo ""
    echo "📝 Pour obtenir votre token :"
    echo "   1. Allez sur https://app.supabase.com/account/tokens"
    echo "   2. Cliquez sur 'Generate new token'"
    echo "   3. Copiez le token"
    echo "   4. Exécutez : export SUPABASE_ACCESS_TOKEN='votre-token'"
    echo "   5. Relancez ce script"
    echo ""
    exit 1
fi

echo "✅ Token Supabase configuré"
echo ""

# Lier le projet
echo "🔗 Liaison au projet Supabase..."
supabase link --project-ref oecbrtyeqatieeybjvhj

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la liaison au projet"
    exit 1
fi

echo "✅ Projet lié"
echo ""

# Configurer les secrets
echo "🔐 Configuration des secrets requis..."
REQUIRED_SECRETS=(
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_STORAGE_BUCKET
  GOOGLE_DOCUMENT_AI_PROCESSOR_ID
  GOOGLE_CLIENT_EMAIL
  GOOGLE_PRIVATE_KEY
)

for SECRET in "${REQUIRED_SECRETS[@]}"; do
  VALUE=$(printenv "$SECRET")
  if [ -z "$VALUE" ]; then
    echo "⚠️  Variable $SECRET non définie. Ajoutez-la avant de relancer le script."
    exit 1
  fi
done

for SECRET in "${REQUIRED_SECRETS[@]}"; do
  echo "   • $SECRET"
  supabase secrets set "$SECRET=${!SECRET}"
done

echo "✅ Secrets configurés"
echo ""

# Déployer la fonction API (CRM historique)
echo "📦 Déploiement de l'Edge Function 'api'..."
supabase functions deploy api --no-verify-jwt

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du déploiement"
    exit 1
fi

# Déployer la fonction dépenses
echo "📦 Déploiement de l'Edge Function 'expenses'..."
supabase functions deploy expenses

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du déploiement de la fonction expenses"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ DÉPLOIEMENT RÉUSSI !                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 API CRM : https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api"
echo "🌐 Scan dépenses : https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/expenses"
echo ""
echo "🧪 Tests rapides :"
echo "   curl https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api/auth/health"
echo "   curl -X POST https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/expenses/scan -H \"Authorization: Bearer <anon-key>\""
echo ""
echo "📝 Prochaine étape :"
echo "   vercel env add VITE_API_URL production            # https://.../functions/v1"
echo "   vercel env add VITE_EXPENSES_API_URL production   # https://.../functions/v1/expenses"
echo ""

