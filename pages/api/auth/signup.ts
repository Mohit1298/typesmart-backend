import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, generateToken, verifyAppleToken } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, localCreditsToMerge, deviceId, appleIdentityToken } = req.body;
    
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
    
    // Determine if signup email matches device's Apple ID
    // If appleIdentityToken is provided, verify it and check if emails match
    let emailMatchesAppleId = false;
    
    if (appleIdentityToken) {
      const appleData = await verifyAppleToken(appleIdentityToken);
      if (appleData && appleData.email) {
        // Compare emails (case-insensitive)
        emailMatchesAppleId = appleData.email.toLowerCase() === email.toLowerCase();
        console.log(`🍎 Apple verification: ${appleData.email} vs ${email} = ${emailMatchesAppleId ? 'MATCH' : 'NO MATCH'}`);
      }
    }
    
    // Give 50 free credits only if email matches Apple ID
    // Otherwise 0 free credits (to prevent multi-account abuse)
    const initialMonthlyCredits = emailMatchesAppleId ? 50 : 0;
    const initialBonusCredits = localCreditsToMerge && localCreditsToMerge > 0 ? localCreditsToMerge : 0;
    
    console.log(`📝 Email signup: ${email} - Apple verified: ${emailMatchesAppleId} - Monthly: ${initialMonthlyCredits}, Bonus: ${initialBonusCredits}`);
    
    // Create user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        plan_type: 'free',
        monthly_credits: initialMonthlyCredits,
        bonus_credits: initialBonusCredits,
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    if (localCreditsToMerge && localCreditsToMerge > 0) {
      console.log(`New user ${user.id} created with ${localCreditsToMerge} merged local credits`);
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






