# Debug des dépenses récurrentes - Où trouver les logs

## Où voir les logs Supabase Edge Functions

1. **Dashboard Supabase** :
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet
   - Allez dans **Edge Functions** dans le menu de gauche
   - Cliquez sur la fonction **api**
   - Allez dans l'onglet **Logs**

2. **Filtrez les logs** :
   - Cherchez les logs avec `[RECURRING EXPENSES DEBUG]` ou `[PATH DEBUG]`
   - Les logs devraient montrer :
     - `[INITIAL DEBUG]` : URL complète et pathname original
     - `[PATH DEBUG]` : Path après chaque étape de normalisation
     - `[RECURRING EXPENSES DEBUG]` : Vérification si la route correspond

## Ce que vous devriez voir dans les logs

Quand vous créez une dépense récurrente, vous devriez voir :

```
[INITIAL DEBUG] Full URL: https://.../functions/v1/api/recurring-expenses Pathname: /api/recurring-expenses Method: POST
[PATH DEBUG INIT] Original pathname: /api/recurring-expenses Full URL: ...
[PATH DEBUG] After removing /functions/v1/: /api/recurring-expenses (ou rien si déjà enlevé)
[PATH DEBUG] After removing leading /: api/recurring-expenses
[PATH DEBUG] After removing api/: recurring-expenses
[PATH DEBUG] Original pathname: ... Normalized path: recurring-expenses Method: POST
[RECURRING EXPENSES DEBUG] Checking routes - original pathname: ... path: recurring-expenses normalized: recurring-expenses method: POST isRecurringExpensesPath: true ...
[RECURRING EXPENSES POST] Creating recurring expense, userId: ...
```

## Si vous voyez "Not found"

Si vous voyez `[RECURRING EXPENSES DEBUG]` avec `isRecurringExpensesPath: false`, cela signifie que le path n'est pas correctement reconnu.

**Copiez-collez les logs ici** pour que je puisse voir exactement ce qui est reçu et corriger la normalisation.

## Vérification rapide

Vérifiez aussi dans les logs :
- Est-ce que `[RECURRING EXPENSES DEBUG]` apparaît ? (Si non, les routes ne sont pas atteintes)
- Quelle est la valeur de `path` dans `[PATH DEBUG]` ?
- Quelle est la valeur de `isRecurringExpensesPath` dans `[RECURRING EXPENSES DEBUG]` ?
