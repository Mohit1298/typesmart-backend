import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth';
import { getAvailableCredits } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req);
    const credits = await getAvailableCredits(user.id);
    
    const monthlyRemaining = Math.max(0, user.monthly_credits - user.monthly_credits_used);
    
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        planType: user.plan_type,
        credits: {
          total: credits,
          monthlyRemaining,
          monthlyTotal: user.monthly_credits,
          bonus: user.bonus_credits,
          resetsAt: user.credits_reset_date,
        },
        isVip: user.is_vip,
        createdAt: user.created_at,
      },
    });
    
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Failed to get user data' });
  }
}

