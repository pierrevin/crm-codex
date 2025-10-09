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
echo "🔐 Configuration des secrets JWT..."
supabase secrets set JWT_ACCESS_SECRET=local-dev-secret
supabase secrets set JWT_REFRESH_SECRET=local-refresh-secret

echo "✅ Secrets configurés"
echo ""

# Déployer la fonction
echo "📦 Déploiement de l'Edge Function 'api'..."
supabase functions deploy api --no-verify-jwt

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du déploiement"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ DÉPLOIEMENT RÉUSSI !                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Votre API est maintenant disponible sur :"
echo "   https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api"
echo ""
echo "🧪 Testez avec :"
echo "   curl https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api/auth/health"
echo ""
echo "📝 Prochaine étape : Mettre à jour Vercel"
echo "   vercel env add VITE_API_URL production"
echo "   Valeur : https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1"
echo ""

