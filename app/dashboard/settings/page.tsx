'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2 } from 'lucide-react'

type Category = {
  id: string
  name: string
  monthly_budget: number
  color: string
}

const PRESET_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', 
  '#ef4444', '#ec4899', '#14b8a6', '#f97316'
]

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [show_add_form, setShowAddForm] = useState(false)
  
  // Form state
  const [cat_name, setCatName] = useState('')
  const [cat_budget, setCatBudget] = useState('')
  const [cat_color, setCatColor] = useState(PRESET_COLORS[0])

  useEffect(() => {
    load_categories()
  }, [])

  const load_categories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (data) setCategories(data)
    } catch (err) {
      console.error('Error loading categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const add_category = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: cat_name,
          monthly_budget: parseFloat(cat_budget),
          color: cat_color,
        })

      if (error) throw error

      setShowAddForm(false)
      reset_form()
      load_categories()
    } catch (err) {
      console.error('Error adding category:', err)
      alert('Failed to add category')
    }
  }

  const delete_category = async (id: string) => {
    if (!confirm('Are you sure? This will delete all purchases in this category.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error
      load_categories()
    } catch (err) {
      console.error('Error deleting category:', err)
      alert('Failed to delete category')
    }
  }

  const update_budget = async (id: string, new_budget: number) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ monthly_budget: new_budget })
        .eq('id', id)

      if (error) throw error
      load_categories()
    } catch (err) {
      console.error('Error updating budget:', err)
    }
  }

  const reset_form = () => {
    setCatName('')
    setCatBudget('')
    setCatColor(PRESET_COLORS[0])
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Settings</h2>
            <p className="text-gray-600 mt-1">Manage your budget categories</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-800">Categories</h3>
              <button
                onClick={() => setShowAddForm(!show_add_form)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                <Plus size={20} />
                Add Category
              </button>
            </div>

            {/* Add Category Form */}
            {show_add_form && (
              <form onSubmit={add_category} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category Name
                    </label>
                    <input
                      type="text"
                      value={cat_name}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="e.g., Groceries"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Budget
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cat_budget}
                        onChange={(e) => setCatBudget(e.target.value)}
                        placeholder="500.00"
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCatColor(color)}
                        className={`w-10 h-10 rounded-full border-2 ${
                          cat_color === color ? 'border-gray-800' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      reset_form()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    Add Category
                  </button>
                </div>
              </form>
            )}

            {/* Categories List */}
            {categories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No categories yet. Add your first category to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{cat.name}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Budget:</span>
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-gray-500 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cat.monthly_budget}
                            onChange={(e) => update_budget(cat.id, parseFloat(e.target.value))}
                            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => delete_category(cat.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
