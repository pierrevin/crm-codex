# Guide de déploiement Supabase Edge Functions

## Déploiement manuel

Pour déployer les Edge Functions Supabase après modification du code :

```bash
# 1. Configurer le token Supabase (si pas déjà fait)
export SUPABASE_ACCESS_TOKEN="votre-token"

# 2. Lier le projet (si pas déjà fait)
supabase link --project-ref oecbrtyeqatieeybjvhj

# 3. Déployer la fonction
supabase functions deploy api --no-verify-jwt
```

## Déploiement automatique via GitHub Actions

Le workflow `.github/workflows/deploy-supabase.yml` déploie automatiquement les Edge Functions à chaque push sur `main`.

### Configuration requise

Dans les **Secrets GitHub** du dépôt (Settings → Secrets and variables → Actions), ajouter :

1. `SUPABASE_ACCESS_TOKEN` : Token d'accès Supabase (obtenu sur https://app.supabase.com/account/tokens)
2. `SUPABASE_PROJECT_REF` : `oecbrtyeqatieeybjvhj`

Une fois configurés, le déploiement se fera automatiquement à chaque push sur `main` qui modifie les fichiers dans `supabase/functions/`.

