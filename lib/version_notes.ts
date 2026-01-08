export type VersionNote = {
  version: string
  date: string
  title: string
  features: string[]
  bugFixes: string[]
  breaking: string[]
}

export const VERSION_NOTES: VersionNote[] = [
  {
    version: '4.4.3',
    date: '2026-01-08',
    title: 'Duplicate Recurring Purchase Fix',
    features: [],
    bugFixes: [
      'FIXED: Recurring expenses no longer counted twice on dashboard',
      'FIXED: Projected purchases sync now preserves past recurring (prevents re-creation)',
      'FIXED: Only future projected purchases are regenerated on sync',
      'FIXED: Duplicate check now prevents any duplicate purchases for same date+description',
    ],
    breaking: [],
  },
  {
    version: '4.4.2',
    date: '2026-01-08',
    title: 'Critical Recurring Payment Fixes',
    features: [
      '✅ Edit asset modal now displays immediately (no back button needed)',
    ],
    bugFixes: [
      'FIXED: Paid recurring expenses now show correctly on dashboard',
      'FIXED: Subscription totals now accurate (paid vs upcoming properly separated)',
      'FIXED: ReferenceError crash when filtering transactions (parse_local_date hoisting issue)',
      'FIXED: Paid recurring now appears in "Actual Paid" filter on transactions page',
      'FIXED: Dashboard categories now correctly count paid recurring in spent amount',
    ],
    breaking: [],
  },
  {
    version: '4.4.1',
    date: '2026-01-08',
    title: 'Critical Bug Fixes & Asset Editing',
    features: [
      '✏️ Edit asset name and type after creation',
      '🎨 Color-coded asset cards (blue=retirement, purple=general, green=investments, red=debt)',
      '⚽ Soccer goal icon in sidebar navigation',
    ],
    bugFixes: [
      'FIXED: Upcoming filter now correctly excludes past-dated recurring expenses',
      'FIXED: Upcoming total only counts truly future transactions',
      'FIXED: Past recurring expenses no longer counted as "upcoming"',
      'FIXED: Persistent "0" display under budget categories (aggressive fix)',
    ],
    breaking: [],
  },
  {
    version: '4.4.0',
    date: '2026-01-07',
    title: 'Asset Types & Major UX Improvements',
    features: [
      '🏦 Asset categorization: Track debt, retirement, investments, and general assets separately',
      '✨ Custom asset types: Create your own categories',
      '📊 Asset summary by category: See your net worth breakdown at a glance',
      '💰 Improved per-month savings calculation using actual days',
      '🎯 Better recurring expense handling - past due items no longer show as "upcoming"',
      '📅 Recent transactions now only shows paid items (not future projected)',
    ],
    bugFixes: [
      'Fixed persistent "0" display under budget categories',
      'Fixed upcoming charges showing for past-dated recurring expenses',
      'Fixed dashboard showing future transactions in recent list',
      'Improved date handling across all pages',
    ],
    breaking: [],
  },
  {
    version: '4.3.2',
    date: '2026-01-06',
    title: 'Income/Recurring Dates & History Fixes',
    features: [
      '📅 Start/end dates for income sources',
      '📅 Start/end dates for recurring expenses',
      '⚠️ Warning when changing income/recurring values',
      '📊 Fixed asset value history ordering',
    ],
    bugFixes: [
      'Fixed major date timezone issue (purchases showing day behind)',
      'Fixed same-day asset value changes ordering',
      'Expired income/recurring now shows at bottom with badge',
    ],
    breaking: [],
  },
  {
    version: '4.3.1',
    date: '2026-01-05',
    title: 'Tag System & UX Improvements',
    features: [
      '🏷️ Tag autocomplete in transaction edit',
      '✅ Auto-save tags on submit (no Enter needed)',
      '📅 "Upcoming" checkbox for new purchases',
    ],
    bugFixes: [
      'Fixed past recurring showing as "Upcoming"',
      'Fixed date timezone on new purchases',
    ],
    breaking: [],
  },
  {
    version: '4.3.0',
    date: '2026-01-04',
    title: 'Transaction Management & Features',
    features: [
      '✏️ Full transaction edit functionality',
      '🗑️ Transaction delete with confirmation',
      '📅 Yearly recurring with specific month + day selection',
      '🎯 Goals auto-sync with linked asset values',
      '📱 Version display in sidebar',
    ],
    bugFixes: [
      'Fixed category "0" display issue',
    ],
    breaking: [],
  },
]

export const CURRENT_VERSION = VERSION_NOTES[0].version
