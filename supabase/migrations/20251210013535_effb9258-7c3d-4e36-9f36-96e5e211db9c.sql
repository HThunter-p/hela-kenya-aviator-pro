-- Allow any authenticated user to insert round history (game records crashes)
DROP POLICY IF EXISTS "Only admins can insert round history" ON public.round_history;

CREATE POLICY "Authenticated users can insert round history" 
ON public.round_history 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);