# Instructions pour appliquer la migration

## ❌ Erreur que vous avez eue

Vous avez copié la commande `psql` au lieu du contenu SQL. Dans Supabase SQL Editor, vous devez copier **UNIQUEMENT le SQL**, pas les commandes shell.

## ✅ Solution : Étapes correctes

### 1. Ouvrez Supabase SQL Editor

1. Allez sur : https://supabase.com/dashboard/project/oecbrtyeqatieeybjvhj
2. Cliquez sur **SQL Editor** dans le menu de gauche
3. Cliquez sur **New query**

### 2. Copiez le SQL

**Option A : Depuis le fichier `MIGRATION_SQL_ONLY.sql`**
- Ouvrez le fichier `MIGRATION_SQL_ONLY.sql` dans votre éditeur
- Sélectionnez **TOUT le contenu** (Cmd+A / Ctrl+A)
- Copiez (Cmd+C / Ctrl+C)

**Option B : Depuis `APPLY_DEBOURS_MIGRATION.sql`**
- Ouvrez le fichier `APPLY_DEBOURS_MIGRATION.sql`
- Copiez **à partir de la ligne 4** (ignorez les 3 premières lignes de commentaires)
- Copiez jusqu'à la fin (ligne 159)

### 3. Collez dans Supabase

1. Dans l'éditeur SQL de Supabase, **collez** le contenu (Cmd+V / Ctrl+V)
2. **Vérifiez** qu'il n'y a PAS de ligne commençant par `psql` ou contenant une URL de connexion
3. Le contenu doit commencer par `-- Créer l'enum DeboursNoteStatus` ou `DO $$`

### 4. Exécutez

1. Cliquez sur le bouton **Run** (ou appuyez sur `Cmd+Enter` / `Ctrl+Enter`)
2. Attendez quelques secondes
3. Vous devriez voir : **"Success. No rows returned"** ✅

### 5. Vérifiez

1. Allez dans **Table Editor** (menu de gauche)
2. Vous devriez voir la table **`DeboursNote`** dans la liste ✅

## 📋 Contenu à copier (exemple du début)

Le contenu que vous devez copier doit ressembler à ça :

```sql
-- Créer l'enum DeboursNoteStatus
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeboursNoteStatus') THEN
        CREATE TYPE "DeboursNoteStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');
    END IF;
END $$;
...
```

**❌ NE COPIEZ PAS ça :**
```bash
psql "postgresql://..."
```

## 🎯 Résumé

1. Ouvrez `MIGRATION_SQL_ONLY.sql`
2. Copiez tout le contenu
3. Collez dans Supabase SQL Editor
4. Cliquez sur Run
5. C'est fait ! ✅

