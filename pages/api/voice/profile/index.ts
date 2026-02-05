import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { deleteVoice } from '../../../../lib/elevenlabs';

interface VoiceProfile {
  id: string;
  user_id: string | null;
  device_id: string | null;
  elevenlabs_voice_id: string;
  sample_storage_path: string | null;
  voice_name: string | null;
  created_at: string;
  updated_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Authenticate request
    const user = await authenticateRequest(req);
    const userId = user?.id;
    const deviceId = req.query.deviceId as string | undefined || req.body?.deviceId;

    if (!userId && !deviceId) {
      return res.status(400).json({ error: 'User ID or device ID required' });
    }

    if (req.method === 'GET') {
      // Get voice profile status
      return await handleGet(userId, deviceId, res);
    } else if (req.method === 'DELETE') {
      // Delete voice profile
      return await handleDelete(userId, deviceId, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Voice profile API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleGet(
  userId: string | undefined,
  deviceId: string | undefined,
  res: NextApiResponse
) {
  let profile: VoiceProfile | null = null;

  if (userId) {
    const { data } = await supabaseAdmin
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    profile = data;
  } else if (deviceId) {
    const { data } = await supabaseAdmin
      .from('voice_profiles')
      .select('*')
      .eq('device_id', deviceId)
      .single();
    profile = data;
  }

  if (!profile) {
    return res.status(200).json({
      hasProfile: false,
      profile: null,
    });
  }

  return res.status(200).json({
    hasProfile: true,
    profile: {
      id: profile.id,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
  });
}

async function handleDelete(
  userId: string | undefined,
  deviceId: string | undefined,
  res: NextApiResponse
) {
  // Find the profile
  let profile: VoiceProfile | null = null;

  if (userId) {
    const { data } = await supabaseAdmin
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    profile = data;
  } else if (deviceId) {
    const { data } = await supabaseAdmin
      .from('voice_profiles')
      .select('*')
      .eq('device_id', deviceId)
      .single();
    profile = data;
  }

  if (!profile) {
    return res.status(404).json({ error: 'Voice profile not found' });
  }

  // Delete from ElevenLabs
  try {
    await deleteVoice(profile.elevenlabs_voice_id);
    console.log('Deleted voice from ElevenLabs:', profile.elevenlabs_voice_id);
  } catch (error) {
    console.error('Failed to delete voice from ElevenLabs:', error);
    // Continue with database deletion anyway
  }

  // Delete voice sample from storage
  if (profile.sample_storage_path) {
    try {
      await supabaseAdmin.storage
        .from('ai-voice-files')
        .remove([profile.sample_storage_path]);
    } catch (error) {
      console.error('Failed to delete voice sample from storage:', error);
      // Continue anyway
    }
  }

  // Delete from database
  const { error: deleteError } = await supabaseAdmin
    .from('voice_profiles')
    .delete()
    .eq('id', profile.id);

  if (deleteError) {
    console.error('Failed to delete voice profile from database:', deleteError);
    return res.status(500).json({ error: 'Failed to delete voice profile' });
  }

  return res.status(200).json({
    success: true,
    message: 'Voice profile deleted successfully',
  });
}
