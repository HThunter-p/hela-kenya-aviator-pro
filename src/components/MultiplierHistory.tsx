import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RoundHistory {
  id: string;
  crash_multiplier: number;
  created_at: string;
}

export const MultiplierHistory = () => {
  const [history, setHistory] = useState<RoundHistory[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      const { data, error } = await supabase
        .from('round_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading round history:', error);
        return;
      }

      if (data) {
        setHistory(data);
      }
    };

    loadHistory();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('round_history_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'round_history',
        },
        (payload) => {
          setHistory((prev) => [payload.new as RoundHistory, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getMultiplierColor = (multiplier: number) => {
    if (multiplier < 1.5) return 'bg-red-500/80 text-white';
    if (multiplier < 2.0) return 'bg-orange-500/80 text-white';
    if (multiplier < 3.0) return 'bg-yellow-500/80 text-black';
    if (multiplier < 5.0) return 'bg-green-500/80 text-white';
    if (multiplier < 10.0) return 'bg-blue-500/80 text-white';
    return 'bg-purple-500/80 text-white';
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
      <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">History:</span>
      <div className="flex flex-row-reverse justify-end gap-1.5">
        {history.map((round) => (
          <span
            key={round.id}
            className={`px-2 py-1 rounded-md text-xs font-bold ${getMultiplierColor(
              parseFloat(round.crash_multiplier.toString())
            )} transition-all hover:scale-110 cursor-default`}
            title={new Date(round.created_at).toLocaleTimeString()}
          >
            {parseFloat(round.crash_multiplier.toString()).toFixed(2)}x
          </span>
        ))}
      </div>
    </div>
  );
};
