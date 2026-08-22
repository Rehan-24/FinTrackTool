-- Run this ONCE in the Supabase SQL Editor.
--
-- Fixes: deleting a recurring-generated transaction from the Transactions
-- page only removed that one row. The next time the dashboard synced
-- recurring purchases, it re-created the same occurrence because the
-- generator only checked "does a purchase row exist right now" — it had
-- no memory that the user had already deleted it.
--
-- This table records "this specific occurrence of this recurring expense
-- was explicitly removed" so the generator can skip it permanently,
-- instead of just checking for the row's current existence.

CREATE TABLE IF NOT EXISTS deleted_recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_expense_id uuid NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_expense_id, occurrence_date)
);

ALTER TABLE deleted_recurring_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deleted occurrences"
  ON deleted_recurring_occurrences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deleted occurrences"
  ON deleted_recurring_occurrences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deleted occurrences"
  ON deleted_recurring_occurrences FOR DELETE
  USING (auth.uid() = user_id);
