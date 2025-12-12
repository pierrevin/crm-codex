# Guide d'application de la migration DeboursNote

## ✅ Étape 1 : Appliquer la migration Supabase

### Option A : Via la Console Supabase (RECOMMANDÉ)

1. **Ouvrez votre projet Supabase** :
   - URL : https://supabase.com/dashboard/project/oecbrtyeqatieeybjvhj
   - Ou allez sur https://supabase.com/dashboard et sélectionnez votre projet

2. **Allez dans SQL Editor** :
   - Menu de gauche → **SQL Editor**
   - Cliquez sur **New query**

3. **Copiez-collez le contenu du fichier** `APPLY_DEBOURS_MIGRATION.sql`
   - Ou ouvrez le fichier `supabase/migrations/20250105000000_add_debours_notes.sql`

4. **Exécutez la requête** :
   - Cliquez sur **Run** (ou appuyez sur `Cmd/Ctrl + Enter`)
   - Attendez la confirmation "Success. No rows returned"

5. **Vérifiez que la table existe** :
   - Allez dans **Table Editor**
   - Vous devriez voir la table `DeboursNote` dans la liste

### Option B : Via psql (si vous avez l'accès direct)

```bash
psql "postgresql://postgres:[VOTRE_PASSWORD]@db.oecbrtyeqatieeybjvhj.supabase.co:5432/postgres" -f APPLY_DEBOURS_MIGRATION.sql
```

## ✅ Étape 2 : Vérifier la configuration Google

### Vérifier que Google Docs API est activée

1. **Allez sur Google Cloud Console** :
   - https://console.cloud.google.com/apis/library?project=982552445969

2. **Vérifiez les APIs activées** :
   - Recherchez "Google Docs API" → doit être **ENABLED** ✅
   - Recherchez "Google Drive API" → doit être **ENABLED** ✅

3. **Si elles ne sont pas activées** :
   - Cliquez sur l'API
   - Cliquez sur **ENABLE**

### Vérifier le partage du modèle Google Docs

Le modèle par défaut est : `1Zn5P7uqHnIj_-85-Qh6roVHe2WwCt8gBamEdZYMA7CA`

1. **Ouvrez le document** :
   - https://docs.google.com/document/d/1Zn5P7uqHnIj_-85-Qh6roVHe2WwCt8gBamEdZYMA7CA/edit

2. **Partagez le document** :
   - Cliquez sur **Partager** (en haut à droite)
   - Ajoutez l'email de votre compte Google (celui que vous utilisez dans l'application)
   - Donnez au minimum les droits **Lecteur**
   - Cliquez sur **Envoyer**

3. **Si vous utilisez un compte de service** :
   - Partagez également avec l'email du compte de service
   - Format : `nom-du-compte@982552445969.iam.gserviceaccount.com`

## 🧪 Test après migration

1. **Rechargez votre application**
2. **Créez une note de débours** :
   - Allez sur une opportunité
   - Cliquez sur "Créer une note de débours"
   - Remplissez le formulaire
   - Cliquez sur "Créer et générer le document"

3. **Vérifiez** :
   - La note est créée sans erreur ✅
   - Le document Google Docs est généré dans le dossier de l'opportunité ✅

## ❌ Si vous avez encore l'erreur "Could not find the table"

1. Vérifiez que la migration a bien été exécutée (voir Étape 1)
2. Attendez quelques secondes (le cache Supabase peut prendre quelques instants)
3. Rechargez la page de l'application
4. Si le problème persiste, vérifiez dans **Table Editor** que la table `DeboursNote` existe bien

