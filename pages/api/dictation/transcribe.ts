import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';
import { transcribeBufferViaSonioxRealtime } from '@/lib/sonioxRealtimeTranscribe';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 120,
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const LANGUAGE_HINT_MAP: Record<string, string[]> = {
  hinglish: ['hi', 'en'],
  marathi_english: ['mr', 'en'],
  gujarati_english: ['gu', 'en'],
};

function containsNonLatin(text: string): boolean {
  return /[^\u0000-\u024F\u1E00-\u1EFF\s\d.,!?;:'"()\-–—…@#$%^&*+=/<>[\]{}|\\~`_]/.test(text);
}

/**
 * With bilingual hints (e.g. hi+en), Soniox sometimes prepends a spurious English token like "But."
 * before Indic script. The romanizer correctly preserves it. Strip only when the rest is clearly
 * Indic/mixed (non-Latin), so real English-only phrases are unchanged.
 */
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
    // Parse multipart body and load user in parallel: auth only reads headers; form consumes the body stream.
    // Previously this was sequential (auth → parse), adding Supabase RTT on top of upload parse time.
    const form = formidable({ maxFileSize: 25 * 1024 * 1024 });
    const parseAuthStart = Date.now();
    const [[fields, files], user] = await Promise.all([
      form.parse(req),
      authenticateRequest(req),
    ]);
    const parseAndAuthMs = Date.now() - parseAuthStart;

    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    const languageMode = (Array.isArray(fields.languageMode) ? fields.languageMode[0] : fields.languageMode) || 'hinglish';
    const deviceId = (Array.isArray(fields.deviceId) ? fields.deviceId[0] : fields.deviceId) || '';

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required (field name: audio)' });
    }

    const hints = LANGUAGE_HINT_MAP[languageMode];
    if (!hints) {
      return res.status(400).json({ error: `Unsupported language mode: ${languageMode}` });
    }

    const audioBuffer = fs.readFileSync(audioFile.filepath);

    const transcribeStart = Date.now();
    const rawFromStt = await transcribeBufferViaSonioxRealtime(audioBuffer, hints);
    const { text: rawTranscript, didStrip: strippedSpuriousBut } = stripLeadingSpuriousEnglishBeforeIndic(rawFromStt);
    const transcribeMs = Date.now() - transcribeStart;

    if (strippedSpuriousBut) {
      console.log(
        `[dictation] Stripped leading STT noise (spurious "But"): stt_raw="${rawFromStt.substring(0, 120)}" → use="${rawTranscript.substring(0, 120)}"`
      );
    }

    // Romanization (OpenAI) must run after STT: totals are ~ sonioxMs + openaiMs + network, not max().
    const romanizeStart = Date.now();
    const romanizeResult = await romanizeText(rawTranscript, languageMode);
    const romanizeMs = Date.now() - romanizeStart;

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
        console.error('[dictation] Credit/log error (non-fatal):', logErr);
      }
    }

    try {
      fs.unlinkSync(audioFile.filepath);
    } catch {}

    const totalMs = Date.now() - startTime;

    console.log(
      `[dictation] mode=${languageMode} provider=soniox-ws parse+auth=${parseAndAuthMs}ms stt=${transcribeMs}ms roman=${romanizeMs}ms total=${totalMs}ms romanized=${romanizeResult.didCallOpenAI} raw="${rawTranscript.substring(0, 80)}" final="${romanizeResult.text.substring(0, 80)}"`
    );

    return res.status(200).json({
      rawTranscript,
      romanizedTranscript: romanizeResult.text,
      detectedLanguage: languageMode,
      provider: 'soniox',
      creditsUsed: romanizeResult.didCallOpenAI ? 1 : 0,
      timings: { uploadMs: 0, transcribeMs, romanizeMs, totalMs },
    });
  } catch (error: any) {
    console.error('Dictation transcription error:', error);
    return res.status(500).json({
      error: error.message || 'Dictation transcription failed',
      provider: 'soniox',
    });
  }
}
