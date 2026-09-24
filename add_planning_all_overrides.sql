-- Run this ONCE in the Supabase SQL Editor.
--
-- Makes every column on the Planning page editable. Each new column holds a
-- manual value for one month; NULL means "use the calculated value".
-- gross_income_override, net_income_override, budget_override and
-- housing_override already exist and are reused.
--
-- Until this runs, the page loads normally but saving any of these fields
-- fails.

ALTER TABLE planning_overrides
  ADD COLUMN IF NOT EXISTS salary_income_override numeric,
  ADD COLUMN IF NOT EXISTS one_time_income_override numeric,
  ADD COLUMN IF NOT EXISTS taxes_override numeric,
  ADD COLUMN IF NOT EXISTS benefits_override numeric,
  ADD COLUMN IF NOT EXISTS retirement_401k_override numeric,
  ADD COLUMN IF NOT EXISTS roth_override numeric,
  ADD COLUMN IF NOT EXISTS auto_savings_override numeric,
  ADD COLUMN IF NOT EXISTS planned_save_override numeric,
  ADD COLUMN IF NOT EXISTS projected_out_override numeric,
  ADD COLUMN IF NOT EXISTS planned_leftover_override numeric,
  ADD COLUMN IF NOT EXISTS actual_spent_override numeric,
  ADD COLUMN IF NOT EXISTS actual_saved_override numeric,
  ADD COLUMN IF NOT EXISTS actual_leftover_override numeric;
