# 🚀 Déploiement Final - 3 Étapes Simples

## ✅ Ce qui est fait

- ✅ API complète créée en Deno (Auth, Users, Contacts, Companies, Opportunities, Activities)
- ✅ Script de déploiement prêt
- ✅ Frontend fonctionnel en local avec Supabase

## 📋 Ce qu'il reste à faire (5 minutes)

### **Étape 1 : Obtenir votre Token Supabase** (1 min)

1. Allez sur https://app.supabase.com/account/tokens
2. Cliquez sur **"Generate new token"**
3. Donnez un nom : `CRM Deploy`
4. Copiez le token généré

### **Étape 2 : Déployer l'Edge Function** (2 min)

Dans votre terminal :

```bash
# Définir le token (remplacez par votre vrai token)
export SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxxxxxxxxxxxx"

# Lancer le déploiement automatique
./deploy-supabase.sh
```

Le script va :
- ✅ Lier votre projet Supabase
- ✅ Configurer les secrets JWT
- ✅ Déployer l'Edge Function `api`

### **Étape 3 : Mettre à jour Vercel** (2 min)

```bash
# Mettre à jour l'URL du backend
vercel env add VITE_API_URL production
# Quand il demande la valeur, entrez :
# https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1

# Redéployer le frontend
vercel --prod
```

---

## 🎉 C'EST FINI !

Votre CRM sera accessible sur https://crm-codex.vercel.app

**Architecture finale :**
```
Frontend (Vercel) → Backend (Supabase Edge Functions) → PostgreSQL (Supabase)
```

**100% gratuit - Aucune limite de temps !** ✨

---

## 🧪 Tester que Tout Fonctionne

### Test 1 : Health Check
```bash
curl https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api/auth/health
```

Résultat attendu : `{"status":"ok","timestamp":"..."}`

### Test 2 : Login
```bash
curl -X POST https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crm-codex.local","password":"AdminCRM2024!"}'
```

Résultat attendu : `{"accessToken":"...","refreshToken":"..."}`

### Test 3 : Ouvrir le CRM
Allez sur https://crm-codex.vercel.app et connectez-vous !

---

## 🐛 En Cas de Problème

### Erreur : "Invalid credentials" lors du login

L'utilisateur n'existe peut-être pas dans Supabase. Créez-le :

```bash
# Générer un hash bcrypt du mot de passe
npm install -g bcrypt-cli
bcrypt-cli hash "AdminCRM2024!" 10
```

Puis dans Supabase Dashboard :
1. Table Editor → User
2. Insert row
3. email: `admin@crm-codex.local`
4. passwordHash: `[le hash généré]`

### Erreur : "Function not found"

Vérifiez que la fonction est bien déployée :
```bash
supabase functions list
```

### Erreur CORS

Les headers CORS sont déjà configurés. Si problème persiste :
```bash
# Voir les logs
supabase functions logs api --tail
```

---

## 📊 Routes Disponibles

Toutes les routes sont sur : `https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/api/`

**Auth**
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh token
- `GET /auth/health` - Health check

**Users**
- `GET /users/me` - Utilisateur connecté

**Contacts**
- `GET /contacts` - Liste
- `POST /contacts` - Créer
- `GET /contacts/:id` - Détail
- `PATCH /contacts/:id` - Modifier
- `DELETE /contacts/:id` - Supprimer

**Companies**
- `GET /companies` - Liste
- `POST /companies` - Créer
- `GET /companies/:id` - Détail
- `PATCH /companies/:id` - Modifier
- `DELETE /companies/:id` - Supprimer

**Opportunities**
- `GET /opportunities` - Liste
- `POST /opportunities` - Créer
- `GET /opportunities/:id` - Détail
- `PATCH /opportunities/:id` - Modifier
- `DELETE /opportunities/:id` - Supprimer

**Activities**
- `GET /activities` - Liste
- `POST /activities` - Créer
- `GET /activities/:id` - Détail
- `PATCH /activities/:id` - Modifier

---

## 🎯 Félicitations !

Vous avez maintenant un CRM full-stack moderne déployé avec :
- ✅ Frontend React sur Vercel
- ✅ Backend Deno sur Supabase Edge Functions
- ✅ Base de données PostgreSQL sur Supabase
- ✅ 100% gratuit et scalable

**Bon développement !** 🚀

