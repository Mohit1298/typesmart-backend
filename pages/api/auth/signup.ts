import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, generateToken } from '@/lib/auth';

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
    
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        plan_type: 'free',
        monthly_credits: 50,
        bonus_credits: 0,
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Generate token
    const token = generateToken(user);
    
    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        planType: user.plan_type,
        credits: user.monthly_credits + user.bonus_credits,
      },
      token,
    });
    
  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}






