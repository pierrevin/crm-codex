# Configuration des Notes de Débours

## 🔴 Problème actuel : Table DeboursNote manquante

L'erreur `Could not find the table 'public.DeboursNote' in the schema cache` indique que la migration n'a pas été appliquée dans Supabase.

## ✅ Solution 1 : Appliquer la migration Supabase

### Option A : Via la Console Supabase (Recommandé)

1. Allez sur votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **SQL Editor** (menu de gauche)
3. Cliquez sur **New query**
4. Copiez-collez le contenu du fichier `supabase/migrations/20250105000000_add_debours_notes.sql`
5. Cliquez sur **Run** (ou `Cmd/Ctrl + Enter`)
6. Vérifiez qu'il n'y a pas d'erreur

### Option B : Via la CLI Supabase

```bash
cd crm-codex
supabase db push
```

## 🔧 Configuration Google nécessaire

Pour que la génération de documents Google Docs fonctionne, vous devez configurer :

### 1. Activer les APIs Google nécessaires

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet **crm-codex** (ID: 982552445969)
3. Allez dans **APIs & Services** > **Library**
4. Activez les APIs suivantes si elles ne le sont pas déjà :
   - ✅ **Google Drive API**
   - ✅ **Google Docs API**

### 2. Configurer OAuth2 pour Google Drive

Le système utilise OAuth2 pour accéder à Google Drive au nom de l'utilisateur connecté.

**Vérifications nécessaires :**

1. **Google OAuth Client** doit être configuré avec les scopes :
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/documents`

2. **Variables d'environnement** dans `backend/.env` :
   ```bash
   GOOGLE_CLIENT_ID=votre-client-id
   GOOGLE_CLIENT_SECRET=votre-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   GOOGLE_DRIVE_ROOT_FOLDER_ID=id-du-dossier-racine-drive
   ```

### 3. Partager le modèle Google Docs

**IMPORTANT** : Le modèle de document Google Docs doit être accessible par l'utilisateur qui crée la note de débours.

#### Option A : Modèle par défaut (hardcodé)
Le modèle par défaut est : `1Zn5P7uqHnIj_-85-Qh6roVHe2WwCt8gBamEdZYMA7CA`

**Actions requises :**
1. Ouvrez ce document dans Google Docs
2. Cliquez sur **Partager** (en haut à droite)
3. Assurez-vous que l'utilisateur qui crée les notes de débours a au minimum les droits **Lecteur**
4. Si vous utilisez un compte de service, partagez le document avec l'email du compte de service

#### Option B : Modèle personnalisé
Si vous utilisez un modèle personnalisé (via le champ dans le modal) :

1. Créez votre modèle dans Google Docs
2. Partagez-le avec l'utilisateur qui créera les notes
3. Copiez l'ID du document depuis l'URL :
   ```
   https://docs.google.com/document/d/[ID_DU_MODELE]/edit
   ```
4. Utilisez cet ID dans le champ "Modèle de document" lors de la création

### 4. Vérifier la connexion Google de l'utilisateur

L'utilisateur doit avoir autorisé l'accès à Google Drive :

1. Dans l'application, l'utilisateur doit se connecter avec Google
2. Accepter les permissions pour Google Drive
3. Le `googleRefreshToken` doit être stocké dans la base de données (table `User`)

**Vérification :**
- Allez dans votre base de données Supabase
- Table `User`
- Vérifiez que le champ `googleRefreshToken` n'est pas null pour votre utilisateur

### 5. Structure du modèle Google Docs

Le modèle doit contenir des placeholders au format `{{nom_du_placeholder}}` qui seront remplacés automatiquement :

**Placeholders disponibles :**
- `{{Date du jour}}` - Date actuelle
- `{{nom_client}}` - Nom de l'entreprise cliente
- `{{adresse-client}}` - Adresse de l'entreprise
- `{{code-postal}}` - Code postal
- `{{Ville}}` - Ville
- `{{titre_note_debours}}` - Titre de la note de débours
- `{{date prestation}}` - Date de la prestation
- `{{num_facture}}` - Numéro de facture
- `{{date_facture}}` - Date de facture
- `{{montant_facture}}` - Montant de la facture
- `{{total_frais}}` - Total des frais
- `{{date_frais_1}}`, `{{intitulé_frais_1}}`, `{{montant_frais_1}}` - Premier frais
- `{{date_frais_2}}`, `{{intitulé_frais_2}}`, `{{montant_frais_2}}` - Deuxième frais
- ... (jusqu'à N frais)

## 📋 Checklist de configuration

- [ ] Migration Supabase appliquée (table `DeboursNote` créée)
- [ ] Google Drive API activée
- [ ] Google Docs API activée
- [ ] OAuth2 configuré avec les bons scopes
- [ ] Variables d'environnement Google configurées
- [ ] Modèle Google Docs partagé avec l'utilisateur/compte de service
- [ ] Utilisateur connecté avec Google (refreshToken présent)
- [ ] Dossier racine Google Drive configuré (`GOOGLE_DRIVE_ROOT_FOLDER_ID`)

## 🧪 Test

Une fois tout configuré :

1. Créez une opportunité
2. Ajoutez des dépenses à cette opportunité
3. Cliquez sur "Créer une note de débours"
4. Remplissez le formulaire
5. Optionnellement, entrez un ID de modèle personnalisé
6. Cliquez sur "Créer et générer le document"
7. Le document devrait être créé dans le dossier de l'opportunité sur Google Drive

## ⚠️ Erreurs courantes

### "User has not authorized Google access"
- L'utilisateur n'a pas connecté son compte Google
- Solution : Se connecter avec Google dans l'application

### "Failed to copy template"
- Le modèle n'est pas accessible ou n'existe pas
- Solution : Vérifier que le modèle est partagé et que l'ID est correct

### "Permission denied"
- L'utilisateur n'a pas les permissions sur le modèle
- Solution : Partager le modèle avec l'utilisateur (au minimum en lecture)

### "Could not find the table 'public.DeboursNote'"
- La migration n'a pas été appliquée
- Solution : Appliquer la migration Supabase (voir Solution 1 ci-dessus)

