-- Ajouter le statut PAID à l'enum ExpenseStatus
-- IMPORTANT: ALTER TYPE ADD VALUE ne peut pas être exécuté dans un bloc transaction
-- Exécutez directement cette commande dans Supabase SQL Editor si la migration échoue :
-- ALTER TYPE "ExpenseStatus" ADD VALUE 'PAID';

-- Pour les migrations automatiques, on essaie une approche alternative
DO $$ 
BEGIN
    -- Vérifier si PAID existe déjà
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ExpenseStatus' AND e.enumlabel = 'PAID'
    ) THEN
        -- Note: Cette commande doit être exécutée en dehors d'une transaction
        -- Si vous obtenez une erreur, exécutez manuellement dans SQL Editor :
        -- ALTER TYPE "ExpenseStatus" ADD VALUE 'PAID';
        RAISE NOTICE 'Veuillez exécuter manuellement: ALTER TYPE "ExpenseStatus" ADD VALUE ''PAID'';';
    END IF;
END $$;


