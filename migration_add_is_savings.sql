-- Migration: Add is_savings flag to categories
-- This allows marking categories as "savings" rather than "spending"

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS is_savings BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.categories.is_savings IS 'If true, purchases in this category count as savings transfers, not spending';

-- Example: Mark your existing "Savings" category
-- UPDATE public.categories SET is_savings = true WHERE name = 'Savings';
