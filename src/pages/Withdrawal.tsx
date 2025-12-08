import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Wallet, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const withdrawalSchema = z.object({
  amount: z.number().min(100, 'Minimum withdrawal is KSh 100'),
  phoneNumber: z.string().regex(/^(?:\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number'),
});

interface Withdrawal {
  id: string;
  amount: number;
  phone_number: string;
  status: string;
  created_at: string;
}

export default function Withdrawal() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile(user?.id);
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile?.phone_number) {
      setPhoneNumber(profile.phone_number);
    }
  }, [profile]);

  const fetchWithdrawals = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to load withdrawal history');
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [user?.id]);

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id || !profile) {
      toast.error('Please log in to withdraw');
      return;
    }

    if (!profile.phone_number) {
      toast.error('Please add a phone number to your profile to enable withdrawals');
      return;
    }

    setLoading(true);

    try {
      const withdrawalData = {
        amount: parseFloat(amount),
        phoneNumber: phoneNumber,
      };

      withdrawalSchema.parse(withdrawalData);

      if (withdrawalData.amount > profile.balance) {
        toast.error('Insufficient balance');
        setLoading(false);
        return;
      }

      // Use atomic balance deduction to prevent race conditions
      const { data: updateResult, error: balanceError } = await supabase
        .rpc('deduct_balance_atomic', {
          p_user_id: user.id,
          p_amount: withdrawalData.amount
        });

      if (balanceError || !updateResult) {
        throw new Error('Insufficient balance or failed to deduct');
      }

      // Create withdrawal request (pending admin approval)
      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          amount: withdrawalData.amount,
          phone_number: withdrawalData.phoneNumber,
          status: 'pending',
        });

      if (withdrawalError) throw withdrawalError;

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: -withdrawalData.amount,
        type: 'withdrawal',
        description: `Withdrawal request to ${withdrawalData.phoneNumber} (pending approval)`,
      });

      toast.success('Withdrawal request submitted! Admin will review and process it manually.');
      setAmount('');
      refetchProfile();
      fetchWithdrawals();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Withdrawal error:', error);
        toast.error(error.message || 'Failed to process withdrawal');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'processing': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Game
        </Button>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Withdraw Funds</h1>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-primary">Admin Approval Required</p>
                <p className="text-sm text-muted-foreground">
                  Withdrawals are manually processed by admin. Your request will be reviewed and M-Pesa payment will be sent within 24 hours.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
            <p className="text-3xl font-bold">KSh {profile?.balance.toLocaleString() || '0'}</p>
          </div>

          <form onSubmit={handleWithdrawal} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Withdrawal Amount (KSh)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount (min. 100)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="100"
                step="10"
                required
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
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Submitting Request...' : 'Submit Withdrawal Request'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Withdrawal History</h2>
          {loadingWithdrawals ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No withdrawals yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium">KSh {withdrawal.amount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{withdrawal.phone_number}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium capitalize ${getStatusColor(withdrawal.status)}`}>
                      {withdrawal.status === 'pending' ? 'Awaiting Approval' : withdrawal.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(withdrawal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}