# Planning Page - Income Integration Reference

## Automatic Data Integration ✓

The Planning page **automatically pulls all data** from the Income page (`recurring_income` table). No manual entry needed!

---

## Data Flow

```
Income Page (recurring_income table)
           ↓
    Planning Page
```

### What Gets Pulled Automatically:

**1. Gross Income**
- Source: `recurring_income.amount` field
- Calculation: Sums all income sources for the month
- Accounts for frequency (bi-weekly, monthly, etc.)
- Example:
  ```
  Salary: $4,000/month (Monthly) = $4,000
  Side Gig: $500/week (Weekly) = $2,000
  Total Gross: $6,000
  ```

**2. All Deductions (for Net Income)**
- `federal_tax`
- `state_tax`
- `local_tax`
- `fica_tax`
- `retirement_401k` ← Used for 401k breakdown
- `hsa_contribution` ← Used for HSA breakdown
- `health_insurance`
- `dental_insurance`
- `vision_insurance`
- `life_insurance`
- `disability_insurance`
- `fsa_contribution`
- `other_deductions`
- `auto_savings` ← Used for Auto Savings breakdown

**3. Savings Breakdown**
- Auto Savings: `auto_savings` field
- 401k: `retirement_401k` field
- HSA: `hsa_contribution` field

---

## Example: How It Works

### Income Page Data:
```
Recurring Income Entry:
├─ Description: "Main Salary"
├─ Amount: $8,000 (Gross)
├─ Frequency: Monthly
├─ Federal Tax: $1,200
├─ State Tax: $400
├─ FICA Tax: $612
├─ 401k: $900
├─ HSA: $300
├─ Auto Savings: $600
└─ Other deductions: $0
```

### Planning Page Shows (January):
```
Gross Income: $8,000 ← From 'amount' field
Net Income: $3,988   ← Gross minus all deductions
                        ($8,000 - $1,200 - $400 - $612 - $900 - $300 - $600)
```

### Summary Card Shows:
```
Total Projected Savings:
├─ Auto Savings: $600   ← From 'auto_savings' field
├─ 401k: $900          ← From 'retirement_401k' field
├─ HSA: $300           ← From 'hsa_contribution' field
└─ Cash: (calculated)   ← Net - Projected
```

---

## Frequency Handling

The Planning page correctly counts occurrences per month:

**Monthly**: 1 occurrence
```
$4,000/month × 1 = $4,000
```

**Bi-weekly**: 2-3 occurrences depending on month
```
$2,000 bi-weekly:
- Most months: × 2 = $4,000
- Some months: × 3 = $6,000
```

**Weekly**: 4 occurrences
```
$500/week × 4 = $2,000
```

**Semi-monthly**: 2 occurrences
```
$2,000 semi-monthly × 2 = $4,000
```

---

## Multiple Income Sources

If you have multiple income sources on the Income page, Planning adds them all up:

**Income Page:**
```
Source 1: Main Job
├─ Amount: $6,000/month
├─ 401k: $600
├─ HSA: $200
└─ Auto Savings: $500

Source 2: Side Gig
├─ Amount: $2,000/month
├─ 401k: $0
├─ HSA: $0
└─ Auto Savings: $100
```

**Planning Page (January):**
```
Gross: $8,000 (6,000 + 2,000)
401k: $600 (600 + 0)
HSA: $200 (200 + 0)
Auto: $600 (500 + 100)
```

---

## How to Update Planning Data

### Option 1: Update Income Page (Permanent)
Go to Income page → Edit recurring income → Changes apply to all future months

**Example:**
```
Change 401k from $600 to $800
→ All future months in Planning show $800
```

### Option 2: Override in Planning (Temporary)
Click value in Planning → Edit → Changes only that specific month

**Example:**
```
January: Click Gross ($8,000) → Edit to $10,000 (bonus)
→ Only January shows $10,000
→ February still shows $8,000 (from Income page)
```

---

## Budget Integration

Planning also pulls from your budget categories:

**Budget Calculation:**
1. Checks `category_budget_history` for that month
2. If no history, uses current `categories.monthly_budget`
3. Sums all category budgets

**Example:**
```
Categories:
├─ Groceries: $500
├─ Dining: $300
├─ Gas: $200
└─ Entertainment: $100

Planning shows Budget: $1,100
```

---

## Complete Data Sources

| Planning Column | Data Source | Auto-Populated? |
|----------------|-------------|-----------------|
| Gross Income   | recurring_income.amount | ✅ Yes |
| Net Income     | Gross - all deductions | ✅ Yes (calculated) |
| Housing        | planning_overrides.housing_override | ❌ No (user sets) |
| Budget         | categories.monthly_budget | ✅ Yes |
| Add'l Expenses | planning_overrides.additional_expenses | ❌ No (user sets) |
| Projected      | Housing + Budget + Add'l | ✅ Yes (calculated) |
| Savings        | Net - Projected | ✅ Yes (calculated) |
| % Savings Rate | (Savings / Net) × 100 | ✅ Yes (calculated) |

---

## Summary

✅ **Gross Income**: Pulled from Income page  
✅ **Net Income**: Auto-calculated from all deductions  
✅ **Auto Savings**: Pulled from Income page  
✅ **401k**: Pulled from Income page  
✅ **HSA**: Pulled from Income page  
✅ **Budget**: Pulled from Categories  
❌ **Housing**: You must set (one-time per month)  
❌ **Additional**: You must set (as needed)  

Everything from the Income page automatically flows to Planning - no duplication needed! 🎉
