# Legacy Split Payments - Migration Guide

## Problem

You have split payments created before v5.3.0 that don't have individual person tracking. These old splits:
- Don't show up on the Splits page
- Have no names assigned
- Can't be marked as complete individually

## Solution

Run the migration to automatically mark all legacy splits as complete.

## What the Migration Does

**Finds:** All split purchases without `split_payments` entries (pre-v5.3.0)

**Creates:** Completed split_payment records for each person

**Example:**
```
Old split purchase:
- is_split: true
- num_people_owing: 3
- amount_owed_back: $90
- No split_payments entries

Migration creates:
├─ Person 1: $30 (marked paid on purchase date)
├─ Person 2: $30 (marked paid on purchase date)
└─ Person 3: $30 (marked paid on purchase date)

Result: Shows as COMPLETED on Splits page ✓
```

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard
2. Click "SQL Editor"
3. Click "New Query"
4. Copy entire contents of `migration_legacy_splits_complete.sql`
5. Paste into editor
6. Click "Run"
7. Check results:
   ```
   legacy_purchases_updated: 5
   split_payments_created: 15
   ```

### Option 2: Command Line

```bash
# If you have psql installed
psql YOUR_DATABASE_URL -f migration_legacy_splits_complete.sql
```

## What Gets Created

For each legacy split:
- **person_name**: "Person 1", "Person 2", etc.
- **amount_owed**: Evenly divided from amount_owed_back
- **is_paid_back**: true (marked as paid)
- **paid_back_date**: Purchase date (assumes paid on purchase date)

## After Running

**Splits Page:**
- All legacy splits now appear
- Status: COMPLETED
- Shows as green/completed
- Filters to "Completed" section

**Example Display:**
```
┌────────────────────────────────────┐
│ Grocery Split        COMPLETED     │
│ $100.00 • Jan 15, 2026             │
├────────────────────────────────────┤
│ ✓ Person 1           $50.00        │
│   Paid on Jan 15, 2026             │
│ ✓ Person 2           $50.00        │
│   Paid on Jan 15, 2026             │
└────────────────────────────────────┘
```

## Customizing After Migration

If you want to change names:
1. Go to Splits page
2. Click Edit (✏️) next to each person
3. Change "Person 1" → "Sarah"
4. Save

## Edge Cases

**Uneven splits:**
- Migration assumes even split
- If amounts were custom, they'll be evenly divided
- Edit manually after if needed

**No num_people_owing:**
- Defaults to 1 person
- Creates 1 split_payment entry

**No amount_owed_back:**
- Defaults to $0
- Creates entries with $0 amounts

## Verification

After running, check:

```sql
-- See all created legacy entries
SELECT 
  p.description,
  p.date,
  sp.person_name,
  sp.amount_owed,
  sp.is_paid_back,
  sp.paid_back_date
FROM purchases p
JOIN split_payments sp ON sp.purchase_id = p.id
WHERE sp.person_name LIKE 'Person %'
ORDER BY p.date DESC;
```

## Rollback

If you want to undo:

```sql
-- Delete all auto-created legacy splits
DELETE FROM split_payments
WHERE person_name LIKE 'Person %'
  AND is_paid_back = true;
```

Then your old splits will be as they were (without split_payments).

## Alternative: Manual Approach

If you prefer to mark specific splits instead of all:

```sql
-- Mark just one specific purchase as complete
DO $$
DECLARE
  target_purchase_id UUID := 'YOUR_PURCHASE_ID_HERE';
  num_people INT := 2;  -- How many people
  split_amount NUMERIC := 50.00;  -- Amount each owes
BEGIN
  INSERT INTO split_payments (
    purchase_id,
    user_id,
    person_name,
    amount_owed,
    is_paid_back,
    paid_back_date
  )
  SELECT 
    target_purchase_id,
    user_id,
    'Person ' || generate_series(1, num_people),
    split_amount,
    true,
    date
  FROM purchases
  WHERE id = target_purchase_id;
END $$;
```

## Summary

**Quick fix:**
1. Run `migration_legacy_splits_complete.sql` ✓
2. All legacy splits marked complete ✓
3. Show up on Splits page ✓
4. Edit names if desired (optional)

**Safe to run:**
- Only affects purchases without split_payments
- Won't duplicate existing split_payments
- Won't touch new v5.3.0+ splits
- Can be rolled back if needed

Run it and clean up your legacy splits! 🎉
