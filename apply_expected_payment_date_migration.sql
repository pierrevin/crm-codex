-- Migration pour ajouter la colonne expectedPaymentDate à la table Opportunity
-- À exécuter dans Supabase SQL Editor

ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "expectedPaymentDate" TIMESTAMP(3);

