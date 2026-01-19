import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin, getAvailableCredits } from '@/lib/supabase';

// Product ID to credits mapping
const PRODUCT_CREDITS: Record<string, number> = {
  'com.wirtel.TypeSmart.credits.100': 100,
  'com.wirtel.TypeSmart.credits.500': 500,
};

// Pro subscription product ID
const PRO_MONTHLY_PRODUCT_ID = 'com.wirtel.TypeSmart.pro.monthly';

// Pro subscription monthly credits
const PRO_MONTHLY_CREDITS = 500;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await requireAuth(req);
    
    const { productId, transactionId, originalTransactionId } = req.body;

    if (!productId || !transactionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if this transaction was already processed
    const { data: existingTransaction } = await supabaseAdmin
      .from('iap_transactions')
      .select('id')
      .eq('transaction_id', transactionId)
      .single();

    if (existingTransaction) {
      // Transaction already processed - return current credits and plan
      const credits = await getAvailableCredits(user.id);
      return res.status(200).json({
        success: true,
        message: 'Transaction already processed',
        credits: credits,
        planType: user.plan_type,  // Include current plan type
      });
    }

    // Determine credits to add based on product
    let creditsToAdd = 0;
    let isSubscription = false;

    if (productId === PRO_MONTHLY_PRODUCT_ID) {
      // Pro subscription
      isSubscription = true;
      creditsToAdd = PRO_MONTHLY_CREDITS;
      
      // Update user to Pro plan and reset monthly usage
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          plan_type: 'pro',
          monthly_credits: PRO_MONTHLY_CREDITS,
          monthly_credits_used: 0,  // Reset usage so user gets full 500 credits
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('Failed to update user to Pro:', updateError);
        throw new Error('Failed to update subscription');
      }
      
      console.log(`✅ User ${user.id} upgraded to Pro plan`);
    } else if (PRODUCT_CREDITS[productId]) {
      // Credit pack purchase
      creditsToAdd = PRODUCT_CREDITS[productId];
      
      // Add to bonus credits
      const { error: creditError } = await supabaseAdmin
        .from('users')
        .update({
          bonus_credits: user.bonus_credits + creditsToAdd,
        })
        .eq('id', user.id);
      
      if (creditError) {
        console.error('Failed to add bonus credits:', creditError);
        throw new Error('Failed to add credits');
      }
      
      console.log(`✅ Added ${creditsToAdd} bonus credits to user ${user.id}`);
    } else {
      return res.status(400).json({ error: 'Unknown product ID' });
    }

    // Record the transaction
    const { error: txError } = await supabaseAdmin
      .from('iap_transactions')
      .insert({
        user_id: user.id,
        transaction_id: transactionId,
        original_transaction_id: originalTransactionId || transactionId,
        product_id: productId,
        credits_added: creditsToAdd,
        is_subscription: isSubscription,
      });
    
    if (txError) {
      console.error('Failed to record transaction:', txError);
      // Don't throw - user already got their credits/subscription
    }

    // Get updated credits
    const credits = await getAvailableCredits(user.id);

    return res.status(200).json({
      success: true,
      credits: credits,
      creditsAdded: creditsToAdd,
      productId,
      planType: isSubscription ? 'pro' : user.plan_type,
    });

  } catch (error: any) {
    console.error('IAP validation error:', error);
    
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Failed to validate purchase' });
  }
}

