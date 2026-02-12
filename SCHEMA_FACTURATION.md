# 📊 Schéma Visuel : Architecture Facturation et Paiements

## Architecture Actuelle (Problématique)

```
Opportunity
├── amount: 30 000€
├── invoiceUrls: ["url-facture-1", "url-facture-2"]
└── Payments[]
    ├── Payment 1: 10 000€ (accompte ?)
    └── Payment 2: 20 000€ (solde ?)

❌ Problème : Impossible de savoir quel paiement correspond à quelle facture
❌ Problème : Trésorerie additionne tous les paiements sans distinction
```

## Architecture Proposée (Solution)

```
Opportunity (30 000€)
│
├── Invoice Acompte (10 000€ TTC)
│   ├── type: ACOMPTE
│   ├── status: PAID
│   ├── invoiceUrl: "url-facture-accompte"
│   └── Payments[]
│       └── Payment 1: 10 000€ ✅
│
└── Invoice Finale (20 000€ TTC)
    ├── type: FINAL
    ├── status: PARTIALLY_PAID
    ├── invoiceUrl: "url-facture-finale"
    └── Payments[]
        ├── Payment 2: 10 000€ ✅
        └── ⏳ Reste: 10 000€

✅ Avantage : Lien explicite facture → paiement
✅ Avantage : Trésorerie peut distinguer acomptes vs finaux
```

## Flux Utilisateur Proposé

### 1. Création Facture dans Tiime

```
Tiime → Webhook Make → CRM
  ├── tiimeInvoiceId: "TI-12345"
  ├── invoiceUrl: "https://tiime.fr/invoice/12345"
  ├── invoiceType: "ACOMPTE" | "FINAL"
  └── invoiceAmount: 10 000€
  
CRM crée automatiquement :
  Invoice {
    type: ACOMPTE,
    amountTTC: 10 000€,
    status: SENT,
    tiimeInvoiceId: "TI-12345",
    invoiceUrl: "..."
  }
```

### 2. Enregistrement Paiement

```
Utilisateur clique "Ajouter un paiement" sur une facture
  ↓
Modal Payment s'ouvre avec :
  - Facture pré-sélectionnée
  - Montant suggéré = reste à payer
  - Validation : ne peut pas payer plus que le reste
  ↓
Paiement créé avec invoiceId
  ↓
Statut facture mis à jour automatiquement :
  - Si reste = 0 → status = PAID
  - Si reste > 0 → status = PARTIALLY_PAID
```

### 3. Calcul Trésorerie

```
TreasuryBalanceService.getCurrentBalance()

Option A (Recommandée) :
  - Compter uniquement paiements de factures FINAL
  - Acomptes = "en attente" (non comptabilisés)

Option B :
  - Compter tous les paiements
  - Distinction visuelle dans l'UI
```

## Vue UI Proposée

### Page Opportunité - Section Facturation

```
┌─────────────────────────────────────────────────────────┐
│ 📄 Facturation                                    [+ Ajouter] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ ┌─ Facture Acompte FAC-2024-001 ────────────────────┐  │
│ │ 💰 10 000€ TTC  |  📅 15/01/2024  |  ✅ Payée      │  │
│ │ 🔗 Lien Tiime   |  📊 100% payé                    │  │
│ │                                                  [💰] │  │
│ │ Paiements :                                         │  │
│ │   • 10 000€ le 15/01/2024                          │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌─ Facture Finale FAC-2024-002 ─────────────────────┐  │
│ │ 💰 20 000€ TTC  |  📅 01/02/2024  |  ⚠️ Partielle  │  │
│ │ 🔗 Lien Tiime   |  📊 50% payé (10 000€ restant)   │  │
│ │                                                  [💰] │  │
│ │ Paiements :                                         │  │
│ │   • 10 000€ le 20/02/2024                          │  │
│ │   ⏳ Reste à payer : 10 000€                        │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                           │
│ 📊 Résumé :                                              │
│   • Total facturé : 30 000€                              │
│   • Total payé : 20 000€                                 │
│   • Reste à payer : 10 000€                              │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Modal Création Facture

```
┌─────────────────────────────────────────────┐
│ Créer une facture                      [✕] │
├─────────────────────────────────────────────┤
│                                             │
│ Type de facture :                           │
│  ○ Acompte                                  │
│  ● Finale                                   │
│                                             │
│ Montant TTC : [20 000] €                    │
│ Taux de taxe : [27] %                       │
│ Montant HT : 15 748€ (calculé automatique)  │
│                                             │
│ Date d'émission : [01/02/2024]              │
│ Date d'échéance : [01/03/2024] (optionnel)  │
│                                             │
│ Numéro de facture :                         │
│ [FAC-2024-002] (auto-généré)                │
│                                             │
│ Lien Tiime (optionnel) :                    │
│ [https://tiime.fr/invoice/...]              │
│                                             │
│ Notes :                                     │
│ [________________________________]          │
│                                             │
│              [Annuler]  [Créer]              │
└─────────────────────────────────────────────┘
```

### Modal Paiement Amélioré

```
┌─────────────────────────────────────────────┐
│ Ajouter un paiement                    [✕] │
├─────────────────────────────────────────────┤
│                                             │
│ Facture :                                   │
│ [Facture Finale FAC-2024-002 ▼]            │
│   Montant facture : 20 000€                 │
│   Déjà payé : 10 000€                       │
│   Reste à payer : 10 000€                   │
│                                             │
│ Montant du paiement :                       │
│ [10 000] €                                  │
│ 💡 Montant suggéré : 10 000€ (reste)       │
│                                             │
│ Date de paiement :                          │
│ [20/02/2024]                                │
│                                             │
│ Taux de taxe :                              │
│ [27] % (depuis la facture)                  │
│                                             │
│ Notes :                                     │
│ [Virement bancaire]                         │
│                                             │
│ ⚠️ Attention : Ce paiement complétera      │
│    la facture (statut → Payée)             │
│                                             │
│              [Annuler]  [Enregistrer]       │
└─────────────────────────────────────────────┘
```

## Calculs Trésorerie

### Option A : Compter uniquement factures finales (Recommandée)

```typescript
// Paiements comptabilisés dans trésorerie
const treasuryPayments = payments.filter(p => 
  !p.invoice || p.invoice.type === 'FINAL'
);

// Paiements d'accomptes (informations seulement)
const advancePayments = payments.filter(p => 
  p.invoice && p.invoice.type === 'ACOMPTE'
);

// Solde trésorerie = baseBalance + treasuryPayments - expenses - taxes
```

### Option B : Compter tous les paiements avec distinction

```typescript
// Tous les paiements comptabilisés
const allPayments = payments;

// Mais avec distinction visuelle :
// - Acomptes : "En attente de facture finale"
// - Finaux : "Comptabilisé dans trésorerie"
```

## Migration des Données

### Étape 1 : Créer les factures depuis invoiceUrls existants

```sql
-- Pour chaque Opportunity avec invoiceUrls
FOR EACH opportunity:
  FOR EACH invoiceUrl IN invoiceUrls:
    CREATE Invoice {
      type: (première facture ? 'ACOMPTE' : 'FINAL'),
      amountTTC: opportunity.amount,
      invoiceUrl: invoiceUrl,
      status: 'SENT'
    }
```

### Étape 2 : Lier les paiements existants

```sql
-- Heuristique : Lier le premier paiement à la première facture
UPDATE Payment
SET invoiceId = (
  SELECT id FROM Invoice 
  WHERE opportunityId = Payment.opportunityId 
  ORDER BY issueDate ASC 
  LIMIT 1
)
WHERE opportunityId IS NOT NULL
```

### Étape 3 : Mettre à jour les statuts

```typescript
// Pour chaque facture créée
FOR EACH invoice:
  totalPaid = SUM(payments WHERE invoiceId = invoice.id)
  
  IF totalPaid >= invoice.amountTTC:
    invoice.status = 'PAID'
  ELSE IF totalPaid > 0:
    invoice.status = 'PARTIALLY_PAID'
  ELSE:
    invoice.status = 'SENT'
```

## États et Transitions

### Statut Facture

```
DRAFT
  ↓ (envoi)
SENT
  ↓ (premier paiement)
PARTIALLY_PAID
  ↓ (paiement complet)
PAID

SENT / PARTIALLY_PAID
  ↓ (date échéance dépassée)
OVERDUE
```

### Type Facture

```
ACOMPTE  → Paiement partiel avant facture finale
FINAL    → Facture de solde ou facture unique
```

## Validation et Contraintes

### Règles Métier

1. **Montant paiement** : Ne peut pas dépasser le reste à payer sur la facture
   - Exception : Option "Autoriser dépassement" pour ajustements

2. **Factures multiples** : 
   - Plusieurs factures d'accomptes possibles
   - Une seule facture finale par opportunité (ou plusieurs si besoin)

3. **Paiements multiples** :
   - Plusieurs paiements possibles sur une même facture
   - Total payé ne peut pas dépasser montant facture (sauf exception)

4. **Statut automatique** :
   - Mis à jour automatiquement lors de chaque paiement
   - Vérification date échéance pour statut OVERDUE

## Intégration Tiime

### Webhook Amélioré

```typescript
POST /api/integrations/make/tiime/invoice

Body {
  opportunityId: string,
  tiimeInvoiceId: string,
  invoiceUrl: string,
  invoiceType: 'ACOMPTE' | 'FINAL',  // NOUVEAU
  invoiceAmount: number,              // NOUVEAU
  invoiceNumber?: string,             // NOUVEAU
  issueDate?: string,                 // NOUVEAU
  dueDate?: string                    // NOUVEAU
}
```

### Comportement

1. Si `tiimeInvoiceId` existe déjà → Mise à jour
2. Sinon → Création nouvelle facture
3. Mise à jour automatique du statut si paiements existent

---

**Document créé le** : 2025-01-XX  
**Version** : 1.0
