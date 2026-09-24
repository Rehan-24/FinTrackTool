-- Run this ONCE in the Supabase SQL Editor.
--
-- Stores the spreadsheets on the Sheets page. Each user can have up to three
-- sheets (slots 1-3). Cell contents are kept as a JSON object keyed by cell
-- address, e.g. {"A1": "Rent", "B1": "1800", "B2": "=SUM(B1:B1)"}.

CREATE TABLE IF NOT EXISTS sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  name text NOT NULL DEFAULT 'Sheet',
  cells jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 50 CHECK (row_count BETWEEN 1 AND 500),
  col_count integer NOT NULL DEFAULT 12 CHECK (col_count BETWEEN 1 AND 52),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One sheet per slot, which caps each user at three sheets
  UNIQUE (user_id, position)
);

ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sheets"
  ON sheets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sheets"
  ON sheets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sheets"
  ON sheets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sheets"
  ON sheets FOR DELETE
  USING (auth.uid() = user_id);
