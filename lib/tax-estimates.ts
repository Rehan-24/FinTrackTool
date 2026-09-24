// Paycheck tax estimates for the salary calculator.
//
// All figures are for tax year 2026 and need updating each year:
// - Federal brackets / standard deductions: IRS Rev. Proc. 2025-32
// - State brackets, standard deductions, exemptions, credits: Tax Foundation,
//   "2026 State Income Tax Rates and Brackets"
// - Social Security wage base ($184,500) and state disability / paid leave
//   employee rates: SSA and state agency announcements for 2026
//
// These are estimates: they use standard deductions only and ignore dependents,
// itemized deductions, most credits, phase-outs (except CT's exemption) and any
// local tax other than New York City and Yonkers.

export const TAX_YEAR = 2026

export type FilingStatus = 'single' | 'mfj' | 'hoh'

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  hoh: 'Head of household',
}

// [threshold, rate]: `rate` applies to taxable income above `threshold`
type Brackets = [number, number][]

const bracket_tax = (income: number, brackets: Brackets) => {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const [floor, rate] = brackets[i]
    const ceiling = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity
    if (income <= floor) break
    tax += (Math.min(income, ceiling) - floor) * rate
  }
  return tax
}

// ── federal ─────────────────────────────────────────────────────────────────

const FEDERAL: Record<FilingStatus, { std: number, brackets: Brackets }> = {
  single: {
    std: 16100,
    brackets: [[0, 0.10], [12400, 0.12], [50400, 0.22], [105700, 0.24], [201775, 0.32], [256225, 0.35], [640600, 0.37]],
  },
  mfj: {
    std: 32200,
    brackets: [[0, 0.10], [24800, 0.12], [100800, 0.22], [211400, 0.24], [403550, 0.32], [512450, 0.35], [768700, 0.37]],
  },
  hoh: {
    std: 24150,
    brackets: [[0, 0.10], [17700, 0.12], [67450, 0.22], [105700, 0.24], [201775, 0.32], [256200, 0.35], [640600, 0.37]],
  },
}

/** Federal income tax on wages after pre-tax deductions, using the standard deduction. */
export const federal_income_tax = (income_after_pretax: number, status: FilingStatus) => {
  const { std, brackets } = FEDERAL[status]
  return bracket_tax(Math.max(0, income_after_pretax - std), brackets)
}

// ── state ───────────────────────────────────────────────────────────────────

type StateTax = {
  single: Brackets
  mfj?: Brackets // defaults to single
  std?: [number, number] // [single, joint]
  exemption?: [number, number]
  credit?: [number, number] // subtracted from the tax, not from income
}

// Head of household uses the single figures, which is a close approximation for most states.
const STATE_TAX: Record<string, StateTax | null> = {
  AK: null, FL: null, NV: null, NH: null, SD: null, TN: null, TX: null, WA: null, WY: null,
  AL: {
    single: [[0, 0.02], [500, 0.04], [3000, 0.05]],
    mfj: [[0, 0.02], [1000, 0.04], [6000, 0.05]],
    std: [3000, 8500], exemption: [1500, 3000],
  },
  AZ: { single: [[0, 0.025]], std: [8350, 16700] },
  AR: { single: [[0, 0.02], [4600, 0.039]], std: [2470, 4940], credit: [29, 58] },
  CA: {
    single: [[0, 0.01], [11079, 0.02], [26264, 0.04], [41452, 0.06], [57542, 0.08], [72724, 0.093],
      [371479, 0.103], [445771, 0.113], [742953, 0.123], [1000000, 0.133]],
    mfj: [[0, 0.01], [22158, 0.02], [52528, 0.04], [82904, 0.06], [115084, 0.08], [145448, 0.093],
      [742958, 0.103], [891542, 0.113], [1000000, 0.123], [1485906, 0.133]],
    std: [5540, 11080], credit: [153, 306],
  },
  CO: { single: [[0, 0.044]], std: [16100, 32200] },
  CT: {
    single: [[0, 0.02], [10000, 0.045], [50000, 0.055], [100000, 0.06], [200000, 0.065], [250000, 0.069], [500000, 0.0699]],
    mfj: [[0, 0.02], [20000, 0.045], [100000, 0.055], [200000, 0.06], [400000, 0.065], [500000, 0.069], [1000000, 0.0699]],
    exemption: [15000, 24000], // phased out below, see state_income_tax
  },
  DE: {
    single: [[0, 0], [2000, 0.022], [5000, 0.039], [10000, 0.048], [20000, 0.052], [25000, 0.0555], [60000, 0.066]],
    std: [3250, 6500], credit: [110, 220],
  },
  DC: {
    single: [[0, 0.04], [10000, 0.06], [40000, 0.065], [60000, 0.085], [250000, 0.0925], [500000, 0.0975], [1000000, 0.1075]],
    std: [16100, 32200],
  },
  GA: { single: [[0, 0.0519]], std: [12000, 24000] },
  HI: {
    single: [[0, 0.014], [9600, 0.032], [14400, 0.055], [19200, 0.064], [24000, 0.068], [36000, 0.072], [48000, 0.076],
      [125000, 0.079], [175000, 0.0825], [225000, 0.09], [275000, 0.10], [325000, 0.11]],
    mfj: [[0, 0.014], [19200, 0.032], [28800, 0.055], [38400, 0.064], [48000, 0.068], [72000, 0.072], [96000, 0.076],
      [250000, 0.079], [350000, 0.0825], [450000, 0.09], [550000, 0.10], [650000, 0.11]],
    std: [4400, 8800], exemption: [1144, 2288],
  },
  ID: { single: [[0, 0], [4811, 0.053]], mfj: [[0, 0], [9622, 0.053]], std: [16100, 32200] },
  IL: { single: [[0, 0.0495]], exemption: [2925, 5850] },
  IN: { single: [[0, 0.0295]], exemption: [1000, 2000] },
  IA: { single: [[0, 0.038]], std: [16100, 32200], credit: [40, 80] },
  KS: { single: [[0, 0.052], [23000, 0.0558]], mfj: [[0, 0.052], [46000, 0.0558]], std: [3605, 8240], exemption: [9160, 18320] },
  KY: { single: [[0, 0.035]], std: [3360, 3360] },
  LA: { single: [[0, 0.03]], std: [12875, 25750] },
  ME: {
    single: [[0, 0.058], [27399, 0.0675], [64849, 0.0715]],
    mfj: [[0, 0.058], [54849, 0.0675], [129749, 0.0715]],
    std: [8350, 16700], exemption: [5300, 10600],
  },
  MD: {
    single: [[0, 0.02], [1000, 0.03], [2000, 0.04], [3000, 0.0475], [100000, 0.05], [125000, 0.0525], [150000, 0.055],
      [250000, 0.0575], [500000, 0.0625], [1000000, 0.065]],
    mfj: [[0, 0.02], [1000, 0.03], [2000, 0.04], [3000, 0.0475], [150000, 0.05], [175000, 0.0525], [225000, 0.055],
      [300000, 0.0575], [600000, 0.0625], [1200000, 0.065]],
    std: [3350, 6700], exemption: [3200, 6400],
  },
  MA: { single: [[0, 0.05], [1083150, 0.09]], exemption: [4400, 8800] },
  MI: { single: [[0, 0.0425]], exemption: [5900, 11800] },
  MN: {
    single: [[0, 0.0535], [33310, 0.068], [109430, 0.0785], [203150, 0.0985]],
    mfj: [[0, 0.0535], [48700, 0.068], [193480, 0.0785], [337930, 0.0985]],
    std: [15300, 30600],
  },
  MS: { single: [[0, 0], [10000, 0.04]], std: [2300, 4600], exemption: [6000, 12000] },
  MO: {
    single: [[0, 0], [1348, 0.02], [2696, 0.025], [4044, 0.03], [5392, 0.035], [6740, 0.04], [8088, 0.045], [9436, 0.047]],
    std: [16100, 32200],
  },
  MT: { single: [[0, 0.047], [47500, 0.0565]], mfj: [[0, 0.047], [95000, 0.0565]], std: [16100, 32200] },
  NE: {
    single: [[0, 0.0246], [4130, 0.0351], [24760, 0.0455]],
    mfj: [[0, 0.0246], [8250, 0.0351], [49530, 0.0455]],
    std: [8850, 17700], credit: [176, 352],
  },
  NJ: {
    single: [[0, 0.014], [20000, 0.0175], [35000, 0.035], [40000, 0.05525], [75000, 0.0637], [500000, 0.0897], [1000000, 0.1075]],
    mfj: [[0, 0.014], [20000, 0.0175], [50000, 0.0245], [70000, 0.035], [80000, 0.05525], [150000, 0.0637], [500000, 0.0897], [1000000, 0.1075]],
    exemption: [1000, 2000],
  },
  NM: {
    single: [[0, 0.015], [5500, 0.032], [16500, 0.043], [33500, 0.047], [66500, 0.049], [210000, 0.059]],
    mfj: [[0, 0.015], [8000, 0.032], [25000, 0.043], [50000, 0.047], [100000, 0.049], [315000, 0.059]],
    std: [16100, 32200],
  },
  NY: {
    single: [[0, 0.039], [8500, 0.044], [11700, 0.0515], [13900, 0.054], [80650, 0.059], [215400, 0.0685],
      [1077550, 0.0965], [5000000, 0.103], [25000000, 0.109]],
    mfj: [[0, 0.039], [17150, 0.044], [23600, 0.0515], [27900, 0.054], [161550, 0.059], [323200, 0.0685],
      [2155350, 0.0965], [5000000, 0.103], [25000000, 0.109]],
    std: [8000, 16050],
  },
  NC: { single: [[0, 0.0399]], std: [12750, 25500] },
  ND: { single: [[0, 0], [48475, 0.0195], [244825, 0.025]], mfj: [[0, 0], [80975, 0.0195], [298075, 0.025]], std: [16100, 32200] },
  OH: { single: [[0, 0], [26050, 0.0275]], exemption: [2400, 4800] },
  OK: {
    single: [[0, 0], [3750, 0.025], [4900, 0.035], [7200, 0.045]],
    mfj: [[0, 0], [7500, 0.025], [9800, 0.035], [14400, 0.045]],
    std: [6350, 12700], exemption: [1000, 2000],
  },
  OR: {
    single: [[0, 0.0475], [4550, 0.0675], [11400, 0.0875], [125000, 0.099]],
    mfj: [[0, 0.0475], [9100, 0.0675], [22800, 0.0875], [250000, 0.099]],
    std: [2910, 5820], credit: [256, 512],
  },
  PA: { single: [[0, 0.0307]] },
  RI: { single: [[0, 0.0375], [82050, 0.0475], [186450, 0.0599]], std: [11200, 22400], exemption: [5250, 10500] },
  SC: { single: [[0, 0], [3640, 0.03], [18230, 0.06]], std: [8350, 16700] },
  UT: { single: [[0, 0.045]], credit: [966, 1932] },
  VT: {
    single: [[0, 0.0335], [49400, 0.066], [119700, 0.076], [249700, 0.0875]],
    mfj: [[0, 0.0335], [82500, 0.066], [199450, 0.076], [304000, 0.0875]],
    std: [7650, 15300], exemption: [5300, 10600],
  },
  VA: { single: [[0, 0.02], [3000, 0.03], [5000, 0.05], [17000, 0.0575]], std: [8750, 17500], exemption: [930, 1860] },
  WV: { single: [[0, 0.0222], [10000, 0.0296], [25000, 0.0333], [40000, 0.0444], [60000, 0.0482]], exemption: [2000, 4000] },
  WI: {
    single: [[0, 0.035], [15110, 0.044], [51950, 0.053], [332720, 0.0765]],
    mfj: [[0, 0.035], [20150, 0.044], [69260, 0.053], [443630, 0.0765]],
    std: [13960, 25840], exemption: [700, 1400],
  },
}

/**
 * Wages a state taxes, starting from gross minus federal pre-tax deductions. Some states don't
 * follow the federal exclusions: California and New Jersey tax HSA contributions, and
 * Pennsylvania taxes 401k deferrals. Returns the wages plus a note on what was added back.
 */
export const state_taxable_wages = (
  state: string,
  income_after_pretax: number,
  pretax: { hsa: number, retirement_401k: number },
) => {
  if ((state === 'CA' || state === 'NJ') && pretax.hsa > 0) {
    return { wages: income_after_pretax + pretax.hsa, note: `${state} taxes HSA contributions, so they were added back` }
  }
  if (state === 'PA' && pretax.retirement_401k > 0) {
    return { wages: income_after_pretax + pretax.retirement_401k, note: 'PA taxes 401k contributions, so they were added back' }
  }
  return { wages: income_after_pretax, note: null }
}

/** State income tax on the wages from state_taxable_wages. Returns null for an unknown state code. */
export const state_income_tax = (state: string, income_after_pretax: number, status: FilingStatus) => {
  if (!(state in STATE_TAX)) return null
  const cfg = STATE_TAX[state]
  if (!cfg) return 0

  const joint = status === 'mfj'
  const pick = (pair?: [number, number]) => (pair ? pair[joint ? 1 : 0] : 0)
  let exemption = pick(cfg.exemption)

  // Connecticut's personal exemption shrinks $1,000 for every $1,000 of income over the threshold
  if (state === 'CT') {
    const phase_start = joint ? 48000 : 30000
    exemption = Math.max(0, exemption - Math.ceil(Math.max(0, income_after_pretax - phase_start) / 1000) * 1000)
  }

  const taxable = Math.max(0, income_after_pretax - pick(cfg.std) - exemption)
  const brackets = joint && cfg.mfj ? cfg.mfj : cfg.single
  return Math.max(0, bracket_tax(taxable, brackets) - pick(cfg.credit))
}

// ── local ───────────────────────────────────────────────────────────────────

const NYC_BRACKETS: Record<'single' | 'mfj', Brackets> = {
  single: [[0, 0.03078], [12000, 0.03762], [25000, 0.03819], [50000, 0.03876]],
  mfj: [[0, 0.03078], [21600, 0.03762], [45000, 0.03819], [90000, 0.03876]],
}

const is_nyc_zip = (zip: string) => {
  const prefix = Number(zip.slice(0, 3))
  return (prefix >= 100 && prefix <= 104) || (prefix >= 111 && prefix <= 114) || prefix === 116
}
const is_yonkers_zip = (zip: string) => Number(zip) >= 10701 && Number(zip) <= 10710

/**
 * Local income tax for supported areas (NYC and Yonkers). Returns null when the ZIP isn't in a
 * supported area, so the caller can leave the field for the user to fill in.
 */
export const local_income_tax = (zip: string, income_after_pretax: number, status: FilingStatus) => {
  const ny = STATE_TAX.NY!
  const joint = status === 'mfj'
  const ny_taxable = Math.max(0, income_after_pretax - ny.std![joint ? 1 : 0])

  if (is_nyc_zip(zip)) return { area: 'New York City', tax: bracket_tax(ny_taxable, NYC_BRACKETS[joint ? 'mfj' : 'single']) }
  if (is_yonkers_zip(zip)) {
    // Yonkers residents pay a surcharge of 16.75% of their New York State tax
    return { area: 'Yonkers', tax: 0.1675 * bracket_tax(ny_taxable, joint && ny.mfj ? ny.mfj : ny.single) }
  }
  return null
}

// ── payroll (FICA and state programs) ───────────────────────────────────────

export const SS_RATE = 0.062
export const SS_WAGE_BASE = 184500
export const MEDICARE_RATE = 0.0145
export const ADDITIONAL_MEDICARE_RATE = 0.009
export const ADDITIONAL_MEDICARE_THRESHOLD = 200000 // employers withhold above this regardless of filing status

type PayrollItem = { name: string, rate: number, wage_cap?: number, max?: number }

// Employee-paid state disability / paid leave programs, split into the calculator's
// "State disability" and "State etc" fields.
const STATE_PAYROLL: Record<string, { disability?: PayrollItem[], other?: PayrollItem[] }> = {
  CA: { disability: [{ name: 'SDI', rate: 0.013 }] },
  CO: { disability: [{ name: 'FAMLI', rate: 0.0044, wage_cap: SS_WAGE_BASE }] },
  CT: { disability: [{ name: 'Paid Leave', rate: 0.005, wage_cap: SS_WAGE_BASE }] },
  DE: { disability: [{ name: 'Paid Leave (estimate)', rate: 0.002, wage_cap: SS_WAGE_BASE }] },
  HI: { disability: [{ name: 'TDI (estimate)', rate: 0.005, max: 385 }] },
  MA: { disability: [{ name: 'PFML', rate: 0.0046, wage_cap: SS_WAGE_BASE }] },
  ME: { disability: [{ name: 'Paid Leave', rate: 0.005, wage_cap: SS_WAGE_BASE }] },
  MN: { disability: [{ name: 'Paid Leave', rate: 0.0044, wage_cap: SS_WAGE_BASE }] },
  NJ: {
    disability: [{ name: 'TDI', rate: 0.0019, wage_cap: 171100 }],
    other: [
      { name: 'FLI', rate: 0.0023, wage_cap: 171100 },
      { name: 'UI/WF (estimate)', rate: 0.00425, wage_cap: 44800 },
    ],
  },
  NY: {
    disability: [{ name: 'SDI', rate: 0.005, max: 31.2 }],
    other: [{ name: 'PFL', rate: 0.00432, max: 411.91 }],
  },
  OR: {
    disability: [{ name: 'Paid Leave', rate: 0.006, wage_cap: SS_WAGE_BASE }],
    other: [{ name: 'Statewide transit tax', rate: 0.001 }],
  },
  PA: { other: [{ name: 'UI', rate: 0.0007 }] },
  RI: { disability: [{ name: 'TDI', rate: 0.011, wage_cap: 100000 }] },
  WA: {
    disability: [{ name: 'PFML', rate: 0.0113 * 0.7143, wage_cap: SS_WAGE_BASE }],
    other: [{ name: 'WA Cares', rate: 0.0058 }],
  },
}

const payroll_amount = (wages: number, items: PayrollItem[] = []) =>
  items.reduce((sum, i) => {
    const amount = Math.min(wages, i.wage_cap ?? Infinity) * i.rate
    return sum + Math.min(amount, i.max ?? Infinity)
  }, 0)

/** Yearly FICA and state payroll deductions on FICA wages (gross minus cafeteria-plan deductions). */
export const payroll_taxes = (state: string, fica_wages: number) => {
  const programs = STATE_PAYROLL[state] || {}
  return {
    social_security: Math.min(fica_wages, SS_WAGE_BASE) * SS_RATE,
    medicare: fica_wages * MEDICARE_RATE + Math.max(0, fica_wages - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE,
    state_disability: payroll_amount(fica_wages, programs.disability),
    state_other: payroll_amount(fica_wages, programs.other),
    programs: [...(programs.disability || []), ...(programs.other || [])].map(p => p.name),
  }
}

// ── ZIP → state ─────────────────────────────────────────────────────────────

// First-three-digit ZIP ranges, [from, to, state]
const ZIP3_RANGES: [number, number, string][] = [
  [5, 5, 'NY'], [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'], [50, 54, 'VT'], [55, 55, 'MA'],
  [56, 59, 'VT'], [60, 69, 'CT'], [70, 89, 'NJ'], [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'],
  [200, 200, 'DC'], [201, 201, 'VA'], [202, 205, 'DC'], [206, 219, 'MD'], [220, 246, 'VA'], [247, 268, 'WV'],
  [270, 289, 'NC'], [290, 299, 'SC'], [300, 319, 'GA'], [320, 349, 'FL'], [350, 369, 'AL'], [370, 385, 'TN'],
  [386, 397, 'MS'], [398, 399, 'GA'], [400, 427, 'KY'], [430, 459, 'OH'], [460, 479, 'IN'], [480, 499, 'MI'],
  [500, 528, 'IA'], [530, 549, 'WI'], [550, 567, 'MN'], [569, 569, 'DC'], [570, 577, 'SD'], [580, 588, 'ND'],
  [590, 599, 'MT'], [600, 629, 'IL'], [630, 658, 'MO'], [660, 679, 'KS'], [680, 693, 'NE'], [700, 714, 'LA'],
  [716, 729, 'AR'], [730, 732, 'OK'], [733, 733, 'TX'], [734, 749, 'OK'], [750, 799, 'TX'], [800, 816, 'CO'],
  [820, 831, 'WY'], [832, 838, 'ID'], [840, 847, 'UT'], [850, 865, 'AZ'], [870, 884, 'NM'], [885, 885, 'TX'],
  [889, 898, 'NV'], [900, 961, 'CA'], [967, 968, 'HI'], [970, 979, 'OR'], [980, 994, 'WA'], [995, 999, 'AK'],
]

/** Two-letter state code for a 5-digit US ZIP, or null if it isn't a recognised state ZIP. */
export const zip_to_state = (zip: string) => {
  if (!/^\d{5}$/.test(zip)) return null
  const prefix = Number(zip.slice(0, 3))
  return ZIP3_RANGES.find(([from, to]) => prefix >= from && prefix <= to)?.[2] ?? null
}
