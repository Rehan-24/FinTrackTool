'use client'

import { useState, useEffect } from 'react'

type SalaryCalculation = {
  gross_yearly: number
  gross_monthly: number
  gross_weekly: number
  gross_biweekly: number
  
  deductions: {
    pre_tax: {
      '401k': number
      '401k_roth': number
      hsa: number
      medical_ins: number
      dental_ins: number
      vision_ins: number
    }
    taxes: {
      federal: number
      state: number
      fica: number
      social_security: number
      medicare: number
      ca_disability: number
    }
    after_tax: {
      '401k_after': number
      '401k_roth_after': number
      life_ins: number
      ad_d: number
      critical_illness: number
      hospital_indem: number
      accident_ins: number
      legal_plan: number
      identity_theft: number
    }
  }
  
  net_pay: {
    yearly: number
    monthly: number
    weekly: number
    biweekly: number
  }
}

type SalaryInputProps = {
  on_calculate: (calc: SalaryCalculation) => void
}

export default function SalaryCalculator({ on_calculate }: SalaryInputProps) {
  const [gross_salary, setGrossSalary] = useState('')
  
  // Pre-tax deductions (percentages)
  const [k401_pct, set401kPct] = useState('4.00')
  const [k401_roth_pct, set401kRothPct] = useState('2.00')
  
  // Pre-tax deductions (fixed amounts - monthly)
  const [hsa_monthly, setHsaMonthly] = useState('211.52')
  const [medical_monthly, setMedicalMonthly] = useState('103.38')
  const [dental_monthly, setDentalMonthly] = useState('12.00')
  const [vision_monthly, setVisionMonthly] = useState('15.34')
  
  // Tax rates
  const [federal_tax_pct, setFederalTaxPct] = useState('13.46')
  const [state_tax_pct, setStateTaxPct] = useState('5.90')
  const [ca_disability_pct, setCaDisabilityPct] = useState('1.20')
  
  // After-tax deductions (percentages)
  const [k401_after_pct, set401kAfterPct] = useState('1.00')
  const [k401_roth_after_pct, set401kRothAfterPct] = useState('0.00')
  
  // After-tax deductions (fixed amounts - monthly)
  const [life_ins_monthly, setLifeInsMonthly] = useState('3.38')
  const [ad_d_monthly, setAdDMonthly] = useState('13.18')
  const [critical_illness_monthly, setCriticalIllnessMonthly] = useState('4.56')
  const [hospital_monthly, setHospitalMonthly] = useState('10.94')
  const [accident_monthly, setAccidentMonthly] = useState('6.36')
  const [legal_monthly, setLegalMonthly] = useState('6.24')
  const [identity_theft_monthly, setIdentityTheftMonthly] = useState('6.00')

  const calculate = () => {
    const yearly = parseFloat(gross_salary) || 0
    if (yearly === 0) return null

    const monthly = yearly / 12
    const weekly = yearly / 52
    const biweekly = yearly / 26

    // Calculate pre-tax deductions
    const k401_yearly = yearly * (parseFloat(k401_pct) / 100)
    const k401_roth_yearly = yearly * (parseFloat(k401_roth_pct) / 100)
    const hsa_yearly = parseFloat(hsa_monthly) * 12
    const medical_yearly = parseFloat(medical_monthly) * 12
    const dental_yearly = parseFloat(dental_monthly) * 12
    const vision_yearly = parseFloat(vision_monthly) * 12

    const total_pre_tax = k401_yearly + k401_roth_yearly + hsa_yearly + medical_yearly + dental_yearly + vision_yearly

    // Taxable income after pre-tax deductions
    const taxable_income = yearly - total_pre_tax

    // Calculate taxes
    const federal_tax = taxable_income * (parseFloat(federal_tax_pct) / 100)
    const state_tax = taxable_income * (parseFloat(state_tax_pct) / 100)
    
    // FICA taxes (on original gross, not after pre-tax deductions)
    const social_security = Math.min(yearly * 0.062, 160200 * 0.062) // SS cap
    const medicare = yearly * 0.0145
    const ca_disability = yearly * (parseFloat(ca_disability_pct) / 100)
    const fica_total = social_security + medicare
    
    const total_taxes = federal_tax + state_tax + social_security + medicare + ca_disability

    // Income after pre-tax deductions and taxes
    const after_tax_income = yearly - total_pre_tax - total_taxes

    // Calculate after-tax deductions
    const k401_after_yearly = after_tax_income * (parseFloat(k401_after_pct) / 100)
    const k401_roth_after_yearly = after_tax_income * (parseFloat(k401_roth_after_pct) / 100)
    const life_ins_yearly = parseFloat(life_ins_monthly) * 12
    const ad_d_yearly = parseFloat(ad_d_monthly) * 12
    const critical_illness_yearly = parseFloat(critical_illness_monthly) * 12
    const hospital_yearly = parseFloat(hospital_monthly) * 12
    const accident_yearly = parseFloat(accident_monthly) * 12
    const legal_yearly = parseFloat(legal_monthly) * 12
    const identity_theft_yearly = parseFloat(identity_theft_monthly) * 12

    const total_after_tax = k401_after_yearly + k401_roth_after_yearly + life_ins_yearly + 
      ad_d_yearly + critical_illness_yearly + hospital_yearly + accident_yearly + legal_yearly + identity_theft_yearly

    // Final take-home
    const net_yearly = after_tax_income - total_after_tax
    const net_monthly = net_yearly / 12
    const net_weekly = net_yearly / 52
    const net_biweekly = net_yearly / 26

    const calculation: SalaryCalculation = {
      gross_yearly: yearly,
      gross_monthly: monthly,
      gross_weekly: weekly,
      gross_biweekly: biweekly,
      deductions: {
        pre_tax: {
          '401k': k401_yearly,
          '401k_roth': k401_roth_yearly,
          hsa: hsa_yearly,
          medical_ins: medical_yearly,
          dental_ins: dental_yearly,
          vision_ins: vision_yearly,
        },
        taxes: {
          federal: federal_tax,
          state: state_tax,
          fica: fica_total,
          social_security: social_security,
          medicare: medicare,
          ca_disability: ca_disability,
        },
        after_tax: {
          '401k_after': k401_after_yearly,
          '401k_roth_after': k401_roth_after_yearly,
          life_ins: life_ins_yearly,
          ad_d: ad_d_yearly,
          critical_illness: critical_illness_yearly,
          hospital_indem: hospital_yearly,
          accident_ins: accident_yearly,
          legal_plan: legal_yearly,
          identity_theft: identity_theft_yearly,
        },
      },
      net_pay: {
        yearly: net_yearly,
        monthly: net_monthly,
        weekly: net_weekly,
        biweekly: net_biweekly,
      },
    }

    return calculation
  }

  useEffect(() => {
    const calc = calculate()
    if (calc) {
      on_calculate(calc)
    }
  }, [gross_salary, k401_pct, k401_roth_pct, hsa_monthly, medical_monthly, dental_monthly, vision_monthly,
      federal_tax_pct, state_tax_pct, ca_disability_pct, k401_after_pct, k401_roth_after_pct,
      life_ins_monthly, ad_d_monthly, critical_illness_monthly, hospital_monthly, accident_monthly,
      legal_monthly, identity_theft_monthly])

  const calc = calculate()
  const total_pre_tax = calc ? Object.values(calc.deductions.pre_tax).reduce((a, b) => a + b, 0) : 0
  const total_taxes = calc ? Object.values(calc.deductions.taxes).reduce((a, b) => a + b, 0) : 0
  const total_after_tax = calc ? Object.values(calc.deductions.after_tax).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200 space-y-6">
      <div className="text-lg font-semibold text-gray-800 mb-4">Salary Calculator</div>

      {/* Gross Salary Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Yearly Gross Salary
        </label>
        <div className="relative">
          <span className="absolute left-3 top-3 text-gray-500">$</span>
          <input
            type="number"
            step="0.01"
            value={gross_salary}
            onChange={(e) => setGrossSalary(e.target.value)}
            placeholder="105800.00"
            className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {calc && (
        <div className="space-y-6">
          {/* Gross Pay Summary */}
          <div className="bg-white rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Yearly</div>
                <div className="font-bold text-lg">${calc.gross_yearly.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Monthly</div>
                <div className="font-bold text-lg">${calc.gross_monthly.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Weekly</div>
                <div className="font-bold text-lg">${calc.gross_weekly.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Bi-Weekly</div>
                <div className="font-bold text-lg">${calc.gross_biweekly.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Pre-Tax Deductions */}
          <div className="space-y-3">
            <div className="font-semibold text-gray-800">Pre-Tax Deductions</div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">401k %</label>
                <input
                  type="number"
                  step="0.01"
                  value={k401_pct}
                  onChange={(e) => set401kPct(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">401k Roth %</label>
                <input
                  type="number"
                  step="0.01"
                  value={k401_roth_pct}
                  onChange={(e) => set401kRothPct(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">HSA (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={hsa_monthly}
                  onChange={(e) => setHsaMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Medical Ins (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={medical_monthly}
                  onChange={(e) => setMedicalMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Dental Ins (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={dental_monthly}
                  onChange={(e) => setDentalMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Vision Ins (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={vision_monthly}
                  onChange={(e) => setVisionMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
            </div>
            <div className="text-right text-sm font-semibold">
              Total: ${total_pre_tax.toFixed(2)}/year
            </div>
          </div>

          {/* Taxes */}
          <div className="space-y-3">
            <div className="font-semibold text-gray-800">Taxes</div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Federal Tax %</label>
                <input
                  type="number"
                  step="0.01"
                  value={federal_tax_pct}
                  onChange={(e) => setFederalTaxPct(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">State Tax %</label>
                <input
                  type="number"
                  step="0.01"
                  value={state_tax_pct}
                  onChange={(e) => setStateTaxPct(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">CA Disability %</label>
                <input
                  type="number"
                  step="0.01"
                  value={ca_disability_pct}
                  onChange={(e) => setCaDisabilityPct(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className="text-xs text-gray-600">FICA (Auto)</div>
                <div className="text-sm font-medium">${calc.deductions.taxes.fica.toFixed(2)}</div>
              </div>
            </div>
            <div className="text-sm space-y-1 bg-gray-50 p-2 rounded">
              <div className="flex justify-between">
                <span className="text-gray-600">Social Security (6.2%):</span>
                <span>${calc.deductions.taxes.social_security.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Medicare (1.45%):</span>
                <span>${calc.deductions.taxes.medicare.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-right text-sm font-semibold">
              Total Taxes: ${total_taxes.toFixed(2)}/year
            </div>
          </div>

          {/* After-Tax Deductions */}
          <div className="space-y-3">
            <div className="font-semibold text-gray-800">After-Tax Deductions</div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">401k After Tax %</label>
                <input
                  type="number"
                  step="0.01"
                  value={k401_after_pct}
                  onChange={(e) => set401kAfterPct(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Life Ins (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={life_ins_monthly}
                  onChange={(e) => setLifeInsMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">AD&D (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={ad_d_monthly}
                  onChange={(e) => setAdDMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Critical Illness (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={critical_illness_monthly}
                  onChange={(e) => setCriticalIllnessMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hospital Indem (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={hospital_monthly}
                  onChange={(e) => setHospitalMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Accident Ins (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={accident_monthly}
                  onChange={(e) => setAccidentMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Legal Plan (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={legal_monthly}
                  onChange={(e) => setLegalMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Identity Theft (monthly)</label>
                <input
                  type="number"
                  step="0.01"
                  value={identity_theft_monthly}
                  onChange={(e) => setIdentityTheftMonthly(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
            </div>
            <div className="text-right text-sm font-semibold">
              Total: ${total_after_tax.toFixed(2)}/year
            </div>
          </div>

          {/* Net Take Home - HIGHLIGHT */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg p-6">
            <div className="text-sm opacity-90 mb-2">Total Take Home Pay</div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-xs opacity-75">Yearly</div>
                <div className="text-2xl font-bold">${calc.net_pay.yearly.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
              </div>
              <div>
                <div className="text-xs opacity-75">Monthly</div>
                <div className="text-2xl font-bold">${calc.net_pay.monthly.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
              </div>
              <div>
                <div className="text-xs opacity-75">Weekly</div>
                <div className="text-2xl font-bold">${calc.net_pay.weekly.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
              </div>
              <div>
                <div className="text-xs opacity-75">Bi-Weekly</div>
                <div className="text-2xl font-bold">${calc.net_pay.biweekly.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
