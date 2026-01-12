import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth';
import { addBonusCredits, getUserById, getAvailableCredits } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const admin = await requireAdmin(req);
    
    const { userId } = req.query;
    const { credits, reason } = req.body;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!credits || typeof credits !== 'number') {
      return res.status(400).json({ error: 'Credits amount is required' });
    }
    
    // Get user
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add credits
    const success = await addBonusCredits(
      userId,
      credits,
      reason || 'Admin credit adjustment',
      admin.email
    );
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to add credits' });
    }
    
    // Get updated balance
    const newCredits = await getAvailableCredits(userId);
    
    return res.status(200).json({
      success: true,
      message: `Added ${credits} credits to ${user.email}`,
      user: {
        id: user.id,
        email: user.email,
        newCreditBalance: newCredits,
      },
    });
    
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Add credits error:', error);
    return res.status(500).json({ error: 'Failed to add credits' });
  }
}






