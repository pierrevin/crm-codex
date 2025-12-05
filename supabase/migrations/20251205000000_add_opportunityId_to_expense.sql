-- Migration pour ajouter la colonne opportunityId à la table Expense
-- Cette migration sera exécutée via Supabase CLI

-- Ajouter la colonne opportunityId si elle n'existe pas
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;

-- Ajouter la foreign key pour Expense -> Opportunity
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Expense_opportunityId_fkey'
    ) THEN
        ALTER TABLE "Expense" 
        ADD CONSTRAINT "Expense_opportunityId_fkey" 
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer l'index pour Expense.opportunityId
CREATE INDEX IF NOT EXISTS "Expense_opportunityId_idx" ON "Expense"("opportunityId");
