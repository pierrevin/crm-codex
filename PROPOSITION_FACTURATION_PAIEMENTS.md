# 📋 Analyse et Propositions : Amélioration de la Gestion Facturation et Paiements

## 🔍 Analyse de la Situation Actuelle

### Problème Identifié

**Symptôme** : Lorsqu'un acompte est enregistré, la trésorerie enregistre le paiement comme intégral, ce qui fausse les calculs de trésorerie.

**Cause Racine** : 
- Les factures Tiime sont stockées uniquement comme URLs (`invoiceUrls` dans `Opportunity`)
- Il n'existe pas de modèle `Invoice` dans le CRM
- Aucune distinction entre facture d'accompte et facture finale
- Les paiements sont liés directement à l'opportunité, sans lien explicite avec une facture spécifique
- La trésorerie additionne tous les paiements sans contexte de facture

### Structure Actuelle

#### Modèles de Données Existants

1. **Opportunity** (Opportunité)
   - `tiimeInvoiceIds: String[]` - IDs des factures Tiime
   - `invoiceUrls: String[]` - URLs des factures Tiime
   - `amount: Float?` - Montant total de l'opportunité
   - `taxRate: Decimal?` - Taux de taxe (défaut 27%)

2. **Payment** (Paiement)
   - `opportunityId: String?` - Lien vers l'opportunité
   - `deboursNoteId: String?` - Lien vers note de débours (optionnel)
   - `amount: Decimal` - Montant payé
   - `paymentDate: DateTime` - Date de paiement
   - `taxRate: Decimal` - Taux de taxe appliqué
   - `taxAmount: Decimal` - Montant des taxes
   - `notes: String?` - Notes

3. **TreasuryBalance** (Trésorerie)
   - Calcule le solde en additionnant tous les paiements depuis le dernier solde manuel
   - Ne fait pas de distinction entre acomptes et paiements finaux

#### Flux Actuel

1. **Facturation** (dans Tiime)
   - Création de facture d'accompte ou finale dans Tiime
   - Webhook Make → Enregistre l'URL dans `invoiceUrls` de l'opportunité

2. **Enregistrement Paiement**
   - L'utilisateur clique sur "Ajouter un paiement" dans l'opportunité
   - Modal `MultiplePaymentsModal` permet d'ajouter un ou plusieurs paiements
   - Les paiements sont liés à l'opportunité, pas à une facture spécifique

3. **Calcul Trésorerie**
   - Additionne tous les paiements de toutes les opportunités
   - Ne distingue pas si le paiement correspond à un acompte ou au solde final

### Limitations Identifiées

1. ❌ **Pas de modèle Invoice** : Les factures n'existent que comme URLs
2. ❌ **Pas de distinction acompte/finale** : Impossible de savoir si une facture est un acompte
3. ❌ **Pas de lien facture → paiement** : Les paiements ne sont pas liés à une facture spécifique
4. ❌ **Calcul trésorerie incorrect** : Les acomptes sont comptabilisés comme paiements complets
5. ❌ **Pas de suivi du solde restant** : Difficile de savoir combien reste à payer sur une facture
6. ❌ **UI peu claire** : Pas de vue consolidée factures/paiements

---

## 💡 Propositions de Solution

### Solution Recommandée : Modèle Invoice + Lien Payment → Invoice

#### Architecture Proposée

```
Opportunity
  ├── Invoices[] (nouvelles factures)
  │   ├── type: 'ACOMPTE' | 'FINAL'
  │   ├── amount: montant de la facture
  │   ├── tiimeInvoiceId: ID Tiime
  │   └── invoiceUrl: URL Tiime
  │
  └── Payments[]
      └── invoiceId: lien vers Invoice (optionnel pour rétrocompatibilité)
```

### 1. Nouveau Modèle de Données

#### Modèle `Invoice` (Nouveau)

```prisma
enum InvoiceType {
  ACOMPTE  // Facture d'accompte
  FINAL    // Facture finale/solde
}

enum InvoiceStatus {
  DRAFT           // Brouillon
  SENT            // Envoyée
  PARTIALLY_PAID  // Partiellement payée
  PAID            // Payée intégralement
  OVERDUE         // En retard
}

model Invoice {
  id              String        @id @default(cuid())
  
  // Type et statut
  type            InvoiceType   @default(FINAL)
  status          InvoiceStatus @default(DRAFT)
  
  // Montants
  amountHT        Decimal       @db.Decimal(18, 2) // Montant HT de la facture
  amountTTC       Decimal       @db.Decimal(18, 2) // Montant TTC de la facture
  taxRate         Decimal       @db.Decimal(5, 4) @default(0.27)
  taxAmount       Decimal       @db.Decimal(18, 2) // Calculé
  
  // Dates
  issueDate       DateTime      @default(now()) // Date d'émission
  dueDate         DateTime?     // Date d'échéance
  
  // Informations Tiime
  tiimeInvoiceId  String?       @unique
  invoiceUrl      String?       // URL vers la facture Tiime
  
  // Numéro de facture
  invoiceNumber   String?       // Numéro de facture (ex: FAC-2024-001)
  
  // Relations
  opportunity     Opportunity   @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  opportunityId   String
  
  payments        Payment[]     // Paiements liés à cette facture
  
  // Métadonnées
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  @@index([opportunityId])
  @@index([tiimeInvoiceId])
  @@index([issueDate])
}
```

#### Modification du Modèle `Payment`

```prisma
model Payment {
  id            String      @id @default(cuid())
  
  // Relations (au moins une doit être fournie)
  opportunity   Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  opportunityId String?
  
  invoice       Invoice?    @relation(fields: [invoiceId], references: [id], onDelete: SetNull) // NOUVEAU
  invoiceId     String?     // NOUVEAU : Lien vers la facture
  
  deboursNote   DeboursNote? @relation(fields: [deboursNoteId], references: [id], onDelete: Cascade)
  deboursNoteId String?
  
  // Montants
  amount        Decimal     @db.Decimal(18, 2) // Montant payé
  paymentDate   DateTime    @default(now())
  taxRate       Decimal     @db.Decimal(5, 4) @default(0.27)
  taxAmount     Decimal     @db.Decimal(18, 2)
  
  notes         String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  @@index([opportunityId])
  @@index([invoiceId]) // NOUVEAU
  @@index([deboursNoteId])
  @@index([paymentDate])
}
```

#### Modification du Modèle `Opportunity`

```prisma
model Opportunity {
  // ... champs existants ...
  
  invoices      Invoice[]   // NOUVEAU : Liste des factures
  payments      Payment[]
  
  // Garder pour rétrocompatibilité (déprécié)
  tiimeInvoiceIds String[]   @db.Text
  invoiceUrls     String[]   @db.Text
}
```

### 2. Migration des Données Existantes

#### Script de Migration

```sql
-- 1. Créer les tables Invoice et enum
CREATE TYPE "InvoiceType" AS ENUM ('ACOMPTE', 'FINAL');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL DEFAULT 'FINAL',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amountHT" DECIMAL(18,2) NOT NULL,
    "amountTTC" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.27,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "tiimeInvoiceId" TEXT UNIQUE,
    "invoiceUrl" TEXT,
    "invoiceNumber" TEXT,
    "opportunityId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- 2. Ajouter invoiceId à Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

-- 3. Migrer les factures Tiime existantes
-- Pour chaque opportunité avec invoiceUrls, créer des Invoices
DO $$
DECLARE
    opp RECORD;
    invoice_url TEXT;
    invoice_idx INTEGER;
    opp_amount DECIMAL;
    opp_tax_rate DECIMAL;
BEGIN
    FOR opp IN SELECT id, "invoiceUrls", amount, "taxRate" FROM "Opportunity" 
               WHERE "invoiceUrls" IS NOT NULL AND array_length("invoiceUrls", 1) > 0
    LOOP
        opp_amount := COALESCE(opp.amount, 0);
        opp_tax_rate := COALESCE(opp."taxRate", 0.27);
        
        invoice_idx := 1;
        FOREACH invoice_url IN ARRAY opp."invoiceUrls"
        LOOP
            -- Créer une facture (par défaut FINAL, on pourra ajuster manuellement)
            INSERT INTO "Invoice" (
                id, type, status, "amountHT", "amountTTC", "taxRate", "taxAmount",
                "issueDate", "invoiceUrl", "opportunityId", "invoiceNumber"
            ) VALUES (
                gen_random_uuid()::TEXT,
                CASE WHEN invoice_idx = 1 AND array_length(opp."invoiceUrls", 1) > 1 THEN 'ACOMPTE' ELSE 'FINAL' END,
                'SENT',
                opp_amount / (1 + opp_tax_rate),
                opp_amount,
                opp_tax_rate,
                opp_amount * opp_tax_rate / (1 + opp_tax_rate),
                CURRENT_TIMESTAMP,
                invoice_url,
                opp.id,
                'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(invoice_idx::TEXT, 3, '0')
            );
            
            invoice_idx := invoice_idx + 1;
        END LOOP;
    END LOOP;
END $$;

-- 4. Lier les paiements existants aux factures (heuristique)
-- Si un paiement existe pour une opportunité avec factures, le lier à la première facture
UPDATE "Payment" p
SET "invoiceId" = (
    SELECT i.id 
    FROM "Invoice" i 
    WHERE i."opportunityId" = p."opportunityId" 
    ORDER BY i."issueDate" ASC 
    LIMIT 1
)
WHERE p."opportunityId" IS NOT NULL 
  AND p."invoiceId" IS NULL
  AND EXISTS (
      SELECT 1 FROM "Invoice" i WHERE i."opportunityId" = p."opportunityId"
  );

-- 5. Créer les index
CREATE INDEX IF NOT EXISTS "Invoice_opportunityId_idx" ON "Invoice"("opportunityId");
CREATE INDEX IF NOT EXISTS "Invoice_tiimeInvoiceId_idx" ON "Invoice"("tiimeInvoiceId");
CREATE INDEX IF NOT EXISTS "Invoice_issueDate_idx" ON "Invoice"("issueDate");
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
```

### 3. Améliorations Backend

#### Service Invoice

```typescript
// backend/src/invoices/invoices.service.ts

@Injectable()
export class InvoicesService {
  async create(dto: CreateInvoiceDto) {
    // Calculer les montants
    const taxRate = dto.taxRate ?? 0.27;
    const amountHT = dto.amountTTC / (1 + taxRate);
    const taxAmount = dto.amountTTC - amountHT;
    
    // Déterminer le statut initial
    const status = dto.status ?? 'DRAFT';
    
    const invoice = await this.prisma.invoice.create({
      data: {
        type: dto.type ?? 'FINAL',
        status,
        amountHT,
        amountTTC: dto.amountTTC,
        taxRate,
        taxAmount,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        tiimeInvoiceId: dto.tiimeInvoiceId,
        invoiceUrl: dto.invoiceUrl,
        invoiceNumber: dto.invoiceNumber,
        opportunityId: dto.opportunityId,
        notes: dto.notes
      }
    });
    
    // Mettre à jour le statut automatiquement
    await this.updateInvoiceStatus(invoice.id);
    
    return invoice;
  }
  
  async updateInvoiceStatus(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true }
    });
    
    if (!invoice) return;
    
    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amount), 
      0
    );
    const amountTTC = Number(invoice.amountTTC);
    
    let newStatus: InvoiceStatus;
    if (totalPaid >= amountTTC) {
      newStatus = 'PAID';
    } else if (totalPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    } else {
      newStatus = invoice.status === 'DRAFT' ? 'DRAFT' : 'SENT';
    }
    
    // Vérifier si en retard
    if (newStatus !== 'PAID' && invoice.dueDate) {
      const now = new Date();
      if (now > invoice.dueDate) {
        newStatus = 'OVERDUE';
      }
    }
    
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus }
    });
  }
  
  async findByOpportunity(opportunityId: string) {
    return this.prisma.invoice.findMany({
      where: { opportunityId },
      include: { payments: true },
      orderBy: { issueDate: 'desc' }
    });
  }
}
```

#### Modification du Service Payment

```typescript
// backend/src/payments/payments.service.ts

async create(dto: CreatePaymentDto) {
  // Si invoiceId est fourni, lier le paiement à la facture
  if (dto.invoiceId) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId }
    });
    
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    
    // Utiliser le taxRate de la facture si non fourni
    const taxRate = dto.taxRate ?? Number(invoice.taxRate);
    const taxAmount = dto.amount * taxRate;
    
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: dto.invoiceId,
        opportunityId: invoice.opportunityId, // Automatique depuis la facture
        amount: dto.amount,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        taxRate,
        taxAmount,
        notes: dto.notes
      }
    });
    
    // Mettre à jour le statut de la facture
    await this.invoicesService.updateInvoiceStatus(dto.invoiceId);
    
    return payment;
  }
  
  // Comportement existant pour rétrocompatibilité
  // ...
}
```

#### Modification du Service Treasury

```typescript
// backend/src/treasury/treasury-balance.service.ts

async getCurrentBalance(): Promise<{ balance: number; isManual: boolean; date: Date }> {
  // ... code existant ...
  
  // Calculer les paiements
  const payments = await this.prisma.payment.findMany({
    where: {
      paymentDate: { gte: baseDate, lte: now }
    },
    include: {
      invoice: true // Inclure la facture pour distinguer acomptes
    }
  });
  
  // Filtrer les paiements d'accomptes pour la trésorerie
  // Option 1 : Ne compter que les paiements liés à des factures FINAL
  // Option 2 : Compter tous les paiements mais avec un indicateur
  const finalPayments = payments.filter(p => 
    !p.invoice || p.invoice.type === 'FINAL'
  );
  
  const acomptePayments = payments.filter(p => 
    p.invoice && p.invoice.type === 'ACOMPTE'
  );
  
  // Pour la trésorerie, on peut choisir :
  // - Compter uniquement les factures finales (recommandé)
  // - Ou compter tous les paiements mais avec distinction visuelle
  
  const totalPayments = finalPayments.reduce(
    (sum, p) => sum + Number(p.amount), 
    0
  );
  
  // ... reste du calcul ...
}
```

### 4. Améliorations Frontend

#### Nouveau Composant : InvoiceManagement

```typescript
// frontend/src/components/InvoiceManagement.tsx

interface Invoice {
  id: string;
  type: 'ACOMPTE' | 'FINAL';
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  amountHT: number;
  amountTTC: number;
  taxRate: number;
  issueDate: string;
  dueDate?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  payments: Payment[];
}

export function InvoiceManagement({ 
  opportunityId,
  invoices,
  onRefresh 
}: {
  opportunityId: string;
  invoices: Invoice[];
  onRefresh: () => void;
}) {
  const getTotalPaid = (invoice: Invoice) => {
    return invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  };
  
  const getRemainingAmount = (invoice: Invoice) => {
    return Math.max(0, Number(invoice.amountTTC) - getTotalPaid(invoice));
  };
  
  const getStatusBadge = (invoice: Invoice) => {
    const remaining = getRemainingAmount(invoice);
    const totalPaid = getTotalPaid(invoice);
    
    if (remaining === 0 && totalPaid > 0) {
      return <span className="badge-success">Payée</span>;
    } else if (totalPaid > 0) {
      return <span className="badge-warning">Partiellement payée</span>;
    } else if (invoice.status === 'OVERDUE') {
      return <span className="badge-danger">En retard</span>;
    } else {
      return <span className="badge-info">En attente</span>;
    }
  };
  
  return (
    <div className="invoice-management">
      <div className="header">
        <h2>Factures</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          Ajouter une facture
        </Button>
      </div>
      
      <div className="invoices-list">
        {invoices.map(invoice => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            totalPaid={getTotalPaid(invoice)}
            remaining={getRemainingAmount(invoice)}
            onAddPayment={() => handleAddPayment(invoice)}
            onEdit={() => handleEdit(invoice)}
          />
        ))}
      </div>
      
      {/* Résumé */}
      <InvoiceSummary invoices={invoices} />
    </div>
  );
}
```

#### Modification du Composant PaymentModal

```typescript
// frontend/src/components/PaymentModal.tsx

interface PaymentModalProps {
  invoiceId?: string; // NOUVEAU : Lier le paiement à une facture
  opportunityId?: string; // Pour rétrocompatibilité
  // ...
}

export function PaymentModal({ invoiceId, opportunityId, ... }: PaymentModalProps) {
  // Si invoiceId est fourni, pré-remplir les informations depuis la facture
  useEffect(() => {
    if (invoiceId) {
      loadInvoice(invoiceId).then(invoice => {
        setAmount(invoice.amountTTC - getTotalPaid(invoice));
        setTaxRate(invoice.taxRate);
      });
    }
  }, [invoiceId]);
  
  // ...
}
```

#### Vue Consolidée Factures/Paiements

```typescript
// frontend/src/components/InvoicePaymentTimeline.tsx

// Timeline visuelle montrant :
// - Facture d'accompte → Paiement acompte
// - Facture finale → Paiements finaux
// - Solde restant pour chaque facture
```

### 5. Intégration avec Tiime (Webhook)

```typescript
// backend/src/integrations/make.controller.ts

@Post('invoice')
async invoice(@Headers('x-make-signature') sig: string, @Body() dto: TiimeInvoiceDto) {
  this.verifySecret(sig);
  
  const { opportunityId, tiimeInvoiceId, invoiceUrl, invoiceType, invoiceAmount } = dto;
  
  // Créer ou mettre à jour l'invoice
  const existingInvoice = await this.prisma.invoice.findUnique({
    where: { tiimeInvoiceId }
  });
  
  if (existingInvoice) {
    // Mettre à jour
    await this.prisma.invoice.update({
      where: { id: existingInvoice.id },
      data: {
        invoiceUrl,
        type: invoiceType ?? 'FINAL',
        amountTTC: invoiceAmount ?? existingInvoice.amountTTC
      }
    });
  } else {
    // Créer nouvelle facture
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId }
    });
    
    if (!opportunity) return { status: 'ignored' };
    
    await this.invoicesService.create({
      opportunityId,
      tiimeInvoiceId,
      invoiceUrl,
      type: invoiceType ?? 'FINAL',
      amountTTC: invoiceAmount ?? opportunity.amount ?? 0,
      taxRate: opportunity.taxRate ?? 0.27,
      status: 'SENT'
    });
  }
  
  return { status: 'ok' };
}
```

---

## 🎨 Propositions UI/UX

### 1. Vue Factures dans OpportunityDetailPage

**Section "Facturation"** avec :
- Liste des factures (accomptes + finales)
- Pour chaque facture :
  - Type (badge Acompte/Finale)
  - Montant TTC
  - Statut (Payée/Partielle/En attente)
  - Paiements associés (expandable)
  - Bouton "Ajouter un paiement" sur la facture
  - Lien vers facture Tiime

### 2. Modal Création Facture

- Type : Radio Acompte / Finale
- Montant HT/TTC avec calcul automatique
- Date d'émission / Date d'échéance
- Lien Tiime (optionnel)
- Numéro de facture (auto-généré ou manuel)

### 3. Amélioration Modal Paiement

- Sélection de la facture (dropdown)
- Montant suggéré = reste à payer sur la facture
- Affichage du contexte : "Paiement pour Facture FAC-2024-001 (Acompte)"
- Validation : empêcher de payer plus que le montant restant

### 4. Dashboard Trésorerie Amélioré

- Distinction visuelle entre :
  - Paiements d'accomptes (en attente de facture finale)
  - Paiements finaux (comptabilisés dans trésorerie)
- Graphique montrant les acomptes vs paiements finaux
- Alertes pour factures en retard

### 5. Vue Consolidée Factures/Paiements

Timeline visuelle :
```
📄 Facture Acompte FAC-2024-001 (10 000€)
   └─ 💰 Paiement 10 000€ le 15/01/2024 ✅
   
📄 Facture Finale FAC-2024-002 (20 000€)
   ├─ 💰 Paiement 10 000€ le 20/02/2024 ✅
   └─ ⏳ Reste à payer : 10 000€
```

---

## 📊 Avantages de la Solution

### ✅ Résolution du Problème Principal

- **Trésorerie correcte** : Seuls les paiements de factures finales comptent dans la trésorerie
- **Suivi clair** : Distinction visuelle entre acomptes et paiements finaux
- **Traçabilité** : Lien explicite facture → paiement

### ✅ Améliorations Supplémentaires

1. **Meilleure organisation** : Factures structurées avec statuts
2. **Alertes automatiques** : Factures en retard détectées automatiquement
3. **Calculs automatiques** : Statut facture mis à jour automatiquement
4. **Rétrocompatibilité** : Les paiements existants continuent de fonctionner
5. **Évolutivité** : Facile d'ajouter d'autres types de factures (avoir, crédit, etc.)

### ✅ Expérience Utilisateur

- Interface plus claire et intuitive
- Moins d'erreurs (validation des montants)
- Vue d'ensemble améliorée
- Workflow naturel : Facture → Paiement

---

## 🚀 Plan d'Implémentation

### Phase 1 : Modèle de Données (1-2 jours)
1. Créer les migrations Prisma
2. Créer les modèles Invoice
3. Migrer les données existantes
4. Tests de migration

### Phase 2 : Backend (2-3 jours)
1. Créer `InvoicesService`
2. Modifier `PaymentsService` pour supporter `invoiceId`
3. Modifier `TreasuryBalanceService` pour distinguer acomptes
4. Mettre à jour les endpoints API
5. Tests unitaires

### Phase 3 : Frontend - Composants de Base (2-3 jours)
1. Créer `InvoiceManagement` component
2. Créer `InvoiceCard` component
3. Créer `CreateInvoiceModal`
4. Modifier `PaymentModal` pour supporter `invoiceId`
5. Tests UI

### Phase 4 : Intégration (1-2 jours)
1. Intégrer dans `OpportunityDetailPage`
2. Mettre à jour `RevenueTable` pour utiliser Invoices
3. Améliorer `TreasuryPage` avec distinction acomptes
4. Mettre à jour webhook Tiime

### Phase 5 : Tests et Refinement (1-2 jours)
1. Tests end-to-end
2. Correction des bugs
3. Amélioration UX basée sur retours
4. Documentation

**Total estimé : 7-12 jours de développement**

---

## 🔄 Alternatives Considérées

### Alternative 1 : Flag `isAdvancePayment` sur Payment

**Avantages** :
- Plus simple à implémenter
- Pas besoin de nouveau modèle

**Inconvénients** :
- Pas de lien explicite facture → paiement
- Difficile de gérer plusieurs factures par opportunité
- Pas de suivi du statut des factures

### Alternative 2 : Utiliser le champ `notes` pour stocker le type

**Avantages** :
- Aucune migration nécessaire

**Inconvénients** :
- Pas structuré
- Difficile à requêter
- Pas fiable

**Conclusion** : La solution proposée (modèle Invoice) est la plus robuste et évolutive.

---

## 📝 Notes Importantes

1. **Rétrocompatibilité** : Les champs `tiimeInvoiceIds` et `invoiceUrls` dans `Opportunity` sont conservés pour la migration, mais dépréciés.

2. **Migration progressive** : Les paiements existants sans `invoiceId` continuent de fonctionner. On peut les migrer progressivement.

3. **Tiime** : Le webhook Tiime devra être mis à jour pour envoyer le type de facture (accompte/finale) et le montant.

4. **Validation** : Empêcher de payer plus que le montant restant sur une facture (avec option de dépassement si nécessaire).

5. **Calculs automatiques** : Le statut des factures est mis à jour automatiquement lors de l'ajout/modification/suppression de paiements.

---

## ❓ Questions à Clarifier

1. **Comportement trésorerie** : Compter uniquement les factures finales ou tous les paiements avec distinction visuelle ?
2. **Factures multiples** : Combien de factures d'accomptes maximum par opportunité ?
3. **Paiements partiels** : Permettre plusieurs paiements sur une même facture ?
4. **Factures d'avoir** : Prévoir ce cas dès maintenant ou plus tard ?

---

**Document créé le** : 2025-01-XX  
**Version** : 1.0  
**Auteur** : Analyse CRM Codex
