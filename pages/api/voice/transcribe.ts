import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { authenticateRequest } from '../../../lib/auth';
import { supabaseAdmin, getAvailableCredits, deductCredits, logUsage, logGuestUsage } from '../../../lib/supabase';
import { transcribeAudio } from '../../../lib/openai';

export const config = {
  api: {
    bodyParser: false,
  },
};

const TRANSCRIPTION_CREDIT_COST = 1;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Try to authenticate user (optional - supports guest mode)
    const user = await authenticateRequest(req);

    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB max
    });

    const [fields, files] = await form.parse(req);
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    const deviceId = Array.isArray(fields.deviceId) ? fields.deviceId[0] : fields.deviceId;

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Check credits (for logged-in users, check server-side; for guests, client manages credits)
    if (user) {
      const credits = await getAvailableCredits(user.id);
      if (credits < TRANSCRIPTION_CREDIT_COST) {
        return res.status(402).json({ error: 'Insufficient credits' });
      }
    } else if (!deviceId) {
      return res.status(401).json({ error: 'Authentication or deviceId required' });
    }

    // Read the audio file
    const audioBuffer = fs.readFileSync(audioFile.filepath);
    const filename = audioFile.originalFilename || 'audio.m4a';

    // Transcribe using Whisper
    const transcription = await transcribeAudio(audioBuffer, filename);

    // Deduct credits
    let creditsRemaining = 0;
    if (user) {
      await deductCredits(user.id, TRANSCRIPTION_CREDIT_COST);
      creditsRemaining = await getAvailableCredits(user.id);
    }

    // Upload to Supabase storage and create voice_notes record
    const uuid = crypto.randomUUID();
    const fileExtension = filename.split('.').pop()?.toLowerCase() || 'wav';
    const storagePath = `dictation/${uuid}.${fileExtension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('voice-notes')
      .upload(storagePath, audioBuffer, {
        contentType: fileExtension === 'wav' ? 'audio/wav' : 'audio/m4a',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Dictation upload error:', uploadError);
      // Continue - transcription succeeded, just log the storage failure
    } else {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabaseAdmin.from('voice_notes').insert({
        id: uuid,
        user_id: user?.id ?? null,
        device_id: deviceId ?? null,
        storage_path: storagePath,
        file_size_bytes: audioBuffer.length,
        duration_seconds: null,
        expires_at: expiresAt.toISOString(),
      });
    }

    // Log usage (usage_logs for users, guest_usage_logs for guests)
    if (user) {
      await logUsage(user.id, 'dictation', false, TRANSCRIPTION_CREDIT_COST);
    } else if (deviceId) {
      await logGuestUsage(deviceId, 'dictation', false, TRANSCRIPTION_CREDIT_COST);
    }

    // Clean up temp file
    try { fs.unlinkSync(audioFile.filepath); } catch {}

    return res.status(200).json({
      transcription,
      creditsUsed: TRANSCRIPTION_CREDIT_COST,
      creditsRemaining,
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return res.status(500).json({
      error: error.message || 'Transcription failed',
    });
  }
}
