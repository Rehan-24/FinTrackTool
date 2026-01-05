import { supabase } from './supabase'
import { startOfMonth, endOfMonth, addDays, addWeeks, addMonths, addYears, isBefore, isAfter } from 'date-fns'

export async function generate_projected_purchases(user_id: string, start_date: Date, end_date: Date) {
  // Get all active recurring expenses
  const { data: recurring_expenses } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_active', true)

  if (!recurring_expenses) return

  const projected_purchases = []

  for (const expense of recurring_expenses) {
    let current_date = new Date(start_date)

    while (isBefore(current_date, end_date) || current_date.getTime() === end_date.getTime()) {
      let next_date: Date | null = null

      if (expense.frequency === 'monthly' && expense.day_of_month) {
        const month_date = new Date(current_date.getFullYear(), current_date.getMonth(), expense.day_of_month)
        if (isBefore(start_date, month_date) || start_date.getTime() === month_date.getTime()) {
          next_date = month_date
        }
        current_date = addMonths(current_date, 1)
      } else if (expense.frequency === 'weekly' && expense.day_of_week !== null) {
        const current_day = current_date.getDay()
        const days_until = (expense.day_of_week - current_day + 7) % 7
        next_date = addDays(current_date, days_until === 0 ? 7 : days_until)
        current_date = addWeeks(next_date, 1)
      } else if (expense.frequency === 'yearly' && expense.day_of_month) {
        const year_date = new Date(current_date.getFullYear(), 0, expense.day_of_month)
        if (isBefore(start_date, year_date) || start_date.getTime() === year_date.getTime()) {
          next_date = year_date
        }
        current_date = addYears(current_date, 1)
      } else {
        break
      }

      if (next_date && !isAfter(next_date, end_date)) {
        // Check if actual purchase already exists for this date
        const { data: existing } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', user_id)
          .eq('category_id', expense.category_id)
          .eq('date', next_date.toISOString().split('T')[0])
          .eq('description', expense.name)
          .single()

        if (!existing) {
          projected_purchases.push({
            user_id,
            category_id: expense.category_id,
            total_amount: expense.amount,
            actual_cost: expense.amount,
            description: expense.name,
            date: next_date.toISOString().split('T')[0],
            is_projected: true,
            recurring_expense_id: expense.id,
            is_split: false
          })
        }
      }

      if (expense.frequency !== 'weekly') {
        break
      }
    }
  }

  return projected_purchases
}

export async function sync_projected_purchases(user_id: string, month: Date) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)

  // Delete old projected purchases for this month
  await supabase
    .from('purchases')
    .delete()
    .eq('user_id', user_id)
    .eq('is_projected', true)
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])

  // Generate new projected purchases
  const projected = await generate_projected_purchases(user_id, start, end)

  if (projected && projected.length > 0) {
    await supabase
      .from('purchases')
      .insert(projected)
  }
}
