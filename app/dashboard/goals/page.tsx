'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Target, TrendingUp, Calendar, DollarSign, Edit2, Trash2, X } from 'lucide-react'
import { format, differenceInMonths, isBefore } from 'date-fns'

// Soccer Goal Icon Component
const SoccerGoal = ({ size = 24, className = '' }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M2 10 L2 20 L22 20 L22 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 10 L7 6 L17 6 L22 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 6 L7 20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5"/>
    <path d="M12 6 L12 20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5"/>
    <path d="M17 6 L17 20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5"/>
    <path d="M2 15 L22 15" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5"/>
  </svg>
)

type Goal = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string
  linked_asset_id: string | null
  asset?: {
    name: string
    current_value: number
  }
}

type Asset = {
  id: string
  name: string
  current_value: number
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [show_add_form, setShowAddForm] = useState(false)
  const [edit_goal, setEditGoal] = useState<Goal | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [target_amount, setTargetAmount] = useState('')
  const [current_amount, setCurrentAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [linked_asset_id, setLinkedAssetId] = useState<string>('')

  useEffect(() => {
    load_data()
  }, [])

  const load_data = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load goals with linked assets
      const { data: goals_data } = await supabase
        .from('goals')
        .select(`
          *,
          asset:assets(name, current_value)
        `)
        .eq('user_id', user.id)
        .order('deadline')

      // Load available assets
      const { data: assets_data } = await supabase
        .from('assets')
        .select('id, name, current_value')
        .eq('user_id', user.id)
        .order('name')

      if (goals_data) setGoals(goals_data)
      if (assets_data) setAssets(assets_data)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const add_goal = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          name,
          target_amount: parseFloat(target_amount),
          current_amount: parseFloat(current_amount),
          deadline,
          linked_asset_id: linked_asset_id || null,
        })

      if (error) throw error

      setShowAddForm(false)
      reset_form()
      load_data()
    } catch (err) {
      console.error('Error adding goal:', err)
      alert('Failed to add goal')
    }
  }

  const update_goal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit_goal) return
    
    try {
      const { error } = await supabase
        .from('goals')
        .update({
          name,
          target_amount: parseFloat(target_amount),
          current_amount: parseFloat(current_amount),
          deadline,
          linked_asset_id: linked_asset_id || null,
        })
        .eq('id', edit_goal.id)

      if (error) throw error

      setEditGoal(null)
      reset_form()
      load_data()
    } catch (err) {
      console.error('Error updating goal:', err)
      alert('Failed to update goal')
    }
  }

  const delete_goal = async (id: string) => {
    if (!confirm('Delete this goal?')) return

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)

      if (error) throw error
      load_data()
    } catch (err) {
      console.error('Error deleting goal:', err)
      alert('Failed to delete goal')
    }
  }

  const start_edit = (goal: Goal) => {
    setEditGoal(goal)
    setName(goal.name)
    setTargetAmount(goal.target_amount.toString())
    setCurrentAmount(goal.current_amount.toString())
    setDeadline(goal.deadline)
    setLinkedAssetId(goal.linked_asset_id || '')
  }

  const reset_form = () => {
    setName('')
    setTargetAmount('')
    setCurrentAmount('')
    setDeadline('')
    setLinkedAssetId('')
  }

  const get_goal_status = (goal: Goal, actual_current?: number) => {
    const current = actual_current !== undefined ? actual_current : goal.current_amount
    const progress = (current / goal.target_amount) * 100
    const today = new Date()
    const deadline_date = new Date(goal.deadline)
    
    if (progress >= 100) {
      return { status: 'achieved', color: 'bg-green-500', text: 'Goal Achieved! 🎉' }
    } else if (isBefore(deadline_date, today)) {
      return { status: 'overdue', color: 'bg-red-500', text: 'Deadline Passed' }
    } else {
      return { status: 'in_progress', color: 'bg-blue-500', text: 'In Progress' }
    }
  }

  const calculate_monthly_needed = (goal: Goal, actual_current?: number) => {
    const current = actual_current !== undefined ? actual_current : goal.current_amount
    const remaining = goal.target_amount - current
    const today = new Date()
    const deadline_date = new Date(goal.deadline)
    const months_left = differenceInMonths(deadline_date, today)
    
    if (months_left <= 0) return 0
    return remaining / months_left
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-4 md:p-8">
        <div className="mb-6 md:mb-8">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Financial Goals</h2>
            <p className="text-gray-600 mt-1 text-sm md:text-base">Track your savings targets</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition"
          >
            <Plus size={20} />
            New Goal
          </button>
        </div>

        {/* Add/Edit Form Modal */}
        {(show_add_form || edit_goal) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {edit_goal ? 'Edit Goal' : 'New Goal'}
                </h3>
                <button
                  onClick={() => {
                    edit_goal ? setEditGoal(null) : setShowAddForm(false)
                    reset_form()
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={edit_goal ? update_goal : add_goal} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Goal Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Emergency Fund, Down Payment"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={target_amount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="10000.00"
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={current_amount}
                      onChange={(e) => setCurrentAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link to Asset (Optional)
                  </label>
                  <select
                    value={linked_asset_id}
                    onChange={(e) => setLinkedAssetId(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">No linked asset</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} (${asset.current_value.toLocaleString()})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Link to auto-sync current amount from asset value
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      edit_goal ? setEditGoal(null) : setShowAddForm(false)
                      reset_form()
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-purple-700"
                  >
                    {edit_goal ? 'Update' : 'Create'} Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Goals List */}
        {goals.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <SoccerGoal size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-4">No goals yet.</p>
            <p>Set your first financial goal to start saving!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {goals.map((goal) => {
              // Use asset value if linked, otherwise use goal's current_amount
              const actual_current = goal.asset ? goal.asset.current_value : goal.current_amount
              const status = get_goal_status(goal, actual_current)
              const progress = Math.min((actual_current / goal.target_amount) * 100, 100)
              const monthly_needed = calculate_monthly_needed(goal, actual_current)
              const remaining = goal.target_amount - actual_current

              return (
                <div
                  key={goal.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{goal.name}</h3>
                      {goal.asset && (
                        <p className="text-sm text-gray-500 mt-1">
                          Linked to {goal.asset.name} (${goal.asset.current_value.toLocaleString()})
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => start_edit(goal)}
                        className="text-blue-500 hover:text-blue-700 p-1"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => delete_goal(goal.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white mb-4 ${status.color}`}>
                    {status.text}
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>${actual_current.toLocaleString()}</span>
                      <span>${goal.target_amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${status.color}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-center text-sm font-medium text-gray-700 mt-2">
                      {progress.toFixed(1)}% Complete
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Calendar size={16} />
                        Deadline
                      </div>
                      <div className="font-semibold text-gray-800">
                        {format(new Date(goal.deadline), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <DollarSign size={16} />
                        Remaining
                      </div>
                      <div className="font-semibold text-gray-800">
                        ${remaining.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {status.status === 'in_progress' && monthly_needed > 0 && (
                    <div className="mt-4 bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <div className="text-sm text-purple-700 mb-1">Save per month:</div>
                      <div className="text-2xl font-bold text-purple-600">
                        ${monthly_needed.toFixed(2)}
                      </div>
                      <div className="text-xs text-purple-600 mt-1">
                        to reach goal by deadline
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
