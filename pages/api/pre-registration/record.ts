import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/auth';

/**
 * POST /api/pre-registration/record
 * 
 * Records a pre-registration. Does NOT require auth.
 * Works for both guest users (device ID) and logged-in users (device ID + user ID).
 * Supports free registrations (transactionId = "free" or omitted) and
 * paid donations (transactionId = Apple StoreKit transaction ID).
 * 
 * Body:
 *   - deviceId: string (required) — unique device identifier
 *   - transactionId?: string — "free" for free registration, or StoreKit transaction ID for donations
 *   - productId?: string — product identifier
 *   - appVersion?: string — app version at time of registration
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

    if (!deviceId) {
      return res.status(400).json({ error: 'Missing required field: deviceId' });
    }

    const isFreeRegistration = !transactionId || transactionId === 'free';
    const effectiveTransactionId = isFreeRegistration ? `free_${deviceId}` : transactionId;

    console.log('🎫 Pre-registration record request:', {
      deviceId,
      transactionId: effectiveTransactionId,
      productId,
      type: isFreeRegistration ? 'free' : 'donation',
    });

    // Duplicate check: by device_id for free registrations, by transaction_id for donations
    if (isFreeRegistration) {
      const { data: existing } = await supabaseAdmin
        .from('pre_registrations')
        .select('id')
        .eq('device_id', deviceId)
        .single();

      if (existing) {
        console.log('🎫 Device already registered:', deviceId);
        return res.status(200).json({
          success: true,
          message: 'Already registered',
          alreadyExists: true,
        });
      }
    } else {
      const { data: existing } = await supabaseAdmin
        .from('pre_registrations')
        .select('id')
        .eq('transaction_id', effectiveTransactionId)
        .single();

      if (existing) {
        console.log('🎫 Transaction already recorded:', effectiveTransactionId);
        return res.status(200).json({
          success: true,
          message: 'Already recorded',
          alreadyExists: true,
        });
      }
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

    const { error: insertError } = await supabaseAdmin
      .from('pre_registrations')
      .insert({
        device_id: deviceId,
        transaction_id: effectiveTransactionId,
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
      transactionId: effectiveTransactionId,
      type: isFreeRegistration ? 'free' : 'donation',
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
