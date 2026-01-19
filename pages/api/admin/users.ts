import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
    
    const { search, page = '1', limit = '20', plan, vip, archived } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' });
    
    // Search by email
    if (search) {
      query = query.ilike('email', `%${search}%`);
    }
    
    // Filter by plan
    if (plan && plan !== 'all') {
      query = query.eq('plan_type', plan);
    }
    
    // Filter by VIP status
    if (vip === 'true') {
      query = query.eq('is_vip', true);
    }
    
    // Filter by archived status
    if (archived === 'true') {
      query = query.not('archived_at', 'is', null);
    } else if (archived === 'false') {
      query = query.is('archived_at', null);
    }
    // If archived is 'all' or not set, show all users
    
    // Pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);
    
    const { data: users, error, count } = await query;
    
    if (error) throw error;
    
    // Calculate stats
    const { data: stats } = await supabaseAdmin
      .from('users')
      .select('plan_type')
      .then(({ data }) => {
        const planCounts = { free: 0, pro: 0, unlimited: 0 };
        data?.forEach(u => {
          planCounts[u.plan_type as keyof typeof planCounts]++;
        });
        return { data: planCounts };
      });
    
    // Count archived users
    const { count: archivedCount } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('archived_at', 'is', null);
    
    return res.status(200).json({
      success: true,
      users: users?.map(u => ({
        id: u.id,
        email: u.email,
        planType: u.plan_type,
        monthlyCredits: u.monthly_credits,
        monthlyCreditsUsed: u.monthly_credits_used,
        bonusCredits: u.bonus_credits,
        isVip: u.is_vip,
        isAdmin: u.is_admin,
        adminNotes: u.admin_notes,
        archivedAt: u.archived_at,  // Include archive status
        isArchived: !!u.archived_at,
        createdAt: u.created_at,
        lastActiveAt: u.last_active_at,
      })),
      archivedCount: archivedCount || 0,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
      stats,
    });
    
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Admin users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}






