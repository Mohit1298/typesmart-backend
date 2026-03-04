import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/lib/auth';
import { normalizePushToken } from '@/lib/notifications';
import { supabaseAdmin } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceId, pushToken, appVersion, buildNumber } = req.body;

    if (!deviceId || !pushToken) {
      return res.status(400).json({ error: 'Missing required fields: deviceId, pushToken' });
    }

    const normalizedToken = normalizePushToken(pushToken);
    if (!normalizedToken || normalizedToken.length < 32) {
      return res.status(400).json({ error: 'Invalid push token' });
    }

    let userId: string | null = null;
    const user = await authenticateRequest(req);
    if (user) {
      userId = user.id;
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('push_tokens').upsert(
      {
        device_id: deviceId,
        user_id: userId,
        push_token: normalizedToken,
        platform: 'ios',
        app_version: appVersion ?? null,
        build_number: buildNumber ?? null,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: 'push_token' }
    );

    if (error) {
      console.error('❌ Push token registration failed:', error);
      return res.status(500).json({ error: 'Failed to register push token' });
    }

    return res.status(200).json({ success: true, message: 'Push token registered' });
  } catch (error) {
    console.error('❌ Push token registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
