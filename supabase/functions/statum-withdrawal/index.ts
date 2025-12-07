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
    const { phone_number, amount, short_code, user_id, withdrawal_id } = await req.json();

    console.log('Initiating Statum withdrawal:', { phone_number, amount, short_code, user_id, withdrawal_id });

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

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Statum credentials from environment
    const consumerKey = Deno.env.get('STUTUM_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('STUTUM_SECRET_KEY');

    if (!consumerKey || !consumerSecret) {
      console.error('Missing Statum credentials');
      
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

    // Create Basic Auth header
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);
    const authHeader = `Basic ${credentials}`;

    console.log('Making request to Statum B2C API...');

    // Make request to Statum B2C API
    const statumResponse = await fetch('https://api.statum.co.ke/api/v2/mpesa-wallet', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phone_number,
        amount: amount.toString(),
        short_code: short_code || '',
      }),
    });

    const responseData = await statumResponse.json();
    console.log('Statum API response:', responseData);

    if (!statumResponse.ok) {
      console.error('Statum API error:', responseData);
      
      // Update withdrawal status to failed if withdrawal_id is provided
      if (withdrawal_id) {
        await supabaseClient
          .from('withdrawals')
          .update({ 
            status: 'rejected',
            rejection_reason: responseData.description || 'Payment processing failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', withdrawal_id);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Withdrawal failed', 
          details: responseData 
        }),
        { status: statumResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update withdrawal status to completed if withdrawal_id is provided
    if (withdrawal_id && responseData.status_code === 200) {
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
        data: responseData,
        message: 'Withdrawal processed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in statum-withdrawal function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Update withdrawal status to failed if withdrawal_id is provided
    if (req.body) {
      try {
        const body = await req.json();
        if (body.withdrawal_id) {
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );
          
          await supabaseClient
            .from('withdrawals')
            .update({ 
              status: 'rejected',
              rejection_reason: errorMessage,
              updated_at: new Date().toISOString()
            })
            .eq('id', body.withdrawal_id);
        }
      } catch (e) {
        console.error('Error updating withdrawal status:', e);
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
