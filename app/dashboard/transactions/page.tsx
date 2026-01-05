'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sync_projected_purchases } from '@/lib/recurring-utils'
import { Filter } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

type Category = {
  id: string
  name: string
  color: string
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

export default function TransactionsPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [filter_month, setFilterMonth] = useState<string>(format(new Date(), 'yyyy-MM'))
  const [filter_category, setFilterCategory] = useState<string>('all')
  const [filter_type, setFilterType] = useState<string>('all') // all, actual, projected

  useEffect(() => {
    load_data()
  }, [filter_month])

  const load_data = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Sync projected purchases for selected month
      const [year, month] = filter_month.split('-')
      const selected_date = new Date(parseInt(year), parseInt(month) - 1, 1)
      await sync_projected_purchases(user.id, selected_date)

      const start = format(startOfMonth(selected_date), 'yyyy-MM-dd')
      const end = format(endOfMonth(selected_date), 'yyyy-MM-dd')

      // Get categories
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, color')
        .eq('user_id', user.id)
        .order('name')

      // Get purchases
      const { data: purchase_data } = await supabase
        .from('purchases')
        .select('*, category:categories(name, color)')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      if (cats) setCategories(cats)
      if (purchase_data) setPurchases(purchase_data)
    } catch (err) {
      console.error('Error loading transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered_purchases = purchases.filter(p => {
    // Category filter
    if (filter_category !== 'all' && p.category_id !== filter_category) {
      return false
    }
    
    // Type filter
    if (filter_type === 'actual' && p.is_projected) {
      return false
    }
    if (filter_type === 'projected' && !p.is_projected) {
      return false
    }
    
    return true
  })

  const total_actual = purchases
    .filter(p => !p.is_projected)
    .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)

  const total_projected = purchases
    .filter(p => p.is_projected)
    .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Transactions</h2>
          <p className="text-gray-600 mt-1">View and filter your purchases</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Actual Spending</div>
            <div className="text-3xl font-bold text-gray-800">${total_actual.toFixed(2)}</div>
            <div className="text-sm text-gray-500 mt-1">
              {purchases.filter(p => !p.is_projected).length} transactions
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-yellow-200 bg-yellow-50">
            <div className="text-sm text-yellow-700 mb-1">Upcoming (Projected)</div>
            <div className="text-3xl font-bold text-yellow-600">${total_projected.toFixed(2)}</div>
            <div className="text-sm text-yellow-600 mt-1">
              {purchases.filter(p => p.is_projected).length} upcoming
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total (if all paid)</div>
            <div className="text-3xl font-bold text-gray-800">
              ${(total_actual + total_projected).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {purchases.length} total
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Month
              </label>
              <input
                type="month"
                value={filter_month}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={filter_category}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={filter_type}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Transactions</option>
                <option value="actual">Actual Only</option>
                <option value="projected">Upcoming Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered_purchases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No transactions found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered_purchases.map((purchase) => (
                    <tr key={purchase.id} className={`hover:bg-gray-50 ${purchase.is_projected ? 'bg-yellow-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(purchase.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-800">{purchase.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: purchase.category.color }}
                          />
                          <span className="text-gray-700">{purchase.category.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {purchase.is_projected ? (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                            Upcoming
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-800">
                        ${parseFloat(purchase.actual_cost.toString()).toFixed(2)}
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
