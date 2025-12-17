-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EffectiveSaleSource') THEN
        CREATE TYPE "EffectiveSaleSource" AS ENUM ('OPPORTUNITY', 'OFF_PIPE');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EffectiveSaleStatus') THEN
        CREATE TYPE "EffectiveSaleStatus" AS ENUM ('CONFIRMED', 'INVOICED', 'PAID');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EffectiveSale" (
    "id" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "EffectiveSaleStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "EffectiveSaleSource" NOT NULL,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "externalRef" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EffectiveSale_pkey" PRIMARY KEY ("id")
);

-- Unique: 1 vente effective matérialisée par opportunité (si utilisée)
-- NB: Postgres autorise plusieurs NULL sur une contrainte UNIQUE, donc c'est compatible avec opportunityId nullable.
CREATE UNIQUE INDEX IF NOT EXISTS "EffectiveSale_opportunityId_unique"
ON "EffectiveSale"("opportunityId");

-- Indexes
CREATE INDEX IF NOT EXISTS "EffectiveSale_effectiveDate_idx" ON "EffectiveSale"("effectiveDate");
CREATE INDEX IF NOT EXISTS "EffectiveSale_companyId_idx" ON "EffectiveSale"("companyId");
CREATE INDEX IF NOT EXISTS "EffectiveSale_createdById_idx" ON "EffectiveSale"("createdById");

-- Foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'EffectiveSale_opportunityId_fkey'
    ) THEN
        ALTER TABLE "EffectiveSale"
        ADD CONSTRAINT "EffectiveSale_opportunityId_fkey"
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'EffectiveSale_companyId_fkey'
    ) THEN
        ALTER TABLE "EffectiveSale"
        ADD CONSTRAINT "EffectiveSale_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'EffectiveSale_createdById_fkey'
    ) THEN
        ALTER TABLE "EffectiveSale"
        ADD CONSTRAINT "EffectiveSale_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

