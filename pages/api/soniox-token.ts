import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/lib/auth';

/**
 * Vends a short-lived Soniox temporary API key for direct iOS → Soniox WebSocket streaming.
 *
 * POST /api/soniox-token
 *   Authorization: Bearer <token>  (optional – guests supported)
 *
 * Returns: { token, expiresAt }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.SONIOX_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'SONIOX_API_KEY not configured' });
  }

  try {
    await authenticateRequest(req);

    const sxRes = await fetch('https://api.soniox.com/v1/auth/temporary-api-key', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usage_type: 'transcribe_websocket',
        expires_in_seconds: 30,
      }),
    });

    if (!sxRes.ok) {
      const errText = await sxRes.text();
      console.error('[soniox-token] Grant failed:', sxRes.status, errText);
      return res.status(502).json({
        error: `Soniox token grant failed (${sxRes.status}): ${errText.slice(0, 200)}`,
      });
    }

    const { api_key, expires_at } = await sxRes.json();

    return res.status(200).json({
      token: api_key,
      expiresAt: expires_at,
    });
  } catch (error: any) {
    console.error('[soniox-token] Error:', error);
    return res.status(500).json({ error: error.message || 'Token generation failed' });
  }
}
