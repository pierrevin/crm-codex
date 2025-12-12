-- CreateEnum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuoteStatus') THEN
        CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Quote" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quoteNumber" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "validityEndDate" TIMESTAMP(3),
    "freeField" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "totalHT" DECIMAL(18,2),
    "totalTTC" DECIMAL(18,2),
    "opportunityId" TEXT,
    "companyId" TEXT,
    "tiimeQuoteId" TEXT,
    "quoteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceHT" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2),
    "taxRate" DECIMAL(5,4) NOT NULL,
    "vatExemptionReason" TEXT,
    "totalHT" DECIMAL(18,2) NOT NULL,
    "order" INTEGER NOT NULL,
    "quoteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Quote_opportunityId_fkey'
    ) THEN
        ALTER TABLE "Quote" 
        ADD CONSTRAINT "Quote_opportunityId_fkey" 
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Quote_companyId_fkey'
    ) THEN
        ALTER TABLE "Quote" 
        ADD CONSTRAINT "Quote_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'QuoteItem_quoteId_fkey'
    ) THEN
        ALTER TABLE "QuoteItem" 
        ADD CONSTRAINT "QuoteItem_quoteId_fkey" 
        FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_opportunityId_idx" ON "Quote"("opportunityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_companyId_idx" ON "Quote"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

