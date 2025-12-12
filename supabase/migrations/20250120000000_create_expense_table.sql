-- CreateEnum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseStatus') THEN
        CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PROCESSED', 'VERIFIED', 'REJECTED');
    END IF;
END $$;

-- CreateTable
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Expense_companyId_fkey'
    ) THEN
        ALTER TABLE "Expense" 
        ADD CONSTRAINT "Expense_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Expense_userId_fkey'
    ) THEN
        ALTER TABLE "Expense" 
        ADD CONSTRAINT "Expense_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_companyId_idx" ON "Expense"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_userId_idx" ON "Expense"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_invoiceDate_idx" ON "Expense"("invoiceDate");

