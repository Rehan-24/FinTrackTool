'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

type Category = {
  id: string
  name: string
  color: string
}

type RecurringExpense = {
  id: string
  name: string
  amount: number
  frequency: string
  day_of_month: number | null
  day_of_week: number | null
  is_active: boolean
  category: {
    name: string
    color: string
  }
}

export default function RecurringExpensesPage() {
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [show_add_form, setShowAddForm] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category_id, setCategoryId] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [day_of_month, setDayOfMonth] = useState('1')
  const [day_of_week, setDayOfWeek] = useState('1')

  useEffect(() => {
    load_data()
  }, [])

  const load_data = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load categories
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, color')
        .eq('user_id', user.id)
        .order('name')

      if (cats) {
        setCategories(cats)
        if (cats.length > 0) setCategoryId(cats[0].id)
      }

      // Load recurring expenses
      const { data: recurring_data } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(name, color)')
        .eq('user_id', user.id)
        .order('name')

      if (recurring_data) setRecurring(recurring_data)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const add_recurring = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('recurring_expenses')
        .insert({
          user_id: user.id,
          category_id,
          name,
          amount: parseFloat(amount),
          frequency,
          day_of_month: frequency === 'monthly' ? parseInt(day_of_month) : null,
          day_of_week: frequency === 'weekly' ? parseInt(day_of_week) : null,
          is_active: true,
        })

      if (error) throw error

      setShowAddForm(false)
      reset_form()
      load_data()
    } catch (err) {
      console.error('Error adding recurring expense:', err)
      alert('Failed to add recurring expense')
    }
  }

  const toggle_active = async (id: string, current_status: boolean) => {
    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active: !current_status })
        .eq('id', id)

      if (error) throw error
      load_data()
    } catch (err) {
      console.error('Error toggling status:', err)
    }
  }

  const delete_recurring = async (id: string) => {
    if (!confirm('Delete this recurring expense?')) return

    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', id)

      if (error) throw error
      load_data()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Failed to delete')
    }
  }

  const reset_form = () => {
    setName('')
    setAmount('')
    setFrequency('monthly')
    setDayOfMonth('1')
    setDayOfWeek('1')
  }

  const get_frequency_display = (rec: RecurringExpense) => {
    if (rec.frequency === 'monthly') {
      return `Monthly on the ${rec.day_of_month}${getOrdinalSuffix(rec.day_of_month!)}`
    } else if (rec.frequency === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      return `Weekly on ${days[rec.day_of_week!]}`
    }
    return rec.frequency
  }

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th'
    switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  const total_monthly = recurring.reduce((sum, r) => {
    if (!r.is_active) return sum
    if (r.frequency === 'monthly') return sum + parseFloat(r.amount.toString())
    if (r.frequency === 'weekly') return sum + (parseFloat(r.amount.toString()) * 4.33)
    if (r.frequency === 'yearly') return sum + (parseFloat(r.amount.toString()) / 12)
    return sum
  }, 0)

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Recurring Expenses</h2>
            <p className="text-gray-600 mt-1">Manage monthly and weekly bills</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition"
          >
            <Plus size={20} />
            Add Recurring
          </button>
        </div>

        {/* Total Card */}
        {recurring.length > 0 && (
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 mb-6">
            <div className="text-sm opacity-90 mb-1">Estimated Monthly Recurring</div>
            <div className="text-4xl font-bold">${total_monthly.toFixed(2)}</div>
            <div className="text-sm mt-2 opacity-80">
              {recurring.filter(r => r.is_active).length} active • {recurring.filter(r => !r.is_active).length} paused
            </div>
          </div>
        )}

        {/* Add Form Modal */}
        {show_add_form && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Add Recurring Expense</h3>
              <form onSubmit={add_recurring} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Netflix, Rent, Gym"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={category_id}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {frequency === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Day of Month
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={day_of_month}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                )}
                {frequency === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Day of Week
                    </label>
                    <select
                      value={day_of_week}
                      onChange={(e) => setDayOfWeek(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>
                )}
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
                    className="flex-1 bg-orange-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-orange-700"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Recurring List */}
        {recurring.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-4">No recurring expenses yet.</p>
            <p>Add bills like rent, subscriptions, and utilities!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recurring.map((rec) => (
              <div
                key={rec.id}
                className={`bg-white rounded-lg p-6 border-2 ${
                  rec.is_active ? 'border-gray-200' : 'border-gray-300 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-lg">{rec.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: rec.category.color }}
                      />
                      <span className="text-sm text-gray-600">{rec.category.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => delete_recurring(rec.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="text-3xl font-bold text-gray-800 mb-2">
                  ${parseFloat(rec.amount.toString()).toFixed(2)}
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  {get_frequency_display(rec)}
                </div>

                <button
                  onClick={() => toggle_active(rec.id, rec.is_active)}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition ${
                    rec.is_active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {rec.is_active ? (
                    <>
                      <ToggleRight size={20} />
                      Active
                    </>
                  ) : (
                    <>
                      <ToggleLeft size={20} />
                      Paused
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
