'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, TrendingUp, Edit2, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

type SalaryCalculation = {
  gross_yearly: number
  deductions: {
    pre_tax_401k: number
    pre_tax_401k_roth: number
    hsa: number
    medical_insurance: number
    dental_insurance: number
    vision_insurance: number
    federal_tax: number
    state_tax: number
    social_security: number
    medicare: number
    fica_total: number
    ca_disability: number
    after_tax_401k: number
    after_tax_401k_roth: number
    life_insurance: number
    ad_d: number
    critical_illness: number
    hospital_indemnity: number
    accident_insurance: number
    legal_plan: number
    identity_theft: number
    auto_savings: number
  }
  net_yearly: number
  net_monthly: number
  net_biweekly: number
}

type Income = {
  id: string
  source: string
  amount: number
  frequency: string
  date: string
  is_recurring: boolean
  is_salary: boolean
  yearly_salary: number | null
  pay_frequency: string | null
  next_pay_date: string | null
  start_date: string | null
  end_date: string | null
}

export default function IncomePage() {
  const [income, setIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [show_add_form, setShowAddForm] = useState(false)
  const [edit_income, setEditIncome] = useState<Income | null>(null)
  const [filter_month, setFilterMonth] = useState<string>(format(new Date(), 'yyyy-MM'))
  
  // Draft and applied filters for search button
  const [applied_month, setAppliedMonth] = useState<string>(format(new Date(), 'MMMM'))
  const [applied_year, setAppliedYear] = useState<string>(format(new Date(), 'yyyy'))
  const [draft_month, setDraftMonth] = useState<string>(format(new Date(), 'MMMM'))
  const [draft_year, setDraftYear] = useState<string>(format(new Date(), 'yyyy'))
  
  // Form state
  const [source, setSource] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('one-time')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [is_salary, setIsSalary] = useState(false)
  const [pay_frequency, setPayFrequency] = useState('bi-weekly')
  const [next_pay_date, setNextPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  // Start/End date for recurring income
  const [has_start_date, setHasStartDate] = useState(false)
  const [start_date, setStartDate] = useState('')
  const [has_end_date, setHasEndDate] = useState(false)
  const [end_date, setEndDate] = useState('')

  // Salary calculator state
  const [salary_calc, setSalaryCalc] = useState<SalaryCalculation | null>(null)
  const [loaded_salary_values, setLoadedSalaryValues] = useState<any>(null)

  useEffect(() => {
    load_income()
  }, [])

  // Update filter_month when applied values change
  useEffect(() => {
    const month_names = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December']
    const month_index = month_names.indexOf(applied_month) + 1
    const month_str = month_index.toString().padStart(2, '0')
    setFilterMonth(`${applied_year}-${month_str}`)
  }, [applied_month, applied_year])

  const apply_filters = () => {
    setAppliedMonth(draft_month)
    setAppliedYear(draft_year)
  }

  const clear_filters = () => {
    const current_month = format(new Date(), 'MMMM')
    const current_year = format(new Date(), 'yyyy')
    
    setDraftMonth(current_month)
    setDraftYear(current_year)
    setAppliedMonth(current_month)
    setAppliedYear(current_year)
  }

  const load_income = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('income')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (data) setIncome(data)
    } catch (err) {
      console.error('Error loading income:', err)
    } finally {
      setLoading(false)
    }
  }

  const add_income = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let income_data: any = {
        user_id: user.id,
        source,
        is_recurring: is_salary || frequency !== 'one-time',
        is_salary,
      }

      if (is_salary && salary_calc) {
        income_data = {
          ...income_data,
          amount: salary_calc.net_biweekly,
          frequency: pay_frequency,
          date: next_pay_date,
          yearly_salary: salary_calc.gross_yearly,
          pay_frequency,
          next_pay_date,
        }
      } else {
        income_data = {
          ...income_data,
          amount: parseFloat(amount),
          frequency,
          date,
        }
      }
      
      // Add start/end dates if specified
      if (has_start_date && start_date) {
        income_data.start_date = start_date
      }
      if (has_end_date && end_date) {
        income_data.end_date = end_date
      }

      const { data: new_income, error } = await supabase
        .from('income')
        .insert(income_data)
        .select()
        .single()

      if (error) throw error

      // If salary, insert deductions breakdown
      if (is_salary && salary_calc && new_income) {
        const { error: deduction_error } = await supabase
          .from('salary_deductions')
          .insert({
            income_id: new_income.id,
            ...salary_calc.deductions,
            net_yearly: salary_calc.net_yearly,
            net_monthly: salary_calc.net_monthly,
            net_biweekly: salary_calc.net_biweekly,
            net_weekly: salary_calc.net_yearly / 52,
          })
        
        if (deduction_error) {
          console.error('Failed to save salary deductions:', deduction_error)
          alert('Income saved but salary deductions failed to save. Error: ' + deduction_error.message)
        }
      }

      setShowAddForm(false)
      reset_form()
      load_income()
    } catch (err) {
      console.error('Error adding income:', err)
      alert('Failed to add income')
    }
  }

  const update_income = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit_income) return
    
    try {
      let update_data: any = {
        source,
        is_recurring: is_salary || frequency !== 'one-time',
        is_salary,
      }

      if (is_salary && salary_calc) {
        update_data = {
          ...update_data,
          amount: salary_calc.net_biweekly,
          frequency: pay_frequency,
          date: next_pay_date,
          yearly_salary: salary_calc.gross_yearly,
          pay_frequency,
          next_pay_date,
        }

        // Update or insert salary deductions
        const { data: existing_deductions } = await supabase
          .from('salary_deductions')
          .select('id')
          .eq('income_id', edit_income.id)
          .single()

        const deduction_data = {
          ...salary_calc.deductions,
          net_yearly: salary_calc.net_yearly,
          net_monthly: salary_calc.net_monthly,
          net_biweekly: salary_calc.net_biweekly,
          net_weekly: salary_calc.net_yearly / 52,
        }

        if (existing_deductions) {
          const { error: update_error } = await supabase
            .from('salary_deductions')
            .update(deduction_data)
            .eq('id', existing_deductions.id)
          
          if (update_error) {
            console.error('Failed to update salary deductions:', update_error)
            alert('Income updated but deductions failed to update. Error: ' + update_error.message)
          }
        } else {
          const { error: insert_error } = await supabase
            .from('salary_deductions')
            .insert({
              income_id: edit_income.id,
              ...deduction_data,
            })
          
          if (insert_error) {
            console.error('Failed to insert salary deductions:', insert_error)
            alert('Income updated but deductions failed to save. Error: ' + insert_error.message)
          }
        }
      } else {
        update_data = {
          ...update_data,
          amount: parseFloat(amount),
          frequency,
          date,
          yearly_salary: null,
          pay_frequency: null,
          next_pay_date: null,
        }
      }
      
      // Add start/end dates
      update_data.start_date = has_start_date && start_date ? start_date : null
      update_data.end_date = has_end_date && end_date ? end_date : null
      
      // Warn user if changing amount value
      if (edit_income.amount !== parseFloat(amount)) {
        if (!confirm('⚠️ Warning: Changing this income amount will update all previous entries tied to this income source in your history. Continue?')) {
          return
        }
      }

      const { error } = await supabase
        .from('income')
        .update(update_data)
        .eq('id', edit_income.id)

      if (error) throw error

      setEditIncome(null)
      reset_form()
      load_income()
    } catch (err) {
      console.error('Error updating income:', err)
      alert('Failed to update income')
    }
  }

  const delete_income = async (id: string) => {
    if (!confirm('Delete this income entry?')) return

    try {
      const { error } = await supabase
        .from('income')
        .delete()
        .eq('id', id)

      if (error) throw error
      load_income()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Failed to delete')
    }
  }

  const start_edit = async (inc: Income) => {
    setEditIncome(inc)
    setSource(inc.source)
    setAmount(inc.amount.toString())
    setFrequency(inc.frequency)
    setDate(inc.date)
    setIsSalary(inc.is_salary)
    
    // Load start/end dates
    setHasStartDate(!!inc.start_date)
    setStartDate(inc.start_date || '')
    setHasEndDate(!!inc.end_date)
    setEndDate(inc.end_date || '')
    
    if (inc.is_salary) {
      setPayFrequency(inc.pay_frequency || 'bi-weekly')
      setNextPayDate(inc.next_pay_date || format(new Date(), 'yyyy-MM-dd'))
      
      // Load salary deductions from database
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: deductions } = await supabase
          .from('salary_deductions')
          .select('*')
          .eq('income_id', inc.id)
          .single()

        if (deductions) {
          // Convert yearly amounts back to input format
          const yearly_salary = inc.yearly_salary || 0
          
          // Calculate percentages from yearly amounts
          const k401_yearly = deductions.pre_tax_401k || 0
          const k401_roth_yearly = deductions.pre_tax_401k_roth || 0
          const k401_after_yearly = deductions.after_tax_401k || 0
          
          // Calculate taxable income to derive tax percentages
          const total_pre_tax = k401_yearly + k401_roth_yearly + (deductions.hsa || 0) + 
            (deductions.medical_insurance || 0) + (deductions.dental_insurance || 0) + (deductions.vision_insurance || 0)
          const taxable_income = yearly_salary - total_pre_tax
          
          const values = {
            gross_yearly: yearly_salary,
            k401_pct: yearly_salary > 0 ? ((k401_yearly / yearly_salary) * 100).toFixed(2) : '0.00',
            k401_roth_pct: yearly_salary > 0 ? ((k401_roth_yearly / yearly_salary) * 100).toFixed(2) : '0.00',
            hsa_monthly: ((deductions.hsa || 0) / 12).toFixed(2),
            medical_monthly: ((deductions.medical_insurance || 0) / 12).toFixed(2),
            dental_monthly: ((deductions.dental_insurance || 0) / 12).toFixed(2),
            vision_monthly: ((deductions.vision_insurance || 0) / 12).toFixed(2),
            federal_tax_pct: taxable_income > 0 ? (((deductions.federal_tax || 0) / taxable_income) * 100).toFixed(2) : '0.00',
            state_tax_pct: taxable_income > 0 ? (((deductions.state_tax || 0) / taxable_income) * 100).toFixed(2) : '0.00',
            ca_disability_pct: yearly_salary > 0 ? (((deductions.ca_disability || 0) / yearly_salary) * 100).toFixed(2) : '0.00',
            k401_after_pct: yearly_salary > 0 ? ((k401_after_yearly / (yearly_salary - total_pre_tax - (deductions.federal_tax || 0) - (deductions.state_tax || 0) - (deductions.social_security || 0) - (deductions.medicare || 0) - (deductions.ca_disability || 0))) * 100).toFixed(2) : '0.00',
            life_ins_monthly: ((deductions.life_insurance || 0) / 12).toFixed(2),
            ad_d_monthly: ((deductions.ad_d || 0) / 12).toFixed(2),
            critical_illness_monthly: ((deductions.critical_illness || 0) / 12).toFixed(2),
            hospital_monthly: ((deductions.hospital_indemnity || 0) / 12).toFixed(2),
            accident_monthly: ((deductions.accident_insurance || 0) / 12).toFixed(2),
            legal_monthly: ((deductions.legal_plan || 0) / 12).toFixed(2),
            identity_theft_monthly: ((deductions.identity_theft || 0) / 12).toFixed(2),
            auto_savings_monthly: ((deductions.auto_savings || 0) / 12).toFixed(2),
          }
          setLoadedSalaryValues(values)
        } else {
          // No existing deductions, use zeros
          setLoadedSalaryValues({})
        }
      } catch (err) {
        console.error('Error loading salary deductions:', err)
        setLoadedSalaryValues({})
      }
    } else {
      setLoadedSalaryValues(null)
    }
  }

  const reset_form = () => {
    setSource('')
    setAmount('')
    setFrequency('one-time')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setIsSalary(false)
    setPayFrequency('bi-weekly')
    setNextPayDate(format(new Date(), 'yyyy-MM-dd'))
    setHasStartDate(false)
    setStartDate('')
    setHasEndDate(false)
    setEndDate('')
    setSalaryCalc(null)
    setLoadedSalaryValues(null)
  }

  const get_monthly_income = () => {
    const [year, month] = filter_month.split('-')
    const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1))
    const end = endOfMonth(new Date(parseInt(year), parseInt(month) - 1))
    
    return income.filter(i => {
      const income_date = new Date(i.date)
      return income_date >= start && income_date <= end
    }).reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0)
  }

  // Calculate actual income earned so far this month
  const get_actual_earned = () => {
    const [year, month] = filter_month.split('-')
    const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1))
    const end = endOfMonth(new Date(parseInt(year), parseInt(month) - 1))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let total = 0
    
    income.forEach(inc => {
      const amt = parseFloat(inc.amount.toString())
      
      if (!inc.is_recurring) {
        // One-time income: count if date is in month AND has passed
        const income_date = new Date(inc.date)
        if (income_date >= start && income_date <= end && income_date <= today) {
          total += amt
        }
      } else {
        // Recurring income: count actual occurrences that have passed
        const occurrences = count_income_occurrences(inc, start, end, today)
        total += occurrences * amt
      }
    })
    
    return total
  }
  
  // Calculate expected income remaining this month
  const get_expected_remaining = () => {
    const [year, month] = filter_month.split('-')
    const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1))
    const end = endOfMonth(new Date(parseInt(year), parseInt(month) - 1))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    let total = 0
    
    income.forEach(inc => {
      const amt = parseFloat(inc.amount.toString())
      
      if (!inc.is_recurring) {
        // One-time income: count if date is in month AND in future
        const income_date = new Date(inc.date)
        if (income_date >= start && income_date <= end && income_date >= tomorrow) {
          total += amt
        }
      } else {
        // Recurring income: count future occurrences
        const occurrences = count_income_occurrences(inc, start, end, null, tomorrow)
        total += occurrences * amt
      }
    })
    
    return total
  }
  
  // Helper: Count how many times a recurring income occurs in a date range
  const count_income_occurrences = (
    income_entry: any, 
    range_start: Date, 
    range_end: Date, 
    cutoff_date?: Date | null,  // Only count up to this date (for past)
    from_date?: Date  // Only count from this date onwards (for future)
  ) => {
    const start_date = new Date(income_entry.date)
    let count = 0
    
    // Determine the actual start of our counting
    const count_start = from_date && from_date > start_date ? from_date : start_date
    if (count_start > range_end) return 0
    
    // Determine frequency in days
    let freq_days = 0
    if (income_entry.frequency === 'weekly') freq_days = 7
    else if (income_entry.frequency === 'bi-weekly') freq_days = 14
    else if (income_entry.frequency === 'monthly') freq_days = 30 // approximate, we'll handle monthly specially
    else if (income_entry.frequency === 'yearly') freq_days = 365
    
    if (income_entry.frequency === 'monthly') {
      // For monthly, count months between dates
      let current = new Date(count_start)
      while (current <= range_end) {
        if (current >= range_start && (!cutoff_date || current <= cutoff_date)) {
          count++
        }
        // Move to next month, same day
        current = new Date(current.getFullYear(), current.getMonth() + 1, start_date.getDate())
      }
    } else {
      // For weekly, bi-weekly, yearly
      let current = new Date(count_start)
      while (current <= range_end) {
        if (current >= range_start && (!cutoff_date || current <= cutoff_date)) {
          count++
        }
        current.setDate(current.getDate() + freq_days)
      }
    }
    
    return count
  }

  const get_recurring_monthly = () => {
    return income.reduce((sum, i) => {
      if (!i.is_recurring) return sum
      const amt = parseFloat(i.amount.toString())
      if (i.frequency === 'monthly') return sum + amt
      if (i.frequency === 'bi-weekly') return sum + (amt * 2.17)
      if (i.frequency === 'weekly') return sum + (amt * 4.33)
      if (i.frequency === 'yearly') return sum + (amt / 12)
      return sum
    }, 0)
  }

  const actual_earned = get_actual_earned()
  const expected_remaining = get_expected_remaining()
  const recurring_estimate = get_recurring_monthly()

  // Helper to check if income is expired
  const is_expired = (inc: Income) => {
    if (!inc.end_date) return false
    const end = new Date(inc.end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return end < today
  }

  // Sort income: active first, expired last
  const sorted_income = [...income].sort((a, b) => {
    const a_expired = is_expired(a)
    const b_expired = is_expired(b)
    if (a_expired && !b_expired) return 1
    if (!a_expired && b_expired) return -1
    // Both same status, sort by date descending
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-3 md:p-8">
        <div className="mb-4 md:mb-8">
          <h2 className="text-xl md:text-3xl font-bold text-gray-800">Income</h2>
          <p className="text-gray-600 mt-1 text-xs md:text-base">Track your earnings</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 md:px-6 md:py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
          >
            <Plus size={18} />
            Add Income
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-6 mb-3 md:mb-6">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg p-3 md:p-6">
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <span className="text-xs md:text-sm opacity-90">Earned This Month</span>
              <TrendingUp size={16} />
            </div>
            <div className="text-2xl md:text-4xl font-bold">${actual_earned.toFixed(2)}</div>
            <div className="text-xs mt-1 md:mt-2 opacity-80">
              Received so far in {format(new Date(parseInt(filter_month.split('-')[0]), parseInt(filter_month.split('-')[1]) - 1, 1), 'MMMM yyyy')}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-3 md:p-6">
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <span className="text-xs md:text-sm opacity-90">Expected Remaining</span>
              <TrendingUp size={16} />
            </div>
            <div className="text-2xl md:text-4xl font-bold">${expected_remaining.toFixed(2)}</div>
            <div className="text-xs mt-1 md:mt-2 opacity-80">
              Still to be received this month
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg p-3 md:p-6">
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <span className="text-xs md:text-sm opacity-90">Monthly Average (Recurring)</span>
              <TrendingUp size={16} />
            </div>
            <div className="text-2xl md:text-4xl font-bold">${recurring_estimate.toFixed(2)}</div>
            <div className="text-xs mt-1 md:mt-2 opacity-80">
              {income.filter(i => i.is_recurring).length} recurring sources
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-6 mb-3 md:mb-6">
          <h3 className="text-sm md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Filter</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Month Dropdown */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                Month
              </label>
              <select
                value={draft_month}
                onChange={(e) => setDraftMonth(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="January">January</option>
                <option value="February">February</option>
                <option value="March">March</option>
                <option value="April">April</option>
                <option value="May">May</option>
                <option value="June">June</option>
                <option value="July">July</option>
                <option value="August">August</option>
                <option value="September">September</option>
                <option value="October">October</option>
                <option value="November">November</option>
                <option value="December">December</option>
              </select>
            </div>

            {/* Year Dropdown */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                value={draft_year}
                onChange={(e) => setDraftYear(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() - 5 + i
                  return (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          {/* Search and Clear Buttons */}
          <div className="flex gap-3">
            <button
              onClick={apply_filters}
              className="flex-1 md:flex-none md:px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
            >
              Search
            </button>
            <button
              onClick={clear_filters}
              className="flex-1 md:flex-none md:px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Add/Edit Form Modal */}
        {(show_add_form || edit_income) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {edit_income ? 'Edit Income' : 'Add Income'}
                </h3>
                <button
                  onClick={() => {
                    edit_income ? setEditIncome(null) : setShowAddForm(false)
                    reset_form()
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={edit_income ? update_income : add_income} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source
                  </label>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g., Salary, Freelance, Side Hustle"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Salary Toggle */}
                <div className="border-t border-b border-gray-200 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Is this a salary?</label>
                      <p className="text-xs text-gray-500">Auto-calculate with deductions</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSalary(!is_salary)}
                      className={`relative w-14 h-7 rounded-full transition ${is_salary ? 'bg-emerald-600' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition transform ${is_salary ? 'translate-x-7' : ''}`}></div>
                    </button>
                  </div>

                  {is_salary && (
                    <>
                      <SalaryCalculatorInline 
                        key={loaded_salary_values ? 'editing' : 'new'}
                        onChange={setSalaryCalc} 
                        initialValues={loaded_salary_values}
                      />
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pay Frequency
                          </label>
                          <select
                            value={pay_frequency}
                            onChange={(e) => setPayFrequency(e.target.value)}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="bi-weekly">Bi-weekly</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="semi-monthly">Semi-monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Next Pay Date
                          </label>
                          <input
                            type="date"
                            value={next_pay_date}
                            onChange={(e) => setNextPayDate(e.target.value)}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required={is_salary}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {!is_salary && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frequency
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="one-time">One-time</option>
                        <option value="weekly">Weekly</option>
                        <option value="bi-weekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </>
                )}

                {/* Start/End Date for Recurring Income */}
                {(is_salary || frequency !== 'one-time') && (
                  <div className="col-span-2 space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">Optional: Set Start/End Dates</p>
                    
                    {/* Start Date */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="has_start_date"
                        checked={has_start_date}
                        onChange={(e) => setHasStartDate(e.target.checked)}
                        className="mt-1 w-4 h-4 text-emerald-600 rounded"
                      />
                      <div className="flex-1">
                        <label htmlFor="has_start_date" className="text-sm text-gray-700 cursor-pointer">
                          <span className="font-medium">Start Date</span> - Income begins on this date
                        </label>
                        {has_start_date && (
                          <input
                            type="date"
                            value={start_date}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          />
                        )}
                      </div>
                    </div>

                    {/* End Date */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="has_end_date"
                        checked={has_end_date}
                        onChange={(e) => setHasEndDate(e.target.checked)}
                        className="mt-1 w-4 h-4 text-emerald-600 rounded"
                      />
                      <div className="flex-1">
                        <label htmlFor="has_end_date" className="text-sm text-gray-700 cursor-pointer">
                          <span className="font-medium">End Date</span> - Income expires/ends on this date
                        </label>
                        {has_end_date && (
                          <input
                            type="date"
                            value={end_date}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      edit_income ? setEditIncome(null) : setShowAddForm(false)
                      reset_form()
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700"
                  >
                    {edit_income ? 'Update Income' : 'Add Income'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Income List */}
        {income.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-4">No income recorded yet.</p>
            <p>Start tracking your earnings!</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sorted_income.map((inc) => {
                    const expired = is_expired(inc)
                    return (
                    <tr key={inc.id} className={`hover:bg-gray-50 ${expired ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(inc.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-800">{inc.source}</div>
                          {expired && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              Expired
                            </span>
                          )}
                        </div>
                        {inc.is_salary && inc.yearly_salary && (
                          <div className="text-xs text-emerald-600">
                            Salary • ${inc.yearly_salary.toLocaleString()}/year
                          </div>
                        )}
                        {inc.start_date && (
                          <div className="text-xs text-gray-500">
                            Start: {format(new Date(inc.start_date), 'MMM d, yyyy')}
                          </div>
                        )}
                        {inc.end_date && (
                          <div className="text-xs text-gray-500">
                            End: {format(new Date(inc.end_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          inc.is_salary ? 'bg-emerald-100 text-emerald-700' :
                          inc.is_recurring ? 'bg-blue-100 text-blue-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {inc.is_salary ? 'Salary' : inc.frequency.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-emerald-600">
                        ${parseFloat(inc.amount.toString()).toFixed(2)}
                        {inc.is_salary && inc.pay_frequency && (
                          <div className="text-xs text-gray-500">per {inc.pay_frequency.replace('-', ' ')}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => start_edit(inc)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => delete_income(inc.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Inline Salary Calculator Component
function SalaryCalculatorInline({ 
  onChange, 
  initialValues 
}: { 
  onChange: (calc: SalaryCalculation) => void
  initialValues?: any
}) {
  // Use initial values if provided, otherwise use defaults (or zeros for new)
  const defaults = initialValues || {}
  const [gross_salary, setGrossSalary] = useState(defaults.gross_yearly?.toString() || '0')
  const [k401_pct, set401kPct] = useState(defaults.k401_pct?.toString() || '0.00')
  const [k401_roth_pct, set401kRothPct] = useState(defaults.k401_roth_pct?.toString() || '0.00')
  const [hsa_monthly, setHsaMonthly] = useState(defaults.hsa_monthly?.toString() || '0.00')
  const [medical_monthly, setMedicalMonthly] = useState(defaults.medical_monthly?.toString() || '0.00')
  const [dental_monthly, setDentalMonthly] = useState(defaults.dental_monthly?.toString() || '0.00')
  const [vision_monthly, setVisionMonthly] = useState(defaults.vision_monthly?.toString() || '0.00')
  const [federal_tax_pct, setFederalTaxPct] = useState(defaults.federal_tax_pct?.toString() || '0.00')
  const [state_tax_pct, setStateTaxPct] = useState(defaults.state_tax_pct?.toString() || '0.00')
  const [ca_disability_pct, setCaDisabilityPct] = useState(defaults.ca_disability_pct?.toString() || '0.00')
  const [k401_after_pct, set401kAfterPct] = useState(defaults.k401_after_pct?.toString() || '0.00')
  const [life_ins_monthly, setLifeInsMonthly] = useState(defaults.life_ins_monthly?.toString() || '0.00')
  const [ad_d_monthly, setAdDMonthly] = useState(defaults.ad_d_monthly?.toString() || '0.00')
  const [critical_illness_monthly, setCriticalIllnessMonthly] = useState(defaults.critical_illness_monthly?.toString() || '0.00')
  const [hospital_monthly, setHospitalMonthly] = useState(defaults.hospital_monthly?.toString() || '0.00')
  const [accident_monthly, setAccidentMonthly] = useState(defaults.accident_monthly?.toString() || '0.00')
  const [legal_monthly, setLegalMonthly] = useState(defaults.legal_monthly?.toString() || '0.00')
  const [identity_theft_monthly, setIdentityTheftMonthly] = useState(defaults.identity_theft_monthly?.toString() || '0.00')
  const [auto_savings_monthly, setAutoSavingsMonthly] = useState(defaults.auto_savings_monthly?.toString() || '0.00')

  useEffect(() => {
    const yearly = parseFloat(gross_salary) || 0
    if (yearly === 0) return

    const k401_yearly = yearly * (parseFloat(k401_pct) / 100)
    const k401_roth_yearly = yearly * (parseFloat(k401_roth_pct) / 100)
    const hsa_yearly = parseFloat(hsa_monthly) * 12
    const medical_yearly = parseFloat(medical_monthly) * 12
    const dental_yearly = parseFloat(dental_monthly) * 12
    const vision_yearly = parseFloat(vision_monthly) * 12

    const total_pre_tax = k401_yearly + k401_roth_yearly + hsa_yearly + medical_yearly + dental_yearly + vision_yearly
    const taxable_income = yearly - total_pre_tax

    const federal_tax = taxable_income * (parseFloat(federal_tax_pct) / 100)
    const state_tax = taxable_income * (parseFloat(state_tax_pct) / 100)
    const social_security = Math.min(yearly * 0.062, 160200 * 0.062)
    const medicare = yearly * 0.0145
    const ca_disability = yearly * (parseFloat(ca_disability_pct) / 100)
    const fica_total = social_security + medicare
    const total_taxes = federal_tax + state_tax + social_security + medicare + ca_disability

    const after_tax_income = yearly - total_pre_tax - total_taxes

    const k401_after_yearly = after_tax_income * (parseFloat(k401_after_pct) / 100)
    const life_ins_yearly = parseFloat(life_ins_monthly) * 12
    const ad_d_yearly = parseFloat(ad_d_monthly) * 12
    const critical_illness_yearly = parseFloat(critical_illness_monthly) * 12
    const hospital_yearly = parseFloat(hospital_monthly) * 12
    const accident_yearly = parseFloat(accident_monthly) * 12
    const legal_yearly = parseFloat(legal_monthly) * 12
    const identity_theft_yearly = parseFloat(identity_theft_monthly) * 12
    const auto_savings_yearly = parseFloat(auto_savings_monthly) * 12

    const total_after_tax = k401_after_yearly + life_ins_yearly + ad_d_yearly + critical_illness_yearly + 
      hospital_yearly + accident_yearly + legal_yearly + identity_theft_yearly + auto_savings_yearly

    const net_yearly = after_tax_income - total_after_tax

    const calculation: SalaryCalculation = {
      gross_yearly: yearly,
      deductions: {
        pre_tax_401k: k401_yearly,
        pre_tax_401k_roth: k401_roth_yearly,
        hsa: hsa_yearly,
        medical_insurance: medical_yearly,
        dental_insurance: dental_yearly,
        vision_insurance: vision_yearly,
        federal_tax: federal_tax,
        state_tax: state_tax,
        social_security: social_security,
        medicare: medicare,
        fica_total: fica_total,
        ca_disability: ca_disability,
        after_tax_401k: k401_after_yearly,
        after_tax_401k_roth: 0,
        life_insurance: life_ins_yearly,
        ad_d: ad_d_yearly,
        critical_illness: critical_illness_yearly,
        hospital_indemnity: hospital_yearly,
        accident_insurance: accident_yearly,
        legal_plan: legal_yearly,
        identity_theft: identity_theft_yearly,
        auto_savings: auto_savings_yearly,
      },
      net_yearly,
      net_monthly: net_yearly / 12,
      net_biweekly: net_yearly / 26,
    }

    onChange(calculation)
  }, [gross_salary, k401_pct, k401_roth_pct, hsa_monthly, medical_monthly, dental_monthly, vision_monthly,
      federal_tax_pct, state_tax_pct, ca_disability_pct, k401_after_pct, life_ins_monthly, ad_d_monthly,
      critical_illness_monthly, hospital_monthly, accident_monthly, legal_monthly, identity_theft_monthly, auto_savings_monthly, onChange])

  const calc_net = () => {
    const yearly = parseFloat(gross_salary) || 0
    if (yearly === 0) return { yearly: 0, monthly: 0, biweekly: 0 }

    const k401_yearly = yearly * (parseFloat(k401_pct) / 100)
    const k401_roth_yearly = yearly * (parseFloat(k401_roth_pct) / 100)
    const hsa_yearly = parseFloat(hsa_monthly) * 12
    const medical_yearly = parseFloat(medical_monthly) * 12
    const dental_yearly = parseFloat(dental_monthly) * 12
    const vision_yearly = parseFloat(vision_monthly) * 12
    const total_pre_tax = k401_yearly + k401_roth_yearly + hsa_yearly + medical_yearly + dental_yearly + vision_yearly
    const taxable_income = yearly - total_pre_tax
    const federal_tax = taxable_income * (parseFloat(federal_tax_pct) / 100)
    const state_tax = taxable_income * (parseFloat(state_tax_pct) / 100)
    const social_security = Math.min(yearly * 0.062, 160200 * 0.062)
    const medicare = yearly * 0.0145
    const ca_disability = yearly * (parseFloat(ca_disability_pct) / 100)
    const total_taxes = federal_tax + state_tax + social_security + medicare + ca_disability
    const after_tax_income = yearly - total_pre_tax - total_taxes
    const k401_after_yearly = after_tax_income * (parseFloat(k401_after_pct) / 100)
    const life_ins_yearly = parseFloat(life_ins_monthly) * 12
    const ad_d_yearly = parseFloat(ad_d_monthly) * 12
    const critical_illness_yearly = parseFloat(critical_illness_monthly) * 12
    const hospital_yearly = parseFloat(hospital_monthly) * 12
    const accident_yearly = parseFloat(accident_monthly) * 12
    const legal_yearly = parseFloat(legal_monthly) * 12
    const identity_theft_yearly = parseFloat(identity_theft_monthly) * 12
    const auto_savings_yearly = parseFloat(auto_savings_monthly) * 12
    const total_after_tax = k401_after_yearly + life_ins_yearly + ad_d_yearly + critical_illness_yearly + 
      hospital_yearly + accident_yearly + legal_yearly + identity_theft_yearly + auto_savings_yearly
    const net_yearly = after_tax_income - total_after_tax

    return {
      yearly: net_yearly,
      monthly: net_yearly / 12,
      biweekly: net_yearly / 26,
      // return individual amounts for display
      k401_yearly,
      k401_roth_yearly,
      federal_tax,
      state_tax,
      ca_disability,
      k401_after_yearly,
      taxable_income,
      after_tax_income
    }
  }

  const net = calc_net()
  const yearly = parseFloat(gross_salary) || 0

  return (
    <div className="mt-4 space-y-4 bg-emerald-50 rounded-lg p-4 border border-emerald-200">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Yearly Gross Salary</label>
        <div className="relative">
          <span className="absolute left-3 top-3 text-gray-500">$</span>
          <input
            type="number"
            step="0.01"
            value={gross_salary}
            onChange={(e) => setGrossSalary(e.target.value)}
            placeholder="105800.00"
            className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            401k % <span className="text-emerald-600">(${(net.k401_yearly || 0).toFixed(0)}/yr)</span>
          </label>
          <input type="number" step="0.01" value={k401_pct} onChange={(e) => set401kPct(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            401k Roth % <span className="text-emerald-600">(${(net.k401_roth_yearly || 0).toFixed(0)}/yr)</span>
          </label>
          <input type="number" step="0.01" value={k401_roth_pct} onChange={(e) => set401kRothPct(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">HSA/mo</label>
          <input type="number" step="0.01" value={hsa_monthly} onChange={(e) => setHsaMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Medical/mo</label>
          <input type="number" step="0.01" value={medical_monthly} onChange={(e) => setMedicalMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Dental/mo</label>
          <input type="number" step="0.01" value={dental_monthly} onChange={(e) => setDentalMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Vision/mo</label>
          <input type="number" step="0.01" value={vision_monthly} onChange={(e) => setVisionMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Fed Tax % <span className="text-red-600">(${(net.federal_tax || 0).toFixed(0)}/yr)</span>
          </label>
          <input type="number" step="0.01" value={federal_tax_pct} onChange={(e) => setFederalTaxPct(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            State Tax % <span className="text-red-600">(${(net.state_tax || 0).toFixed(0)}/yr)</span>
          </label>
          <input type="number" step="0.01" value={state_tax_pct} onChange={(e) => setStateTaxPct(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            CA Disability % <span className="text-red-600">(${(net.ca_disability || 0).toFixed(0)}/yr)</span>
          </label>
          <input type="number" step="0.01" value={ca_disability_pct} onChange={(e) => setCaDisabilityPct(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            401k After % <span className="text-blue-600">(${(net.k401_after_yearly || 0).toFixed(0)}/yr)</span>
          </label>
          <input type="number" step="0.01" value={k401_after_pct} onChange={(e) => set401kAfterPct(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Life Ins/mo</label>
          <input type="number" step="0.01" value={life_ins_monthly} onChange={(e) => setLifeInsMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">AD&D/mo</label>
          <input type="number" step="0.01" value={ad_d_monthly} onChange={(e) => setAdDMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Crit Illness/mo</label>
          <input type="number" step="0.01" value={critical_illness_monthly} onChange={(e) => setCriticalIllnessMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Hospital/mo</label>
          <input type="number" step="0.01" value={hospital_monthly} onChange={(e) => setHospitalMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Accident/mo</label>
          <input type="number" step="0.01" value={accident_monthly} onChange={(e) => setAccidentMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Legal/mo</label>
          <input type="number" step="0.01" value={legal_monthly} onChange={(e) => setLegalMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">ID Theft/mo</label>
          <input type="number" step="0.01" value={identity_theft_monthly} onChange={(e) => setIdentityTheftMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Auto Savings/mo <span className="text-blue-600">(${(parseFloat(auto_savings_monthly || '0') * 12).toFixed(0)}/yr)</span>
          </label>
          <input type="number" step="0.01" value={auto_savings_monthly} onChange={(e) => setAutoSavingsMonthly(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
        </div>
      </div>

      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg p-4">
        <div className="text-xs opacity-90 mb-1">Net Take-Home Pay</div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="opacity-75">Yearly</div>
            <div className="text-lg font-bold">${net.yearly.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          </div>
          <div>
            <div className="opacity-75">Monthly</div>
            <div className="text-lg font-bold">${net.monthly.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          </div>
          <div>
            <div className="opacity-75">Bi-Weekly</div>
            <div className="text-lg font-bold">${net.biweekly.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
