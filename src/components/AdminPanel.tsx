import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Shield, TrendingUp } from 'lucide-react';

interface FutureRound {
  id: string;
  round_number: number;
  crash_multiplier: number;
}

export const AdminPanel = () => {
  const [futureRounds, setFutureRounds] = useState<FutureRound[]>([]);

  useEffect(() => {
    const loadFutureRounds = async () => {
      const { data, error } = await supabase
        .from('future_rounds')
        .select('*')
        .order('round_number', { ascending: true })
        .limit(5);

      if (error) {
        console.error('Error loading future rounds:', error);
        return;
      }

      if (data) {
        setFutureRounds(data);
      }
    };

    loadFutureRounds();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('future_rounds_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'future_rounds',
        },
        () => {
          loadFutureRounds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Shield className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-purple-300">Admin Panel</h3>
          <p className="text-xs text-muted-foreground">Next 5 Rounds Preview</p>
        </div>
      </div>

      {futureRounds.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No future rounds data available
        </p>
      ) : (
        <div className="space-y-2">
          {futureRounds.map((round) => (
            <div
              key={round.id}
              className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-purple-500/20"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium">Round {round.round_number}</span>
              </div>
              <span className="text-lg font-bold text-purple-400">
                {parseFloat(round.crash_multiplier.toString()).toFixed(2)}x
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
