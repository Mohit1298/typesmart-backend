import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';
import { romanizeDictationText } from '@/lib/dictationRomanize';

/**
 * Romanize raw transcript from Soniox realtime WebSocket (same logic as batch /dictation/transcribe).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateRequest(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const rawText = (body?.rawText as string)?.trim() ?? '';
    const languageMode = (body?.languageMode as string) || 'hinglish';
    const deviceId = (body?.deviceId as string) || '';

    if (!rawText) {
      return res.status(400).json({ error: 'rawText is required' });
    }

    const romanizeResult = await romanizeDictationText(rawText, languageMode);

    if (romanizeResult.didCallOpenAI) {
      const creditCost = 1;
      try {
        if (user) {
          await deductCredits(user.id, creditCost);
          await logUsage(user.id, 'dictation', false, creditCost, romanizeResult.tokensInput, romanizeResult.tokensOutput, romanizeResult.costUsd);
        } else if (deviceId) {
          await logGuestUsage(deviceId, 'dictation', false, creditCost, romanizeResult.tokensInput, romanizeResult.tokensOutput, romanizeResult.costUsd);
          await getOrCreateGuestCredit(deviceId, creditCost);
        }
      } catch (logErr) {
        console.error('[dictation/romanize] Credit/log error (non-fatal):', logErr);
      }
    }

    return res.status(200).json({
      rawTranscript: rawText,
      romanizedTranscript: romanizeResult.text,
      detectedLanguage: languageMode,
      provider: 'soniox-rt',
      creditsUsed: romanizeResult.didCallOpenAI ? 1 : 0,
    });
  } catch (error: any) {
    console.error('Dictation romanize error:', error);
    return res.status(500).json({ error: error.message || 'Romanization failed' });
  }
}
