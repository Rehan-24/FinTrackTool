'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, TrendingUp, Edit2, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

type FicaMode = 'pct' | 'mo' | 'period'

type SalaryCalculation = {
  gross_yearly: number
  deductions: {
    // pre-tax
    pre_tax_401k: number
    pre_tax_401k_roth: number
    hsa: number
    fsa: number
    medical_insurance: number
    dental_insurance: number
    vision_insurance: number
    long_term_disability: number
    life_insurance: number
    // taxes
    federal_tax: number
    state_tax: number
    local_tax: number
    // fica
    social_security: number
    medicare: number
    fica_total: number
    ca_disability: number
    state_etc: number
    // after-tax
    after_tax_401k: number
    after_tax_401k_roth: number
    ad_d: number
    critical_illness: number
    hospital_indemnity: number
    accident_insurance: number
    legal_plan: number
    identity_theft: number
    // auto savings
    roth_ira: number
    hysa: number
    crypto: number
    personal_investments: number
    other_savings: number
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
          const gr = inc.yearly_salary || 0

          // pre-tax totals (to derive taxable income for tax % calculations)
          const k401_yr    = deductions.pre_tax_401k || 0
          const total_pre  = k401_yr + (deductions.hsa || 0) + (deductions.fsa || 0) +
            (deductions.medical_insurance || 0) + (deductions.dental_insurance || 0) +
            (deductions.vision_insurance || 0) + (deductions.long_term_disability || 0) +
            (deductions.life_insurance || 0)
          const taxable    = gr - total_pre

          // after-tax base (to derive after-tax % contributions)
          const total_tax  = (deductions.federal_tax || 0) + (deductions.state_tax || 0) +
            (deductions.local_tax || 0) + (deductions.social_security || 0) +
            (deductions.medicare || 0) + (deductions.ca_disability || 0) + (deductions.state_etc || 0)
          const after_tax  = gr - total_pre - total_tax

          const values = {
            gross_yearly:    gr,
            // pre-tax
            k401_pct:        gr > 0 ? ((k401_yr / gr) * 100).toFixed(2) : '0.00',
            medical_monthly: ((deductions.medical_insurance || 0) / 12).toFixed(2),
            dental_monthly:  ((deductions.dental_insurance  || 0) / 12).toFixed(2),
            vision_monthly:  ((deductions.vision_insurance  || 0) / 12).toFixed(2),
            ltd_monthly:     ((deductions.long_term_disability || 0) / 12).toFixed(2),
            life_ins_monthly:((deductions.life_insurance    || 0) / 12).toFixed(2),
            hsa_monthly:     ((deductions.hsa               || 0) / 12).toFixed(2),
            fsa_monthly:     ((deductions.fsa               || 0) / 12).toFixed(2),
            // taxes
            federal_tax_pct: taxable > 0 ? (((deductions.federal_tax || 0) / taxable) * 100).toFixed(2) : '0.00',
            state_tax_pct:   taxable > 0 ? (((deductions.state_tax   || 0) / taxable) * 100).toFixed(2) : '0.00',
            local_tax_pct:   taxable > 0 ? (((deductions.local_tax   || 0) / taxable) * 100).toFixed(2) : '0.00',
            // fica — store as % of gross (default mode)
            ss_val:          gr > 0 ? (((deductions.social_security || 0) / gr) * 100).toFixed(2) : '0.00',
            ss_mode:         'pct' as FicaMode,
            med_val:         gr > 0 ? (((deductions.medicare        || 0) / gr) * 100).toFixed(2) : '0.00',
            med_mode:        'pct' as FicaMode,
            cadis_val:       gr > 0 ? (((deductions.ca_disability   || 0) / gr) * 100).toFixed(2) : '0.00',
            cadis_mode:      'pct' as FicaMode,
            state_etc_val:   gr > 0 ? (((deductions.state_etc       || 0) / gr) * 100).toFixed(2) : '0.00',
            state_etc_mode:  'pct' as FicaMode,
            // after-tax
            k401_after_pct:  after_tax > 0 ? (((deductions.after_tax_401k      || 0) / after_tax) * 100).toFixed(2) : '0.00',
            k401_roth_pct:   after_tax > 0 ? (((deductions.after_tax_401k_roth || 0) / after_tax) * 100).toFixed(2) : '0.00',
            legal_monthly:   ((deductions.legal_plan         || 0) / 12).toFixed(2),
            critical_illness_monthly: ((deductions.critical_illness  || 0) / 12).toFixed(2),
            identity_theft_monthly:   ((deductions.identity_theft    || 0) / 12).toFixed(2),
            accident_monthly:((deductions.accident_insurance || 0) / 12).toFixed(2),
            hospital_monthly:((deductions.hospital_indemnity || 0) / 12).toFixed(2),
            ad_d_monthly:    ((deductions.ad_d               || 0) / 12).toFixed(2),
            // auto savings
            ira_monthly:     ((deductions.roth_ira              || 0) / 12).toFixed(2),
            hysa_monthly:    ((deductions.hysa                  || 0) / 12).toFixed(2),
            crypto_monthly:  ((deductions.crypto                || 0) / 12).toFixed(2),
            invest_monthly:  ((deductions.personal_investments  || 0) / 12).toFixed(2),
            other_savings_monthly: ((deductions.other_savings   || 0) / 12).toFixed(2),
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

// ── helpers ──────────────────────────────────────────────────────────────────
const PP = 26 // pay periods per year (bi-weekly)

function toYearly(val: string, mode: FicaMode, gross: number): number {
  const v = parseFloat(val) || 0
  if (mode === 'pct')    return gross * v / 100
  if (mode === 'mo')     return v * 12
  if (mode === 'period') return v * PP
  return 0
}

function fromYearly(yearly: number, mode: FicaMode, gross: number): string {
  let v = 0
  if (mode === 'pct')    v = gross > 0 ? (yearly / gross) * 100 : 0
  if (mode === 'mo')     v = yearly / 12
  if (mode === 'period') v = yearly / PP
  return v.toFixed(2)
}

function fmtYr(n: number): string {
  return `($${Math.round(Math.abs(n)).toLocaleString()}/yr)`
}

// ── sub-components ────────────────────────────────────────────────────────────

/** Standard field — always %-of-gross or $/mo, no toggle */
function CalcField({
  label, id, value, onChange, yearlyAmt, color = 'red',
}: {
  label: string; id: string; value: string
  onChange: (v: string) => void; yearlyAmt: number; color?: 'red' | 'green'
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-1">
        <span className="text-xs text-gray-600 truncate">{label}</span>
        <span className={`text-xs whitespace-nowrap flex-shrink-0 ${color === 'green' ? 'text-emerald-600' : 'text-red-600'}`}>
          {fmtYr(yearlyAmt)}
        </span>
      </div>
      <input
        type="number" step="0.01" id={id} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
      />
    </div>
  )
}

/** Toggle field — $/period, $/mo, or % */
function ToggleField({
  label, value, mode, onValueChange, onModeChange, yearlyAmt, color = 'red',
}: {
  label: string; value: string; mode: FicaMode
  onValueChange: (v: string) => void; onModeChange: (m: FicaMode) => void
  yearlyAmt: number; color?: 'red' | 'green'
}) {
  const toggleStyle = (active: boolean) =>
    `text-[9px] font-medium px-1 py-px rounded border leading-tight cursor-pointer ${
      active
        ? 'bg-emerald-600 border-emerald-700 text-white'
        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
    }`
  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-1">
        <span className="text-xs text-gray-600 truncate">{label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="flex gap-px">
            {(['period', 'mo', 'pct'] as FicaMode[]).map(m => (
              <button key={m} type="button" onClick={() => onModeChange(m)}
                className={toggleStyle(mode === m)}>
                {m === 'period' ? '$/pd' : m === 'mo' ? '$/mo' : '%'}
              </button>
            ))}
          </div>
          <span className={`text-xs whitespace-nowrap ${color === 'green' ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtYr(yearlyAmt)}
          </span>
        </div>
      </div>
      <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white focus-within:ring-1 focus-within:ring-emerald-500">
        {mode !== 'pct' && (
          <span className="text-xs text-gray-500 px-1.5 bg-gray-50 border-r border-gray-200 h-[26px] flex items-center">$</span>
        )}
        <input
          type="number" step="0.01" value={value}
          onChange={e => onValueChange(e.target.value)}
          className="w-full px-2 py-1 text-sm border-none outline-none bg-white"
        />
      </div>
    </div>
  )
}

/** Section divider */
function CalcSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2 border-t border-emerald-200 pt-3">
        {title}
      </div>
      <div className="grid grid-cols-3 gap-2">{children}</div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

function SalaryCalculatorInline({ 
  onChange, 
  initialValues 
}: { 
  onChange: (calc: SalaryCalculation) => void
  initialValues?: any
}) {
  const d = initialValues || {}

  // ── pre-tax ──
  const [k401_val,       setK401Val]       = useState(d.k401_pct?.toString()        || '0.00')
  const [k401_mode,      setK401Mode]      = useState<FicaMode>(d.k401_mode         || 'pct')
  const [medical_val,    setMedicalVal]    = useState(d.medical_monthly?.toString()  || '0.00')
  const [medical_mode,   setMedicalMode]   = useState<FicaMode>(d.medical_mode       || 'mo')
  const [dental_val,     setDentalVal]     = useState(d.dental_monthly?.toString()   || '0.00')
  const [dental_mode,    setDentalMode]    = useState<FicaMode>(d.dental_mode        || 'mo')
  const [vision_val,     setVisionVal]     = useState(d.vision_monthly?.toString()   || '0.00')
  const [vision_mode,    setVisionMode]    = useState<FicaMode>(d.vision_mode        || 'mo')
  const [ltd_val,        setLtdVal]        = useState(d.ltd_monthly?.toString()      || '0.00')
  const [ltd_mode,       setLtdMode]       = useState<FicaMode>(d.ltd_mode           || 'mo')
  const [life_val,       setLifeVal]       = useState(d.life_ins_monthly?.toString() || '0.00')
  const [life_mode,      setLifeMode]      = useState<FicaMode>(d.life_mode          || 'mo')
  const [hsa_val,        setHsaVal]        = useState(d.hsa_monthly?.toString()      || '0.00')
  const [hsa_mode,       setHsaMode]       = useState<FicaMode>(d.hsa_mode           || 'mo')
  const [fsa_val,        setFsaVal]        = useState(d.fsa_monthly?.toString()      || '0.00')
  const [fsa_mode,       setFsaMode]       = useState<FicaMode>(d.fsa_mode           || 'mo')

  // ── taxes ──
  const [fed_val,        setFedVal]        = useState(d.federal_tax_pct?.toString()  || '0.00')
  const [fed_mode,       setFedMode]       = useState<FicaMode>(d.fed_mode           || 'pct')
  const [state_val,      setStateVal]      = useState(d.state_tax_pct?.toString()    || '0.00')
  const [state_mode,     setStateMode]     = useState<FicaMode>(d.state_mode         || 'pct')
  const [local_val,      setLocalVal]      = useState(d.local_tax_pct?.toString()    || '0.00')
  const [local_mode,     setLocalMode]     = useState<FicaMode>(d.local_mode         || 'pct')

  // ── fica ──
  const [gross_salary,   setGrossSalary]   = useState(d.gross_yearly?.toString()     || '0')
  const [ss_val,         setSsVal]         = useState(d.ss_val?.toString()           || '6.20')
  const [ss_mode,        setSsMode]        = useState<FicaMode>(d.ss_mode            || 'pct')
  const [med_val,        setMedVal]        = useState(d.med_val?.toString()          || '1.45')
  const [med_mode,       setMedMode]       = useState<FicaMode>(d.med_mode           || 'pct')
  const [cadis_val,      setCadisVal]      = useState(d.cadis_val?.toString()        || '0.00')
  const [cadis_mode,     setCadisMode]     = useState<FicaMode>(d.cadis_mode         || 'pct')
  const [state_etc_val,  setStateEtcVal]   = useState(d.state_etc_val?.toString()    || '0.00')
  const [state_etc_mode, setStateEtcMode]  = useState<FicaMode>(d.state_etc_mode     || 'pct')

  // ── after-tax ──
  const [k401a_val,      setK401aVal]      = useState(d.k401_after_pct?.toString()   || '0.00')
  const [k401a_mode,     setK401aMode]     = useState<FicaMode>(d.k401a_mode         || 'pct')
  const [roth_val,       setRothVal]       = useState(d.k401_roth_pct?.toString()    || '0.00')
  const [roth_mode,      setRothMode]      = useState<FicaMode>(d.roth_mode          || 'pct')
  const [legal_val,      setLegalVal]      = useState(d.legal_monthly?.toString()    || '0.00')
  const [legal_mode,     setLegalMode]     = useState<FicaMode>(d.legal_mode         || 'mo')
  const [crit_val,       setCritVal]       = useState(d.critical_illness_monthly?.toString() || '0.00')
  const [crit_mode,      setCritMode]      = useState<FicaMode>(d.crit_mode          || 'mo')
  const [idt_val,        setIdtVal]        = useState(d.identity_theft_monthly?.toString()   || '0.00')
  const [idt_mode,       setIdtMode]       = useState<FicaMode>(d.idt_mode           || 'mo')
  const [acc_val,        setAccVal]        = useState(d.accident_monthly?.toString() || '0.00')
  const [acc_mode,       setAccMode]       = useState<FicaMode>(d.acc_mode           || 'mo')
  const [hosp_val,       setHospVal]       = useState(d.hospital_monthly?.toString() || '0.00')
  const [hosp_mode,      setHospMode]      = useState<FicaMode>(d.hosp_mode          || 'mo')
  const [add_val,        setAddVal]        = useState(d.ad_d_monthly?.toString()     || '0.00')
  const [add_mode,       setAddMode]       = useState<FicaMode>(d.add_mode           || 'mo')

  // ── auto savings ──
  const [ira_val,        setIraVal]        = useState(d.ira_monthly?.toString()      || '0.00')
  const [ira_mode,       setIraMode]       = useState<FicaMode>(d.ira_mode           || 'mo')
  const [hysa_val,       setHysaVal]       = useState(d.hysa_monthly?.toString()     || '0.00')
  const [hysa_mode,      setHysaMode]      = useState<FicaMode>(d.hysa_mode          || 'mo')
  const [crypto_val,     setCryptoVal]     = useState(d.crypto_monthly?.toString()   || '0.00')
  const [crypto_mode,    setCryptoMode]    = useState<FicaMode>(d.crypto_mode        || 'mo')
  const [invest_val,     setInvestVal]     = useState(d.invest_monthly?.toString()   || '0.00')
  const [invest_mode,    setInvestMode]    = useState<FicaMode>(d.invest_mode        || 'mo')
  const [other_val,      setOtherVal]      = useState(d.other_savings_monthly?.toString() || '0.00')
  const [other_mode,     setOtherMode]     = useState<FicaMode>(d.other_mode         || 'mo')

  // ── mode switch helper ──
  const switchMode = (
    mode: FicaMode, setMode: (m: FicaMode) => void,
    val: string,    setVal:  (v: string)   => void,
    newMode: FicaMode
  ) => {
    const gross = parseFloat(gross_salary) || 0
    const yearly = toYearly(val, mode, gross)
    setMode(newMode)
    setVal(fromYearly(yearly, newMode, gross))
  }

  // ── compute all yearly amounts ──
  const gross = parseFloat(gross_salary) || 0

  // pre-tax
  const k401_yr    = toYearly(k401_val,    k401_mode,    gross)
  const medical_yr = toYearly(medical_val, medical_mode, gross)
  const dental_yr  = toYearly(dental_val,  dental_mode,  gross)
  const vision_yr  = toYearly(vision_val,  vision_mode,  gross)
  const ltd_yr     = toYearly(ltd_val,     ltd_mode,     gross)
  const life_yr    = toYearly(life_val,    life_mode,    gross)
  const hsa_yr     = toYearly(hsa_val,     hsa_mode,     gross)
  const fsa_yr     = toYearly(fsa_val,     fsa_mode,     gross)
  const total_pre  = k401_yr + medical_yr + dental_yr + vision_yr + ltd_yr + life_yr + hsa_yr + fsa_yr

  // taxes
  const taxable    = gross - total_pre
  const fed_yr     = toYearly(fed_val,   fed_mode,   taxable)
  const state_yr   = toYearly(state_val, state_mode, taxable)
  const local_yr   = toYearly(local_val, local_mode, taxable)

  // fica
  const ss_yr      = toYearly(ss_val,        ss_mode,        gross)
  const med_yr     = toYearly(med_val,       med_mode,       gross)
  const cadis_yr   = toYearly(cadis_val,     cadis_mode,     gross)
  const setc_yr    = toYearly(state_etc_val, state_etc_mode, gross)
  const fica_total = ss_yr + med_yr
  const total_tax  = fed_yr + state_yr + local_yr + ss_yr + med_yr + cadis_yr + setc_yr

  // after-tax base
  const after_tax  = gross - total_pre - total_tax
  const k401a_yr   = toYearly(k401a_val, k401a_mode, after_tax)
  const roth_yr    = toYearly(roth_val,  roth_mode,  after_tax)
  const legal_yr   = toYearly(legal_val, legal_mode, gross)
  const crit_yr    = toYearly(crit_val,  crit_mode,  gross)
  const idt_yr     = toYearly(idt_val,   idt_mode,   gross)
  const acc_yr     = toYearly(acc_val,   acc_mode,   gross)
  const hosp_yr    = toYearly(hosp_val,  hosp_mode,  gross)
  const add_yr     = toYearly(add_val,   add_mode,   gross)
  const total_at   = k401a_yr + roth_yr + legal_yr + crit_yr + idt_yr + acc_yr + hosp_yr + add_yr

  // auto savings
  const ira_yr     = toYearly(ira_val,    ira_mode,    gross)
  const hysa_yr    = toYearly(hysa_val,   hysa_mode,   gross)
  const crypto_yr  = toYearly(crypto_val, crypto_mode, gross)
  const invest_yr  = toYearly(invest_val, invest_mode, gross)
  const other_yr   = toYearly(other_val,  other_mode,  gross)
  const total_sav  = ira_yr + hysa_yr + crypto_yr + invest_yr + other_yr

  const net_yearly    = after_tax - total_at - total_sav
  const net_monthly   = net_yearly / 12
  const net_biweekly  = net_yearly / PP

  // ── fire onChange ──
  useEffect(() => {
    if (gross === 0) return
    const calculation: SalaryCalculation = {
      gross_yearly: gross,
      deductions: {
        pre_tax_401k:        k401_yr,
        pre_tax_401k_roth:   roth_yr,
        hsa:                 hsa_yr,
        fsa:                 fsa_yr,
        medical_insurance:   medical_yr,
        dental_insurance:    dental_yr,
        vision_insurance:    vision_yr,
        long_term_disability: ltd_yr,
        life_insurance:      life_yr,
        federal_tax:         fed_yr,
        state_tax:           state_yr,
        local_tax:           local_yr,
        social_security:     ss_yr,
        medicare:            med_yr,
        fica_total,
        ca_disability:       cadis_yr,
        state_etc:           setc_yr,
        after_tax_401k:      k401a_yr,
        after_tax_401k_roth: roth_yr,
        ad_d:                add_yr,
        critical_illness:    crit_yr,
        hospital_indemnity:  hosp_yr,
        accident_insurance:  acc_yr,
        legal_plan:          legal_yr,
        identity_theft:      idt_yr,
        roth_ira:            ira_yr,
        hysa:                hysa_yr,
        crypto:              crypto_yr,
        personal_investments: invest_yr,
        other_savings:       other_yr,
      },
      net_yearly,
      net_monthly,
      net_biweekly,
    }
    onChange(calculation)
  }, [gross, k401_yr, medical_yr, dental_yr, vision_yr, ltd_yr, life_yr, hsa_yr, fsa_yr,
      fed_yr, state_yr, local_yr, ss_yr, med_yr, cadis_yr, setc_yr,
      k401a_yr, roth_yr, legal_yr, crit_yr, idt_yr, acc_yr, hosp_yr, add_yr,
      ira_yr, hysa_yr, crypto_yr, invest_yr, other_yr, net_yearly, onChange])

  const sw = (mode: FicaMode, setMode: (m: FicaMode) => void, val: string, setVal: (v: string) => void) =>
    (m: FicaMode) => switchMode(mode, setMode, val, setVal, m)

  return (
    <div className="mt-4 bg-emerald-50 rounded-lg p-4 border border-emerald-200">

      {/* Gross salary */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Yearly Gross Salary</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input type="number" step="0.01" value={gross_salary}
            onChange={e => setGrossSalary(e.target.value)}
            placeholder="105800.00"
            className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>
      </div>

      {/* Pre-tax */}
      <CalcSection title="Pre-tax deductions">
        <ToggleField label="401k" value={k401_val} mode={k401_mode} onValueChange={setK401Val} onModeChange={sw(k401_mode, setK401Mode, k401_val, setK401Val)} yearlyAmt={k401_yr} color="green" />
        <ToggleField label="Medical" value={medical_val} mode={medical_mode} onValueChange={setMedicalVal} onModeChange={sw(medical_mode, setMedicalMode, medical_val, setMedicalVal)} yearlyAmt={medical_yr} />
        <ToggleField label="Dental" value={dental_val} mode={dental_mode} onValueChange={setDentalVal} onModeChange={sw(dental_mode, setDentalMode, dental_val, setDentalVal)} yearlyAmt={dental_yr} />
        <ToggleField label="Vision" value={vision_val} mode={vision_mode} onValueChange={setVisionVal} onModeChange={sw(vision_mode, setVisionMode, vision_val, setVisionVal)} yearlyAmt={vision_yr} />
        <ToggleField label="Long-term disability" value={ltd_val} mode={ltd_mode} onValueChange={setLtdVal} onModeChange={sw(ltd_mode, setLtdMode, ltd_val, setLtdVal)} yearlyAmt={ltd_yr} />
        <ToggleField label="Life insurance" value={life_val} mode={life_mode} onValueChange={setLifeVal} onModeChange={sw(life_mode, setLifeMode, life_val, setLifeVal)} yearlyAmt={life_yr} />
        <ToggleField label="HSA" value={hsa_val} mode={hsa_mode} onValueChange={setHsaVal} onModeChange={sw(hsa_mode, setHsaMode, hsa_val, setHsaVal)} yearlyAmt={hsa_yr} color="green" />
        <ToggleField label="FSA" value={fsa_val} mode={fsa_mode} onValueChange={setFsaVal} onModeChange={sw(fsa_mode, setFsaMode, fsa_val, setFsaVal)} yearlyAmt={fsa_yr} color="green" />
      </CalcSection>

      {/* Taxes */}
      <CalcSection title="Taxes">
        <ToggleField label="Federal tax" value={fed_val} mode={fed_mode} onValueChange={setFedVal} onModeChange={sw(fed_mode, setFedMode, fed_val, setFedVal)} yearlyAmt={fed_yr} />
        <ToggleField label="State tax" value={state_val} mode={state_mode} onValueChange={setStateVal} onModeChange={sw(state_mode, setStateMode, state_val, setStateVal)} yearlyAmt={state_yr} />
        <ToggleField label="Local tax" value={local_val} mode={local_mode} onValueChange={setLocalVal} onModeChange={sw(local_mode, setLocalMode, local_val, setLocalVal)} yearlyAmt={local_yr} />
      </CalcSection>

      {/* FICA */}
      <CalcSection title="Social Security &amp; FICA">
        <ToggleField label="Social Security" value={ss_val} mode={ss_mode} onValueChange={setSsVal} onModeChange={sw(ss_mode, setSsMode, ss_val, setSsVal)} yearlyAmt={ss_yr} />
        <ToggleField label="Medicare" value={med_val} mode={med_mode} onValueChange={setMedVal} onModeChange={sw(med_mode, setMedMode, med_val, setMedVal)} yearlyAmt={med_yr} />
        <ToggleField label="State disability" value={cadis_val} mode={cadis_mode} onValueChange={setCadisVal} onModeChange={sw(cadis_mode, setCadisMode, cadis_val, setCadisVal)} yearlyAmt={cadis_yr} />
        <ToggleField label="State etc" value={state_etc_val} mode={state_etc_mode} onValueChange={setStateEtcVal} onModeChange={sw(state_etc_mode, setStateEtcMode, state_etc_val, setStateEtcVal)} yearlyAmt={setc_yr} />
      </CalcSection>

      {/* After-tax */}
      <CalcSection title="After-tax deductions">
        <ToggleField label="401k after-tax" value={k401a_val} mode={k401a_mode} onValueChange={setK401aVal} onModeChange={sw(k401a_mode, setK401aMode, k401a_val, setK401aVal)} yearlyAmt={k401a_yr} color="green" />
        <ToggleField label="401k Roth" value={roth_val} mode={roth_mode} onValueChange={setRothVal} onModeChange={sw(roth_mode, setRothMode, roth_val, setRothVal)} yearlyAmt={roth_yr} color="green" />
        <ToggleField label="Legal plan" value={legal_val} mode={legal_mode} onValueChange={setLegalVal} onModeChange={sw(legal_mode, setLegalMode, legal_val, setLegalVal)} yearlyAmt={legal_yr} />
        <ToggleField label="Critical illness" value={crit_val} mode={crit_mode} onValueChange={setCritVal} onModeChange={sw(crit_mode, setCritMode, crit_val, setCritVal)} yearlyAmt={crit_yr} />
        <ToggleField label="ID theft" value={idt_val} mode={idt_mode} onValueChange={setIdtVal} onModeChange={sw(idt_mode, setIdtMode, idt_val, setIdtVal)} yearlyAmt={idt_yr} />
        <ToggleField label="Accident" value={acc_val} mode={acc_mode} onValueChange={setAccVal} onModeChange={sw(acc_mode, setAccMode, acc_val, setAccVal)} yearlyAmt={acc_yr} />
        <ToggleField label="Hospital indem." value={hosp_val} mode={hosp_mode} onValueChange={setHospVal} onModeChange={sw(hosp_mode, setHospMode, hosp_val, setHospVal)} yearlyAmt={hosp_yr} />
        <ToggleField label="AD&amp;D" value={add_val} mode={add_mode} onValueChange={setAddVal} onModeChange={sw(add_mode, setAddMode, add_val, setAddVal)} yearlyAmt={add_yr} />
      </CalcSection>

      {/* Auto savings */}
      <CalcSection title="Auto savings &amp; investments">
        <ToggleField label="Roth IRA" value={ira_val} mode={ira_mode} onValueChange={setIraVal} onModeChange={sw(ira_mode, setIraMode, ira_val, setIraVal)} yearlyAmt={ira_yr} color="green" />
        <ToggleField label="HYSA" value={hysa_val} mode={hysa_mode} onValueChange={setHysaVal} onModeChange={sw(hysa_mode, setHysaMode, hysa_val, setHysaVal)} yearlyAmt={hysa_yr} color="green" />
        <ToggleField label="Crypto" value={crypto_val} mode={crypto_mode} onValueChange={setCryptoVal} onModeChange={sw(crypto_mode, setCryptoMode, crypto_val, setCryptoVal)} yearlyAmt={crypto_yr} color="green" />
        <ToggleField label="Personal invest." value={invest_val} mode={invest_mode} onValueChange={setInvestVal} onModeChange={sw(invest_mode, setInvestMode, invest_val, setInvestVal)} yearlyAmt={invest_yr} color="green" />
        <ToggleField label="Other savings" value={other_val} mode={other_mode} onValueChange={setOtherVal} onModeChange={sw(other_mode, setOtherMode, other_val, setOtherVal)} yearlyAmt={other_yr} color="green" />
      </CalcSection>

      {/* Net bar */}
      <div className="mt-4 bg-emerald-600 text-white rounded-lg p-4">
        <div className="text-xs opacity-90 mb-2">Net Take-Home Pay</div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="opacity-75">Yearly</div>
            <div className="text-lg font-semibold">${net_yearly.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div className="opacity-75">Monthly</div>
            <div className="text-lg font-semibold">${net_monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div className="opacity-75">Bi-Weekly</div>
            <div className="text-lg font-semibold">${net_biweekly.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
