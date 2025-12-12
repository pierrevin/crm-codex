# 📋 Logique des Dépenses Récurrentes

## Principe de Fonctionnement

### Architecture en 2 niveaux

1. **`RecurringExpense` (Modèle/Template)**
   - C'est un **modèle** de dépense récurrente
   - Exemple : "Salaire 1500€, mensuel, jour 1"
   - Stocké dans la table `RecurringExpense`
   - **Ne crée PAS directement de dépenses**

2. **`Expense` avec `isForecast: true` (Dépenses prévisionnelles)**
   - Ce sont les **lignes individuelles** générées à partir du modèle
   - Chaque dépense prévisionnelle est une ligne dans la table `Expense`
   - Chaque ligne est **modifiable individuellement**
   - Liée au modèle via `recurringExpenseId`

### Flux de création

```
1. Utilisateur crée une dépense récurrente (modal)
   ↓
2. Création du modèle RecurringExpense
   ↓
3. Génération automatique des dépenses prévisionnelles (Expense avec isForecast=true)
   ↓
4. Chaque dépense prévisionnelle apparaît dans la liste
```

## Champs Importants

### `isActive` (dans RecurringExpense)

- **`true`** : Le modèle peut générer des dépenses prévisionnelles
- **`false`** : Le modèle est désactivé, aucune génération possible
- **Utilité** : Désactiver temporairement sans supprimer le modèle

### `isForecast` (dans Expense)

- **`true`** : C'est une dépense prévisionnelle (générée automatiquement)
- **`false`** : C'est une dépense réelle (saisie manuellement ou validée)

### `recurringExpenseId` (dans Expense)

- Lien vers le modèle `RecurringExpense` qui a généré cette dépense
- Si `NULL`, la dépense n'est pas liée à un modèle récurrent

## Comportements

### Suppression d'une dépense récurrente

**Action** : Supprimer un `RecurringExpense`

**Résultat** :
- ✅ Le modèle est supprimé
- ✅ Les dépenses prévisionnelles **existent toujours** dans `Expense`
- ⚠️ Les dépenses prévisionnelles perdent le lien (`recurringExpenseId` devient `NULL`)
- ℹ️ Les dépenses prévisionnelles restent modifiables individuellement

**Pourquoi ?** Pour préserver l'historique. Si vous supprimez un modèle de salaire, les salaires déjà prévus restent visibles.

### Régénération

**Action** : Générer à nouveau les dépenses prévisionnelles

**Résultat** :
- ✅ Vérifie si une dépense existe déjà pour chaque date
- ✅ Ne crée **PAS de doublons** (si une dépense existe déjà pour une date, elle est ignorée)
- ✅ Crée uniquement les dépenses manquantes

**Exemple** :
- Janvier 2025 : dépense existe déjà → ignorée
- Février 2025 : dépense n'existe pas → créée
- Mars 2025 : dépense existe déjà → ignorée

### Modification d'une dépense prévisionnelle

**Action** : Modifier une `Expense` avec `isForecast: true`

**Résultat** :
- ✅ La dépense prévisionnelle est modifiée individuellement
- ✅ Le modèle `RecurringExpense` **n'est PAS modifié**
- ✅ Les autres dépenses prévisionnelles du même modèle **ne sont PAS affectées**

**Exemple** :
- Modèle : "Salaire 1500€"
- Janvier : 1500€ (généré automatiquement)
- Février : 1500€ (généré automatiquement)
- Vous modifiez Février à 1600€
- → Janvier reste à 1500€
- → Mars sera généré à 1500€ (selon le modèle)

### Validation d'une dépense prévisionnelle

**Action** : Cliquer sur "Vérifier" pour une dépense prévisionnelle

**Résultat** :
- ✅ `isForecast` passe à `false`
- ✅ `status` peut passer à `VERIFIED`
- ✅ La dépense devient une dépense réelle
- ✅ Optionnellement, génère la prochaine dépense prévisionnelle

## Où sont affichées les dépenses prévisionnelles ?

1. **Page Dépenses** : Liste avec badge "Prévisionnel"
2. **Trésorerie** : Incluses dans les prévisions (filtre : `isForecast: true` OU `status: 'VERIFIED'`)
3. **Détail d'une dépense** : Affichage en lecture seule si liée à un modèle récurrent

## Gestion des Modèles Récurrents

**Où modifier/supprimer un modèle ?**
- Page Dépenses → Section "Dépenses récurrentes"
- Bouton "Modifier" : Ouvre un modal pour modifier le modèle
- Bouton "Supprimer" : Supprime le modèle (les dépenses prévisionnelles restent)

**Note** : Modifier un modèle ne modifie PAS les dépenses prévisionnelles déjà générées. Seules les nouvelles générations utiliseront les nouvelles valeurs.

