-- Migration pour ajouter la colonne opportunityId à la table Expense
-- À exécuter dans Supabase SQL Editor - ÉTAPE PAR ÉTAPE

-- ÉTAPE 1 : Ajouter la colonne opportunityId (exécutez cette ligne seule d'abord)
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;

-- ÉTAPE 2 : Vérifier que la colonne existe (optionnel, pour vérification)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'Expense' AND column_name = 'opportunityId';

-- ÉTAPE 3 : Ajouter la foreign key (exécutez cette ligne seule ensuite)
ALTER TABLE "Expense" 
ADD CONSTRAINT "Expense_opportunityId_fkey" 
FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Si l'erreur "constraint already exists" apparaît, c'est normal, passez à l'étape 4

-- ÉTAPE 4 : Créer l'index (exécutez cette ligne seule en dernier)
CREATE INDEX IF NOT EXISTS "Expense_opportunityId_idx" ON "Expense"("opportunityId");
