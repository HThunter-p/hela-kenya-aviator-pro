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
      // Get current profile with referrer info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('balance, first_deposit_made, referrer_id')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const newBalance = parseFloat(profile.balance.toString()) + depositAmount;
      const isFirstDeposit = !profile.first_deposit_made;

      // Update balance and first deposit flag
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          balance: newBalance,
          first_deposit_made: true 
        })
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

      // Handle referral bonus (10% of first deposit)
      if (isFirstDeposit && profile.referrer_id) {
        const bonusAmount = depositAmount * 0.1;
        
        // Get referrer's current balance
        const { data: referrerProfile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', profile.referrer_id)
          .single();

        if (referrerProfile) {
          const referrerNewBalance = parseFloat(referrerProfile.balance.toString()) + bonusAmount;
          
          // Update referrer's balance
          await supabase
            .from('profiles')
            .update({ balance: referrerNewBalance })
            .eq('id', profile.referrer_id);

          // Record referral bonus transaction
          await supabase
            .from('transactions')
            .insert({
              user_id: profile.referrer_id,
              amount: bonusAmount,
              type: 'deposit',
              description: `Referral bonus (10% of KSh ${depositAmount.toLocaleString()})`,
            });
        }
      }

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
