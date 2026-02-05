import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateRequest } from '../../../lib/auth';
import { supabaseAdmin, getAvailableCredits, deductCredits } from '../../../lib/supabase';
import { transcribeAudio, generateVoiceResponses, calculateAIVoiceCost } from '../../../lib/openai';
import { synthesizeSpeech, getDefaultVoiceId, isConfigured } from '../../../lib/elevenlabs';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

interface VoiceProfile {
  id: string;
  elevenlabs_voice_id: string;
}

interface VoiceSuggestion {
  id: string;
  text: string;
  audioUrl: string;
  duration: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return res.status(503).json({ error: 'Voice service not available' });
  }

  try {
    // Authenticate request
    const user = await authenticateRequest(req);
    const userId = user?.id;

    // Parse form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024,
    });

    const [fields, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    const deviceId = fields.deviceId?.[0];
    const responseCount = parseInt(fields.responseCount?.[0] || '3', 10);

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    if (!userId && !deviceId) {
      return res.status(400).json({ error: 'User ID or device ID required' });
    }

    // Validate response count
    const validCounts = [1, 3, 5];
    const count = validCounts.includes(responseCount) ? responseCount : 3;

    // Calculate credit cost
    const creditCost = calculateAIVoiceCost(count);

    // Check credits
    let availableCredits = 0;
    if (userId) {
      availableCredits = await getAvailableCredits(userId);
    } else {
      // For guests, we allow the request and track on client
      availableCredits = creditCost;
    }

    if (availableCredits < creditCost) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: creditCost,
        available: availableCredits,
      });
    }

    // Read audio file
    const audioBuffer = fs.readFileSync(audioFile.filepath);
    const filename = audioFile.originalFilename || 'voice_note.m4a';

    console.log('Processing AI voice request...');
    console.log('- Response count:', count);
    console.log('- Credit cost:', creditCost);

    // Step 1: Transcribe audio using Whisper
    console.log('Step 1: Transcribing audio...');
    const transcription = await transcribeAudio(audioBuffer, filename);
    console.log('Transcription:', transcription);

    if (!transcription || transcription.trim().length === 0) {
      return res.status(400).json({
        error: 'Could not transcribe audio. Please speak clearly and try again.',
      });
    }

    // Step 2: Generate response texts using GPT-4
    console.log('Step 2: Generating response texts...');
    const responseTexts = await generateVoiceResponses(transcription, count);
    console.log('Generated responses:', responseTexts);

    // Step 3: Get user's voice profile or use default
    let voiceId = getDefaultVoiceId();
    let usedDefaultVoice = true;
    let voiceProfileId: string | null = null;

    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('voice_profiles')
        .select('id, elevenlabs_voice_id')
        .eq('user_id', userId)
        .single();

      if (profile) {
        voiceId = profile.elevenlabs_voice_id;
        voiceProfileId = profile.id;
        usedDefaultVoice = false;
        console.log('Using user voice profile:', voiceId);
      }
    } else if (deviceId) {
      const { data: profile } = await supabaseAdmin
        .from('voice_profiles')
        .select('id, elevenlabs_voice_id')
        .eq('device_id', deviceId)
        .single();

      if (profile) {
        voiceId = profile.elevenlabs_voice_id;
        voiceProfileId = profile.id;
        usedDefaultVoice = false;
        console.log('Using device voice profile:', voiceId);
      }
    }

    if (usedDefaultVoice) {
      console.log('Using default voice:', voiceId);
    }

    // Step 4: Synthesize each response with ElevenLabs
    console.log('Step 4: Synthesizing responses...');
    const suggestions: VoiceSuggestion[] = [];

    for (let i = 0; i < responseTexts.length; i++) {
      const text = responseTexts[i];
      const suggestionId = uuidv4();

      try {
        console.log(`Synthesizing response ${i + 1}/${responseTexts.length}...`);
        const audioData = await synthesizeSpeech(voiceId, text);

        // Upload to Supabase Storage
        const storagePath = `ai-responses/${userId || deviceId}/${suggestionId}.mp3`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('ai-voice-files')
          .upload(storagePath, audioData, {
            contentType: 'audio/mpeg',
          });

        if (uploadError) {
          console.error('Failed to upload synthesized audio:', uploadError);
          continue;
        }

        // Get signed URL
        const { data: urlData } = await supabaseAdmin.storage
          .from('ai-voice-files')
          .createSignedUrl(storagePath, 3600); // 1 hour expiry

        if (!urlData?.signedUrl) {
          console.error('Failed to get signed URL for audio');
          continue;
        }

        // Estimate duration (rough estimate: ~150 words per minute, ~5 chars per word)
        const estimatedDuration = Math.max(1, (text.length / 5) / 150 * 60);

        suggestions.push({
          id: suggestionId,
          text,
          audioUrl: urlData.signedUrl,
          duration: Math.round(estimatedDuration * 10) / 10, // Round to 1 decimal
        });

      } catch (synthError: any) {
        console.error(`Failed to synthesize response ${i + 1}:`, synthError);
        // Continue with other responses
      }
    }

    if (suggestions.length === 0) {
      return res.status(500).json({
        error: 'Failed to generate voice responses. Please try again.',
      });
    }

    // Step 5: Deduct credits
    if (userId) {
      await deductCredits(userId, creditCost);
    }

    // Get remaining credits
    let creditsRemaining = 0;
    if (userId) {
      creditsRemaining = await getAvailableCredits(userId);
    }

    // Step 6: Log the session for analytics
    const sessionData: any = {
      original_audio_path: null, // Could store if needed
      transcription,
      response_count: count,
      responses: suggestions.map(s => ({
        id: s.id,
        text: s.text,
        audio_path: `ai-responses/${userId || deviceId}/${s.id}.mp3`,
        selected: false,
      })),
      credits_used: creditCost,
      voice_profile_used: voiceProfileId,
      used_default_voice: usedDefaultVoice,
    };

    if (userId) {
      sessionData.user_id = userId;
    } else {
      sessionData.device_id = deviceId;
    }

    await supabaseAdmin
      .from('ai_voice_sessions')
      .insert(sessionData);

    // Clean up temp file
    try {
      fs.unlinkSync(audioFile.filepath);
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log('AI voice generation complete!');
    console.log('- Suggestions generated:', suggestions.length);
    console.log('- Credits used:', creditCost);

    return res.status(200).json({
      success: true,
      transcription,
      suggestions,
      creditsUsed: creditCost,
      creditsRemaining,
      usedDefaultVoice,
    });

  } catch (error: any) {
    console.error('AI voice generation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate voice responses',
    });
  }
}
