import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth';
import { createCheckoutSession, PRICES } from '@/lib/stripe';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req);
    
    const { priceType } = req.body;
    
    let priceId: string;
    
    switch (priceType) {
      case 'pro':
        priceId = PRICES.PRO_MONTHLY;
        break;
      case 'credits_100':
        priceId = PRICES.CREDITS_PACK_100;
        break;
      case 'credits_500':
        priceId = PRICES.CREDITS_PACK_500;
        break;
      default:
        return res.status(400).json({ error: 'Invalid price type' });
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    
    const checkoutUrl = await createCheckoutSession(
      user.id,
      user.email,
      priceId,
      `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      `${baseUrl}/pricing`
    );
    
    return res.status(200).json({
      success: true,
      url: checkoutUrl,
    });
    
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

