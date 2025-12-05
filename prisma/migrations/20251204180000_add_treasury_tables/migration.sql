-- AlterEnum: Ajouter FINALIZED à OpportunityStage
ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'FINALIZED';

-- AlterTable: Ajouter taxRate à Opportunity
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,4);

-- CreateTable: Payment
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.27,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TreasuryBalance
CREATE TABLE IF NOT EXISTS "TreasuryBalance" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: TreasuryBalance.date unique
CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryBalance_date_key" ON "TreasuryBalance"("date");

-- AddForeignKey: Payment -> Opportunity
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Payment_opportunityId_fkey'
    ) THEN
        ALTER TABLE "Payment" 
        ADD CONSTRAINT "Payment_opportunityId_fkey" 
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex: Payment.opportunityId
CREATE INDEX IF NOT EXISTS "Payment_opportunityId_idx" ON "Payment"("opportunityId");

-- CreateIndex: Payment.paymentDate
CREATE INDEX IF NOT EXISTS "Payment_paymentDate_idx" ON "Payment"("paymentDate");

