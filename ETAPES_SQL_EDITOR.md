# Étapes pour appliquer la migration via SQL Editor

## 📋 Instructions étape par étape

### 1. Ouvrir Supabase SQL Editor

1. Allez sur : **https://supabase.com/dashboard/project/oecbrtyeqatieeybjvhj**
2. Dans le menu de gauche, cliquez sur **SQL Editor**
3. Cliquez sur le bouton **New query** (ou l'icône `+`)

### 2. Ouvrir le fichier SQL

1. Dans votre éditeur de code (Cursor/VS Code), ouvrez le fichier :
   ```
   MIGRATION_SQL_ONLY.sql
   ```
2. Sélectionnez **TOUT le contenu** :
   - `Cmd+A` (Mac) ou `Ctrl+A` (Windows/Linux)
3. Copiez le contenu :
   - `Cmd+C` (Mac) ou `Ctrl+C` (Windows/Linux)

### 3. Coller dans Supabase

1. Dans l'éditeur SQL de Supabase, cliquez dans la zone de texte
2. Collez le contenu :
   - `Cmd+V` (Mac) ou `Ctrl+V` (Windows/Linux)

### 4. Vérifier le contenu

Le contenu doit commencer par :
```sql
-- Créer l'enum DeboursNoteStatus
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeboursNoteStatus') THEN
        CREATE TYPE "DeboursNoteStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');
    END IF;
END $$;
```

**❌ NE doit PAS contenir :**
- Des lignes avec `psql`
- Des URLs de connexion
- Des commandes shell

### 5. Exécuter

1. Cliquez sur le bouton **Run** (en bas à droite)
   - Ou appuyez sur `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux)
2. Attendez quelques secondes
3. Vous devriez voir : **"Success. No rows returned"** ✅

### 6. Vérifier que ça a fonctionné

1. Dans Supabase, allez dans **Table Editor** (menu de gauche)
2. Cherchez la table **`DeboursNote`** dans la liste
3. Si elle existe → ✅ **Migration réussie !**

## 🎯 Résumé rapide

1. Ouvrir Supabase → SQL Editor → New query
2. Ouvrir `MIGRATION_SQL_ONLY.sql` → Tout sélectionner → Copier
3. Coller dans Supabase SQL Editor
4. Cliquer sur **Run**
5. Vérifier dans Table Editor que `DeboursNote` existe

## ⚠️ Si vous avez une erreur

- **Erreur de syntaxe** : Vérifiez que vous avez bien copié tout le fichier
- **"relation already exists"** : C'est normal, certaines parties existent déjà
- **"type already exists"** : C'est normal, certains types existent déjà

La migration utilise `IF NOT EXISTS` donc elle peut être exécutée plusieurs fois sans problème.

