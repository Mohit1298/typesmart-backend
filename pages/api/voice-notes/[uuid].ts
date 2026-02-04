import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

interface VoiceNoteResponse {
  success: boolean;
  uuid?: string;
  duration?: number;
  createdAt?: string;
  downloadUrl?: string;
  expiresIn?: number; // seconds until expiration
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceNoteResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { uuid } = req.query;

    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid UUID' 
      });
    }

    // Fetch voice note metadata from database
    const { data: voiceNote, error: dbError } = await supabaseAdmin
      .from('voice_notes')
      .select('*')
      .eq('id', uuid)
      .single();

    if (dbError || !voiceNote) {
      return res.status(404).json({ 
        success: false, 
        error: 'Voice note not found' 
      });
    }

    // Check if expired
    const expiresAt = new Date(voiceNote.expires_at);
    const now = new Date();
    
    if (expiresAt < now) {
      return res.status(410).json({ 
        success: false, 
        error: 'Voice note has expired' 
      });
    }

    // Check download limits if set
    if (voiceNote.max_downloads !== null && voiceNote.download_count >= voiceNote.max_downloads) {
      return res.status(403).json({ 
        success: false, 
        error: 'Download limit reached' 
      });
    }

    // Generate signed download URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from('voice-notes')
      .createSignedUrl(voiceNote.storage_path, 3600);

    if (urlError || !urlData) {
      console.error('URL generation error:', urlError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to generate download URL' 
      });
    }

    // Increment download counter and update last accessed
    await supabaseAdmin
      .from('voice_notes')
      .update({ 
        download_count: voiceNote.download_count + 1,
        last_accessed_at: now.toISOString()
      })
      .eq('id', uuid);

    // Calculate seconds until expiration
    const expiresIn = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    return res.status(200).json({
      success: true,
      uuid: voiceNote.id,
      duration: voiceNote.duration_seconds,
      createdAt: voiceNote.created_at,
      downloadUrl: urlData.signedUrl,
      expiresIn: expiresIn,
    });

  } catch (error: any) {
    console.error('Voice note fetch error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}
