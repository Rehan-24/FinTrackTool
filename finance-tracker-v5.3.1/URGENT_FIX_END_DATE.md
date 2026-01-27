# URGENT FIX: Recurring Expenses End Date Column

## Problem
Error when adding recurring expenses: `Could not find the 'end_date' column`

## Quick Fix (2 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New query**

### Step 2: Run This SQL
Copy and paste this into the SQL editor:

```sql
ALTER TABLE recurring_expenses 
ADD COLUMN IF NOT EXISTS end_date DATE;
```

### Step 3: Click "Run" or press Ctrl+Enter

### Step 4: Verify
Run this to confirm:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recurring_expenses' 
AND column_name = 'end_date';
```

You should see:
```
column_name | data_type
end_date    | date
```

### Step 5: Test
- Go back to your app
- Try adding a recurring expense
- Should work now! ✅

## What This Does

The `end_date` column allows users to set an optional end date for recurring expenses:
- If set: Recurring expense stops generating after this date
- If null: Continues indefinitely

## Why It Was Missing

The production database was created with an older schema version that didn't include this column. The app code expects it, but it wasn't in the database.

## Rollback (if needed)

If you need to remove the column:
```sql
ALTER TABLE recurring_expenses DROP COLUMN end_date;
```

But this will break the recurring expenses form, so only do this if absolutely necessary.

---

After running the SQL, everything should work! 🚀
