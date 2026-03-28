import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';
import { transcribeBufferViaDeepgram } from '@/lib/deepgramTranscribe';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 120,
};

const MAX_BODY_BYTES = 25 * 1024 * 1024;

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error(`Body exceeds ${MAX_BODY_BYTES} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Fast Hinglish dictation: raw audio body + metadata in headers → Deepgram → respond before credits.
 *
 * Headers:
 *   Content-Type: audio/wav
 *   X-Language-Mode: hinglish_acc
 *   X-Device-Id: <device-uuid>
 *   Authorization: Bearer <token>  (optional)
 *
 * Body: raw audio bytes (no multipart).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.DEEPGRAM_API_KEY) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });
  }

  const startTime = Date.now();

  try {
    const parseAuthStart = Date.now();
    const [audioBuffer, user] = await Promise.all([
      readRawBody(req),
      authenticateRequest(req),
    ]);
    const parseAndAuthMs = Date.now() - parseAuthStart;

    const contentType = (req.headers['content-type'] as string) || 'audio/wav';
    const deviceId = (req.headers['x-device-id'] as string) || '';

    if (!audioBuffer.length) {
      return res.status(400).json({ error: 'Empty audio body' });
    }

    const dgStart = Date.now();
    const { transcript, deepgramMs, audioDurationSec, requestId } =
      await transcribeBufferViaDeepgram(audioBuffer, contentType);
    const transcribeMs = Date.now() - dgStart;

    const totalMs = Date.now() - startTime;

    const durHint =
      audioDurationSec != null ? `${audioDurationSec.toFixed(2)}s_audio` : 'duration_unknown';
    const dgId = requestId ?? 'none';
    console.log(
      `[dictation-deepgram] parse+auth=${parseAndAuthMs}ms stt=${transcribeMs}ms dg_fetch=${deepgramMs}ms total=${totalMs}ms chars=${transcript.length} bytes=${audioBuffer.length} dur=${durHint} dgId=${dgId} ct=${contentType}`
    );

    if (!transcript) {
      return res.status(200).json({
        rawTranscript: '',
        romanizedTranscript: null,
        detectedLanguage: 'hi-Latn',
        provider: 'deepgram',
        error: 'Empty transcript',
        creditsUsed: 0,
        timings: { parseAndAuthMs, transcribeMs, totalMs },
      });
    }

    const creditCost = 1;

    res.status(200).json({
      rawTranscript: transcript,
      romanizedTranscript: transcript,
      detectedLanguage: 'hi-Latn',
      provider: 'deepgram',
      creditsUsed: creditCost,
      timings: { parseAndAuthMs, transcribeMs, totalMs },
    });

    waitUntil(
      (async () => {
        try {
          if (user) {
            await Promise.all([
              deductCredits(user.id, creditCost),
              logUsage(user.id, 'dictation_deepgram', false, creditCost, 0, 0, 0),
            ]);
          } else if (deviceId) {
            await Promise.all([
              logGuestUsage(deviceId, 'dictation_deepgram', false, creditCost, 0, 0, 0),
              getOrCreateGuestCredit(deviceId, creditCost),
            ]);
          }
        } catch (logErr) {
          console.error('[dictation-deepgram] Credit/log error (non-fatal):', logErr);
        }
      })()
    );
    return;
  } catch (error: any) {
    console.error('Dictation Deepgram error:', error);
    return res.status(500).json({
      error: error.message || 'Dictation transcription failed',
      provider: 'deepgram',
    });
  }
}
