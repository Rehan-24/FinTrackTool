'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Home, Receipt, DollarSign, TrendingUp, Settings, LogOut, Plus } from 'lucide-react'
import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const get_user = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }
      
      setUser(user)
      setLoading(false)
    }

    get_user()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/')
      } else {
        setUser(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handle_signout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 bg-white border-r border-gray-200 flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">Finance Tracker</h1>
          <p className="text-xs text-gray-500 mt-1">v4.3.2</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link 
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700 font-medium"
          >
            <Home size={20} />
            Dashboard
          </Link>
          <Link 
            href="/dashboard/transactions"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700"
          >
            <Receipt size={20} />
            Transactions
          </Link>
          <Link 
            href="/dashboard/history"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </Link>
          <Link 
            href="/dashboard/recurring"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Recurring
          </Link>
          <Link 
            href="/dashboard/income"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700"
          >
            <TrendingUp size={20} />
            Income
          </Link>
          <Link 
            href="/dashboard/assets"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700"
          >
            <DollarSign size={20} />
            Assets
          </Link>
          <Link 
            href="/dashboard/goals"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700"
          >
            <TrendingUp size={20} />
            Goals
          </Link>
          <Link 
            href="/dashboard/settings"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700"
          >
            <Settings size={20} />
            Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={handle_signout}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-600"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 z-50">
        <Link href="/dashboard" className="flex flex-col items-center text-gray-600">
          <Home size={24} />
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link href="/dashboard/transactions" className="flex flex-col items-center text-gray-600">
          <Receipt size={24} />
          <span className="text-xs mt-1">History</span>
        </Link>
        <Link href="/dashboard/add" className="flex flex-col items-center text-gray-600 -mt-6">
          <div className="bg-blue-600 rounded-full p-4 shadow-lg">
            <Plus size={28} className="text-white" />
          </div>
        </Link>
        <Link href="/dashboard/assets" className="flex flex-col items-center text-gray-600">
          <DollarSign size={24} />
          <span className="text-xs mt-1">Assets</span>
        </Link>
        <Link href="/dashboard/goals" className="flex flex-col items-center text-gray-600">
          <TrendingUp size={24} />
          <span className="text-xs mt-1">Goals</span>
        </Link>
      </div>
    </div>
  )
}
