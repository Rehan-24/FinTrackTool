# Split Payment Tracking - Setup Guide (v5.3.0)

## Overview

v5.3.0 introduces a comprehensive split payment tracking system that lets you track who owes you money, how much they owe, and whether they've paid you back.

## Setup Required

### Step 1: Run Migration

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Copy and paste from migration_split_payments.sql
```

This creates the `split_payments` table to track individual people and amounts.

### Step 2: Deploy Code

```bash
git add .
git commit -m "v5.3.0: Split payment tracking system"
git push
```

## How It Works

### Creating a Split Payment

**Before (v5.2.5 and earlier):**
```
1. Enable "Split Payment"
2. Enter number of people
3. System calculates even split
4. That's it - no names tracked
```

**After (v5.3.0):**
```
1. Enable "Split Payment"
2. Enter number of people (e.g., 3)
3. See fields for 2 people (excluding you):
   ├─ Person 1: Name + Amount
   └─ Person 2: Name + Amount
4. Enter names (e.g., "Sarah", "Mike")
5. Choose split type:
   ├─ Even split: Amounts auto-calculated
   └─ Custom split: Enter custom amounts
6. Save - names and amounts tracked!
```

### Example: Dinner with Friends

**Scenario:**
- Total bill: $90
- 3 people: You, Sarah, Mike
- Even split: $30 each

**Creating the transaction:**
```
Description: "Dinner at Italian Restaurant"
Amount: $90
Split Payment: ON
Number of People: 3

Person fields appear:
├─ Name: Sarah    Amount: $30.00 (auto)
└─ Name: Mike     Amount: $30.00 (auto)

Save → Split tracking created!
```

### Viewing Splits Page

Navigate to **Splits** in the menu to see:

**Summary Cards:**
- Total Splits: 5
- Completed: 2
- Still Owed: $125.00

**Transaction Cards:**
Each shows:
- Transaction name & date
- Total amount
- Category
- Status badge (Open/Completed)
- List of people who owe
- Amount per person
- Checkboxes to mark paid

**Example Card:**
```
┌─────────────────────────────────────┐
│ Dinner at Italian Restaurant   OPEN │
│ Jan 15, 2026 • Dining           $90 │
├─────────────────────────────────────┤
│ ☐ Sarah                       $30.00│
│ ☐ Mike                        $30.00│
├─────────────────────────────────────┤
│ Still Owed:                   $60.00│
└─────────────────────────────────────┘
```

### Marking Payments

**To mark someone as paid:**
1. Click the circle next to their name
2. Circle turns green with checkmark ✓
3. Amount shows strikethrough
4. Paid date recorded
5. "Still Owed" updates automatically

**Example after Sarah pays:**
```
┌─────────────────────────────────────┐
│ Dinner at Italian Restaurant   OPEN │
│ Jan 15, 2026 • Dining           $90 │
├─────────────────────────────────────┤
│ ✓ Sarah                      $30.00 │
│   Paid on Jan 20, 2026              │
│ ☐ Mike                        $30.00│
├─────────────────────────────────────┤
│ Still Owed:                   $30.00│
└─────────────────────────────────────┘
```

**When all paid:**
```
┌─────────────────────────────────────┐
│ Dinner at Italian Restaurant COMPLETE│
│ Jan 15, 2026 • Dining           $90 │
├─────────────────────────────────────┤
│ ✓ Sarah                      $30.00 │
│   Paid on Jan 20, 2026              │
│ ✓ Mike                        $30.00│
│   Paid on Jan 22, 2026              │
└─────────────────────────────────────┘
```

## Filter Options

**All:** Shows everything
**Open:** Only transactions with unpaid amounts
**Completed:** Only fully paid transactions

Click filter buttons to toggle.

## Custom Splits

For uneven amounts, check "Use custom split":

**Example: Concert tickets**
- You: $50
- Sarah: $75 (VIP ticket)
- Mike: $50

```
Total: $175
Number of People: 3

☑ Use custom split

├─ Name: Sarah    Amount: $75.00 ✏️
└─ Name: Mike     Amount: $50.00 ✏️

Your cost: $50.00
Owed back: $125.00
```

## Database Schema

### split_payments Table

```sql
Columns:
- id: UUID (primary key)
- purchase_id: UUID (foreign key to purchases)
- user_id: UUID (who created it)
- person_name: TEXT (name of person who owes)
- amount_owed: NUMERIC (how much they owe)
- is_paid_back: BOOLEAN (paid status)
- paid_back_date: DATE (when they paid)
- notes: TEXT (optional notes)
- created_at, updated_at: TIMESTAMP
```

### Indexes

```sql
- idx_split_payments_purchase: Fast lookup by purchase
- idx_split_payments_user: Fast lookup by user
- idx_split_payments_status: Fast filtering by paid status
```

## Use Cases

**Roommate Utilities:**
```
Electricity Bill: $120
├─ Roommate 1: $40
├─ Roommate 2: $40
└─ You: $40

Track monthly, mark when paid.
```

**Group Vacation:**
```
Airbnb: $600 (6 people)
├─ Friend 1: $100
├─ Friend 2: $100
├─ Friend 3: $100
├─ Friend 4: $100
└─ Friend 5: $100

Mark paid as money comes in.
```

**Restaurant Bills:**
```
Dinner: $150
├─ Girlfriend: $75
└─ You: $75

Even split tracking.
```

## Data Migration

**Existing split purchases:**
- Old purchases without names still work
- New split tracking only for new purchases
- To add tracking to old splits:
  1. Note the purchase details
  2. Add manually in database
  3. Or re-create the purchase

**No data loss:**
- Existing purchases unchanged
- Old `amount_owed_back` field still works
- New system adds more detail

## Tips & Best Practices

**Consistent names:**
- Use the same name spelling
- "Sarah" not "sarah" or "Sarah J."
- Makes it easier to see who owes across transactions

**Add names immediately:**
- Don't skip the name fields
- Future you will thank present you
- "Person 1" is not helpful later

**Mark paid promptly:**
- Click when you receive payment
- Keeps accurate running total
- Easier than remembering later

**Use filters:**
- "Open" to see what's outstanding
- "Completed" to review paid transactions
- Helps with reconciliation

**Notes field (future):**
- Room for payment method notes
- Venmo handles, etc.
- Coming in future update

## Troubleshooting

**Q: Names not saving?**
A: Make sure migration was run. Check Supabase for `split_payments` table.

**Q: Old splits don't show names?**
A: Only new splits (after v5.3.0) track names. Old ones show in Transactions but not Splits page.

**Q: Custom split amounts wrong?**
A: Toggle "Use custom split" and manually enter each amount.

**Q: Can't mark as paid?**
A: Check network connection. Try refreshing page.

**Q: Totals don't match?**
A: Verify all people entered. Sum of individual amounts should equal total minus your share.

## Keyboard Shortcuts

- Tab: Move between name/amount fields
- Enter: Move to next person
- Click circle: Toggle paid status

## Summary

v5.3.0 makes split payment tracking:
- ✅ Visual and intuitive
- ✅ Name-based tracking
- ✅ Easy payment confirmation
- ✅ Accurate running totals
- ✅ Filter by status

Track who owes what, when they paid, and how much you're still owed - all in one place! 🎉
