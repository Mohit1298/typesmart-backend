import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';

/**
 * Fire-and-forget credit logging for streaming dictation.
 * Called by the iOS app after receiving a successful transcript from the Deepgram WebSocket.
 *
 * POST /api/dictation/log-streaming-usage
 *   Body: { deviceId, transcriptLength }
 *   Authorization: Bearer <token>  (optional)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateRequest(req);
    const { deviceId, transcriptLength } = req.body ?? {};

    res.status(200).json({ success: true });

    if (typeof transcriptLength === 'number' && transcriptLength > 0) {
      const creditCost = 1;
      try {
        if (user) {
          await Promise.all([
            deductCredits(user.id, creditCost),
            logUsage(user.id, 'dictation_streaming', false, creditCost, 0, 0, 0),
          ]);
        } else if (deviceId) {
          await Promise.all([
            logGuestUsage(deviceId, 'dictation_streaming', false, creditCost, 0, 0, 0),
            getOrCreateGuestCredit(deviceId, creditCost),
          ]);
        }
      } catch (logErr) {
        console.error('[log-streaming-usage] Credit/log error (non-fatal):', logErr);
      }
    }
  } catch (error: any) {
    console.error('[log-streaming-usage] Error:', error);
    return res.status(500).json({ error: error.message || 'Usage logging failed' });
  }
}
