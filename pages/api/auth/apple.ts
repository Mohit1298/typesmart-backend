import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAppleToken, getOrCreateAppleUser, generateToken } from '@/lib/auth';
import { supabaseAdmin, linkGuestDataToUser, getGuestCredit } from '@/lib/supabase';

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
      identityToken, 
      email: providedEmail, 
      fullName, 
      localBonusCreditsToMerge,       // Credits from individual purchases (100/500 packs)
      deviceId,
      localProOriginalTransactionId,  // Local Pro subscription transaction ID
      localProCreditsRemaining        // How many Pro credits user has left locally
    } = req.body;
    
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
    
    // Check if user has a local Pro subscription to sync
    const hasLocalPro = !!localProOriginalTransactionId;
    
    // Check if user already exists (including archived)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`apple_user_id.eq.${appleData.appleUserId},email.eq.${email}`)
      .single();
    
    // Check if account is archived and restore it
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
            apple_user_id: appleData.appleUserId,  // Ensure Apple ID is linked
          })
          .eq('id', existingUser.id);
        
        if (restoreError) {
          console.error('Error restoring Apple account:', restoreError);
          throw restoreError;
        }
        
        console.log(`🔄 Apple account ${existingUser.id} (${email}) restored from archive!`);
        
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
        
        // Clear archived_at for response
        existingUser.archived_at = null;
        
        const token = generateToken(existingUser);
        const credits = existingUser.monthly_credits + existingUser.bonus_credits;
        
        return res.status(200).json({
          success: true,
          restored: true,
          message: 'Your account has been restored!',
          user: {
            id: existingUser.id,
            email: existingUser.email,
            planType: existingUser.plan_type,
            credits,
            isVip: existingUser.is_vip,
          },
          token,
        });
      }
    }
    
    const isExistingUser = !!existingUser && !existingUser.archived_at;
    
    // Check if this device has already received initial free credits
    let deviceAlreadyGotCredits = false;
    if (deviceId) {
      const guestCredit = await getGuestCredit(deviceId);
      deviceAlreadyGotCredits = guestCredit?.has_received_initial_credits || false;
    }
    
    // Get or create user (passes localBonusCreditsToMerge for new users only if device hasn't got credits)
    const creditsForNewUser = (!isExistingUser && !deviceAlreadyGotCredits && localBonusCreditsToMerge) ? localBonusCreditsToMerge : undefined;
    const user = await getOrCreateAppleUser(
      appleData.appleUserId, 
      email, 
      creditsForNewUser
    );
    
    // Mark new user as having received initial credits
    if (!isExistingUser) {
      await supabaseAdmin
        .from('users')
        .update({ has_received_initial_credits: true })
        .eq('id', user.id);
      user.has_received_initial_credits = true;
    }
    
    // If there are local credits to merge for EXISTING user, add them now
    if (isExistingUser && localBonusCreditsToMerge && localBonusCreditsToMerge > 0) {
      let creditsToMerge = localBonusCreditsToMerge;
      
      // If user already received initial credits and device also got them,
      // don't merge the first 50 credits (prevent exploit)
      if (user.has_received_initial_credits && deviceAlreadyGotCredits && localBonusCreditsToMerge === 50) {
        console.log(`⚠️ Apple user ${user.id} and device already received initial credits. Skipping merge.`);
        creditsToMerge = 0;
      }
      
      if (creditsToMerge > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            bonus_credits: user.bonus_credits + creditsToMerge,
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error('Failed to merge local credits for Apple user:', updateError);
        } else {
          user.bonus_credits += creditsToMerge;
          console.log(`✅ Merged ${creditsToMerge} local credits for existing Apple user ${user.id}`);
        }
      }
    }
    
    // Link guest data to this user
    if (deviceId) {
      await linkGuestDataToUser(deviceId, user.id);
      console.log(`✅ Linked guest data from device ${deviceId} to user ${user.id}`);
    }
    
    // Sync local Pro subscription if exists
    if (hasLocalPro) {
      console.log(`🔄 Syncing local Pro subscription for user ${user.id}`);
      console.log(`   Original Transaction ID: ${localProOriginalTransactionId}`);
      console.log(`   Credits remaining: ${localProCreditsRemaining}`);
      
      // Check if this transaction was already recorded
      const { data: existingTx } = await supabaseAdmin
        .from('iap_transactions')
        .select('id')
        .eq('original_transaction_id', localProOriginalTransactionId)
        .single();
      
      if (!existingTx) {
        // New Pro subscription - record it and upgrade user
        await supabaseAdmin
          .from('iap_transactions')
          .insert({
            user_id: user.id,
            transaction_id: localProOriginalTransactionId,
            original_transaction_id: localProOriginalTransactionId,
            product_id: 'com.wirtel.TypeSmart.pro.monthly',
            credits_added: 500,
            is_subscription: true,
          });
        
        console.log(`✅ Recorded Pro subscription for user ${user.id}`);
      } else {
        console.log(`ℹ️ Pro subscription already recorded`);
      }
      
      // Update user to Pro with remaining credits
      // Use remaining local credits (what user had left after using some)
      const creditsToSet = typeof localProCreditsRemaining === 'number' ? localProCreditsRemaining : 500;
      
      const { error: proError } = await supabaseAdmin
        .from('users')
        .update({
          plan_type: 'pro',
          monthly_credits: 500,
          monthly_credits_used: 500 - creditsToSet,  // Calculate used based on remaining
        })
        .eq('id', user.id);
      
      if (proError) {
        console.error('Failed to sync Pro status:', proError);
      } else {
        user.plan_type = 'pro';
        user.monthly_credits = 500;
        user.monthly_credits_used = 500 - creditsToSet;
        console.log(`✅ User ${user.id} synced to Pro with ${creditsToSet} credits remaining`);
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






