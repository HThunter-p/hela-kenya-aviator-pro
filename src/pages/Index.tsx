import { useState, useEffect, useCallback } from 'react';
import { BettingPanel } from '@/components/BettingPanel';
import { BetHistory } from '@/components/BetHistory';
import { MultiplierDisplay } from '@/components/MultiplierDisplay';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plane, Trophy, TrendingUp } from 'lucide-react';

interface Bet {
  id: string;
  amount: number;
  multiplier: number;
  payout: number;
  won: boolean;
  time: string;
}

const Index = () => {
  const [balance, setBalance] = useState(10000);
  const [currentBet, setCurrentBet] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isFlying, setIsFlying] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [betHistory, setBetHistory] = useState<Bet[]>([]);
  const [canBet, setCanBet] = useState(true);
  const [canCashOut, setCanCashOut] = useState(false);

  // Game loop
  useEffect(() => {
    if (!isFlying) return;

    const interval = setInterval(() => {
      setMultiplier((prev) => {
        const increment = Math.random() * 0.1 + 0.05;
        const newMultiplier = prev + increment;

        // Random crash probability increases with multiplier
        const crashProbability = 0.02 + (newMultiplier / 100);
        if (Math.random() < crashProbability) {
          handleCrash();
          return prev;
        }

        return newMultiplier;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isFlying]);

  const handleCrash = useCallback(() => {
    setIsFlying(false);
    setCrashed(true);
    setCanCashOut(false);

    if (currentBet > 0) {
      const bet: Bet = {
        id: Date.now().toString(),
        amount: currentBet,
        multiplier,
        payout: 0,
        won: false,
        time: new Date().toLocaleTimeString(),
      };
      setBetHistory((prev) => [bet, ...prev]);
      setCurrentBet(0);
      toast.error(`Crashed at ${multiplier.toFixed(2)}x! Better luck next time.`);
    }

    // Start new round after 3 seconds
    setTimeout(() => {
      startNewRound();
    }, 3000);
  }, [currentBet, multiplier]);

  const startNewRound = () => {
    setCrashed(false);
    setMultiplier(1.0);
    setCanBet(true);
    setTimeout(() => {
      setIsFlying(true);
    }, 2000);
  };

  const handleBet = (amount: number) => {
    if (amount > balance) {
      toast.error('Insufficient balance!');
      return;
    }

    setBalance((prev) => prev - amount);
    setCurrentBet(amount);
    setCanBet(false);
    setCanCashOut(true);
    toast.success(`Bet placed: KSh ${amount.toLocaleString()}`);
  };

  const handleCashOut = () => {
    if (currentBet === 0) return;

    const payout = Math.floor(currentBet * multiplier);
    setBalance((prev) => prev + payout);

    const bet: Bet = {
      id: Date.now().toString(),
      amount: currentBet,
      multiplier,
      payout,
      won: true,
      time: new Date().toLocaleTimeString(),
    };

    setBetHistory((prev) => [bet, ...prev]);
    setCurrentBet(0);
    setCanCashOut(false);
    
    toast.success(
      `Cashed out at ${multiplier.toFixed(2)}x! Won KSh ${payout.toLocaleString()}`,
      {
        icon: '🎉',
      }
    );
  };

  // Start the first round
  useEffect(() => {
    const timer = setTimeout(() => {
      startNewRound();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-game">
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
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Your Balance</div>
                <div className="text-xl font-bold text-game-gold">
                  KSh {balance.toLocaleString()}
                </div>
              </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Betting */}
          <div className="lg:col-span-1">
            <BettingPanel
              onBet={handleBet}
              onCashOut={handleCashOut}
              canBet={canBet}
              canCashOut={canCashOut}
              balance={balance}
              currentBet={currentBet}
            />
          </div>

          {/* Center - Game Display */}
          <div className="lg:col-span-2">
            <MultiplierDisplay
              multiplier={multiplier}
              isFlying={isFlying}
              crashed={crashed}
            />
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
            This is a demonstration. No real money is involved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
