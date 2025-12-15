-- Migration pour corriger les dépenses récurrentes qui ne sont pas marquées comme prévisionnelles
-- Toutes les dépenses avec un recurringExpenseId doivent être prévisionnelles jusqu'à ce qu'elles soient réglées (PAID)
-- Même les dépenses VERIFIED doivent rester prévisionnelles si elles sont récurrentes

UPDATE "Expense"
SET 
  "isForecast" = true,
  "forecastDate" = COALESCE("forecastDate", "invoiceDate", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE 
  "recurringExpenseId" IS NOT NULL
  AND "isForecast" = false
  AND "status" != 'PAID';

