-- Migration pour ajouter les colonnes d'intégration Google Drive et Tiime
-- Ces colonnes sont définies dans Prisma mais manquantes dans Supabase

-- Ajouter googleDriveFolderId et tiimeId à la table Company
ALTER TABLE "Company" 
  ADD COLUMN IF NOT EXISTS "googleDriveFolderId" TEXT,
  ADD COLUMN IF NOT EXISTS "tiimeId" TEXT;

-- Ajouter les colonnes d'intégration à la table Opportunity
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "googleDriveFolderId" TEXT,
  ADD COLUMN IF NOT EXISTS "tiimeQuoteId" TEXT,
  ADD COLUMN IF NOT EXISTS "quoteUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "tiimeInvoiceIds" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "invoiceUrls" TEXT[] DEFAULT '{}';

-- Créer des index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS "Company_googleDriveFolderId_idx" ON "Company"("googleDriveFolderId");
CREATE INDEX IF NOT EXISTS "Company_tiimeId_idx" ON "Company"("tiimeId");
CREATE INDEX IF NOT EXISTS "Opportunity_googleDriveFolderId_idx" ON "Opportunity"("googleDriveFolderId");
CREATE INDEX IF NOT EXISTS "Opportunity_tiimeQuoteId_idx" ON "Opportunity"("tiimeQuoteId");

