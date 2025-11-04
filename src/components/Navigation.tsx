import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Wallet, Users } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-50">
      <div className="max-w-4xl mx-auto flex justify-around items-center">
        <Link to="/">
          <Button
            variant={isActive('/') ? 'default' : 'ghost'}
            size="lg"
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Game</span>
          </Button>
        </Link>
        
        <Link to="/withdrawal">
          <Button
            variant={isActive('/withdrawal') ? 'default' : 'ghost'}
            size="lg"
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Wallet className="h-5 w-5" />
            <span className="text-xs">Withdraw</span>
          </Button>
        </Link>
        
        <Link to="/referral">
          <Button
            variant={isActive('/referral') ? 'default' : 'ghost'}
            size="lg"
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Users className="h-5 w-5" />
            <span className="text-xs">Referral</span>
          </Button>
        </Link>
      </div>
    </nav>
  );
}
