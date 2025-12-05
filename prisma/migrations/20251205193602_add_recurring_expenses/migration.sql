-- Créer l'enum RecurrenceType
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurrenceType') THEN
        CREATE TYPE "RecurrenceType" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
    END IF;
END $$;

-- Ajouter les colonnes à la table Expense pour les dépenses récurrentes
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "isForecast" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "forecastDate" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "recurringExpenseId" TEXT;

-- Créer la table RecurringExpense
CREATE TABLE IF NOT EXISTS "RecurringExpense" (
    "id" TEXT NOT NULL,
    "supplierName" TEXT,
    "amountHT" DECIMAL(18,2),
    "amountTTC" DECIMAL(18,2),
    "vatAmount" DECIMAL(18,2),
    "vatRate" DECIMAL(5,4),
    "accountCode" TEXT,
    "accountLabel" TEXT,
    "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'MONTHLY',
    "paymentDay" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "companyId" TEXT,
    "userId" TEXT,
    "opportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- Ajouter les foreign keys pour RecurringExpense
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringExpense_companyId_fkey') THEN
        ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringExpense_userId_fkey') THEN
        ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringExpense_opportunityId_fkey') THEN
        ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_opportunityId_fkey" 
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_recurringExpenseId_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringExpenseId_fkey" 
        FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer les index
CREATE INDEX IF NOT EXISTS "RecurringExpense_companyId_idx" ON "RecurringExpense"("companyId");
CREATE INDEX IF NOT EXISTS "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");
CREATE INDEX IF NOT EXISTS "RecurringExpense_opportunityId_idx" ON "RecurringExpense"("opportunityId");
CREATE INDEX IF NOT EXISTS "RecurringExpense_isActive_idx" ON "RecurringExpense"("isActive");
CREATE INDEX IF NOT EXISTS "Expense_recurringExpenseId_idx" ON "Expense"("recurringExpenseId");
CREATE INDEX IF NOT EXISTS "Expense_isForecast_idx" ON "Expense"("isForecast");
