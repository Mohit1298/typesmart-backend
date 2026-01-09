import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAppleToken, getOrCreateAppleUser, generateToken } from '@/lib/auth';
import { getAvailableCredits } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { identityToken, email: providedEmail, fullName } = req.body;
    
    if (!identityToken) {
      return res.status(400).json({ error: 'Identity token is required' });
    }
    
    // Verify Apple token
    const appleData = await verifyAppleToken(identityToken);
    
    if (!appleData) {
      return res.status(401).json({ error: 'Invalid Apple identity token' });
    }
    
    // Use provided email if available (Apple only sends email on first sign in)
    const email = providedEmail || appleData.email;
    
    // Get or create user
    const user = await getOrCreateAppleUser(appleData.appleUserId, email);
    
    // Generate token
    const token = generateToken(user);
    
    // Get available credits
    const credits = await getAvailableCredits(user.id);
    
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        planType: user.plan_type,
        credits,
        isVip: user.is_vip,
      },
      token,
    });
    
  } catch (error: any) {
    console.error('Apple auth error:', error);
    return res.status(500).json({ error: 'Apple sign in failed' });
  }
}



