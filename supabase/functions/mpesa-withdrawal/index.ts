import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to get M-Pesa access token
async function getMpesaAccessToken() {
  const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
  const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
  
  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  
  const response = await fetch(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    }
  );
  
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, phoneNumber, userId } = await req.json();
    
    console.log('Processing M-Pesa withdrawal request:', { amount, phoneNumber, userId });

    // Validate input
    if (!amount || !phoneNumber || !userId) {
      throw new Error('Missing required fields');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user has sufficient balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    if (profile.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Get access token
    const accessToken = await getMpesaAccessToken();
    console.log('Got M-Pesa access token');

    // Prepare B2C request
    const initiatorName = Deno.env.get('MPESA_INITIATOR_NAME');
    const securityCredential = Deno.env.get('MPESA_SECURITY_CREDENTIAL');
    const businessShortCode = Deno.env.get('MPESA_BUSINESS_SHORT_CODE');
    const partyB = Deno.env.get('MPESA_PARTY_B');

    // Format phone number
    let formattedPhone = phoneNumber.replace(/\s/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;

    const b2cPayload = {
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'BusinessPayment',
      Amount: Math.round(amount),
      PartyA: businessShortCode,
      PartyB: formattedPhone,
      Remarks: 'Withdrawal from game account',
      QueueTimeOutURL: callbackUrl,
      ResultURL: callbackUrl,
      Occasion: `WD${userId.slice(0, 8)}`,
    };

    console.log('Sending B2C request:', { ...b2cPayload, SecurityCredential: '***' });

    // Send B2C request
    const b2cResponse = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(b2cPayload),
      }
    );

    const b2cData = await b2cResponse.json();
    console.log('B2C response:', b2cData);

    if (b2cData.ResponseCode !== '0') {
      throw new Error(b2cData.ResponseDescription || 'B2C payment failed');
    }

    // Update user balance
    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: profile.balance - amount })
      .eq('id', userId);

    if (balanceError) {
      console.error('Error updating balance:', balanceError);
      throw new Error('Failed to update balance');
    }

    // Create withdrawal record
    const { error: withdrawalError } = await supabase
      .from('withdrawals')
      .insert({
        user_id: userId,
        amount: amount,
        phone_number: phoneNumber,
        status: 'pending',
      });

    if (withdrawalError) {
      console.error('Error creating withdrawal record:', withdrawalError);
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'withdrawal',
        amount: amount,
        status: 'pending',
        description: `M-Pesa withdrawal - ConversationID: ${b2cData.ConversationID}`,
      });

    if (transactionError) {
      console.error('Error storing transaction:', transactionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Withdrawal request sent successfully. You will receive payment shortly.',
        conversationId: b2cData.ConversationID,
        originatorConversationId: b2cData.OriginatorConversationID,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in mpesa-withdrawal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
