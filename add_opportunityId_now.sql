-- Maintenant que le processus bloquant est terminé, ajoutez la colonne
-- Exécutez cette commande dans Supabase SQL Editor

ALTER TABLE "Expense" ADD COLUMN "opportunityId" TEXT;

-- Si cela fonctionne, exécutez ensuite :

ALTER TABLE "Expense" 
ADD CONSTRAINT "Expense_opportunityId_fkey" 
FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Expense_opportunityId_idx" ON "Expense"("opportunityId");
