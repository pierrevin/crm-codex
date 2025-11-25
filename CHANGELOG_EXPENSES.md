# Changelog - Système de dépenses

## Fonctionnalités implémentées

### ✅ OCR et scan de factures
- Intégration Google Cloud Document AI pour l'extraction OCR
- Support PDF, JPG, PNG
- Upload de fichiers et scan caméra
- Extraction automatique : fournisseur, numéro facture, date, montants HT/TTC/TVA

### ✅ Gestion des dépenses
- Liste des dépenses avec filtres (statut, date, fournisseur)
- Page de détail avec édition complète
- Statuts : PENDING, PROCESSED, VERIFIED, REJECTED
- Suppression de dépenses

### ✅ Validation OCR
- Modal de validation après scan avec aperçu du document
- Modification des données extraites avant création
- Aperçu du document (image/PDF) avec zoom
- Calcul automatique TTC depuis HT et taux TVA

### ✅ Comptes comptables
- Liste complète de 30+ comptes pour entreprises de services
- Sélecteur avec recherche par code ou libellé
- Détection automatique du compte selon le fournisseur
- Intégré dans la fiche dépense et le modal de validation

### ✅ Améliorations UX
- Barre de progression pendant le traitement OCR
- Titre de dépense intelligent (Facture + fournisseur)
- Aperçu du document dans la page de détail avec zoom
- Interface responsive et moderne

### ✅ Sécurité
- Authentification JWT (Supabase) pour toutes les routes
- Vérification de propriété avant modification/suppression
- Upload sécurisé vers Supabase Storage

## Fichiers modifiés/créés

### Backend
- `backend/src/expenses/` - Module complet expenses
- `backend/src/expenses/ocr/document-ai.service.ts` - Service OCR
- `backend/src/expenses/ocr/expense-parser.service.ts` - Parser avec détection comptes
- `backend/src/expenses/storage/supabase-storage.service.ts` - Upload fichiers
- `backend/src/expenses/expenses.controller.ts` - Routes API
- `backend/src/expenses/expenses.service.ts` - Logique métier
- `prisma/schema.prisma` - Modèle Expense

### Frontend
- `frontend/src/pages/ExpensesPage.tsx` - Liste des dépenses
- `frontend/src/pages/ExpenseDetailPage.tsx` - Détail et édition
- `frontend/src/components/ExpenseUploadModal.tsx` - Upload/scan
- `frontend/src/components/ExpenseValidationModal.tsx` - Validation OCR
- `frontend/src/components/AccountCodeSelector.tsx` - Sélecteur comptes
- `frontend/src/services/expensesService.ts` - Service API

## Configuration requise

### Variables d'environnement backend
```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=projects/xxx/locations/eu/processors/xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_STORAGE_BUCKET=expenses
```

### Base de données
- Migration Prisma appliquée pour le modèle Expense
- Bucket Supabase Storage créé avec policies RLS

## Points à tester en production

1. ✅ Upload de fichier PDF/image
2. ✅ Scan caméra (mobile)
3. ✅ Extraction OCR des données
4. ✅ Validation et modification des données OCR
5. ✅ Sélection de compte comptable avec recherche
6. ✅ Édition de dépense
7. ✅ Filtres et recherche dans la liste
8. ✅ Zoom de l'aperçu du document
9. ✅ Calculs automatiques (TTC, TVA)

## Notes
- Le système crée la dépense même si l'OCR échoue (permissions, etc.)
- Les données peuvent être complétées manuellement
- Le compte par défaut est 6267 (Services extérieurs divers)

