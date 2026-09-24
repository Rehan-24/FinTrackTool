'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns'
import { count_income_occurrences, pay_periods_per_year } from '@/lib/income-utils'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Info, MessageSquare } from 'lucide-react'

type Field = 'gross' | 'net' | 'housing' | 'budget' | 'additional' | 'adjustments'

type MonthStatus = 'past' | 'current' | 'future'

type MonthData = {
  month: string // YYYY-MM
  month_name: string // "January"
  status: MonthStatus
  gross_income: number
  net_income: number
  housing: number
  budget: number
  additional: number
  projected: number
  actual_spent: number // actual spending (excluding savings categories)
  saved_amount: number // actual transfers to savings categories
  adjustments: number // manual adjustment that reduces leftover
  savings: number // cash leftover (net - spending - adjustments)
  savings_rate: number
  auto_savings: number
  retirement_401k: number
  hsa: number
  overridden: Partial<Record<Field, boolean>>
  notes: Partial<Record<Field, string>>
}

// Single source of truth for how each editable field maps to state and to planning_overrides
const FIELDS: Record<Field, {
  label: string
  key: 'gross_income' | 'net_income' | 'housing' | 'budget' | 'additional' | 'adjustments'
  column: string
  notes_column?: string
  // Column defaults to 0 in the database, so a bare 0 means "never set"
  zero_default?: boolean
}> = {
  gross: { label: 'Gross Income', key: 'gross_income', column: 'gross_income_override' },
  net: { label: 'Net Income', key: 'net_income', column: 'net_income_override' },
  housing: { label: 'Housing', key: 'housing', column: 'housing_override', notes_column: 'housing_notes' },
  budget: { label: 'Budget', key: 'budget', column: 'budget_override' },
  additional: { label: 'Additional Expenses', key: 'additional', column: 'additional_expenses', notes_column: 'additional_notes', zero_default: true },
  adjustments: { label: 'Adjustments', key: 'adjustments', column: 'adjustments', zero_default: true },
}

// Yearly salary deduction fields, grouped by how they roll up
const DEDUCTION_FIELDS = [
  // Taxes
  'federal_tax', 'state_tax', 'local_tax', 'fica_total', 'ca_disability', 'state_etc',
  // Pre-tax benefits
  'pre_tax_401k', 'hsa', 'fsa', 'medical_insurance', 'dental_insurance', 'vision_insurance',
  'long_term_disability', 'life_insurance',
  // After-tax deductions
  'after_tax_401k', 'after_tax_401k_roth', 'ad_d', 'critical_illness', 'hospital_indemnity',
  'accident_insurance', 'legal_plan', 'identity_theft',
  // Auto savings
  'roth_ira', 'hysa', 'crypto', 'personal_investments', 'other_savings',
]
const AUTO_SAVINGS_FIELDS = ['roth_ira', 'hysa', 'crypto', 'personal_investments', 'other_savings']
const RETIREMENT_FIELDS = ['pre_tax_401k', 'after_tax_401k', 'after_tax_401k_roth']
const HSA_FIELDS = ['hsa', 'fsa']

const LEFTOVER_TOOLTIP =
  'Net income minus spending minus adjustments. Past and current months use actual spending ' +
  '(the current month counts spending so far). Future months use projected spending.'
const DIFF_TOOLTIP =
  'Projected minus actual spending. Green means under plan, red means over. ' +
  'The current month compares spending so far against the full-month plan.'

const PAGE_SIZE = 1000

const round2 = (n: number) => Math.round(n * 100) / 100

const money = (n: number, cents = true) => {
  const digits = cents ? 2 : 0
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${n < -0.005 ? '-' : ''}$${abs}`
}

const parse_local = (date_str: string) => {
  const [y, m, d] = date_str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Hover/focus tooltip. Opens below and extends leftward from the trigger's right edge so it
// stays inside the table's scroll area near the right-hand columns. tabIndex lets touch
// devices open it with a tap.
const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => (
  <span tabIndex={0} className="relative group inline-flex items-center gap-1 cursor-help outline-none">
    {children}
    <span
      role="tooltip"
      className="pointer-events-none absolute top-full right-0 mt-2 w-64 rounded-md bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-white text-left whitespace-normal shadow-lg z-20 opacity-0 invisible transition-opacity group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible"
    >
      {text}
    </span>
  </span>
)

// Recompute the values that derive from the editable fields
const with_totals = (m: MonthData): MonthData => {
  const projected = m.housing + m.budget + m.additional
  const spending = m.status === 'future' ? projected : m.actual_spent
  const savings = m.net_income - spending - m.adjustments
  return {
    ...m,
    projected,
    savings,
    savings_rate: m.net_income > 0 ? (savings / m.net_income) * 100 : 0,
  }
}

export default function PlanningPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [months, setMonths] = useState<MonthData[]>([])
  const [savings_budget, setSavingsBudget] = useState(0)
  const [loading, setLoading] = useState(true)
  const load_id = useRef(0)

  // Edit modal state
  const [editing_month, setEditingMonth] = useState<string | null>(null)
  const [edit_field, setEditField] = useState<Field>('gross')
  const [edit_value, setEditValue] = useState('')
  const [edit_notes, setEditNotes] = useState('')
  const [apply_to_rest, setApplyToRest] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load_planning_data()

    // Quietly refresh when the page becomes visible again (catches changes from Income page)
    const handle_visibility = () => {
      if (document.visibilityState === 'visible') load_planning_data(true)
    }
    document.addEventListener('visibilitychange', handle_visibility)
    return () => document.removeEventListener('visibilitychange', handle_visibility)
  }, [year])

  // Supabase caps each response at 1000 rows, so page through a year of purchases
  const fetch_purchases = async (user_id: string, from: string, to: string) => {
    const rows: any[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('purchases')
        .select('actual_cost, is_projected, date, category:categories(is_savings)')
        .eq('user_id', user_id)
        .gte('date', from)
        .lte('date', to)
        .order('date')
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < PAGE_SIZE) return rows
    }
  }

  const load_planning_data = async (silent = false) => {
    const id = ++load_id.current
    if (!silent) setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const year_start = new Date(year, 0, 1)
      const year_end = new Date(year, 11, 31)
      const spending_end = today < year_end ? today : year_end

      const [
        { data: income_sources },
        { data: categories },
        { data: all_overrides },
        purchases,
      ] = await Promise.all([
        supabase.from('income').select('*').eq('user_id', user.id),
        supabase.from('categories').select('monthly_budget, is_savings').eq('user_id', user.id),
        supabase
          .from('planning_overrides')
          .select('*')
          .eq('user_id', user.id)
          .gte('month_year', `${year}-01`)
          .lte('month_year', `${year}-12`),
        // Only past/current spending matters, so skip the query for a fully future year
        year_start <= today
          ? fetch_purchases(user.id, format(year_start, 'yyyy-MM-dd'), format(spending_end, 'yyyy-MM-dd'))
          : Promise.resolve([]),
      ])

      const income_ids = income_sources?.filter(i => i.is_recurring).map(i => i.id) || []
      const deductions_map: Record<string, any> = {}
      if (income_ids.length > 0) {
        const { data: all_deductions } = await supabase
          .from('salary_deductions')
          .select('*')
          .in('income_id', income_ids)
        all_deductions?.forEach(d => { deductions_map[d.income_id] = d })
      }

      const budget_of = (c: any) => parseFloat(c.monthly_budget.toString())
      const default_budget = categories?.reduce((sum, c) => sum + budget_of(c), 0) || 0
      const planned_transfers = categories?.filter(c => c.is_savings).reduce((sum, c) => sum + budget_of(c), 0) || 0

      const overrides_map: Record<string, any> = {}
      all_overrides?.forEach(o => { overrides_map[o.month_year] = o })

      // Bucket spending by month. Projected entries only count once their date has passed.
      const spending_map: Record<string, { spent: number, saved: number }> = {}
      purchases.forEach((p: any) => {
        if (p.is_projected && parse_local(p.date) >= today) return
        const bucket = (spending_map[p.date.slice(0, 7)] ??= { spent: 0, saved: 0 })
        const amount = parseFloat(p.actual_cost.toString())
        if (p.category?.is_savings) bucket.saved += amount
        else bucket.spent += amount
      })

      const months_data: MonthData[] = []

      for (let i = 0; i < 12; i++) {
        const month_date = addMonths(year_start, i)
        const month_year = format(month_date, 'yyyy-MM')
        const month_start = startOfMonth(month_date)
        const month_end = endOfMonth(month_date)
        const status: MonthStatus = month_end < today ? 'past' : month_start <= today ? 'current' : 'future'

        // Gross income, deductions and savings breakdown
        let gross = 0
        let total_deductions = 0
        let auto_savings = 0
        let retirement_401k = 0
        let hsa = 0

        for (const source of income_sources || []) {
          if (!source.is_recurring) {
            const income_date = parse_local(source.date)
            if (income_date >= month_start && income_date <= month_end) gross += Number(source.amount)
            continue
          }

          // Skip if hasn't started yet or already ended
          const start_date = parse_local(source.start_date || source.date)
          const end_date = source.end_date ? parse_local(source.end_date) : null
          if (start_date > month_end) continue
          if (end_date && end_date < month_start) continue

          // Enumerate actual pay dates in this month from start_date
          const occurrences = count_income_occurrences(source, month_start, month_end)
          if (occurrences === 0) continue

          const periods = pay_periods_per_year(source.pay_frequency || '')
          gross += source.is_salary && source.yearly_salary
            ? (source.yearly_salary / periods) * occurrences
            : Number(source.amount) * occurrences

          const deductions = deductions_map[source.id]
          if (!deductions) continue

          // Deductions are stored as YEARLY values. Scale by actual paychecks this
          // month so 3-paycheck months reflect 3 paychecks worth of deductions.
          const scale = occurrences / periods
          const sum_of = (fields: string[]) => fields.reduce((sum, f) => sum + (deductions[f] || 0) * scale, 0)

          total_deductions += round2(sum_of(DEDUCTION_FIELDS))
          auto_savings += sum_of(AUTO_SAVINGS_FIELDS)
          retirement_401k += sum_of(RETIREMENT_FIELDS)
          hsa += sum_of(HSA_FIELDS)
        }

        gross = round2(gross)
        const net = round2(gross - total_deductions)
        const spending = spending_map[month_year] || { spent: 0, saved: 0 }

        // Apply overrides or use defaults (use ?? so 0 overrides are respected)
        const override = overrides_map[month_year] || {}
        const defaults: Record<Field, number> = {
          gross,
          net,
          housing: 0,
          budget: default_budget,
          additional: 0,
          adjustments: 0,
        }
        const values = {} as Record<Field, number>
        const overridden: MonthData['overridden'] = {}
        const notes: MonthData['notes'] = {}
        for (const field of Object.keys(FIELDS) as Field[]) {
          const cfg = FIELDS[field]
          const value = override[cfg.column]
          const note = cfg.notes_column ? override[cfg.notes_column] : null
          values[field] = value != null ? parseFloat(value.toString()) : defaults[field]
          overridden[field] = value != null && !(cfg.zero_default && values[field] === 0 && !note)
          if (note) notes[field] = note
        }

        months_data.push(with_totals({
          month: month_year,
          month_name: format(month_date, 'MMMM'),
          status,
          gross_income: values.gross,
          net_income: values.net,
          housing: values.housing,
          budget: values.budget,
          additional: values.additional,
          adjustments: values.adjustments,
          actual_spent: round2(spending.spent),
          saved_amount: round2(spending.saved),
          projected: 0,
          savings: 0,
          savings_rate: 0,
          auto_savings: round2(auto_savings),
          retirement_401k: round2(retirement_401k),
          hsa: round2(hsa),
          overridden,
          notes,
        }))
      }

      // Ignore responses from a load that a newer one (e.g. a quick year change) superseded
      if (id !== load_id.current) return
      setMonths(months_data)
      setSavingsBudget(planned_transfers)
    } catch (err) {
      console.error('Error loading planning data:', err)
    } finally {
      if (id === load_id.current) setLoading(false)
    }
  }

  const open_edit = (month: MonthData, field: Field) => {
    setEditingMonth(month.month)
    setEditField(field)
    setEditValue(month[FIELDS[field].key].toString())
    setEditNotes(month.notes[field] || '')
    setApplyToRest(false)
  }

  const close_edit = () => {
    setEditingMonth(null)
    setEditValue('')
    setEditNotes('')
    setApplyToRest(false)
  }

  // The month being edited, plus every later month this year if "apply to rest" is checked
  const target_months = () => {
    const idx = months.findIndex(m => m.month === editing_month)
    return apply_to_rest ? months.slice(idx).map(m => m.month) : [editing_month as string]
  }

  // Upsert (or clear, with value = null) this field's override for every target month
  const write_override = async (value: number | null, notes: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const cfg = FIELDS[edit_field]
    const targets = target_months()
    const rows = targets.map(month_year => ({
      user_id: user.id,
      month_year,
      [cfg.column]: value,
      ...(cfg.notes_column ? { [cfg.notes_column]: notes } : {}),
    }))

    const { error } = await supabase
      .from('planning_overrides')
      .upsert(rows, { onConflict: 'user_id,month_year' })
    if (error) throw error
    return targets
  }

  const parsed_value = Number(edit_value)
  const edit_value_valid = edit_value.trim() !== '' && Number.isFinite(parsed_value)

  const save_edit = async () => {
    if (!editing_month || !edit_value_valid || saving) return
    setSaving(true)
    try {
      const notes = FIELDS[edit_field].notes_column ? edit_notes.trim() || null : null
      const targets = await write_override(parsed_value, notes)
      if (!targets) return

      // Update only the changed months in state instead of reloading everything
      const key = FIELDS[edit_field].key
      setMonths(prev => prev.map(m => targets.includes(m.month)
        ? with_totals({
            ...m,
            [key]: parsed_value,
            overridden: { ...m.overridden, [edit_field]: true },
            notes: { ...m.notes, [edit_field]: notes || undefined },
          })
        : m
      ))
      close_edit()
    } catch (err) {
      console.error('Error saving edit:', err)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const reset_to_default = async () => {
    if (!editing_month || saving) return
    setSaving(true)
    try {
      await write_override(null, null)
      // Reload to get fresh calculated values
      await load_planning_data(true)
      close_edit()
    } catch (err) {
      console.error('Error resetting to default:', err)
      alert('Failed to reset to default')
    } finally {
      setSaving(false)
    }
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

      await load_planning_data(true)
    } catch (err) {
      console.error('Error resetting overrides:', err)
      alert('Failed to reset values')
    }
  }

  // Totals
  const sum = (fn: (m: MonthData) => number, list = months) => list.reduce((s, m) => s + fn(m), 0)
  const elapsed = months.filter(m => m.status !== 'future')
  const future_count = months.length - elapsed.length

  const total_gross = sum(m => m.gross_income)
  const total_net = sum(m => m.net_income)
  const total_budget = sum(m => m.projected)
  const total_auto_savings = sum(m => m.auto_savings)
  const total_401k = sum(m => m.retirement_401k)
  const total_hsa = sum(m => m.hsa)
  // Actual transfers to savings categories so far, plus planned transfers for future months
  const total_cash_savings = sum(m => m.saved_amount, elapsed) + future_count * savings_budget
  const total_savings = total_auto_savings + total_401k + total_hsa + total_cash_savings
  const total_leftover = sum(m => m.savings)

  const pct_of_gross = (n: number) => (total_gross > 0 ? ((n / total_gross) * 100).toFixed(1) : '0.0')

  const editing = months.find(m => m.month === editing_month)
  const remaining_after_edit = editing ? months.length - months.indexOf(editing) - 1 : 0

  const rate_color = (rate: number) =>
    rate >= 20 ? 'text-green-600' : rate >= 10 ? 'text-yellow-600' : 'text-red-600'

  const render_editable = (month: MonthData, field: Field) => {
    const value = month[FIELDS[field].key]
    const is_overridden = month.overridden[field]
    const note = month.notes[field]
    const muted_adjustment = field === 'adjustments' && value === 0

    return (
      <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
        <button
          onClick={() => open_edit(month, field)}
          title={is_overridden ? `Manually set${note ? `\n\n${note}` : ''}` : 'Calculated. Click to override.'}
          className={`inline-flex items-center gap-1.5 hover:text-blue-600 transition ${
            field === 'adjustments' ? (muted_adjustment ? 'text-gray-400' : 'text-orange-600 font-medium') : ''
          }`}
        >
          {note && <MessageSquare size={12} className="text-gray-400" />}
          {is_overridden && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
          {muted_adjustment ? '—' : money(value)}
        </button>
      </td>
    )
  }

  const header = (label: string, tooltip?: string) => (
    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 whitespace-nowrap">
      {tooltip ? (
        <Tooltip text={tooltip}>
          {label}
          <Info size={13} className="text-gray-400" />
        </Tooltip>
      ) : label}
    </th>
  )

  const variance_cell = (diff: number | null, className = '') => (
    <td className={`px-4 py-3 text-right text-sm font-medium whitespace-nowrap ${
      diff === null ? 'text-gray-400' : diff >= 0 ? 'text-green-600' : 'text-red-600'
    } ${className}`}>
      {diff === null ? '—' : `${diff > 0.005 ? '+' : ''}${money(diff)}`}
    </td>
  )

  if (loading && months.length === 0) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-[1400px] mx-auto">
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

      <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4">
            <div className="text-sm opacity-90 mb-2">Gross Income ({year})</div>
            <div className="text-3xl font-bold">{money(total_gross, false)}</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4">
            <div className="text-sm opacity-90 mb-2">Net Income ({year})</div>
            <div className="text-3xl font-bold">{money(total_net, false)}</div>
            {total_gross > 0 && (
              <div className="text-sm opacity-90">({((total_net / total_gross) * 100).toFixed(0)}% of gross)</div>
            )}
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-4">
            <div className="text-sm opacity-90 mb-2">Total Budgeted ({year})</div>
            <div className="text-3xl font-bold">{money(total_budget, false)}</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-4">
            <div className="text-sm opacity-90 mb-2">Total Projected Savings ({year})</div>
            <div className="text-3xl font-bold">{money(total_savings, false)}</div>
            <div className="text-xs mt-2 space-y-1">
              <div>Auto: {money(total_auto_savings, false)} ({pct_of_gross(total_auto_savings)}% of gross)</div>
              <div>401k: {money(total_401k, false)} ({pct_of_gross(total_401k)}% of gross)</div>
              <div>HSA: {money(total_hsa, false)} ({pct_of_gross(total_hsa)}% of gross)</div>
              <div>
                <Tooltip text="Actual transfers to savings categories so far, plus those categories' monthly budgets for the rest of the year.">
                  Saved: {money(total_cash_savings, false)} ({pct_of_gross(total_cash_savings)}% of gross)
                  <Info size={11} className="opacity-80" />
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Month</th>
                {header('Gross ✎')}
                {header('Net ✎')}
                {header('Housing ✎')}
                {header('Budget ✎')}
                {header("Add'l ✎")}
                {header('Projected')}
                {header('Actual')}
                {header('Diff', DIFF_TOOLTIP)}
                {header('Adjustments ✎')}
                {header('Saved')}
                {header('Leftover', LEFTOVER_TOOLTIP)}
                {header('%')}
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const is_future = month.status === 'future'
                const is_current = month.status === 'current'
                return (
                  <tr
                    key={month.month}
                    className={`border-b border-gray-100 ${is_current ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className={`px-4 py-3 text-sm font-medium text-gray-800 ${is_current ? 'border-l-4 border-blue-500' : ''}`}>
                      {month.month_name}
                      {is_current && <span className="ml-2 text-xs font-medium text-blue-600">Current</span>}
                    </td>

                    {render_editable(month, 'gross')}
                    {render_editable(month, 'net')}
                    {render_editable(month, 'housing')}
                    {render_editable(month, 'budget')}
                    {render_editable(month, 'additional')}

                    <td className="px-4 py-3 text-right text-sm text-gray-600 whitespace-nowrap">
                      {money(month.projected)}
                    </td>

                    <td className={`px-4 py-3 text-right text-sm font-medium whitespace-nowrap ${
                      month.actual_spent > 0 ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {is_future ? '—' : money(month.actual_spent)}
                    </td>

                    {variance_cell(is_future ? null : month.projected - month.actual_spent)}

                    {render_editable(month, 'adjustments')}

                    <td className={`px-4 py-3 text-right text-sm font-medium whitespace-nowrap ${
                      month.saved_amount > 0 ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {is_future ? '—' : money(month.saved_amount)}
                    </td>

                    <td className={`px-4 py-3 text-right text-sm font-semibold whitespace-nowrap ${
                      month.savings >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {month.savings >= 0 ? (
                        <TrendingUp className="inline mr-1" size={16} />
                      ) : (
                        <TrendingDown className="inline mr-1" size={16} />
                      )}
                      {money(month.savings)}
                    </td>

                    <td className={`px-4 py-3 text-right text-sm font-semibold ${rate_color(month.savings_rate)}`}>
                      {month.savings_rate.toFixed(0)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
              <tr>
                <td className="px-4 py-3 text-sm text-gray-800">Total</td>
                {[total_gross, total_net, sum(m => m.housing), sum(m => m.budget), sum(m => m.additional), total_budget].map((n, i) => (
                  <td key={i} className="px-4 py-3 text-right text-sm text-gray-800 whitespace-nowrap">{money(n)}</td>
                ))}
                <td className="px-4 py-3 text-right text-sm text-blue-600 whitespace-nowrap">
                  {money(sum(m => m.actual_spent, elapsed))}
                </td>
                {variance_cell(elapsed.length ? sum(m => m.projected - m.actual_spent, elapsed) : null)}
                <td className="px-4 py-3 text-right text-sm text-orange-600 whitespace-nowrap">
                  {money(sum(m => m.adjustments))}
                </td>
                <td className="px-4 py-3 text-right text-sm text-green-600 whitespace-nowrap">
                  {money(sum(m => m.saved_amount, elapsed))}
                </td>
                <td className={`px-4 py-3 text-right text-sm whitespace-nowrap ${total_leftover >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {money(total_leftover)}
                </td>
                <td className={`px-4 py-3 text-right text-sm ${rate_color(total_net > 0 ? (total_leftover / total_net) * 100 : 0)}`}>
                  {total_net > 0 ? ((total_leftover / total_net) * 100).toFixed(0) : 0}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Manually set
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare size={12} className="text-gray-400" /> Has notes (hover to read)
          </span>
          <span>Click any ✎ value to edit</span>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Edit {FIELDS[edit_field].label} - {editing.month_name}
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
                    onKeyDown={(e) => { if (e.key === 'Enter') save_edit() }}
                    autoFocus
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {!edit_value_valid && (
                  <p className="text-sm text-red-600 mt-1">Enter an amount, or use Reset to Default to clear it.</p>
                )}
              </div>

              {FIELDS[edit_field].notes_column && (
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

              {remaining_after_edit > 0 && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={apply_to_rest}
                    onChange={(e) => setApplyToRest(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Also apply to the rest of {year} ({remaining_after_edit} more {remaining_after_edit === 1 ? 'month' : 'months'})
                </label>
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
                  disabled={saving}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition disabled:opacity-50"
                >
                  Reset to Default
                </button>
                <button
                  onClick={save_edit}
                  disabled={!edit_value_valid || saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
