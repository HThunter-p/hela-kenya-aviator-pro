-- Create round_history table to track past crash multipliers
CREATE TABLE public.round_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_number SERIAL,
  crash_multiplier NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.round_history ENABLE ROW LEVEL SECURITY;

-- Everyone can view round history (public game data)
CREATE POLICY "Anyone can view round history" 
ON public.round_history 
FOR SELECT 
USING (true);

-- Only system/admin can insert round history
CREATE POLICY "Only admins can insert round history" 
ON public.round_history 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for round history
ALTER PUBLICATION supabase_realtime ADD TABLE public.round_history;

-- Seed future_rounds with sample data for admin preview
INSERT INTO public.future_rounds (round_number, crash_multiplier) VALUES
(1, 1.45),
(2, 3.82),
(3, 1.12);

-- Allow admins to manage future_rounds
CREATE POLICY "Admins can insert future rounds" 
ON public.future_rounds 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update future rounds" 
ON public.future_rounds 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete future rounds" 
ON public.future_rounds 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));