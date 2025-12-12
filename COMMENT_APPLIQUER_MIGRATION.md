# Comment appliquer les migrations Supabase

## ❌ Ce qui NE fonctionne PAS

- **Pousser sur Git** → Les migrations ne sont PAS automatiquement appliquées
- **GitHub Actions** → Déploie seulement les Edge Functions, pas les migrations
- **Attendre** → Supabase ne lit pas automatiquement vos fichiers locaux

## ✅ Les 3 méthodes pour appliquer une migration

### Méthode 1 : SQL Editor (RECOMMANDÉ - La plus simple)

**Avantages :** Simple, rapide, pas besoin de configuration

1. Allez sur : https://supabase.com/dashboard/project/oecbrtyeqatieeybjvhj
2. **SQL Editor** → **New query**
3. Ouvrez le fichier `MIGRATION_SQL_ONLY.sql`
4. Copiez tout le contenu
5. Collez dans l'éditeur SQL
6. Cliquez sur **Run**
7. ✅ C'est fait !

**C'est la méthode que vous devriez utiliser maintenant.**

---

### Méthode 2 : Supabase CLI (`supabase db push`)

**Avantages :** Automatique, applique toutes les migrations en attente

**Prérequis :**
- Projet Supabase lié localement
- Token d'accès Supabase configuré

**Étapes :**

1. **Lier le projet** (une seule fois) :
   ```bash
   cd "/Users/pierre/CRM codex/crm-codex"
   export SUPABASE_ACCESS_TOKEN="votre-token"
   supabase link --project-ref oecbrtyeqatieeybjvhj
   ```

2. **Appliquer les migrations** :
   ```bash
   supabase db push
   ```

Cette commande applique **toutes** les migrations du dossier `supabase/migrations/` qui n'ont pas encore été appliquées.

**Obtenir le token :**
- https://app.supabase.com/account/tokens
- Cliquez sur "Generate new token"

---

### Méthode 3 : psql (Connexion directe)

**Avantages :** Contrôle total

```bash
psql "postgresql://postgres.oecbrtyeqatieeybjvhj:[PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:6543/postgres" -f MIGRATION_SQL_ONLY.sql
```

**Note :** Vous devez connaître le mot de passe de la base de données.

---

## 📁 Où sont les fichiers de migration ?

Les fichiers dans `supabase/migrations/` sont pour :
- ✅ La CLI Supabase (`supabase db push`)
- ✅ La documentation
- ❌ PAS pour la console web Supabase (il faut copier-coller le SQL)

## 🎯 Recommandation pour vous

**Maintenant :** Utilisez la **Méthode 1** (SQL Editor) - c'est le plus rapide

**Pour plus tard :** Configurez la **Méthode 2** (CLI) pour automatiser les futures migrations

## 🔍 Vérifier qu'une migration a été appliquée

1. Allez dans **Table Editor** dans Supabase
2. Cherchez la table `DeboursNote`
3. Si elle existe → ✅ Migration appliquée !

