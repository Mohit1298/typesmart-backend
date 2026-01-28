import type { NextApiRequest, NextApiResponse } from 'next';
import { markDeviceReceivedInitialCredits } from '@/lib/supabase';

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
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    // Mark that this device has received initial free credits
    await markDeviceReceivedInitialCredits(deviceId);
    
    return res.status(200).json({
      success: true,
      message: 'Device marked as having received initial credits'
    });
    
  } catch (error: any) {
    console.error('Error marking device credits:', error);
    return res.status(500).json({ error: 'Failed to mark device credits' });
  }
}
