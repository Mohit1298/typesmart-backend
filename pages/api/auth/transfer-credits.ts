import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface TransferRequest {
  credits: number;
  deviceId: string;
  reason?: string;
}

/**
 * Transfer Credits Endpoint
 * 
 * Transfers locally stored credits (from anonymous purchases) to the user's account.
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
    
    const { credits, deviceId, reason }: TransferRequest = req.body;
    
    if (!credits || credits <= 0) {
      return res.status(400).json({ error: 'Invalid credits amount' });
    }
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    // Get current user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('bonus_credits')
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.error('Error fetching user:', userError);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }
    
    // Add transferred credits to bonus_credits
    const currentBonus = userData?.bonus_credits || 0;
    const newBonus = currentBonus + credits;
    
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ bonus_credits: newBonus })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Error updating credits:', updateError);
      return res.status(500).json({ error: 'Failed to transfer credits' });
    }
    
    // Log the transfer for audit purposes
    console.log(`Credits transferred: user=${user.id}, amount=${credits}, deviceId=${deviceId.substring(0, 8)}..., reason=${reason || 'anonymous_transfer'}`);
    
    // Optionally, record this in a transfers table for tracking
    // await supabaseAdmin.from('credit_transfers').insert({ ... });
    
    return res.status(200).json({
      success: true,
      credits: newBonus,
      transferred: credits,
      message: `Successfully transferred ${credits} credits to your account`
    });
    
  } catch (error: any) {
    console.error('Transfer credits error:', error);
    
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Failed to transfer credits' });
  }
}
