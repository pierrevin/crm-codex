-- Vérifier les locks sur la table Expense (version corrigée)
-- PostgreSQL est case-sensitive, il faut utiliser le bon format

SELECT 
    l.locktype,
    l.mode,
    l.granted,
    l.pid
FROM pg_locks l
WHERE l.relation = '"Expense"'::regclass;

-- Alternative si la première ne fonctionne pas :
SELECT 
    l.locktype,
    l.mode,
    l.granted,
    l.pid
FROM pg_locks l
JOIN pg_class c ON l.relation = c.oid
WHERE c.relname = 'Expense';
