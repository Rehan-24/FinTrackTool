'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, TrendingUp } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

type Income = {
  id: string
  source: string
  amount: number
  frequency: string
  date: string
  is_recurring: boolean
}

export default function IncomePage() {
  const [income, setIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [show_add_form, setShowAddForm] = useState(false)
  const [filter_month, setFilterMonth] = useState<string>(format(new Date(), 'yyyy-MM'))
  
  // Form state
  const [source, setSource] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('one-time')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    load_income()
  }, [])

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

      const { error } = await supabase
        .from('income')
        .insert({
          user_id: user.id,
          source,
          amount: parseFloat(amount),
          frequency,
          date,
          is_recurring: frequency !== 'one-time',
        })

      if (error) throw error

      setShowAddForm(false)
      reset_form()
      load_income()
    } catch (err) {
      console.error('Error adding income:', err)
      alert('Failed to add income')
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

  const reset_form = () => {
    setSource('')
    setAmount('')
    setFrequency('one-time')
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }

  // Calculate monthly totals
  const get_monthly_income = () => {
    const [year, month] = filter_month.split('-')
    const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1))
    const end = endOfMonth(new Date(parseInt(year), parseInt(month) - 1))
    
    return income.filter(i => {
      const income_date = new Date(i.date)
      return income_date >= start && income_date <= end
    }).reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0)
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

  const monthly_total = get_monthly_income()
  const recurring_estimate = get_recurring_monthly()

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Income</h2>
            <p className="text-gray-600 mt-1">Track your earnings</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition"
          >
            <Plus size={20} />
            Add Income
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Income This Month</span>
              <TrendingUp size={20} />
            </div>
            <div className="text-4xl font-bold">${monthly_total.toFixed(2)}</div>
            <div className="text-sm mt-2 opacity-80">
              {format(new Date(filter_month + '-01'), 'MMMM yyyy')}
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Estimated Monthly (Recurring)</span>
              <TrendingUp size={20} />
            </div>
            <div className="text-4xl font-bold">${recurring_estimate.toFixed(2)}</div>
            <div className="text-sm mt-2 opacity-80">
              {income.filter(i => i.is_recurring).length} recurring sources
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            View Month
          </label>
          <input
            type="month"
            value={filter_month}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Add Form Modal */}
        {show_add_form && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Add Income</h3>
              <form onSubmit={add_income} className="space-y-4">
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
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
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
                    Add Income
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
                      Frequency
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
                  {income.map((inc) => (
                    <tr key={inc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(inc.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-800">{inc.source}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          inc.is_recurring 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {inc.frequency.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-emerald-600">
                        ${parseFloat(inc.amount.toString()).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => delete_income(inc.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={18} />
                        </button>
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
