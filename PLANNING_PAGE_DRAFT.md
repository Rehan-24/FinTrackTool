# Planning Page - Design Draft v2

## Page Overview
High-level financial planning view showing 12+ months at a glance with income, budgets, housing, and detailed savings projections.

---

## Layout Concept - FINAL

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Planning                                                                                          │
│ Plan your finances month by month                                                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                   │
│ Year View: [2026 ▼]                    [← 2025] [2026] [2027 →]                                │
│                                                                                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ SUMMARY CARDS (top row)                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐   │
│ │ Gross Income     │ │ Net Income       │ │ Total Budgeted   │ │ Total Projected Savings  │   │
│ │ (2026)           │ │ (2026)           │ │ (2026)           │ │ (2026)                   │   │
│ │                  │ │                  │ │                  │ │                          │   │
│ │   $96,000        │ │   $72,000        │ │   $48,000        │ │   $27,600                │   │
│ │                  │ │  (75% of gross)  │ │                  │ │                          │   │
│ │                  │ │                  │ │                  │ │   Auto:   $7,200 (26%)   │   │
│ │                  │ │                  │ │                  │ │   401k:  $10,800 (39%)   │   │
│ │                  │ │                  │ │                  │ │   HSA:    $3,600 (13%)   │   │
│ │                  │ │                  │ │                  │ │   Cash:   $6,000 (22%)   │   │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────────────┘   │
│                                                                                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ MONTHLY BREAKDOWN TABLE                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                   │
│ Month    │ Gross✎ │ Net    │ Housing✎ │ Budget✎ │ Add'l✎ │ Projected │ Savings │ %    │       │
│──────────┼────────┼────────┼──────────┼─────────┼────────┼───────────┼─────────┼──────┤       │
│ Jan 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $500   │ $6,000    │ $0      │ 0%   │       │
│ Feb 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ Mar 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $1,200 │ $6,700    │ -$700   │ -12% │ ⚠️   │
│ Apr 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ May 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ Jun 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ Jul 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ Aug 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ Sep 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ Oct 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ Nov 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│ Dec 2026 │ $8,000 │ $6,000 │ $1,500   │ $4,000  │ $0     │ $5,500    │ $500    │ 8%   │       │
│──────────┼────────┼────────┼──────────┼─────────┼────────┼───────────┼─────────┼──────┤       │
│ TOTAL    │ $96,000│ $72,000│ $18,000  │ $48,000 │ $1,700 │ $67,700   │ $4,300  │ 6%   │       │
└──────────┴────────┴────────┴──────────┴─────────┴────────┴───────────┴─────────┴──────┘       │
```

---

## Simplified Columns

### Gross Income ✎ (Editable)
- Sum of recurring income amounts BEFORE deductions
- Click to override for planning

### Net Income (Auto-calculated)
- Gross minus all deductions (taxes, 401k, HSA, auto savings)
- This is take-home pay

### Housing ✎ (Editable)
- Rent, mortgage, property tax
- Separate from other budget categories

### Budget ✎ (Editable)
- Sum of all category budgets (excluding housing)
- Click to override for planning

### Add'l Expenses ✎ (Editable)
- One-time expenses for the month
- Vacations, car repairs, etc.

### Projected Total (Auto-calculated)
- Housing + Budget + Additional
- Total expected spending

### Savings (Auto-calculated)
- Net Income - Projected Total
- How much left over (or deficit)

### % (Auto-calculated)
- (Savings / Net Income) × 100
- Savings rate based on take-home pay

**Note:** Auto savings, 401k, and HSA are already deducted from Net Income and shown in the summary card breakdown!

---

## Column Explanations (Updated)

### Gross Income ✎ (Editable)
- **Source**: Sum of all recurring income amounts (BEFORE deductions)
- **Includes**: Full salary/wages before anything is taken out
- **Calculation**: `amount` field from recurring_income
- **Example**: $8,000/month gross salary
- **Editable**: Click to override for planning (raises, bonuses, etc.)

### Net Income (Auto-calculated)
- **Source**: Gross - (Taxes + 401k + HSA + Auto Savings)
- **Calculation**: 
  ```
  Net = Gross - federal_tax - state_tax - fica_tax 
        - retirement_401k - hsa_contribution - auto_savings
  ```
- **Example**: 
  ```
  $8,000 (gross)
  - $1,200 (federal tax)
  - $400 (state tax)
  - $612 (FICA: 7.65%)
  - $900 (401k)
  - $300 (HSA)
  - $600 (auto savings)
  = $5,988 ≈ $6,000 (net/take-home)
  ```
- **Purpose**: What actually hits your bank account
- **Display**: Shows amount + percentage of gross
- **NOT Editable**: Auto-calculated from deductions

### Deduction Breakdown in Income Details:
When you click on Gross Income, show breakdown:

```
┌─────────────────────────────────────┐
│ Income Breakdown - January 2026     │
├─────────────────────────────────────┤
│ Gross Income:        $8,000         │
│                                     │
│ DEDUCTIONS:                         │
│ Federal Tax:        -$1,200  (15%)  │
│ State Tax:          -$400    (5%)   │
│ FICA:               -$612    (7.65%)│
│ 401k:               -$900    (11%)  │
│ HSA:                -$300    (4%)   │
│ Auto Savings:       -$600    (8%)   │
│ ─────────────────────────           │
│ Total Deductions:   -$4,012  (50%)  │
│                                     │
│ NET TAKE-HOME:       $3,988         │
│                                     │
│ [Edit Gross] [Edit Deductions]      │
└─────────────────────────────────────┘
```

### Housing ✎ (Editable)
- **Source**: User input
- **Purpose**: Separate housing costs (rent/mortgage)
- **Why Separate**: Major expense category, often want to track independently
- **Example**: $1,500/month rent or mortgage payment
- **Includes**: Rent, mortgage, property tax, HOA fees

### Budget ✎ (Editable)
- **Default Source**: Sum of all category budgets (excluding housing)
- **Calculation**: Adds up monthly_budget from categories
- **Uses Budget History**: Shows correct historical values if budgets changed
- **Editable**: Click to override for planning scenarios
- **Example**: Default $4,000, edit to $3,500 (planning to cut spending)

### Add'l Expenses ✎ (Editable)
- **Source**: User input only
- **Purpose**: One-time expenses not in regular budget
- **Examples**: 
  - January: "$500" (Holiday bills)
  - March: "$1,200" (Vacation trip)
  - July: "$0" (Nothing extra)
- **Storage**: planning_additional_expenses table
- **Default**: $0

### Projected Total (Auto-calculated)
- **Calculation**: Housing + Budget + Additional Expenses
- **Formula**: `projected = housing + budget + additional`
- **Example**: $1,500 + $4,000 + $500 = $6,000
- **Purpose**: Total expected spending for the month
- **Note**: NOT editable (auto-calculated from other columns)

### Auto Savings ✎ (Editable)
- **Default Source**: Sum of auto_savings from recurring_income
- **Calculation**: Gets auto_savings amounts for that month's income
- **Editable**: Click to override planned savings amount
- **Example**: Default $600, edit to $800 (want to save more)
- **Purpose**: Automated savings transfers

### 401k ✎ (Editable)
- **Default Source**: Sum of retirement_401k from recurring_income
- **Calculation**: Gets 401k amounts for that month's income
- **Editable**: Click to override planned contributions
- **Example**: Default $900, edit to $1,200 (increasing contribution)
- **Purpose**: Retirement savings

### HSA ✎ (Editable)
- **Default Source**: Sum of hsa_contribution from recurring_income
- **Calculation**: Gets HSA amounts for that month's income
- **Editable**: Click to override planned contributions
- **Example**: Default $300, edit to $400 (maxing out HSA)
- **Purpose**: Health savings account

### Cash Savings (Auto-calculated)
- **Calculation**: Income - Projected - Auto - 401k - HSA
- **Formula**: `cash = income - projected - auto_savings - retirement_401k - hsa`
- **Example**: $6,000 - $6,000 - $600 - $900 - $300 = -$800 (deficit)
- **Color Coding**:
  - Green if positive (adding to cash reserves)
  - Red if negative (dipping into reserves)
- **Purpose**: Leftover cash after all expenses and automatic savings
- **Note**: NOT editable (auto-calculated)

### Total Savings (Auto-calculated)
- **Calculation**: Auto + 401k + HSA + Cash
- **Formula**: `total = auto_savings + retirement_401k + hsa + cash_savings`
- **Example**: $600 + $900 + $300 + $200 = $2,000
- **Purpose**: Complete savings picture
- **Note**: NOT editable (auto-calculated)

### % Savings Rate (Auto-calculated)
- **Calculation**: (Total Savings / Income) × 100
- **Formula**: `rate = (total_savings / income) × 100`
- **Example**: ($2,000 / $6,000) × 100 = 33%
- **Benchmark**: 
  - <20% = Red (too low)
  - 20-35% = Yellow (good)
  - >35% = Green (excellent)

---

## Summary Card - Detailed Breakdown

The "Total Projected Savings" card shows the complete picture:

```
┌────────────────────────────────────────┐
│ Total Projected Savings (2026)         │
│                                        │
│        $27,600                         │
│                                        │
│   Auto Savings:   $7,200 (26%)         │
│   401k:          $10,800 (39%)         │
│   HSA:            $3,600 (13%)         │
│   Cash Savings:   $6,000 (22%)         │
│   ────────────────────────              │
│   Total Rate:     38% of income        │
└────────────────────────────────────────┘
```

**Percentages** show each category's share of total savings:
- Auto: $7,200 / $27,600 = 26%
- 401k: $10,800 / $27,600 = 39%
- HSA: $3,600 / $27,600 = 13%
- Cash: $6,000 / $27,600 = 22%

---

## Interactive Editing

### Click Any Editable Column:

**Example: Editing Income**
```
Click $6,000 in Income column:
┌─────────────────────────────┐
│ Edit Income - January 2026  │
├─────────────────────────────┤
│ Amount: [$6,000    ]        │
│                             │
│ Default from recurring:     │
│ $6,000                      │
│                             │
│ [Reset to Default] [Save]   │
└─────────────────────────────┘
```

**Example: Editing Housing**
```
Click $1,500 in Housing column:
┌─────────────────────────────┐
│ Edit Housing - January 2026 │
├─────────────────────────────┤
│ Amount: [$1,500    ]        │
│ Notes:  [Rent       ]       │
│                             │
│ [Cancel]  [Save]            │
└─────────────────────────────┘
```

**Example: Editing 401k**
```
Click $900 in 401k column:
┌─────────────────────────────┐
│ Edit 401k - January 2026    │
├─────────────────────────────┤
│ Amount: [$900      ]        │
│                             │
│ Default from income:        │
│ $900                        │
│                             │
│ [Reset to Default] [Save]   │
└─────────────────────────────┘
```

---

## Calculation Flow

### On Page Load:
```
For each month (Jan - Dec):
  1. Get recurring income → Calculate default Income
  2. Get category budgets → Calculate default Budget  
  3. Get saved overrides → Apply user edits
  4. Calculate: Projected = Housing + Budget + Add'l
  5. Get income savings fields → Calculate Auto, 401k, HSA
  6. Calculate: Cash = Income - Projected - Auto - 401k - HSA
  7. Calculate: Total = Auto + 401k + HSA + Cash
  8. Calculate: % = (Total / Income) × 100
```

### On User Edit:
```
User clicks Income field:
  1. Show modal with current value
  2. User changes $6,000 → $7,500
  3. Save override to planning_overrides table
  4. Recalculate Cash Savings
  5. Recalculate Total Savings
  6. Recalculate %
  7. Update display
```

---

## Database Changes Needed

### New Table: planning_overrides
```sql
CREATE TABLE planning_overrides (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  month_year TEXT NOT NULL, -- 'YYYY-MM'
  
  -- Editable fields
  income_override NUMERIC(10, 2),
  housing_override NUMERIC(10, 2),
  budget_override NUMERIC(10, 2),
  additional_expenses NUMERIC(10, 2),
  auto_savings_override NUMERIC(10, 2),
  retirement_401k_override NUMERIC(10, 2),
  hsa_override NUMERIC(10, 2),
  
  -- Optional notes
  housing_notes TEXT,
  additional_notes TEXT,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, month_year)
);
```

### Indexes
```sql
CREATE INDEX idx_planning_user_month 
ON planning_overrides(user_id, month_year);
```

---

## Color Coding

### Cash Savings Column:
```
Green background: Positive (building cash reserves)
Red background: Negative (spending from reserves)
Yellow background: Low but positive (<$100)
```

### Total Savings % Column:
```
Green text: >35% (excellent savings rate)
Yellow text: 20-35% (good savings rate)
Red text: <20% (needs improvement)
```

### Row States:
```
Current month: Blue left border
Past months: Gray text (actual data if available)
Future months: Normal (planning mode)
Negative cash: Red highlight on entire row
```

---

## Visual Example - March (Negative Cash)

```
Month    │Income✎│Housing✎│Budget✎│Add'l✎│Projected│Auto$✎│401k✎│HSA✎│Cash   │Total│  %   │
──────────┼───────┼────────┼───────┼──────┼─────────┼──────┼─────┼────┼───────┼─────┼──────│
Mar 2026  │$6,000 │$1,500  │$4,000 │$1,200│$6,700   │$600  │$900 │$300│-$600  │$1,800│30% │
          │       │        │       │      │         │      │     │    │ ⚠️ 🔴│     │      │
```

**Warning indicator**: "⚠️ Cash deficit - will need to reduce spending or use reserves"

---

## Smart Features

### Default Value Calculation:
- **Income**: Sum actual recurring income occurrences
- **Budget**: Sum current category budgets (with history)
- **Auto/401k/HSA**: Pull from recurring_income fields
- **User can override** any default for planning scenarios

### Reset to Default:
- Every editable field has "Reset to Default" button
- Removes override, recalculates from source data
- Useful for "what-if" scenarios

### Bulk Edit:
```
Select multiple months:
┌─────────────────────────────────┐
│ Bulk Edit - Apr-Dec 2026        │
├─────────────────────────────────┤
│ Apply to all 9 selected months: │
│                                 │
│ ☑ Housing: [$1,600    ]         │
│ ☑ 401k:    [$1,000    ]         │
│ ☐ HSA:     [$300      ]         │
│                                 │
│ [Cancel]  [Apply]               │
└─────────────────────────────────┘
```

---

## Mobile Responsive

### Desktop (all columns):
Full table with all columns visible

### Tablet (scrollable):
Table scrolls horizontally, all columns available

### Mobile (simplified view):
```
┌────────────────────────────┐
│ January 2026              │
├────────────────────────────┤
│ Income:      $6,000  ✎    │
│ Housing:     $1,500  ✎    │
│ Budget:      $4,000  ✎    │
│ Add'l Exp:   $500    ✎    │
│ ─────────────────────      │
│ Projected:   $6,000        │
│                            │
│ Auto Save:   $600    ✎    │
│ 401k:        $900    ✎    │
│ HSA:         $300    ✎    │
│ Cash Save:   $200          │
│ ─────────────────────      │
│ Total Save:  $2,000 (33%) │
└────────────────────────────┘

[< Previous Month] [Next Month >]
```

---

## Example Scenarios

### Scenario 1: Planning a Raise
```
Current: $6,000/month
Starting April: $7,000/month

User edits:
- Apr-Dec Income: $7,000
- Auto Savings: $700 (increase by $100)
- 401k: $1,050 (increase to 15%)

Result: See impact on cash savings and total savings rate
```

### Scenario 2: Vacation Planning
```
July - Family vacation

User edits:
- July Add'l Expenses: $3,000
- May-Jun Auto Savings: $900 (save extra beforehand)

Result: See if can afford vacation without going negative
```

### Scenario 3: Moving to New Apartment
```
Starting June: New rent

User edits:
- Jun-Dec Housing: $1,800 (increased rent)
- Jun-Dec Budget: $3,500 (reduce other spending)

Result: See if budget balances with higher rent
```

---

## Data Sources

### Income (default):
```sql
SELECT SUM(amount * occurrences) 
FROM recurring_income 
WHERE user_id = ? AND month = ?
```

### Housing (default):
```sql
-- Could pull from a specific category marked as "Housing"
-- OR default to $0, user must input
```

### Budget (default):
```sql
-- Check budget history first
SELECT COALESCE(
  (SELECT SUM(monthly_budget) 
   FROM category_budget_history 
   WHERE month_year = ?),
  (SELECT SUM(monthly_budget) 
   FROM categories 
   WHERE user_id = ?)
)
```

### Auto/401k/HSA (default):
```sql
SELECT 
  SUM(auto_savings),
  SUM(retirement_401k),
  SUM(hsa_contribution)
FROM recurring_income
WHERE user_id = ? AND month = ?
```

---

## Next Steps

Ready to build! This includes:
1. ✅ All columns editable
2. ✅ Housing costs column
3. ✅ Detailed savings breakdown (Auto, 401k, HSA, Cash)
4. ✅ Summary card showing all savings sources
5. ✅ Auto-calculations for Projected, Cash, Total, %

Shall I proceed with building v5.4.0? 🚀


---

## Interactive Features

### Editable Additional Expenses
```
Click the [$500]✎ field:
┌─────────────────────────────┐
│ Additional Expenses - Jan   │
├─────────────────────────────┤
│ Amount: [$500      ]        │
│ Notes:  [Holiday bills]     │
│                             │
│ [Cancel]  [Save]            │
└─────────────────────────────┘
```

### Year Navigation
- Arrows to go backward/forward
- Dropdown to jump to specific year
- Always shows 12 months of selected year

### Responsive Design
**Mobile view:**
- Cards stack vertically
- Table scrolls horizontally
- Simplified view option (toggle to show fewer columns)

---

## Visual Enhancements

### Color Coding
```
Savings column:
├─ Green background: Positive savings
├─ Red background: Negative (deficit)
└─ Yellow background: Low (<10%)

Percentage column:
├─ Green text: >20%
├─ Yellow text: 10-20%
└─ Red text: <10%
```

### Row Highlighting
- Hover: Light gray background
- Current month: Blue border/highlight
- Past months: Slightly dimmed
- Future months: Normal brightness

---

## Data Flow

### Income Calculation
```javascript
For each month:
1. Get all recurring_income for user
2. Calculate actual occurrences in month (using count logic)
3. Sum all income sources
4. Return monthly total
```

### Budget Calculation
```javascript
For each month:
1. Get all categories for user
2. Check category_budget_history for that month
3. If history exists, use historical budget
4. If no history, use current monthly_budget
5. Sum all category budgets
6. Return monthly total
```

### Additional Expenses
```javascript
// New table needed: planning_additional_expenses
{
  id: uuid,
  user_id: uuid,
  month_year: '2026-01', // Format: YYYY-MM
  amount: 500.00,
  notes: 'Holiday bills'
}
```

---

## Alternative Layout Options

### Option A: Card Grid (Current Draft Above)
- Summary cards at top
- Table below
- Traditional spreadsheet feel

### Option B: Timeline View
```
┌────────────────────────────────────────────┐
│ 2026 Timeline                              │
├────────────────────────────────────────────┤
│                                            │
│ Jan ████████░░ $1,500 saved (25%)         │
│ Feb ██████████ $2,000 saved (33%)         │
│ Mar ███░░░░░░░ $800 saved (13%)           │
│ Apr ██████████ $2,000 saved (33%)         │
│ ...                                        │
└────────────────────────────────────────────┘
```

### Option C: Chart-First
```
┌────────────────────────────────────────────┐
│  Income vs Spending (2026)                 │
│                                            │
│  8k ┤                                      │
│  6k ┤████████████████████████ Income       │
│  4k ┤████████████░░░░░░░░░░░░ Spending    │
│  2k ┤░░░░░░░░░░░░░░░░░░░░░░░░ Savings     │
│  0k └┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬─ │
│      J  F  M  A  M  J  J  A  S  O  N  D  │
│                                            │
│  [Show Table View]                         │
└────────────────────────────────────────────┘
```

---

## Questions for You

Before I build this, please let me know:

1. **Layout preference**: 
   - Option A (table-first)?
   - Option B (timeline)?
   - Option C (chart-first)?
   - Or combination?

2. **Additional Expenses**:
   - Just amount? ✓
   - Or also notes field for context? ✓
   - Should we track categories for additional expenses?

3. **Time range**:
   - Just 12 months (current year)?
   - Or ability to see multiple years at once?
   - Should we show past months differently?

4. **Calculations**:
   - Income = recurring only?
   - Or include one-time income too?
   - Budget = current categories only?
   - Or include actual spending if month is past?

5. **Features**:
   - Export to CSV/Excel?
   - Print view?
   - Comparison to actuals (for past months)?

---

## Database Changes Needed

### New Table
```sql
CREATE TABLE planning_additional_expenses (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  month_year TEXT NOT NULL, -- 'YYYY-MM'
  amount NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP,
  UNIQUE(user_id, month_year)
);
```

### Indexes
```sql
CREATE INDEX idx_planning_user_month 
ON planning_additional_expenses(user_id, month_year);
```

---

## Next Steps

Let me know which direction you prefer and any adjustments, then I'll build it! 

Options:
1. **Quick build**: I make it based on draft above
2. **Customized**: You tell me changes/preferences first
3. **Iterate**: I build basic version, we refine together

What do you think? 🚀
