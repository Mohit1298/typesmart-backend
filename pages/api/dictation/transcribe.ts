import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';

// Local Brahmic → Latin (ITRANS-style); avoids a round-trip to OpenAI for typical Hindi/Marathi/Gujarati output.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sanscript = require('sanscript') as {
  t: (data: string, from: string, to: string, options?: Record<string, unknown>) => string;
};

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 120,
};

const SONIOX_API_KEY = process.env.SONIOX_API_KEY || '';
const SONIOX_BASE = 'https://api.soniox.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const LANGUAGE_HINT_MAP: Record<string, string[]> = {
  hinglish: ['hi', 'en'],
  marathi_english: ['mr', 'en'],
  gujarati_english: ['gu', 'en'],
};

const MAX_POLL_ATTEMPTS = 60;
/** After the first immediate poll, short backoff then 1s — avoids a fixed 1s penalty when Soniox finishes quickly. */
const POLL_BACKOFF_MS = [150, 250, 400, 600, 800] as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sonioxUploadFile(audioBuffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() || 'm4a';
  const mimeType = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'audio/m4a';
  const ab = new ArrayBuffer(audioBuffer.byteLength);
  new Uint8Array(ab).set(audioBuffer);
  const blob = new Blob([ab], { type: mimeType });
  const form = new FormData();
  form.append('file', blob, filename);

  const res = await fetch(`${SONIOX_BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Soniox file upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id;
}

async function sonioxCreateTranscription(
  fileId: string,
  languageHints: string[]
): Promise<string> {
  const body: Record<string, any> = {
    model: 'stt-async-v4',
    file_id: fileId,
    language_hints: languageHints,
    // Looser hints = faster for code-switched audio; we already send hi+en / mr+en / gu+en from the client.
    language_hints_strict: false,
    // Per-language mode is chosen in-app; token-level LID adds latency with little benefit here.
    enable_language_identification: false,
  };

  const res = await fetch(`${SONIOX_BASE}/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SONIOX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Soniox create transcription failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id;
}

async function sonioxPollUntilComplete(transcriptionId: string): Promise<void> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    if (i > 0) {
      const waitMs = i - 1 < POLL_BACKOFF_MS.length ? POLL_BACKOFF_MS[i - 1] : 1000;
      await sleep(waitMs);
    }

    const res = await fetch(`${SONIOX_BASE}/transcriptions/${transcriptionId}`, {
      headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Soniox poll failed (${res.status}): ${err}`);
    }

    const data = await res.json();

    if (data.status === 'completed') return;
    if (data.status === 'error') {
      throw new Error(`Soniox transcription error: ${data.error_message || 'unknown'}`);
    }
  }

  throw new Error('Soniox transcription timed out after polling');
}

async function sonioxGetTranscript(transcriptionId: string): Promise<string> {
  const res = await fetch(`${SONIOX_BASE}/transcriptions/${transcriptionId}/transcript`, {
    headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Soniox get transcript failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.text || '';
}

function containsNonLatin(text: string): boolean {
  return /[^\u0000-\u024F\u1E00-\u1EFF\s\d.,!?;:'"()\-–—…@#$%^&*+=/<>[\]{}|\\~`_]/.test(text);
}

/**
 * Fast romanization: transliterate Indic script runs to Latin (ITRANS). English/Latin chunks unchanged.
 * Returns null if non-Latin remains that we did not handle (fall back to OpenAI).
 */
function tryFastRomanize(rawText: string, languageMode: string): string | null {
  if (!containsNonLatin(rawText)) {
    return rawText;
  }

  const tryChunk = (chunk: string, from: 'devanagari' | 'gujarati') => {
    try {
      return Sanscript.t(chunk, from, 'itrans');
    } catch {
      return chunk;
    }
  };

  // Unicode blocks (avoids `\p{Script=...}` so we stay compatible with older TS `target`)
  const hasGujarati = /[\u0A80-\u0AFF]/.test(rawText);
  const hasDevanagari = /[\u0900-\u097F]/.test(rawText);

  try {
    if (languageMode === 'gujarati_english') {
      if (!hasGujarati) {
        return null;
      }
      const out = rawText.replace(/[\u0A80-\u0AFF]+/g, (ch) => tryChunk(ch, 'gujarati'));
      return containsNonLatin(out) ? null : out;
    }

    if (languageMode === 'hinglish' || languageMode === 'marathi_english') {
      if (!hasDevanagari) {
        return null;
      }
      const out = rawText.replace(/[\u0900-\u097F]+/g, (ch) => tryChunk(ch, 'devanagari'));
      return containsNonLatin(out) ? null : out;
    }
  } catch (e) {
    console.error('[dictation] tryFastRomanize error', e);
    return null;
  }

  return null;
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

  const fast = tryFastRomanize(rawText, languageMode);
  if (fast !== null) {
    return { text: fast, didCallOpenAI: false, tokensInput: 0, tokensOutput: 0, costUsd: 0 };
  }

  if (!OPENAI_API_KEY) {
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

  const prompt = `Romanize ${languageLabel} to natural Latin (how people type on WhatsApp). No translation. Keep English as-is. Output only the text, no quotes.

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
      temperature: 0,
      max_tokens: 220,
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
  const costUsd = (tokensInput * costPerInput) + (tokensOutput * costPerOutput);

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

  if (!SONIOX_API_KEY) {
    return res.status(500).json({ error: 'SONIOX_API_KEY not configured' });
  }

  const startTime = Date.now();

  try {
    const user = await authenticateRequest(req);

    const form = formidable({ maxFileSize: 25 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

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
    const filename = audioFile.originalFilename || 'dictation.m4a';

    const uploadStart = Date.now();
    const fileId = await sonioxUploadFile(audioBuffer, filename);
    const uploadMs = Date.now() - uploadStart;

    const transcribeStart = Date.now();
    const transcriptionId = await sonioxCreateTranscription(fileId, hints);
    await sonioxPollUntilComplete(transcriptionId);
    const rawTranscript = await sonioxGetTranscript(transcriptionId);
    const transcribeMs = Date.now() - transcribeStart;

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

    try { fs.unlinkSync(audioFile.filepath); } catch {}

    const totalMs = Date.now() - startTime;

    console.log(
      `[dictation] mode=${languageMode} upload=${uploadMs}ms stt=${transcribeMs}ms roman=${romanizeMs}ms total=${totalMs}ms romanized=${romanizeResult.didCallOpenAI} raw="${rawTranscript.substring(0, 80)}" final="${romanizeResult.text.substring(0, 80)}"`
    );

    return res.status(200).json({
      rawTranscript,
      romanizedTranscript: romanizeResult.text,
      detectedLanguage: languageMode,
      provider: 'soniox',
      creditsUsed: romanizeResult.didCallOpenAI ? 1 : 0,
      timings: { uploadMs, transcribeMs, romanizeMs, totalMs },
    });
  } catch (error: any) {
    console.error('Dictation transcription error:', error);
    return res.status(500).json({
      error: error.message || 'Dictation transcription failed',
      provider: 'soniox',
    });
  }
}
