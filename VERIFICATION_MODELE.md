# Vérification du modèle Google Docs

## ✅ Placeholders détectés dans votre modèle

Votre modèle contient les placeholders suivants qui seront remplacés automatiquement :

### Informations client
- `{{nom_client}}` → Nom de l'entreprise cliente
- `{{adresse-client}}` → Adresse de l'entreprise
- `{{code-postal}}` → Code postal
- `{{Ville}}` → Ville

### Informations générales
- `{{Date du jour}}` → Date actuelle (format: JJ/MM/AAAA)

### Informations prestation
- `{{titre_note_debours}}` → Titre de la note de débours
- `{{date prestation}}` → Date de la prestation (closeDate de l'opportunité)
- `{{num_facture}}` → Numéro de facture (premier tiimeInvoiceId)
- `{{date_facture}}` → Date de facture (closeDate de l'opportunité)
- `{{montant_facture}}` → Montant de la facture (format: X,XX)

### Frais individuels (jusqu'à N frais)
- `{{date_frais_1}}` → Date du premier frais
- `{{intitulé_frais_1}}` → Description du premier frais
- `{{montant_frais_1}}` → Montant du premier frais (format: X,XX €)
- `{{date_frais_2}}` → Date du deuxième frais
- `{{intitulé_frais_2}}` → Description du deuxième frais
- `{{montant_frais_2}}` → Montant du deuxième frais (format: X,XX €)
- ... (jusqu'à N frais)

### Totaux
- `{{total_frais}}` → Total des débours (format: X,XX)

## ⚠️ Note sur le "Total général dû"

Dans votre modèle, ligne :
```
Total général dû : {{montant_facture}}  €
```

Ce placeholder sera remplacé par le montant de la facture uniquement. Si vous voulez le total (facture + débours), il faudrait :
1. Soit calculer manuellement dans le modèle
2. Soit ajouter un nouveau placeholder `{{total_general}}` que je peux implémenter

## 🧪 Test

1. **Créez une note de débours** avec des dépenses
2. **Vérifiez dans Google Drive** :
   - Allez dans le dossier de l'opportunité
   - Le document devrait être créé avec le titre de la note
   - Ouvrez-le et vérifiez que tous les placeholders sont remplacés

## 🔍 Si les placeholders ne sont pas remplacés

Vérifiez :
1. Que le modèle est bien partagé avec votre compte Google
2. Que vous êtes connecté avec Google dans l'application
3. Les erreurs dans la console du navigateur (F12)

