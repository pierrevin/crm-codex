-- ÉTAPE 1 : Vérifier si la colonne existe déjà (requête rapide, ne devrait pas timeout)
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'Expense' 
  AND column_name = 'opportunityId';

-- Si cette requête retourne une ligne, la colonne existe déjà !
-- Si elle ne retourne rien, passez à l'étape 2

-- ÉTAPE 2 : Si la colonne n'existe pas, essayez cette version optimisée
-- (sans IF NOT EXISTS pour éviter les vérifications supplémentaires)
ALTER TABLE "Expense" ADD COLUMN "opportunityId" TEXT;

-- ÉTAPE 3 : Ajouter la foreign key (seulement si l'étape 2 a réussi)
-- Si vous obtenez "constraint already exists", c'est normal, passez à l'étape 4
ALTER TABLE "Expense" 
ADD CONSTRAINT "Expense_opportunityId_fkey" 
FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- ÉTAPE 4 : Créer l'index
CREATE INDEX "Expense_opportunityId_idx" ON "Expense"("opportunityId");
