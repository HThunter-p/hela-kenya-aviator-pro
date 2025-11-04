import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Users, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Referral {
  id: string;
  referred_id: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function Referral() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(true);

  const referralLink = profile?.referral_code 
    ? `${window.location.origin}/auth?ref=${profile.referral_code}`
    : '';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchReferrals = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('referrals')
          .select(`
            id,
            referred_id,
            created_at
          `)
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch profile details separately
        const referralData = await Promise.all(
          (data || []).map(async (referral) => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', referral.referred_id)
              .single();

            return {
              ...referral,
              profiles: profileData || { full_name: 'Unknown', email: 'Unknown' },
            };
          })
        );

        setReferrals(referralData);
        setLoadingReferrals(false);
        return;
      } catch (error) {
        console.error('Error fetching referrals:', error);
        toast.error('Failed to load referrals');
      } finally {
        setLoadingReferrals(false);
      }
    };

    fetchReferrals();
  }, [user?.id]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied to clipboard!');
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
          <h1 className="text-3xl font-bold mb-2">Referral Program</h1>
          <p className="text-muted-foreground mb-6">
            Share your unique referral link and earn rewards when your friends sign up!
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Referral Link</label>
              <div className="flex gap-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={copyToClipboard} size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Total Referrals</h3>
              </div>
              <p className="text-3xl font-bold">{referrals.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Your Referrals</h2>
          {loadingReferrals ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No referrals yet. Start sharing your link!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{referral.profiles.full_name}</p>
                    <p className="text-sm text-muted-foreground">{referral.profiles.email}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(referral.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

