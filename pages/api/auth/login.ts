import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserByEmail, supabaseAdmin } from '@/lib/supabase';
import { verifyPassword, generateToken, hashPassword } from '@/lib/auth';

// Archive duration - accounts are permanently deleted after this period
const ARCHIVE_DURATION_DAYS = 30;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, localCreditsToMerge, deviceId } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Get user
    const user = await getUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if account is archived
    if (user.archived_at) {
      const archivedDate = new Date(user.archived_at);
      const now = new Date();
      const daysSinceArchived = Math.floor((now.getTime() - archivedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceArchived < ARCHIVE_DURATION_DAYS) {
        // Account is archived - tell user to sign up to restore
        return res.status(401).json({ 
          error: 'This account was deleted. Sign up with the same email to restore it.',
          code: 'ACCOUNT_ARCHIVED'
        });
      }
    }
    
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Merge local credits if provided
    if (localCreditsToMerge && localCreditsToMerge > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          bonus_credits: user.bonus_credits + localCreditsToMerge,
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('Failed to merge local credits:', updateError);
      } else {
        // Update user object for response
        user.bonus_credits += localCreditsToMerge;
        console.log(`✅ Merged ${localCreditsToMerge} local credits for user ${user.id}. New bonus: ${user.bonus_credits}`);
      }
    }
    
    // Generate token
    const token = generateToken(user);
    
    // Calculate credits directly from updated user object to ensure consistency
    const credits = user.monthly_credits + user.bonus_credits;
    
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






