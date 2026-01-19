import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

// Archive duration in days
const ARCHIVE_DURATION_DAYS = 30;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await requireAuth(req);

    // Archive the account instead of deleting
    // Set archived_at timestamp - account will be permanently deleted after 30 days
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        archived_at: new Date().toISOString(),
        // Clear sensitive data but keep the account structure
        password_hash: null,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error archiving account:', error);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    console.log(`📦 Account ${user.id} (${user.email}) archived. Will be permanently deleted after ${ARCHIVE_DURATION_DAYS} days.`);

    return res.status(200).json({ 
      success: true, 
      message: `Account archived. It will be permanently deleted in ${ARCHIVE_DURATION_DAYS} days. Sign up with the same email to restore.`
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}
