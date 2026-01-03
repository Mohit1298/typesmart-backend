import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin, getUserById } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
    
    const { userId } = req.query;
    const { isVip, notes } = req.body;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update VIP status
    const updateData: any = {
      is_vip: isVip ?? !user.is_vip, // Toggle if not specified
    };
    
    if (notes !== undefined) {
      updateData.admin_notes = notes;
    }
    
    const { error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId);
    
    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      message: `${user.email} VIP status: ${updateData.is_vip ? 'enabled' : 'disabled'}`,
      user: {
        id: user.id,
        email: user.email,
        isVip: updateData.is_vip,
        adminNotes: updateData.admin_notes ?? user.admin_notes,
      },
    });
    
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return res.status(403).json({ error: error.message });
    }
    console.error('VIP toggle error:', error);
    return res.status(500).json({ error: 'Failed to update VIP status' });
  }
}

