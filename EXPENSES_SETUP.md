# Configuration du système de scan de factures et dépenses

Ce document décrit les étapes de configuration nécessaires pour activer le système de scan de factures et dépenses.

## 1. Configuration Google Cloud Document AI

### 1.1 Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Notez l'ID du projet

### 1.2 Activer l'API Document AI

1. Dans la console Google Cloud, allez dans **APIs & Services** > **Library**
2. Recherchez "Document AI API"
3. Cliquez sur **Enable**

### 1.3 Créer un processeur

1. Allez dans **Document AI** > **Processors**
2. Cliquez sur **Create Processor**
3. Sélectionnez le type de processeur :
   - **Invoice Parser** (recommandé pour les factures)
   - **Form Parser** (plus flexible, pour différents types de documents)
4. Choisissez une région (ex: `us` ou `eu`)
5. Donnez un nom au processeur
6. Cliquez sur **Create**
7. Copiez l'ID du processeur (format: `projects/PROJECT_ID/locations/LOCATION/processors/PROCESSOR_ID`)

### 1.4 Créer un compte de service

1. Allez dans **IAM & Admin** > **Service Accounts**
2. Cliquez sur **Create Service Account**
3. Donnez un nom (ex: `document-ai-service`)
4. Cliquez sur **Create and Continue**
5. Attribuez le rôle **Document AI API User**
6. Cliquez sur **Done**
7. Cliquez sur le compte de service créé
8. Allez dans l'onglet **Keys**
9. Cliquez sur **Add Key** > **Create new key**
10. Sélectionnez **JSON**
11. Téléchargez le fichier JSON de la clé

### 1.5 Variables d'environnement

Ajoutez les variables suivantes dans votre fichier `.env` :

```bash
GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/votre/service-account-key.json
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=projects/VOTRE_PROJECT_ID/locations/VOTRE_LOCATION/processors/VOTRE_PROCESSOR_ID
GOOGLE_CLIENT_EMAIL=document-ai-service-account@votre-projet.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Note** : Pour la production, stockez ces valeurs de manière sécurisée (variables d'environnement du serveur, secrets manager, etc.)

## 2. Configuration Supabase Storage

### 2.1 Créer le bucket

1. Allez sur votre projet [Supabase](https://supabase.com/)
2. Allez dans **Storage**
3. Cliquez sur **New bucket**
4. Nommez-le `expenses`
5. Cochez **Public bucket** (optionnel, selon vos besoins de sécurité)
6. Cliquez sur **Create bucket**

### 2.2 Configurer les politiques RLS (Row Level Security)

1. Dans Supabase, allez dans **Storage** > **Policies**
2. Sélectionnez le bucket `expenses`
3. Créez les politiques suivantes :

#### Politique d'upload (INSERT)
```sql
CREATE POLICY "Users can upload expense files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expenses');
```

#### Politique de lecture (SELECT)
```sql
CREATE POLICY "Users can view expense files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expenses');
```

#### Politique de suppression (DELETE)
```sql
CREATE POLICY "Users can delete their expense files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'expenses');
```

### 2.3 Variables d'environnement

Ajoutez les variables suivantes dans votre fichier `.env` :

```bash
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key
SUPABASE_STORAGE_BUCKET=expenses
```

**Note** : 
- `SUPABASE_URL` : Trouvable dans **Settings** > **API** > **Project URL**
- `SUPABASE_SERVICE_ROLE_KEY` : Trouvable dans **Settings** > **API** > **service_role key** (⚠️ Gardez cette clé secrète !)

## 3. Installation des dépendances

### Backend

```bash
cd backend
npm install
```

Les dépendances suivantes seront installées :
- `@google-cloud/documentai` : Pour l'extraction OCR
- `@supabase/supabase-js` : Pour le stockage des fichiers
- `@fastify/multipart` : Pour l'upload de fichiers

### Frontend

Aucune nouvelle dépendance n'est nécessaire, le frontend utilise les dépendances existantes.

## 4. Migration de la base de données

Exécutez la migration pour créer la table `Expense` :

```bash
# Si vous utilisez Prisma
cd crm-codex
npx prisma migrate dev

# Ou si vous utilisez Supabase directement
# La migration SQL est dans supabase/migrations/20250120000000_create_expense_table.sql
```

## 5. Test de l'installation

1. Démarrez le backend :
```bash
cd backend
npm run start:dev
```

2. Démarrez le frontend :
```bash
cd frontend
npm run dev
```

3. Testez l'upload d'une facture :
   - Allez sur `/depenses`
   - Cliquez sur "Nouvelle dépense"
   - Uploadez un fichier PDF ou image de facture
   - Vérifiez que les informations sont extraites correctement

## 6. Dépannage

### Erreur "GOOGLE_DOCUMENT_AI_PROCESSOR_ID not configured"
- Vérifiez que la variable d'environnement `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` est définie
- Vérifiez le format de l'ID (doit commencer par `projects/`)

### Erreur "Failed to upload file to Supabase Storage"
- Vérifiez que le bucket `expenses` existe
- Vérifiez que les politiques RLS sont correctement configurées
- Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est correct

### Erreur d'accès caméra
- Vérifiez que l'application est servie en HTTPS (requis pour l'accès caméra)
- Vérifiez les permissions du navigateur pour l'accès caméra

## 7. Comptes comptables par défaut

Le système détermine automatiquement le compte comptable selon le type de dépense :

- **6251** : Restauration
- **6252** : Hébergement
- **6241** : Transport
- **6061** : Carburant
- **6062** : Fournitures de bureau
- **6261** : Télécommunications
- **606** : Achats non stockés (par défaut)

Ces règles peuvent être modifiées dans `backend/src/expenses/ocr/expense-parser.service.ts`.

## 8. Déploiement de la fonction Edge `expenses`

1. **Créer la fonction** (déjà ajoutée dans `supabase/functions/expenses`)
2. **Déclarer les secrets nécessaires** :
   ```bash
   supabase secrets set \
     SUPABASE_URL=https://votre-projet.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=... \
     SUPABASE_STORAGE_BUCKET=expenses \
     GOOGLE_DOCUMENT_AI_PROCESSOR_ID=projects/.../processors/... \
     GOOGLE_CLIENT_EMAIL=document-ai-service-account@... \
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
3. **Tester en local** :
   ```bash
   supabase functions serve expenses --env-file supabase/.env
   ```
4. **Déployer** :
   ```bash
   supabase functions deploy expenses --project-ref oecbrtyeqatieeybjvhj
   ```
5. **Configurer le frontend** :
   - `VITE_EXPENSES_API_URL=https://oecbrtyeqatieeybjvhj.supabase.co/functions/v1/expenses`
   - ou laisser vide pour utiliser automatiquement `VITE_API_URL + '/expenses'`

