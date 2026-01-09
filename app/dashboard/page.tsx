'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sync_projected_purchases } from '@/lib/recurring-utils'
import { VERSION_NOTES, CURRENT_VERSION, VersionNote } from '@/lib/version_notes'
import { DollarSign, TrendingUp, PieChart, Receipt, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'

type Category = {
  id: string
  name: string
  color: string
  monthly_budget: number
  spent: number
  projected?: number
  total?: number
}

type Purchase = {
  id: string
  description: string
  actual_cost: number
  date: string
  is_projected: boolean
  category: {
    name: string
    color: string
  }
}

export default function DashboardPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [recent_purchases, setRecentPurchases] = useState<Purchase[]>([])
  const [monthly_income, setMonthlyIncome] = useState(0)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [show_version_notes, setShowVersionNotes] = useState(false)

  useEffect(() => {
    load_dashboard()
    check_version_notes()
    
    // Listen for version number clicks
    const handle_show_notes = () => setShowVersionNotes(true)
    window.addEventListener('show-version-notes', handle_show_notes)
    return () => window.removeEventListener('show-version-notes', handle_show_notes)
  }, [])

  const check_version_notes = () => {
    const last_seen = localStorage.getItem('last_seen_version')
    if (last_seen !== CURRENT_VERSION) {
      setShowVersionNotes(true)
      localStorage.setItem('last_seen_version', CURRENT_VERSION)
    }
  }

  // Helper to parse date string as local date (not UTC)
  const parse_local_date = (date_string: string) => {
    const [year, month, day] = date_string.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  useEffect(() => {
    load_dashboard()
  }, [])

  const load_dashboard = async () => {
    try {
      const { data: { user: current_user } } = await supabase.auth.getUser()
      if (!current_user) return
      setUser(current_user)

      // Sync projected purchases for current month
      await sync_projected_purchases(current_user.id, new Date())

      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      // Get categories
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', current_user.id)
        .order('name')

      // Get purchases (including projected)
      const { data: purchases } = await supabase
        .from('purchases')
        .select('*, category:categories(name, color)')
        .eq('user_id', current_user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      // Calculate spending per category (INCLUDING projected for budget view)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      console.log('[Dashboard] Today:', today.toISOString().split('T')[0])
      console.log('[Dashboard] Total purchases fetched:', purchases?.length || 0)
      console.log('[Dashboard] Projected purchases:', purchases?.filter(p => p.is_projected).length || 0)
      
      const cats_with_spent = (cats || []).map(cat => {
        // Actual spent: NOT projected OR projected but date has passed (paid recurring)
        const actual_spent = (purchases || [])
          .filter(p => {
            if (p.category_id !== cat.id) return false
            if (!p.is_projected) return true // Regular purchases
            // Include projected if date has passed (paid recurring)
            const purchase_date = parse_local_date(p.date)
            return purchase_date < today
          })
          .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)
        
        // Projected: is_projected AND date in future
        const projected_purchases = (purchases || [])
          .filter(p => {
            if (p.category_id !== cat.id || !p.is_projected) return false
            const purchase_date = parse_local_date(p.date)
            return purchase_date >= today
          })
        
        const projected_spent = projected_purchases
          .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)
        
        if (projected_purchases.length > 0) {
          console.log(`[Dashboard] Category ${cat.name}:`, {
            projected_count: projected_purchases.length,
            projected_amount: projected_spent,
            dates: projected_purchases.map(p => p.date)
          })
        }
        
        const total_spent = actual_spent + projected_spent
        return { ...cat, spent: actual_spent, projected: projected_spent, total: total_spent }
      })

      setCategories(cats_with_spent)
      
      // Filter recent purchases to only show paid (not upcoming/future)
      const paid_purchases = (purchases || []).filter(p => {
        if (!p.is_projected) return true // Always show actual purchases
        const purchase_date = parse_local_date(p.date)
        return purchase_date < today // Only show projected if date has passed
      })
      setRecentPurchases(paid_purchases.slice(0, 5))

      // Get income for current month
      const { data: income_data } = await supabase
        .from('income')
        .select('amount, frequency, is_recurring')
        .eq('user_id', current_user.id)
        .gte('date', start)
        .lte('date', end)

      // Calculate monthly income (using current month, inclusive)
      let total_income = 0
      if (income_data) {
        const today = new Date()
        const days_in_month = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        
        income_data.forEach(inc => {
          const amt = parseFloat(inc.amount.toString())
          if (!inc.is_recurring) {
            // One-time income counts fully
            total_income += amt
          } else {
            // Recurring income: estimate for full month
            if (inc.frequency === 'monthly') total_income += amt
            if (inc.frequency === 'bi-weekly') total_income += (amt * days_in_month) / 14
            if (inc.frequency === 'weekly') total_income += (amt * days_in_month) / 7
            if (inc.frequency === 'yearly') total_income += amt / 12
          }
        })
      }
      setMonthlyIncome(total_income)
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const total_spent = categories.reduce((sum, cat) => sum + cat.spent, 0)
  const total_projected = categories.reduce((sum, cat) => sum + (cat.projected || 0), 0)
  const total_with_projected = total_spent + total_projected
  const total_budget = categories.reduce((sum, cat) => sum + parseFloat(cat.monthly_budget.toString()), 0)
  const budget_remaining = total_budget - total_with_projected
  const budget_percentage = total_budget > 0 ? (total_with_projected / total_budget) * 100 : 0
  const is_over_budget = budget_percentage > 100
  const net_cashflow = monthly_income - total_spent

  console.log('[Dashboard] Final Totals:', {
    total_spent,
    total_projected,
    total_with_projected,
    category_count: categories.length,
    categories_with_projected: categories.filter(c => (c.projected || 0) > 0).length
  })

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-4 md:p-8">
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Dashboard</h2>
            <p className="text-gray-600 mt-1 text-sm md:text-base">{format(new Date(), 'MMMM yyyy')}</p>
          </div>
          <Link
            href="/dashboard/add"
            className="hidden md:flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <Receipt size={20} />
            Add Purchase
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-lg p-4 md:p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm md:text-base">Income</span>
              <TrendingUp className="text-emerald-500" size={18} />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-800">${monthly_income.toFixed(2)}</div>
            <div className="text-xs md:text-sm text-gray-500 mt-1">this month</div>
          </div>

          <div className="bg-white rounded-lg p-4 md:p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm md:text-base">Spending</span>
              <TrendingUp className="text-red-500" size={18} />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-800">${total_spent.toFixed(2)}</div>
            <div className="text-xs md:text-sm text-gray-500 mt-1">of ${total_budget.toFixed(2)}</div>
          </div>
          
          <div className="bg-white rounded-lg p-4 md:p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm md:text-base">Cashflow</span>
              <DollarSign className={net_cashflow >= 0 ? "text-green-500" : "text-red-500"} size={18} />
            </div>
            <div className={`text-2xl md:text-3xl font-bold ${net_cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {net_cashflow >= 0 ? '+' : ''}${net_cashflow.toFixed(2)}
            </div>
            <div className="text-xs md:text-sm text-gray-500 mt-1 hidden md:block">income - spending</div>
          </div>

          <div className={`rounded-lg p-4 md:p-6 border-2 ${
            is_over_budget 
              ? 'bg-red-50 border-red-200' 
              : budget_percentage > 80 
                ? 'bg-yellow-50 border-yellow-200' 
                : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium text-sm md:text-base">Budget Remaining</span>
              <PieChart className={
                is_over_budget 
                  ? "text-red-500" 
                  : budget_percentage > 80 
                    ? "text-yellow-500" 
                    : "text-green-500"
              } size={20} />
            </div>
            <div className={`text-3xl md:text-4xl font-bold ${
              is_over_budget 
                ? 'text-red-600' 
                : budget_percentage > 80 
                  ? 'text-yellow-600' 
                  : 'text-green-600'
            }`}>
              {is_over_budget ? '-' : ''}${Math.abs(budget_remaining).toFixed(2)}
            </div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">
              ${total_with_projected.toFixed(2)} spent
            </div>
            <div className={`text-xs md:text-sm font-medium mt-2 ${
              is_over_budget 
                ? 'text-red-700' 
                : budget_percentage > 80 
                  ? 'text-yellow-700' 
                  : 'text-green-700'
            }`}>
              {is_over_budget 
                ? `Over budget` 
                : `of $${total_budget.toFixed(2)} budget`}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className={`rounded-full h-2 transition-all ${
                  is_over_budget 
                    ? 'bg-red-500' 
                    : budget_percentage > 80 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budget_percentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Budget by Category */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
          <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Budget by Category</h3>
          <div className="space-y-3 md:space-y-4">
            {categories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No categories yet.</p>
                <Link href="/dashboard/settings" className="text-blue-600 hover:underline">
                  Add your first category
                </Link>
              </div>
            ) : (
              categories.map((cat) => {
                // Use total (actual + projected) for percentage calculation
                const totalToUse = cat.total || cat.spent
                const percentage = cat.monthly_budget > 0 ? (totalToUse / parseFloat(cat.monthly_budget.toString())) * 100 : 0
                const isOverBudget = percentage > 100

                return (
                  <div key={cat.id}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium text-gray-700">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-600'}`}>
                          ${cat.spent.toFixed(2)}
                        </span>
                        {cat.projected && cat.projected > 0 && (
                          <span className="text-yellow-600 text-sm">
                            {' '}+ ${cat.projected.toFixed(2)}
                          </span>
                        )}
                        <span className="text-gray-400"> / </span>
                        <span className="text-gray-600">
                          ${parseFloat(cat.monthly_budget.toString()).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                      <div
                        className="rounded-full h-2.5 transition-all"
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: isOverBudget ? '#EF4444' : cat.color,
                        }}
                      />
                    </div>
                    {cat.projected && cat.projected > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Includes ${cat.projected.toFixed(2)} upcoming charges
                      </div>
                    )}
                    {isOverBudget && (
                      <div className="text-xs text-red-600 mt-1">
                        Over budget by ${(totalToUse - parseFloat(cat.monthly_budget.toString())).toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Recent Transactions</h3>
            <Link
              href="/dashboard/transactions"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          {recent_purchases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Receipt size={48} className="mx-auto mb-4 opacity-50" />
              <p className="mb-2">No transactions yet this month.</p>
              <Link
                href="/dashboard/add"
                className="text-blue-600 hover:underline"
              >
                Add your first purchase
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {recent_purchases.map((purchase) => (
                <div key={purchase.id} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: purchase.category.color + '20' }}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: purchase.category.color }}
                        />
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 flex items-center gap-2">
                          {purchase.description}
                          {purchase.is_projected && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {purchase.category.name} • {format(parse_local_date(purchase.date), 'MMM d')}
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-semibold ${purchase.is_projected ? 'text-yellow-600' : 'text-gray-800'}`}>
                      ${parseFloat(purchase.actual_cost.toString()).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Version Notes Modal */}
      {show_version_notes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  🎉 What's New in v{VERSION_NOTES[0].version}
                </h3>
                <p className="text-gray-600 text-sm mt-1">{VERSION_NOTES[0].title}</p>
              </div>
              <button
                onClick={() => setShowVersionNotes(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {VERSION_NOTES[0].features.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">✨ New Features</h4>
                <ul className="space-y-2">
                  {VERSION_NOTES[0].features.map((feature, idx) => (
                    <li key={idx} className="text-gray-700 pl-4">
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {VERSION_NOTES[0].bugFixes.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">🐛 Bug Fixes</h4>
                <ul className="space-y-2">
                  {VERSION_NOTES[0].bugFixes.map((fix, idx) => (
                    <li key={idx} className="text-gray-700 pl-4">
                      • {fix}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {VERSION_NOTES[0].breaking.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-red-600 mb-3">⚠️ Breaking Changes</h4>
                <ul className="space-y-2">
                  {VERSION_NOTES[0].breaking.map((change, idx) => (
                    <li key={idx} className="text-red-700 pl-4">
                      • {change}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setShowVersionNotes(false)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
