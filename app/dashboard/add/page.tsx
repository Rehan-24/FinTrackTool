'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'

type Category = {
  id: string
  name: string
  color: string
}

export default function AddPurchasePage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [description, setDescription] = useState('')
  const [total_amount, setTotalAmount] = useState('')
  const [category_id, setCategoryId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [is_split, setIsSplit] = useState(false)
  const [num_people, setNumPeople] = useState('2')

  // New v4.1 fields
  const [tags, setTags] = useState<string[]>([])
  const [tag_input, setTagInput] = useState('')
  const [available_tags, setAvailableTags] = useState<string[]>([])
  const [show_tag_suggestions, setShowTagSuggestions] = useState(false)
  
  const [payment_method, setPaymentMethod] = useState('')
  const [available_payment_methods, setAvailablePaymentMethods] = useState<string[]>([])
  const [show_payment_suggestions, setShowPaymentSuggestions] = useState(false)

  // Custom split amount
  const [custom_owed_back, setCustomOwedBack] = useState('')
  const [use_custom_split, setUseCustomSplit] = useState(false)

  // Notes
  const [notes, setNotes] = useState('')

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
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (cats) {
        setCategories(cats)
        if (cats.length > 0) setCategoryId(cats[0].id)
      }

      // Load existing tags
      const { data: purchases } = await supabase
        .from('purchases')
        .select('tags')
        .eq('user_id', user.id)
        .not('tags', 'is', null)

      const all_tags = new Set<string>()
      purchases?.forEach(p => {
        if (p.tags) {
          p.tags.forEach((tag: string) => all_tags.add(tag))
        }
      })
      setAvailableTags(Array.from(all_tags).sort())

      // Load existing payment methods
      const { data: payment_data } = await supabase
        .from('purchases')
        .select('payment_method')
        .eq('user_id', user.id)
        .not('payment_method', 'is', null)
        .neq('payment_method', '')

      const all_methods = new Set<string>()
      payment_data?.forEach(p => {
        if (p.payment_method) all_methods.add(p.payment_method)
      })
      setAvailablePaymentMethods(Array.from(all_methods).sort())

    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const add_tag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
      setShowTagSuggestions(false)
    }
  }

  const remove_tag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handle_tag_input = (value: string) => {
    setTagInput(value)
    setShowTagSuggestions(value.length > 0)
  }

  const handle_tag_keydown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (tag_input.trim()) {
        add_tag(tag_input)
      }
    }
  }

  const filtered_tags = available_tags.filter(tag => 
    tag.toLowerCase().includes(tag_input.toLowerCase()) && !tags.includes(tag)
  )

  const filtered_payment_methods = available_payment_methods.filter(method =>
    method.toLowerCase().includes(payment_method.toLowerCase())
  )

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const total = parseFloat(total_amount)
      let actual: number
      let owed_back: number | null
      
      if (is_split) {
        if (use_custom_split && custom_owed_back) {
          // Use custom owed back amount
          owed_back = parseFloat(custom_owed_back)
          actual = total - owed_back
        } else {
          // Use even split
          actual = total / parseInt(num_people)
          owed_back = total - actual
        }
      } else {
        actual = total
        owed_back = null
      }

      const insert_data = {
        user_id: user.id,
        category_id,
        description,
        total_amount: total,
        actual_cost: actual,
        date,
        is_split,
        amount_owed_back: owed_back,
        num_people_owing: is_split ? parseInt(num_people) - 1 : null,
        tags: tags.length > 0 ? tags : null,
        payment_method: payment_method.trim() || null,
        notes: notes.trim() || null,
      }

      console.log('Attempting to insert purchase with data:', insert_data)
      console.log('Tags being saved:', tags)

      const { error, data: inserted } = await supabase
        .from('purchases')
        .insert(insert_data)
        .select()

      if (error) {
        console.error('Insert error:', error)
        throw error
      }

      console.log('Successfully inserted purchase:', inserted)

      router.push('/dashboard')
    } catch (err) {
      console.error('Error adding purchase:', err)
      alert('Failed to add purchase: ' + (err as any).message)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-8">Add Purchase</h2>

        <div className="max-w-2xl">
          <form onSubmit={handle_submit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you buy?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={total_amount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Tags - NEW v4.1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="space-y-2">
                {/* Selected tags */}
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

                {/* Tag input */}
                <div className="relative">
                  <input
                    type="text"
                    value={tag_input}
                    onChange={(e) => handle_tag_input(e.target.value)}
                    onKeyDown={handle_tag_keydown}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    placeholder="Type tag and press Enter (e.g., business, vacation)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  {/* Tag suggestions */}
                  {show_tag_suggestions && filtered_tags.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filtered_tags.map((tag) => (
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
                <p className="text-xs text-gray-500">
                  Add multiple tags to organize transactions (business, reimbursable, etc.)
                </p>
              </div>
            </div>

            {/* Payment Method - NEW v4.1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={payment_method}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value)
                    setShowPaymentSuggestions(e.target.value.length > 0)
                  }}
                  onFocus={() => setShowPaymentSuggestions(payment_method.length > 0)}
                  onBlur={() => setTimeout(() => setShowPaymentSuggestions(false), 200)}
                  placeholder="e.g., Chase Visa, Cash, Venmo"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* Payment method suggestions */}
                {show_payment_suggestions && filtered_payment_methods.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filtered_payment_methods.map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method)
                          setShowPaymentSuggestions(false)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Track which card or account you used
              </p>
            </div>

            {/* Notes Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional details or reminders..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                e.g., "Gift for mom's birthday" or "Business expense - keep receipt"
              </p>
            </div>

            {/* Split Payment */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Split Payment?</label>
                  <p className="text-xs text-gray-500">If others owe you money</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSplit(!is_split)}
                  className={`relative w-14 h-7 rounded-full transition ${
                    is_split ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition transform ${
                      is_split ? 'translate-x-7' : ''
                    }`}
                  />
                </button>
              </div>

              {is_split && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Number of People (including you)
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={num_people}
                      onChange={(e) => setNumPeople(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Suggested Split Display */}
                  {total_amount && num_people && !use_custom_split && (
                    <div className="bg-white rounded p-3 text-sm">
                      <div className="text-xs text-gray-500 mb-2">Suggested even split:</div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600">Your share:</span>
                        <span className="font-semibold">
                          ${(parseFloat(total_amount) / parseInt(num_people)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Owed back to you:</span>
                        <span className="font-semibold text-green-600">
                          ${(parseFloat(total_amount) - parseFloat(total_amount) / parseInt(num_people)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Custom Split Toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="custom_split"
                      checked={use_custom_split}
                      onChange={(e) => setUseCustomSplit(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="custom_split" className="text-sm text-gray-700">
                      Use custom split (uneven amounts)
                    </label>
                  </div>

                  {/* Custom Amount Input */}
                  {use_custom_split && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount Owed Back to You
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={total_amount ? parseFloat(total_amount).toString() : undefined}
                          value={custom_owed_back}
                          onChange={(e) => setCustomOwedBack(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {total_amount && custom_owed_back && (
                        <div className="mt-3 bg-white rounded p-3 text-sm">
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-600">Total:</span>
                            <span className="font-semibold">${parseFloat(total_amount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-600">Owed back to you:</span>
                            <span className="font-semibold text-green-600">${parseFloat(custom_owed_back).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                            <span className="text-gray-600">Your actual cost:</span>
                            <span className="font-semibold text-blue-600">
                              ${(parseFloat(total_amount) - parseFloat(custom_owed_back)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Add Purchase
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
