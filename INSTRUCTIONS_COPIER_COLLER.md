# Instructions : Copier le SQL depuis votre ordinateur

## ⚠️ Important

Le fichier `MIGRATION_SQL_ONLY.sql` est sur **votre ordinateur**, pas dans Supabase !

Vous devez :
1. **Ouvrir le fichier local** dans votre éditeur (Cursor/VS Code)
2. **Copier son contenu**
3. **Coller dans Supabase SQL Editor**

## 📋 Étapes détaillées

### Étape 1 : Ouvrir le fichier local

1. Dans **Cursor** (votre éditeur), ouvrez le fichier :
   ```
   MIGRATION_SQL_ONLY.sql
   ```
   - Il se trouve à la racine du projet : `/Users/pierre/CRM codex/crm-codex/MIGRATION_SQL_ONLY.sql`
   - Ou utilisez `Cmd+P` et tapez "MIGRATION_SQL_ONLY"

### Étape 2 : Sélectionner et copier

1. Dans le fichier ouvert, sélectionnez **TOUT** :
   - `Cmd+A` (sélectionner tout)
2. Copiez :
   - `Cmd+C` (copier)

### Étape 3 : Dans Supabase

1. Dans Supabase SQL Editor, cliquez sur le bouton **"+"** (New query)
   - Ou créez une nouvelle requête vide
2. Cliquez dans la zone d'édition SQL (la grande zone blanche)
3. Collez :
   - `Cmd+V` (coller)

### Étape 4 : Vérifier

Le contenu collé doit commencer par :
```sql
-- Créer l'enum DeboursNoteStatus
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeboursNoteStatus') THEN
        CREATE TYPE "DeboursNoteStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');
    END IF;
END $$;
```

### Étape 5 : Exécuter

1. Cliquez sur le bouton **Run** (en bas à droite)
2. Attendez quelques secondes
3. Vous devriez voir : **"Success. No rows returned"** ✅

## 🎯 Résumé

1. **Cursor** → Ouvrir `MIGRATION_SQL_ONLY.sql` → `Cmd+A` → `Cmd+C`
2. **Supabase** → SQL Editor → `+` (New query) → `Cmd+V` → **Run**

Le fichier n'est PAS dans Supabase, il est sur votre ordinateur !

