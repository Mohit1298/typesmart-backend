import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/lib/auth';

/**
 * Vends a short-lived Deepgram JWT for direct iOS → Deepgram WebSocket streaming.
 *
 * POST /api/deepgram-token
 *   Authorization: Bearer <token>  (optional – guests supported)
 *
 * Returns: { token, expiresIn, wsQuery }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });
  }

  try {
    await authenticateRequest(req);

    const dgRes = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${key}`,
      },
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error('[deepgram-token] Grant failed:', dgRes.status, errText);
      return res.status(502).json({
        error: `Deepgram token grant failed (${dgRes.status}): ${errText.slice(0, 200)}`,
      });
    }

    const { access_token, expires_in } = await dgRes.json();
    const query =
      process.env.DEEPGRAM_LISTEN_QUERY || 'model=base&language=hi-Latn&smart_format=true';

    return res.status(200).json({
      token: access_token,
      expiresIn: expires_in,
      wsQuery: query,
    });
  } catch (error: any) {
    console.error('[deepgram-token] Error:', error);
    return res.status(500).json({ error: error.message || 'Token generation failed' });
  }
}
