import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Bet {
  id: string;
  amount: number;
  multiplier: number;
  payout: number;
  won: boolean;
  time: string;
}

interface BetHistoryProps {
  bets: Bet[];
}

export const BetHistory = ({ bets }: BetHistoryProps) => {
  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="font-bold text-lg mb-4">Recent Bets</h3>
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {bets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No bets yet. Place your first bet!
            </p>
          ) : (
            bets.map((bet) => (
              <div
                key={bet.id}
                className={`p-3 rounded-lg border ${
                  bet.won
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-destructive/10 border-destructive/30'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">
                      KSh {bet.amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">{bet.time}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        bet.won ? 'text-game-gold' : 'text-destructive'
                      }`}
                    >
                      {bet.multiplier.toFixed(2)}x
                    </div>
                    {bet.won && (
                      <div className="text-sm text-game-gold">
                        +KSh {bet.payout.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
