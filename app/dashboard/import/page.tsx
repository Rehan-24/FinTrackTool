'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { ArrowLeft, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'

type Category = { id: string; name: string }

type SplitRow = {
  person_name: string
  amount_owed: number
  is_paid_back: boolean
}

type ParsedTransaction = {
  sheet_row: number
  transaction_id: string
  date: string
  description: string
  category_name: string
  category_id: string | null
  total_amount: number
  payment_method: string | null
  tags: string[] | null
  notes: string | null
  is_split: boolean
  is_projected: boolean
  splits: SplitRow[]
  errors: string[]
  duplicate: boolean
}

function header_index(header_row: any[]) {
  const map: Record<string, number> = {}
  header_row.forEach((h, i) => {
    if (typeof h === 'string') map[h.trim().toLowerCase()] = i
  })
  return map
}

function cell_str(row: any[], idx: number | undefined): string {
  if (idx === undefined) return ''
  const v = row[idx]
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

// Cells like split amounts may come back as a cached number, or (rarely, if the
// file was never reopened in a real spreadsheet app) as the raw "=192.19/6" formula
// text. Handle both without using eval on arbitrary input.
function parse_amount(raw: any): number | null {
  if (typeof raw === 'number') return raw
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (s === '') return null
  if (s.startsWith('=')) {
    const expr = s.slice(1)
    if (!/^[\d.\s+\-*/()]+$/.test(expr)) return null
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr})`)()
      return typeof result === 'number' && isFinite(result) ? result : null
    } catch {
      return null
    }
  }
  const n = parseFloat(s.replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

export default function ImportPage() {
  const router = useRouter()
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedTransaction[] | null>(null)
  const [file_name, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [import_progress, setImportProgress] = useState(0)
  const [import_done, setImportDone] = useState(false)
  const [import_summary, setImportSummary] = useState<{ inserted: number; splits_inserted: number; failed: string[] } | null>(null)

  const handle_file = async (file: File) => {
    setParsing(true)
    setRows(null)
    setImportDone(false)
    setFileName(file.name)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)

      const category_map = new Map<string, string>()
      ;(categories as Category[] | null)?.forEach(c => category_map.set(c.name.trim().toLowerCase(), c.id))

      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })

      const tx_sheet = wb.Sheets['Transactions']
      if (!tx_sheet) {
        alert('No "Transactions" tab found in this file.')
        setParsing(false)
        return
      }
      const tx_grid: any[][] = XLSX.utils.sheet_to_json(tx_sheet, { header: 1, defval: null })
      const tx_header = header_index(tx_grid[0] || [])

      const sp_sheet = wb.Sheets['Splits']
      const sp_grid: any[][] = sp_sheet ? XLSX.utils.sheet_to_json(sp_sheet, { header: 1, defval: null }) : []
      const sp_header = header_index(sp_grid[0] || [])

      const splits_by_tid = new Map<string, SplitRow[]>()
      for (let i = 1; i < sp_grid.length; i++) {
        const r = sp_grid[i]
        const tid = cell_str(r, sp_header['transaction id'])
        if (!tid) continue
        const person_name = cell_str(r, sp_header['person name'])
        const amount_owed = parse_amount(r[sp_header['amount owed']])
        const paid_back = cell_str(r, sp_header['paid back?']).toLowerCase() === 'yes'
        if (!person_name || amount_owed === null) continue
        const list = splits_by_tid.get(tid) || []
        list.push({ person_name, amount_owed, is_paid_back: paid_back })
        splits_by_tid.set(tid, list)
      }

      // For duplicate detection: pull existing purchases in the file's date range
      const dates_in_file = tx_grid.slice(1)
        .map(r => cell_str(r, tx_header['date']))
        .filter(Boolean)
      const min_date = dates_in_file.sort()[0]
      const max_date = dates_in_file.sort()[dates_in_file.length - 1]

      const { data: existing } = min_date
        ? await supabase
            .from('purchases')
            .select('date, description, total_amount')
            .eq('user_id', user.id)
            .gte('date', min_date)
            .lte('date', max_date)
        : { data: [] as any[] }

      const existing_keys = new Set(
        (existing || []).map((p: any) => `${p.date}|${p.description}|${Number(p.total_amount)}`)
      )

      const parsed: ParsedTransaction[] = []
      for (let i = 1; i < tx_grid.length; i++) {
        const r = tx_grid[i]
        if (!r || r.every(c => c === null || c === '')) continue

        const transaction_id = cell_str(r, tx_header['transaction id'])
        const date = cell_str(r, tx_header['date'])
        const description = cell_str(r, tx_header['description'])
        const category_name = cell_str(r, tx_header['category'])
        const total_amount = parse_amount(r[tx_header['total amount']])
        const payment_method = cell_str(r, tx_header['payment method']) || null
        const tags_raw = cell_str(r, tx_header['tags'])
        const tags = tags_raw ? tags_raw.split(',').map(t => t.trim()).filter(Boolean) : null
        const notes = cell_str(r, tx_header['notes']) || null
        const is_split = cell_str(r, tx_header['is split']).toLowerCase() === 'yes'
        const is_projected = cell_str(r, tx_header['is upcoming/projected']).toLowerCase() === 'yes'

        const errors: string[] = []
        if (!date) errors.push('Missing date')
        if (!description) errors.push('Missing description')
        if (!category_name) errors.push('Missing category')
        else if (!category_map.has(category_name.trim().toLowerCase())) errors.push(`Category "${category_name}" doesn't exist in your account`)
        if (total_amount === null) errors.push('Missing/invalid total amount')

        const splits = transaction_id ? (splits_by_tid.get(transaction_id) || []) : []
        if (is_split && splits.length === 0) errors.push('Marked as split but no matching rows on the Splits tab')

        const duplicate = !!(date && description && total_amount !== null &&
          existing_keys.has(`${date}|${description}|${total_amount}`))

        parsed.push({
          sheet_row: i + 1,
          transaction_id,
          date,
          description,
          category_name,
          category_id: category_map.get(category_name.trim().toLowerCase()) || null,
          total_amount: total_amount ?? 0,
          payment_method,
          tags,
          notes,
          is_split,
          is_projected,
          splits,
          errors,
          duplicate,
        })
      }

      setRows(parsed)
    } catch (err) {
      console.error('Error parsing file:', err)
      alert('Failed to read that file. Make sure it is the .xlsx template with a "Transactions" tab.')
    } finally {
      setParsing(false)
    }
  }

  const importable = (rows || []).filter(r => r.errors.length === 0 && !r.duplicate)
  const blocked = (rows || []).filter(r => r.errors.length > 0)
  const duplicates = (rows || []).filter(r => r.duplicate && r.errors.length === 0)

  const run_import = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setImporting(true)
    setImportProgress(0)

    const CHUNK = 40
    let inserted_count = 0
    let splits_inserted = 0
    const failed: string[] = []
    const all_split_records: any[] = []

    for (let i = 0; i < importable.length; i += CHUNK) {
      const chunk = importable.slice(i, i + CHUNK)
      const insert_payload = chunk.map(r => {
        const owed_back = r.is_split ? r.splits.reduce((s, p) => s + p.amount_owed, 0) : null
        const actual = r.is_split ? r.total_amount - (owed_back || 0) : r.total_amount
        return {
          user_id: user.id,
          category_id: r.category_id,
          description: r.description,
          total_amount: r.total_amount,
          actual_cost: actual,
          date: r.date,
          is_split: r.is_split,
          amount_owed_back: owed_back,
          num_people_owing: r.is_split ? r.splits.length : null,
          is_projected: r.is_projected,
          tags: r.tags,
          payment_method: r.payment_method,
          notes: r.notes,
        }
      })

      const { data: inserted, error } = await supabase
        .from('purchases')
        .insert(insert_payload)
        .select('id')

      if (error || !inserted) {
        console.error('Chunk insert failed:', error)
        chunk.forEach(r => failed.push(`Row ${r.sheet_row}: ${r.description}`))
        setImportProgress(i + chunk.length)
        continue
      }

      inserted_count += inserted.length
      inserted.forEach((row: { id: string }, idx: number) => {
        const source = chunk[idx]
        if (source.is_split && source.splits.length > 0) {
          source.splits.forEach(sp => {
            all_split_records.push({
              purchase_id: row.id,
              user_id: user.id,
              person_name: sp.person_name,
              amount_owed: sp.amount_owed,
              is_paid_back: sp.is_paid_back,
            })
          })
        }
      })

      setImportProgress(i + chunk.length)
    }

    for (let i = 0; i < all_split_records.length; i += CHUNK) {
      const chunk = all_split_records.slice(i, i + CHUNK)
      const { error } = await supabase.from('split_payments').insert(chunk)
      if (error) {
        console.error('Split payment insert failed:', error)
      } else {
        splits_inserted += chunk.length
      }
    }

    setImportSummary({ inserted: inserted_count, splits_inserted, failed })
    setImportDone(true)
    setImporting(false)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-8 max-w-4xl">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-2">Import Transactions</h2>
        <p className="text-gray-600 mb-8">
          Upload a filled-in Transaction Import Template. Nothing is written to your account until you review the
          preview below and click Import.
        </p>

        {!rows && (
          <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
            <Upload className="mx-auto mb-4 text-gray-400" size={40} />
            <label className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 cursor-pointer">
              {parsing ? 'Reading file…' : 'Choose Excel file'}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                disabled={parsing}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handle_file(f)
                }}
              />
            </label>
          </div>
        )}

        {rows && !import_done && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm text-gray-500 mb-1">{file_name}</div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 size={18} />
                  {importable.length} ready to import
                </div>
                {duplicates.length > 0 && (
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle size={18} />
                    {duplicates.length} already exist in your account — will be skipped
                  </div>
                )}
                {blocked.length > 0 && (
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle size={18} />
                    {blocked.length} have errors — will be skipped
                  </div>
                )}
              </div>
            </div>

            {blocked.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="font-semibold text-red-800 mb-2">Rows with errors ({blocked.length})</div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {blocked.map(r => (
                    <div key={r.sheet_row} className="text-sm text-red-700">
                      Row {r.sheet_row} — {r.description || '(no description)'}: {r.errors.join('; ')}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-red-600 mt-2">
                  Fix these in the spreadsheet and re-upload, or continue — they'll simply be left out of this import.
                </p>
              </div>
            )}

            {duplicates.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="font-semibold text-amber-800 mb-2">Already in your account ({duplicates.length})</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {duplicates.map(r => (
                    <div key={r.sheet_row} className="text-sm text-amber-700">
                      Row {r.sheet_row} — {r.date} · {r.description} · ${r.total_amount.toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="font-semibold text-gray-800 mb-3">Preview ({importable.length} rows)</div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-200">
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Card</th>
                      <th className="py-2 pr-3">Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importable.map(r => (
                      <tr key={r.sheet_row} className="border-b border-gray-100">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{r.date}</td>
                        <td className="py-1.5 pr-3">{r.description}</td>
                        <td className="py-1.5 pr-3">{r.category_name}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">${r.total_amount.toFixed(2)}</td>
                        <td className="py-1.5 pr-3">{r.payment_method}</td>
                        <td className="py-1.5 pr-3">
                          {r.is_split ? `${r.splits.length} ${r.splits.length === 1 ? 'person' : 'people'}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setRows(null); setFileName('') }}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                disabled={importing}
              >
                Choose a different file
              </button>
              <button
                onClick={run_import}
                disabled={importing || importable.length === 0}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? `Importing… (${import_progress}/${importable.length})` : `Import ${importable.length} transactions`}
              </button>
            </div>
          </div>
        )}

        {import_done && import_summary && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-green-600" size={40} />
            <div className="text-xl font-semibold text-gray-800 mb-2">Import complete</div>
            <p className="text-gray-600 mb-1">{import_summary.inserted} transactions imported.</p>
            <p className="text-gray-600 mb-4">{import_summary.splits_inserted} split-payment records added.</p>
            {import_summary.failed.length > 0 && (
              <div className="text-left bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="font-semibold text-red-800 mb-2">{import_summary.failed.length} rows failed to insert</div>
                {import_summary.failed.map((f, i) => <div key={i} className="text-sm text-red-700">{f}</div>)}
              </div>
            )}
            <button
              onClick={() => router.push('/dashboard/transactions')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              View Transactions
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
