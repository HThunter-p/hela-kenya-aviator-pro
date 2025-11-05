import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BettingPanel } from '@/components/BettingPanel';
import { BetHistory } from '@/components/BetHistory';
import { MultiplierDisplay } from '@/components/MultiplierDisplay';
import { DepositModal } from '@/components/DepositModal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAdmin } from '@/hooks/useAdmin';
import { AdminPanel } from '@/components/AdminPanel';
import { AdminWithdrawals } from '@/components/AdminWithdrawals';
import Navigation from '@/components/Navigation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plane, Trophy, TrendingUp, LogOut } from 'lucide-react';

interface Bet {
  id: string;
  amount: number;
  multiplier: number;
  payout: number;
  won: boolean;
  time: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile(user?.id);
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id);

  const [currentBets, setCurrentBets] = useState<{ [key: number]: number }>({ 1: 0, 2: 0, 3: 0 });
  const [multiplier, setMultiplier] = useState(1.0);
  const [isFlying, setIsFlying] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [betHistory, setBetHistory] = useState<Bet[]>([]);
  const [canBet, setCanBet] = useState(true);
  const [canCashOut, setCanCashOut] = useState<{ [key: number]: boolean }>({ 1: false, 2: false, 3: false });
  const [autoplay, setAutoplay] = useState<{ [key: number]: boolean }>({ 1: false, 2: false, 3: false });
  const [autoCashoutMultiplier, setAutoCashoutMultiplier] = useState<{ [key: number]: number }>({ 1: 2.0, 2: 2.0, 3: 2.0 });

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Load bet history
  useEffect(() => {
    if (!user) return;

    const loadBetHistory = async () => {
      const { data, error } = await supabase
        .from('bet_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading bet history:', error);
        return;
      }

      if (data) {
        setBetHistory(
          data.map((bet) => ({
            id: bet.id,
            amount: parseFloat(bet.amount.toString()),
            multiplier: parseFloat(bet.multiplier.toString()),
            payout: parseFloat(bet.payout.toString()),
            won: bet.won,
            time: new Date(bet.created_at).toLocaleTimeString(),
          }))
        );
      }
    };

    loadBetHistory();
  }, [user]);

  // Game loop
  useEffect(() => {
    if (!isFlying) return;

    const interval = setInterval(() => {
      setMultiplier((prev) => {
        const increment = Math.random() * 0.1 + 0.05;
        const newMultiplier = prev + increment;

        // Check for auto cash-out on autoplay panels
        Object.entries(autoplay).forEach(([panelId, enabled]) => {
          const id = Number(panelId);
          if (enabled && canCashOut[id] && currentBets[id] > 0) {
            if (newMultiplier >= autoCashoutMultiplier[id]) {
              handleCashOut(id);
            }
          }
        });

        // Highly unpredictable crash probability with multiple random factors
        const baseProb = 0.015;
        const multiplierFactor = Math.pow(newMultiplier, 1.5) / 1000;
        const randomSpike = Math.random() < 0.1 ? Math.random() * 0.05 : 0;
        const timeVariance = Math.sin(Date.now() / 1000) * 0.01;
        
        const crashProbability = baseProb + multiplierFactor + randomSpike + Math.abs(timeVariance);
        
        if (Math.random() < crashProbability) {
          handleCrash();
          return prev;
        }

        return newMultiplier;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isFlying, autoplay, canCashOut, currentBets, autoCashoutMultiplier]);

  const handleCrash = useCallback(async () => {
    setIsFlying(false);
    setCrashed(true);
    setCanCashOut({ 1: false, 2: false, 3: false });

    // Process all active bets
    const activeBets = Object.entries(currentBets).filter(([_, amount]) => amount > 0);
    
    if (activeBets.length > 0 && user) {
      for (const [panelId, betAmount] of activeBets) {
        // Record lost bet
        await supabase.from('bet_history').insert({
          user_id: user.id,
          amount: betAmount,
          multiplier,
          payout: 0,
          won: false,
        });

        // Record bet transaction
        await supabase.from('transactions').insert({
          user_id: user.id,
          amount: -betAmount,
          type: 'bet',
          description: `Lost bet at ${multiplier.toFixed(2)}x (Panel ${panelId})`,
        });

        const bet: Bet = {
          id: `${Date.now()}-${panelId}`,
          amount: betAmount,
          multiplier,
          payout: 0,
          won: false,
          time: new Date().toLocaleTimeString(),
        };
        setBetHistory((prev) => [bet, ...prev]);
      }
      
      setCurrentBets({ 1: 0, 2: 0, 3: 0 });
      toast.error(`Crashed at ${multiplier.toFixed(2)}x! Better luck next time.`);
    }

    // Start new round after 3 seconds
    setTimeout(() => {
      startNewRound();
    }, 3000);
  }, [currentBets, multiplier, user]);

  const startNewRound = () => {
    setCrashed(false);
    setMultiplier(1.0);
    setCanBet(true);
    
    // Auto-bet for panels with autoplay enabled
    setTimeout(() => {
      Object.entries(autoplay).forEach(([panelId, enabled]) => {
        if (enabled && currentBets[Number(panelId)] === 0) {
          // Use last bet amount or default
          handleBet(Number(panelId), 100);
        }
      });
    }, 9000); // Place bets 1 second before flight starts
    
    setTimeout(() => {
      setIsFlying(true);
      setCanBet(false);
    }, 10000);
  };

  const handleBet = async (panelId: number, amount: number) => {
    if (!profile || !user) return;

    const balance = parseFloat(profile.balance.toString());
    if (amount > balance) {
      toast.error('Insufficient balance!');
      return;
    }

    // Deduct bet from balance
    const { error } = await supabase
      .from('profiles')
      .update({ balance: balance - amount })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to place bet');
      console.error('Error placing bet:', error);
      return;
    }

    setCurrentBets(prev => ({ ...prev, [panelId]: amount }));
    setCanCashOut(prev => ({ ...prev, [panelId]: true }));
    refetchProfile();
    toast.success(`Panel ${panelId}: Bet placed KSh ${amount.toLocaleString()}`);
  };

  const handleCashOut = async (panelId: number) => {
    const currentBet = currentBets[panelId];
    if (currentBet === 0 || !user || !profile) return;

    const payout = Math.floor(currentBet * multiplier);
    const balance = parseFloat(profile.balance.toString());

    // Add winnings to balance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: balance + payout })
      .eq('id', user.id);

    if (updateError) {
      toast.error('Failed to cash out');
      console.error('Error cashing out:', updateError);
      return;
    }

    // Record winning bet
    await supabase.from('bet_history').insert({
      user_id: user.id,
      amount: currentBet,
      multiplier,
      payout,
      won: true,
    });

    // Record win transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: payout,
      type: 'win',
      description: `Won at ${multiplier.toFixed(2)}x (Panel ${panelId})`,
    });

    const bet: Bet = {
      id: `${Date.now()}-${panelId}`,
      amount: currentBet,
      multiplier,
      payout,
      won: true,
      time: new Date().toLocaleTimeString(),
    };

    setBetHistory((prev) => [bet, ...prev]);
    setCurrentBets(prev => ({ ...prev, [panelId]: 0 }));
    setCanCashOut(prev => ({ ...prev, [panelId]: false }));
    refetchProfile();

    toast.success(
      `Panel ${panelId}: Cashed out at ${multiplier.toFixed(2)}x! Won KSh ${payout.toLocaleString()}`,
      { icon: '🎉' }
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Start the first round
  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      startNewRound();
    }, 2000);
    return () => clearTimeout(timer);
  }, [user]);

  // Show loading while checking auth
  if (authLoading || profileLoading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-game flex items-center justify-center">
        <div className="text-center">
          <Plane className="h-16 w-16 text-primary animate-float mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Loading HelaKenya...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-game pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">✈️</div>
              <div>
                <h1 className="text-2xl font-black text-primary">HelaKenya</h1>
                <p className="text-xs text-muted-foreground">Aviator Game</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Your Balance</div>
                <div className="text-xl font-bold text-game-gold">
                  KSh {parseFloat(profile.balance.toString()).toLocaleString()}
                </div>
              </div>
              <DepositModal userId={user!.id} onDepositSuccess={refetchProfile} />
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-primary/30 rounded-lg p-4 flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Plane className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Current Round</div>
              <div className="text-lg font-bold">
                {isFlying ? 'In Flight' : crashed ? 'Crashed' : 'Starting...'}
              </div>
            </div>
          </div>

          <div className="bg-card border border-accent/30 rounded-lg p-4 flex items-center gap-3">
            <div className="p-3 bg-accent/20 rounded-lg">
              <Trophy className="h-6 w-6 text-accent" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Wins</div>
              <div className="text-lg font-bold">
                {betHistory.filter((b) => b.won).length}
              </div>
            </div>
          </div>

          <div className="bg-card border border-secondary/30 rounded-lg p-4 flex items-center gap-3">
            <div className="p-3 bg-secondary/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Best Multiplier</div>
              <div className="text-lg font-bold text-game-gold">
                {betHistory.length > 0
                  ? Math.max(...betHistory.map((b) => b.multiplier)).toFixed(2)
                  : '0.00'}
                x
              </div>
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="space-y-6">
          {/* Admin Panel */}
          {isAdmin && (
            <>
              <AdminPanel />
              <AdminWithdrawals />
            </>
          )}

          {/* Game Display */}
          <MultiplierDisplay
            multiplier={multiplier}
            isFlying={isFlying}
            crashed={crashed}
          />

          {/* Three Betting Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((panelId) => (
              <BettingPanel
                key={panelId}
                onBet={(amount) => handleBet(panelId, amount)}
                onCashOut={() => handleCashOut(panelId)}
                canBet={canBet}
                canCashOut={canCashOut[panelId]}
                balance={parseFloat(profile.balance.toString())}
                currentBet={currentBets[panelId]}
                autoplay={autoplay[panelId]}
                onAutoplayChange={(enabled) => setAutoplay(prev => ({ ...prev, [panelId]: enabled }))}
                autoCashoutMultiplier={autoCashoutMultiplier[panelId]}
                onAutoCashoutChange={(multiplier) => setAutoCashoutMultiplier(prev => ({ ...prev, [panelId]: multiplier }))}
              />
            ))}
          </div>
        </div>

        {/* Bet History */}
        <div className="mt-8">
          <BetHistory bets={betHistory} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            HelaKenya Aviator - Demo Mode with Play Money
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Welcome, {profile.full_name || user!.email}!
          </p>
        </div>
      </footer>
      
      <Navigation />
    </div>
  );
};

export default Index;
