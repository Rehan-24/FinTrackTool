'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, DollarSign, PieChart, Plus } from 'lucide-react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth } from 'date-fns'

type Category = {
  id: string
  name: string
  monthly_budget: number
  color: string
  spent: number
}

type Purchase = {
  id: string
  description: string
  actual_cost: number
  date: string
  category: {
    name: string
  }
}

export default function DashboardPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [recent_purchases, setRecentPurchases] = useState<Purchase[]>([])
  const [monthly_income, setMonthlyIncome] = useState(0)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    load_data()
  }, [])

  const load_data = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)

      // Get categories
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)

      // Get purchases for current month
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      const { data: purchases } = await supabase
        .from('purchases')
        .select('*, category:categories(name)')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      // Calculate spent per category
      const cats_with_spent = (cats || []).map(cat => {
        const spent = (purchases || [])
          .filter(p => p.category_id === cat.id)
          .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)
        return { ...cat, spent }
      })

      setCategories(cats_with_spent)
      setRecentPurchases((purchases || []).slice(0, 5))

      // Get income for current month
      const { data: income_data } = await supabase
        .from('income')
        .select('amount, frequency, is_recurring')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)

      // Calculate monthly income (including estimated recurring)
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
      setMonthlyIncome(total_income)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const total_spent = categories.reduce((sum, cat) => sum + cat.spent, 0)
  const total_budget = categories.reduce((sum, cat) => sum + parseFloat(cat.monthly_budget.toString()), 0)
  const remaining = total_budget - total_spent
  const net_cashflow = monthly_income - total_spent

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
            <p className="text-gray-600 mt-1">{format(new Date(), 'MMMM yyyy')}</p>
          </div>
          <Link 
            href="/dashboard/add"
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Add Purchase
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Income</span>
              <TrendingUp className="text-emerald-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-gray-800">${monthly_income.toFixed(2)}</div>
            <div className="text-sm text-gray-500 mt-1">this month</div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Spending</span>
              <TrendingUp className="text-red-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-gray-800">${total_spent.toFixed(2)}</div>
            <div className="text-sm text-gray-500 mt-1">of ${total_budget.toFixed(2)} budget</div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Net Cashflow</span>
              <DollarSign className={net_cashflow >= 0 ? "text-green-500" : "text-red-500"} size={20} />
            </div>
            <div className={`text-3xl font-bold ${net_cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {net_cashflow >= 0 ? '+' : ''}${net_cashflow.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-1">income - spending</div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Categories</span>
              <PieChart className="text-blue-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-gray-800">{categories.length}</div>
            <div className="text-sm text-gray-500 mt-1">tracked areas</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Budget by Category</h3>
              <Link 
                href="/dashboard/settings"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Manage
              </Link>
            </div>
            <div className="p-6 space-y-4">
              {categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No categories yet.</p>
                  <Link 
                    href="/dashboard/settings"
                    className="text-blue-600 hover:text-blue-700 mt-2 inline-block"
                  >
                    Create your first category
                  </Link>
                </div>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: cat.color}}></div>
                        <span className="font-medium text-gray-700">{cat.name}</span>
                      </div>
                      <span className="text-gray-600 font-medium">
                        ${cat.spent.toFixed(2)} / ${parseFloat(cat.monthly_budget.toString()).toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="rounded-full h-2.5" 
                        style={{
                          width: `${Math.min((cat.spent / parseFloat(cat.monthly_budget.toString())) * 100, 100)}%`, 
                          backgroundColor: cat.color
                        }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Recent Transactions</h3>
              <Link 
                href="/dashboard/transactions"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View All
              </Link>
            </div>
            <div className="p-6">
              {recent_purchases.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No purchases yet.</p>
                  <Link 
                    href="/dashboard/add"
                    className="text-blue-600 hover:text-blue-700 mt-2 inline-block"
                  >
                    Add your first purchase
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recent_purchases.map((purchase) => (
                    <div key={purchase.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-800">{purchase.description}</div>
                        <div className="text-sm text-gray-500">
                          {purchase.category?.name} • {format(new Date(purchase.date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-gray-800">
                        ${parseFloat(purchase.actual_cost.toString()).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
