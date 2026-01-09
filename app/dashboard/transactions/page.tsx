'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sync_projected_purchases } from '@/lib/recurring-utils'
import { Filter, Plus, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

type Category = {
  id: string
  name: string
  color: string
}

type Purchase = {
  id: string
  description: string
  actual_cost: number
  total_amount: number
  date: string
  is_projected: boolean
  is_split: boolean
  amount_owed_back: number | null
  num_people_owing: number | null
  category_id: string
  tags?: string[] | null
  payment_method?: string | null
  notes?: string | null
  category: {
    name: string
    color: string
  }
}

export default function TransactionsPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [available_tags, setAvailableTags] = useState<string[]>([])
  const [available_payment_methods, setAvailablePaymentMethods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [filter_month, setFilterMonth] = useState<string>(format(new Date(), 'yyyy-MM'))
  const [filter_category, setFilterCategory] = useState<string>('all')
  const [filter_type, setFilterType] = useState<string>('all') // all, actual, projected
  const [filter_tag, setFilterTag] = useState<string>('all')
  const [filter_payment_method, setFilterPaymentMethod] = useState<string>('all')
  const [chart_view, setChartView] = useState<'categories' | 'tags'>('categories')

  // View/Edit modal
  const [selected_purchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [is_editing, setIsEditing] = useState(false)

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
      if (purchase_data) {
        setPurchases(purchase_data)
        
        // Extract all unique tags
        const all_tags = new Set<string>()
        purchase_data.forEach((p: any) => {
          if (p.tags) {
            p.tags.forEach((tag: string) => all_tags.add(tag))
          }
        })
        setAvailableTags(Array.from(all_tags).sort())
        
        // Extract all unique payment methods
        const all_methods = new Set<string>()
        purchase_data.forEach((p: any) => {
          if (p.payment_method) {
            all_methods.add(p.payment_method)
          }
        })
        setAvailablePaymentMethods(Array.from(all_methods).sort())
      }
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
    if (filter_type === 'projected') {
      // Only show truly upcoming (projected AND future date)
      if (!is_truly_upcoming(p)) {
        return false
      }
    }
    
    // Tag filter
    if (filter_tag !== 'all') {
      const purchase_tags = p.tags || []
      if (!purchase_tags.includes(filter_tag)) {
        return false
      }
    }
    
    // Payment method filter
    if (filter_payment_method !== 'all') {
      if (p.payment_method !== filter_payment_method) {
        return false
      }
    }
    
    return true
  })

  // Helper to parse date string as local date (not UTC)
  const parse_local_date = (date_string: string) => {
    const [year, month, day] = date_string.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Helper to check if purchase is truly upcoming (projected AND date in future)
  const is_truly_upcoming = (purchase: Purchase) => {
    if (!purchase.is_projected) return false
    const purchase_date = parse_local_date(purchase.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset to start of day
    return purchase_date >= today
  }

  const handle_save_edit = async (updated_purchase: any) => {
    try {
      const { error } = await supabase
        .from('purchases')
        .update(updated_purchase)
        .eq('id', selected_purchase!.id)

      if (error) throw error

      setSelectedPurchase(null)
      setIsEditing(false)
      load_data()
      alert('Transaction updated successfully!')
    } catch (err) {
      console.error('Error updating purchase:', err)
      alert('Failed to update transaction')
    }
  }

  const handle_delete = async () => {
    if (!selected_purchase) return
    
    if (!confirm('Are you sure you want to delete this transaction? This cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', selected_purchase.id)

      if (error) throw error

      setSelectedPurchase(null)
      setIsEditing(false)
      load_data()
      alert('Transaction deleted successfully!')
    } catch (err) {
      console.error('Error deleting purchase:', err)
      alert('Failed to delete transaction')
    }
  }

  const total_actual = purchases
    .filter(p => !p.is_projected)
    .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)

  // Only count truly upcoming (projected AND future date)
  const truly_upcoming_purchases = purchases.filter(p => is_truly_upcoming(p))
  const total_projected = truly_upcoming_purchases
    .reduce((sum, p) => sum + parseFloat(p.actual_cost.toString()), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-3 md:p-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 md:mb-8 gap-3 md:gap-4">
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-gray-800">Transactions</h2>
            <p className="text-gray-600 mt-1 text-xs md:text-base">View and filter your purchases</p>
          </div>
          <Link
            href="/dashboard/add"
            className="hidden md:flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Add Purchase
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-6 mb-3 md:mb-6">
          <div className="bg-white rounded-lg p-3 md:p-6 border border-gray-200">
            <div className="text-xs md:text-sm text-gray-600 mb-1">Actual Spending</div>
            <div className="text-xl md:text-3xl font-bold text-gray-800">${total_actual.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {purchases.filter(p => !p.is_projected).length} transactions
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 md:p-6 border border-yellow-200 bg-yellow-50">
            <div className="text-xs md:text-sm text-yellow-700 mb-1">Upcoming (Projected)</div>
            <div className="text-xl md:text-3xl font-bold text-yellow-600">${total_projected.toFixed(2)}</div>
            <div className="text-xs text-yellow-600 mt-1">
              {truly_upcoming_purchases.length} upcoming
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 md:p-6 border border-gray-200">
            <div className="text-xs md:text-sm text-gray-600 mb-1">Total (if all paid)</div>
            <div className="text-xl md:text-3xl font-bold text-gray-800">
              ${(total_actual + total_projected).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {purchases.length} total
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-6 mb-3 md:mb-6">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Filter size={16} className="text-gray-600" />
            <h3 className="text-sm md:text-lg font-semibold text-gray-800">Filters</h3>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tag
              </label>
              <select
                value={filter_tag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Tags</option>
                {available_tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={filter_payment_method}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Payment Methods</option>
                {available_payment_methods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                    Tags
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
                {filtered_purchases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 md:px-6 py-4 md:py-8 text-center text-gray-500">
                      No transactions found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered_purchases.map((purchase) => {
                    const is_upcoming = is_truly_upcoming(purchase)
                    return (
                    <tr 
                      key={purchase.id} 
                      onClick={() => setSelectedPurchase(purchase)}
                      className={`hover:bg-gray-50 cursor-pointer ${is_upcoming ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap text-gray-600">
                        {format(parse_local_date(purchase.date), 'MMM d')}
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4">
                        <div className="font-medium text-gray-800">{purchase.description}</div>
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 md:gap-2">
                          <div
                            className="w-2 h-2 md:w-3 md:h-3 rounded-full"
                            style={{ backgroundColor: purchase.category.color }}
                          />
                          <span className="text-gray-700">{purchase.category.name}</span>
                        </div>
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4">
                        {purchase.tags && purchase.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {purchase.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="px-1 md:px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        {is_upcoming ? (
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
                        ${parseFloat(purchase.actual_cost.toString()).toFixed(2)}
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Beta Feature: Spending Analysis Charts */}
        {filtered_purchases.length > 0 && (
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
                      const actual_purchases = filtered_purchases.filter(p => !is_truly_upcoming(p))
                      if (chart_view === 'categories') {
                        // Group by category
                        const category_map = new Map<string, { value: number; color: string }>()
                        actual_purchases.forEach(p => {
                          const existing = category_map.get(p.category.name)
                          if (existing) {
                            existing.value += parseFloat(p.actual_cost.toString())
                          } else {
                            category_map.set(p.category.name, {
                              value: parseFloat(p.actual_cost.toString()),
                              color: p.category.color
                            })
                          }
                        })
                        return Array.from(category_map.entries()).map(([name, data]) => ({
                          name,
                          value: data.value,
                          color: data.color
                        }))
                      } else {
                        // Group by tags
                        const tag_map = new Map<string, number>()
                        actual_purchases.forEach(p => {
                          if (p.tags && p.tags.length > 0) {
                            p.tags.forEach((tag: string) => {
                              tag_map.set(tag, (tag_map.get(tag) || 0) + parseFloat(p.actual_cost.toString()))
                            })
                          } else {
                            // If no tags, use category name
                            tag_map.set(p.category.name, (tag_map.get(p.category.name) || 0) + parseFloat(p.actual_cost.toString()))
                          }
                        })
                        // Generate colors for tags
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
                        return Array.from(tag_map.entries())
                          .map(([name, value], idx) => ({
                            name,
                            value,
                            color: colors[idx % colors.length]
                          }))
                          .sort((a, b) => b.value - a.value)
                      }
                    })()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(() => {
                      const actual_purchases = filtered_purchases.filter(p => !is_truly_upcoming(p))
                      const data = chart_view === 'categories'
                        ? Array.from(new Set(actual_purchases.map(p => ({ name: p.category.name, color: p.category.color }))))
                        : []
                      return data.map((entry, index) => (
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

      {/* View/Edit Modal */}
      {selected_purchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  {is_editing ? 'Edit Transaction' : 'Transaction Details'}
                </h2>
                <button
                  onClick={() => {
                    setSelectedPurchase(null)
                    setIsEditing(false)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              {!is_editing ? (
                // View Mode
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Date</label>
                      <div className="text-gray-800">{format(parse_local_date(selected_purchase.date), 'MMM d, yyyy')}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Amount</label>
                      <div className="text-2xl font-bold text-gray-800">
                        ${parseFloat(selected_purchase.actual_cost.toString()).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
                    <div className="text-gray-800">{selected_purchase.description}</div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Category</label>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selected_purchase.category.color }}
                      />
                      <span className="text-gray-800">{selected_purchase.category.name}</span>
                    </div>
                  </div>

                  {selected_purchase.tags && selected_purchase.tags.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {selected_purchase.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected_purchase.payment_method && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Payment Method</label>
                      <div className="text-gray-800">{selected_purchase.payment_method}</div>
                    </div>
                  )}

                  {selected_purchase.notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                      <div className="text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                        {selected_purchase.notes}
                      </div>
                    </div>
                  )}

                  {selected_purchase.is_split && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-blue-700 mb-2">Split Payment</label>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-600">Total:</span>
                          <span className="ml-2 font-medium">${parseFloat(selected_purchase.total_amount.toString()).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-blue-600">Your cost:</span>
                          <span className="ml-2 font-medium">${parseFloat(selected_purchase.actual_cost.toString()).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-blue-600">Owed back:</span>
                          <span className="ml-2 font-medium text-green-600">
                            ${selected_purchase.amount_owed_back ? parseFloat(selected_purchase.amount_owed_back.toString()).toFixed(2) : '0.00'}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600">People owing:</span>
                          <span className="ml-2 font-medium">{selected_purchase.num_people_owing || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {is_truly_upcoming(selected_purchase) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-yellow-800 text-sm">
                        ⚠️ This is an upcoming projected charge
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700"
                    >
                      Edit Transaction
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPurchase(null)
                        setIsEditing(false)
                      }}
                      className="px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                // Edit Mode - Full Form
                <EditTransactionForm 
                  purchase={selected_purchase}
                  categories={categories}
                  onSave={handle_save_edit}
                  onCancel={() => setIsEditing(false)}
                  onDelete={handle_delete}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Edit Transaction Form Component
function EditTransactionForm({ 
  purchase, 
  categories, 
  onSave, 
  onCancel, 
  onDelete 
}: { 
  purchase: Purchase
  categories: Category[]
  onSave: (data: any) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [description, setDescription] = useState(purchase.description)
  const [amount, setAmount] = useState(purchase.actual_cost.toString())
  const [total_amount, setTotalAmount] = useState(purchase.total_amount.toString())
  const [category_id, setCategoryId] = useState(purchase.category_id)
  const [date, setDate] = useState(purchase.date)
  const [is_split, setIsSplit] = useState(purchase.is_split)
  const [amount_owed_back, setAmountOwedBack] = useState(
    purchase.amount_owed_back ? purchase.amount_owed_back.toString() : ''
  )
  const [num_people_owing, setNumPeopleOwing] = useState(
    purchase.num_people_owing ? purchase.num_people_owing.toString() : '1'
  )
  const [tags, setTags] = useState<string[]>(purchase.tags || [])
  const [tag_input, setTagInput] = useState('')
  const [show_tag_suggestions, setShowTagSuggestions] = useState(false)
  const [available_tags, setAvailableTags] = useState<string[]>([])
  const [payment_method, setPaymentMethod] = useState(purchase.payment_method || '')
  const [notes, setNotes] = useState(purchase.notes || '')

  // Load available tags on mount
  useEffect(() => {
    const load_tags = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get tags from purchases
      const { data: purchases_data } = await supabase
        .from('purchases')
        .select('tags')
        .eq('user_id', user.id)
        .not('tags', 'is', null)

      // Get tags from recurring
      const { data: recurring_data } = await supabase
        .from('recurring_expenses')
        .select('tags')
        .eq('user_id', user.id)
        .not('tags', 'is', null)

      const all_tags = new Set<string>()
      purchases_data?.forEach(p => p.tags?.forEach((t: string) => all_tags.add(t)))
      recurring_data?.forEach(r => r.tags?.forEach((t: string) => all_tags.add(t)))
      
      setAvailableTags(Array.from(all_tags).sort())
    }
    load_tags()
  }, [])

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Add any remaining text in tag_input before saving
    const final_tags = [...tags]
    if (tag_input.trim()) {
      const new_tags = tag_input
        .split(',')
        .map(t => t.trim())
        .filter(t => t && !final_tags.includes(t))
      final_tags.push(...new_tags)
    }
    
    const updated = {
      description,
      actual_cost: parseFloat(amount),
      total_amount: parseFloat(total_amount),
      category_id,
      date,
      is_split,
      amount_owed_back: is_split && amount_owed_back ? parseFloat(amount_owed_back) : null,
      num_people_owing: is_split && num_people_owing ? parseInt(num_people_owing) : null,
      tags: final_tags.length > 0 ? final_tags : null,
      payment_method: payment_method.trim() || null,
      notes: notes.trim() || null,
    }

    onSave(updated)
  }

  const handle_tag_input = (value: string) => {
    // Check if user typed a comma
    if (value.includes(',')) {
      const new_tags = value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0 && !tags.includes(t))
      
      if (new_tags.length > 0) {
        setTags([...tags, ...new_tags])
      }
      setTagInput('')
      setShowTagSuggestions(false)
    } else {
      setTagInput(value)
      setShowTagSuggestions(value.length > 0)
    }
  }

  const add_tag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }

  const remove_tag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  return (
    <form onSubmit={handle_submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category_id}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              value={total_amount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Cost</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={is_split}
            onChange={(e) => setIsSplit(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700">Split Payment</span>
        </label>
      </div>

      {is_split && (
        <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Owed Back</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={amount_owed_back}
                onChange={(e) => setAmountOwedBack(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">People Owing</label>
            <input
              type="number"
              min="1"
              value={num_people_owing}
              onChange={(e) => setNumPeopleOwing(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => remove_tag(tag)}
                  className="hover:text-blue-900"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <input
            type="text"
            value={tag_input}
            onChange={(e) => handle_tag_input(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (tag_input.trim()) add_tag(tag_input)
              }
            }}
            onFocus={() => setShowTagSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
            placeholder="Add tags (comma-separated)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Tag suggestions dropdown */}
          {show_tag_suggestions && tag_input && available_tags.filter(t => 
            t.toLowerCase().includes(tag_input.toLowerCase()) && !tags.includes(t)
          ).length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {available_tags
                .filter(t => t.toLowerCase().includes(tag_input.toLowerCase()) && !tags.includes(t))
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => add_tag(tag)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  >
                    {tag}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
        <input
          type="text"
          value={payment_method}
          onChange={(e) => setPaymentMethod(e.target.value)}
          placeholder="e.g., Chase Visa, Cash"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add any additional details..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          type="submit"
          className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </form>
  )
}
