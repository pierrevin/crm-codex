-- ============================================
-- SQL à exécuter directement dans Supabase SQL Editor
-- ============================================
-- Ajouter le statut PAID à l'enum ExpenseStatus
-- Copiez et collez ceci dans l'éditeur SQL de Supabase :

ALTER TYPE "ExpenseStatus" ADD VALUE 'PAID';

-- Si vous obtenez une erreur disant que la valeur existe déjà,
-- c'est normal - cela signifie qu'elle a déjà été ajoutée.
-- Vous pouvez vérifier avec cette requête :

SELECT enumlabel 
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'ExpenseStatus'
ORDER BY e.enumsortorder;


