-- Vérifier si la colonne opportunityId existe déjà dans la table Expense
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Expense' 
  AND column_name = 'opportunityId';

-- Si cette requête retourne une ligne, la colonne existe déjà !
-- Si elle ne retourne rien, la colonne n'existe pas
