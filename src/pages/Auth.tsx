import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plane, Mail, Phone, Chrome } from 'lucide-react';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phoneNumber: z.string().regex(/^(?:\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number (e.g., +254712345678 or 0712345678)'),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const phoneSchema = z.string().regex(/^(?:\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number');

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    fullName: '',
    phoneNumber: '',
  });

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      toast.info('Signing up with referral code!');
    }
  }, [searchParams]);

  const [signInData, setSignInData] = useState({
    email: '',
    password: '',
  });

  const formatPhoneNumber = (phone: string): string => {
    if (phone.startsWith('0')) {
      return '+254' + phone.slice(1);
    }
    return phone;
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      toast.error('An error occurred during Google sign in');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneOtpSend = async () => {
    setLoading(true);
    try {
      phoneSchema.parse(phoneNumber);
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setOtpSent(true);
      toast.success('OTP sent to your phone!');
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => toast.error(err.message));
      } else {
        toast.error('An error occurred sending OTP');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneOtpVerify = async () => {
    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        // Handle referral for phone sign up
        if (referralCode) {
          const { data: referrerData } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', referralCode)
            .maybeSingle();

          if (referrerData) {
            await supabase
              .from('profiles')
              .update({ referrer_id: referrerData.id })
              .eq('id', data.user.id);

            await supabase
              .from('referrals')
              .insert({
                referrer_id: referrerData.id,
                referred_id: data.user.id,
              });
          }
        }

        toast.success('Welcome to HelaKenya!');
        navigate('/');
      }
    } catch (error) {
      toast.error('An error occurred verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signUpSchema.parse(signUpData);
      
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            full_name: validated.fullName,
            phone_number: validated.phoneNumber,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        if (referralCode) {
          const { data: referrerData } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', referralCode)
            .maybeSingle();

          if (referrerData) {
            await supabase
              .from('profiles')
              .update({ referrer_id: referrerData.id })
              .eq('id', data.user.id);

            await supabase
              .from('referrals')
              .insert({
                referrer_id: referrerData.id,
                referred_id: data.user.id,
              });
          }
        }

        toast.success('Account created successfully! Welcome to HelaKenya!');
        navigate('/');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => toast.error(err.message));
      } else {
        toast.error('An error occurred during sign up');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signInSchema.parse(signInData);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password');
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        toast.success('Welcome back to HelaKenya!');
        navigate('/');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => toast.error(err.message));
      } else {
        toast.error('An error occurred during sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-game flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Plane className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-black text-primary">HelaKenya</h1>
            <p className="text-sm text-muted-foreground">Aviator Game</p>
          </div>
        </div>

        {/* Google Sign In Button */}
        <Button
          variant="outline"
          className="w-full mb-4 gap-2"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <Chrome className="h-5 w-5" />
          Continue with Google
        </Button>

        <div className="relative my-4">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            or continue with
          </span>
        </div>

        {/* Auth Method Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={authMethod === 'email' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => {
              setAuthMethod('email');
              setOtpSent(false);
            }}
          >
            <Mail className="h-4 w-4" />
            Email
          </Button>
          <Button
            variant={authMethod === 'phone' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => {
              setAuthMethod('phone');
              setOtpSent(false);
            }}
          >
            <Phone className="h-4 w-4" />
            Phone
          </Button>
        </div>

        {authMethod === 'phone' ? (
          <div className="space-y-4">
            {!otpSent ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+254712345678 or 0712345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                </div>
                <Button
                  variant="bet"
                  className="w-full"
                  onClick={handlePhoneOtpSend}
                  disabled={loading}
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    OTP sent to {phoneNumber}
                  </p>
                </div>
                <Button
                  variant="bet"
                  className="w-full"
                  onClick={handlePhoneOtpVerify}
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp('');
                  }}
                >
                  Change phone number
                </Button>
              </>
            )}
          </div>
        ) : (
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signInData.email}
                    onChange={(e) =>
                      setSignInData({ ...signInData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={signInData.password}
                    onChange={(e) =>
                      setSignInData({ ...signInData, password: e.target.value })
                    }
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="bet"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signUpData.fullName}
                    onChange={(e) =>
                      setSignUpData({ ...signUpData, fullName: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signUpData.email}
                    onChange={(e) =>
                      setSignUpData({ ...signUpData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signUpData.password}
                    onChange={(e) =>
                      setSignUpData({ ...signUpData, password: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone Number</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+254712345678 or 0712345678"
                    value={signUpData.phoneNumber}
                    onChange={(e) =>
                      setSignUpData({ ...signUpData, phoneNumber: e.target.value })
                    }
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="bet"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Demo Mode • Play Money Only</p>
          <p className="mt-1">Start with KSh 10,000</p>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
