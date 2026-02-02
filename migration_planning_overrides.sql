-- Migration: Add planning_overrides table for financial planning
-- This stores user overrides for planning scenarios

CREATE TABLE IF NOT EXISTS public.planning_overrides (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  
  -- Editable planning fields
  gross_income_override NUMERIC(10, 2),
  housing_override NUMERIC(10, 2),
  budget_override NUMERIC(10, 2),
  additional_expenses NUMERIC(10, 2) DEFAULT 0,
  
  -- Optional notes
  housing_notes TEXT,
  additional_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(user_id, month_year)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_planning_user_month 
ON public.planning_overrides(user_id, month_year);

-- Comment
COMMENT ON TABLE public.planning_overrides IS 'Stores user overrides for financial planning projections';

-- Update function for updated_at
CREATE OR REPLACE FUNCTION public.update_planning_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_planning_overrides_updated_at
  BEFORE UPDATE ON public.planning_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_planning_overrides_updated_at();
