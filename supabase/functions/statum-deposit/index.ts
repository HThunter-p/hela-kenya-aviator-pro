import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { phone_number, amount, short_code } = await req.json();

    console.log('Initiating Statum deposit:', { phone_number, amount, short_code });

    // Validate inputs
    if (!phone_number || !amount) {
      return new Response(
        JSON.stringify({ error: 'Phone number and amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Statum credentials from environment
    const consumerKey = Deno.env.get('STUTUM_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('STUTUM_SECRET_KEY');

    if (!consumerKey || !consumerSecret) {
      console.error('Missing Statum credentials');
      return new Response(
        JSON.stringify({ error: 'Payment service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Basic Auth header
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);
    const authHeader = `Basic ${credentials}`;

    console.log('Making request to Statum API...');

    // Make request to Statum STK Push API
    const statumResponse = await fetch('https://api.statum.co.ke/api/v2/mpesa-online', {
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
      return new Response(
        JSON.stringify({ 
          error: 'Payment initiation failed', 
          details: responseData 
        }),
        { status: statumResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
        message: 'Payment request sent. Please check your phone to complete the payment.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in statum-deposit function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
