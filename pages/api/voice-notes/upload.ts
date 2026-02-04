import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import formidable from 'formidable';
import fs from 'fs';

// Disable Next.js body parsing to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

interface VoiceNoteUploadResponse {
  success: boolean;
  uuid?: string;
  uploadedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceNoteUploadResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB max
      keepExtensions: true,
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>(
      (resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve([fields, files]);
        });
      }
    );

    // Get user_id or device_id from fields
    const userId = fields.userId?.[0] || null;
    const deviceId = fields.deviceId?.[0] || null;
    const durationSeconds = fields.duration?.[0] ? parseFloat(fields.duration[0]) : null;

    if (!userId && !deviceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId or deviceId required' 
      });
    }

    // Get the uploaded audio file
    const audioFile = files.audio?.[0];
    if (!audioFile) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      });
    }

    // Read file buffer
    const fileBuffer = fs.readFileSync(audioFile.filepath);
    const fileSize = fileBuffer.length;

    // Generate unique filename with UUID
    const uuid = crypto.randomUUID();
    const fileExtension = audioFile.originalFilename?.split('.').pop() || 'caf';
    const storagePath = `voice-notes/${uuid}.${fileExtension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('voice-notes')
      .upload(storagePath, fileBuffer, {
        contentType: audioFile.mimetype || 'audio/x-caf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to upload file' 
      });
    }

    // Create database record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    const { data: voiceNote, error: dbError } = await supabaseAdmin
      .from('voice_notes')
      .insert({
        id: uuid,
        user_id: userId,
        device_id: deviceId,
        storage_path: storagePath,
        file_size_bytes: fileSize,
        duration_seconds: durationSeconds,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to clean up storage
      await supabaseAdmin.storage.from('voice-notes').remove([storagePath]);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save metadata' 
      });
    }

    // Generate signed download URL (valid for 1 hour)
    const { data: urlData } = await supabaseAdmin.storage
      .from('voice-notes')
      .createSignedUrl(storagePath, 3600);

    // Clean up temp file
    fs.unlinkSync(audioFile.filepath);

    return res.status(200).json({
      success: true,
      uuid: uuid,
      uploadedAt: voiceNote.created_at,
      expiresAt: voiceNote.expires_at,
      downloadUrl: urlData?.signedUrl,
    });

  } catch (error: any) {
    console.error('Voice note upload error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}
