-- One-time cleanup: Remove duplicate recurring purchases
-- Run this ONCE in Supabase SQL Editor to fix existing duplicates

-- This finds and deletes duplicate purchases where:
-- 1. Same user_id, category_id, description, and date
-- 2. Keeps the one with is_projected=false (actual) if it exists
-- 3. Otherwise keeps the oldest one

WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, category_id, description, date 
      ORDER BY 
        -- Keep actual purchases over projected
        CASE WHEN is_projected = false THEN 0 ELSE 1 END,
        -- Then keep oldest
        created_at ASC
    ) as rn
  FROM purchases
  WHERE recurring_expense_id IS NOT NULL
)
DELETE FROM purchases
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE rn > 1
);

-- Verify the cleanup
-- This should return 0 if all duplicates are removed
SELECT 
  user_id, 
  category_id, 
  description, 
  date, 
  COUNT(*) as duplicate_count
FROM purchases
WHERE recurring_expense_id IS NOT NULL
GROUP BY user_id, category_id, description, date
HAVING COUNT(*) > 1;
