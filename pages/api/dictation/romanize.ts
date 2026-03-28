import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

function containsNonLatin(text: string): boolean {
  return /[^\u0000-\u024F\u1E00-\u1EFF\s\d.,!?;:'"()\-–—…@#$%^&*+=/<>[\]{}|\\~`_]/.test(text);
}

function stripLeadingSpuriousEnglishBeforeIndic(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const m = trimmed.match(/^(but)\.?\s+/i);
  if (!m) return text;
  const rest = trimmed.slice(m[0].length);
  if (!rest || !containsNonLatin(rest)) return text;
  return rest;
}

/**
 * Text-only romanization for streaming STT.
 * The iOS client streams audio directly to Soniox, gets a raw (possibly Devanagari) transcript,
 * then sends just the text here for OpenAI romanization.
 *
 * POST /api/dictation/romanize
 *   Body: { rawText, languageMode, deviceId }
 *   Authorization: Bearer <token>  (optional)
 *
 * Returns: { romanizedText, didRomanize, creditsUsed }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateRequest(req);
    const { rawText, languageMode, deviceId } = req.body ?? {};

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'rawText is required' });
    }

    const cleaned = stripLeadingSpuriousEnglishBeforeIndic(rawText);

    if (!containsNonLatin(cleaned)) {
      return res.status(200).json({
        romanizedText: cleaned,
        didRomanize: false,
        creditsUsed: 0,
      });
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
${cleaned}`;

    const startMs = Date.now();
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
    const romanizeMs = Date.now() - startMs;

    if (!openaiRes.ok) {
      console.error('[romanize] OpenAI call failed, returning raw text');
      return res.status(200).json({
        romanizedText: cleaned,
        didRomanize: false,
        creditsUsed: 0,
      });
    }

    const data = await openaiRes.json();
    const romanized = data.choices?.[0]?.message?.content?.trim() || cleaned;

    console.log(
      `[romanize] mode=${languageMode} ms=${romanizeMs} raw="${cleaned.substring(0, 60)}" rom="${romanized.substring(0, 60)}"`
    );

    res.status(200).json({
      romanizedText: romanized,
      didRomanize: true,
      creditsUsed: 1,
    });

    // Fire-and-forget: credit logging after response
    const creditCost = 1;
    try {
      if (user) {
        await Promise.all([
          deductCredits(user.id, creditCost),
          logUsage(user.id, 'dictation_romanize', false, creditCost, 0, 0, 0),
        ]);
      } else if (deviceId) {
        await Promise.all([
          logGuestUsage(deviceId, 'dictation_romanize', false, creditCost, 0, 0, 0),
          getOrCreateGuestCredit(deviceId, creditCost),
        ]);
      }
    } catch (logErr) {
      console.error('[romanize] Credit/log error (non-fatal):', logErr);
    }
  } catch (error: any) {
    console.error('[romanize] Error:', error);
    return res.status(500).json({ error: error.message || 'Romanization failed' });
  }
}
