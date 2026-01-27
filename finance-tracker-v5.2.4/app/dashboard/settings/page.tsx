'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Settings as SettingsIcon, Edit2, X } from 'lucide-react'
import { format } from 'date-fns'

type Category = {
  id: string
  name: string
  monthly_budget: number
  color: string
}

const COLOR_OPTIONS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#64748B',
  '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D', '#16A34A',
  '#059669', '#0D9488', '#0891B2', '#0284C7', '#2563EB', '#4F46E5',
  '#7C3AED', '#9333EA', '#C026D3', '#DB2777', '#E11D48', '#475569',
  '#991B1B', '#9A3412', '#92400E', '#854D0E', '#3F6212', '#166534',
  '#065F46', '#115E59', '#164E63', '#075985', '#1E40AF', '#3730A3',
  '#6B21A8', '#701A75', '#9F1239', '#BE123C', '#334155', '#1E293B'
]

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [show_add_form, setShowAddForm] = useState(false)
  const [edit_category, setEditCategory] = useState<Category | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [monthly_budget, setMonthlyBudget] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0])

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
          name,
          monthly_budget: parseFloat(monthly_budget),
          color,
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

  const update_category = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit_category) return
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const new_budget = parseFloat(monthly_budget)
      const old_budget = parseFloat(edit_category.monthly_budget.toString())

      // Update the category
      const { error } = await supabase
        .from('categories')
        .update({
          name,
          monthly_budget: new_budget,
          color,
        })
        .eq('id', edit_category.id)

      if (error) throw error

      // If budget changed, save history for current month onwards
      if (new_budget !== old_budget) {
        const current_month = format(new Date(), 'yyyy-MM')
        
        // Insert or update budget history for current month
        await supabase
          .from('category_budget_history')
          .upsert({
            category_id: edit_category.id,
            user_id: user.id,
            month_year: current_month,
            monthly_budget: new_budget
          }, {
            onConflict: 'category_id,month_year'
          })
      }

      setEditCategory(null)
      reset_form()
      load_categories()
    } catch (err) {
      console.error('Error updating category:', err)
      alert('Failed to update category')
    }
  }

  const delete_category = async (id: string) => {
    if (!confirm('Delete this category? This will also delete all associated purchases.')) return

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error
      load_categories()
    } catch (err) {
      console.error('Error deleting category:', err)
      alert('Failed to delete category. Make sure no purchases are using this category.')
    }
  }

  const start_edit = (cat: Category) => {
    setEditCategory(cat)
    setName(cat.name)
    setMonthlyBudget(cat.monthly_budget.toString())
    setColor(cat.color)
  }

  const reset_form = () => {
    setName('')
    setMonthlyBudget('')
    setColor(COLOR_OPTIONS[0])
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-4 md:p-8">
        <div className="mb-6 md:mb-8">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Categories</h2>
            <p className="text-gray-600 mt-1 text-sm md:text-base">Manage your spending categories</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Add Category
          </button>
        </div>

        {/* Add/Edit Form Modal */}
        {(show_add_form || edit_category) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {edit_category ? 'Edit Category' : 'Add Category'}
                </h3>
                <button
                  onClick={() => {
                    edit_category ? setEditCategory(null) : setShowAddForm(false)
                    reset_form()
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={edit_category ? update_category : add_category} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Groceries, Dining Out"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthly_budget}
                      onChange={(e) => setMonthlyBudget(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <div className="grid grid-cols-9 gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-lg transition ${
                          color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-600">Selected: {color}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      edit_category ? setEditCategory(null) : setShowAddForm(false)
                      reset_form()
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700"
                  >
                    {edit_category ? 'Update' : 'Add'} Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Categories List */}
        {categories.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <SettingsIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-4">No categories yet.</p>
            <p>Add your first budget category to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-lg border-2 p-6 hover:shadow-lg transition"
                style={{ borderColor: cat.color }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <h3 className="font-semibold text-gray-800 text-lg">{cat.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => start_edit(cat)}
                      className="text-blue-500 hover:text-blue-700 p-1"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => delete_category(cat.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-1">Monthly Budget</div>
                <div className="text-3xl font-bold text-gray-800">
                  ${parseFloat(cat.monthly_budget.toString()).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
