-- Migration: Add split_payments table for detailed split tracking
-- This tracks who owes what for each split transaction

CREATE TABLE IF NOT EXISTS public.split_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  person_name TEXT NOT NULL,
  amount_owed NUMERIC(10, 2) NOT NULL,
  is_paid_back BOOLEAN DEFAULT FALSE,
  paid_back_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_split_payments_purchase 
ON public.split_payments(purchase_id);

CREATE INDEX IF NOT EXISTS idx_split_payments_user 
ON public.split_payments(user_id);

CREATE INDEX IF NOT EXISTS idx_split_payments_status 
ON public.split_payments(is_paid_back);

-- Comment
COMMENT ON TABLE public.split_payments IS 'Tracks individual people and amounts for split transactions';

-- Update function for updated_at
CREATE OR REPLACE FUNCTION public.update_split_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_split_payments_updated_at
  BEFORE UPDATE ON public.split_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_split_payments_updated_at();
