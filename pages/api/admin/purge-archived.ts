import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

// Archive duration - accounts are permanently deleted after this period
const ARCHIVE_DURATION_DAYS = 30;

// Secret key for cron job authentication (set in environment variables)
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify cron secret (for security)
    const authHeader = req.headers.authorization;
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Calculate cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_DURATION_DAYS);
    const cutoffISOString = cutoffDate.toISOString();

    // Find accounts archived for more than 30 days
    const { data: accountsToDelete, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, archived_at')
      .not('archived_at', 'is', null)
      .lt('archived_at', cutoffISOString);

    if (fetchError) {
      console.error('Error fetching archived accounts:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch archived accounts' });
    }

    if (!accountsToDelete || accountsToDelete.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No accounts to purge',
        deleted: 0,
      });
    }

    console.log(`🗑️ Purging ${accountsToDelete.length} archived accounts...`);

    // Delete associated data first
    for (const account of accountsToDelete) {
      // Delete IAP transactions
      await supabaseAdmin
        .from('iap_transactions')
        .delete()
        .eq('user_id', account.id);

      // Delete usage logs
      await supabaseAdmin
        .from('usage_logs')
        .delete()
        .eq('user_id', account.id);

      console.log(`  Deleted data for ${account.email} (archived: ${account.archived_at})`);
    }

    // Delete the user accounts
    const userIds = accountsToDelete.map(a => a.id);
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .in('id', userIds);

    if (deleteError) {
      console.error('Error deleting archived accounts:', deleteError);
      return res.status(500).json({ error: 'Failed to delete archived accounts' });
    }

    console.log(`✅ Purged ${accountsToDelete.length} archived accounts`);

    return res.status(200).json({
      success: true,
      message: `Purged ${accountsToDelete.length} archived accounts`,
      deleted: accountsToDelete.length,
      accounts: accountsToDelete.map(a => ({ email: a.email, archivedAt: a.archived_at })),
    });

  } catch (error: any) {
    console.error('Purge error:', error);
    return res.status(500).json({ error: 'Failed to purge archived accounts' });
  }
}
