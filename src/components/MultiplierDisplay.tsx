import { Card } from '@/components/ui/card';

interface MultiplierDisplayProps {
  multiplier: number;
  isFlying: boolean;
  crashed: boolean;
}

export const MultiplierDisplay = ({
  multiplier,
  isFlying,
  crashed,
}: MultiplierDisplayProps) => {
  return (
    <Card className="p-8 bg-gradient-to-br from-card to-muted border-border flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        {!isFlying && !crashed && (
          <div className="animate-pulse">
            <div className="text-2xl text-muted-foreground mb-4">
              Waiting for next round...
            </div>
            <div className="text-6xl font-bold text-primary animate-float">
              🚀
            </div>
          </div>
        )}

        {(isFlying || crashed) && (
          <div className="space-y-4">
            <div
              className={`text-8xl font-black transition-all duration-300 ${
                crashed
                  ? 'text-destructive animate-pulse'
                  : 'text-game-gold animate-pulse-glow'
              }`}
              style={{
                textShadow: crashed
                  ? '0 0 40px hsl(0, 84%, 60%)'
                  : '0 0 50px hsl(45, 100%, 51%)',
              }}
            >
              {multiplier.toFixed(2)}x
            </div>
            {crashed && (
              <div className="text-3xl font-bold text-destructive animate-slide-up">
                CRASHED! 💥
              </div>
            )}
            {isFlying && !crashed && (
              <div className="text-xl text-game-success animate-pulse">
                Flying... ✈️
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
