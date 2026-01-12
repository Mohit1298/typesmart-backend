import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getUserFromToken } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from token
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete user's IAP transactions
    await supabase
      .from('iap_transactions')
      .delete()
      .eq('user_id', user.id);

    // Delete the user account
    const { error } = await supabase
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
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
