-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_messages
CREATE POLICY "Anyone can view chat messages"
ON public.chat_messages
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create live_bets table for displaying betting activity
CREATE TABLE public.live_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  multiplier numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cashed_out', 'lost')),
  payout numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.live_bets ENABLE ROW LEVEL SECURITY;

-- RLS policies for live_bets
CREATE POLICY "Anyone can view live bets"
ON public.live_bets
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own bets"
ON public.live_bets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bets"
ON public.live_bets
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for live_bets updated_at
CREATE TRIGGER update_live_bets_updated_at
BEFORE UPDATE ON public.live_bets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Enable realtime for live bets
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_bets;