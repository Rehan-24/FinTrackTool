'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import * as XLSX from 'xlsx'

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
  }>
  categories: Array<{
    name: string
    budget: number
    spent: number
    color: string
  }>
  recurring: number
  assets_snapshot: Array<{
    name: string
    value: number
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

  useEffect(() => {
    load_month_data()
  }, [selected_month])

  const load_month_data = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const start = format(startOfMonth(selected_month), 'yyyy-MM-dd')
      const end = format(endOfMonth(selected_month), 'yyyy-MM-dd')

      // Get purchases
      const { data: purchases } = await supabase
        .from('purchases')
        .select('*, category:categories(name, color)')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      // Get categories with budgets
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)

      // Calculate spending per category
      const categories_with_spent = (categories || []).map(cat => {
        const spent = (purchases || [])
          .filter(p => p.category_id === cat.id)
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
      if (income_data) {
        income_data.forEach(inc => {
          const amt = parseFloat(inc.amount.toString())
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

      // Get assets snapshot (closest to end of month)
      const { data: assets } = await supabase
        .from('assets')
        .select('name, current_value')
        .eq('user_id', user.id)

      const total_spending = (purchases || []).reduce((sum, p) => 
        sum + parseFloat(p.actual_cost.toString()), 0
      )

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
          is_split: p.is_split
        })),
        categories: categories_with_spent,
        recurring: recurring_total,
        assets_snapshot: (assets || []).map(a => ({
          name: a.name,
          value: parseFloat(a.current_value.toString())
        }))
      })

      // Load comparison data (previous month)
      const prev_month = subMonths(selected_month, 1)
      const prev_start = format(startOfMonth(prev_month), 'yyyy-MM-dd')
      const prev_end = format(endOfMonth(prev_month), 'yyyy-MM-dd')

      const { data: prev_purchases } = await supabase
        .from('purchases')
        .select('actual_cost')
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
        prev_spending: (prev_purchases || []).reduce((sum, p) => 
          sum + parseFloat(p.actual_cost.toString()), 0
        ),
        prev_income: prev_income_total
      })

    } catch (err) {
      console.error('Error loading month data:', err)
    } finally {
      setLoading(false)
    }
  }

  const export_to_excel = () => {
    if (!monthly_data) return

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Summary sheet
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

    // Purchases sheet
    const purchases_data = [
      ['Date', 'Description', 'Category', 'Amount', 'Split Payment'],
      ...monthly_data.purchases.map(p => [
        format(new Date(p.date), 'MMM d, yyyy'),
        p.description,
        p.category,
        p.amount.toFixed(2),
        p.is_split ? 'Yes' : 'No'
      ])
    ]
    const purchases_ws = XLSX.utils.aoa_to_sheet(purchases_data)
    XLSX.utils.book_append_sheet(wb, purchases_ws, 'Purchases')

    // Categories sheet
    const categories_data = [
      ['Category', 'Budget', 'Spent', 'Remaining', '% Used'],
      ...monthly_data.categories.map(c => [
        c.name,
        c.budget.toFixed(2),
        c.spent.toFixed(2),
        (c.budget - c.spent).toFixed(2),
        ((c.spent / c.budget) * 100).toFixed(1) + '%'
      ])
    ]
    const categories_ws = XLSX.utils.aoa_to_sheet(categories_data)
    XLSX.utils.book_append_sheet(wb, categories_ws, 'Budget by Category')

    // Save file
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

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Monthly History</h2>
            <p className="text-gray-600 mt-1">Review past financial data</p>
          </div>
          <button
            onClick={export_to_excel}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition"
          >
            <Download size={20} />
            Export to Excel
          </button>
        </div>

        {/* Month Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={go_prev_month}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft size={24} />
            </button>
            <h3 className="text-2xl font-bold text-gray-800">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Income</span>
              <TrendingUp className="text-emerald-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-gray-800">
              ${monthly_data.income.toFixed(2)}
            </div>
            {comparison_data && comparison_data.prev_income > 0 && (
              <div className={`text-sm mt-2 flex items-center gap-1 ${income_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {income_change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {Math.abs(income_change).toFixed(1)}% vs last month
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Spending</span>
              <TrendingDown className="text-red-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-gray-800">
              ${monthly_data.spending.toFixed(2)}
            </div>
            {comparison_data && comparison_data.prev_spending > 0 && (
              <div className={`text-sm mt-2 flex items-center gap-1 ${spending_change <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {spending_change <= 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                {Math.abs(spending_change).toFixed(1)}% vs last month
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Net Cashflow</span>
              <TrendingUp className={monthly_data.net_cashflow >= 0 ? 'text-green-500' : 'text-red-500'} size={20} />
            </div>
            <div className={`text-3xl font-bold ${monthly_data.net_cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthly_data.net_cashflow >= 0 ? '+' : ''}${monthly_data.net_cashflow.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {monthly_data.net_cashflow >= 0 ? 'Saved' : 'Over budget'}
            </div>
          </div>
        </div>

        {/* Budget by Category */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Budget by Category</h3>
          <div className="space-y-4">
            {monthly_data.categories.map((cat, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: cat.color}}></div>
                    <span className="font-medium text-gray-700">{cat.name}</span>
                  </div>
                  <span className="text-gray-600 font-medium">
                    ${cat.spent.toFixed(2)} / ${cat.budget.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="rounded-full h-2.5" 
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
                  <span className="text-lg font-bold text-gray-800">
                    ${asset.value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border-t-2 border-green-600">
                <span className="font-bold text-gray-800">Total Assets</span>
                <span className="text-xl font-bold text-green-600">
                  ${monthly_data.assets_snapshot.reduce((sum, a) => sum + a.value, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              All Transactions ({monthly_data.purchases.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {monthly_data.purchases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No purchases this month
                    </td>
                  </tr>
                ) : (
                  monthly_data.purchases.map((purchase, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(purchase.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        <div className="font-medium">{purchase.description}</div>
                        {purchase.is_split && (
                          <div className="text-xs text-gray-500">Split payment</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {purchase.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-800">
                        ${purchase.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
