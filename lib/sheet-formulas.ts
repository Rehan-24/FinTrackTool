// Small spreadsheet engine for the Sheets page.
//
// Cells hold raw strings keyed by A1-style address ("B12"). A raw string starting with "=" is a
// formula. Supported: numbers, "text", TRUE/FALSE, cell refs (A1, $A$1), ranges (A1:B5),
// + - * / ^ & = <> < > <= >=, unary minus, postfix %, and the functions in FUNCTIONS below.
// The syntax is a subset of Excel's, so formulas survive an .xlsx export.

export type Cells = Record<string, string>

export class SheetError {
  constructor(public code: '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#CIRC!' | '#ERROR!') {}
  toString() { return this.code }
}

export type CellValue = number | string | boolean | SheetError

// ── addresses ───────────────────────────────────────────────────────────────

export const col_to_index = (col: string) =>
  col.toUpperCase().split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1

export const index_to_col = (index: number) => {
  let s = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

export const cell_key = (row: number, col: number) => `${index_to_col(col)}${row + 1}`

export const parse_key = (key: string) => {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(key)
  if (!m) return null
  const row = Number(m[2]) - 1
  return row < 0 ? null : { row, col: col_to_index(m[1]) }
}

// ── literals ────────────────────────────────────────────────────────────────

const NUMBER_LIKE = /^\s*(-)?\$?((?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?)\s*(%)?\s*$/

/** Numeric value of typed text like "1,234.50", "$20", "-3", "15%", or null if it isn't a number. */
export const parse_number = (raw: string) => {
  const m = NUMBER_LIKE.exec(raw)
  if (!m || m[2] === '' || m[2] === '.') return null
  const n = Number(m[2].replace(/,/g, '')) * (m[1] ? -1 : 1)
  return m[3] ? n / 100 : n
}

// ── tokenizer ───────────────────────────────────────────────────────────────

type Token =
  | { t: 'num', v: number }
  | { t: 'str', v: string }
  | { t: 'ref', v: string }
  | { t: 'id', v: string }
  | { t: 'op', v: string }
  | { t: '(' } | { t: ')' } | { t: ',' } | { t: ':' }

const tokenize = (src: string): Token[] => {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) { i++; continue }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i))
      if (!m) throw new SheetError('#ERROR!')
      tokens.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (ch === '"') {
      let j = i + 1
      let s = ''
      while (j < src.length) {
        if (src[j] === '"' && src[j + 1] === '"') { s += '"'; j += 2; continue }
        if (src[j] === '"') break
        s += src[j++]
      }
      if (j >= src.length) throw new SheetError('#ERROR!')
      tokens.push({ t: 'str', v: s })
      i = j + 1
      continue
    }
    if (/[A-Za-z$_]/.test(ch)) {
      const m = /^[A-Za-z$_][A-Za-z0-9$_.]*/.exec(src.slice(i))!
      const word = m[0]
      tokens.push(/^\$?[A-Za-z]{1,3}\$?\d+$/.test(word) ? { t: 'ref', v: word.replace(/\$/g, '').toUpperCase() } : { t: 'id', v: word.toUpperCase() })
      i += word.length
      continue
    }
    const two = src.slice(i, i + 2)
    if (two === '<=' || two === '>=' || two === '<>') { tokens.push({ t: 'op', v: two }); i += 2; continue }
    if ('+-*/^&=<>%'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue }
    if (ch === '(' || ch === ')' || ch === ',' || ch === ':') { tokens.push({ t: ch }); i++; continue }
    throw new SheetError('#ERROR!')
  }
  return tokens
}

// ── parser (AST) ────────────────────────────────────────────────────────────

type Node =
  | { k: 'lit', v: CellValue }
  | { k: 'ref', key: string }
  | { k: 'range', from: string, to: string }
  | { k: 'unary', op: string, arg: Node }
  | { k: 'bin', op: string, left: Node, right: Node }
  | { k: 'call', name: string, args: Node[] }

// Lowest to highest precedence, matching Excel
const LEVELS = [['=', '<>', '<', '>', '<=', '>='], ['&'], ['+', '-'], ['*', '/'], ['^']]

const parse = (tokens: Token[]): Node => {
  let pos = 0
  const peek = () => tokens[pos]
  const is_op = (ops: string[]) => { const t = peek(); return t?.t === 'op' && ops.includes(t.v) }

  const binary = (level: number): Node => {
    if (level === LEVELS.length) return unary()
    let left = binary(level + 1)
    while (is_op(LEVELS[level])) {
      const op = (tokens[pos++] as { v: string }).v
      left = { k: 'bin', op, left, right: binary(level + 1) }
    }
    return left
  }

  const unary = (): Node => {
    if (is_op(['-', '+'])) {
      const op = (tokens[pos++] as { v: string }).v
      return { k: 'unary', op, arg: unary() }
    }
    let node = primary()
    while (is_op(['%'])) { pos++; node = { k: 'unary', op: '%', arg: node } }
    return node
  }

  const primary = (): Node => {
    const t = tokens[pos++]
    if (!t) throw new SheetError('#ERROR!')
    if (t.t === 'num') return { k: 'lit', v: t.v }
    if (t.t === 'str') return { k: 'lit', v: t.v }
    if (t.t === 'ref') {
      if (peek()?.t === ':') {
        pos++
        const end = tokens[pos++]
        if (end?.t !== 'ref') throw new SheetError('#REF!')
        return { k: 'range', from: t.v, to: end.v }
      }
      return { k: 'ref', key: t.v }
    }
    if (t.t === 'id') {
      if (peek()?.t === '(') {
        pos++
        const args: Node[] = []
        if (peek()?.t !== ')') {
          do { args.push(binary(0)) } while (peek()?.t === ',' && pos++)
        }
        if (tokens[pos++]?.t !== ')') throw new SheetError('#ERROR!')
        return { k: 'call', name: t.v, args }
      }
      if (t.v === 'TRUE') return { k: 'lit', v: true }
      if (t.v === 'FALSE') return { k: 'lit', v: false }
      throw new SheetError('#NAME?')
    }
    if (t.t === '(') {
      const inner = binary(0)
      if (tokens[pos++]?.t !== ')') throw new SheetError('#ERROR!')
      return inner
    }
    throw new SheetError('#ERROR!')
  }

  const node = binary(0)
  if (pos !== tokens.length) throw new SheetError('#ERROR!')
  return node
}

// ── evaluation ──────────────────────────────────────────────────────────────

const to_number = (v: CellValue): number | SheetError => {
  if (v instanceof SheetError) return v
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === '') return 0
  const n = parse_number(v)
  return n === null ? new SheetError('#VALUE!') : n
}

const to_text = (v: CellValue) => (typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? format_number(v) : String(v))

const compare = (op: string, a: CellValue, b: CellValue): boolean => {
  const norm = (v: CellValue) => (typeof v === 'string' ? v.toLowerCase() : v)
  const x = norm(a) as number | string | boolean
  const y = norm(b) as number | string | boolean
  switch (op) {
    case '=': return x === y
    case '<>': return x !== y
    case '<': return x < y
    case '>': return x > y
    case '<=': return x <= y
    default: return x >= y
  }
}

type Arg = CellValue | CellValue[] // a range evaluates to a flat list

// Numbers from arguments: range cells that aren't numbers are skipped (as in Excel); direct args are coerced
const numbers_of = (args: Arg[]): number[] | SheetError => {
  const out: number[] = []
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const v of a) {
        if (v instanceof SheetError) return v
        if (typeof v === 'number') out.push(v)
      }
    } else {
      const n = to_number(a)
      if (n instanceof SheetError) return n
      out.push(n)
    }
  }
  return out
}

const FUNCTIONS: Record<string, (args: Arg[]) => CellValue> = {
  SUM: args => { const n = numbers_of(args); return n instanceof SheetError ? n : n.reduce((s, x) => s + x, 0) },
  AVERAGE: args => {
    const n = numbers_of(args)
    if (n instanceof SheetError) return n
    return n.length ? n.reduce((s, x) => s + x, 0) / n.length : new SheetError('#DIV/0!')
  },
  MIN: args => { const n = numbers_of(args); return n instanceof SheetError ? n : n.length ? Math.min(...n) : 0 },
  MAX: args => { const n = numbers_of(args); return n instanceof SheetError ? n : n.length ? Math.max(...n) : 0 },
  COUNT: args => args.reduce<number>((c, a) => c + (Array.isArray(a) ? a.filter(v => typeof v === 'number').length : typeof a === 'number' ? 1 : 0), 0),
  ROUND: args => {
    const [x, d = 0] = args.map(a => (Array.isArray(a) ? new SheetError('#VALUE!') : to_number(a)))
    if (x instanceof SheetError) return x
    if (d instanceof SheetError) return d
    const f = 10 ** Math.trunc(d)
    return Math.round(x * f) / f
  },
  ABS: args => {
    const x = Array.isArray(args[0]) ? new SheetError('#VALUE!') : to_number(args[0] ?? 0)
    return x instanceof SheetError ? x : Math.abs(x)
  },
}

export const SUPPORTED_FUNCTIONS = [...Object.keys(FUNCTIONS), 'IF']

const MAX_RANGE_CELLS = 100000

/** Evaluate every non-empty cell. Formulas that reference each other are resolved on demand. */
export const evaluate_sheet = (cells: Cells): Record<string, CellValue> => {
  const results: Record<string, CellValue> = {}
  const in_progress = new Set<string>()

  const value_of = (key: string): CellValue => {
    if (key in results) return results[key]
    const raw = cells[key]
    if (raw === undefined || raw === '') return ''
    if (!raw.startsWith('=')) {
      const n = parse_number(raw)
      return (results[key] = n === null ? raw : n)
    }
    if (in_progress.has(key)) return new SheetError('#CIRC!')
    in_progress.add(key)
    let v: CellValue
    try {
      v = evaluate(parse(tokenize(raw.slice(1))))
    } catch (err) {
      v = err instanceof SheetError ? err : new SheetError('#ERROR!')
    }
    in_progress.delete(key)
    return (results[key] = v)
  }

  const range_values = (from: string, to: string): CellValue[] | SheetError => {
    const a = parse_key(from)
    const b = parse_key(to)
    if (!a || !b) return new SheetError('#REF!')
    const [r1, r2] = [Math.min(a.row, b.row), Math.max(a.row, b.row)]
    const [c1, c2] = [Math.min(a.col, b.col), Math.max(a.col, b.col)]
    if ((r2 - r1 + 1) * (c2 - c1 + 1) > MAX_RANGE_CELLS) return new SheetError('#REF!')
    const out: CellValue[] = []
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(value_of(cell_key(r, c)))
    return out
  }

  const evaluate = (node: Node): CellValue => {
    switch (node.k) {
      case 'lit': return node.v
      case 'ref': return parse_key(node.key) ? value_of(node.key) : new SheetError('#REF!')
      case 'range': return new SheetError('#VALUE!') // a bare range outside a function
      case 'unary': {
        const n = to_number(evaluate(node.arg))
        if (n instanceof SheetError) return n
        return node.op === '-' ? -n : node.op === '%' ? n / 100 : n
      }
      case 'bin': {
        const left = evaluate(node.left)
        const right = evaluate(node.right)
        if (left instanceof SheetError) return left
        if (right instanceof SheetError) return right
        if (node.op === '&') return to_text(left) + to_text(right)
        if (LEVELS[0].includes(node.op)) return compare(node.op, left, right)
        const x = to_number(left)
        const y = to_number(right)
        if (x instanceof SheetError) return x
        if (y instanceof SheetError) return y
        switch (node.op) {
          case '+': return x + y
          case '-': return x - y
          case '*': return x * y
          case '/': return y === 0 ? new SheetError('#DIV/0!') : x / y
          default: return x ** y
        }
      }
      case 'call': {
        if (node.name === 'IF') {
          // Only the chosen branch is evaluated, like Excel
          const cond = evaluate(node.args[0] ?? { k: 'lit', v: false })
          if (cond instanceof SheetError) return cond
          const truthy = typeof cond === 'string' ? cond !== '' : Boolean(cond)
          const branch = truthy ? node.args[1] : node.args[2]
          return branch ? evaluate(branch) : truthy
        }
        const fn = FUNCTIONS[node.name]
        if (!fn) return new SheetError('#NAME?')
        const args: Arg[] = []
        for (const a of node.args) {
          const v = a.k === 'range' ? range_values(a.from, a.to) : evaluate(a)
          if (v instanceof SheetError) return v
          args.push(v)
        }
        return fn(args)
      }
    }
  }

  for (const key of Object.keys(cells)) value_of(key)
  return results
}

/** Display text for a computed number: up to 10 decimal places, no float noise, thousands separators. */
export const format_number = (n: number) => {
  if (!Number.isFinite(n)) return '#VALUE!'
  return Number(n.toPrecision(15)).toLocaleString('en-US', { maximumFractionDigits: 10 })
}

export const display_value = (v: CellValue | undefined) => {
  if (v === undefined) return ''
  if (typeof v === 'number') return format_number(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}
