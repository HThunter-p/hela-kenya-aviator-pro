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
  const [phoneNumber, setPhoneNumber] = useState('');
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

    if (!phoneNumber) {
      toast.error('Please enter your M-Pesa phone number');
      return;
    }

    setLoading(true);

    try {
      // Call M-Pesa deposit edge function
      const { data, error } = await supabase.functions.invoke('mpesa-deposit', {
        body: {
          amount: depositAmount,
          phoneNumber: phoneNumber,
          userId: userId,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || 'STK Push sent successfully. Please check your phone.');
        setAmount('');
        setPhoneNumber('');
        setOpen(false);
        onDepositSuccess();
      } else {
        throw new Error(data.error || 'Failed to initiate deposit');
      }
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
            <Label htmlFor="phoneNumber">M-Pesa Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+254712345678 or 0712345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
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
            You will receive an M-Pesa STK push on your phone to complete the deposit.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
