import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, amount, user_id, withdrawal_id } = await req.json();

    console.log('Initiating Lipana B2C withdrawal:', { phone_number, amount, user_id, withdrawal_id });

    // Validate inputs
    if (!phone_number || !amount || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Phone number, amount, and user ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount is a positive number within limits
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 50 || numericAmount > 70000) {
      return new Response(
        JSON.stringify({ error: 'Amount must be between 50 and 70,000 KSh' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone number format (Kenyan format)
    const phoneRegex = /^(?:254|\+254|0)?[17]\d{8}$/;
    if (!phoneRegex.test(phone_number.replace(/\s/g, ''))) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number to international format
    let formattedPhone = phone_number.replace(/\s/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('254')) {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Lipana API key from environment
    const lipanaSecretKey = Deno.env.get('LIPANA_SECRET_KEY');

    if (!lipanaSecretKey) {
      console.error('Missing Lipana API key');
      
      // Update withdrawal status to failed if withdrawal_id is provided
      if (withdrawal_id) {
        await supabaseClient
          .from('withdrawals')
          .update({ 
            status: 'rejected',
            rejection_reason: 'Payment service configuration error',
            updated_at: new Date().toISOString()
          })
          .eq('id', withdrawal_id);
      }

      return new Response(
        JSON.stringify({ error: 'Payment service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Making request to Lipana B2C API...');

    // Make request to Lipana B2C API for payouts
    const lipanaResponse = await fetch('https://api.lipana.dev/v1/transactions/b2c', {
      method: 'POST',
      headers: {
        'x-api-key': lipanaSecretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        amount: Math.round(numericAmount),
      }),
    });

    const responseData = await lipanaResponse.json();
    console.log('Lipana API response:', responseData);

    if (!lipanaResponse.ok || !responseData.success) {
      console.error('Lipana API error:', responseData);
      
      // Update withdrawal status to failed if withdrawal_id is provided
      if (withdrawal_id) {
        await supabaseClient
          .from('withdrawals')
          .update({ 
            status: 'rejected',
            rejection_reason: responseData.message || 'Payment processing failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', withdrawal_id);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Withdrawal failed', 
          details: responseData.message || responseData 
        }),
        { status: lipanaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update withdrawal status to completed if withdrawal_id is provided
    if (withdrawal_id && responseData.success) {
      await supabaseClient
        .from('withdrawals')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawal_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData.data,
        message: 'Withdrawal processed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in lipana-withdrawal function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
