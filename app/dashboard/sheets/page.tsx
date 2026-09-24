'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Undo2, Upload, Download, Check, Loader2, AlertCircle, PaintBucket, ChevronDown } from 'lucide-react'
import {
  Cells, CellValue, SheetError, SUPPORTED_FUNCTIONS,
  evaluate_sheet, display_value, cell_key, index_to_col, parse_number,
} from '@/lib/sheet-formulas'

type Sheet = {
  id: string
  position: number
  name: string
  cells: Cells
  row_count: number
  col_count: number
  col_widths: Record<string, number> // pixels, keyed by column index
  fills: Record<string, string> // hex fill color, keyed by cell address
}

type Pos = { r: number, c: number }
type Editing = { draft: string, from: 'cell' | 'bar', mode: 'enter' | 'edit' } | null
type SaveState = 'saved' | 'pending' | 'saving' | 'error'
type Snapshot = Pick<Sheet, 'cells' | 'row_count' | 'col_count' | 'col_widths' | 'fills'>

const MAX_SHEETS = 3
const MAX_ROWS = 500
const MAX_COLS = 52
const DEFAULT_ROWS = 50
const DEFAULT_COLS = 12
const SAVE_DELAY_MS = 800
const UNDO_LIMIT = 100
const NAME_MAX = 40
const DEFAULT_COL_WIDTH = 112
const MIN_COL_WIDTH = 40
const MAX_COL_WIDTH = 800

const FILL_COLORS = [
  { name: 'Yellow', hex: '#FEF08A' },
  { name: 'Green', hex: '#BBF7D0' },
  { name: 'Blue', hex: '#BFDBFE' },
  { name: 'Red', hex: '#FECACA' },
  { name: 'Orange', hex: '#FED7AA' },
  { name: 'Purple', hex: '#E9D5FF' },
  { name: 'Pink', hex: '#FBCFE8' },
  { name: 'Gray', hex: '#E5E7EB' },
]

const FORMATTING_MIGRATION_NOTICE =
  'Column widths and fill colors can\'t be saved yet. Run add_sheet_formatting.sql in the Supabase SQL Editor, then reload.'

const clamp_width = (w: number) => Math.round(Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, w)))

// Rows from before the formatting columns existed have no widths or fills
const normalize = (row: any): Sheet => ({ ...row, col_widths: row.col_widths ?? {}, fills: row.fills ?? {} })

// Shared canvas for measuring text when auto-fitting columns
let measure_ctx: CanvasRenderingContext2D | null = null
const text_width = (text: string, font: string) => {
  measure_ctx ??= document.createElement('canvas').getContext('2d')
  if (!measure_ctx) return text.length * 8
  measure_ctx.font = font
  return measure_ctx.measureText(text).width
}

const FORMULA_HELP =
  `Start a cell with = to use a formula. Use cell references (A1), ranges (A1:A10), + - * / ^, ` +
  `& to join text, and comparisons (= <> < > <= >=). Functions: ${SUPPORTED_FUNCTIONS.join(', ')}. ` +
  'Example: =SUM(B2:B10) or =IF(C2>100,"Over","OK").'

// ── cell ────────────────────────────────────────────────────────────────────

const Cell = memo(function Cell({ r, c, width, fill, text, numeric, error, in_range, active, editing, onMouseDown, onMouseEnter, onDoubleClick }: {
  r: number
  c: number
  width: number
  fill?: string
  text: string
  numeric: boolean
  error: boolean
  in_range: boolean
  active: boolean
  editing: React.ReactNode
  onMouseDown: (r: number, c: number, e: React.MouseEvent) => void
  onMouseEnter: (r: number, c: number) => void
  onDoubleClick: (r: number, c: number) => void
}) {
  return (
    <td
      data-cell={cell_key(r, c)}
      onMouseDown={e => onMouseDown(r, c, e)}
      onMouseEnter={() => onMouseEnter(r, c)}
      onDoubleClick={() => onDoubleClick(r, c)}
      style={{
        width, minWidth: width, maxWidth: width,
        backgroundColor: fill,
        boxShadow: in_range ? 'inset 0 0 0 999px rgba(59, 130, 246, 0.14)' : undefined,
      }}
      className={`relative h-7 border border-gray-200 px-1.5 text-sm whitespace-nowrap overflow-hidden text-ellipsis cursor-cell bg-white ${active ? 'outline outline-2 -outline-offset-2 outline-blue-500' : ''} ${
        error ? 'text-red-600' : 'text-gray-800'
      } ${numeric ? 'text-right tabular-nums' : 'text-left'}`}
    >
      {editing ?? text}
    </td>
  )
})

// ── page ────────────────────────────────────────────────────────────────────

export default function SheetsPage() {
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [active_id, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [load_error, setLoadError] = useState<string | null>(null)

  const [sel, setSel] = useState<Pos>({ r: 0, c: 0 })
  const [anchor, setAnchor] = useState<Pos>({ r: 0, c: 0 })
  const [editing, setEditing] = useState<Editing>(null)
  const [renaming, setRenaming] = useState<{ id: string, draft: string } | null>(null)
  const [save_state, setSaveState] = useState<SaveState>('saved')
  const [notice, setNotice] = useState<string | null>(null)

  const grid_ref = useRef<HTMLDivElement>(null)
  // Invisible input that holds focus while navigating. Typed text arrives here however it's
  // entered (key presses, phone keyboards, dictation, IME) and starts editing the active cell.
  const capture_ref = useRef<HTMLInputElement>(null)
  const file_ref = useRef<HTMLInputElement>(null)
  const dragging = useRef(false)
  const undo_stacks = useRef<Record<string, Snapshot[]>>({})

  // Autosave: sheets with unsaved changes are written after a short pause in typing
  const sheets_ref = useRef<Sheet[]>([])
  sheets_ref.current = sheets
  const dirty = useRef(new Set<string>())
  const save_timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editing_ref = useRef<Editing>(null)
  editing_ref.current = editing

  const active = sheets.find(s => s.id === active_id) || null

  // ── loading ──

  const loaded = useRef(false)

  useEffect(() => {
    // Load once, even if React mounts the page twice in development (it would create two first sheets)
    if (!loaded.current) {
      loaded.current = true
      load_sheets()
    }

    const release = () => { dragging.current = false }
    const warn_unsaved = (e: BeforeUnloadEvent) => {
      if (dirty.current.size > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('mouseup', release)
    window.addEventListener('beforeunload', warn_unsaved)
    return () => {
      window.removeEventListener('mouseup', release)
      window.removeEventListener('beforeunload', warn_unsaved)
      flush_saves() // navigating to another page inside the app
    }
  }, [])

  const load_sheets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('sheets')
        .select('*')
        .eq('user_id', user.id)
        .order('position')

      if (error) {
        setLoadError(error.code === '42P01' || /relation .*sheets/i.test(error.message)
          ? 'The Sheets table hasn\'t been set up yet. Run add_sheets_table.sql in the Supabase SQL Editor, then reload.'
          : `Couldn't load your sheets: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        await create_sheet([])
      } else {
        setSheets(data.map(normalize))
        setActiveId(data[0].id)
      }
    } catch (err) {
      console.error('Error loading sheets:', err)
      setLoadError('Couldn\'t load your sheets.')
    } finally {
      setLoading(false)
    }
  }

  // ── saving ──

  const flush_saves = async () => {
    if (save_timer.current) { clearTimeout(save_timer.current); save_timer.current = null }
    const ids = Array.from(dirty.current)
    if (ids.length === 0) return
    dirty.current.clear()
    setSaveState('saving')

    let failed = false
    for (const id of ids) {
      const sheet = sheets_ref.current.find(s => s.id === id)
      if (!sheet) continue
      const { error } = await supabase
        .from('sheets')
        .update({
          name: sheet.name,
          cells: sheet.cells,
          row_count: sheet.row_count,
          col_count: sheet.col_count,
          col_widths: sheet.col_widths,
          fills: sheet.fills,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) {
        console.error('Error saving sheet:', error)
        if (/col_widths|fills/.test(error.message)) setNotice(FORMATTING_MIGRATION_NOTICE)
        dirty.current.add(id) // retry on the next change
        failed = true
      }
    }
    setSaveState(failed ? 'error' : dirty.current.size > 0 ? 'pending' : 'saved')
  }

  const schedule_save = (id: string) => {
    dirty.current.add(id)
    setSaveState('pending')
    if (save_timer.current) clearTimeout(save_timer.current)
    save_timer.current = setTimeout(flush_saves, SAVE_DELAY_MS)
  }

  const push_undo = (sheet: Sheet) => {
    const stack = (undo_stacks.current[sheet.id] ??= [])
    const { cells, row_count, col_count, col_widths, fills } = sheet
    stack.push({ cells, row_count, col_count, col_widths, fills })
    if (stack.length > UNDO_LIMIT) stack.shift()
  }

  // Apply a change to the active sheet, optionally recording an undo step
  const update_active = (patch: Partial<Sheet>, record_undo = true) => {
    if (!active) return
    if (record_undo) push_undo(active)
    setSheets(prev => prev.map(s => (s.id === active.id ? { ...s, ...patch } : s)))
    schedule_save(active.id)
  }

  const undo = () => {
    if (!active) return
    const snapshot = undo_stacks.current[active.id]?.pop()
    if (snapshot) update_active(snapshot, false)
  }

  // ── sheets ──

  const create_sheet = async (existing = sheets) => {
    if (existing.length >= MAX_SHEETS) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const used = new Set(existing.map(s => s.position))
    const position = [1, 2, 3].find(p => !used.has(p))!

    const { data, error } = await supabase
      .from('sheets')
      .insert({ user_id: user.id, position, name: `Sheet ${position}`, row_count: DEFAULT_ROWS, col_count: DEFAULT_COLS })
      .select('*')
      .single()

    if (error || !data) {
      console.error('Error creating sheet:', error)
      alert(`Couldn't create a sheet${error?.message ? `: ${error.message}` : ''}`)
      return
    }
    setSheets([...existing, normalize(data)].sort((a, b) => a.position - b.position))
    switch_sheet(data.id)
  }

  const switch_sheet = (id: string) => {
    flush_saves()
    setEditing(null)
    setActiveId(id)
    setSel({ r: 0, c: 0 })
    setAnchor({ r: 0, c: 0 })
  }

  const delete_sheet = async (sheet: Sheet) => {
    if (!confirm(`Delete "${sheet.name}"? Everything in it will be permanently removed.`)) return
    dirty.current.delete(sheet.id)
    const { error } = await supabase.from('sheets').delete().eq('id', sheet.id)
    if (error) {
      alert(`Couldn't delete the sheet: ${error.message}`)
      return
    }
    const remaining = sheets.filter(s => s.id !== sheet.id)
    delete undo_stacks.current[sheet.id]
    setSheets(remaining)
    if (active_id === sheet.id) {
      setActiveId(remaining[0]?.id ?? null)
      setSel({ r: 0, c: 0 })
      setAnchor({ r: 0, c: 0 })
    }
  }

  const commit_rename = () => {
    if (!renaming) return
    const name = renaming.draft.trim().slice(0, NAME_MAX)
    const sheet = sheets.find(s => s.id === renaming.id)
    setRenaming(null)
    if (!sheet || !name || name === sheet.name) return
    setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, name } : s)))
    schedule_save(sheet.id)
  }

  // ── values ──

  const values = useMemo(() => (active ? evaluate_sheet(active.cells) : {}), [active?.cells])

  const range = {
    r1: Math.min(sel.r, anchor.r), r2: Math.max(sel.r, anchor.r),
    c1: Math.min(sel.c, anchor.c), c2: Math.max(sel.c, anchor.c),
  }
  const range_label = range.r1 === range.r2 && range.c1 === range.c2
    ? cell_key(sel.r, sel.c)
    : `${cell_key(range.r1, range.c1)}:${cell_key(range.r2, range.c2)}`

  const raw_at = (r: number, c: number) => active?.cells[cell_key(r, c)] ?? ''

  // ── editing ──

  const focus_grid = () => capture_ref.current?.focus({ preventScroll: true })

  const start_edit = (from: 'cell' | 'bar', mode: 'enter' | 'edit', draft?: string) => {
    setEditing({ from, mode, draft: draft ?? raw_at(sel.r, sel.c) })
  }

  const write_cells = (changes: Record<string, string>, grow?: { rows: number, cols: number }) => {
    if (!active) return
    const cells = { ...active.cells }
    for (const [key, raw] of Object.entries(changes)) {
      if (raw === '') delete cells[key]
      else cells[key] = raw
    }
    update_active({
      cells,
      row_count: Math.min(MAX_ROWS, Math.max(active.row_count, grow?.rows ?? 0)),
      col_count: Math.min(MAX_COLS, Math.max(active.col_count, grow?.cols ?? 0)),
    })
  }

  const move = (dr: number, dc: number, extend = false) => {
    if (!active) return
    const next = {
      r: Math.max(0, Math.min(active.row_count - 1, sel.r + dr)),
      c: Math.max(0, Math.min(active.col_count - 1, sel.c + dc)),
    }
    setSel(next)
    if (!extend) setAnchor(next)
  }

  // `refocus` is false when committing because focus already moved elsewhere (a blur)
  const commit_edit = (dr = 0, dc = 0, refocus = true) => {
    const ed = editing_ref.current
    if (!ed) return
    editing_ref.current = null
    const key = cell_key(sel.r, sel.c)
    if (ed.draft !== raw_at(sel.r, sel.c)) write_cells({ [key]: ed.draft })
    setEditing(null)
    move(dr, dc)
    if (refocus) focus_grid()
  }

  // Raw text of the active cell from the latest committed state (not this render's snapshot)
  const latest_raw = () => {
    const sheet = sheets_ref.current.find(x => x.id === active_id)
    return sheet?.cells[cell_key(sel.r, sel.c)] ?? ''
  }

  const cancel_edit = () => {
    editing_ref.current = null
    setEditing(null)
    focus_grid()
  }

  const clear_range = () => {
    const changes: Record<string, string> = {}
    for (let r = range.r1; r <= range.r2; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        if (raw_at(r, c) !== '') changes[cell_key(r, c)] = ''
      }
    }
    if (Object.keys(changes).length) write_cells(changes)
  }

  // Keys while typing in a cell or the formula bar
  const on_edit_key = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Enter') { e.preventDefault(); commit_edit(e.shiftKey ? -1 : 1, 0) }
    else if (e.key === 'Tab') { e.preventDefault(); commit_edit(0, e.shiftKey ? -1 : 1) }
    else if (e.key === 'Escape') { e.preventDefault(); cancel_edit() }
    else if (editing?.mode === 'enter' && e.key.startsWith('Arrow')) {
      // Typing straight into a cell: arrows finish the entry and move, like Excel
      e.preventDefault()
      const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key] as number[]
      commit_edit(dr, dc)
    }
  }

  // Keys while the grid itself has focus
  const on_grid_key = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!active || editing) return
    const mod = e.ctrlKey || e.metaKey
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

    if (arrows[e.key]) {
      e.preventDefault()
      const [dr, dc] = arrows[e.key]
      const jump = mod ? Math.max(active.row_count, active.col_count) : 1
      move(dr * jump, dc * jump, e.shiftKey)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      move(0, e.shiftKey ? -1 : 1)
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      start_edit('cell', 'edit')
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      clear_range()
    } else if (e.key === 'Escape') {
      setAnchor(sel)
    } else if (mod && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
      // Give the capture input a real text selection so every browser runs a native copy/cut;
      // on_copy / on_cut then put the cells on the clipboard
      const capture = capture_ref.current
      if (capture) {
        capture.value = range_as_tsv() || ' '
        capture.select()
        setTimeout(() => { capture.value = '' }, 0)
      }
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      undo()
    } else if (mod && e.key.toLowerCase() === 'a') {
      // Select everything but keep A1 as the active cell, so the view doesn't jump to the far corner
      e.preventDefault()
      setAnchor({ r: active.row_count - 1, c: active.col_count - 1 })
      setSel({ r: 0, c: 0 })
    }
  }

  // Text typed while navigating starts a fresh entry in the active cell (or, if characters
  // arrive before the cell's input has focus, is appended to that entry)
  const on_capture_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    e.target.value = ''
    if (!text || !active) return
    if (editing_ref.current) {
      setEditing(ed => (ed ? { ...ed, draft: ed.draft + text } : ed))
    } else {
      setAnchor(sel)
      start_edit('cell', 'enter', text)
    }
  }

  // ── clipboard (tab-separated, so it round-trips with Excel and Google Sheets) ──

  const range_as_tsv = () => {
    const lines: string[] = []
    for (let r = range.r1; r <= range.r2; r++) {
      const row: string[] = []
      for (let c = range.c1; c <= range.c2; c++) row.push(raw_at(r, c))
      lines.push(row.join('\t'))
    }
    return lines.join('\n')
  }

  const on_copy = (e: React.ClipboardEvent) => {
    if (editing) return
    e.preventDefault()
    e.clipboardData.setData('text/plain', range_as_tsv())
  }

  const on_cut = (e: React.ClipboardEvent) => {
    if (editing) return
    on_copy(e)
    clear_range()
  }

  const on_paste = (e: React.ClipboardEvent) => {
    if (editing || !active) return
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n').replace(/\n$/, '')
    if (!text) return
    const rows = text.split('\n').map(line => line.split('\t'))
    const changes: Record<string, string> = {}
    let max_r = 0
    let max_c = 0
    rows.forEach((row, i) => row.forEach((raw, j) => {
      const r = range.r1 + i
      const c = range.c1 + j
      if (r >= MAX_ROWS || c >= MAX_COLS) return
      changes[cell_key(r, c)] = raw
      max_r = Math.max(max_r, r + 1)
      max_c = Math.max(max_c, c + 1)
    }))
    write_cells(changes, { rows: max_r, cols: max_c })
    setAnchor({ r: range.r1, c: range.c1 })
    setSel({ r: Math.min(max_r, MAX_ROWS) - 1, c: Math.min(max_c, MAX_COLS) - 1 })
  }

  // ── mouse ──

  const on_cell_mouse_down_impl = (r: number, c: number, e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (editing_ref.current) commit_edit(0, 0, false)
    e.preventDefault()
    focus_grid()
    setSel({ r, c })
    if (!e.shiftKey) setAnchor({ r, c })
    dragging.current = true
  }

  const on_cell_double_click_impl = (r: number, c: number) => {
    setSel({ r, c })
    setAnchor({ r, c })
    setEditing({ from: 'cell', mode: 'edit', draft: raw_at(r, c) })
  }

  const cell_handlers = useRef({ down: on_cell_mouse_down_impl, dbl: on_cell_double_click_impl })
  cell_handlers.current = { down: on_cell_mouse_down_impl, dbl: on_cell_double_click_impl }
  const on_cell_mouse_down = useCallback((r: number, c: number, e: React.MouseEvent) => cell_handlers.current.down(r, c, e), [])
  const on_cell_double_click = useCallback((r: number, c: number) => cell_handlers.current.dbl(r, c), [])
  const on_cell_mouse_enter = useCallback((r: number, c: number) => {
    if (dragging.current) setSel({ r, c })
  }, [])

  // Keep the active cell in view when moving with the keyboard
  useEffect(() => {
    const el = grid_ref.current?.querySelector(`[data-cell="${cell_key(sel.r, sel.c)}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [sel])

  // ── column widths ──

  const col_width = (c: number) => active?.col_widths[c] ?? DEFAULT_COL_WIDTH

  // Dragging a column edge: widths update live, one undo step and one save per drag
  const resizing = useRef<{ id: string, c: number, start_x: number, start_w: number } | null>(null)

  const start_resize = (c: number, e: React.MouseEvent) => {
    if (!active || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    push_undo(active)
    resizing.current = { id: active.id, c, start_x: e.clientX, start_w: col_width(c) }
  }

  useEffect(() => {
    const on_move = (e: MouseEvent) => {
      const drag = resizing.current
      if (!drag) return
      const width = clamp_width(drag.start_w + e.clientX - drag.start_x)
      setSheets(prev => prev.map(s => (s.id === drag.id ? { ...s, col_widths: { ...s.col_widths, [drag.c]: width } } : s)))
    }
    const on_up = (e: MouseEvent) => {
      const drag = resizing.current
      if (!drag) return
      resizing.current = null
      // A click without movement (e.g. half of a double-click) changes nothing: drop its undo step
      if (e.clientX === drag.start_x) undo_stacks.current[drag.id]?.pop()
      else schedule_save(drag.id)
    }
    window.addEventListener('mousemove', on_move)
    window.addEventListener('mouseup', on_up)
    return () => {
      window.removeEventListener('mousemove', on_move)
      window.removeEventListener('mouseup', on_up)
    }
  }, [])

  // Double-clicking a column edge fits the column to its widest value. If that column is part of a
  // multi-column selection, every selected column is fitted, like Excel.
  const autofit = (c: number) => {
    if (!active) return
    const cols = c >= range.c1 && c <= range.c2 && range.c1 !== range.c2
      ? Array.from({ length: range.c2 - range.c1 + 1 }, (_, i) => range.c1 + i)
      : [c]
    const sample = grid_ref.current?.querySelector('td[data-cell]')
    const font = sample ? getComputedStyle(sample).font : '14px sans-serif'

    const col_widths = { ...active.col_widths }
    for (const col of cols) {
      let widest = 0
      for (let r = 0; r < active.row_count; r++) {
        const key = cell_key(r, col)
        const raw = active.cells[key]
        if (!raw) continue
        const text = raw.startsWith('=') ? display_value(values[key]) : raw
        widest = Math.max(widest, text_width(text, font))
      }
      // Empty columns go back to the default width; 16px covers padding and borders
      if (widest === 0) delete col_widths[col]
      else col_widths[col] = clamp_width(Math.ceil(widest) + 16)
    }
    update_active({ col_widths })
  }

  // Clicking a column or row header selects all of it
  const select_column = (c: number, e: React.MouseEvent) => {
    if (!active || e.button !== 0) return
    e.preventDefault()
    if (editing_ref.current) commit_edit(0, 0, false)
    focus_grid()
    setAnchor({ r: active.row_count - 1, c: e.shiftKey ? anchor.c : c })
    setSel({ r: 0, c })
  }

  const select_row = (r: number, e: React.MouseEvent) => {
    if (!active || e.button !== 0) return
    e.preventDefault()
    if (editing_ref.current) commit_edit(0, 0, false)
    focus_grid()
    setAnchor({ r: e.shiftKey ? anchor.r : r, c: active.col_count - 1 })
    setSel({ r, c: 0 })
  }

  // ── fills ──

  const [fill_open, setFillOpen] = useState(false)

  const apply_fill = (hex: string | null) => {
    if (!active) return
    const fills = { ...active.fills }
    for (let r = range.r1; r <= range.r2; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        if (hex) fills[cell_key(r, c)] = hex
        else delete fills[cell_key(r, c)]
      }
    }
    update_active({ fills })
    setFillOpen(false)
    focus_grid()
  }

  // ── rows / columns ──

  const add_rows = () => active && update_active({ row_count: Math.min(MAX_ROWS, active.row_count + 10) })
  const add_col = () => active && update_active({ col_count: Math.min(MAX_COLS, active.col_count + 1) })

  // ── import / export ──

  const import_file = async (file: File) => {
    if (!active) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = workbook.Sheets[workbook.SheetNames[0]]
      if (!ws || !ws['!ref']) { setNotice('That file has no data in its first tab.'); return }

      const bounds = XLSX.utils.decode_range(ws['!ref'])
      const cells: Cells = {}
      let rows = 0
      let cols = 0
      let truncated = false
      for (let r = bounds.s.r; r <= bounds.e.r; r++) {
        for (let c = bounds.s.c; c <= bounds.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })]
          if (!cell) continue
          if (r >= MAX_ROWS || c >= MAX_COLS) { truncated = true; continue }
          const raw = cell.f ? `=${cell.f}` : cell.w ?? (cell.v == null ? '' : String(cell.v))
          if (raw === '') continue
          cells[cell_key(r, c)] = raw
          rows = Math.max(rows, r + 1)
          cols = Math.max(cols, c + 1)
        }
      }

      // Column widths saved in the file (pixels, or character widths at ~7px each)
      const col_widths: Record<string, number> = {}
      ;(ws['!cols'] || []).forEach((col, c) => {
        const px = col?.wpx ?? (col?.wch ? col.wch * 7 + 5 : undefined)
        if (px && c < MAX_COLS) col_widths[c] = clamp_width(px)
      })

      if (Object.keys(active.cells).length > 0 &&
        !confirm(`Replace everything in "${active.name}" with the contents of ${file.name}? You can undo this.`)) return

      update_active({
        cells,
        col_widths,
        fills: {},
        row_count: Math.max(DEFAULT_ROWS, rows),
        col_count: Math.max(DEFAULT_COLS, cols),
      })
      setNotice(truncated
        ? `Imported ${file.name}. Only the first ${MAX_ROWS} rows and ${MAX_COLS} columns fit in a sheet, so the rest was left out.`
        : `Imported ${file.name}.`)
    } catch (err) {
      console.error('Error importing file:', err)
      setNotice('Couldn\'t read that file. Try an .xlsx, .xls or .csv file.')
    }
  }

  const export_file = () => {
    if (!active) return
    const ws: XLSX.WorkSheet = {}
    let max_r = 0
    let max_c = 0
    for (let r = 0; r < active.row_count; r++) {
      for (let c = 0; c < active.col_count; c++) {
        const key = cell_key(r, c)
        const raw = active.cells[key]
        if (!raw) continue
        max_r = Math.max(max_r, r)
        max_c = Math.max(max_c, c)
        let cell: XLSX.CellObject
        if (raw.startsWith('=')) {
          const v = values[key]
          cell = v instanceof SheetError ? { t: 'e', f: raw.slice(1) }
            : typeof v === 'number' ? { t: 'n', v, f: raw.slice(1) }
            : typeof v === 'boolean' ? { t: 'b', v, f: raw.slice(1) }
            : { t: 's', v: String(v ?? ''), f: raw.slice(1) }
        } else {
          const n = parse_number(raw)
          cell = n === null ? { t: 's', v: raw } : { t: 'n', v: n }
        }
        ws[XLSX.utils.encode_cell({ r, c })] = cell
      }
    }
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: max_r, c: max_c } })
    ws['!cols'] = Array.from({ length: max_c + 1 }, (_, c) => ({ wpx: col_width(c) }))

    const workbook = XLSX.utils.book_new()
    const tab_name = active.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet'
    XLSX.utils.book_append_sheet(workbook, ws, tab_name)
    XLSX.writeFile(workbook, `${active.name.replace(/[\\/:*?"<>|]/g, '') || 'sheet'}.xlsx`)
  }

  // ── render ──

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  const cell_input = (
    <input
      autoFocus
      value={editing?.draft ?? ''}
      onChange={e => setEditing(ed => (ed ? { ...ed, draft: e.target.value } : ed))}
      onKeyDown={on_edit_key}
      onBlur={() => commit_edit(0, 0, false)}
      className="absolute inset-0 w-full h-full px-1.5 text-sm bg-white outline outline-2 -outline-offset-2 outline-blue-600 text-left"
    />
  )

  const save_label = {
    saved: <><Check size={14} /> Saved</>,
    pending: <><Loader2 size={14} className="animate-spin" /> Saving...</>,
    saving: <><Loader2 size={14} className="animate-spin" /> Saving...</>,
    error: <><AlertCircle size={14} /> Couldn't save. Retrying on your next change</>,
  }[save_state]

  return (
    <div className="p-4 md:p-6 lg:px-4 w-full">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Sheets</h1>
        <p className="text-sm md:text-base text-gray-600">Up to {MAX_SHEETS} spreadsheets, saved to your account as you type</p>
      </div>

      {load_error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{load_error}</div>
      ) : (
        <>
          {/* Sheet tabs */}
          <div className="flex flex-wrap items-end gap-1 border-b border-gray-200">
            {sheets.map(s => (
              <div
                key={s.id}
                className={`group flex items-center gap-1 px-3 py-2 rounded-t-lg border border-b-0 text-sm cursor-pointer ${
                  s.id === active_id ? 'bg-white border-gray-200 font-medium text-gray-900 -mb-px' : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => s.id !== active_id && switch_sheet(s.id)}
                onDoubleClick={() => setRenaming({ id: s.id, draft: s.name })}
                title="Double-click to rename"
              >
                {renaming?.id === s.id ? (
                  <input
                    autoFocus
                    value={renaming.draft}
                    maxLength={NAME_MAX}
                    onChange={e => setRenaming({ id: s.id, draft: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commit_rename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    onBlur={commit_rename}
                    onClick={e => e.stopPropagation()}
                    className="w-32 px-1 py-0.5 text-sm border border-blue-400 rounded outline-none"
                  />
                ) : (
                  <span className="max-w-[12rem] truncate">{s.name}</span>
                )}
                {s.id === active_id && renaming?.id !== s.id && (
                  <button
                    onClick={e => { e.stopPropagation(); delete_sheet(s) }}
                    className="ml-1 text-gray-400 hover:text-red-600"
                    title="Delete sheet"
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {sheets.length < MAX_SHEETS && (
              <button
                onClick={() => create_sheet()}
                className="flex items-center gap-1 px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus size={16} /> New sheet
              </button>
            )}
            <span className="ml-auto pb-2 text-xs text-gray-400">{sheets.length}/{MAX_SHEETS} sheets</span>
          </div>

          {!active ? (
            <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-10 text-center text-gray-500">
              <p className="mb-4">You don't have any sheets.</p>
              <button onClick={() => create_sheet()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                Create a sheet
              </button>
            </div>
          ) : (
            <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 text-sm">
                <button onClick={undo} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-700" title="Undo (Ctrl+Z)">
                  <Undo2 size={15} /> Undo
                </button>
                <button onClick={add_rows} disabled={active.row_count >= MAX_ROWS}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-700 disabled:opacity-40">
                  <Plus size={15} /> 10 rows
                </button>
                <button onClick={add_col} disabled={active.col_count >= MAX_COLS}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-700 disabled:opacity-40">
                  <Plus size={15} /> Column
                </button>
                <span className="w-px h-5 bg-gray-200" />
                <div className="relative">
                  <button
                    onClick={() => setFillOpen(o => !o)}
                    aria-haspopup="true"
                    aria-expanded={fill_open}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-700"
                  >
                    <PaintBucket size={15} /> Fill <ChevronDown size={13} />
                  </button>
                  {fill_open && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setFillOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 z-40 w-48 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                        <div className="text-xs font-medium text-gray-600 mb-2">Fill {range_label}</div>
                        <div className="grid grid-cols-4 gap-2">
                          {FILL_COLORS.map(color => (
                            <button
                              key={color.hex}
                              onClick={() => apply_fill(color.hex)}
                              title={color.name}
                              aria-label={`${color.name} fill`}
                              className="h-8 rounded border border-gray-300 hover:ring-2 hover:ring-blue-400"
                              style={{ backgroundColor: color.hex }}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => apply_fill(null)}
                          className="mt-3 w-full text-xs text-gray-700 border border-gray-200 rounded py-1.5 hover:bg-gray-50"
                        >
                          No fill
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <span className="w-px h-5 bg-gray-200" />
                <button onClick={() => file_ref.current?.click()} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-700">
                  <Upload size={15} /> Import
                </button>
                <input
                  ref={file_ref}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) import_file(file)
                  }}
                />
                <button onClick={export_file} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-700">
                  <Download size={15} /> Export .xlsx
                </button>
                <span className={`ml-auto flex items-center gap-1 text-xs ${save_state === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                  {save_label}
                </span>
              </div>

              {/* Formula bar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
                <span className="w-20 shrink-0 text-xs font-medium text-gray-600 tabular-nums">{range_label}</span>
                <span className="relative group shrink-0 text-xs italic text-gray-400 cursor-help" tabIndex={0}>
                  fx
                  <span role="tooltip" className="pointer-events-none absolute left-0 top-full mt-2 w-80 rounded-md bg-gray-900 px-3 py-2 text-xs not-italic leading-relaxed text-white shadow-lg z-30 opacity-0 invisible transition-opacity group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible">
                    {FORMULA_HELP}
                  </span>
                </span>
                <input
                  aria-label="Cell contents"
                  value={editing ? editing.draft : raw_at(sel.r, sel.c)}
                  onFocus={() => requestAnimationFrame(() => {
                    if (!editing_ref.current) setEditing({ from: 'bar', mode: 'edit', draft: latest_raw() })
                  })}
                  onChange={e => setEditing(ed => ({ from: 'bar', mode: 'edit', ...ed, draft: e.target.value }))}
                  onKeyDown={on_edit_key}
                  onBlur={() => { if (editing_ref.current?.from === 'bar') commit_edit(0, 0, false) }}
                  className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:border-blue-400 outline-none font-mono"
                />
              </div>

              {notice && (
                <div className="flex items-start justify-between gap-3 px-3 py-2 bg-blue-50 text-blue-800 text-sm border-b border-blue-100">
                  <span>{notice}</span>
                  <button onClick={() => setNotice(null)} className="text-blue-500 hover:text-blue-700 text-xs">Dismiss</button>
                </div>
              )}

              {/* Grid */}
              <div
                ref={grid_ref}
                tabIndex={-1}
                onFocus={e => { if (e.target === grid_ref.current) focus_grid() }}
                onKeyDown={on_grid_key}
                onCopy={on_copy}
                onCut={on_cut}
                onPaste={on_paste}
                className="overflow-auto max-h-[calc(100vh-20rem)] outline-none select-none"
              >
                <input
                  ref={capture_ref}
                  aria-label={`Cell ${range_label}`}
                  onChange={on_capture_change}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none"
                />
                <table className="w-max border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-20 w-10 min-w-[2.5rem] h-7 bg-gray-100 border border-gray-200" />
                      {Array.from({ length: active.col_count }, (_, c) => {
                        const width = col_width(c)
                        return (
                          <th
                            key={c}
                            onMouseDown={e => select_column(c, e)}
                            style={{ width, minWidth: width, maxWidth: width }}
                            className={`sticky top-0 z-10 h-7 border border-gray-200 text-xs font-medium cursor-pointer ${
                              c >= range.c1 && c <= range.c2 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {index_to_col(c)}
                            <span
                              onMouseDown={e => start_resize(c, e)}
                              onDoubleClick={e => { e.stopPropagation(); autofit(c) }}
                              title="Drag to resize, double-click to fit"
                              className="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize hover:bg-blue-400/60"
                            />
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: active.row_count }, (_, r) => (
                      <tr key={r}>
                        <th onMouseDown={e => select_row(r, e)} className={`sticky left-0 z-10 w-10 border border-gray-200 text-xs font-medium cursor-pointer ${
                          r >= range.r1 && r <= range.r2 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {r + 1}
                        </th>
                        {Array.from({ length: active.col_count }, (_, c) => {
                          const key = cell_key(r, c)
                          const raw = active.cells[key] ?? ''
                          const value: CellValue | undefined = values[key]
                          const is_formula = raw.startsWith('=')
                          return (
                            <Cell
                              key={c}
                              r={r}
                              c={c}
                              width={col_width(c)}
                              fill={active.fills[key]}
                              // Typed values show exactly as entered; formulas show their result
                              text={is_formula ? display_value(value) : raw}
                              numeric={typeof value === 'number'}
                              error={value instanceof SheetError}
                              in_range={r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2}
                              active={r === sel.r && c === sel.c}
                              editing={editing?.from === 'cell' && r === sel.r && c === sel.c ? cell_input : null}
                              onMouseDown={on_cell_mouse_down}
                              onMouseEnter={on_cell_mouse_enter}
                              onDoubleClick={on_cell_double_click}
                            />
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-500">
                Click a cell and type, or double-click to edit. Enter and Tab move between cells, Shift + arrows or drag
                to select, Ctrl+C / Ctrl+V to copy and paste (works with Excel and Google Sheets), Delete clears, Ctrl+Z
                undoes. Click a column or row header to select it; drag a column edge to resize it or double-click the
                edge to fit its contents. {active.row_count} rows × {active.col_count} columns.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
