import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  phone_number: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile details separately
      const withdrawalsWithProfiles = await Promise.all(
        (data || []).map(async (withdrawal) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', withdrawal.user_id)
            .single();

          return {
            ...withdrawal,
            profiles: profileData || { full_name: 'Unknown', email: 'Unknown' },
          };
        })
      );

      setWithdrawals(withdrawalsWithProfiles);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleApprove = async (withdrawalId: string, userId: string, phoneNumber: string, amount: number) => {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({
          status: 'completed',
          approved_at: new Date().toISOString(),
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast.success(
        `Withdrawal approved! Send KSh ${amount.toLocaleString()} to ${phoneNumber} via M-Pesa manually.`,
        { duration: 10000 }
      );
      fetchWithdrawals();
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      toast.error('Failed to approve withdrawal');
    }
  };

  const handleReject = async (withdrawalId: string, userId: string, amount: number) => {
    try {
      // Use atomic balance refund to prevent race conditions
      const { error: refundError } = await supabase
        .rpc('add_balance_atomic', {
          p_user_id: userId,
          p_amount: amount
        });

      if (refundError) throw refundError;

      // Update withdrawal status
      const { error } = await supabase
        .from('withdrawals')
        .update({
          status: 'failed',
          rejection_reason: 'Rejected by admin',
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      // Record refund transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: amount,
          type: 'deposit',
          description: 'Withdrawal refund (rejected by admin)',
        });

      toast.success('Withdrawal rejected and amount refunded');
      fetchWithdrawals();
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      toast.error('Failed to reject withdrawal');
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-600">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Withdrawal Management</h2>
      
      {withdrawals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No withdrawal requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {withdrawals.map((withdrawal) => (
            <div
              key={withdrawal.id}
              className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{withdrawal.profiles.full_name}</p>
                  {getStatusBadge(withdrawal.status)}
                </div>
                <p className="text-sm text-muted-foreground">{withdrawal.profiles.email}</p>
                <p className="text-sm text-muted-foreground">Phone: {withdrawal.phone_number}</p>
                <p className="text-lg font-bold text-primary mt-2">
                  KSh {withdrawal.amount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(withdrawal.created_at).toLocaleString()}
                </p>
              </div>

              {withdrawal.status === 'pending' && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    After approving, manually send M-Pesa to: <strong>{withdrawal.phone_number}</strong>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(withdrawal.id, withdrawal.user_id, withdrawal.phone_number, withdrawal.amount)}
                      className="gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve & Mark Sent
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(withdrawal.id, withdrawal.user_id, withdrawal.amount)}
                      className="gap-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
