import Stripe from 'stripe';
import { supabaseAdmin } from './supabase';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Pricing
export const PRICES = {
  PRO_MONTHLY: 'price_1SlXYv10WYDzxg07V3HozeUt', // Replace with your Stripe price ID
  CREDITS_PACK_100: 'price_1SlXXV10WYDzxg07YUqthtNP', // $1 for 100 credits
  CREDITS_PACK_500: 'price_1SlXX510WYDzxg07d6OSBuJf', // $4 for 500 credits
};

export const PLAN_CREDITS = {
  free: 50,
  pro: 500,
};

export async function createOrGetCustomer(userId: string, email: string): Promise<string> {
  // Check if user already has a Stripe customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  
  if (user?.stripe_customer_id) {
    return user.stripe_customer_id;
  }
  
  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId,
    },
  });
  
  // Save to database
  await supabaseAdmin
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);
  
  return customer.id;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const customerId = await createOrGetCustomer(userId, email);
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: priceId === PRICES.PRO_MONTHLY ? 'subscription' : 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
    },
  });
  
  return session.url!;
}

export async function createPortalSession(userId: string): Promise<string> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  
  if (!user?.stripe_customer_id) {
    throw new Error('No Stripe customer found');
  }
  
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: process.env.NEXT_PUBLIC_APP_URL + '/settings',
  });
  
  return session.url;
}

export async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;
  
  // Find user by Stripe customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  
  if (!user) return;
  
  // Update user plan
  await supabaseAdmin
    .from('users')
    .update({
      plan_type: 'pro',
      monthly_credits: PLAN_CREDITS.pro,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', user.id);
  
  // Create subscription record
  await supabaseAdmin.from('subscriptions').insert({
    user_id: user.id,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0].price.id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  });
}

export async function handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  
  if (!user) return;
  
  // Downgrade to free
  await supabaseAdmin
    .from('users')
    .update({
      plan_type: 'free',
      monthly_credits: PLAN_CREDITS.free,
      stripe_subscription_id: null,
    })
    .eq('id', user.id);
  
  // Update subscription record
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id);
}

export async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const customerId = paymentIntent.customer as string;
  const metadata = paymentIntent.metadata;
  
  // If this is a credit pack purchase
  if (metadata.credits_amount) {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, bonus_credits')
      .eq('stripe_customer_id', customerId)
      .single();
    
    if (user) {
      const creditsToAdd = parseInt(metadata.credits_amount);
      await supabaseAdmin
        .from('users')
        .update({ bonus_credits: user.bonus_credits + creditsToAdd })
        .eq('id', user.id);
      
      // Log the purchase
      await supabaseAdmin.from('credit_adjustments').insert({
        user_id: user.id,
        credits_added: creditsToAdd,
        adjustment_type: 'promo',
        reason: `Purchased ${creditsToAdd} credits`,
      });
    }
  }
}


