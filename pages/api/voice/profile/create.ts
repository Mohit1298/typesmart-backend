import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { authenticateRequest } from '../../../../lib/auth';
import { supabaseAdmin, getAvailableCredits, deductCredits, getUserById } from '../../../../lib/supabase';
import { cloneVoice, isConfigured } from '../../../../lib/elevenlabs';
import { CREDIT_COSTS } from '../../../../lib/openai';

export const config = {
  api: {
    bodyParser: false, // Required for formidable
  },
};

interface VoiceProfile {
  id: string;
  user_id: string | null;
  device_id: string | null;
  elevenlabs_voice_id: string;
  sample_storage_path: string | null;
  voice_name: string | null;
  created_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if ElevenLabs is configured
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Voice cloning service not available' });
  }

  try {
    // Authenticate request (supports both logged in users and guests)
    const user = await authenticateRequest(req);
    const userId = user?.id;
    
    // Parse form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB max
    });

    const [fields, files] = await form.parse(req);
    
    const audioFile = files.audio?.[0];
    const deviceId = fields.deviceId?.[0];

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    if (!userId && !deviceId) {
      return res.status(400).json({ error: 'User ID or device ID required' });
    }

    // Check if user already has a voice profile
    let existingProfile: VoiceProfile | null = null;
    if (userId) {
      const { data } = await supabaseAdmin
        .from('voice_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      existingProfile = data;
    } else if (deviceId) {
      const { data } = await supabaseAdmin
        .from('voice_profiles')
        .select('*')
        .eq('device_id', deviceId)
        .single();
      existingProfile = data;
    }

    if (existingProfile) {
      return res.status(409).json({ 
        error: 'Voice profile already exists. Delete existing profile first.',
        hasProfile: true
      });
    }

    // Check credits
    const creditCost = CREDIT_COSTS.voiceProfileCreate;
    let availableCredits = 0;
    
    if (userId) {
      availableCredits = await getAvailableCredits(userId);
    } else {
      // For guests, we'll track locally - they need to have enough
      // In this case, we just proceed and track usage
      availableCredits = creditCost; // Allow guest to proceed
    }

    if (availableCredits < creditCost) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        required: creditCost,
        available: availableCredits
      });
    }

    // Read audio file
    const audioBuffer = fs.readFileSync(audioFile.filepath);
    const filename = audioFile.originalFilename || 'voice_sample.m4a';

    // Generate voice name
    const voiceName = `TypeSmart_${userId || deviceId}_${Date.now()}`;

    // Clone voice with ElevenLabs
    console.log('Cloning voice with ElevenLabs...');
    const elevenLabsVoiceId = await cloneVoice(voiceName, audioBuffer, filename);
    console.log('Voice cloned successfully:', elevenLabsVoiceId);

    // Upload sample to Supabase Storage for reference
    const storagePath = `voice-samples/${userId || deviceId}/${Date.now()}_${filename}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('ai-voice-files')
      .upload(storagePath, audioBuffer, {
        contentType: audioFile.mimetype || 'audio/m4a',
      });

    if (uploadError) {
      console.warn('Failed to upload voice sample to storage:', uploadError);
      // Continue anyway - the voice is already cloned
    }

    // Create voice profile record
    const profileData: any = {
      elevenlabs_voice_id: elevenLabsVoiceId,
      sample_storage_path: uploadError ? null : storagePath,
      voice_name: voiceName,
    };

    if (userId) {
      profileData.user_id = userId;
    } else {
      profileData.device_id = deviceId;
    }

    const { data: profile, error: insertError } = await supabaseAdmin
      .from('voice_profiles')
      .insert(profileData)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create voice profile record:', insertError);
      // Try to clean up the cloned voice
      try {
        const { deleteVoice } = await import('../../../../lib/elevenlabs');
        await deleteVoice(elevenLabsVoiceId);
      } catch (e) {
        console.error('Failed to clean up cloned voice:', e);
      }
      return res.status(500).json({ error: 'Failed to create voice profile' });
    }

    // Deduct credits
    if (userId) {
      await deductCredits(userId, creditCost);
    }
    // For guests, credits are tracked on the client side

    // Get remaining credits
    let creditsRemaining = 0;
    if (userId) {
      creditsRemaining = await getAvailableCredits(userId);
    }

    // Clean up temp file
    try {
      fs.unlinkSync(audioFile.filepath);
    } catch (e) {
      // Ignore cleanup errors
    }

    return res.status(200).json({
      success: true,
      profileId: profile.id,
      voiceId: elevenLabsVoiceId,
      creditsUsed: creditCost,
      creditsRemaining,
    });

  } catch (error: any) {
    console.error('Voice profile creation error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create voice profile' 
    });
  }
}
