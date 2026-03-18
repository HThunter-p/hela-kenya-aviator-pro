
CREATE OR REPLACE FUNCTION public.generate_future_rounds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count integer;
  max_round integer;
  i integer;
  crash_val numeric;
BEGIN
  SELECT COUNT(*) INTO current_count FROM public.future_rounds;
  
  IF current_count >= 3 THEN
    RETURN;
  END IF;
  
  SELECT COALESCE(MAX(round_number), 0) INTO max_round FROM public.future_rounds;
  
  FOR i IN 1..(3 - current_count) LOOP
    -- Generate random crash multiplier between 1.01 and 15.0 with weighted distribution
    -- Most crashes happen between 1.0-3.0, fewer at higher multipliers
    crash_val := ROUND((1.01 + (random() * random() * 14.0))::numeric, 2);
    
    max_round := max_round + 1;
    
    INSERT INTO public.future_rounds (round_number, crash_multiplier)
    VALUES (max_round, crash_val);
  END LOOP;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.generate_future_rounds() TO authenticated;
