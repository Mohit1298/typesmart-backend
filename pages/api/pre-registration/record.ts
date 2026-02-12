import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/auth';

/**
 * POST /api/pre-registration/record
 * 
 * Records a pre-registration purchase. Does NOT require auth.
 * Works for both guest users (device ID) and logged-in users (device ID + user ID).
 * 
 * Body:
 *   - deviceId: string (required) — unique device identifier
 *   - transactionId: string (required) — Apple StoreKit transaction ID
 *   - productId: string (required) — should be "com.wirtel.TypeSmart.preregistration"
 *   - appVersion?: string — app version at time of purchase
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceId, transactionId, productId, appVersion } = req.body;

    if (!deviceId || !transactionId) {
      return res.status(400).json({ error: 'Missing required fields: deviceId, transactionId' });
    }

    console.log('🎫 Pre-registration record request:', {
      deviceId,
      transactionId,
      productId,
    });

    // Check if this transaction was already recorded
    const { data: existing } = await supabaseAdmin
      .from('pre_registrations')
      .select('id')
      .eq('transaction_id', transactionId)
      .single();

    if (existing) {
      console.log('🎫 Transaction already recorded:', transactionId);
      return res.status(200).json({
        success: true,
        message: 'Already recorded',
        alreadyExists: true,
      });
    }

    // Try to identify the user (optional — works without auth)
    let userId: string | null = null;
    let userEmail: string | null = null;

    try {
      const user = await authenticateRequest(req);
      if (user) {
        userId = user.id;
        userEmail = user.email;
      }
    } catch {
      // No auth — that's fine, record as guest
    }

    // Insert the pre-registration record
    const { error: insertError } = await supabaseAdmin
      .from('pre_registrations')
      .insert({
        device_id: deviceId,
        transaction_id: transactionId,
        product_id: productId || 'com.wirtel.TypeSmart.preregistration',
        user_id: userId,
        user_email: userEmail,
        app_version: appVersion || null,
      });

    if (insertError) {
      console.error('❌ Failed to record pre-registration:', insertError);
      return res.status(500).json({ error: 'Failed to record pre-registration' });
    }

    console.log('✅ Pre-registration recorded:', {
      deviceId,
      transactionId,
      userId: userId || 'guest',
    });

    return res.status(200).json({
      success: true,
      message: 'Pre-registration recorded',
    });

  } catch (error: any) {
    console.error('❌ Pre-registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
