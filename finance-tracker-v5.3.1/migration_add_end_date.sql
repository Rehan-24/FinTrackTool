-- Migration: Add end_date column to recurring_expenses
-- Run this in your Supabase SQL Editor

ALTER TABLE recurring_expenses 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Optional: Add a comment explaining the column
COMMENT ON COLUMN recurring_expenses.end_date IS 'Optional end date for recurring expense. If NULL, continues indefinitely.';
