import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth';
import { sendPushToTokens } from '@/lib/notifications';
import { supabaseAdmin } from '@/lib/supabase';
import {
  buildAudienceDetail,
  getPushTargetTokens,
  normalizeStringList,
  type PushAudience,
  type PushSendPayload,
} from '@/lib/pushTargeting';

type SendRequestBody = PushSendPayload & {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  audience?: PushAudience;
  dryRun?: boolean;
};

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

  let adminUser;
  try {
    adminUser = await requireAdmin(req);
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

    const audience = (payload.audience ?? 'all') as PushAudience;
    const audienceDetail = buildAudienceDetail({ ...payload, audience });

    if (audience === 'device_ids' && normalizeStringList(payload.deviceIds).length === 0) {
      return res.status(400).json({ error: 'audience device_ids requires at least one deviceIds value' });
    }
    if (audience === 'user_ids' && normalizeStringList(payload.userIds).length === 0) {
      return res.status(400).json({ error: 'audience user_ids requires at least one userIds value' });
    }
    if (audience === 'emails' && normalizeStringList(payload.emails).length === 0) {
      return res.status(400).json({ error: 'audience emails requires at least one emails value' });
    }

    const tokens = await getPushTargetTokens(payload);
    const uniqueTokens = Array.from(new Set(tokens));
    const dryRun = payload.dryRun === true;

    const insertHistory = async (args: {
      sentCount: number | null;
      failedCount: number | null;
      failuresSample: unknown;
      invalidTokensRemoved: number;
    }) => {
      const { data, error } = await supabaseAdmin
        .from('push_notification_history')
        .insert({
          title,
          body,
          audience,
          audience_detail: audienceDetail,
          targeted_count: uniqueTokens.length,
          sent_count: args.sentCount,
          failed_count: args.failedCount,
          dry_run: dryRun,
          admin_email: adminUser.email,
          failures_sample: args.failuresSample,
          invalid_tokens_removed: args.invalidTokensRemoved,
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Failed to record push_notification_history:', error.message);
        return null;
      }
      return data?.id as string | undefined;
    };

    if (dryRun) {
      const historyId = await insertHistory({
        sentCount: null,
        failedCount: null,
        failuresSample: null,
        invalidTokensRemoved: 0,
      });
      return res.status(200).json({
        success: true,
        dryRun: true,
        targetedCount: uniqueTokens.length,
        audience,
        historyId: historyId ?? null,
      });
    }

    const result = await sendPushToTokens({
      tokens: uniqueTokens,
      title,
      body,
      data: payload.data,
    });

    let invalidRemoved = 0;
    if (result.invalidTokens.length > 0) {
      const { error: delErr } = await supabaseAdmin.from('push_tokens').delete().in('push_token', result.invalidTokens);
      if (!delErr) invalidRemoved = result.invalidTokens.length;
    }

    const failuresSample = result.failures.slice(0, 20).map((f) => ({ token: f.token, reason: f.reason }));

    const historyId = await insertHistory({
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      failuresSample,
      invalidTokensRemoved: invalidRemoved,
    });

    return res.status(200).json({
      success: true,
      targetedCount: uniqueTokens.length,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      failures: result.failures.slice(0, 20),
      audience,
      invalidTokensRemoved: invalidRemoved,
      historyId: historyId ?? null,
    });
  } catch (error) {
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
