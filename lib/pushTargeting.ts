import { supabaseAdmin } from './supabase';

export type PushAudience =
  | 'all'
  | 'pre_registered'
  | 'donated'
  | 'device_ids'
  | 'user_ids'
  | 'emails'
  | 'plan_free'
  | 'plan_pro'
  | 'logged_in';

export type PushSendPayload = {
  audience?: PushAudience;
  deviceIds?: string[] | string;
  userIds?: string[] | string;
  emails?: string[] | string;
};

export function normalizeStringList(values?: string[] | string | null): string[] {
  if (values == null) return [];
  if (Array.isArray(values)) {
    return values.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(values)
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function tokensFromUserIds(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabaseAdmin.from('push_tokens').select('push_token').in('user_id', userIds);
  return (data ?? []).map((row: { push_token: string }) => row.push_token).filter(Boolean);
}

async function resolveEmailsToUserIds(emails: string[]): Promise<string[]> {
  const normalized = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (normalized.length === 0) return [];

  const ids = new Set<string>();
  for (const email of normalized) {
    const { data } = await supabaseAdmin.from('users').select('id').ilike('email', email).maybeSingle();
    if (data?.id) ids.add(data.id as string);
  }
  return Array.from(ids);
}

export async function getPushTargetTokens(payload: PushSendPayload): Promise<string[]> {
  const audience = payload.audience ?? 'all';

  if (audience === 'all') {
    const { data } = await supabaseAdmin.from('push_tokens').select('push_token');
    return (data ?? []).map((row: { push_token: string }) => row.push_token).filter(Boolean);
  }

  if (audience === 'device_ids') {
    const deviceIds = normalizeStringList(payload.deviceIds);
    if (deviceIds.length === 0) return [];
    const { data } = await supabaseAdmin.from('push_tokens').select('push_token').in('device_id', deviceIds);
    return (data ?? []).map((row: { push_token: string }) => row.push_token).filter(Boolean);
  }

  if (audience === 'user_ids') {
    const userIds = normalizeStringList(payload.userIds);
    return tokensFromUserIds(userIds);
  }

  if (audience === 'emails') {
    const emails = normalizeStringList(payload.emails);
    const userIds = await resolveEmailsToUserIds(emails);
    return tokensFromUserIds(userIds);
  }

  if (audience === 'plan_free' || audience === 'plan_pro') {
    const plan = audience === 'plan_free' ? 'free' : 'pro';
    const { data: users } = await supabaseAdmin.from('users').select('id').eq('plan_type', plan);
    const ids = (users ?? []).map((u: { id: string }) => u.id);
    return tokensFromUserIds(ids);
  }

  if (audience === 'logged_in') {
    const { data } = await supabaseAdmin.from('push_tokens').select('push_token').not('user_id', 'is', null);
    return (data ?? []).map((row: { push_token: string }) => row.push_token).filter(Boolean);
  }

  if (audience === 'pre_registered' || audience === 'donated') {
    let query = supabaseAdmin.from('pre_registrations').select('device_id');
    if (audience === 'donated') {
      query = query.not('transaction_id', 'like', 'free_%');
    }
    const { data: registrations } = await query;
    const deviceIds = Array.from(
      new Set((registrations ?? []).map((r: { device_id: string }) => r.device_id).filter(Boolean))
    );
    if (deviceIds.length === 0) return [];
    const { data: tokens } = await supabaseAdmin.from('push_tokens').select('push_token').in('device_id', deviceIds);
    return (tokens ?? []).map((row: { push_token: string }) => row.push_token).filter(Boolean);
  }

  return [];
}

export function buildAudienceDetail(payload: PushSendPayload): Record<string, unknown> {
  const audience = payload.audience ?? 'all';
  const detail: Record<string, unknown> = { audience };
  const d = normalizeStringList(payload.deviceIds);
  const u = normalizeStringList(payload.userIds);
  const e = normalizeStringList(payload.emails);
  if (d.length) detail.deviceIds = d;
  if (u.length) detail.userIds = u;
  if (e.length) detail.emails = e;
  return detail;
}
