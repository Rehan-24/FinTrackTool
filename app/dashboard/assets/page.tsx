'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'

type Asset = {
  id: string
  name: string
  current_value: number
  last_updated: string
}

type AssetHistory = {
  id: string
  value: number
  date: string
  created_at?: string
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [selected_asset, setSelectedAsset] = useState<Asset | null>(null)
  const [history, setHistory] = useState<AssetHistory[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form states
  const [show_add_form, setShowAddForm] = useState(false)
  const [asset_name, setAssetName] = useState('')
  const [initial_value, setInitialValue] = useState('')
  const [update_value, setUpdateValue] = useState('')

  useEffect(() => {
    load_assets()
  }, [])

  useEffect(() => {
    if (selected_asset) {
      load_history(selected_asset.id)
    }
  }, [selected_asset])

  const load_assets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (data) setAssets(data)
    } catch (err) {
      console.error('Error loading assets:', err)
    } finally {
      setLoading(false)
    }
  }

  const load_history = async (asset_id: string) => {
    const { data } = await supabase
      .from('asset_history')
      .select('*')
      .eq('asset_id', asset_id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }) // Most recent first for same day

    if (data) setHistory(data)
  }

  const add_asset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const value = parseFloat(initial_value)
      const today = format(new Date(), 'yyyy-MM-dd')

      // Create asset
      const { data: asset, error: asset_error } = await supabase
        .from('assets')
        .insert({
          user_id: user.id,
          name: asset_name,
          current_value: value,
          last_updated: today,
        })
        .select()
        .single()

      if (asset_error) throw asset_error

      // Create initial history entry
      await supabase
        .from('asset_history')
        .insert({
          asset_id: asset.id,
          value: value,
          date: today,
        })

      setShowAddForm(false)
      setAssetName('')
      setInitialValue('')
      load_assets()
    } catch (err) {
      console.error('Error adding asset:', err)
      alert('Failed to add asset')
    }
  }

  const update_asset_value = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected_asset) return

    try {
      const value = parseFloat(update_value)
      const today = format(new Date(), 'yyyy-MM-dd')

      // Update asset
      await supabase
        .from('assets')
        .update({
          current_value: value,
          last_updated: today,
        })
        .eq('id', selected_asset.id)

      // Add history entry
      await supabase
        .from('asset_history')
        .insert({
          asset_id: selected_asset.id,
          value: value,
          date: today,
        })

      setUpdateValue('')
      load_assets()
      load_history(selected_asset.id)
      
      // Update selected asset
      setSelectedAsset({ ...selected_asset, current_value: value, last_updated: today })
    } catch (err) {
      console.error('Error updating asset:', err)
      alert('Failed to update asset')
    }
  }

  const calculate_change = (current: number, history: AssetHistory[]) => {
    if (history.length < 2) return { amount: 0, percentage: 0 }
    
    const oldest = history[history.length - 1].value
    const change_amount = current - oldest
    const change_pct = (change_amount / oldest) * 100
    
    return { amount: change_amount, percentage: change_pct }
  }

  const total_value = assets.reduce((sum, a) => sum + parseFloat(a.current_value.toString()), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  // Detail view for selected asset
  if (selected_asset) {
    return (
      <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <div className="p-8">
          <button
            onClick={() => setSelectedAsset(null)}
            className="text-blue-600 hover:text-blue-700 mb-6"
          >
            ← Back to Assets
          </button>

          {/* Current Value Card */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-8 mb-6">
            <h2 className="text-2xl font-bold mb-2">{selected_asset.name}</h2>
            <div className="text-sm opacity-90 mb-2">Current Value</div>
            <div className="text-5xl font-bold mb-2">
              ${parseFloat(selected_asset.current_value.toString()).toLocaleString()}
            </div>
            <div className="text-sm opacity-80">
              Last updated: {format(new Date(selected_asset.last_updated), 'MMM d, yyyy')}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Update Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-700 mb-4">Update Value</h3>
              <form onSubmit={update_asset_value} className="space-y-4">
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500 text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={update_value}
                    onChange={(e) => setUpdateValue(e.target.value)}
                    placeholder={selected_asset.current_value.toString()}
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition"
                >
                  Update Value
                </button>
              </form>
            </div>

            {/* History */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-700 mb-4">Value History</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.map((entry, idx) => {
                  const prev_value = idx < history.length - 1 ? history[idx + 1].value : entry.value
                  const change = parseFloat(entry.value.toString()) - parseFloat(prev_value.toString())
                  const change_pct = prev_value > 0 ? (change / parseFloat(prev_value.toString())) * 100 : 0

                  return (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-800">
                          ${parseFloat(entry.value.toString()).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(entry.date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      {change !== 0 && (
                        <div className={`flex items-center gap-1 text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {change > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          {change > 0 ? '+' : ''}{change_pct.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main assets list view
  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Assets</h2>
            <p className="text-gray-600 mt-1">Track your savings and investments</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition"
          >
            <Plus size={20} />
            New Asset
          </button>
        </div>

        {/* Total Value Card */}
        {assets.length > 0 && (
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 mb-6">
            <div className="text-sm opacity-90 mb-1">Total Assets</div>
            <div className="text-4xl font-bold">${total_value.toLocaleString()}</div>
          </div>
        )}

        {/* Add Asset Modal */}
        {show_add_form && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Asset</h3>
              <form onSubmit={add_asset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Asset Name
                  </label>
                  <input
                    type="text"
                    value={asset_name}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="e.g., HYSA, Checking Account"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Value
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={initial_value}
                      onChange={(e) => setInitialValue(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setAssetName('')
                      setInitialValue('')
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700"
                  >
                    Add Asset
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assets Grid */}
        {assets.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-4">No assets yet.</p>
            <p>Start tracking your savings and investments!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => {
              const change = calculate_change(parseFloat(asset.current_value.toString()), history)
              
              return (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className="bg-white rounded-lg p-6 border border-gray-200 text-left hover:shadow-lg transition"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-lg">{asset.name}</h3>
                      <p className="text-sm text-gray-500">
                        Updated {format(new Date(asset.last_updated), 'MMM d')}
                      </p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-800 mb-2">
                    ${parseFloat(asset.current_value.toString()).toLocaleString()}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
