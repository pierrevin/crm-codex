-- Migration pour ajouter le champ invoiceNumber à la table DeboursNote
-- Ce champ permet de stocker le numéro de facture de la note de débours
-- pour alimenter le placeholder {{num_facture}} dans les templates Google Docs

ALTER TABLE "DeboursNote" 
ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;


