import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';
import { romanizeDictationText } from '@/lib/dictationRomanize';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 120,
};

const SONIOX_API_KEY = process.env.SONIOX_API_KEY || '';
const SONIOX_BASE = 'https://api.soniox.com/v1';

const LANGUAGE_HINT_MAP: Record<string, string[]> = {
  hinglish: ['hi', 'en'],
  marathi_english: ['mr', 'en'],
  gujarati_english: ['gu', 'en'],
};

const MAX_POLL_ATTEMPTS = 75;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** First poll runs immediately; next ~2s use 250ms spacing; then 1s (avoids a fixed 1s wait before first check). */
function delayBeforeSonioxPollMs(attemptIndex: number): number {
  if (attemptIndex === 0) return 0;
  if (attemptIndex <= 8) return 250;
  return 1000;
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
    language_hints_strict: true,
    enable_language_identification: true,
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
    const wait = delayBeforeSonioxPollMs(i);
    if (wait > 0) {
      await sleep(wait);
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
    const romanizeResult = await romanizeDictationText(rawTranscript, languageMode);
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
