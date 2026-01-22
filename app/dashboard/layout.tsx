'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Home, Receipt, DollarSign, TrendingUp, BarChart3, LogOut, Plus } from 'lucide-react'
import Link from 'next/link'

import { CURRENT_VERSION } from '@/lib/version_notes'

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [show_mobile_menu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    const get_user = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }
      
      setUser(user)
      setLoading(false)

      // Check if user should see version notes
      const last_seen_version = localStorage.getItem('last_seen_version')
      if (!last_seen_version || last_seen_version !== CURRENT_VERSION) {
        // Show version notes after a short delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('show-version-notes'))
          localStorage.setItem('last_seen_version', CURRENT_VERSION)
        }, 1000)
      }
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
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('show-version-notes'))}
            className="text-xs text-gray-500 mt-1 hover:text-blue-600 cursor-pointer transition"
          >
            v5.2.0
          </button>
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
            <SoccerGoal size={20} />
            Goals
          </Link>
          <Link 
            href="/dashboard/settings"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700"
          >
            <BarChart3 size={20} />
            Categories
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
        <Link href="/dashboard" className="flex flex-col items-center text-gray-600 hover:text-blue-600">
          <Home size={24} />
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link href="/dashboard/history" className="flex flex-col items-center text-gray-600 hover:text-blue-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs mt-1">History</span>
        </Link>
        <Link href="/dashboard/add" className="flex flex-col items-center text-gray-600 -mt-6">
          <div className="bg-blue-600 rounded-full p-4 shadow-lg">
            <Plus size={28} className="text-white" />
          </div>
        </Link>
        <Link href="/dashboard/assets" className="flex flex-col items-center text-gray-600 hover:text-blue-600">
          <DollarSign size={24} />
          <span className="text-xs mt-1">Assets</span>
        </Link>
        <button 
          onClick={() => setShowMobileMenu(true)}
          className="flex flex-col items-center text-gray-600 hover:text-blue-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-xs mt-1">More</span>
        </button>
      </div>

      {/* Mobile More Menu Modal */}
      {show_mobile_menu && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Menu</h3>
              <button 
                onClick={() => setShowMobileMenu(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <Link 
                href="/dashboard/transactions"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg"
              >
                <Receipt size={24} className="text-gray-600" />
                <div>
                  <div className="font-medium text-gray-800">Transactions</div>
                  <div className="text-sm text-gray-500">View all purchases</div>
                </div>
              </Link>
              <Link 
                href="/dashboard/recurring"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <div>
                  <div className="font-medium text-gray-800">Recurring Expenses</div>
                  <div className="text-sm text-gray-500">Manage subscriptions</div>
                </div>
              </Link>
              <Link 
                href="/dashboard/income"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg"
              >
                <TrendingUp size={24} className="text-gray-600" />
                <div>
                  <div className="font-medium text-gray-800">Income</div>
                  <div className="text-sm text-gray-500">Track earnings</div>
                </div>
              </Link>
              <Link 
                href="/dashboard/goals"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg"
              >
                <SoccerGoal size={24} className="text-gray-600" />
                <div>
                  <div className="font-medium text-gray-800">Goals</div>
                  <div className="text-sm text-gray-500">Financial targets</div>
                </div>
              </Link>
              <Link 
                href="/dashboard/settings"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg"
              >
                <BarChart3 size={24} className="text-gray-600" />
                <div>
                  <div className="font-medium text-gray-800">Categories</div>
                  <div className="text-sm text-gray-500">Manage budgets</div>
                </div>
              </Link>
              <div className="border-t border-gray-200 mt-4 pt-4">
                <button 
                  onClick={() => {
                    setShowMobileMenu(false)
                    handle_signout()
                  }}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg w-full text-left text-red-600"
                >
                  <LogOut size={24} />
                  <div>
                    <div className="font-medium">Sign Out</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
