import { useState, useEffect } from 'react';
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
  const [needsPhone, setNeedsPhone] = useState(false);

  const quickAmounts = [100, 500, 1000, 5000];
  const MIN_DEPOSIT = 100;

  useEffect(() => {
    if (open) {
      loadPhoneNumber();
    }
  }, [open]);

  const loadPhoneNumber = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', userId)
        .single();

      if (profile?.phone_number) {
        setPhoneNumber(profile.phone_number);
        setNeedsPhone(false);
      } else {
        setNeedsPhone(true);
      }
    } catch (error) {
      console.error('Error loading phone number:', error);
      setNeedsPhone(true);
    }
  };

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

    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid M-Pesa phone number');
      return;
    }

    setLoading(true);

    try {
      // If phone number was just entered, save it to profile
      if (needsPhone) {
        await supabase
          .from('profiles')
          .update({ phone_number: phoneNumber })
          .eq('id', userId);
      }

      // Call Statum deposit API
      const { data, error } = await supabase.functions.invoke('statum-deposit', {
        body: {
          phone_number: phoneNumber,
          amount: depositAmount,
          short_code: '', // Optional, can be configured
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'STK push sent! Please check your phone to complete payment.');
        setAmount('');
        setOpen(false);
        onDepositSuccess();
      } else {
        throw new Error(data?.error || 'Failed to initiate payment');
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
            <Label htmlFor="phone">M-Pesa Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="254712345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="text-lg"
            />
          </div>

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
