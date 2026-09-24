-- Run this ONCE in the Supabase SQL Editor (after add_sheets_table.sql).
--
-- Adds per-sheet formatting to the Sheets page:
--   col_widths - column widths in pixels, keyed by column index, e.g. {"0": 180}
--   fills      - cell fill colors, keyed by cell address, e.g. {"B4": "#FEF08A"}

ALTER TABLE sheets
  ADD COLUMN IF NOT EXISTS col_widths jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fills jsonb NOT NULL DEFAULT '{}'::jsonb;
