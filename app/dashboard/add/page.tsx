'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

type Category = {
  id: string
  name: string
  color: string
}

export default function AddPurchasePage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [total_amount, setTotalAmount] = useState<string>('')
  const [category_id, setCategoryId] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [is_split, setIsSplit] = useState(false)
  const [amount_owed_back, setAmountOwedBack] = useState<string>('')
  const [num_people_owing, setNumPeopleOwing] = useState<string>('1')

  useEffect(() => {
    load_categories()
  }, [])

  const load_categories = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('categories')
      .select('id, name, color')
      .eq('user_id', user.id)
      .order('name')

    if (data) {
      setCategories(data)
      if (data.length > 0) {
        setCategoryId(data[0].id)
      }
    }
  }

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const total = parseFloat(total_amount)
      const owed = is_split ? parseFloat(amount_owed_back || '0') : 0
      const actual = total - owed

      const { error } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          category_id,
          total_amount: total,
          actual_cost: actual,
          description,
          date,
          is_split,
          amount_owed_back: is_split ? owed : null,
          num_people_owing: is_split ? parseInt(num_people_owing) : null,
        })

      if (error) throw error

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Error adding purchase:', err)
      alert('Failed to add purchase')
    } finally {
      setLoading(false)
    }
  }

  const total = parseFloat(total_amount || '0')
  const owed = parseFloat(amount_owed_back || '0')
  const actual_cost = total - owed
  const per_person = parseInt(num_people_owing) > 0 ? owed / parseInt(num_people_owing) : 0

  if (categories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No Categories Yet</h2>
          <p className="text-gray-600 mb-6">
            You need to create at least one category before adding purchases.
          </p>
          <button
            onClick={() => router.push('/dashboard/settings')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Go to Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Add Purchase</h2>
          <p className="text-gray-600 mt-1">Track a new expense</p>
        </div>

        <form onSubmit={handle_submit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Total Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500 text-xl">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={total_amount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={category_id}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Where did you buy this?"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Split Payment Toggle */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Split Payment?</label>
                <p className="text-xs text-gray-500">Getting paid back by others</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSplit(!is_split)}
                className={`relative w-14 h-7 rounded-full transition ${is_split ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition transform ${is_split ? 'translate-x-7' : ''}`}></div>
              </button>
            </div>

            {/* Split Details */}
            {is_split && (
              <div className="mt-4 bg-blue-50 rounded-lg p-4 space-y-4 border border-blue-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Being Paid Back
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount_owed_back}
                      onChange={(e) => setAmountOwedBack(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of People Owing You
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={num_people_owing}
                    onChange={(e) => setNumPeopleOwing(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1"
                  />
                </div>

                {/* Calculation Summary */}
                <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total paid:</span>
                    <span className="font-medium">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Getting back:</span>
                    <span className="font-medium text-green-600">-${owed.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-700">Your actual cost:</span>
                    <span className="font-bold text-blue-600">${actual_cost.toFixed(2)}</span>
                  </div>
                  {parseInt(num_people_owing) > 0 && (
                    <div className="text-xs text-gray-500 pt-1">
                      (${per_person.toFixed(2)} per person × {num_people_owing} {parseInt(num_people_owing) === 1 ? 'person' : 'people'})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
