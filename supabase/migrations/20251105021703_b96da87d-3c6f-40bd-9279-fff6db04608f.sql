-- Add first_deposit_made flag to profiles
ALTER TABLE public.profiles 
ADD COLUMN first_deposit_made boolean DEFAULT false;

-- Add referrer_id to profiles to track who referred them
ALTER TABLE public.profiles 
ADD COLUMN referrer_id uuid REFERENCES public.profiles(id);

-- Create index for faster lookups
CREATE INDEX idx_profiles_referrer_id ON public.profiles(referrer_id);

-- Update withdrawals table to require admin approval
ALTER TABLE public.withdrawals 
ADD COLUMN approved_by uuid REFERENCES public.profiles(id),
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN rejection_reason text;

-- RLS policy for admins to manage withdrawals
CREATE POLICY "Admins can view all withdrawals"
ON public.withdrawals
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update withdrawals"
ON public.withdrawals
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));