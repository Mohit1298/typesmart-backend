import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { uuid } = req.query;
    console.log('📥 Code:', uuid);
    
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid UUID' });
    }

    let voiceNote: any = null;

    if (uuid.length === 36) {
      const result = await supabaseAdmin.from('voice_notes').select('*').eq('id', uuid).single();
      voiceNote = result.data;
    } else if (uuid.length >= 8) {
      const shortCode = uuid.substring(0, 8).toLowerCase();
      console.log('🔍 Short code:', shortCode);
      
      // UUID columns need text cast for pattern matching
      // Use raw filter with textual comparison
      const result = await supabaseAdmin
        .from('voice_notes')
        .select('*')
        .filter('id::text', 'ilike', `${shortCode}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      console.log('📊 Found:', result.data?.length, 'error:', result.error?.message);
      if (result.data && result.data.length > 0) {
        voiceNote = result.data[0];
      }
    } else {
      return res.status(400).json({ success: false, error: 'Code too short' });
    }

    if (!voiceNote) {
      return res.status(404).json({ success: false, error: 'Voice note not found', code: uuid });
    }

    if (new Date(voiceNote.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'Expired' });
    }

    const { data: urlData } = await supabaseAdmin.storage.from('voice-notes').createSignedUrl(voiceNote.storage_path, 3600);
    if (!urlData) return res.status(500).json({ success: false, error: 'URL failed' });

    await supabaseAdmin.from('voice_notes').update({ download_count: voiceNote.download_count + 1 }).eq('id', voiceNote.id);

    return res.status(200).json({
      success: true,
      uuid: voiceNote.id,
      duration: voiceNote.duration_seconds,
      downloadUrl: urlData.signedUrl,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
