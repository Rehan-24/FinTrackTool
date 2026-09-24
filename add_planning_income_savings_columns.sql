-- Run this ONCE in the Supabase SQL Editor.
--
-- Adds two editable columns to the Planning page:
--   additional_income  - extra income expected in a month (adds to Gross Income)
--   additional_savings - extra money planned to be set aside (reduces Planned Leftover)
--
-- Both are nullable with no default: NULL means "not set", which the page
-- shows as $0. Until this runs, the page loads normally but saving either
-- field fails.

ALTER TABLE planning_overrides
  ADD COLUMN IF NOT EXISTS additional_income numeric,
  ADD COLUMN IF NOT EXISTS additional_savings numeric;
