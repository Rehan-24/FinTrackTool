'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Filter } from 'lucide-react'

type Purchase = {
  id: string
  total_amount: number
  actual_cost: number
  description: string
  date: string
  is_split: boolean
  amount_owed_back: number | null
  num_people_owing: number | null
  category: {
    name: string
    color: string
  }
}

export default function TransactionsPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [filtered_purchases, setFilteredPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [filter_category, setFilterCategory] = useState<string>('all')
  const [filter_month, setFilterMonth] = useState<string>(format(new Date(), 'yyyy-MM'))
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    load_data()
  }, [])

  useEffect(() => {
    apply_filters()
  }, [purchases, filter_category, filter_month])

  const load_data = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load categories for filter
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)

      if (cats) setCategories(cats)

      // Load all purchases
      const { data: purchases_data } = await supabase
        .from('purchases')
        .select('*, category:categories(name, color)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (purchases_data) setPurchases(purchases_data)
    } catch (err) {
      console.error('Error loading transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  const apply_filters = () => {
    let filtered = [...purchases]

    // Filter by month
    if (filter_month) {
      const [year, month] = filter_month.split('-')
      const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1))
      const end = endOfMonth(new Date(parseInt(year), parseInt(month) - 1))
      
      filtered = filtered.filter(p => {
        const purchase_date = new Date(p.date)
        return purchase_date >= start && purchase_date <= end
      })
    }

    // Filter by category
    if (filter_category !== 'all') {
      filtered = filtered.filter(p => p.category_id === filter_category)
    }

    setFilteredPurchases(filtered)
  }

  const total_spent = filtered_purchases.reduce(
    (sum, p) => sum + parseFloat(p.actual_cost.toString()), 
    0
  )

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Transactions</h2>
          <p className="text-gray-600 mt-1">View all your purchases</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-gray-600" />
            <h3 className="font-semibold text-gray-800">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Showing {filtered_purchases.length} transactions • Total: ${total_spent.toFixed(2)}
          </div>
        </div>

        {/* Transactions List */}
        {filtered_purchases.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>No transactions found with the current filters.</p>
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
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Your Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered_purchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(purchase.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        <div className="font-medium">{purchase.description}</div>
                        {purchase.is_split && (
                          <div className="text-xs text-gray-500 mt-1">
                            Split • {purchase.num_people_owing} {purchase.num_people_owing === 1 ? 'person' : 'people'} owe ${parseFloat(purchase.amount_owed_back?.toString() || '0').toFixed(2)}
                          </div>
                        )}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                        ${parseFloat(purchase.total_amount.toString()).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-800">
                        ${parseFloat(purchase.actual_cost.toString()).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
