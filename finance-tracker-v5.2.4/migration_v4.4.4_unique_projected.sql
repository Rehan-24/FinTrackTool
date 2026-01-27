-- Migration for v4.4.4: Add unique constraint to prevent duplicate projected purchases
-- Run this in your Supabase SQL Editor

-- STEP 1: Find and delete duplicate projected purchases
-- Keep only the oldest one (by created_at) for each unique combination
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY user_id, date, description, category_id, is_projected 
           ORDER BY created_at ASC
         ) as row_num
  FROM public.purchases
  WHERE is_projected = TRUE
)
DELETE FROM public.purchases
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- STEP 2: Add the unique constraint
-- This prevents the same recurring expense from being inserted twice
CREATE UNIQUE INDEX idx_unique_projected_purchase 
ON public.purchases (user_id, date, description, category_id, is_projected)
WHERE is_projected = TRUE;

-- Verify: Check if any duplicates remain (should return 0 rows)
SELECT user_id, date, description, category_id, COUNT(*) as count
FROM public.purchases
WHERE is_projected = TRUE
GROUP BY user_id, date, description, category_id
HAVING COUNT(*) > 1;
