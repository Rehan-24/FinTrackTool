-- Migration: Add net_income_override to planning_overrides
-- This allows users to manually override the net income calculation

ALTER TABLE public.planning_overrides 
ADD COLUMN IF NOT EXISTS net_income_override NUMERIC(10, 2);

COMMENT ON COLUMN public.planning_overrides.net_income_override IS 'Manual override for net income (if user wants different net than calculated)';
