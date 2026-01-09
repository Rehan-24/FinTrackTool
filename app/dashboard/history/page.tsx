'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sync_projected_purchases } from '@/lib/recurring-utils'
import { Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isBefore, isAfter } from 'date-fns'
import * as XLSX from 'xlsx'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

type MonthlyData = {
  month: string
  income: number
  spending: number
  net_cashflow: number
  purchases: Array<{
    date: string
    description: string
    category: string
    amount: number
    is_split: boolean
    is_projected: boolean
  }>
  categories: Array<{
    name: string
    budget: number
    spent: number
    color: string
  }>
  income_sources: Array<{
    source: string
    amount: number
    frequency: string
    is_salary: boolean
    yearly_salary: number | null
  }>
  recurring: number
  assets_snapshot: Array<{
    name: string
    value: number
    type: string
  }>
}

export default function MonthlyHistoryPage() {
  const [selected_month, setSelectedMonth] = useState(new Date())
  const [monthly_data, setMonthlyData] = useState<MonthlyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparison_data, setComparisonData] = useState<{
    prev_spending: number
    prev_income: number
  } | null>(null)
  const [chart_view, setChartView] = useState<'categories' | 'tags'>('categories')

  useEffect(() => {
    load_month_data()
  }, [selected_month])

  const load_month_data = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Sync projected purchases for selected month
      await sync_projected_purchases(user.id, selected_month)

      const start = format(startOfMonth(selected_month), 'yyyy-MM-dd')
      const end = format(endOfMonth(selected_month), 'yyyy-MM-dd')

      // Get purchases (including projected)
      const { data: purchases } = await supabase
        .from('purchases')
        .select('*, category:categories(name, color), tags')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      // Helper to parse date string as local date (not UTC)
      const parse_local_date = (date_string: string) => {
        const [year, month, day] = date_string.split('-').map(Number)
        return new Date(year, month - 1, day)
      }

      // Helper to check if purchase is truly upcoming (projected AND date in future)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const is_truly_upcoming = (purchase: any) => {
        if (!purchase.is_projected) return false
        const purchase_date = parse_local_date(purchase.date)
        return purchase_date >= today
      }

      // Get categories with budgets
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)

      // Calculate spending per category (actual + past projected)
      const categories_with_spent = (categories || []).map(cat => {
        const spent = (purchases || [])
          .filter(p => {
            if (p.category_id !== cat.id) return false
            // Include regular purchases OR projected with date in past
            if (!p.is_projected) return true
            const purchase_date = parse_local_date(p.date)
            return purchase_date < today
          })
          .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)
        return {
          name: cat.name,
          budget: parseFloat(cat.monthly_budget.toString()),
          spent,
          color: cat.color
        }
      })

      // Get income
      const { data: income_data } = await supabase
        .from('income')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)

      let total_income = 0
      const income_sources: Array<{
        source: string
        amount: number
        frequency: string
        is_salary: boolean
        yearly_salary: number | null
      }> = []

      if (income_data) {
        income_data.forEach(inc => {
          const amt = parseFloat(inc.amount.toString())
          income_sources.push({
            source: inc.source,
            amount: amt,
            frequency: inc.frequency,
            is_salary: inc.is_salary,
            yearly_salary: inc.yearly_salary
          })

          if (!inc.is_recurring) {
            total_income += amt
          } else {
            if (inc.frequency === 'monthly') total_income += amt
            if (inc.frequency === 'bi-weekly') total_income += amt * 2.17
            if (inc.frequency === 'weekly') total_income += amt * 4.33
            if (inc.frequency === 'yearly') total_income += amt / 12
          }
        })
      }

      // Get recurring expenses total
      const { data: recurring_data } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)

      let recurring_total = 0
      if (recurring_data) {
        recurring_data.forEach(rec => {
          const amt = parseFloat(rec.amount.toString())
          if (rec.frequency === 'monthly') recurring_total += amt
          if (rec.frequency === 'weekly') recurring_total += amt * 4.33
          if (rec.frequency === 'yearly') recurring_total += amt / 12
        })
      }

      // Get assets snapshot
      const { data: assets } = await supabase
        .from('assets')
        .select('name, current_value, type')
        .eq('user_id', user.id)

      const total_spending = (purchases || [])
        .filter(p => {
          // Include regular purchases OR projected with date in past
          if (!p.is_projected) return true
          const purchase_date = parse_local_date(p.date)
          return purchase_date < today
        })
        .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)

      setMonthlyData({
        month: format(selected_month, 'MMMM yyyy'),
        income: total_income,
        spending: total_spending,
        net_cashflow: total_income - total_spending,
        purchases: (purchases || []).map(p => ({
          date: p.date,
          description: p.description,
          category: p.category.name,
          amount: parseFloat(p.actual_cost.toString()),
          is_split: p.is_split,
          is_projected: is_truly_upcoming(p) // Only show as projected if truly upcoming
        })),
        categories: categories_with_spent,
        income_sources,
        recurring: recurring_total,
        assets_snapshot: (assets || []).map(a => ({
          name: a.name,
          value: parseFloat(a.current_value.toString()),
          type: a.type
        }))
      })

      // Load comparison data (previous month)
      const prev_month = subMonths(selected_month, 1)
      const prev_start = format(startOfMonth(prev_month), 'yyyy-MM-dd')
      const prev_end = format(endOfMonth(prev_month), 'yyyy-MM-dd')

      const { data: prev_purchases } = await supabase
        .from('purchases')
        .select('actual_cost, is_projected')
        .eq('user_id', user.id)
        .gte('date', prev_start)
        .lte('date', prev_end)

      const { data: prev_income } = await supabase
        .from('income')
        .select('amount, frequency, is_recurring')
        .eq('user_id', user.id)
        .gte('date', prev_start)
        .lte('date', prev_end)

      let prev_income_total = 0
      if (prev_income) {
        prev_income.forEach(inc => {
          const amt = parseFloat(inc.amount.toString())
          if (!inc.is_recurring) {
            prev_income_total += amt
          } else {
            if (inc.frequency === 'monthly') prev_income_total += amt
            if (inc.frequency === 'bi-weekly') prev_income_total += amt * 2.17
            if (inc.frequency === 'weekly') prev_income_total += amt * 4.33
            if (inc.frequency === 'yearly') prev_income_total += amt / 12
          }
        })
      }

      setComparisonData({
        prev_spending: (prev_purchases || [])
          .filter(p => !p.is_projected)
          .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0),
        prev_income: prev_income_total
      })

    } catch (err) {
      console.error('Error loading month data:', err)
    } finally {
      setLoading(false)
    }
  }

  const export_to_excel = async () => {
    if (!monthly_data) return

    const wb = XLSX.utils.book_new()

    // Sheet 1: Summary
    const summary_data = [
      ['Finance Tracker - Monthly Report'],
      ['Month:', monthly_data.month],
      [],
      ['SUMMARY'],
      ['Income', monthly_data.income.toFixed(2)],
      ['Spending', monthly_data.spending.toFixed(2)],
      ['Net Cashflow', monthly_data.net_cashflow.toFixed(2)],
      ['Recurring Expenses', monthly_data.recurring.toFixed(2)],
      [],
      ['ASSETS SNAPSHOT'],
      ['Asset', 'Value'],
      ...monthly_data.assets_snapshot.map(a => [a.name, a.value.toFixed(2)]),
      [],
      ['Total Assets', monthly_data.assets_snapshot.reduce((sum, a) => sum + a.value, 0).toFixed(2)]
    ]
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_data)
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Summary')

    // Sheet 2: All Purchases
    const purchases_data = [
      ['Date', 'Description', 'Category', 'Amount', 'Split Payment', 'Status'],
      ...monthly_data.purchases.map(p => [
        format(new Date(p.date), 'MMM d, yyyy'),
        p.description,
        p.category,
        p.amount.toFixed(2),
        p.is_split ? 'Yes' : 'No',
        p.is_projected ? 'Upcoming' : 'Paid'
      ])
    ]
    const purchases_ws = XLSX.utils.aoa_to_sheet(purchases_data)
    XLSX.utils.book_append_sheet(wb, purchases_ws, 'All Purchases')

    // Sheet 3: Category Breakdown
    const categories_data = [
      ['Category', 'Budget', 'Spent', 'Remaining', '% Used'],
      ...monthly_data.categories.map(c => [
        c.name,
        c.budget.toFixed(2),
        c.spent.toFixed(2),
        (c.budget - c.spent).toFixed(2),
        ((c.spent / c.budget) * 100).toFixed(1) + '%'
      ]),
      [],
      ['TOTALS'],
      ['Total Budget', monthly_data.categories.reduce((sum, c) => sum + c.budget, 0).toFixed(2)],
      ['Total Spent', monthly_data.categories.reduce((sum, c) => sum + c.spent, 0).toFixed(2)]
    ]
    const categories_ws = XLSX.utils.aoa_to_sheet(categories_data)
    XLSX.utils.book_append_sheet(wb, categories_ws, 'Budget by Category')

    // Sheet 4: Income Streams
    const income_data = [
      ['Source', 'Amount', 'Frequency', 'Type', 'Annual Salary'],
      ...monthly_data.income_sources.map(i => [
        i.source,
        i.amount.toFixed(2),
        i.frequency,
        i.is_salary ? 'Salary' : 'Other',
        i.yearly_salary ? i.yearly_salary.toFixed(2) : '-'
      ]),
      [],
      ['TOTAL INCOME', monthly_data.income.toFixed(2)]
    ]
    const income_ws = XLSX.utils.aoa_to_sheet(income_data)
    XLSX.utils.book_append_sheet(wb, income_ws, 'Income Streams')

    // Sheet 5: Salary Details (if applicable)
    const salary_sources = monthly_data.income_sources.filter(i => i.is_salary)
    if (salary_sources.length > 0) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const salary_income_ids = await supabase
          .from('income')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_salary', true)

        if (salary_income_ids.data && salary_income_ids.data.length > 0) {
          const { data: deductions } = await supabase
            .from('salary_deductions')
            .select('*')
            .eq('income_id', salary_income_ids.data[0].id)
            .single()

          if (deductions) {
            const salary_details_data = [
              ['SALARY BREAKDOWN'],
              [],
              ['PRE-TAX DEDUCTIONS'],
              ['401k', deductions.pre_tax_401k.toFixed(2)],
              ['401k Roth', deductions.pre_tax_401k_roth.toFixed(2)],
              ['HSA', deductions.hsa.toFixed(2)],
              ['Medical Insurance', deductions.medical_insurance.toFixed(2)],
              ['Dental Insurance', deductions.dental_insurance.toFixed(2)],
              ['Vision Insurance', deductions.vision_insurance.toFixed(2)],
              [],
              ['TAXES'],
              ['Federal Tax', deductions.federal_tax.toFixed(2)],
              ['State Tax', deductions.state_tax.toFixed(2)],
              ['Social Security', deductions.social_security.toFixed(2)],
              ['Medicare', deductions.medicare.toFixed(2)],
              ['FICA Total', deductions.fica_total.toFixed(2)],
              ['CA Disability', deductions.ca_disability.toFixed(2)],
              [],
              ['AFTER-TAX DEDUCTIONS'],
              ['401k After-Tax', deductions.after_tax_401k.toFixed(2)],
              ['Life Insurance', deductions.life_insurance.toFixed(2)],
              ['AD&D', deductions.ad_d.toFixed(2)],
              ['Critical Illness', deductions.critical_illness.toFixed(2)],
              ['Hospital Indemnity', deductions.hospital_indemnity.toFixed(2)],
              ['Accident Insurance', deductions.accident_insurance.toFixed(2)],
              ['Legal Plan', deductions.legal_plan.toFixed(2)],
              ['Identity Theft', deductions.identity_theft.toFixed(2)],
              [],
              ['NET PAY'],
              ['Yearly', deductions.net_yearly.toFixed(2)],
              ['Monthly', deductions.net_monthly.toFixed(2)],
              ['Bi-Weekly', deductions.net_biweekly.toFixed(2)],
            ]
            const salary_ws = XLSX.utils.aoa_to_sheet(salary_details_data)
            XLSX.utils.book_append_sheet(wb, salary_ws, 'Salary Details')
          }
        }
      }
    }

    const filename = `finance-tracker-${format(selected_month, 'yyyy-MM')}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  const go_prev_month = () => {
    setSelectedMonth(prev => subMonths(prev, 1))
  }

  const go_next_month = () => {
    const next = addMonths(selected_month, 1)
    if (next <= new Date()) {
      setSelectedMonth(next)
    }
  }

  const get_change_percent = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!monthly_data) {
    return <div className="flex items-center justify-center h-screen">No data available</div>
  }

  const spending_change = comparison_data ? get_change_percent(monthly_data.spending, comparison_data.prev_spending) : 0
  const income_change = comparison_data ? get_change_percent(monthly_data.income, comparison_data.prev_income) : 0

  const actual_purchases = monthly_data.purchases.filter(p => !p.is_projected)
  const projected_purchases = monthly_data.purchases.filter(p => p.is_projected)

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-3 md:p-8">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <h2 className="text-xl md:text-3xl font-bold text-gray-800">Monthly History</h2>
          <p className="text-gray-600 mt-1 text-xs md:text-base">Review past financial data</p>
          <button
            onClick={export_to_excel}
            className="mt-3 w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 md:px-6 md:py-3 rounded-lg text-sm font-medium hover:bg-green-700 transition"
          >
            <Download size={18} />
            Export to Excel
          </button>
        </div>

        {/* Month Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-6 mb-3 md:mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={go_prev_month}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft size={24} />
            </button>
            <h3 className="text-lg md:text-2xl font-bold text-gray-800">
              {format(selected_month, 'MMMM yyyy')}
            </h3>
            <button
              onClick={go_next_month}
              disabled={addMonths(selected_month, 1) > new Date()}
              className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-6 mb-3 md:mb-8">
          <div className="bg-white rounded-lg p-3 md:p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <span className="text-gray-600 text-xs md:text-base">Income</span>
              <TrendingUp className="text-emerald-500" size={16} />
            </div>
            <div className="text-xl md:text-3xl font-bold text-gray-800">
              ${monthly_data.income.toFixed(2)}
            </div>
            {comparison_data && comparison_data.prev_income > 0 && (
              <div className={`text-xs mt-1 md:mt-2 flex items-center gap-1 ${income_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {income_change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(income_change).toFixed(1)}% vs last month
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-3 md:p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <span className="text-gray-600 text-xs md:text-base">Spending</span>
              <TrendingDown className="text-red-500" size={16} />
            </div>
            <div className="text-xl md:text-3xl font-bold text-gray-800">
              ${monthly_data.spending.toFixed(2)}
            </div>
            {comparison_data && comparison_data.prev_spending > 0 && (
              <div className={`text-xs mt-1 md:mt-2 flex items-center gap-1 ${spending_change <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {spending_change <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                {Math.abs(spending_change).toFixed(1)}% vs last month
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-3 md:p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <span className="text-gray-600 text-xs md:text-base">Net Cashflow</span>
              <TrendingUp className={monthly_data.net_cashflow >= 0 ? 'text-green-500' : 'text-red-500'} size={16} />
            </div>
            <div className={`text-xl md:text-3xl font-bold ${monthly_data.net_cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthly_data.net_cashflow >= 0 ? '+' : ''}${monthly_data.net_cashflow.toFixed(2)}
            </div>
            <div className="text-xs mt-1 md:mt-2 text-gray-500">
              {monthly_data.net_cashflow >= 0 ? 'Saved' : 'Over budget'}
            </div>
          </div>
        </div>

        {/* Budget by Category */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-6 mb-3 md:mb-6">
          <h3 className="text-sm md:text-lg font-semibold text-gray-800 mb-2 md:mb-4">Budget by Category</h3>
          <div className="space-y-2 md:space-y-4">
            {monthly_data.categories.map((cat, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center mb-1 md:mb-2">
                  <div className="flex items-center gap-1 md:gap-2">
                    <div className="w-2 h-2 md:w-3 md:h-3 rounded-full" style={{backgroundColor: cat.color}}></div>
                    <span className="text-xs md:text-base font-medium text-gray-700">{cat.name}</span>
                  </div>
                  <span className="text-xs md:text-base text-gray-600 font-medium whitespace-nowrap ml-2">
                    ${cat.spent.toFixed(2)} / ${cat.budget.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 md:h-2.5">
                  <div 
                    className="rounded-full h-1.5 md:h-2.5" 
                    style={{
                      width: `${Math.min((cat.spent / cat.budget) * 100, 100)}%`, 
                      backgroundColor: cat.color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assets Snapshot */}
        {monthly_data.assets_snapshot.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Assets Snapshot</h3>
            <div className="space-y-3">
              {monthly_data.assets_snapshot.map((asset, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">{asset.name}</span>
                  <span className={`text-lg font-bold ${asset.type === 'debt' ? 'text-red-600' : 'text-gray-800'}`}>
                    {asset.type === 'debt' ? '-' : ''}${asset.value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border-t-2 border-green-600">
                <span className="font-bold text-gray-800">Net Worth</span>
                <span className="text-xl font-bold text-green-600">
                  ${monthly_data.assets_snapshot.reduce((sum, a) => 
                    sum + (a.type === 'debt' ? -a.value : a.value), 0
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-3 md:p-6 border-b border-gray-200">
            <h3 className="text-sm md:text-lg font-semibold text-gray-800">
              All Transactions
            </h3>
            <div className="text-xs md:text-sm text-gray-600 mt-1">
              {actual_purchases.length} paid • {projected_purchases.length} upcoming
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {monthly_data.purchases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No purchases this month
                    </td>
                  </tr>
                ) : (
                  monthly_data.purchases.map((purchase, idx) => (
                    <tr key={idx} className={`hover:bg-gray-50 ${purchase.is_projected ? 'bg-yellow-50' : ''}`}>
                      <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap text-gray-600">
                        {format(new Date(purchase.date), 'MMM d')}
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4 text-gray-800">
                        <div className="font-medium">{purchase.description}</div>
                        {purchase.is_split && (
                          <div className="text-xs text-gray-500">Split</div>
                        )}
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap text-gray-700">
                        {purchase.category}
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        {purchase.is_projected ? (
                          <span className="px-1 md:px-2 py-0.5 md:py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                            Upcoming
                          </span>
                        ) : (
                          <span className="px-1 md:px-2 py-0.5 md:py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap text-right font-medium text-gray-800">
                        ${purchase.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Beta Feature: Spending Analysis Charts */}
        {monthly_data.purchases.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-6 mt-3 md:mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm md:text-lg font-semibold text-gray-800">Spending Analysis</h3>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Beta</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartView('categories')}
                  className={`px-3 py-1 text-xs md:text-sm rounded-lg transition ${
                    chart_view === 'categories'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  By Category
                </button>
                <button
                  onClick={() => setChartView('tags')}
                  className={`px-3 py-1 text-xs md:text-sm rounded-lg transition ${
                    chart_view === 'tags'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  By Tags
                </button>
              </div>
            </div>

            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(() => {
                      if (chart_view === 'categories') {
                        // Group by category
                        const category_map = new Map<string, { value: number; color: string }>()
                        monthly_data.purchases
                          .filter(p => !p.is_projected) // Only actual spending
                          .forEach(p => {
                            const existing = category_map.get(p.category)
                            if (existing) {
                              existing.value += p.amount
                            } else {
                              category_map.set(p.category, {
                                value: p.amount,
                                color: monthly_data.categories.find(c => c.name === p.category)?.color || '#94a3b8'
                              })
                            }
                          })
                        return Array.from(category_map.entries()).map(([name, data]) => ({
                          name,
                          value: data.value,
                          color: data.color
                        }))
                      } else {
                        // Group by tags - inherit category colors
                        const tag_map = new Map<string, { value: number; color: string }>()
                        monthly_data.purchases
                          .filter(p => !p.is_projected) // Only actual spending
                          .forEach((p: any) => {
                            if (p.tags && p.tags.length > 0) {
                              p.tags.forEach((tag: string) => {
                                const existing = tag_map.get(tag)
                                const category_color = monthly_data.categories.find(c => c.name === p.category)?.color || '#94a3b8'
                                if (existing) {
                                  existing.value += p.amount
                                } else {
                                  tag_map.set(tag, { value: p.amount, color: category_color })
                                }
                              })
                            } else {
                              // If no tags, use category name with category color
                              const existing = tag_map.get(p.category)
                              const category_color = monthly_data.categories.find(c => c.name === p.category)?.color || '#94a3b8'
                              if (existing) {
                                existing.value += p.amount
                              } else {
                                tag_map.set(p.category, { value: p.amount, color: category_color })
                              }
                            }
                          })
                        return Array.from(tag_map.entries())
                          .map(([name, data]) => ({
                            name,
                            value: data.value,
                            color: data.color
                          }))
                          .sort((a, b) => b.value - a.value)
                      }
                    })()}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
                      // Only show label if slice is > 5%
                      if (percent < 0.05) return null
                      const RADIAN = Math.PI / 180
                      const radius = outerRadius + 25
                      const x = cx + radius * Math.cos(-midAngle * RADIAN)
                      const y = cy + radius * Math.sin(-midAngle * RADIAN)
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="#374151" 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          fontSize="12"
                        >
                          {`${name} (${(percent * 100).toFixed(0)}%)`}
                        </text>
                      )
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(() => {
                      // Get the actual data that was passed to the Pie
                      const pie_data = (() => {
                        if (chart_view === 'categories') {
                          const category_map = new Map<string, { value: number; color: string }>()
                          monthly_data.purchases
                            .filter(p => !p.is_projected)
                            .forEach(p => {
                              const existing = category_map.get(p.category)
                              if (existing) {
                                existing.value += p.amount
                              } else {
                                category_map.set(p.category, {
                                  value: p.amount,
                                  color: monthly_data.categories.find(c => c.name === p.category)?.color || '#94a3b8'
                                })
                              }
                            })
                          return Array.from(category_map.entries()).map(([name, data]) => ({
                            name,
                            value: data.value,
                            color: data.color
                          }))
                        } else {
                          const tag_map = new Map<string, { value: number; color: string }>()
                          monthly_data.purchases
                            .filter(p => !p.is_projected)
                            .forEach((p: any) => {
                              if (p.tags && p.tags.length > 0) {
                                p.tags.forEach((tag: string) => {
                                  const existing = tag_map.get(tag)
                                  const category_color = monthly_data.categories.find(c => c.name === p.category)?.color || '#94a3b8'
                                  if (existing) {
                                    existing.value += p.amount
                                  } else {
                                    tag_map.set(tag, { value: p.amount, color: category_color })
                                  }
                                })
                              } else {
                                const existing = tag_map.get(p.category)
                                const category_color = monthly_data.categories.find(c => c.name === p.category)?.color || '#94a3b8'
                                if (existing) {
                                  existing.value += p.amount
                                } else {
                                  tag_map.set(p.category, { value: p.amount, color: category_color })
                                }
                              }
                            })
                          return Array.from(tag_map.entries())
                            .map(([name, data]) => ({
                              name,
                              value: data.value,
                              color: data.color
                            }))
                            .sort((a, b) => b.value - a.value)
                        }
                      })()
                      
                      return pie_data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))
                    })()}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
