import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';
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

    console.log(`[log-streaming-usage] user=${user?.id ?? 'guest'} deviceId=${deviceId ?? 'none'} transcriptLength=${transcriptLength}`);

    const shouldLog = typeof transcriptLength === 'number' && transcriptLength > 0;
    const creditsUsed = shouldLog ? 1 : 0;

    res.status(200).json({ success: true, creditsUsed });

    if (shouldLog) {
      waitUntil(
        (async () => {
          try {
            if (user) {
              const [deducted] = await Promise.all([
                deductCredits(user.id, creditsUsed),
                logUsage(user.id, 'dictation_streaming', false, creditsUsed, 0, 0, 0),
              ]);
              console.log(`[log-streaming-usage] user=${user.id} deducted=${deducted}`);
            } else if (deviceId) {
              await Promise.all([
                logGuestUsage(deviceId, 'dictation_streaming', false, creditsUsed, 0, 0, 0),
                getOrCreateGuestCredit(deviceId, creditsUsed),
              ]);
              console.log(`[log-streaming-usage] guest deviceId=${deviceId} logged`);
            } else {
              console.warn('[log-streaming-usage] No user and no deviceId — skipping credit deduction');
            }
          } catch (logErr) {
            console.error('[log-streaming-usage] Credit/log error (non-fatal):', logErr);
          }
        })()
      );
    } else {
      console.warn(`[log-streaming-usage] Skipped: transcriptLength=${transcriptLength} (not a positive number)`);
    }
    return;
  } catch (error: any) {
    console.error('[log-streaming-usage] Error:', error);
    return res.status(500).json({ error: error.message || 'Usage logging failed' });
  }
}
