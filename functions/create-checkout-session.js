export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...responseHeaders(), Allow: 'POST' },
    });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY environment binding.' }), {
      status: 500,
      headers: responseHeaders(),
    });
  }

  let email;

  try {
    const body = await request.json();
    email = body?.email?.trim();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request payload.' }), {
      status: 400,
      headers: responseHeaders(),
    });
  }

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Please provide a valid email so we can send your receipt.' }), {
      status: 400,
      headers: responseHeaders(),
    });
  }

  const requestUrl = new URL(request.url);
  const origin = `${requestUrl.protocol}//${requestUrl.host}`;
  const successUrl = `${origin}/success.html`;
  const cancelUrl = `${origin}/cancel.html`;

  const form = new URLSearchParams();
  form.append('mode', 'payment');
  form.append('payment_method_types[0]', 'card');
  form.append('success_url', successUrl);
  form.append('cancel_url', cancelUrl);
  form.append('customer_email', email);
  form.append('payment_intent_data[receipt_email]', email);
  form.append('shipping_address_collection[allowed_countries][0]', 'GB');

  form.append('line_items[0][quantity]', '1');
  form.append('line_items[0][price_data][currency]', 'gbp');
  form.append('line_items[0][price_data][unit_amount]', '500');
  form.append('line_items[0][price_data][product_data][name]', 'Still tag');
  form.append('line_items[0][price_data][product_data][description]', 'One Still tag to help you pause and resume your routine.');

  form.append('shipping_options[0][shipping_rate_data][display_name]', 'Royal Mail 2nd Class (free)');
  form.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  form.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '0');
  form.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'gbp');

  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const payload = await stripeResponse.json();

    if (!stripeResponse.ok || !payload?.url) {
      const message = payload?.error?.message || 'Unable to create Stripe Checkout session.';
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: responseHeaders(),
      });
    }

    return new Response(JSON.stringify({ url: payload.url }), {
      status: 200,
      headers: responseHeaders(),
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unexpected error creating Stripe Checkout session.' }), {
      status: 500,
      headers: responseHeaders(),
    });
  }
}

function responseHeaders() {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}
