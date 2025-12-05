-- Créer l'enum ExpenseStatus (si n'existe pas déjà)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseStatus') THEN
        CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PROCESSED', 'VERIFIED', 'REJECTED');
    END IF;
END $$;

-- Créer la table Expense
CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL,
    "supplierName" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "amountHT" DECIMAL(18,2),
    "amountTTC" DECIMAL(18,2),
    "vatAmount" DECIMAL(18,2),
    "vatRate" DECIMAL(5,4),
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "rawOcrData" JSONB,
    "accountCode" TEXT,
    "accountLabel" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "companyId" TEXT,
    "userId" TEXT,
    "opportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- Ajouter les colonnes manquantes si la table existait déjà
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "supplierName" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "amountHT" DECIMAL(18,2);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "amountTTC" DECIMAL(18,2);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL(18,2);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,4);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "fileType" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "rawOcrData" JSONB;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "accountCode" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "accountLabel" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Ajouter la colonne status si elle n'existe pas (avec gestion du type enum)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Expense' AND column_name = 'status'
    ) THEN
        ALTER TABLE "Expense" ADD COLUMN "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING';
    END IF;
END $$;

-- Ajouter les foreign keys (simplifié)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_companyId_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_userId_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_opportunityId_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_opportunityId_fkey" 
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer les index
CREATE INDEX IF NOT EXISTS "Expense_companyId_idx" ON "Expense"("companyId");
CREATE INDEX IF NOT EXISTS "Expense_userId_idx" ON "Expense"("userId");
CREATE INDEX IF NOT EXISTS "Expense_opportunityId_idx" ON "Expense"("opportunityId");
CREATE INDEX IF NOT EXISTS "Expense_status_idx" ON "Expense"("status");
CREATE INDEX IF NOT EXISTS "Expense_invoiceDate_idx" ON "Expense"("invoiceDate");
