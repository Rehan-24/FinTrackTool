-- Finance Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Categories table
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  monthly_budget NUMERIC(10, 2) NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Category budget history table (tracks monthly budget changes)
CREATE TABLE public.category_budget_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  monthly_budget NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(category_id, month_year)
);

CREATE INDEX idx_category_budget_history_lookup ON public.category_budget_history(category_id, month_year);

-- Purchases table
CREATE TABLE public.purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  actual_cost NUMERIC(10, 2) NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  is_split BOOLEAN DEFAULT FALSE,
  amount_owed_back NUMERIC(10, 2),
  num_people_owing INTEGER,
  is_projected BOOLEAN DEFAULT FALSE,
  recurring_expense_id UUID REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
  tags TEXT[], -- Array of tags
  payment_method TEXT, -- Card/account used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assets table
CREATE TABLE public.assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  current_value NUMERIC(12, 2) NOT NULL,
  last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asset History table
CREATE TABLE public.asset_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  value NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Goals table
CREATE TABLE public.goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deadline DATE NOT NULL,
  linked_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Recurring Expenses table
CREATE TABLE public.recurring_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  frequency TEXT NOT NULL, -- 'monthly', 'weekly', 'yearly'
  day_of_month INTEGER, -- 1-31 for monthly, null for others
  day_of_week INTEGER, -- 0-6 for weekly, null for others
  is_active BOOLEAN DEFAULT TRUE,
  last_generated DATE,
  end_date DATE, -- Optional end date for recurring expense
  tags TEXT[], -- Array of tags
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Income table
CREATE TABLE public.income (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  source TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  frequency TEXT NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_salary BOOLEAN DEFAULT FALSE,
  yearly_salary NUMERIC(12, 2),
  pay_frequency TEXT,
  next_pay_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Salary Deductions table (stores detailed breakdown)
CREATE TABLE public.salary_deductions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  income_id UUID REFERENCES public.income(id) ON DELETE CASCADE NOT NULL,
  
  -- Pre-tax deductions (yearly amounts)
  pre_tax_401k NUMERIC(10, 2) DEFAULT 0,
  pre_tax_401k_roth NUMERIC(10, 2) DEFAULT 0,
  hsa NUMERIC(10, 2) DEFAULT 0,
  medical_insurance NUMERIC(10, 2) DEFAULT 0,
  dental_insurance NUMERIC(10, 2) DEFAULT 0,
  vision_insurance NUMERIC(10, 2) DEFAULT 0,
  
  -- Taxes (yearly amounts)
  federal_tax NUMERIC(10, 2) DEFAULT 0,
  state_tax NUMERIC(10, 2) DEFAULT 0,
  social_security NUMERIC(10, 2) DEFAULT 0,
  medicare NUMERIC(10, 2) DEFAULT 0,
  fica_total NUMERIC(10, 2) DEFAULT 0,
  ca_disability NUMERIC(10, 2) DEFAULT 0,
  
  -- After-tax deductions (yearly amounts)
  after_tax_401k NUMERIC(10, 2) DEFAULT 0,
  after_tax_401k_roth NUMERIC(10, 2) DEFAULT 0,
  life_insurance NUMERIC(10, 2) DEFAULT 0,
  ad_d NUMERIC(10, 2) DEFAULT 0,
  critical_illness NUMERIC(10, 2) DEFAULT 0,
  hospital_indemnity NUMERIC(10, 2) DEFAULT 0,
  accident_insurance NUMERIC(10, 2) DEFAULT 0,
  legal_plan NUMERIC(10, 2) DEFAULT 0,
  identity_theft NUMERIC(10, 2) DEFAULT 0,
  auto_savings NUMERIC(10, 2) DEFAULT 0,
  
  -- Net pay (calculated)
  net_yearly NUMERIC(12, 2) NOT NULL,
  net_monthly NUMERIC(12, 2) NOT NULL,
  net_weekly NUMERIC(12, 2) NOT NULL,
  net_biweekly NUMERIC(12, 2) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_deductions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Categories policies
CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- Purchases policies
CREATE POLICY "Users can view own purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON public.purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchases" ON public.purchases
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchases" ON public.purchases
  FOR DELETE USING (auth.uid() = user_id);

-- Assets policies
CREATE POLICY "Users can view own assets" ON public.assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets" ON public.assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets" ON public.assets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets" ON public.assets
  FOR DELETE USING (auth.uid() = user_id);

-- Asset history policies
CREATE POLICY "Users can view own asset history" ON public.asset_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assets
      WHERE assets.id = asset_history.asset_id
      AND assets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own asset history" ON public.asset_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assets
      WHERE assets.id = asset_history.asset_id
      AND assets.user_id = auth.uid()
    )
  );

-- Goals policies
CREATE POLICY "Users can view own goals" ON public.goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON public.goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON public.goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON public.goals
  FOR DELETE USING (auth.uid() = user_id);

-- Recurring expenses policies
CREATE POLICY "Users can view own recurring expenses" ON public.recurring_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring expenses" ON public.recurring_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring expenses" ON public.recurring_expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring expenses" ON public.recurring_expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Income policies
CREATE POLICY "Users can view own income" ON public.income
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income" ON public.income
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income" ON public.income
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own income" ON public.income
  FOR DELETE USING (auth.uid() = user_id);

-- Salary deductions policies
CREATE POLICY "Users can view own salary deductions" ON public.salary_deductions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.income
      WHERE income.id = salary_deductions.income_id
      AND income.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own salary deductions" ON public.salary_deductions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.income
      WHERE income.id = salary_deductions.income_id
      AND income.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own salary deductions" ON public.salary_deductions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.income
      WHERE income.id = salary_deductions.income_id
      AND income.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own salary deductions" ON public.salary_deductions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.income
      WHERE income.id = salary_deductions.income_id
      AND income.user_id = auth.uid()
    )
  );

-- Indexes for better performance
CREATE INDEX idx_categories_user_id ON public.categories(user_id);
CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX idx_purchases_category_id ON public.purchases(category_id);
CREATE INDEX idx_purchases_date ON public.purchases(date);
CREATE INDEX idx_purchases_is_projected ON public.purchases(is_projected);
CREATE INDEX idx_purchases_recurring_expense_id ON public.purchases(recurring_expense_id);
CREATE INDEX idx_assets_user_id ON public.assets(user_id);
CREATE INDEX idx_asset_history_asset_id ON public.asset_history(asset_id);
CREATE INDEX idx_asset_history_date ON public.asset_history(date);
CREATE INDEX idx_goals_user_id ON public.goals(user_id);
CREATE INDEX idx_recurring_expenses_user_id ON public.recurring_expenses(user_id);
CREATE INDEX idx_income_user_id ON public.income(user_id);
CREATE INDEX idx_income_date ON public.income(date);
CREATE INDEX idx_salary_deductions_income_id ON public.salary_deductions(income_id);

-- Trigger to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
