/**
 * ElevenLabs API Integration
 * 
 * Provides voice cloning and text-to-speech functionality
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Default voice ID for fallback (Rachel - natural conversational voice)
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

/**
 * Clone a voice from an audio sample
 * @param name - Name for the cloned voice
 * @param audioBuffer - Audio buffer (mp3, wav, m4a supported)
 * @param filename - Original filename with extension
 * @returns Voice ID from ElevenLabs
 */
export async function cloneVoice(
  name: string,
  audioBuffer: Buffer,
  filename: string
): Promise<string> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const formData = new FormData();
  
  // Determine mime type from filename
  const ext = filename.split('.').pop()?.toLowerCase();
  let mimeType = 'audio/mpeg';
  if (ext === 'wav') mimeType = 'audio/wav';
  else if (ext === 'm4a') mimeType = 'audio/mp4';
  else if (ext === 'caf') mimeType = 'audio/x-caf';
  
  // Create blob from buffer - convert Buffer to Uint8Array for compatibility
  const uint8Array = new Uint8Array(audioBuffer);
  const blob = new Blob([uint8Array], { type: mimeType });
  formData.append('files', blob, filename);
  formData.append('name', name);
  formData.append('description', 'TypeSmart user voice profile');

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/add`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('ElevenLabs clone voice error:', error);
    throw new Error(`Failed to clone voice: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.voice_id;
}

/**
 * Synthesize speech from text using a voice
 * @param voiceId - Voice ID to use (cloned or default)
 * @param text - Text to synthesize
 * @param modelId - Model to use (default: eleven_monolingual_v1)
 * @returns Audio buffer (mp3)
 */
export async function synthesizeSpeech(
  voiceId: string,
  text: string,
  modelId: string = 'eleven_monolingual_v1'
): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('ElevenLabs synthesize error:', error);
    throw new Error(`Failed to synthesize speech: ${response.status} ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a cloned voice
 * @param voiceId - Voice ID to delete
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  // Don't delete the default voice
  if (voiceId === DEFAULT_VOICE_ID) {
    console.warn('Attempted to delete default voice, ignoring');
    return;
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    console.error('ElevenLabs delete voice error:', error);
    throw new Error(`Failed to delete voice: ${response.status} ${error}`);
  }
}

/**
 * Get the default voice ID for users without a profile
 */
export function getDefaultVoiceId(): string {
  return DEFAULT_VOICE_ID;
}

/**
 * Get available voices (for debugging/admin)
 */
export async function getVoices(): Promise<any[]> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices;
}

/**
 * Get voice details
 */
export async function getVoice(voiceId: string): Promise<any> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to get voice: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if ElevenLabs is configured
 */
export function isConfigured(): boolean {
  return !!ELEVENLABS_API_KEY;
}
