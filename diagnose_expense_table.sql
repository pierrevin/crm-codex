-- Script de diagnostic pour comprendre le timeout
-- Exécutez ces requêtes UNE PAR UNE dans Supabase SQL Editor

-- 1. Vérifier la taille de la table Expense
SELECT 
    pg_size_pretty(pg_total_relation_size('"Expense"')) as total_size,
    pg_size_pretty(pg_relation_size('"Expense"')) as table_size,
    pg_size_pretty(pg_indexes_size('"Expense"')) as indexes_size,
    (SELECT COUNT(*) FROM "Expense") as row_count;

-- 2. Vérifier les locks actifs sur la table Expense
SELECT 
    l.locktype,
    l.relation::regclass,
    l.mode,
    l.granted,
    l.pid,
    a.state,
    a.query_start,
    now() - a.query_start as duration
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation = 'Expense'::regclass
ORDER BY a.query_start;

-- 3. Vérifier les transactions en cours
SELECT 
    pid,
    usename,
    application_name,
    state,
    query,
    query_start,
    now() - query_start as duration
FROM pg_stat_activity
WHERE state != 'idle'
  AND (query LIKE '%Expense%' OR query LIKE '%ALTER%')
ORDER BY query_start;

-- 4. Vérifier les contraintes et index existants sur Expense
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'Expense'::regclass;

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Expense';

-- 5. Vérifier si la colonne opportunityId existe déjà (peut-être créée partiellement)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'Expense'
ORDER BY ordinal_position;
