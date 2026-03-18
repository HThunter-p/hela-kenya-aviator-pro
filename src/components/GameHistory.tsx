import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { History, Trophy, TrendingDown, TrendingUp, Plane } from 'lucide-react';

interface RoundHistory {
  id: string;
  round_number: number;
  crash_multiplier: number;
  created_at: string;
}

interface BetHistoryItem {
  id: string;
  amount: number;
  multiplier: number;
  payout: number | null;
  won: boolean;
  created_at: string;
}

interface GameHistoryProps {
  userId?: string;
}

export const GameHistory = ({ userId }: GameHistoryProps) => {
  const [rounds, setRounds] = useState<RoundHistory[]>([]);
  const [bets, setBets] = useState<BetHistoryItem[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingBets, setLoadingBets] = useState(true);

  useEffect(() => {
    const loadRounds = async () => {
      const { data, error } = await supabase
        .from('round_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) setRounds(data);
      setLoadingRounds(false);
    };

    loadRounds();

    const channel = supabase
      .channel('game_history_rounds')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'round_history' }, (payload) => {
        setRounds((prev) => [payload.new as RoundHistory, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const loadBets = async () => {
      const { data, error } = await supabase
        .from('bet_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) setBets(data);
      setLoadingBets(false);
    };

    loadBets();

    const channel = supabase
      .channel('game_history_bets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bet_history', filter: `user_id=eq.${userId}` }, (payload) => {
        setBets((prev) => [payload.new as BetHistoryItem, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const getMultiplierColor = (multiplier: number) => {
    if (multiplier < 1.5) return 'text-red-400';
    if (multiplier < 2.0) return 'text-orange-400';
    if (multiplier < 3.0) return 'text-yellow-400';
    if (multiplier < 5.0) return 'text-emerald-400';
    if (multiplier < 10.0) return 'text-blue-400';
    return 'text-purple-400';
  };

  const getMultiplierBadge = (multiplier: number) => {
    if (multiplier < 1.5) return 'bg-red-500/15 border-red-500/30';
    if (multiplier < 2.0) return 'bg-orange-500/15 border-orange-500/30';
    if (multiplier < 3.0) return 'bg-yellow-500/15 border-yellow-500/30';
    if (multiplier < 5.0) return 'bg-emerald-500/15 border-emerald-500/30';
    if (multiplier < 10.0) return 'bg-blue-500/15 border-blue-500/30';
    return 'bg-purple-500/15 border-purple-500/30';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Stats
  const totalBets = bets.length;
  const totalWins = bets.filter(b => b.won).length;
  const totalWagered = bets.reduce((sum, b) => sum + b.amount, 0);
  const totalPayout = bets.reduce((sum, b) => sum + (b.payout || 0), 0);
  const profit = totalPayout - totalWagered;

  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm overflow-hidden">
      <Tabs defaultValue="rounds" className="w-full">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Game History</h3>
          </div>
        </div>

        <TabsList className="w-full rounded-none bg-muted/50 px-4">
          <TabsTrigger value="rounds" className="flex-1 gap-1.5 text-xs">
            <Plane className="h-3.5 w-3.5" />
            Round History
          </TabsTrigger>
          <TabsTrigger value="mybets" className="flex-1 gap-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5" />
            My Bets
          </TabsTrigger>
        </TabsList>

        {/* Round History Tab */}
        <TabsContent value="rounds" className="mt-0">
          {/* Scrolling multiplier chips */}
          <div className="px-4 py-3 border-b border-border overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {rounds.slice(0, 20).map((round) => {
                const m = parseFloat(round.crash_multiplier.toString());
                return (
                  <span
                    key={round.id}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getMultiplierBadge(m)} ${getMultiplierColor(m)} transition-all hover:scale-105 cursor-default`}
                    title={`Round #${round.round_number} — ${formatTime(round.created_at)}`}
                  >
                    {m.toFixed(2)}x
                  </span>
                );
              })}
              {rounds.length === 0 && !loadingRounds && (
                <span className="text-xs text-muted-foreground">No rounds yet</span>
              )}
            </div>
          </div>

          <ScrollArea className="h-[320px]">
            <div className="divide-y divide-border">
              {loadingRounds ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
              ) : rounds.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No round history yet. Play to see results!</div>
              ) : (
                rounds.map((round, index) => {
                  const m = parseFloat(round.crash_multiplier.toString());
                  return (
                    <div key={round.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getMultiplierBadge(m)}`}>
                          {m >= 2 ? (
                            <TrendingUp className={`h-4 w-4 ${getMultiplierColor(m)}`} />
                          ) : (
                            <TrendingDown className={`h-4 w-4 ${getMultiplierColor(m)}`} />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium">Round #{round.round_number}</div>
                          <div className="text-xs text-muted-foreground">{formatTime(round.created_at)}</div>
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${getMultiplierColor(m)}`}>
                        {m.toFixed(2)}x
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* My Bets Tab */}
        <TabsContent value="mybets" className="mt-0">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-border">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Bets</div>
              <div className="text-sm font-bold">{totalBets}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Win Rate</div>
              <div className="text-sm font-bold text-emerald-400">
                {totalBets > 0 ? ((totalWins / totalBets) * 100).toFixed(0) : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Profit</div>
              <div className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {profit >= 0 ? '+' : ''}KSh {profit.toLocaleString()}
              </div>
            </div>
          </div>

          <ScrollArea className="h-[320px]">
            <div className="divide-y divide-border">
              {loadingBets ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
              ) : bets.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No bets yet. Place your first bet!</div>
              ) : (
                bets.map((bet) => {
                  const m = parseFloat(bet.multiplier.toString());
                  const payout = bet.payout ? parseFloat(bet.payout.toString()) : 0;
                  return (
                    <div key={bet.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${bet.won ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-red-500/15 border border-red-500/30'}`}>
                          {bet.won ? (
                            <Trophy className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            KSh {bet.amount.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatTime(bet.created_at)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-base font-bold ${getMultiplierColor(m)}`}>
                          {m.toFixed(2)}x
                        </div>
                        <div className={`text-xs font-medium ${bet.won ? 'text-emerald-400' : 'text-red-400'}`}>
                          {bet.won ? `+KSh ${payout.toLocaleString()}` : 'Lost'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
