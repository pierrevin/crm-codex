# Appliquer les migrations avec --include-all

## ✅ Solution

Supabase CLI a détecté que vous avez des migrations locales qui doivent être insérées avant la dernière migration sur la base distante.

Exécutez cette commande :

```bash
supabase db push --include-all
```

Cette commande va :
- Appliquer toutes les migrations locales qui n'ont pas encore été appliquées
- Les insérer dans le bon ordre chronologique
- Inclure la migration `20250105000000_add_debours_notes.sql` (DeboursNote)

## 📋 Commandes complètes

```bash
# Si vous n'avez pas encore configuré le token dans cette session
export SUPABASE_ACCESS_TOKEN="VOTRE_TOKEN"

# Appliquer toutes les migrations
supabase db push --include-all
```

## ✅ Résultat attendu

Vous devriez voir quelque chose comme :

```
Applying migration 20250105000000_add_debours_notes.sql...
✅ Applied migration 20250105000000_add_debours_notes.sql
Applying migration 20250120000000_create_expense_table.sql...
✅ Applied migration 20250120000000_create_expense_table.sql
...
```

## 🔍 Vérification

Après l'exécution, vérifiez dans Supabase :
1. Allez sur : https://supabase.com/dashboard/project/oecbrtyeqatieeybjvhj
2. **Table Editor**
3. Vous devriez voir la table **`DeboursNote`** ✅

## ⚠️ Note sur les migrations

Le message indique que ces migrations doivent être insérées avant la dernière migration distante. Le flag `--include-all` permet de forcer l'application de toutes les migrations locales, même si elles ont des timestamps antérieurs à certaines migrations distantes.

