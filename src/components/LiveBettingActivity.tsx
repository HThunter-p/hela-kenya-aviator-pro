import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface LiveBet {
  id: string;
  user_id: string;
  amount: number;
  multiplier: number | null;
  status: string;
  payout: number;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export const LiveBettingActivity = () => {
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);

  // Fetch initial bets
  useEffect(() => {
    const fetchLiveBets = async () => {
      try {
        const { data, error } = await supabase
          .from('live_bets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // Fetch profile details separately
        const betsWithProfiles = await Promise.all(
          (data || []).map(async (bet) => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', bet.user_id)
              .single();

            return {
              ...bet,
              profiles: profileData || { full_name: 'Anonymous' },
            };
          })
        );

        setLiveBets(betsWithProfiles);
      } catch (error) {
        console.error('Error fetching live bets:', error);
      }
    };

    fetchLiveBets();
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('live_bets_activity')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_bets',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newBet = payload.new as LiveBet;
            
            // Fetch profile for new bet
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newBet.user_id)
              .single();

            setLiveBets((prev) => [
              {
                ...newBet,
                profiles: profileData || { full_name: 'Anonymous' },
              },
              ...prev.slice(0, 19),
            ]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedBet = payload.new as LiveBet;
            
            setLiveBets((prev) =>
              prev.map((bet) =>
                bet.id === updatedBet.id
                  ? { ...bet, ...updatedBet }
                  : bet
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusIcon = (status: string, payout: number) => {
    if (status === 'cashed_out' && payout > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (status === 'lost') {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <DollarSign className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-yellow-600">Active</Badge>;
      case 'cashed_out':
        return <Badge className="bg-green-600">Cashed Out</Badge>;
      case 'lost':
        return <Badge className="bg-red-600">Lost</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Live Betting Activity</h2>
      
      {liveBets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No recent betting activity</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {liveBets.map((bet) => (
            <div
              key={bet.id}
              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(bet.status, bet.payout)}
                <div>
                  <p className="font-medium">{bet.profiles.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Bet: KSh {bet.amount.toLocaleString()}
                    {bet.multiplier && bet.status === 'cashed_out' && (
                      <span className="text-green-600 ml-2">
                        @ {bet.multiplier.toFixed(2)}x
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="text-right flex flex-col gap-1">
                {getStatusBadge(bet.status)}
                {bet.status === 'cashed_out' && bet.payout > 0 && (
                  <p className="text-sm font-bold text-green-600">
                    +KSh {bet.payout.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
