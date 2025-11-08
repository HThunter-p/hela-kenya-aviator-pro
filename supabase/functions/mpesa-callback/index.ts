import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('M-Pesa callback received:', JSON.stringify(payload, null, 2));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle STK Push callback (deposit)
    if (payload.Body?.stkCallback) {
      const callback = payload.Body.stkCallback;
      const resultCode = callback.ResultCode;
      const checkoutRequestId = callback.CheckoutRequestID;

      console.log('Processing STK callback:', { resultCode, checkoutRequestId });

      if (resultCode === 0) {
        // Payment successful
        const callbackMetadata = callback.CallbackMetadata?.Item || [];
        const amount = callbackMetadata.find((item: any) => item.Name === 'Amount')?.Value || 0;
        const mpesaReceiptNumber = callbackMetadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
        const phoneNumber = callbackMetadata.find((item: any) => item.Name === 'PhoneNumber')?.Value;

        console.log('Payment successful:', { amount, mpesaReceiptNumber, phoneNumber });

        // Find the pending transaction
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('user_id')
          .eq('description', `M-Pesa deposit - CheckoutRequestID: ${checkoutRequestId}`)
          .eq('status', 'pending')
          .limit(1);

        if (txError || !transactions || transactions.length === 0) {
          console.error('Transaction not found:', txError);
          return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const userId = transactions[0].user_id;

        // Update user balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance, first_deposit_made')
          .eq('id', userId)
          .single();

        if (profile) {
          const newBalance = Number(profile.balance) + Number(amount);
          
          await supabase
            .from('profiles')
            .update({ 
              balance: newBalance,
              first_deposit_made: true 
            })
            .eq('id', userId);

          console.log('Balance updated:', { userId, newBalance });
        }

        // Update transaction status
        await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            description: `M-Pesa deposit - Receipt: ${mpesaReceiptNumber}`
          })
          .eq('description', `M-Pesa deposit - CheckoutRequestID: ${checkoutRequestId}`)
          .eq('status', 'pending');
      } else {
        // Payment failed
        console.log('Payment failed:', callback.ResultDesc);
        
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('description', `M-Pesa deposit - CheckoutRequestID: ${checkoutRequestId}`)
          .eq('status', 'pending');
      }
    }

    // Handle B2C callback (withdrawal)
    if (payload.Result) {
      const result = payload.Result;
      const resultCode = result.ResultCode;
      const conversationId = result.ConversationID;

      console.log('Processing B2C callback:', { resultCode, conversationId });

      if (resultCode === 0) {
        // Withdrawal successful
        const resultParameters = result.ResultParameters?.ResultParameter || [];
        const transactionReceipt = resultParameters.find((param: any) => param.Key === 'TransactionReceipt')?.Value;

        console.log('Withdrawal successful:', { transactionReceipt });

        // Update withdrawal status
        await supabase
          .from('withdrawals')
          .update({ status: 'completed', approved_at: new Date().toISOString() })
          .eq('status', 'pending');

        // Update transaction status
        await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            description: `M-Pesa withdrawal - Receipt: ${transactionReceipt}`
          })
          .eq('description', `M-Pesa withdrawal - ConversationID: ${conversationId}`)
          .eq('status', 'pending');
      } else {
        // Withdrawal failed
        console.log('Withdrawal failed:', result.ResultDesc);
        
        await supabase
          .from('withdrawals')
          .update({ 
            status: 'rejected',
            rejection_reason: result.ResultDesc
          })
          .eq('status', 'pending');

        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('description', `M-Pesa withdrawal - ConversationID: ${conversationId}`)
          .eq('status', 'pending');
      }
    }

    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in mpesa-callback:', error);
    return new Response(
      JSON.stringify({ ResultCode: 1, ResultDesc: 'Failed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
