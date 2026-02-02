-- Migration: Mark legacy split payments as complete
-- This handles split purchases created before v5.3.0 that don't have split_payments entries

-- Step 1: Find all split purchases without any split_payments entries
-- Step 2: Create completed split_payment records for them

DO $$
DECLARE
  purchase_record RECORD;
  num_people INT;
  split_amount NUMERIC;
  i INT;
BEGIN
  -- Loop through all split purchases that don't have split_payments
  FOR purchase_record IN
    SELECT p.id, p.user_id, p.num_people_owing, p.amount_owed_back, p.date
    FROM purchases p
    WHERE p.is_split = true
      AND NOT EXISTS (
        SELECT 1 FROM split_payments sp WHERE sp.purchase_id = p.id
      )
  LOOP
    -- Calculate number of people and amount per person
    num_people := COALESCE(purchase_record.num_people_owing, 1);
    split_amount := COALESCE(purchase_record.amount_owed_back, 0) / num_people;
    
    -- Create split_payment entries for each person
    FOR i IN 1..num_people LOOP
      INSERT INTO split_payments (
        purchase_id,
        user_id,
        person_name,
        amount_owed,
        is_paid_back,
        paid_back_date
      ) VALUES (
        purchase_record.id,
        purchase_record.user_id,
        'Person ' || i,
        split_amount,
        true,  -- Mark as already paid
        purchase_record.date  -- Use purchase date as paid date
      );
    END LOOP;
    
    RAISE NOTICE 'Created % completed split payments for purchase %', num_people, purchase_record.id;
  END LOOP;
END $$;

-- Summary: Show how many purchases were updated
SELECT 
  COUNT(DISTINCT sp.purchase_id) as legacy_purchases_updated,
  COUNT(*) as split_payments_created
FROM split_payments sp
WHERE sp.person_name LIKE 'Person %'
  AND sp.is_paid_back = true;
