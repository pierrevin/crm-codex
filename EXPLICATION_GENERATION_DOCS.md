# Comment fonctionne la génération de documents Google Docs

## 🔄 Processus actuel

### 1. Création de la note
- Le frontend crée la note via `/api/debours-notes` (POST)
- La note est sauvegardée dans Supabase ✅

### 2. Génération du document (PROBLÈME ICI)
- Le frontend appelle `/api/debours-notes/{id}/generate-doc` (POST)
- **La fonction Edge Supabase retourne une erreur 501** ❌
- Le message dit : "Document generation is handled by the NestJS backend"
- **Mais l'application utilise l'API Supabase, pas le backend NestJS !**

## 📋 Comment ça DEVRAIT fonctionner

### Étape 1 : Copier le template
1. Le système copie le modèle Google Docs (templateId)
2. Le document copié est créé dans le dossier de l'opportunité sur Google Drive

### Étape 2 : Remplacer les placeholders
1. Le système lit le contenu du document copié
2. Il trouve tous les placeholders au format `{{nom_du_placeholder}}`
3. Il les remplace par les valeurs réelles :
   - `{{Date du jour}}` → "07/12/2025"
   - `{{nom_client}}` → "Nom de l'entreprise"
   - `{{titre_note_debours}}` → "Note de débours - ..."
   - etc.

### Étape 3 : Sauvegarder les infos
1. L'ID du document créé est sauvegardé dans `deboursNote.googleDocId`
2. L'URL du document est sauvegardée dans `deboursNote.googleDocUrl`

## ⚠️ Problème actuel

La fonction Edge Supabase n'implémente PAS la génération de documents. Elle retourne juste une erreur 501.

## ✅ Solution

Il faut implémenter la génération de documents dans la fonction Edge Supabase en utilisant les APIs Google Drive et Google Docs.

## 🔍 Vérifications à faire

1. **Vérifier les erreurs dans la console du navigateur**
   - Ouvrez les DevTools (F12)
   - Onglet Console
   - Regardez les erreurs lors de la création d'une note

2. **Vérifier que vous êtes connecté avec Google**
   - Dans l'application, vous devez avoir connecté votre compte Google
   - Le `googleRefreshToken` doit être présent dans la table `User`

3. **Vérifier que le modèle est partagé**
   - Le modèle par défaut : `1Zn5P7uqHnIj_-85-Qh6roVHe2WwCt8gBamEdZYMA7CA`
   - Il doit être partagé avec votre compte Google

