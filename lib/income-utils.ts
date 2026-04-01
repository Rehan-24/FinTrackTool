/**
 * Shared income occurrence counting utility.
 *
 * Enumerates actual pay dates from the anchor/start_date for every supported
 * frequency instead of dividing by a fixed period count.  All four pages
 * (planning, dashboard, income, history) use this single implementation so
 * fixes and edge-case handling stay in sync.
 *
 * Supported frequencies:
 *   weekly      – every 7 days from anchor
 *   bi-weekly   – every 14 days from anchor (handles 3-paycheck months)
 *   semi-monthly – enumerates the two pay dates per month derived from anchor
 *   monthly     – same calendar day each month
 *   yearly      – every 365 days from anchor
 *
 * @param income_entry   Income record.  Must have start_date (or date),
 *                       optionally end_date, and frequency / pay_frequency.
 * @param range_start    First day of the period to count within (inclusive).
 * @param range_end      Last day of the period to count within (inclusive).
 * @param cutoff_date    Optional upper bound – only count paychecks up to
 *                       this date (used for "actual received so far").
 * @param from_date      Optional lower bound – only count paychecks on or
 *                       after this date (used for "remaining this month").
 */
// Parse a yyyy-MM-dd string as a LOCAL date (not UTC).
// new Date('2026-01-02') is parsed as UTC midnight which rolls back one day
// in any US timezone — this helper avoids that off-by-one.
function parse_local(date_str: string): Date {
  const [y, m, d] = date_str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function count_income_occurrences(
  income_entry: any,
  range_start: Date,
  range_end: Date,
  cutoff_date?: Date | null,
  from_date?: Date
): number {
  const anchor = income_entry.start_date
    ? parse_local(income_entry.start_date)
    : parse_local(income_entry.date)
  const hard_end = income_entry.end_date ? parse_local(income_entry.end_date) : null

  if (anchor > range_end) return 0
  if (hard_end && hard_end < range_start) return 0

  let effective_end = new Date(range_end)
  if (hard_end && hard_end < effective_end) effective_end = new Date(hard_end)
  if (cutoff_date && cutoff_date < effective_end) effective_end = new Date(cutoff_date)

  const effective_start = from_date && from_date > anchor ? from_date : anchor
  if (effective_start > effective_end) return 0

  const freq = income_entry.is_salary
    ? (income_entry.pay_frequency || '').toLowerCase()
    : (income_entry.frequency || '').toLowerCase()

  let count = 0

  if (freq === 'monthly') {
    // Walk month-by-month, preserving the anchor's day-of-month
    let current = new Date(anchor)
    while (current <= effective_end) {
      if (current >= range_start && current >= effective_start) count++
      current = new Date(current.getFullYear(), current.getMonth() + 1, anchor.getDate())
    }

  } else if (freq === 'semi-monthly') {
    // Derive the two calendar pay-days from the anchor day:
    //   anchor day 1–15  → pays on anchor_day and anchor_day+15 each month
    //   anchor day 16–31 → pays on anchor_day-15 and anchor_day each month
    // Both dates are capped to the last day of the month to handle short months.
    const anchor_day = anchor.getDate()
    const pay_day_a = anchor_day <= 15 ? anchor_day : anchor_day - 15
    const pay_day_b = anchor_day <= 15 ? anchor_day + 15 : anchor_day

    // Walk month-by-month starting from the anchor's month
    let month_cursor = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const range_end_month = new Date(effective_end.getFullYear(), effective_end.getMonth(), 1)

    while (month_cursor <= range_end_month) {
      const days_in_month = new Date(
        month_cursor.getFullYear(),
        month_cursor.getMonth() + 1,
        0
      ).getDate()

      const d_a = new Date(
        month_cursor.getFullYear(),
        month_cursor.getMonth(),
        Math.min(pay_day_a, days_in_month)
      )
      const d_b = new Date(
        month_cursor.getFullYear(),
        month_cursor.getMonth(),
        Math.min(pay_day_b, days_in_month)
      )

      if (d_a >= effective_start && d_a >= range_start && d_a <= effective_end) count++
      if (d_b >= effective_start && d_b >= range_start && d_b <= effective_end) count++

      month_cursor = new Date(month_cursor.getFullYear(), month_cursor.getMonth() + 1, 1)
    }

  } else {
    // Weekly / bi-weekly / yearly: walk in fixed-day steps from the anchor
    let freq_days = 0
    if (freq === 'weekly') freq_days = 7
    else if (freq === 'bi-weekly' || freq === 'biweekly' || freq === 'bi weekly') freq_days = 14
    else if (freq === 'yearly') freq_days = 365
    if (freq_days === 0) return 0

    // Fast-forward to effective_start to avoid iterating from years ago
    let current = new Date(anchor)
    while (current < effective_start) {
      current.setDate(current.getDate() + freq_days)
    }
    while (current <= effective_end) {
      if (current >= range_start) count++
      current.setDate(current.getDate() + freq_days)
    }
  }

  return count
}

/**
 * Returns the number of pay periods per year for a given frequency string.
 * Used to convert a stored yearly deduction/salary into a per-paycheck amount.
 */
export function pay_periods_per_year(frequency: string): number {
  const freq = (frequency || '').toLowerCase()
  if (freq === 'weekly') return 52
  if (freq === 'bi-weekly' || freq === 'biweekly' || freq === 'bi weekly') return 26
  if (freq === 'semi-monthly') return 24
  if (freq === 'monthly') return 12
  if (freq === 'yearly') return 1
  return 12 // safe fallback
}
