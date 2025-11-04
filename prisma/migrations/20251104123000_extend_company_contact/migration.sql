-- Étendre Company et Contact pour aligner avec prisma/schema.prisma

-- COMPANY: colonnes enrichies
ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "externalRef"       TEXT,
  ADD COLUMN IF NOT EXISTS "isIndividual"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "addressStreet"     TEXT,
  ADD COLUMN IF NOT EXISTS "addressZip"        TEXT,
  ADD COLUMN IF NOT EXISTS "addressCity"       TEXT,
  ADD COLUMN IF NOT EXISTS "addressCountry"    TEXT,
  ADD COLUMN IF NOT EXISTS "siret"             TEXT,
  ADD COLUMN IF NOT EXISTS "vatNumber"         TEXT,
  ADD COLUMN IF NOT EXISTS "iban"              TEXT,
  ADD COLUMN IF NOT EXISTS "bic"               TEXT,
  ADD COLUMN IF NOT EXISTS "rum"               TEXT,
  ADD COLUMN IF NOT EXISTS "sepaMandateActive" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "legacyCode"        TEXT,
  ADD COLUMN IF NOT EXISTS "locale"            TEXT,
  ADD COLUMN IF NOT EXISTS "notes"             TEXT,
  ADD COLUMN IF NOT EXISTS "statusClient"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "statusProspect"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "statusSupplier"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ownerId"           TEXT,
  ADD COLUMN IF NOT EXISTS "linkedinUrl"       TEXT,
  ADD COLUMN IF NOT EXISTS "salesNavigatorUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "firstInvoiceDate"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastInvoiceDate"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "turnoverAllTime"   DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "turnoverThisYear"  DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "lastActivityAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextActivityAt"    TIMESTAMP(3);

-- Uniques et FK Company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Company_externalRef_key'
  ) THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_externalRef_key" UNIQUE ("externalRef");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Company_siret_key'
  ) THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_siret_key" UNIQUE ("siret");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Company_ownerId_fkey'
  ) THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CONTACT: colonnes enrichies
ALTER TABLE "Contact"
  ADD COLUMN IF NOT EXISTS "phone"        TEXT,
  ADD COLUMN IF NOT EXISTS "mobilePhone"  TEXT,
  ADD COLUMN IF NOT EXISTS "title"        TEXT,
  ADD COLUMN IF NOT EXISTS "jobTitle"     TEXT,
  ADD COLUMN IF NOT EXISTS "industry"     TEXT,
  ADD COLUMN IF NOT EXISTS "linkedinUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "funnelStep"   TEXT,
  ADD COLUMN IF NOT EXISTS "externalRef"  TEXT;

-- Uniques et FKs Contact
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Contact_email_key'
  ) THEN
    ALTER TABLE "Contact" ADD CONSTRAINT "Contact_email_key" UNIQUE ("email");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Contact_externalRef_key'
  ) THEN
    ALTER TABLE "Contact" ADD CONSTRAINT "Contact_externalRef_key" UNIQUE ("externalRef");
  END IF;
END $$;


