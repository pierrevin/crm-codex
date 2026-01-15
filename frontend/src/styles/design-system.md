# Design System - CRM Codex

## Couleurs principales

### Couleur primaire
- **Indigo** : `indigo-600` / `indigo-700` (hover)
- Utilisation : Boutons principaux, liens importants, éléments d'accentuation

### Couleur secondaire
- **Slate** : `slate-200` / `slate-50` (hover)
- Utilisation : Boutons secondaires, bordures, arrière-plans neutres

### Couleur danger
- **Rose** : `rose-600` / `rose-700` (hover) ou `rose-200` / `rose-50` (hover) pour les bordures
- Utilisation : Actions destructives (supprimer, rejeter)

### Couleur succès
- **Emerald** : `emerald-600` / `emerald-700` (hover)
- Utilisation : Actions de validation (vérifier, marquer comme réglé)

### Couleur warning
- **Yellow** : `yellow-100` / `yellow-700`
- Utilisation : Badges d'état "En attente"

## Styles de boutons

### Bouton primaire
```
bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors
```
- Utilisation : Actions principales (créer, enregistrer, valider)

### Bouton secondaire
```
border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors
```
- Utilisation : Actions secondaires (annuler, modifier, voir)

### Bouton danger
```
border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors
```
- Utilisation : Actions destructives (supprimer, rejeter)

### Bouton succès
```
bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors
```
- Utilisation : Actions de validation (vérifier, marquer comme réglé)

### Bouton action inline (petit)
```
rounded-md px-3 py-1.5 text-xs font-medium transition-colors
```
- Variantes de couleurs selon le type d'action
- Utilisation : Actions dans les tableaux, listes compactes

## Tailles de boutons

### Small (sm)
- Padding : `px-3 py-1.5`
- Texte : `text-xs`
- Utilisation : Actions inline, tableaux

### Medium (md) - Par défaut
- Padding : `px-4 py-2`
- Texte : `text-sm`
- Utilisation : Boutons standards

### Large (lg)
- Padding : `px-6 py-3`
- Texte : `text-base`
- Utilisation : Boutons principaux de page

## Badges de statut

### Format standard
```
rounded-full px-2 py-1 text-xs font-medium
```

### Couleurs par statut

- **En attente** : `bg-yellow-100 text-yellow-700`
- **Traité** : `bg-blue-100 text-blue-700`
- **Vérifié** : `bg-green-100 text-green-700`
- **Réglé** : `bg-emerald-100 text-emerald-700`
- **Rejeté** : `bg-red-100 text-red-700`
- **Prévisionnel** : `bg-purple-100 text-purple-700`

## Espacements standards

- **Petit** : `p-2` ou `px-2 py-1`
- **Moyen** : `p-4` ou `px-4 py-2`
- **Grand** : `p-6` ou `px-6 py-3`

## Bordures et ombres

- **Bordures** : `border border-slate-200`
- **Ombres légères** : `shadow-sm`
- **Ombres moyennes** : `shadow`
- **Coins arrondis petits** : `rounded-md`
- **Coins arrondis moyens** : `rounded-lg`
- **Coins arrondis grands** : `rounded-xl`
- **Coins arrondis complets** : `rounded-full` (pour badges)

## Typographie

- **Titres de page** : `text-2xl sm:text-3xl font-bold text-slate-900`
- **Sous-titres** : `text-xl font-semibold text-slate-900`
- **Texte de description** : `text-sm text-slate-500`
- **Texte de corps** : `text-sm text-slate-600`
- **Texte en gras** : `font-medium` ou `font-semibold`

## Composants réutilisables

### Button
- Variantes : `primary`, `secondary`, `danger`, `success`, `warning`
- Tailles : `sm`, `md`, `lg`
- Support des icônes

### Badge
- Variantes : `pending`, `processed`, `verified`, `paid`, `rejected`, `forecast`
- Format standardisé avec couleurs cohérentes

## Règles de libellés

### Actions (infinitif)
- "Voir", "Supprimer", "Vérifier", "Marquer comme réglé", "Modifier", "Créer", "Enregistrer"

### Statuts (participe passé)
- "En attente", "Traité", "Vérifié", "Réglé", "Rejeté"



