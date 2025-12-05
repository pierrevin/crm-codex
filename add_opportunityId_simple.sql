-- Version ultra-simplifiée pour éviter le timeout
-- Exécutez UNE SEULE ligne à la fois dans Supabase SQL Editor

-- LIGNE 1 : Ajouter la colonne (sans IF NOT EXISTS pour éviter les vérifications)
ALTER TABLE "Expense" ADD COLUMN "opportunityId" TEXT;

-- Si cette ligne fonctionne, passez à la ligne 2
-- Si vous obtenez "column already exists", c'est bon, la colonne existe déjà

-- LIGNE 2 : Ajouter la foreign key (seulement si la ligne 1 a réussi)
ALTER TABLE "Expense" 
ADD CONSTRAINT "Expense_opportunityId_fkey" 
FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Si vous obtenez "constraint already exists", c'est normal, passez à la ligne 3

-- LIGNE 3 : Créer l'index (seulement si les lignes précédentes ont réussi)
CREATE INDEX "Expense_opportunityId_idx" ON "Expense"("opportunityId");
