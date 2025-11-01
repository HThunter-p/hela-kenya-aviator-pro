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
      // Get current balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const newBalance = parseFloat(profile.balance.toString()) + depositAmount;

      // Update balance
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Record transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: depositAmount,
          type: 'deposit',
          description: 'Deposit to account',
        });

      if (transactionError) throw transactionError;

      toast.success(`Successfully deposited KSh ${depositAmount.toLocaleString()}!`);
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

          <p className="text-xs text-muted-foreground text-center">
            This is demo mode. No real money is being deposited.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
