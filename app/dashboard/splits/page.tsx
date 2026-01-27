'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { CheckCircle2, Circle, DollarSign, Users } from 'lucide-react'

type SplitPayment = {
  id: string
  person_name: string
  amount_owed: number
  is_paid_back: boolean
  paid_back_date: string | null
}

type SplitTransaction = {
  id: string
  description: string
  total_amount: number
  date: string
  category: {
    name: string
    color: string
  }
  split_payments: SplitPayment[]
}

export default function SplitsPage() {
  const [transactions, setTransactions] = useState<SplitTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter_status, setFilterStatus] = useState<'all' | 'open' | 'completed'>('all')

  useEffect(() => {
    load_splits()
  }, [])

  const load_splits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get all split purchases with their split payment details
      const { data: purchases } = await supabase
        .from('purchases')
        .select(`
          id,
          description,
          total_amount,
          date,
          category:categories(name, color)
        `)
        .eq('user_id', user.id)
        .eq('is_split', true)
        .order('date', { ascending: false })

      if (!purchases) {
        setTransactions([])
        return
      }

      // Get split payment details for each purchase
      const purchases_with_splits = await Promise.all(
        purchases.map(async (purchase) => {
          const { data: splits } = await supabase
            .from('split_payments')
            .select('*')
            .eq('purchase_id', purchase.id)
            .order('person_name')

          return {
            ...purchase,
            split_payments: splits || []
          }
        })
      )

      setTransactions(purchases_with_splits)
    } catch (err) {
      console.error('Error loading splits:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggle_paid_status = async (split_id: string, current_status: boolean) => {
    try {
      const new_status = !current_status
      const { error } = await supabase
        .from('split_payments')
        .update({
          is_paid_back: new_status,
          paid_back_date: new_status ? format(new Date(), 'yyyy-MM-dd') : null
        })
        .eq('id', split_id)

      if (error) throw error

      // Reload data
      load_splits()
    } catch (err) {
      console.error('Error updating paid status:', err)
      alert('Failed to update payment status')
    }
  }

  const is_transaction_complete = (transaction: SplitTransaction) => {
    if (transaction.split_payments.length === 0) return false
    return transaction.split_payments.every(sp => sp.is_paid_back)
  }

  const get_total_owed = (transaction: SplitTransaction) => {
    return transaction.split_payments
      .filter(sp => !sp.is_paid_back)
      .reduce((sum, sp) => sum + parseFloat(sp.amount_owed.toString()), 0)
  }

  const filtered_transactions = transactions.filter(t => {
    if (filter_status === 'all') return true
    if (filter_status === 'completed') return is_transaction_complete(t)
    if (filter_status === 'open') return !is_transaction_complete(t)
    return true
  })

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Split Payments</h1>
        <p className="text-sm md:text-base text-gray-600">Track who owes you money and payment status</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Total Splits</span>
            <Users size={20} />
          </div>
          <div className="text-3xl font-bold">{transactions.length}</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Completed</span>
            <CheckCircle2 size={20} />
          </div>
          <div className="text-3xl font-bold">
            {transactions.filter(t => is_transaction_complete(t)).length}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Still Owed</span>
            <DollarSign size={20} />
          </div>
          <div className="text-3xl font-bold">
            ${transactions.reduce((sum, t) => sum + get_total_owed(t), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter_status === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({transactions.length})
          </button>
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter_status === 'open'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Open ({transactions.filter(t => !is_transaction_complete(t)).length})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter_status === 'completed'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed ({transactions.filter(t => is_transaction_complete(t)).length})
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {filtered_transactions.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No split payments found</p>
          </div>
        ) : (
          filtered_transactions.map(transaction => {
            const is_complete = is_transaction_complete(transaction)
            const total_owed = get_total_owed(transaction)

            return (
              <div
                key={transaction.id}
                className={`bg-white rounded-lg border-2 ${
                  is_complete ? 'border-green-200' : 'border-orange-200'
                } p-4 md:p-6`}
              >
                {/* Transaction Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-800">{transaction.description}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          is_complete
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {is_complete ? 'Completed' : 'Open'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{format(new Date(transaction.date), 'MMM d, yyyy')}</span>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: transaction.category.color }}
                        />
                        <span>{transaction.category.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-800">
                      ${parseFloat(transaction.total_amount.toString()).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                </div>

                {/* Split Details */}
                <div className="space-y-2">
                  {transaction.split_payments.map(split => (
                    <div
                      key={split.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggle_paid_status(split.id, split.is_paid_back)}
                          className="focus:outline-none"
                        >
                          {split.is_paid_back ? (
                            <CheckCircle2 size={24} className="text-green-600" />
                          ) : (
                            <Circle size={24} className="text-gray-400 hover:text-blue-500 transition" />
                          )}
                        </button>
                        <div>
                          <div className="font-medium text-gray-800">{split.person_name}</div>
                          {split.is_paid_back && split.paid_back_date && (
                            <div className="text-xs text-gray-500">
                              Paid on {format(new Date(split.paid_back_date), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-lg font-semibold ${
                            split.is_paid_back ? 'text-green-600 line-through' : 'text-gray-800'
                          }`}
                        >
                          ${parseFloat(split.amount_owed.toString()).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {!is_complete && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Still Owed:</span>
                    <span className="text-xl font-bold text-orange-600">${total_owed.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
