import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Minus, Plus } from 'lucide-react';

interface BettingPanelProps {
  onBet: (amount: number) => void;
  onCashOut: () => void;
  canBet: boolean;
  canCashOut: boolean;
  balance: number;
  currentBet: number;
}

export const BettingPanel = ({
  onBet,
  onCashOut,
  canBet,
  canCashOut,
  balance,
  currentBet,
}: BettingPanelProps) => {
  const [betAmount, setBetAmount] = useState(100);

  const adjustBet = (delta: number) => {
    setBetAmount(Math.max(10, Math.min(balance, betAmount + delta)));
  };

  const quickBet = (amount: number) => {
    setBetAmount(Math.min(balance, amount));
  };

  return (
    <Card className="p-6 bg-card border-border">
      <div className="space-y-4">
        {currentBet > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Bet</span>
            <span className="text-lg font-bold text-primary">KSh {currentBet.toLocaleString()}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Bet Amount (Min: KSh 10)</label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(-50)}
              disabled={!canBet}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className="text-center font-bold text-lg"
              disabled={!canBet}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(50)}
              disabled={!canBet}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[100, 500, 1000, 5000].map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => quickBet(amount)}
              disabled={!canBet}
              className="text-xs"
            >
              {amount}
            </Button>
          ))}
        </div>

        {canBet && (
          <Button
            variant="bet"
            size="lg"
            className="w-full"
            onClick={() => onBet(betAmount)}
            disabled={betAmount > balance || betAmount < 10}
          >
            Place Bet
          </Button>
        )}

        {canCashOut && (
          <Button
            variant="cashout"
            size="lg"
            className="w-full animate-pulse-glow"
            onClick={onCashOut}
          >
            Cash Out
          </Button>
        )}
      </div>
    </Card>
  );
};
