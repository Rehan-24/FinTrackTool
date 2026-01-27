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
        // Use month_of_year if available, otherwise default to January (month 0)
        const month = expense.month_of_year ? expense.month_of_year - 1 : 0
        const year_date = new Date(current_date.getFullYear(), month, expense.day_of_month)
        if (isBefore(start_date, year_date) || start_date.getTime() === year_date.getTime()) {
          next_date = year_date
        }
        current_date = addYears(current_date, 1)
      } else {
        break
      }

      if (next_date && !isAfter(next_date, end_date)) {
        // Check if purchase already exists for this date (projected or actual)
        const { data: existing } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', user_id)
          .eq('category_id', expense.category_id)
          .eq('date', next_date.toISOString().split('T')[0])
          .eq('description', expense.name)

        // Don't create if ANY purchase exists for this date + description
        if (!existing || existing.length === 0) {
          projected_purchases.push({
            user_id,
            category_id: expense.category_id,
            total_amount: expense.amount,
            actual_cost: expense.amount,
            description: expense.name,
            date: next_date.toISOString().split('T')[0],
            is_projected: true,
            recurring_expense_id: expense.id,
            is_split: false,
            tags: expense.tags || null,  // Copy tags from recurring expense
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // STEP 1: Delete ALL projected purchases for this month (past and future)
  // This ensures clean slate before we regenerate them
  await supabase
    .from('purchases')
    .delete()
    .eq('user_id', user_id)
    .eq('is_projected', true)
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])

  // STEP 2: Generate new purchases for the entire month
  const projected = await generate_projected_purchases(user_id, start, end)

  if (projected && projected.length > 0) {
    // Split into past and future
    const past_purchases = []
    const future_projected = []
    
    for (const p of projected) {
      const purchase_date = new Date(p.date)
      purchase_date.setHours(0, 0, 0, 0)
      
      if (purchase_date < today) {
        // Past date - insert as actual purchase (not projected)
        past_purchases.push({
          ...p,
          is_projected: false  // Mark as actual immediately
        })
      } else {
        // Future date - insert as projected
        future_projected.push(p)
      }
    }
    
    // Insert past purchases as actual
    if (past_purchases.length > 0) {
      for (const purchase of past_purchases) {
        const { error } = await supabase
          .from('purchases')
          .insert(purchase)
        
        if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
          console.error('[Sync] Error inserting past purchase:', error)
        }
      }
    }
    
    // Insert future purchases as projected
    if (future_projected.length > 0) {
      for (const purchase of future_projected) {
        const { error } = await supabase
          .from('purchases')
          .insert(purchase)
        
        if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
          console.error('[Sync] Error inserting projected purchase:', error)
        }
      }
    }
  }
}

// Convert all past projected purchases to actual purchases
// Run this periodically to catch any that were missed
export async function convert_past_projected_to_actual(user_id: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all projected purchases with dates in the past
  const { data: past_projected } = await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_projected', true)
    .lt('date', today.toISOString().split('T')[0])

  if (past_projected && past_projected.length > 0) {
    console.log(`[Cleanup] Converting ${past_projected.length} past projected purchases to actual`)
    
    for (const purchase of past_projected) {
      await supabase
        .from('purchases')
        .update({ is_projected: false })
        .eq('id', purchase.id)
    }
  }
}
