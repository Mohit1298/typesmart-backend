import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { authenticateRequest } from '@/lib/auth';
import { deductCredits, logUsage, logGuestUsage, getOrCreateGuestCredit } from '@/lib/supabase';
import {
  transcribeBufferViaDeepgram,
  contentTypeForDictationFilename,
  interleaveChannelsFloat32ToInt16LE,
} from '@/lib/deepgramTranscribe';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 120,
};

/**
 * Fast Hinglish path: Core Audio / PCM in CAF from the app → Deepgram (hi-Latn) → no Soniox / no OpenAI romanization.
 * @see https://developers.deepgram.com/docs/pre-recorded-audio
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
    const form = formidable({ maxFileSize: 25 * 1024 * 1024 });
    const parseAuthStart = Date.now();
    const [[fields, files], user] = await Promise.all([
      form.parse(req),
      authenticateRequest(req),
    ]);
    const parseAndAuthMs = Date.now() - parseAuthStart;

    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    const languageMode =
      (Array.isArray(fields.languageMode) ? fields.languageMode[0] : fields.languageMode) ||
      'hinglish_fast';
    const deviceId =
      (Array.isArray(fields.deviceId) ? fields.deviceId[0] : fields.deviceId) || '';

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required (field name: audio)' });
    }

    if (languageMode !== 'hinglish_fast') {
      return res.status(400).json({
        error: 'This endpoint only accepts languageMode=hinglish_fast',
      });
    }

    const audioBuffer = fs.readFileSync(audioFile.filepath);
    const filename = audioFile.originalFilename || 'dictation.caf';
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    let dgBody: Buffer;
    let dgContentType: string;
    let rawLinear16: { sampleRate: number; channels: number } | undefined;

    // Deepgram does not accept Core Audio (.caf) containers reliably; decode to linear16 + query params.
    if (ext === 'caf') {
      try {
        const decode = (await import('audio-decode')).default as (buf: Uint8Array) => Promise<{
          channelData: Float32Array[];
          sampleRate: number;
        }>;
        const { channelData, sampleRate } = await decode(new Uint8Array(audioBuffer));
        if (!channelData?.length) {
          throw new Error('No audio channels');
        }
        dgBody = interleaveChannelsFloat32ToInt16LE(channelData);
        dgContentType = 'application/octet-stream';
        rawLinear16 = {
          sampleRate: Math.round(sampleRate),
          channels: channelData.length,
        };
      } catch (cafErr) {
        console.error('[dictation-deepgram] CAF decode failed:', cafErr);
        try {
          fs.unlinkSync(audioFile.filepath);
        } catch {}
        return res.status(400).json({
          error: 'Could not read dictation audio (CAF). Try again or switch dictation mode.',
          provider: 'deepgram',
        });
      }
    } else {
      dgBody = audioBuffer;
      dgContentType = contentTypeForDictationFilename(filename);
    }

    const dgStart = Date.now();
    const { transcript, deepgramMs } = await transcribeBufferViaDeepgram(
      dgBody,
      dgContentType,
      rawLinear16
    );
    const transcribeMs = Date.now() - dgStart;

    let creditsMs = 0;
    if (transcript.length > 0) {
      const creditCost = 1;
      const creditsStart = Date.now();
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
      creditsMs = Date.now() - creditsStart;
    }

    try {
      fs.unlinkSync(audioFile.filepath);
    } catch {}

    const totalMs = Date.now() - startTime;

    const pcmHint = rawLinear16
      ? `linear16 ${rawLinear16.sampleRate}Hz/${rawLinear16.channels}ch`
      : dgContentType;
    console.log(
      `[dictation-deepgram] parse+auth=${parseAndAuthMs}ms stt=${transcribeMs}ms deepgram_reported=${deepgramMs}ms credits=${creditsMs}ms total=${totalMs}ms len=${transcript.length} file="${filename}" audio=${pcmHint}`
    );

    if (!transcript) {
      return res.status(200).json({
        rawTranscript: '',
        romanizedTranscript: null,
        detectedLanguage: 'hi-Latn',
        provider: 'deepgram',
        error: 'Empty transcript',
        creditsUsed: 0,
        timings: { parseAndAuthMs, transcribeMs, creditsMs, totalMs },
      });
    }

    return res.status(200).json({
      rawTranscript: transcript,
      romanizedTranscript: transcript,
      detectedLanguage: 'hi-Latn',
      provider: 'deepgram',
      creditsUsed: 1,
      timings: { parseAndAuthMs, transcribeMs, creditsMs, totalMs },
    });
  } catch (error: any) {
    console.error('Dictation Deepgram error:', error);
    return res.status(500).json({
      error: error.message || 'Dictation transcription failed',
      provider: 'deepgram',
    });
  }
}
