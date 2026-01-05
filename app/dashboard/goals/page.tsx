'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Settings as SettingsIcon } from 'lucide-react'
import { format, differenceInMonths } from 'date-fns'

type Asset = {
  id: string
  name: string
  current_value: number
}

type Goal = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string
  linked_asset_id: string | null
  linked_asset?: Asset
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [show_add_form, setShowAddForm] = useState(false)
  
  // Form state
  const [goal_name, setGoalName] = useState('')
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

      // Load assets
      const { data: assets_data } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (assets_data) setAssets(assets_data)

      // Load goals
      const { data: goals_data } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('deadline')

      if (goals_data && assets_data) {
        // Match goals with their linked assets
        const goals_with_assets = goals_data.map(goal => ({
          ...goal,
          linked_asset: assets_data.find(a => a.id === goal.linked_asset_id)
        }))
        setGoals(goals_with_assets)
      }
    } catch (err) {
      console.error('Error loading goals:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculate_goal_progress = (goal: Goal) => {
    const current = parseFloat(goal.current_amount.toString())
    const target = parseFloat(goal.target_amount.toString())
    const remaining = target - current
    const progress_pct = (current / target) * 100
    
    const today = new Date()
    const deadline_date = new Date(goal.deadline)
    const months_left = Math.max(0, differenceInMonths(deadline_date, today))
    const monthly_needed = months_left > 0 ? remaining / months_left : remaining
    
    return { remaining, progress_pct, months_left, monthly_needed }
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
          name: goal_name,
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

  const update_goal_progress = async (goal_id: string) => {
    const goal = goals.find(g => g.id === goal_id)
    if (!goal || !goal.linked_asset) return

    try {
      await supabase
        .from('goals')
        .update({ current_amount: goal.linked_asset.current_value })
        .eq('id', goal_id)

      load_data()
    } catch (err) {
      console.error('Error updating goal:', err)
    }
  }

  const reset_form = () => {
    setGoalName('')
    setTargetAmount('')
    setCurrentAmount('')
    setDeadline('')
    setLinkedAssetId('')
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Goals</h2>
            <p className="text-gray-600 mt-1">Track your financial goals</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition"
          >
            <Plus size={20} />
            New Goal
          </button>
        </div>

        {/* Add Goal Modal */}
        {show_add_form && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Goal</h3>
              <form onSubmit={add_goal} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Goal Name
                  </label>
                  <input
                    type="text"
                    value={goal_name}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="e.g., Emergency Fund"
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
                    <option value="">None</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
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
                    className="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-purple-700"
                  >
                    Add Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Goals List */}
        {goals.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-4">No goals yet.</p>
            <p>Set your first financial goal to start tracking progress!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {goals.map((goal) => {
              const progress = calculate_goal_progress(goal)
              
              return (
                <div key={goal.id} className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-xl">{goal.name}</h3>
                      {goal.linked_asset && (
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          Linked to: {goal.linked_asset.name}
                          <button
                            onClick={() => update_goal_progress(goal.id)}
                            className="text-purple-600 hover:text-purple-700 text-xs underline"
                          >
                            Sync
                          </button>
                        </p>
                      )}
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <SettingsIcon size={20} />
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">
                        ${parseFloat(goal.current_amount.toString()).toLocaleString()} of ${parseFloat(goal.target_amount.toString()).toLocaleString()}
                      </span>
                      <span className="font-medium text-purple-600">
                        {Math.min(progress.progress_pct, 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div 
                        className="bg-purple-600 rounded-full h-4 transition-all" 
                        style={{width: `${Math.min(progress.progress_pct, 100)}%`}}
                      ></div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Remaining</div>
                      <div className="font-bold text-gray-800">
                        ${progress.remaining.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Deadline</div>
                      <div className="font-bold text-gray-800">
                        {format(new Date(goal.deadline), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Months Left</div>
                      <div className="font-bold text-gray-800">{progress.months_left}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Per Month</div>
                      <div className="font-bold text-purple-600">
                        ${Math.max(progress.monthly_needed, 0).toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {/* Status Message */}
                  {progress.progress_pct >= 100 ? (
                    <div className="mt-4 bg-green-100 text-green-700 rounded-lg p-3 text-sm text-center font-medium">
                      🎉 Goal Achieved!
                    </div>
                  ) : progress.months_left === 0 ? (
                    <div className="mt-4 bg-red-100 text-red-700 rounded-lg p-3 text-sm text-center font-medium">
                      ⚠️ Deadline passed
                    </div>
                  ) : (
                    <div className="mt-4 bg-blue-50 text-blue-700 rounded-lg p-3 text-sm text-center">
                      Save <span className="font-bold">${Math.max(progress.monthly_needed, 0).toFixed(0)}/month</span> to reach goal on time
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
