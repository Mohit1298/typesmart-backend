import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await requireAuth(req);

    // Delete user's IAP transactions
    await supabaseAdmin
      .from('iap_transactions')
      .delete()
      .eq('user_id', user.id);

    // Delete the user account
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id);

    if (error) {
      console.error('Error deleting account:', error);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Account and all associated data deleted successfully' 
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}
