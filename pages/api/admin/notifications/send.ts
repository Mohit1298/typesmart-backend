import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth';
import { sendPushToTokens } from '@/lib/notifications';
import { supabaseAdmin } from '@/lib/supabase';

type Audience = 'all' | 'pre_registered' | 'donated' | 'device_ids' | 'user_ids';

type SendRequestBody = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  audience?: Audience;
  deviceIds?: string[];
  userIds?: string[];
  dryRun?: boolean;
};

async function getTargetTokens(payload: SendRequestBody): Promise<string[]> {
  const audience = payload.audience ?? 'all';

  if (audience === 'all') {
    const { data } = await supabaseAdmin.from('push_tokens').select('push_token');
    return (data ?? []).map((row: any) => row.push_token).filter(Boolean);
  }

  if (audience === 'device_ids') {
    const deviceIds = payload.deviceIds ?? [];
    if (deviceIds.length === 0) return [];
    const { data } = await supabaseAdmin
      .from('push_tokens')
      .select('push_token')
      .in('device_id', deviceIds);
    return (data ?? []).map((row: any) => row.push_token).filter(Boolean);
  }

  if (audience === 'user_ids') {
    const userIds = payload.userIds ?? [];
    if (userIds.length === 0) return [];
    const { data } = await supabaseAdmin
      .from('push_tokens')
      .select('push_token')
      .in('user_id', userIds);
    return (data ?? []).map((row: any) => row.push_token).filter(Boolean);
  }

  if (audience === 'pre_registered' || audience === 'donated') {
    let query = supabaseAdmin.from('pre_registrations').select('device_id');

    if (audience === 'donated') {
      query = query.not('transaction_id', 'like', 'free_%');
    }

    const { data: registrations } = await query;
    const deviceIds = Array.from(new Set((registrations ?? []).map((r: any) => r.device_id).filter(Boolean)));

    if (deviceIds.length === 0) return [];

    const { data: tokens } = await supabaseAdmin
      .from('push_tokens')
      .select('push_token')
      .in('device_id', deviceIds);

    return (tokens ?? []).map((row: any) => row.push_token).filter(Boolean);
  }

  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = (req.method ?? '').toUpperCase();

  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(200).end();
  }

  if (method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = req.body as SendRequestBody;
    const title = payload.title?.trim();
    const body = payload.body?.trim();

    if (!title || !body) {
      return res.status(400).json({ error: 'Missing required fields: title, body' });
    }

    const tokens = await getTargetTokens(payload);
    const uniqueTokens = Array.from(new Set(tokens));

    if (payload.dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        targetedCount: uniqueTokens.length,
      });
    }

    const result = await sendPushToTokens({
      tokens: uniqueTokens,
      title,
      body,
      data: payload.data,
    });

    if (result.invalidTokens.length > 0) {
      await supabaseAdmin.from('push_tokens').delete().in('push_token', result.invalidTokens);
    }

    return res.status(200).json({
      success: true,
      targetedCount: uniqueTokens.length,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      failures: result.failures.slice(0, 20),
    });
  } catch (error) {
    // Avoid logging complex APNs objects directly; util.inspect can crash on some nested values.
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error';
    console.error('❌ Admin push send failed:', message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return res.status(500).json({ error: message || 'Failed to send push notifications' });
  }
}
