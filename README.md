# 🚀 CRM Codex - V1.0

CRM moderne single-user construit avec React, Supabase Edge Functions (Deno) et PostgreSQL.

## 🌐 Déploiement en Ligne

**Application en production** : https://crm-codex.vercel.app

### Architecture
```
Frontend (Vercel) → Backend (Supabase Edge Functions) → PostgreSQL (Supabase)
```

- ✅ **Frontend** : React + Vite + Tailwind déployé sur Vercel
- ✅ **Backend** : API Deno déployée sur Supabase Edge Functions
- ✅ **Base de données** : PostgreSQL managé par Supabase
- ✅ **100% gratuit** - Aucun coût mensuel

### Connexion
- **Email** : `admin@crm-codex.local`
- **Password** : `AdminCRM2024!`

---

## 🛠️ Installation Locale

### Prérequis
- Node.js 20+
- Compte Supabase (gratuit)
- Supabase CLI : `brew install supabase/tap/supabase`

### Configuration

1. **Cloner le projet**
```bash
git clone https://github.com/pierrevin/crm-codex.git
cd crm-codex
```

2. **Configurer Supabase**

Créez `backend/.env` :
```bash
DATABASE_URL="postgresql://postgres.xxxxx:[PASSWORD]@xxx.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
PORT=3000
NODE_ENV=development
WEB_APP_URL=http://localhost:5173
JWT_ACCESS_SECRET=local-dev-secret
JWT_REFRESH_SECRET=local-refresh-secret
ADMIN_EMAIL=admin@crm-codex.local
ADMIN_PASSWORD=AdminCRM2024!
```

Créez `frontend/.env` :
```bash
VITE_API_URL=http://localhost:3000
```

3. **Installer et lancer**
```bash
# Backend NestJS
cd backend
npm install
npm run prisma:generate
npm run build
npm run start:dev

# Frontend React (dans un autre terminal)
cd frontend
npm install
npm run dev
```

Ouvrez http://localhost:5173

---

## 📦 Déploiement

### Déployer les Edge Functions Supabase

```bash
# Se connecter à Supabase
export SUPABASE_ACCESS_TOKEN="votre-token"

# Déployer
./deploy-supabase.sh
```

L'API sera disponible sur : `https://[votre-projet].supabase.co/functions/v1/api`

### Déployer le Frontend sur Vercel

```bash
# Configurer l'URL backend
vercel env add VITE_API_URL production
# Valeur : https://[votre-projet].supabase.co/functions/v1

# Déployer
vercel --prod
```

---

## 🏗️ Stack Technique

### Frontend
- **React 18** - Interface utilisateur
- **Vite** - Build tool ultra-rapide
- **Tailwind CSS** - Styling moderne
- **React Router** - Navigation
- **Recharts** - Graphiques et visualisations
- **Axios** - Client HTTP

### Backend
- **Deno** - Runtime moderne pour Edge Functions
- **Supabase Edge Functions** - API serverless
- **JWT** - Authentification avec refresh tokens
- **PostgreSQL** - Base de données relationnelle

### Infrastructure
- **Vercel** - Hébergement frontend (CDN mondial)
- **Supabase** - Backend + Base de données
- **GitHub** - Versioning et CI/CD automatique

---

## ✨ Fonctionnalités

### Gestion CRM
- ✅ **Contacts** - CRUD complet avec recherche
- ✅ **Entreprises** - Gestion des clients
- ✅ **Opportunités** - Suivi des affaires avec Kanban
- ✅ **Activités** - Tâches, appels, réunions
- ✅ **Dashboard** - Statistiques et graphiques temps réel

### Sécurité & Performance
- ✅ Authentification JWT (access + refresh tokens)
- ✅ CORS configuré
- ✅ Rate limiting
- ✅ Validation des données
- ✅ CDN mondial (Vercel)
- ✅ Edge computing (faible latence)

---

## 📊 Routes API

Toutes les routes sur : `https://[projet].supabase.co/functions/v1/api/`

### Auth
- `POST /auth/login` - Connexion
- `POST /auth/refresh` - Rafraîchir le token
- `GET /auth/health` - Health check

### Users
- `GET /users/me` - Utilisateur connecté

### Contacts
- `GET /contacts` - Liste (avec recherche et pagination)
- `POST /contacts` - Créer
- `GET /contacts/:id` - Détail
- `PATCH /contacts/:id` - Modifier
- `DELETE /contacts/:id` - Supprimer

### Companies
- `GET /companies` - Liste
- `POST /companies` - Créer
- `GET /companies/:id` - Détail
- `PATCH /companies/:id` - Modifier
- `DELETE /companies/:id` - Supprimer

### Opportunities
- `GET /opportunities` - Liste
- `POST /opportunities` - Créer
- `GET /opportunities/:id` - Détail
- `PATCH /opportunities/:id` - Modifier
- `DELETE /opportunities/:id` - Supprimer

### Activities
- `GET /activities` - Liste
- `POST /activities` - Créer
- `GET /activities/:id` - Détail
- `PATCH /activities/:id` - Modifier

---

## 🔧 Commandes Utiles

### Développement Backend (NestJS local)
```bash
cd backend
npm run start:dev    # Mode développement avec hot-reload
npm run build        # Compiler
npm run start:prod   # Mode production
```

### Développement Frontend
```bash
cd frontend
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run preview      # Prévisualiser le build
```

### Supabase Edge Functions
```bash
supabase functions deploy api           # Déployer
supabase functions list                 # Lister les fonctions
supabase secrets set KEY=value          # Configurer un secret
```

### Base de Données
```bash
cd backend
npm run prisma:generate                         # Générer le client Prisma
npx prisma studio --schema ../prisma/schema.prisma  # Interface visuelle
npx prisma db pull --schema ../prisma/schema.prisma # Synchroniser le schéma
```

---

## 📝 Notes Importantes

### Variables d'Environnement

**Backend** (Supabase Edge Functions) :
- `JWT_ACCESS_SECRET` - Secret pour les access tokens
- `JWT_REFRESH_SECRET` - Secret pour les refresh tokens
- `SUPABASE_URL` - Auto-configuré
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-configuré

**Frontend** (Vercel) :
- `VITE_API_URL` - URL de l'API Supabase

### Sécurité
- Les mots de passe sont hachés avec **bcrypt**
- Les tokens JWT expirent après 15 minutes (access) et 7 jours (refresh)
- Tous les secrets doivent être configurés en production

### Fonction SQL Requise

Créez cette fonction dans Supabase SQL Editor :

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION verify_password(user_id TEXT, password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  password_hash TEXT;
BEGIN
  SELECT "passwordHash" INTO password_hash FROM "User" WHERE id = user_id;
  RETURN crypt(password, password_hash) = password_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🆘 Support & Contribution

Pour toute question ou amélioration, ouvrez une issue sur GitHub.

**Version** : 1.0.0  
**Licence** : MIT  
**Auteur** : Pierre Vincenot
