-- Migration: Add category_budget_history table
-- This tracks monthly budget amounts per category so changes only affect future months

CREATE TABLE IF NOT EXISTS public.category_budget_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM' (e.g., '2026-01')
  monthly_budget NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(category_id, month_year) -- One budget per category per month
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_category_budget_history_lookup 
ON public.category_budget_history(category_id, month_year);

-- Comment
COMMENT ON TABLE public.category_budget_history IS 'Tracks monthly budget amounts for each category. Changes only affect current and future months.';

-- Note: The existing categories.monthly_budget column will now represent the "default" budget for new months
