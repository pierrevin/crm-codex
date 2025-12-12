# Guide : Appliquer la migration avec Supabase CLI

## 📋 Étape 1 : Obtenir le token Supabase

1. Allez sur : https://app.supabase.com/account/tokens
2. Cliquez sur **"Generate new token"**
3. Donnez-lui un nom (ex: "Migration CLI")
4. **Copiez le token** (vous ne pourrez plus le voir après !)

## 📋 Étape 2 : Ouvrir un terminal

Ouvrez un **nouveau terminal** (Terminal.app ou iTerm) et exécutez :

```bash
# Aller dans le dossier du projet
cd "/Users/pierre/CRM codex/crm-codex"

# Configurer le token (remplacez VOTRE_TOKEN par le token copié)
export SUPABASE_ACCESS_TOKEN="VOTRE_TOKEN"

# Vérifier que le token est bien configuré
echo $SUPABASE_ACCESS_TOKEN
```

## 📋 Étape 3 : Lier le projet Supabase

```bash
supabase link --project-ref oecbrtyeqatieeybjvhj
```

Vous devriez voir quelque chose comme :
```
✅ Linked to project oecbrtyeqatieeybjvhj
```

## 📋 Étape 4 : Appliquer les migrations

```bash
supabase db push
```

Cette commande va :
- Détecter toutes les migrations dans `supabase/migrations/`
- Appliquer celles qui n'ont pas encore été appliquées
- Vous montrer un résumé

## 📋 Étape 5 : Vérifier

1. Allez sur : https://supabase.com/dashboard/project/oecbrtyeqatieeybjvhj
2. Allez dans **Table Editor**
3. Vous devriez voir la table **`DeboursNote`** ✅

## ⚠️ Si vous avez des erreurs

### Erreur : "supabase: command not found"
```bash
# Installer Supabase CLI
brew install supabase/tap/supabase
```

### Erreur : "Project not found"
- Vérifiez que le project-ref est correct : `oecbrtyeqatieeybjvhj`
- Vérifiez que votre token est valide

### Erreur : "Access token not found"
- Vérifiez que vous avez bien fait : `export SUPABASE_ACCESS_TOKEN="votre-token"`
- Le token doit être entre guillemets

## 🔄 Pour les prochaines migrations

Une fois le projet lié, vous pouvez simplement faire :
```bash
cd "/Users/pierre/CRM codex/crm-codex"
supabase db push
```

Le token reste en mémoire dans votre session terminal. Si vous fermez le terminal, vous devrez refaire `export SUPABASE_ACCESS_TOKEN="..."`.

