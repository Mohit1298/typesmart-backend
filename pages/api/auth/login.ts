import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserByEmail, getAvailableCredits } from '@/lib/supabase';
import { verifyPassword, generateToken } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Get user
    const user = await getUserByEmail(email);
    
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
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
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
}






