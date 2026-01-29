import type { NextApiRequest, NextApiResponse } from 'next';
import { getGuestCredit } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Check if this device has already received initial credits
    const guestCredit = await getGuestCredit(deviceId);
    const hasReceivedCredits = guestCredit?.has_received_initial_credits || false;

    console.log(`✅ Device ${deviceId} check: hasReceivedCredits=${hasReceivedCredits}`);

    return res.status(200).json({
      hasReceivedCredits
    });
  } catch (error) {
    console.error('❌ Error checking device initial credits:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
