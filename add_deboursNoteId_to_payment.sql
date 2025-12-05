-- Ajouter la colonne deboursNoteId à la table Payment si elle n'existe pas
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "deboursNoteId" TEXT;

-- Ajouter la foreign key pour Payment -> DeboursNote
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Payment_deboursNoteId_fkey'
    ) THEN
        ALTER TABLE "Payment" 
        ADD CONSTRAINT "Payment_deboursNoteId_fkey" 
        FOREIGN KEY ("deboursNoteId") REFERENCES "DeboursNote"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer l'index pour Payment.deboursNoteId
CREATE INDEX IF NOT EXISTS "Payment_deboursNoteId_idx" ON "Payment"("deboursNoteId");

-- Rendre opportunityId nullable si ce n'est pas déjà le cas
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Payment' 
        AND column_name = 'opportunityId' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "Payment" ALTER COLUMN "opportunityId" DROP NOT NULL;
    END IF;
END $$;
