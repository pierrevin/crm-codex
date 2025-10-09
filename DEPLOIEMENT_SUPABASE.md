# 🚀 Déploiement Supabase Edge Functions

## Architecture Finale
```
Frontend (Vercel) → Backend (Supabase Edge Functions) → PostgreSQL (Supabase)
```

**Seulement 2 services !** Tout sur Supabase + Vercel 🎉

---

## Étape 1 : Installer Supabase CLI

```bash
brew install supabase/tap/supabase
```

Ou avec npm :
```bash
npm install -g supabase
```

---

## Étape 2 : Se Connecter à Supabase

```bash
supabase login
```

Ça va ouvrir votre navigateur pour vous authentifier.

---

## Étape 3 : Lier le Projet

```bash
supabase link --project-ref oecbrtyeqatieeybjvhj
```

---

## Étape 4 : Configurer les Secrets

```bash
# JWT Secrets (utilisez les mêmes que dans backend/.env)
supabase secrets set JWT_ACCESS_SECRET=local-dev-secret
supabase secrets set JWT_REFRESH_SECRET=local-refresh-secret

# Supabase URL et Service Role Key (automatiquement disponibles)
# Ces variables sont déjà configurées par Supabase
```

---

## Étape 5 : Déployer les Edge Functions

```bash
supabase functions deploy api
```

Ça va déployer la fonction `api` qui gère toutes les routes `/api/*`

---

## Étape 6 : Tester l'Edge Function

```bash
# Health check
curl https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api/auth/health

# Login
curl -X POST https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crm-codex.local","password":"AdminCRM2024!"}'
```

---

## Étape 7 : Mettre à Jour Vercel

```bash
vercel env add VITE_API_URL production
# Entrez : https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1
```

Puis redéployez le frontend :
```bash
vercel --prod
```

---

## ✅ C'est Tout !

Votre CRM sera accessible sur https://crm-codex.vercel.app avec :
- **Frontend** : Vercel
- **Backend** : Supabase Edge Functions
- **Base de données** : Supabase PostgreSQL

**100% gratuit et sans limite de durée !** 🎉

---

## 🐛 Troubleshooting

### Erreur : "Function not found"
```bash
# Vérifier que la fonction est bien déployée
supabase functions list
```

### Erreur : "Invalid credentials"
- Vérifiez que l'utilisateur existe dans votre base Supabase
- Le mot de passe doit être haché avec bcrypt

### Erreur CORS
Les headers CORS sont déjà configurés dans le code. Si ça ne marche pas :
```bash
# Vérifier les logs
supabase functions logs api
```

---

## 📊 Routes Disponibles

### Auth
- `POST /api/auth/login` - Se connecter
- `POST /api/auth/refresh` - Rafraîchir le token
- `GET /api/auth/health` - Health check

### Users
- `GET /api/users/me` - Utilisateur connecté

### Contacts
- `GET /api/contacts` - Liste des contacts
- `POST /api/contacts` - Créer un contact
- `GET /api/contacts/:id` - Détail d'un contact
- `PATCH /api/contacts/:id` - Modifier un contact
- `DELETE /api/contacts/:id` - Supprimer un contact

### Companies
- `GET /api/companies` - Liste des entreprises
- `POST /api/companies` - Créer une entreprise
- `GET /api/companies/:id` - Détail d'une entreprise
- `PATCH /api/companies/:id` - Modifier une entreprise
- `DELETE /api/companies/:id` - Supprimer une entreprise

---

## 🔄 Ajouter Opportunities et Activities

Les routes pour Opportunities et Activities peuvent être ajoutées de la même manière dans `supabase/functions/api/index.ts`.

Je les ai omises pour l'instant pour se concentrer sur l'essentiel, mais c'est exactement le même pattern.

