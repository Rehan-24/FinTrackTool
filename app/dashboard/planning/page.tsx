'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfYear, endOfYear, addMonths, startOfMonth, endOfMonth } from 'date-fns'
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
  savings: number
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
        const { data: all_deductions } = await supabase
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
      const year_start = format(new Date(year, 0, 1), 'yyyy-MM')
      const year_end = format(new Date(year, 11, 1), 'yyyy-MM')
      
      const { data: all_overrides } = await supabase
        .from('planning_overrides')
        .select('*')
        .eq('user_id', user.id)
        .gte('month_year', year_start)
        .lte('month_year', year_end)
      
      // Map overrides by month for fast lookup
      const overrides_map: any = {}
      all_overrides?.forEach(o => {
        overrides_map[o.month_year] = o
      })

      const months_data: MonthData[] = []
      
      // DEBUGGING: Log what we fetched
      console.log('=== PLANNING DATA DEBUG ===')
      console.log('Income sources:', income_sources)
      console.log('Deductions map:', deductions_map)
      console.log('Default budget:', default_budget)
      console.log('Overrides map:', overrides_map)
      
      // Generate 12 months - now using cached data
      for (let i = 0; i < 12; i++) {
        const month_date = addMonths(new Date(year, 0, 1), i)
        const month_year = format(month_date, 'yyyy-MM')
        const month_name = format(month_date, 'MMMM')
        const month_start = startOfMonth(month_date)
        const month_end = endOfMonth(month_date)
        
        const override = overrides_map[month_year]

        console.log(`\n--- ${month_name} ---`)
        
        // Calculate gross income for this month
        let gross = 0
        if (income_sources) {
          for (const source of income_sources) {
            if (source.is_recurring) {
              const occurrences = count_occurrences(source, month_start)
              const monthly_gross = source.amount * occurrences
              console.log(`${source.description}: $${source.amount} × ${occurrences} = $${monthly_gross}`)
              gross += monthly_gross
            } else {
              const income_date = new Date(source.date)
              if (income_date >= month_start && income_date <= month_end) {
                console.log(`${source.description} (one-time): $${source.amount}`)
                gross += source.amount
              }
            }
          }
        }
        
        console.log(`Total Gross: $${gross}`)
        
        // Calculate net income and savings breakdown
        let total_deductions = 0
        let auto_savings = 0
        let retirement_401k = 0
        let hsa = 0
        
        if (income_sources) {
          for (const source of income_sources) {
            if (!source.is_recurring) continue
            
            const occurrences = count_occurrences(source, month_start)
            const deductions = deductions_map[source.id]
            
            console.log(`Deductions for ${source.description}:`, deductions)
            
            if (deductions) {
              const monthly_deductions = (
                (deductions.federal_tax_monthly || 0) +
                (deductions.state_tax_monthly || 0) +
                (deductions.local_tax_monthly || 0) +
                (deductions.fica_monthly || 0) +
                (deductions.retirement_401k_monthly || 0) +
                (deductions.hsa_monthly || 0) +
                (deductions.medical_monthly || 0) +
                (deductions.dental_monthly || 0) +
                (deductions.vision_monthly || 0) +
                (deductions.life_ins_monthly || 0) +
                (deductions.ad_d_monthly || 0) +
                (deductions.critical_illness_monthly || 0) +
                (deductions.hospital_monthly || 0) +
                (deductions.accident_monthly || 0) +
                (deductions.legal_monthly || 0) +
                (deductions.identity_theft_monthly || 0) +
                (deductions.auto_savings_monthly || 0)
              ) * occurrences
              
              console.log(`Total deductions for ${source.description}: $${monthly_deductions / occurrences} × ${occurrences} = $${monthly_deductions}`)
              
              total_deductions += monthly_deductions
              auto_savings += (deductions.auto_savings_monthly || 0) * occurrences
              retirement_401k += (deductions.retirement_401k_monthly || 0) * occurrences
              hsa += (deductions.hsa_monthly || 0) * occurrences
            }
          }
        }
        
        console.log(`Total Deductions: $${total_deductions}`)
        console.log(`Auto Savings: $${auto_savings}`)
        console.log(`401k: $${retirement_401k}`)
        console.log(`HSA: $${hsa}`)
        
        const net = gross - total_deductions
        console.log(`Net Income: $${net}`)
        
        // Apply overrides or use defaults
        const gross_income = override?.gross_income_override || gross
        const housing = override?.housing_override || 0
        const budget = override?.budget_override || default_budget
        const additional = override?.additional_expenses || 0
        
        const projected = housing + budget + additional
        const savings = net - projected
        const savings_rate = net > 0 ? (savings / net) * 100 : 0

        months_data.push({
          month: month_year,
          month_name,
          gross_income,
          net_income: net,
          housing,
          budget,
          additional,
          projected,
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

  const calculate_gross_income = async (user_id: string, month_date: Date): Promise<number> => {
    // Get all income (both recurring and one-time)
    const { data: income_sources, error } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user_id)

    if (error) {
      console.error('Error fetching income:', error)
      return 0
    }

    console.log('Income sources:', income_sources)

    if (!income_sources) return 0

    let total = 0
    const month_start = startOfMonth(month_date)
    const month_end = endOfMonth(month_date)
    
    for (const source of income_sources) {
      if (source.is_recurring) {
        // Recurring income
        const occurrences = count_occurrences(source, month_start)
        const source_total = source.amount * occurrences
        console.log(`${source.description} (recurring): $${source.amount} × ${occurrences} = $${source_total}`)
        total += source_total
      } else {
        // One-time income - check if date is in this month
        const income_date = new Date(source.date)
        if (income_date >= month_start && income_date <= month_end) {
          console.log(`${source.description} (one-time): $${source.amount}`)
          total += source.amount
        }
      }
    }

    console.log('Total gross income:', total)
    return total
  }

  const calculate_net_income = async (user_id: string, month_date: Date, gross: number): Promise<number> => {
    // Get deductions from income table
    const { data: income_sources } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user_id)

    if (!income_sources) return gross

    let total_deductions = 0
    const month_start = startOfMonth(month_date)
    const month_end = endOfMonth(month_date)
    
    for (const source of income_sources) {
      if (!source.is_recurring) continue // One-time income doesn't have deductions
      
      const occurrences = count_occurrences(source, month_start)
      
      // Get deductions from salary_deductions table
      const { data: deductions } = await supabase
        .from('salary_deductions')
        .select('*')
        .eq('income_id', source.id)
        .single()
      
      if (deductions) {
        const monthly_deductions = (
          (deductions.federal_tax_monthly || 0) +
          (deductions.state_tax_monthly || 0) +
          (deductions.local_tax_monthly || 0) +
          (deductions.fica_monthly || 0) +
          (deductions.retirement_401k_monthly || 0) +
          (deductions.hsa_monthly || 0) +
          (deductions.medical_monthly || 0) +
          (deductions.dental_monthly || 0) +
          (deductions.vision_monthly || 0) +
          (deductions.life_ins_monthly || 0) +
          (deductions.ad_d_monthly || 0) +
          (deductions.critical_illness_monthly || 0) +
          (deductions.hospital_monthly || 0) +
          (deductions.accident_monthly || 0) +
          (deductions.legal_monthly || 0) +
          (deductions.identity_theft_monthly || 0) +
          (deductions.auto_savings_monthly || 0)
        ) * occurrences
        
        console.log(`${source.description} deductions:`, {
          federal_tax: deductions.federal_tax_monthly,
          state_tax: deductions.state_tax_monthly,
          retirement_401k: deductions.retirement_401k_monthly,
          hsa: deductions.hsa_monthly,
          auto_savings: deductions.auto_savings_monthly,
          total_deductions: monthly_deductions
        })
        
        total_deductions += monthly_deductions
      }
    }

    console.log('Total deductions:', total_deductions)
    console.log('Net income:', gross - total_deductions)
    return gross - total_deductions
  }

  const get_savings_breakdown = async (user_id: string, month_date: Date) => {
    const { data: income_sources } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user_id)

    if (!income_sources) return { auto_savings: 0, retirement_401k: 0, hsa: 0 }

    let auto_savings = 0
    let retirement_401k = 0
    let hsa = 0
    const month_start = startOfMonth(month_date)
    
    for (const source of income_sources) {
      if (!source.is_recurring) continue
      
      const occurrences = count_occurrences(source, month_start)
      
      // Get deductions from salary_deductions table
      const { data: deductions } = await supabase
        .from('salary_deductions')
        .select('*')
        .eq('income_id', source.id)
        .single()
      
      if (deductions) {
        auto_savings += (deductions.auto_savings_monthly || 0) * occurrences
        retirement_401k += (deductions.retirement_401k_monthly || 0) * occurrences
        hsa += (deductions.hsa_monthly || 0) * occurrences
      }
    }

    console.log('Savings breakdown:', { auto_savings, retirement_401k, hsa })
    return { auto_savings, retirement_401k, hsa }
  }

  const calculate_budget = async (user_id: string, month_year: string): Promise<number> => {
    // Check budget history first
    const { data: history } = await supabase
      .from('category_budget_history')
      .select('monthly_budget')
      .eq('user_id', user_id)
      .eq('month_year', month_year)

    if (history && history.length > 0) {
      return history.reduce((sum, h) => sum + parseFloat(h.monthly_budget.toString()), 0)
    }

    // Use current budgets
    const { data: categories } = await supabase
      .from('categories')
      .select('monthly_budget')
      .eq('user_id', user_id)

    if (!categories) return 0

    return categories.reduce((sum, c) => sum + parseFloat(c.monthly_budget.toString()), 0)
  }

  const count_occurrences = (income: any, month_start: Date): number => {
    // For salary income, use pay_frequency; for other recurring, use frequency
    const frequency = income.is_salary ? income.pay_frequency : income.frequency
    
    if (!frequency) {
      console.log(`No frequency for ${income.description}`)
      return 0
    }

    // Normalize frequency to lowercase for comparison
    const freq = frequency.toLowerCase()
    
    console.log(`Counting occurrences for ${income.description} (is_salary: ${income.is_salary}) with frequency: ${freq}`)

    if (freq === 'monthly') return 1
    if (freq === 'semi-monthly') return 2
    if (freq === 'weekly') return 4
    if (freq === 'bi-weekly' || freq === 'biweekly' || freq === 'bi weekly') {
      // Bi-weekly means every 2 weeks = 26 paychecks per year
      // Most months have 2, but 2 months per year will have 3
      // For now, use average: 26/12 = 2.167 (round to 2 for simplicity)
      // TODO: Calculate exact based on start_date if needed
      return 2
    }
    
    console.warn(`Unknown frequency: ${frequency}`)
    return 0
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
      if (edit_field === 'housing') {
        update_data.housing_override = parseFloat(edit_value)
        update_data.housing_notes = edit_notes
      }
      if (edit_field === 'budget') update_data.budget_override = parseFloat(edit_value)
      if (edit_field === 'additional') {
        update_data.additional_expenses = parseFloat(edit_value)
        update_data.additional_notes = edit_notes
      }

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
          if (edit_field === 'housing') {
            new_month.housing = parseFloat(edit_value)
          }
          if (edit_field === 'budget') {
            new_month.budget = parseFloat(edit_value)
          }
          if (edit_field === 'additional') {
            new_month.additional = parseFloat(edit_value)
          }

          // Recalculate dependent values
          new_month.projected = new_month.housing + new_month.budget + new_month.additional
          new_month.savings = new_month.net_income - new_month.projected
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

  // Calculate totals
  const total_gross = months.reduce((sum, m) => sum + m.gross_income, 0)
  const total_net = months.reduce((sum, m) => sum + m.net_income, 0)
  const total_budget = months.reduce((sum, m) => sum + m.housing + m.budget, 0)
  const total_auto_savings = months.reduce((sum, m) => sum + m.auto_savings, 0)
  const total_401k = months.reduce((sum, m) => sum + m.retirement_401k, 0)
  const total_hsa = months.reduce((sum, m) => sum + m.hsa, 0)
  const total_cash_savings = months.reduce((sum, m) => sum + m.savings, 0)
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
        <button
          onClick={() => setYear(year + 1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronRight size={24} />
        </button>
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
            <div>Auto: ${total_auto_savings.toLocaleString()} ({((total_auto_savings / total_savings) * 100).toFixed(0)}%)</div>
            <div>401k: ${total_401k.toLocaleString()} ({((total_401k / total_savings) * 100).toFixed(0)}%)</div>
            <div>HSA: ${total_hsa.toLocaleString()} ({((total_hsa / total_savings) * 100).toFixed(0)}%)</div>
            <div>Cash: ${total_cash_savings.toLocaleString()} ({((total_cash_savings / total_savings) * 100).toFixed(0)}%)</div>
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
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Net</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Housing ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Budget ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Add'l ✎</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Projected</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Savings</th>
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
                
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  ${month.net_income.toLocaleString()}
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
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={save_edit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
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
