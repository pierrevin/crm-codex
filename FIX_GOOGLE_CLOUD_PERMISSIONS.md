# Correction des permissions Google Cloud Document AI

## Problème

Erreur : `PERMISSION_DENIED: Permission 'documentai.processors.processOnline' denied`

Le compte de service Google Cloud n'a pas les permissions nécessaires pour utiliser Document AI.

## Solution

### 1. Vérifier le compte de service

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Projet : **crm-codex** (ID: 982552445969)
3. Allez dans **IAM & Admin** > **Service Accounts**
4. Trouvez le compte de service utilisé (celui dont la clé JSON est dans `backend/config/service-account-key.json`)

### 2. Ajouter le rôle nécessaire

1. Cliquez sur le compte de service
2. Allez dans l'onglet **Permissions**
3. Cliquez sur **Grant Access** (ou **Accorder l'accès**)
4. Dans **Add principals**, entrez l'email du compte de service
5. Dans **Select a role**, recherchez et sélectionnez :
   - **Document AI API User** (ou **Document AI API User**)
   - OU **Document AI API > Document AI API User**
6. Cliquez sur **Save**

### 3. Vérifier l'API est activée

1. Allez dans **APIs & Services** > **Enabled APIs**
2. Vérifiez que **Document AI API** est listée et activée
3. Si elle n'est pas activée, allez dans **APIs & Services** > **Library** et activez-la

### 4. Alternative : Utiliser un compte de service avec plus de permissions

Si vous préférez, vous pouvez créer un nouveau compte de service avec le rôle **Editor** (moins sécurisé mais fonctionne à coup sûr) :

1. Créez un nouveau compte de service
2. Attribuez le rôle **Editor**
3. Téléchargez la clé JSON
4. Remplacez le fichier `backend/config/service-account-key.json`
5. Redémarrez le backend

## Test

Une fois les permissions corrigées :

1. Redémarrez le backend
2. Essayez à nouveau d'uploader une facture
3. L'OCR devrait fonctionner et extraire automatiquement les informations

## Note

Le système fonctionne maintenant même si l'OCR échoue : la dépense est créée et vous pouvez remplir les informations manuellement.

