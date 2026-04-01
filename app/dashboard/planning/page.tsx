'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns'
import { count_income_occurrences, pay_periods_per_year } from '@/lib/income-utils'
import { ChevronLeft, ChevronRight, Edit2, TrendingUp, TrendingDown } from 'lucide-react'

type MonthData = {
  month: string // YYYY-MM
  month_name: string // "January"
  gross_income: number
  net_income: number
  housing: number
  budget: number
  additional: number
  projected: number
  actual_spent: number // actual spending (excluding savings categories)
  saved_amount: number // actual transfers to savings categories
  adjustments: number // manual adjustment that reduces leftover
  savings: number // cash leftover (net - spent - adjustments)
  savings_rate: number
  auto_savings: number
  retirement_401k: number
  hsa: number
}

export default function PlanningPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [months, setMonths] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)
  
  // Edit modal state
  const [editing_month, setEditingMonth] = useState<string | null>(null)
  const [edit_field, setEditField] = useState<string>('')
  const [edit_value, setEditValue] = useState('')
  const [edit_notes, setEditNotes] = useState('')

  useEffect(() => {
    load_planning_data()
  }, [year])
  
  // Reload data when page becomes visible (catches changes from Income page)
  useEffect(() => {
    const handle_visibility = () => {
      if (document.visibilityState === 'visible') {
        load_planning_data()
      }
    }
    
    document.addEventListener('visibilitychange', handle_visibility)
    return () => document.removeEventListener('visibilitychange', handle_visibility)
  }, [year])

  const parse_local = (date_str: string) => {
    const [y, m, d] = date_str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  const load_planning_data = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // OPTIMIZED: Fetch data once instead of 12 times
      
      // Get all income sources once
      const { data: income_sources } = await supabase
        .from('income')
        .select('*')
        .eq('user_id', user.id)

      // Get all salary deductions once
      const income_ids = income_sources?.filter(i => i.is_recurring).map(i => i.id) || []
      let deductions_map: any = {}
      
      
      if (income_ids.length > 0) {
        const { data: all_deductions, error: deductions_error } = await supabase
          .from('salary_deductions')
          .select('*')
          .in('income_id', income_ids)
        
        
        // Map deductions by income_id for fast lookup
        all_deductions?.forEach(d => {
          deductions_map[d.income_id] = d
        })
      }
      

      // Get all categories once
      const { data: categories } = await supabase
        .from('categories')
        .select('monthly_budget')
        .eq('user_id', user.id)
      
      const default_budget = categories?.reduce((sum, c) => sum + parseFloat(c.monthly_budget.toString()), 0) || 0

      // Get all planning overrides for the year at once
      const overrides_year_start = format(new Date(year, 0, 1), 'yyyy-MM')
      const overrides_year_end = format(new Date(year, 11, 1), 'yyyy-MM')
      
      const { data: all_overrides } = await supabase
        .from('planning_overrides')
        .select('*')
        .eq('user_id', user.id)
        .gte('month_year', overrides_year_start)
        .lte('month_year', overrides_year_end)
      
      // Map overrides by month for fast lookup
      const overrides_map: any = {}
      all_overrides?.forEach(o => {
        overrides_map[o.month_year] = o
      })

      const months_data: MonthData[] = []
      
      // DEBUGGING: Log what we fetched
      
      // Generate 12 months - now using cached data
      for (let i = 0; i < 12; i++) {
        const month_date = addMonths(new Date(year, 0, 1), i)
        const month_year = format(month_date, 'yyyy-MM')
        const month_name = format(month_date, 'MMMM')
        const month_start = startOfMonth(month_date)
        const month_end = endOfMonth(month_date)
        
        const override = overrides_map[month_year]

        
        // Calculate gross income for this month
        let gross = 0
        if (income_sources) {
          for (const source of income_sources) {
            if (source.is_recurring) {
              // Check if active this month
              const start_date = source.start_date ? parse_local(source.start_date) : parse_local(source.date)
              const end_date = source.end_date ? new Date(source.end_date) : null
              
              // Skip if hasn't started yet or already ended
              if (start_date > month_end) continue
              if (end_date && end_date < month_start) continue
              
              // Enumerate actual pay dates in this month from start_date
              const actual_paychecks = count_income_occurrences(source, month_start, month_end)

              if (source.is_salary && source.yearly_salary) {
                const freq = source.pay_frequency || ''
                const per_paycheck_gross = source.yearly_salary / pay_periods_per_year(freq)
                gross += per_paycheck_gross * actual_paychecks
              } else {
                gross += source.amount * actual_paychecks
              }
            } else {
              // One-time income: check if date is in this month
              const income_date = parse_local(source.date)
              if (income_date >= month_start && income_date <= month_end) {
                gross += source.amount
              }
            }
          }
        }
        
        
        // Calculate net income and savings breakdown
        let total_deductions = 0
        let auto_savings = 0
        let retirement_401k = 0
        let hsa = 0
        
        if (income_sources) {
          for (const source of income_sources) {
            if (!source.is_recurring) continue
            
            // Skip if fully outside this month
            const anchor = source.start_date ? parse_local(source.start_date) : parse_local(source.date)
            const hard_end = source.end_date ? new Date(source.end_date) : null
            if (anchor > month_end) continue
            if (hard_end && hard_end < month_start) continue

            const occurrences = count_income_occurrences(source, month_start, month_end)
            const deductions = deductions_map[source.id]

            if (deductions && occurrences > 0) {
              // Deductions are stored as YEARLY values.
              // Scale by actual paychecks this month so 3-paycheck months
              // correctly reflect 3 paychecks worth of deductions.
              const periods = pay_periods_per_year(source.pay_frequency || '')
              const scale = occurrences / periods

              const d = (field: string) => ((deductions[field] || 0) * scale)

              const monthly_deductions = (
                // Taxes
                d('federal_tax') + d('state_tax') + d('local_tax') +
                d('fica_total') + d('ca_disability') + d('state_etc') +
                // Pre-tax benefits
                d('pre_tax_401k') + d('hsa') + d('fsa') +
                d('medical_insurance') + d('dental_insurance') + d('vision_insurance') +
                d('long_term_disability') + d('life_insurance') +
                // After-tax deductions
                d('after_tax_401k') + d('after_tax_401k_roth') +
                d('ad_d') + d('critical_illness') + d('hospital_indemnity') +
                d('accident_insurance') + d('legal_plan') + d('identity_theft') +
                // Auto savings
                d('roth_ira') + d('hysa') + d('crypto') +
                d('personal_investments') + d('other_savings')
              )

              total_deductions += monthly_deductions
              // Auto savings = individual savings vehicles outside 401k and HSA/FSA
              auto_savings += d('roth_ira') + d('hysa') + d('crypto') + d('personal_investments') + d('other_savings')
              // 401k = all 401k variants
              retirement_401k += d('pre_tax_401k') + d('after_tax_401k') + d('after_tax_401k_roth')
              // HSA + FSA
              hsa += d('hsa') + d('fsa')
            }
          }
        }
        
        
        const net = gross - total_deductions
        
        // Get actual spending for this month (only for past/current months)
        // Separate regular spending from savings transfers
        const today = new Date()
        let actual_spent = 0
        let saved_amount = 0
        
        if (month_end < today) {
          // Month has passed - get all spending
          const { data: purchases } = await supabase
            .from('purchases')
            .select('actual_cost, is_projected, date, category:categories(is_savings)')
            .eq('user_id', user.id)
            .gte('date', format(month_start, 'yyyy-MM-dd'))
            .lte('date', format(month_end, 'yyyy-MM-dd'))
          
          if (purchases) {
            // Count only non-projected OR projected that have passed
            purchases.forEach(p => {
              const should_count = !p.is_projected || new Date(p.date) < today
              if (should_count) {
                const amount = parseFloat(p.actual_cost.toString())
                // @ts-ignore - Supabase join syntax
                if (p.category?.is_savings) {
                  saved_amount += amount
                } else {
                  actual_spent += amount
                }
              }
            })
          }
        } else if (month_start <= today) {
          // Current month - get spending up to today
          const { data: purchases } = await supabase
            .from('purchases')
            .select('actual_cost, is_projected, date, category:categories(is_savings)')
            .eq('user_id', user.id)
            .gte('date', format(month_start, 'yyyy-MM-dd'))
            .lte('date', format(today, 'yyyy-MM-dd'))
          
          if (purchases) {
            purchases.forEach(p => {
              const should_count = !p.is_projected || new Date(p.date) < today
              if (should_count) {
                const amount = parseFloat(p.actual_cost.toString())
                // @ts-ignore - Supabase join syntax
                if (p.category?.is_savings) {
                  saved_amount += amount
                } else {
                  actual_spent += amount
                }
              }
            })
          }
        }
        // else: Future month, both stay 0
        
        
        // Apply overrides or use defaults (use ?? so 0 overrides are respected)
        const gross_income = override?.gross_income_override ?? gross
        const net_income = override?.net_income_override ?? net
        const housing = override?.housing_override ?? 0
        const budget = override?.budget_override ?? default_budget
        const additional = override?.additional_expenses ?? 0
        
        const projected = housing + budget + additional
        const adjustments = override?.adjustments ?? 0
        // Use actual_spent for cash calculation if month has started, otherwise use projected
        const spending_for_cash = actual_spent > 0 ? actual_spent : projected
        const savings = net_income - spending_for_cash - adjustments
        const savings_rate = net_income > 0 ? (savings / net_income) * 100 : 0

        months_data.push({
          month: month_year,
          month_name,
          gross_income,
          net_income,
          housing,
          budget,
          additional,
          projected,
          actual_spent,
          saved_amount,
          adjustments,
          savings,
          savings_rate,
          auto_savings,
          retirement_401k,
          hsa
        })
      }

      setMonths(months_data)
    } catch (err) {
      console.error('Error loading planning data:', err)
    } finally {
      setLoading(false)
    }
  }


  const open_edit = (month: string, field: string, current_value: number, notes?: string) => {
    setEditingMonth(month)
    setEditField(field)
    setEditValue(current_value.toString())
    setEditNotes(notes || '')
  }

  const save_edit = async () => {
    if (!editing_month) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const update_data: any = {
        user_id: user.id,
        month_year: editing_month
      }

      if (edit_field === 'gross') update_data.gross_income_override = parseFloat(edit_value)
      if (edit_field === 'net') update_data.net_income_override = parseFloat(edit_value)
      if (edit_field === 'housing') {
        update_data.housing_override = parseFloat(edit_value)
        update_data.housing_notes = edit_notes
      }
      if (edit_field === 'budget') update_data.budget_override = parseFloat(edit_value)
      if (edit_field === 'additional') {
        update_data.additional_expenses = parseFloat(edit_value)
        update_data.additional_notes = edit_notes
      }
      if (edit_field === 'adjustments') update_data.adjustments = parseFloat(edit_value)

      const { error } = await supabase
        .from('planning_overrides')
        .upsert(update_data, { onConflict: 'user_id,month_year' })

      if (error) throw error

      // OPTIMIZED: Update only the changed month in state instead of reloading all
      setMonths(prev_months => {
        return prev_months.map(month => {
          if (month.month !== editing_month) return month

          // Recalculate this month's values
          let new_month = { ...month }

          if (edit_field === 'gross') {
            new_month.gross_income = parseFloat(edit_value)
          }
          if (edit_field === 'net') {
            new_month.net_income = parseFloat(edit_value)
          }
          if (edit_field === 'housing') {
            new_month.housing = parseFloat(edit_value)
          }
          if (edit_field === 'budget') {
            new_month.budget = parseFloat(edit_value)
          }
          if (edit_field === 'additional') {
            new_month.additional = parseFloat(edit_value)
          }
          if (edit_field === 'adjustments') {
            new_month.adjustments = parseFloat(edit_value)
          }

          // Recalculate dependent values
          new_month.projected = new_month.housing + new_month.budget + new_month.additional
          const spending_for_cash = new_month.actual_spent > 0 ? new_month.actual_spent : new_month.projected
          new_month.savings = new_month.net_income - spending_for_cash - new_month.adjustments
          new_month.savings_rate = new_month.net_income > 0 ? (new_month.savings / new_month.net_income) * 100 : 0

          return new_month
        })
      })

      close_edit()
    } catch (err) {
      console.error('Error saving edit:', err)
      alert('Failed to save changes')
    }
  }

  const close_edit = () => {
    setEditingMonth(null)
    setEditField('')
    setEditValue('')
    setEditNotes('')
  }
  
  const reset_all_overrides = async () => {
    if (!confirm(`Reset all manually edited values for ${year}? This will restore every month back to its calculated defaults.`)) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('planning_overrides')
        .delete()
        .eq('user_id', user.id)
        .gte('month_year', `${year}-01`)
        .lte('month_year', `${year}-12`)

      if (error) throw error

      await load_planning_data()
    } catch (err) {
      console.error('Error resetting overrides:', err)
      alert('Failed to reset values')
    }
  }

  const reset_to_default = async () => {
    if (!editing_month) return
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      // Build the update to NULL out the specific override field
      const update_data: any = {
        user_id: user.id,
        month_year: editing_month
      }
      
      // Set the field to NULL to remove override
      if (edit_field === 'gross') update_data.gross_income_override = null
      if (edit_field === 'net') update_data.net_income_override = null
      if (edit_field === 'housing') {
        update_data.housing_override = null
        update_data.housing_notes = null
      }
      if (edit_field === 'budget') update_data.budget_override = null
      if (edit_field === 'additional') {
        update_data.additional_expenses = null
        update_data.additional_notes = null
      }
      if (edit_field === 'adjustments') update_data.adjustments = null

      const { error } = await supabase
        .from('planning_overrides')
        .upsert(update_data, { onConflict: 'user_id,month_year' })

      if (error) throw error

      // Reload the data to get fresh calculated values
      await load_planning_data()
      close_edit()
    } catch (err) {
      console.error('Error resetting to default:', err)
      alert('Failed to reset to default')
    }
  }

  // Calculate totals
  // For GROSS: Sum actual monthly gross values (correctly prorated for start/end dates)
  const total_gross = months.reduce((sum, m) => sum + m.gross_income, 0)
  
  const total_net = months.reduce((sum, m) => sum + m.net_income, 0)
  const total_budget = months.reduce((sum, m) => sum + m.housing + m.budget + m.additional, 0)
  const total_auto_savings = months.reduce((sum, m) => sum + m.auto_savings, 0)
  const total_401k = months.reduce((sum, m) => sum + m.retirement_401k, 0)
  const total_hsa = months.reduce((sum, m) => sum + m.hsa, 0)
  const total_cash_savings = months.reduce((sum, m) => sum + m.saved_amount, 0)
  const total_savings = total_auto_savings + total_401k + total_hsa + total_cash_savings

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Planning</h1>
        <p className="text-sm md:text-base text-gray-600">Plan your finances month by month</p>
      </div>

      {/* Year Navigation */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg border border-gray-200">
        <button
          onClick={() => setYear(year - 1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="text-2xl font-bold text-gray-800">{year}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset_all_overrides}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            Reset Values
          </button>
          <button
            onClick={() => setYear(year + 1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4">
          <div className="text-sm opacity-90 mb-2">Gross Income ({year})</div>
          <div className="text-3xl font-bold">${total_gross.toLocaleString()}</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4">
          <div className="text-sm opacity-90 mb-2">Net Income ({year})</div>
          <div className="text-3xl font-bold">${total_net.toLocaleString()}</div>
          <div className="text-sm opacity-90">({((total_net / total_gross) * 100).toFixed(0)}% of gross)</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-4">
          <div className="text-sm opacity-90 mb-2">Total Budgeted ({year})</div>
          <div className="text-3xl font-bold">${total_budget.toLocaleString()}</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-4">
          <div className="text-sm opacity-90 mb-2">Total Projected Savings ({year})</div>
          <div className="text-3xl font-bold">${total_savings.toLocaleString()}</div>
          <div className="text-xs mt-2 space-y-1">
            <div>Auto: ${total_auto_savings.toLocaleString()} ({total_gross > 0 ? ((total_auto_savings / total_gross) * 100).toFixed(1) : '0.0'}% of gross)</div>
            <div>401k: ${total_401k.toLocaleString()} ({total_gross > 0 ? ((total_401k / total_gross) * 100).toFixed(1) : '0.0'}% of gross)</div>
            <div>HSA: ${total_hsa.toLocaleString()} ({total_gross > 0 ? ((total_hsa / total_gross) * 100).toFixed(1) : '0.0'}% of gross)</div>
            <div>Saved: ${total_cash_savings.toLocaleString()} ({total_gross > 0 ? ((total_cash_savings / total_gross) * 100).toFixed(1) : '0.0'}% of gross)</div>
          </div>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Month</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Gross ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Net ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Housing ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Budget ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Add'l ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Projected</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actual</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Adjustments ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Saved</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Leftover</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">%</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{month.month_name}</td>
                
                <td className="px-4 py-3 text-right text-sm">
                  <button
                    onClick={() => open_edit(month.month, 'gross', month.gross_income)}
                    className="hover:text-blue-600 transition"
                  >
                    ${month.gross_income.toLocaleString()}
                  </button>
                </td>
                
                <td className="px-4 py-3 text-right text-sm">
                  <button
                    onClick={() => open_edit(month.month, 'net', month.net_income)}
                    className="hover:text-blue-600 transition"
                  >
                    ${month.net_income.toLocaleString()}
                  </button>
                </td>
                
                <td className="px-4 py-3 text-right text-sm">
                  <button
                    onClick={() => open_edit(month.month, 'housing', month.housing)}
                    className="hover:text-blue-600 transition"
                  >
                    ${month.housing.toLocaleString()}
                  </button>
                </td>
                
                <td className="px-4 py-3 text-right text-sm">
                  <button
                    onClick={() => open_edit(month.month, 'budget', month.budget)}
                    className="hover:text-blue-600 transition"
                  >
                    ${month.budget.toLocaleString()}
                  </button>
                </td>
                
                <td className="px-4 py-3 text-right text-sm">
                  <button
                    onClick={() => open_edit(month.month, 'additional', month.additional)}
                    className="hover:text-blue-600 transition"
                  >
                    ${month.additional.toLocaleString()}
                  </button>
                </td>
                
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  ${month.projected.toLocaleString()}
                </td>
                
                <td className={`px-4 py-3 text-right text-sm font-medium ${
                  month.actual_spent > 0 ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  ${month.actual_spent.toLocaleString()}
                </td>
                
                <td className="px-4 py-3 text-right text-sm">
                  <button
                    onClick={() => open_edit(month.month, 'adjustments', month.adjustments)}
                    className={`hover:text-blue-600 transition ${month.adjustments !== 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}`}
                  >
                    {month.adjustments !== 0 ? `$${month.adjustments.toLocaleString()}` : '—'}
                  </button>
                </td>

                <td className={`px-4 py-3 text-right text-sm font-medium ${
                  month.saved_amount > 0 ? 'text-green-600' : 'text-gray-400'
                }`}>
                  ${month.saved_amount.toLocaleString()}
                </td>
                
                <td className={`px-4 py-3 text-right text-sm font-semibold ${
                  month.savings >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {month.savings >= 0 ? (
                    <TrendingUp className="inline mr-1" size={16} />
                  ) : (
                    <TrendingDown className="inline mr-1" size={16} />
                  )}
                  ${month.savings.toLocaleString()}
                </td>
                
                <td className={`px-4 py-3 text-right text-sm font-semibold ${
                  month.savings_rate >= 20 ? 'text-green-600' :
                  month.savings_rate >= 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {month.savings_rate.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing_month && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Edit {edit_field.charAt(0).toUpperCase() + edit_field.slice(1)} - {
                months.find(m => m.month === editing_month)?.month_name
              }
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={edit_value}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {(edit_field === 'housing' || edit_field === 'additional') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={edit_notes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Add notes..."
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={close_edit}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={reset_to_default}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition"
                >
                  Reset to Default
                </button>
                <button
                  onClick={save_edit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
