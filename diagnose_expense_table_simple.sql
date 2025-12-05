-- Script de diagnostic simplifié pour comprendre le timeout
-- Exécutez ces requêtes UNE PAR UNE dans Supabase SQL Editor

-- 1. Vérifier la taille et le nombre de lignes (requête rapide)
SELECT 
    pg_size_pretty(pg_total_relation_size('"Expense"')) as total_size,
    (SELECT COUNT(*) FROM "Expense") as row_count;

-- 2. Vérifier les locks actifs (version simplifiée)
SELECT 
    l.locktype,
    l.mode,
    l.granted,
    l.pid
FROM pg_locks l
WHERE l.relation = 'Expense'::regclass;

-- 3. Vérifier les transactions actives sur Expense
SELECT 
    pid,
    state,
    LEFT(query, 100) as query_preview,
    now() - query_start as duration
FROM pg_stat_activity
WHERE state != 'idle'
  AND (query LIKE '%Expense%' OR query LIKE '%ALTER%');

-- 4. Vérifier si la colonne opportunityId existe déjà
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'Expense' 
  AND column_name = 'opportunityId';
