import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAppleToken, getOrCreateAppleUser, generateToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { identityToken, email: providedEmail, fullName, localCreditsToMerge, deviceId } = req.body;
    
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
    
    // Check if user already exists (to determine if we need to merge credits)
    const { data: existingUserCheck } = await supabaseAdmin
      .from('users')
      .select('id')
      .or(`apple_user_id.eq.${appleData.appleUserId},email.eq.${email}`)
      .single();
    
    const isExistingUser = !!existingUserCheck;
    
    // Get or create user (passes localCreditsToMerge for new users only)
    const user = await getOrCreateAppleUser(
      appleData.appleUserId, 
      email, 
      isExistingUser ? undefined : localCreditsToMerge
    );
    
    // If there are local credits to merge for EXISTING user, add them now
    if (isExistingUser && localCreditsToMerge && localCreditsToMerge > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          bonus_credits: user.bonus_credits + localCreditsToMerge,
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('Failed to merge local credits for Apple user:', updateError);
      } else {
        user.bonus_credits += localCreditsToMerge;
        console.log(`✅ Merged ${localCreditsToMerge} local credits for existing Apple user ${user.id}`);
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
    console.error('Apple auth error:', error);
    return res.status(500).json({ error: 'Apple sign in failed' });
  }
}






