# URGENT: Fix Duplicate Recurring Purchases

## Problem
If you deployed v5.1.5 and now see duplicate recurring purchases, this is because the old projected purchases weren't fully deleted before regenerating.

## Quick Fix (3 steps)

### Step 1: Run SQL Cleanup
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `cleanup_duplicate_recurring.sql`
3. Click "Run"
4. This removes all duplicates, keeping actual purchases over projected ones

### Step 2: Deploy Updated v5.1.5
The code has been fixed to prevent future duplicates. Just redeploy:
```bash
git add .
git commit -m "Fix duplicate recurring purchases"
git push
```

### Step 3: Verify
1. Refresh your Finance Tracker
2. Check History/Transactions
3. Each recurring expense should appear only once ✅

## What Was Wrong

**The Bug:**
```
Old sync logic:
1. Convert past projected → actual ✅
2. Delete future projected only ❌ (left past projected!)
3. Insert new past as actual → DUPLICATE!
```

**The Fix:**
```
New sync logic:
1. Delete ALL projected (past and future) ✅
2. Regenerate all fresh (past as actual, future as projected) ✅
3. No duplicates! ✅
```

## Manual Cleanup (Alternative)

If you prefer to manually delete duplicates:

1. Go to Transactions or History page
2. For each duplicate:
   - Keep the one that says "Actual" or doesn't have a "Projected" label
   - Delete the duplicate
3. Refresh the page

## Prevention

After running the cleanup and redeploying:
- ✅ No more duplicates will be created
- ✅ Past recurring expenses appear once as actual
- ✅ Future recurring expenses appear once as projected
- ✅ Sync function works correctly

## If You Haven't Deployed v5.1.5 Yet

Skip directly to the latest version in this package - it has the fix already applied!

---

Sorry for the confusion! This fix ensures everything works properly going forward.
