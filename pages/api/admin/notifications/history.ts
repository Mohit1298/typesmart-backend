import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = (req.method ?? '').toUpperCase();

  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(200).end();
  }

  if (method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);

  const { data, error, count } = await supabaseAdmin
    .from('push_notification_history')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('does not exist') || (error as { code?: string }).code === '42P01') {
      return res.status(200).json({
        success: true,
        items: [],
        total: 0,
        note: 'Run the SQL migration to create push_notification_history (see supabase-migrations/20250325_push_notification_history.sql).',
      });
    }
    console.error('❌ push history load failed:', error);
    return res.status(500).json({ error: 'Failed to load notification history' });
  }

  return res.status(200).json({
    success: true,
    items: data ?? [],
    total: count ?? data?.length ?? 0,
    limit,
    offset,
  });
}
