# Déploiement des corrections DeboursNote

## 🚀 Déploiement rapide (méthode simple)

### Étape 1 : Vérifier le token Supabase

Dans votre terminal, vérifiez que le token est configuré :

```bash
echo $SUPABASE_ACCESS_TOKEN
```

Si rien ne s'affiche, configurez-le :

```bash
export SUPABASE_ACCESS_TOKEN="votre-token"
```

**Pour obtenir le token :**
1. Allez sur : https://app.supabase.com/account/tokens
2. Cliquez sur "Generate new token"
3. Copiez le token

### Étape 2 : Déployer la fonction API

```bash
cd "/Users/pierre/CRM codex/crm-codex"
supabase functions deploy api --no-verify-jwt
```

Cette commande va :
- Déployer la fonction `api` avec les corrections pour DeboursNote
- Prendre environ 1-2 minutes
- Afficher un message de succès à la fin

### Étape 3 : Vérifier le déploiement

Après le déploiement, vous devriez voir :
```
✅ Deployed Function api
```

## 🧪 Test après déploiement

1. Rechargez votre application
2. Essayez de créer une note de débours
3. L'erreur "Could not find a relationship" devrait être résolue ✅

## ⚠️ Si vous avez des erreurs

### "Access token not found"
- Vérifiez que vous avez bien fait : `export SUPABASE_ACCESS_TOKEN="votre-token"`
- Le token doit être entre guillemets

### "Project not linked"
- Exécutez : `supabase link --project-ref oecbrtyeqatieeybjvhj`

### "Function deployment failed"
- Vérifiez votre connexion internet
- Réessayez la commande

