import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin, linkGuestDataToUser, getGuestCredit } from '@/lib/supabase';
import { hashPassword, generateToken, verifyAppleToken } from '@/lib/auth';

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
    const { 
      email, 
      password, 
      localBonusCreditsToMerge,  // Credits from individual purchases (100/500 packs)
      deviceId, 
      appleIdentityToken 
    } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user already exists (including archived accounts)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // If user exists and is archived, restore it
    if (existingUser && existingUser.archived_at) {
      const archivedDate = new Date(existingUser.archived_at);
      const now = new Date();
      const daysSinceArchived = Math.floor((now.getTime() - archivedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceArchived < ARCHIVE_DURATION_DAYS) {
        // Restore the archived account
        const { error: restoreError } = await supabaseAdmin
          .from('users')
          .update({
            archived_at: null,
            password_hash: passwordHash,  // Set new password
          })
          .eq('id', existingUser.id);
        
        if (restoreError) {
          console.error('Error restoring account:', restoreError);
          throw restoreError;
        }
        
        console.log(`🔄 Account ${existingUser.id} (${email}) restored from archive!`);
        
        // Merge any local bonus credits (from purchases only, not free credits)
        if (localBonusCreditsToMerge && localBonusCreditsToMerge > 0) {
          await supabaseAdmin
            .from('users')
            .update({
              bonus_credits: existingUser.bonus_credits + localBonusCreditsToMerge,
            })
            .eq('id', existingUser.id);
          
          existingUser.bonus_credits += localBonusCreditsToMerge;
        }
        
        // Link guest data to this user
        if (deviceId) {
          await linkGuestDataToUser(deviceId, existingUser.id);
        }
        
        // Generate token for restored account
        const token = generateToken(existingUser);
        
        return res.status(200).json({
          success: true,
          restored: true,
          message: 'Your account has been restored!',
          user: {
            id: existingUser.id,
            email: existingUser.email,
            planType: existingUser.plan_type,
            credits: existingUser.monthly_credits + existingUser.bonus_credits,
          },
          token,
        });
      }
      // If archived for more than 30 days, it should have been deleted
      // Fall through to create new account (this shouldn't normally happen)
    }
    
    // If user exists and is NOT archived, reject
    if (existingUser && !existingUser.archived_at) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Check if this device has already received initial free credits (prevent exploit)
    let deviceAlreadyGotCredits = false;
    if (deviceId) {
      const guestCredit = await getGuestCredit(deviceId);
      deviceAlreadyGotCredits = guestCredit?.has_received_initial_credits || false;
    }
    
    // Determine if signup email matches device's Apple ID
    let emailMatchesAppleId = false;
    
    if (appleIdentityToken) {
      const appleData = await verifyAppleToken(appleIdentityToken);
      if (appleData && appleData.email) {
        emailMatchesAppleId = appleData.email.toLowerCase() === email.toLowerCase();
        console.log(`🍎 Apple verification: ${appleData.email} vs ${email} = ${emailMatchesAppleId ? 'MATCH' : 'NO MATCH'}`);
      }
    }
    
    // Give 50 free credits only if:
    // 1. Email matches Apple ID, AND
    // 2. Device hasn't already received free credits (prevent reinstall exploit)
    const shouldGiveFreeCredits = emailMatchesAppleId && !deviceAlreadyGotCredits;
    const initialMonthlyCredits = shouldGiveFreeCredits ? 50 : 0;
    const initialBonusCredits = localBonusCreditsToMerge && localBonusCreditsToMerge > 0 ? localBonusCreditsToMerge : 0;
    
    console.log(`📝 Email signup: ${email} - Apple verified: ${emailMatchesAppleId} - Device already got credits: ${deviceAlreadyGotCredits} - Monthly: ${initialMonthlyCredits}, Bonus: ${initialBonusCredits}`);
    
    // Create user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        plan_type: 'free',
        monthly_credits: initialMonthlyCredits,
        bonus_credits: initialBonusCredits,
        has_received_initial_credits: shouldGiveFreeCredits,  // Mark if user got free credits
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    if (localBonusCreditsToMerge && localBonusCreditsToMerge > 0) {
      console.log(`New user ${user.id} created with ${localBonusCreditsToMerge} merged local credits`);
    }
    
    // Link guest data to this new user
    if (deviceId) {
      await linkGuestDataToUser(deviceId, user.id);
      console.log(`✅ Linked guest data from device ${deviceId} to user ${user.id}`);
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






