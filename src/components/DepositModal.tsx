import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';

interface DepositModalProps {
  userId: string;
  onDepositSuccess: () => void;
}

export const DepositModal = ({ userId, onDepositSuccess }: DepositModalProps) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const quickAmounts = [100, 500, 1000, 5000];
  const MIN_DEPOSIT = 100;

  const handleDeposit = async () => {
    const depositAmount = parseFloat(amount);

    if (!depositAmount || depositAmount < MIN_DEPOSIT) {
      toast.error(`Please enter minimum amount of KSh ${MIN_DEPOSIT}`);
      return;
    }

    if (depositAmount > 100000) {
      toast.error('Maximum deposit is KSh 100,000');
      return;
    }

    setLoading(true);

    try {
      // Create transaction record
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'deposit',
          amount: depositAmount,
          status: 'completed',
          description: 'Manual deposit',
        });

      if (error) throw error;

      // Update user balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({ balance: Number(profile.balance) + depositAmount })
          .eq('id', userId);
      }

      toast.success('Deposit successful!');
      setAmount('');
      setOpen(false);
      onDepositSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process deposit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="bet" size="sm" className="gap-2">
          <Wallet className="h-4 w-4" />
          Deposit
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl">Deposit Funds</DialogTitle>
          <DialogDescription>
            Add money to your HelaKenya account (Minimum: KSh 100)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (KSh)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Quick Select</Label>
            <div className="grid grid-cols-2 gap-2">
              {quickAmounts.map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  onClick={() => setAmount(amt.toString())}
                  type="button"
                >
                  KSh {amt.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleDeposit}
            disabled={loading}
            variant="bet"
            className="w-full"
          >
            {loading ? 'Processing...' : 'Confirm Deposit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
