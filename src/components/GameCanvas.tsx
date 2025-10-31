import { useEffect, useRef } from 'react';

interface GameCanvasProps {
  multiplier: number;
  isFlying: boolean;
  crashed: boolean;
}

export const GameCanvas = ({ multiplier, isFlying, crashed }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const drawGame = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid
      ctx.strokeStyle = 'rgba(142, 200, 120, 0.1)';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
      
      // Draw curve
      if (isFlying || crashed) {
        const points = Math.min((multiplier - 1) * 100, canvas.width);
        
        ctx.beginPath();
        ctx.strokeStyle = crashed ? 'hsl(0, 84%, 60%)' : 'hsl(142, 76%, 45%)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = crashed ? 'hsl(0, 84%, 60%)' : 'hsl(142, 76%, 45%)';
        
        for (let x = 0; x <= points; x++) {
          const y = canvas.height - (Math.log(1 + x / 50) * 80);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
        
        // Draw plane/rocket
        const x = points;
        const y = canvas.height - (Math.log(1 + x / 50) * 80);
        
        ctx.font = '32px Arial';
        ctx.fillText('✈️', x - 16, y);
      }
    };
    
    drawGame();
  }, [multiplier, isFlying, crashed]);
  
  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={400}
      className="w-full h-full rounded-lg"
    />
  );
};
