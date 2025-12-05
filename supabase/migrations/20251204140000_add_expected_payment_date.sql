-- Migration pour ajouter la colonne expectedPaymentDate à la table Opportunity
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "expectedPaymentDate" TIMESTAMP(3);

