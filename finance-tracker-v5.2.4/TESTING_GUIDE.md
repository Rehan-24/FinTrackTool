# Quick Start Guide - v4.4.4

## ⚠️ CRITICAL: You MUST Run Migration First!

Before deploying v4.4.4, you **MUST** run the database migration or duplicates will continue.

### Step 1: Run Migration (REQUIRED)
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Open `migration_v4.4.4_unique_projected.sql` from this repo
4. Copy and paste into SQL Editor
5. Click **Run**

You should see: `Success. No rows returned`

### Step 2: (Optional) Clean Up Existing Duplicates
If you already have duplicates in your database:
```sql
-- See all projected purchases
SELECT * FROM purchases WHERE is_projected = TRUE;

-- Delete ALL projected purchases (they'll regenerate)
DELETE FROM purchases WHERE is_projected = TRUE;
```

### Step 3: Deploy v4.4.4
Deploy the updated code to your environment.

## What Changed?

### Critical Fix
- **Recurring charges no longer duplicate** on page refresh or with multiple tabs
- Added database unique constraint to prevent duplicates at DB level
- Sync function now handles race conditions gracefully

### Visual Changes
- Dashboard now has **5 summary cards** instead of 4
- New **yellow "Upcoming" card** showing total projected charges
- Layout now matches transactions page better

### Debug Changes
- Added console logging to help diagnose issues
- Logs show purchase counts, dates, and totals

## How to Test the Fix

### Test 1: Single Tab Refresh
1. Open your app
2. Note the "Upcoming" amount in the yellow card
3. **Refresh the page 5 times**
4. ✅ Amount should stay the same (not multiply)

### Test 2: Multiple Tabs
1. Open app in Tab 1
2. Open app in Tab 2
3. Both should show same "Upcoming" amount
4. **Refresh both tabs**
5. ✅ Both should still show the same amount

### Test 3: Database Check
1. Open Supabase → Table Editor → purchases
2. Filter: `is_projected = true`
3. Look at the results
4. ✅ Should see NO duplicates (same date + description + category)

## Console Logs

You'll see logs like:
```
[Dashboard] Today: 2026-01-08
[Dashboard] Total purchases fetched: 25
[Dashboard] Projected purchases: 8
[Dashboard] Category Subscriptions: {
  projected_count: 3,
  projected_amount: 45.97,
  dates: ['2026-01-15', '2026-01-20', '2026-01-28']
}
```

**Note:** You might see errors like "duplicate key value violates unique constraint" - **this is normal and means the fix is working!** The app catches these errors gracefully.

## Troubleshooting

### Still seeing duplicates?
1. Verify migration ran in Supabase
2. Delete all projected purchases and refresh
3. Check browser console for errors

### Dashboard and Transactions show different amounts?
1. Check console logs - are dates correct?
2. Make sure both pages are on the same month
3. Verify projected purchases have `date >= today`

### Lots of error messages in console?
If you see "duplicate key value" errors, that's the fix working! The app tries to insert, DB rejects duplicates, app continues. You can ignore these.

## Removing Debug Logs (Later)

Once you've confirmed everything works for a few days:
1. Open `app/dashboard/page.tsx`
2. Find lines with `console.log`
3. Delete those lines (keep the actual logic)

## Summary

1. ✅ Run migration SQL (REQUIRED)
2. ✅ Deploy v4.4.4 code
3. ✅ Test with multiple refreshes
4. ✅ Test with multiple tabs
5. ✅ Monitor for a few days
6. ✅ Remove debug logs when confident
