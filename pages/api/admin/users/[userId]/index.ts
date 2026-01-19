import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin, getUserById, getAvailableCredits } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = req.query;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    await requireAdmin(req);
    
    if (req.method === 'GET') {
      // Get user details
      const user = await getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get credit adjustments
      const { data: adjustments } = await supabaseAdmin
        .from('credit_adjustments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      // Get recent usage
      const { data: usage } = await supabaseAdmin
        .from('usage_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Calculate total usage this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data: monthlyUsage } = await supabaseAdmin
        .from('usage_logs')
        .select('credits_used')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString());
      
      const totalUsageThisMonth = monthlyUsage?.reduce((sum, u) => sum + u.credits_used, 0) || 0;
      
      const availableCredits = await getAvailableCredits(userId);
      
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          planType: user.plan_type,
          monthlyCredits: user.monthly_credits,
          monthlyCreditsUsed: user.monthly_credits_used,
          bonusCredits: user.bonus_credits,
          availableCredits,
          isVip: user.is_vip,
          isAdmin: user.is_admin,
          adminNotes: user.admin_notes,
          stripeCustomerId: user.stripe_customer_id,
          archivedAt: user.archived_at,
          isArchived: !!user.archived_at,
          appleUserId: user.apple_user_id,
          createdAt: user.created_at,
          lastActiveAt: user.last_active_at,
        },
        adjustments,
        recentUsage: usage,
        stats: {
          totalUsageThisMonth,
          totalRequests: usage?.length || 0,
        },
      });
      
    } else if (req.method === 'PATCH') {
      // Update user
      const { planType, monthlyCredits, monthlyCreditsUsed, bonusCredits, adminNotes, archived } = req.body;
      
      const updateData: any = {};
      
      // Plan change (free/pro)
      if (planType) {
        updateData.plan_type = planType;
        // When changing to pro, set monthly credits to 500
        if (planType === 'pro') {
          updateData.monthly_credits = 500;
          updateData.monthly_credits_used = 0;
        } else if (planType === 'free') {
          updateData.monthly_credits = 50;
        }
      }
      
      // Direct credit adjustments
      if (monthlyCredits !== undefined) updateData.monthly_credits = monthlyCredits;
      if (monthlyCreditsUsed !== undefined) updateData.monthly_credits_used = monthlyCreditsUsed;
      if (bonusCredits !== undefined) updateData.bonus_credits = bonusCredits;
      if (adminNotes !== undefined) updateData.admin_notes = adminNotes;
      
      // Archive/restore account
      if (archived === true) {
        updateData.archived_at = new Date().toISOString();
        updateData.password_hash = null;  // Clear password for security
      } else if (archived === false) {
        updateData.archived_at = null;  // Restore account
      }
      
      const { error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId);
      
      if (error) throw error;
      
      // Log the action
      const user = await getUserById(userId);
      console.log(`👤 Admin updated user ${userId} (${user?.email}):`, updateData);
      
      return res.status(200).json({
        success: true,
        message: 'User updated',
        updates: updateData,
      });
      
    } else if (req.method === 'DELETE') {
      // Permanently delete user (hard delete)
      const user = await getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Delete associated data first
      await supabaseAdmin
        .from('iap_transactions')
        .delete()
        .eq('user_id', userId);
      
      await supabaseAdmin
        .from('usage_logs')
        .delete()
        .eq('user_id', userId);
      
      await supabaseAdmin
        .from('credit_adjustments')
        .delete()
        .eq('user_id', userId);
      
      // Delete the user
      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      
      console.log(`🗑️ Admin permanently deleted user ${userId} (${user.email})`);
      
      return res.status(200).json({
        success: true,
        message: `User ${user.email} permanently deleted`,
      });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Admin user detail error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}






