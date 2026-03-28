import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';
import { transcribeBufferViaSonioxRealtime } from '@/lib/sonioxRealtimeTranscribe';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 120,
};

const MAX_BODY_BYTES = 25 * 1024 * 1024;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const LANGUAGE_HINT_MAP: Record<string, string[]> = {
  hinglish: ['hi', 'en'],
  marathi_english: ['mr', 'en'],
  gujarati_english: ['gu', 'en'],
};

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

function containsNonLatin(text: string): boolean {
  return /[^\u0000-\u024F\u1E00-\u1EFF\s\d.,!?;:'"()\-–—…@#$%^&*+=/<>[\]{}|\\~`_]/.test(text);
}

function stripLeadingSpuriousEnglishBeforeIndic(text: string): { text: string; didStrip: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { text, didStrip: false };
  const m = trimmed.match(/^(but)\.?\s+/i);
  if (!m) return { text, didStrip: false };
  const rest = trimmed.slice(m[0].length);
  if (!rest || !containsNonLatin(rest)) return { text, didStrip: false };
  return { text: rest, didStrip: true };
}

interface RomanizeResult {
  text: string;
  didCallOpenAI: boolean;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
}

async function romanizeText(rawText: string, languageMode: string): Promise<RomanizeResult> {
  if (!containsNonLatin(rawText)) {
    return { text: rawText, didCallOpenAI: false, tokensInput: 0, tokensOutput: 0, costUsd: 0 };
  }

  const languageLabel =
    languageMode === 'hinglish'
      ? 'Hindi/Hinglish'
      : languageMode === 'marathi_english'
      ? 'Marathi'
      : languageMode === 'gujarati_english'
      ? 'Gujarati'
      : 'Indian language';

  const prompt = `You are a romanization engine. Convert the following ${languageLabel} text into Latin/Roman script exactly as a native speaker would type it using English letters. Rules:
- Output ONLY the romanized text, nothing else.
- Preserve the exact meaning and sentence structure. Do NOT translate to English.
- Use natural, commonly-used romanization (e.g. "mujhe bhook lagi hai" not "mujhe bhūkh lagī hai").
- Keep any English words already in the text as-is.
- Preserve punctuation and sentence breaks.
- Do NOT add quotes around the output.

Text to romanize:
${rawText}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    console.error('Romanization OpenAI call failed, returning raw text');
    return { text: rawText, didCallOpenAI: false, tokensInput: 0, tokensOutput: 0, costUsd: 0 };
  }

  const data = await res.json();
  const romanized = data.choices?.[0]?.message?.content?.trim();
  const tokensInput = data.usage?.prompt_tokens || 0;
  const tokensOutput = data.usage?.completion_tokens || 0;
  const costPerInput = 0.00015 / 1000;
  const costPerOutput = 0.0006 / 1000;
  const costUsd = tokensInput * costPerInput + tokensOutput * costPerOutput;

  return {
    text: romanized || rawText,
    didCallOpenAI: true,
    tokensInput,
    tokensOutput,
    costUsd,
  };
}

/**
 * Soniox dictation: raw audio body + metadata in headers → Soniox WS → romanize → respond before credits.
 *
 * Headers:
 *   Content-Type: audio/wav
 *   X-Language-Mode: hinglish | marathi_english | gujarati_english
 *   X-Device-Id: <device-uuid>
 *   Authorization: Bearer <token>  (optional)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.SONIOX_API_KEY) {
    return res.status(500).json({ error: 'SONIOX_API_KEY not configured' });
  }

  const startTime = Date.now();

  try {
    const parseAuthStart = Date.now();
    const [audioBuffer, user] = await Promise.all([
      readRawBody(req),
      authenticateRequest(req),
    ]);
    const parseAndAuthMs = Date.now() - parseAuthStart;

    const languageMode = (req.headers['x-language-mode'] as string) || 'hinglish';
    const deviceId = (req.headers['x-device-id'] as string) || '';

    if (!audioBuffer.length) {
      return res.status(400).json({ error: 'Empty audio body' });
    }

    const hints = LANGUAGE_HINT_MAP[languageMode];
    if (!hints) {
      return res.status(400).json({ error: `Unsupported language mode: ${languageMode}` });
    }

    const transcribeStart = Date.now();
    const rawFromStt = await transcribeBufferViaSonioxRealtime(audioBuffer, hints);
    const { text: rawTranscript, didStrip: strippedSpuriousBut } = stripLeadingSpuriousEnglishBeforeIndic(rawFromStt);
    const transcribeMs = Date.now() - transcribeStart;

    if (strippedSpuriousBut) {
      console.log(
        `[dictation] Stripped leading STT noise: stt_raw="${rawFromStt.substring(0, 120)}" → use="${rawTranscript.substring(0, 120)}"`
      );
    }

    const romanizeStart = Date.now();
    const romanizeResult = await romanizeText(rawTranscript, languageMode);
    const romanizeMs = Date.now() - romanizeStart;

    const totalMs = Date.now() - startTime;

    console.log(
      `[dictation] mode=${languageMode} provider=soniox-ws parse+auth=${parseAndAuthMs}ms stt=${transcribeMs}ms roman=${romanizeMs}ms total=${totalMs}ms romanized=${romanizeResult.didCallOpenAI} raw="${rawTranscript.substring(0, 80)}" final="${romanizeResult.text.substring(0, 80)}"`
    );

    const creditsUsed = romanizeResult.didCallOpenAI ? 1 : 0;

    res.status(200).json({
      rawTranscript,
      romanizedTranscript: romanizeResult.text,
      detectedLanguage: languageMode,
      provider: 'soniox',
      creditsUsed,
      timings: { transcribeMs, romanizeMs, totalMs },
    });

    if (romanizeResult.didCallOpenAI) {
      waitUntil(
        (async () => {
          try {
            if (user) {
              await Promise.all([
                deductCredits(user.id, creditsUsed),
                logUsage(
                  user.id,
                  'dictation',
                  false,
                  creditsUsed,
                  romanizeResult.tokensInput,
                  romanizeResult.tokensOutput,
                  romanizeResult.costUsd
                ),
              ]);
            } else if (deviceId) {
              await Promise.all([
                logGuestUsage(
                  deviceId,
                  'dictation',
                  false,
                  creditsUsed,
                  romanizeResult.tokensInput,
                  romanizeResult.tokensOutput,
                  romanizeResult.costUsd
                ),
                getOrCreateGuestCredit(deviceId, creditsUsed),
              ]);
            }
          } catch (logErr) {
            console.error('[dictation] Credit/log error (non-fatal):', logErr);
          }
        })()
      );
    }
    return;
  } catch (error: any) {
    console.error('Dictation transcription error:', error);
    return res.status(500).json({
      error: error.message || 'Dictation transcription failed',
      provider: 'soniox',
    });
  }
}
