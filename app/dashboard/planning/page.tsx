'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns'
import { count_income_occurrences, pay_periods_per_year } from '@/lib/income-utils'
import { ChevronLeft, ChevronRight, Info, MessageSquare } from 'lucide-react'

type Field = 'additional_income' | 'budget' | 'housing' | 'additional' | 'additional_savings' | 'adjustments'

type MonthStatus = 'past' | 'current' | 'future'

type MonthData = {
  month: string // YYYY-MM
  month_name: string // "January"
  status: MonthStatus
  // Income
  salary_income: number // all recurring income
  one_time_income: number
  additional_income: number // editable
  gross_income: number
  // Paycheck deductions
  taxes: number
  benefits: number
  retirement_401k: number
  roth: number
  auto_savings: number
  net_income: number
  // Plan
  budget: number // "Planned Spend", editable, defaults to sum of category budgets
  housing: number // editable
  additional: number // editable
  projected_out: number
  additional_savings: number // editable
  planned_leftover: number
  // Actual
  actual_spent: number // spending excluding savings categories
  saved_amount: number // transfers to savings categories
  adjustments: number // editable; positive adds to actual leftover
  actual_leftover: number
  overridden: Partial<Record<Field, boolean>>
  notes: Partial<Record<Field, string>>
}

// Single source of truth for how each editable field maps to state and to planning_overrides
const FIELDS: Record<Field, {
  label: string
  column: string
  notes_column?: string
  // Column defaults to 0 in the database, so a bare 0 means "never set"
  zero_default?: boolean
  hint?: string
}> = {
  additional_income: { label: 'Additional Income', column: 'additional_income', hint: 'Adds to Gross Income for this month.' },
  budget: { label: 'Planned Spend', column: 'budget_override', hint: 'Defaults to the sum of your category budgets.' },
  housing: { label: 'Housing', column: 'housing_override', notes_column: 'housing_notes' },
  additional: { label: 'Additional Expenses', column: 'additional_expenses', notes_column: 'additional_notes', zero_default: true },
  additional_savings: { label: 'Additional Savings', column: 'additional_savings', hint: 'Extra money to set aside. Reduces Planned Leftover.' },
  adjustments: { label: 'Adjustments', column: 'adjustments', zero_default: true, hint: 'Positive adds to Actual Leftover (e.g. a refund). Negative subtracts.' },
}

// Yearly salary deduction fields, grouped into the table's deduction columns
const TAX_FIELDS = ['federal_tax', 'state_tax', 'local_tax', 'fica_total', 'ca_disability', 'state_etc']
const BENEFIT_FIELDS = [
  'medical_insurance', 'dental_insurance', 'vision_insurance', 'long_term_disability', 'life_insurance',
  'ad_d', 'critical_illness', 'hospital_indemnity', 'accident_insurance', 'legal_plan', 'identity_theft',
]
const RETIREMENT_FIELDS = ['pre_tax_401k', 'after_tax_401k', 'after_tax_401k_roth']
const ROTH_FIELDS = ['roth_ira']
const AUTO_SAVINGS_FIELDS = ['hysa', 'crypto', 'personal_investments', 'other_savings', 'hsa', 'fsa']

const PAGE_SIZE = 1000

const round2 = (n: number) => Math.round(n * 100) / 100

const money = (n: number, cents = true) => {
  const digits = cents ? 2 : 0
  const rounded = Number(n.toFixed(digits))
  const abs = Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${rounded < 0 ? '-' : ''}$${abs}`
}

// Whole dollars so the full table fits on normal desktop widths; cents on very wide screens
const Amount = ({ value }: { value: number }) => (
  <>
    <span className="min-[1920px]:hidden">{money(value, false)}</span>
    <span className="hidden min-[1920px]:inline">{money(value)}</span>
  </>
)

const parse_local = (date_str: string) => {
  const [y, m, d] = date_str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Hover/focus tooltip. `align` picks which edge it anchors to so it stays inside the
// table's scroll area at either end. tabIndex lets touch devices open it with a tap.
const Tooltip = ({ text, align = 'right', children }: {
  text: string
  align?: 'left' | 'right'
  children: React.ReactNode
}) => (
  <span tabIndex={0} className="relative group inline-flex items-center gap-1 cursor-help outline-none">
    {children}
    <span
      role="tooltip"
      className={`pointer-events-none absolute top-full ${align === 'left' ? 'left-0' : 'right-0'} mt-2 w-64 rounded-md bg-gray-900 px-3 py-2 text-xs font-normal normal-case leading-relaxed text-white text-left whitespace-normal shadow-lg z-20 opacity-0 invisible transition-opacity group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible`}
    >
      {text}
    </span>
  </span>
)

// Recompute every value that derives from the editable fields
const with_totals = (m: MonthData): MonthData => {
  const gross_income = m.salary_income + m.one_time_income + m.additional_income
  const net_income = gross_income - m.taxes - m.benefits - m.retirement_401k - m.roth - m.auto_savings
  const projected_out = m.budget + m.housing + m.additional
  return {
    ...m,
    gross_income,
    net_income,
    projected_out,
    planned_leftover: net_income - projected_out - m.additional_savings,
    actual_leftover: net_income - m.actual_spent - m.saved_amount + m.adjustments,
  }
}

type Column = {
  id: string
  label: string
  group: 'income' | 'paycheck' | 'plan' | 'actual'
  tooltip?: string
  field?: Field // set for editable columns
  value: (m: MonthData) => number
  actual?: boolean // only meaningful for past/current months
  tone?: (m: MonthData) => string
}

const leftover_tone = (n: number) => (n >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold')

const COLUMNS: Column[] = [
  { id: 'salary', label: 'Salary Income', group: 'income', value: m => m.salary_income,
    tooltip: 'Recurring income before deductions: salary and any other recurring paychecks.' },
  { id: 'one_time', label: 'One Time Income', group: 'income', value: m => m.one_time_income,
    tooltip: 'Non-recurring income dated in this month.' },
  { id: 'additional_income', label: "Add'l Income", group: 'income', field: 'additional_income', value: m => m.additional_income,
    tooltip: 'Additional Income: extra income you expect this month. Starts at $0. Click a value to add.' },
  { id: 'gross', label: 'Gross Income', group: 'income', value: m => m.gross_income, tone: () => 'font-medium text-gray-900',
    tooltip: 'Salary Income + One Time Income + Additional Income.' },
  { id: 'taxes', label: 'Taxes', group: 'paycheck', value: m => m.taxes,
    tooltip: 'Federal, state, local, FICA and state disability taxes.' },
  { id: 'benefits', label: 'Benefits', group: 'paycheck', value: m => m.benefits,
    tooltip: 'Insurance and benefit deductions: medical, dental, vision, life, disability, legal plan, identity theft and similar.' },
  { id: '401k', label: '401k', group: 'paycheck', value: m => m.retirement_401k,
    tooltip: 'All 401k contributions: pre-tax, after-tax and Roth 401k.' },
  { id: 'roth', label: 'Roth', group: 'paycheck', value: m => m.roth,
    tooltip: 'Roth IRA contributions.' },
  { id: 'auto_savings', label: "Add'l Auto Savings", group: 'paycheck', value: m => m.auto_savings,
    tooltip: 'Additional Auto Deducted Savings: HYSA, crypto, personal investments, other savings, HSA and FSA.' },
  { id: 'net', label: 'Net Income', group: 'paycheck', value: m => m.net_income, tone: () => 'font-medium text-gray-900',
    tooltip: 'Gross Income minus Taxes, Benefits, 401k, Roth and Additional Auto Savings.' },
  { id: 'budget', label: 'Planned Spend', group: 'plan', field: 'budget', value: m => m.budget,
    tooltip: 'Defaults to the sum of your category budgets for the month. Click a value to change it.' },
  { id: 'housing', label: 'Housing', group: 'plan', field: 'housing', value: m => m.housing },
  { id: 'additional', label: "Add'l", group: 'plan', field: 'additional', value: m => m.additional,
    tooltip: 'Additional expenses planned for this month.' },
  { id: 'projected_out', label: 'Projected Out', group: 'plan', value: m => m.projected_out, tone: () => 'text-gray-600',
    tooltip: "Planned Spend + Housing + Add'l." },
  { id: 'additional_savings', label: "Add'l Savings", group: 'plan', field: 'additional_savings', value: m => m.additional_savings,
    tooltip: 'Additional Savings: extra money you plan to set aside this month. Starts at $0. Click a value to add.' },
  { id: 'planned_leftover', label: 'Planned Leftover', group: 'plan', value: m => m.planned_leftover,
    tone: m => leftover_tone(m.planned_leftover),
    tooltip: 'Net Income − Projected Out − Additional Savings.' },
  { id: 'actual_spent', label: 'Actual Spend', group: 'actual', actual: true, value: m => m.actual_spent,
    tone: () => 'text-blue-600 font-medium',
    tooltip: 'Spending this month, not counting transfers to savings categories. The current month counts spending so far.' },
  { id: 'saved', label: 'Actual Saved', group: 'actual', actual: true, value: m => m.saved_amount,
    tone: () => 'text-green-600 font-medium',
    tooltip: 'Transfers to savings categories this month.' },
  { id: 'adjustments', label: 'Adjust­ments', group: 'actual', field: 'adjustments', value: m => m.adjustments,
    tooltip: 'Manual corrections. Positive adds to Actual Leftover (e.g. a refund); negative subtracts.' },
  { id: 'actual_leftover', label: 'Actual Leftover', group: 'actual', actual: true, value: m => m.actual_leftover,
    tone: m => leftover_tone(m.actual_leftover),
    tooltip: 'Net Income − Actual Spend − Actual Saved + Adjustments. The current month counts activity so far.' },
]

const GROUPS: { id: Column['group'], label: string }[] = [
  { id: 'income', label: 'Income' },
  { id: 'paycheck', label: 'Paycheck' },
  { id: 'plan', label: 'Plan' },
  { id: 'actual', label: 'Actual' },
]

// Left border at the start of each group to visually separate them
const group_start = new Set(GROUPS.map(g => COLUMNS.find(c => c.group === g.id)!.id))

export default function PlanningPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [months, setMonths] = useState<MonthData[]>([])
  const [savings_budget, setSavingsBudget] = useState(0)
  const [loading, setLoading] = useState(true)
  const load_id = useRef(0)

  // Edit modal state
  const [editing_month, setEditingMonth] = useState<string | null>(null)
  const [edit_field, setEditField] = useState<Field>('budget')
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

        let salary_income = 0
        let one_time_income = 0
        let taxes = 0
        let benefits = 0
        let retirement_401k = 0
        let roth = 0
        let auto_savings = 0

        for (const source of income_sources || []) {
          if (!source.is_recurring) {
            const income_date = parse_local(source.date)
            if (income_date >= month_start && income_date <= month_end) one_time_income += Number(source.amount)
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
          salary_income += source.is_salary && source.yearly_salary
            ? (source.yearly_salary / periods) * occurrences
            : Number(source.amount) * occurrences

          const deductions = deductions_map[source.id]
          if (!deductions) continue

          // Deductions are stored as YEARLY values. Scale by actual paychecks this
          // month so 3-paycheck months reflect 3 paychecks worth of deductions.
          const scale = occurrences / periods
          const sum_of = (fields: string[]) => fields.reduce((sum, f) => sum + (deductions[f] || 0) * scale, 0)

          taxes += sum_of(TAX_FIELDS)
          benefits += sum_of(BENEFIT_FIELDS)
          retirement_401k += sum_of(RETIREMENT_FIELDS)
          roth += sum_of(ROTH_FIELDS)
          auto_savings += sum_of(AUTO_SAVINGS_FIELDS)
        }

        const spending = spending_map[month_year] || { spent: 0, saved: 0 }

        // Apply overrides or use defaults (use ?? so 0 overrides are respected)
        const override = overrides_map[month_year] || {}
        const defaults: Record<Field, number> = {
          additional_income: 0,
          budget: default_budget,
          housing: 0,
          additional: 0,
          additional_savings: 0,
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
          salary_income: round2(salary_income),
          one_time_income: round2(one_time_income),
          additional_income: values.additional_income,
          taxes: round2(taxes),
          benefits: round2(benefits),
          retirement_401k: round2(retirement_401k),
          roth: round2(roth),
          auto_savings: round2(auto_savings),
          budget: values.budget,
          housing: values.housing,
          additional: values.additional,
          additional_savings: values.additional_savings,
          actual_spent: round2(spending.spent),
          saved_amount: round2(spending.saved),
          adjustments: values.adjustments,
          gross_income: 0,
          net_income: 0,
          projected_out: 0,
          planned_leftover: 0,
          actual_leftover: 0,
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
    setEditValue(month[field].toString())
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
      setMonths(prev => prev.map(m => targets.includes(m.month)
        ? with_totals({
            ...m,
            [edit_field]: parsed_value,
            overridden: { ...m.overridden, [edit_field]: true },
            notes: { ...m.notes, [edit_field]: notes || undefined },
          })
        : m
      ))
      close_edit()
    } catch (err: any) {
      console.error('Error saving edit:', err)
      alert(`Failed to save changes${err?.message ? `: ${err.message}` : ''}`)
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
    } catch (err: any) {
      console.error('Error resetting to default:', err)
      alert(`Failed to reset to default${err?.message ? `: ${err.message}` : ''}`)
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
  const future = months.filter(m => m.status === 'future')

  const total_gross = sum(m => m.gross_income)
  const total_net = sum(m => m.net_income)
  const total_projected_out = sum(m => m.projected_out)
  const total_401k = sum(m => m.retirement_401k)
  const total_roth = sum(m => m.roth)
  const total_auto_savings = sum(m => m.auto_savings)
  // Actual transfers so far, plus planned transfers (savings-category budgets + Additional Savings) ahead
  const total_cash_savings = sum(m => m.saved_amount, elapsed) + sum(m => savings_budget + m.additional_savings, future)
  const total_savings = total_401k + total_roth + total_auto_savings + total_cash_savings

  const pct_of_gross = (n: number) => (total_gross > 0 ? ((n / total_gross) * 100).toFixed(1) : '0.0')

  const editing = months.find(m => m.month === editing_month)
  const remaining_after_edit = editing ? months.length - months.indexOf(editing) - 1 : 0

  const cell_base = 'px-1 py-2 text-right whitespace-nowrap tabular-nums'
  const divider = (col: Column) => (group_start.has(col.id) ? 'border-l border-gray-200' : '')

  const render_cell = (month: MonthData, col: Column) => {
    const value = col.value(month)
    const cls = `${cell_base} ${divider(col)}`

    if (col.actual && month.status === 'future') {
      return <td key={col.id} className={`${cls} text-gray-300`}>—</td>
    }

    if (!col.field) {
      return <td key={col.id} className={`${cls} ${col.tone?.(month) ?? 'text-gray-700'}`}><Amount value={value} /></td>
    }

    const field = col.field
    const is_overridden = month.overridden[field]
    const note = month.notes[field]
    const muted = value === 0 && !is_overridden

    return (
      <td key={col.id} className={cls}>
        <button
          onClick={() => open_edit(month, field)}
          title={is_overridden ? `Manually set${note ? `\n\n${note}` : ''}` : 'Click to edit'}
          className={`inline-flex items-center gap-1 hover:text-blue-600 transition ${
            muted ? 'text-gray-400' : field === 'adjustments' ? 'text-orange-600 font-medium' : 'text-gray-700'
          }`}
        >
          {note && <MessageSquare size={11} className="text-gray-400" />}
          {is_overridden && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
          {muted && field === 'adjustments' ? '—' : <Amount value={value} />}
        </button>
      </td>
    )
  }

  const render_total = (col: Column) => {
    const total = col.actual || col.id === 'adjustments' ? sum(col.value, elapsed) : sum(col.value)
    const empty = col.actual && elapsed.length === 0
    const tone = col.id === 'planned_leftover' || col.id === 'actual_leftover'
      ? (total >= 0 ? 'text-green-600' : 'text-red-600')
      : 'text-gray-800'
    return (
      <td key={col.id} className={`${cell_base} ${divider(col)} ${tone}`}>
        {empty ? '—' : <Amount value={total} />}
      </td>
    )
  }

  if (loading && months.length === 0) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="p-4 md:p-6 lg:px-4 w-full">
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
            Reset to Defaults
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
            <div className="text-sm opacity-90 mb-2">Total Projected Out ({year})</div>
            <div className="text-3xl font-bold">{money(total_projected_out, false)}</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-4">
            <div className="text-sm opacity-90 mb-2">Total Projected Savings ({year})</div>
            <div className="text-3xl font-bold">{money(total_savings, false)}</div>
            <div className="text-xs mt-2 space-y-1">
              <div>401k: {money(total_401k, false)} ({pct_of_gross(total_401k)}% of gross)</div>
              <div>Roth: {money(total_roth, false)} ({pct_of_gross(total_roth)}% of gross)</div>
              <div>Auto: {money(total_auto_savings, false)} ({pct_of_gross(total_auto_savings)}% of gross)</div>
              <div>
                <Tooltip text="Actual transfers to savings categories so far, plus planned savings for the rest of the year: your savings categories' monthly budgets and any Additional Savings.">
                  Saved: {money(total_cash_savings, false)} ({pct_of_gross(total_cash_savings)}% of gross)
                  <Info size={11} className="opacity-80" />
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-[11px] 2xl:text-xs tracking-tight">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="border-b border-gray-200">
                <th />
                {GROUPS.map(g => (
                  <th
                    key={g.id}
                    colSpan={COLUMNS.filter(c => c.group === g.id).length}
                    className="px-1.5 pt-2 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-l border-gray-200"
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="px-1.5 py-2 text-left font-medium text-gray-700 align-bottom">Month</th>
                {COLUMNS.map((col, i) => (
                  <th
                    key={col.id}
                    className={`px-1 py-2 text-right font-medium align-bottom leading-tight ${divider(col)} ${
                      col.field ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {col.tooltip ? (
                      <Tooltip text={col.tooltip} align={i < COLUMNS.length / 2 ? 'left' : 'right'}>
                        <span className="underline decoration-dotted decoration-gray-400 underline-offset-2">{col.label}</span>
                      </Tooltip>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const is_current = month.status === 'current'
                return (
                  <tr
                    key={month.month}
                    className={`border-b border-gray-100 ${is_current ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className={`px-1.5 py-2 font-medium text-gray-800 whitespace-nowrap ${is_current ? 'border-l-4 border-blue-500' : ''}`}>
                      <span className="2xl:hidden">{month.month_name.slice(0, 3)}</span>
                      <span className="hidden 2xl:inline">{month.month_name}</span>
                    </td>
                    {COLUMNS.map(col => render_cell(month, col))}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
              <tr>
                <td className="px-1.5 py-2 text-gray-800">Total</td>
                {COLUMNS.map(render_total)}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
          <span><span className="text-blue-700 font-medium">Blue columns</span> are editable: click a value</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Manually set
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare size={12} className="text-gray-400" /> Has notes (hover to read)
          </span>
          <span>
            <span className="underline decoration-dotted decoration-gray-400 underline-offset-2">Dotted column names</span> have details on hover
          </span>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              Edit {FIELDS[edit_field].label} - {editing.month_name}
            </h2>
            {FIELDS[edit_field].hint && (
              <p className="text-sm text-gray-500 mb-4">{FIELDS[edit_field].hint}</p>
            )}

            <div className="space-y-4 mt-4">
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
