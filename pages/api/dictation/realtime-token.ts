import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/lib/auth';

const SONIOX_API_KEY = process.env.SONIOX_API_KEY || '';
const SONIOX_BASE = 'https://api.soniox.com/v1';

/**
 * Issues a short-lived Soniox API key for `wss://stt-rt.soniox.com/transcribe-websocket`.
 * The iOS app never sees the master SONIOX_API_KEY.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SONIOX_API_KEY) {
    return res.status(500).json({ error: 'SONIOX_API_KEY not configured' });
  }

  try {
    await authenticateRequest(req);

    const r = await fetch(`${SONIOX_BASE}/auth/temporary-api-key`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SONIOX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usage_type: 'transcribe_websocket',
        expires_in_seconds: 900,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[dictation/realtime-token] Soniox error:', r.status, err);
      return res.status(502).json({ error: 'Failed to create realtime token' });
    }

    const data = await r.json();
    return res.status(200).json({
      apiKey: data.api_key,
      expiresAt: data.expires_at,
    });
  } catch (e: any) {
    console.error('[dictation/realtime-token]', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
