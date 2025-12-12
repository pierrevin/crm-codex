-- Migration pour ajouter les notes de débours et relations Expense -> Opportunity

-- Créer l'enum DeboursNoteStatus
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeboursNoteStatus') THEN
        CREATE TYPE "DeboursNoteStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');
    END IF;
END $$;

-- Ajouter la colonne opportunityId à Expense si elle n'existe pas
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;

-- Ajouter la foreign key pour Expense -> Opportunity
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Expense_opportunityId_fkey'
    ) THEN
        ALTER TABLE "Expense" 
        ADD CONSTRAINT "Expense_opportunityId_fkey" 
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer l'index pour Expense.opportunityId
CREATE INDEX IF NOT EXISTS "Expense_opportunityId_idx" ON "Expense"("opportunityId");

-- Créer la table DeboursNote
CREATE TABLE IF NOT EXISTS "DeboursNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedPaymentDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "DeboursNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "googleDocId" TEXT,
    "googleDocUrl" TEXT,
    "templateId" TEXT,
    "notes" TEXT,
    "opportunityId" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeboursNote_pkey" PRIMARY KEY ("id")
);

-- Ajouter les foreign keys pour DeboursNote
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'DeboursNote_opportunityId_fkey'
    ) THEN
        ALTER TABLE "DeboursNote" 
        ADD CONSTRAINT "DeboursNote_opportunityId_fkey" 
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'DeboursNote_companyId_fkey'
    ) THEN
        ALTER TABLE "DeboursNote" 
        ADD CONSTRAINT "DeboursNote_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer les index pour DeboursNote
CREATE INDEX IF NOT EXISTS "DeboursNote_opportunityId_idx" ON "DeboursNote"("opportunityId");
CREATE INDEX IF NOT EXISTS "DeboursNote_companyId_idx" ON "DeboursNote"("companyId");

-- Créer la table de liaison many-to-many Expense <-> DeboursNote
CREATE TABLE IF NOT EXISTS "_DeboursNoteToExpense" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Ajouter les foreign keys pour la table de liaison
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = '_DeboursNoteToExpense_A_fkey'
    ) THEN
        ALTER TABLE "_DeboursNoteToExpense" 
        ADD CONSTRAINT "_DeboursNoteToExpense_A_fkey" 
        FOREIGN KEY ("A") REFERENCES "DeboursNote"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = '_DeboursNoteToExpense_B_fkey'
    ) THEN
        ALTER TABLE "_DeboursNoteToExpense" 
        ADD CONSTRAINT "_DeboursNoteToExpense_B_fkey" 
        FOREIGN KEY ("B") REFERENCES "Expense"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer l'index unique pour la table de liaison
CREATE UNIQUE INDEX IF NOT EXISTS "_DeboursNoteToExpense_AB_unique" ON "_DeboursNoteToExpense"("A", "B");
CREATE INDEX IF NOT EXISTS "_DeboursNoteToExpense_B_index" ON "_DeboursNoteToExpense"("B");

-- Modifier Payment pour supporter DeboursNote
DO $$ 
BEGIN
    -- Rendre opportunityId nullable si ce n'est pas déjà fait
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Payment' 
        AND column_name = 'opportunityId' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "Payment" ALTER COLUMN "opportunityId" DROP NOT NULL;
    END IF;
    
    -- Ajouter deboursNoteId si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Payment' 
        AND column_name = 'deboursNoteId'
    ) THEN
        ALTER TABLE "Payment" ADD COLUMN "deboursNoteId" TEXT;
    END IF;
END $$;

-- Ajouter la foreign key pour Payment -> DeboursNote
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Payment_deboursNoteId_fkey'
    ) THEN
        ALTER TABLE "Payment" 
        ADD CONSTRAINT "Payment_deboursNoteId_fkey" 
        FOREIGN KEY ("deboursNoteId") REFERENCES "DeboursNote"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer l'index pour Payment.deboursNoteId
CREATE INDEX IF NOT EXISTS "Payment_deboursNoteId_idx" ON "Payment"("deboursNoteId");

