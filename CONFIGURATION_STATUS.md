# État de la configuration - Système de dépenses

## ✅ Configuration terminée

### Variables d'environnement ajoutées dans `backend/.env` :

```bash
# Google Document AI
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=projects/982552445969/locations/eu/processors/bf192fa2f51782b4
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Supabase Storage
SUPABASE_URL=https://oecbrtyeqatieeybjvhj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=expenses
```

## ⚠️ Actions manuelles requises

### 1. Google Cloud - Clé de compte de service

Vous devez créer et télécharger une clé JSON pour le compte de service :

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Projet : **crm-codex** (ID: 982552445969)
3. Allez dans **IAM & Admin** > **Service Accounts**
4. Créez un compte de service ou utilisez un existant
5. Attribuez le rôle **Document AI API User**
6. Créez une clé JSON et téléchargez-la
7. Placez le fichier dans un endroit sécurisé (ex: `backend/config/service-account-key.json`)
8. Mettez à jour `GOOGLE_APPLICATION_CREDENTIALS` dans `.env` avec le chemin complet ou encodez la valeur de `private_key` (voir étape Supabase ci-dessous) pour la déployer comme secret.

**Exemple :**
```bash
GOOGLE_APPLICATION_CREDENTIALS=/Users/pierre/CRM codex/crm-codex/backend/config/service-account-key.json
```
s
### 2. Supabase - Service Role Key & secrets Document AI

1. Allez sur votre projet Supabase : https://supabase.com/dashboard/project/oecbrtyeqatieeybjvhj
2. Allez dans **Settings** > **API**
3. Copiez la **service_role key** (⚠️ Gardez-la secrète !)
4. Ajoutez-la dans `backend/.env` :
```bash
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key-ici
```
5. Déclarez également les secrets nécessaires pour la fonction Edge :
```bash
supabase secrets set \
  GOOGLE_DOCUMENT_AI_PROCESSOR_ID=projects/.../processors/... \
  GOOGLE_CLIENT_EMAIL=document-ai-service-account@... \
  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
6. Si vous ne pouvez pas stocker la clé avec des retours chariot, encodez-la :
```bash
GOOGLE_KEY=$(jq -r '.private_key' backend/config/service-account-key.json)
supabase secrets set GOOGLE_PRIVATE_KEY_BASE64=$(printf "%s" "$GOOGLE_KEY" | base64 | tr -d '\n')
```

### 3. Supabase - Créer le bucket Storage

1. Dans Supabase Dashboard, allez dans **Storage**
2. Cliquez sur **New bucket**
3. Nom : `expenses`
4. Cochez **Public bucket** (optionnel, selon vos besoins)
5. Cliquez sur **Create**

### 4. Supabase - Appliquer la migration

La migration SQL est prête dans `supabase/migrations/20250120000000_create_expense_table.sql`

**Option A : Via Supabase Dashboard**
1. Allez dans **SQL Editor** dans Supabase Dashboard
2. Copiez le contenu de `supabase/migrations/20250120000000_create_expense_table.sql`
3. Collez et exécutez

**Option B : Via Supabase CLI**
```bash
cd "/Users/pierre/CRM codex/crm-codex"
supabase db push
```

**Option C : Via psql**
```bash
psql "postgresql://postgres.oecbrtyeqatieeybjvhj:Q8MZmrqO81PDDnXr@aws-1-eu-west-3.pooler.supabase.com:6543/postgres" < supabase/migrations/20250120000000_create_expense_table.sql
```

### 5. Supabase - Configurer les politiques RLS (Row Level Security)

Dans **Storage** > **Policies** du bucket `expenses`, créez ces politiques :

```sql
-- Upload
CREATE POLICY "Users can upload expense files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expenses');

-- Lecture
CREATE POLICY "Users can view expense files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expenses');

-- Suppression
CREATE POLICY "Users can delete their expense files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'expenses');
```

## 📋 Checklist finale

- [ ] Clé de compte de service Google Cloud téléchargée et chemin configuré
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ajoutée dans `.env`
- [ ] Bucket `expenses` créé dans Supabase Storage
- [ ] Migration SQL appliquée (table `Expense` créée)
- [ ] Politiques RLS configurées pour le bucket `expenses`

## 🧪 Test

Une fois tout configuré :

1. Redémarrez le backend :
```bash
cd backend
npm run start:dev
```

2. Testez l'upload d'une facture via l'interface `/depenses`

## 📝 Notes

- L'Invoice Parser est configuré : `projects/982552445969/locations/eu/processors/bf192fa2f51782b4`
- Vous avez aussi un Form Parser disponible : `projects/982552445969/locations/eu/processors/2846401a13b8f0ec`
- Pour changer de processeur, modifiez `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` dans `.env`

