-- Create atomic balance deduction function (prevents race conditions)
CREATE OR REPLACE FUNCTION public.deduct_balance_atomic(p_user_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.profiles 
  SET balance = balance - p_amount, updated_at = now()
  WHERE id = p_user_id 
    AND balance >= p_amount;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

-- Create atomic balance addition function (prevents race conditions)
CREATE OR REPLACE FUNCTION public.add_balance_atomic(p_user_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.profiles 
  SET balance = balance + p_amount, updated_at = now()
  WHERE id = p_user_id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;