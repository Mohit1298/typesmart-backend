import type { NextApiRequest, NextApiResponse } from 'next';
import { processAIRequest, AI_PROMPTS, CREDIT_COSTS } from '@/lib/openai';

type ActionType = 
  | 'rephrase' | 'generate' | 'grammar' | 'formal' | 'casual'
  | 'analyze' | 'reply' | 'extract'
  | 'rephraseWithImage' | 'generateWithImage' | 'grammarWithImage' | 'formalWithImage' | 'casualWithImage';

interface RequestBody {
  action: ActionType;
  text?: string;
  imageBase64?: string;
  deviceId: string;
  localCredits: number;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // For image uploads
    },
  },
};

/**
 * Anonymous AI Processing Endpoint
 * 
 * This endpoint allows non-logged-in users to use AI features.
 * Per Apple Guideline 5.1.1, users who purchase credits should be able
 * to use them without creating an account.
 * 
 * Credits are tracked locally on the device and deducted after successful processing.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, text, imageBase64, deviceId, localCredits }: RequestBody = req.body;
    
    // Validate device ID
    const headerDeviceId = req.headers['x-device-id'];
    if (!deviceId || (headerDeviceId && headerDeviceId !== deviceId)) {
      return res.status(400).json({ error: 'Invalid device ID' });
    }
    
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }
    
    // Calculate credit cost
    const hasImage = !!imageBase64;
    const creditCost = hasImage ? CREDIT_COSTS.vision : CREDIT_COSTS.text;
    
    // Verify local credits
    if (!localCredits || localCredits < creditCost) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        localCredits: localCredits || 0,
        requiredCredits: creditCost,
      });
    }
    
    // Build the prompt based on action
    let prompt: string;
    
    switch (action) {
      case 'rephrase':
        prompt = AI_PROMPTS.rephrase(text || '');
        break;
      case 'generate':
        prompt = AI_PROMPTS.generate(text || '');
        break;
      case 'grammar':
        prompt = AI_PROMPTS.grammar(text || '');
        break;
      case 'formal':
        prompt = AI_PROMPTS.formal(text || '');
        break;
      case 'casual':
        prompt = AI_PROMPTS.casual(text || '');
        break;
      case 'analyze':
        prompt = AI_PROMPTS.analyze(text);
        break;
      case 'reply':
        prompt = AI_PROMPTS.reply();
        break;
      case 'extract':
        prompt = AI_PROMPTS.extract();
        break;
      case 'rephraseWithImage':
        prompt = AI_PROMPTS.rephraseWithImage(text || '');
        break;
      case 'generateWithImage':
        prompt = AI_PROMPTS.generateWithImage(text || '');
        break;
      case 'grammarWithImage':
        prompt = AI_PROMPTS.grammarWithImage(text || '');
        break;
      case 'formalWithImage':
        prompt = AI_PROMPTS.formalWithImage(text || '');
        break;
      case 'casualWithImage':
        prompt = AI_PROMPTS.casualWithImage(text || '');
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Process with OpenAI
    const aiResponse = await processAIRequest({
      prompt,
      imageBase64,
    });
    
    // Log anonymous usage (for analytics only, no user tracking)
    console.log(`Anonymous AI request: action=${action}, hasImage=${hasImage}, deviceId=${deviceId.substring(0, 8)}...`);
    
    return res.status(200).json({
      success: true,
      result: aiResponse.text,
      creditsUsed: creditCost,
      // Credits are deducted locally by the client
    });
    
  } catch (error: any) {
    console.error('Anonymous AI processing error:', error);
    
    return res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
}
