# Résolution : Bloqué sur "Initialising login role..."

## 🔍 Solutions à essayer

### Solution 1 : Attendre un peu (30-60 secondes)

Parfois Supabase CLI prend du temps pour initialiser. Attendez 30-60 secondes avant d'annuler.

### Solution 2 : Vérifier le token

Le token Supabase peut être expiré ou invalide.

1. **Vérifiez que le token est bien configuré** :
   ```bash
   echo $SUPABASE_ACCESS_TOKEN
   ```
   Si rien ne s'affiche, le token n'est pas configuré.

2. **Générez un nouveau token** :
   - Allez sur : https://app.supabase.com/account/tokens
   - Cliquez sur "Generate new token"
   - Copiez le nouveau token

3. **Reconfigurez le token** :
   ```bash
   export SUPABASE_ACCESS_TOKEN="VOTRE_NOUVEAU_TOKEN"
   ```

### Solution 3 : Essayer avec --debug

Pour voir plus d'informations sur ce qui bloque :

```bash
supabase db push --include-all --debug
```

Cela affichera plus de détails sur l'erreur.

### Solution 4 : Relier le projet

Parfois la liaison du projet peut être corrompue :

```bash
# Supprimer la liaison existante
rm -rf .supabase

# Relier le projet
supabase link --project-ref oecbrtyeqatieeybjvhj
```

### Solution 5 : Utiliser la méthode SQL Editor (RECOMMANDÉ si CLI bloque)

Si le CLI continue de bloquer, utilisez la méthode manuelle qui est plus fiable :

1. Allez sur : https://supabase.com/dashboard/project/oecbrtyeqatieeybjvhj
2. **SQL Editor** → **New query**
3. Ouvrez le fichier `MIGRATION_SQL_ONLY.sql`
4. Copiez tout le contenu
5. Collez dans l'éditeur SQL
6. Cliquez sur **Run**

Cette méthode est plus directe et évite les problèmes de connexion CLI.

## ⚠️ Si vous êtes vraiment bloqué

**Annulez avec `Ctrl+C`** et utilisez la **Solution 5** (SQL Editor). C'est la méthode la plus fiable et rapide.

