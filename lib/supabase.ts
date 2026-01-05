import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClientComponentClient()

// For server-side usage
export const createSupabaseClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          monthly_budget: number
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          monthly_budget: number
          color: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          monthly_budget?: number
          color?: string
          created_at?: string
        }
      }
      purchases: {
        Row: {
          id: string
          user_id: string
          category_id: string
          total_amount: number
          actual_cost: number
          description: string
          date: string
          is_split: boolean
          amount_owed_back: number | null
          num_people_owing: number | null
          is_projected: boolean
          recurring_expense_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          total_amount: number
          actual_cost: number
          description: string
          date: string
          is_split?: boolean
          amount_owed_back?: number | null
          num_people_owing?: number | null
          is_projected?: boolean
          recurring_expense_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          total_amount?: number
          actual_cost?: number
          description?: string
          date?: string
          is_split?: boolean
          amount_owed_back?: number | null
          num_people_owing?: number | null
          is_projected?: boolean
          recurring_expense_id?: string | null
          created_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          user_id: string
          name: string
          current_value: number
          last_updated: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          current_value: number
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          current_value?: number
          last_updated?: string
          created_at?: string
        }
      }
      asset_history: {
        Row: {
          id: string
          asset_id: string
          value: number
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          value: number
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          value?: number
          date?: string
          created_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          deadline: string
          linked_asset_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          deadline: string
          linked_asset_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          deadline?: string
          linked_asset_id?: string | null
          created_at?: string
        }
      }
      recurring_expenses: {
        Row: {
          id: string
          user_id: string
          category_id: string
          name: string
          amount: number
          frequency: string
          day_of_month: number | null
          day_of_week: number | null
          is_active: boolean
          last_generated: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          name: string
          amount: number
          frequency: string
          day_of_month?: number | null
          day_of_week?: number | null
          is_active?: boolean
          last_generated?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          name?: string
          amount?: number
          frequency?: string
          day_of_month?: number | null
          day_of_week?: number | null
          is_active?: boolean
          last_generated?: string | null
          created_at?: string
        }
      }
      income: {
        Row: {
          id: string
          user_id: string
          source: string
          amount: number
          frequency: string
          date: string
          is_recurring: boolean
          is_salary: boolean
          yearly_salary: number | null
          pay_frequency: string | null
          next_pay_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source: string
          amount: number
          frequency: string
          date: string
          is_recurring?: boolean
          is_salary?: boolean
          yearly_salary?: number | null
          pay_frequency?: string | null
          next_pay_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source?: string
          amount?: number
          frequency?: string
          date?: string
          is_recurring?: boolean
          is_salary?: boolean
          yearly_salary?: number | null
          pay_frequency?: string | null
          next_pay_date?: string | null
          created_at?: string
        }
      }
      salary_deductions: {
        Row: {
          id: string
          income_id: string
          pre_tax_401k: number
          pre_tax_401k_roth: number
          hsa: number
          medical_insurance: number
          dental_insurance: number
          vision_insurance: number
          federal_tax: number
          state_tax: number
          social_security: number
          medicare: number
          fica_total: number
          ca_disability: number
          after_tax_401k: number
          after_tax_401k_roth: number
          life_insurance: number
          ad_d: number
          critical_illness: number
          hospital_indemnity: number
          accident_insurance: number
          legal_plan: number
          identity_theft: number
          net_yearly: number
          net_monthly: number
          net_weekly: number
          net_biweekly: number
          created_at: string
        }
        Insert: {
          id?: string
          income_id: string
          pre_tax_401k?: number
          pre_tax_401k_roth?: number
          hsa?: number
          medical_insurance?: number
          dental_insurance?: number
          vision_insurance?: number
          federal_tax?: number
          state_tax?: number
          social_security?: number
          medicare?: number
          fica_total?: number
          ca_disability?: number
          after_tax_401k?: number
          after_tax_401k_roth?: number
          life_insurance?: number
          ad_d?: number
          critical_illness?: number
          hospital_indemnity?: number
          accident_insurance?: number
          legal_plan?: number
          identity_theft?: number
          net_yearly: number
          net_monthly: number
          net_weekly: number
          net_biweekly: number
          created_at?: string
        }
        Update: {
          id?: string
          income_id?: string
          pre_tax_401k?: number
          pre_tax_401k_roth?: number
          hsa?: number
          medical_insurance?: number
          dental_insurance?: number
          vision_insurance?: number
          federal_tax?: number
          state_tax?: number
          social_security?: number
          medicare?: number
          fica_total?: number
          ca_disability?: number
          after_tax_401k?: number
          after_tax_401k_roth?: number
          life_insurance?: number
          ad_d?: number
          critical_illness?: number
          hospital_indemnity?: number
          accident_insurance?: number
          legal_plan?: number
          identity_theft?: number
          net_yearly?: number
          net_monthly?: number
          net_weekly?: number
          net_biweekly?: number
          created_at?: string
        }
      }
    }
  }
}
