import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface TransferRequest {
  credits?: number;
  isPro?: boolean;
  planType?: string;
  deviceId: string;
  reason?: string;
}

/**
 * Transfer Credits & Subscription Endpoint
 * 
 * Transfers locally stored data (credits & Pro subscription from anonymous purchases) to the user's account.
 * This is called when a user logs in after making purchases while not logged in.
 * 
 * Per Apple Guideline 5.1.1, users can purchase without logging in.
 * This endpoint ensures those purchases are properly credited to their account.
 */
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
    
    const { credits, isPro, planType, deviceId, reason }: TransferRequest = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    if (!credits && !isPro) {
      return res.status(400).json({ error: 'Nothing to transfer' });
    }
    
    // Get current user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('bonus_credits, plan_type, monthly_credits')
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.error('Error fetching user:', userError);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }
    
    // Prepare update data
    const updateData: any = {};
    
    // Transfer credits
    if (credits && credits > 0) {
      const currentBonus = userData?.bonus_credits || 0;
      updateData.bonus_credits = currentBonus + credits;
    }
    
    // Transfer Pro subscription
    if (isPro && planType === 'pro') {
      updateData.plan_type = 'pro';
      updateData.monthly_credits = 500; // Pro plan gets 500 credits/month
      
      console.log(`Pro subscription transferred: user=${user.id}, deviceId=${deviceId.substring(0, 8)}...`);
    }
    
    // Update user account
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Error updating user:', updateError);
      return res.status(500).json({ error: 'Failed to transfer data' });
    }
    
    // Log the transfer for audit purposes
    console.log(`Data transferred: user=${user.id}, credits=${credits || 0}, isPro=${isPro || false}, deviceId=${deviceId.substring(0, 8)}..., reason=${reason || 'anonymous_transfer'}`);
    
    return res.status(200).json({
      success: true,
      credits: updateData.bonus_credits,
      planType: updateData.plan_type || userData?.plan_type,
      transferred: {
        credits: credits || 0,
        isPro: isPro || false
      },
      message: 'Successfully transferred your purchases to your account'
    });
    
  } catch (error: any) {
    console.error('Transfer data error:', error);
    
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Failed to transfer data' });
  }
}
