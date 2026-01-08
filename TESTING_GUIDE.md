# Quick Test Guide - v4.4.4

## What Changed?

### Visual Changes
- Dashboard now has **5 summary cards** instead of 4
- New **yellow "Upcoming" card** showing total projected charges
- Layout now matches transactions page better

### Debug Changes
- Added console logging to help diagnose projected purchase issues
- Logs show:
  - Total purchases fetched
  - Count of projected purchases
  - Per-category breakdown with dates
  - Final totals

## How to Test the Fix

1. **Deploy v4.4.4** to your environment
2. **Open browser console** (press F12)
3. **Navigate to Dashboard**
   - You should see 5 cards across the top
   - The 3rd card (yellow background) shows "Upcoming" charges
   - Note the amount displayed
4. **Check console** for `[Dashboard]` logs
5. **Navigate to Transactions** page
   - Look at the middle card (yellow "Upcoming (Projected)")
   - Note the amount displayed
6. **Compare** - these two amounts should match exactly

## If They Don't Match

Check the console logs to see:
- Are there projected purchases with past dates? (shouldn't be any)
- Are categories matching up correctly?
- Are the date calculations working properly?

The logs will show something like:
```
[Dashboard] Today: 2026-01-08
[Dashboard] Category Subscriptions: {
  projected_count: 3,
  projected_amount: 45.97,
  dates: ['2026-01-15', '2026-01-20', '2026-01-28']
}
```

All dates should be >= today's date.

## Removing Debug Logs (Later)

Once you've confirmed everything works, you can remove the console.log statements from:
- `app/dashboard/page.tsx` (lines ~105-140)

Just delete the console.log lines and keep the actual logic.
