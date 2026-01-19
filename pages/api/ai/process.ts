import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/lib/auth';
import { getAvailableCredits, deductCredits, logUsage } from '@/lib/supabase';
import { processAIRequest, AI_PROMPTS, CREDIT_COSTS } from '@/lib/openai';

type ActionType = 
  | 'rephrase' | 'generate' | 'grammar' | 'formal' | 'casual'
  | 'analyze' | 'reply' | 'extract'
  | 'rephraseWithImage' | 'generateWithImage' | 'grammarWithImage' | 'formalWithImage' | 'casualWithImage';

interface RequestBody {
  action: ActionType;
  text?: string;
  imageBase64?: string;
  deviceId?: string;  // For guest mode
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // For image uploads
    },
  },
};

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
    // Try to authenticate user (optional - supports guest mode)
    const user = await authenticateRequest(req);
    
    const { action, text, imageBase64, deviceId }: RequestBody = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }
    
    // Calculate credit cost
    const hasImage = !!imageBase64;
    const creditCost = hasImage ? CREDIT_COSTS.vision : CREDIT_COSTS.text;
    
    // For logged-in users, check server-side credits
    // For guests, the client manages local credits - we trust the client's check
    let availableCredits = 0;
    
    if (user) {
      availableCredits = await getAvailableCredits(user.id);
      
      if (availableCredits < creditCost) {
        return res.status(402).json({ 
          error: 'Insufficient credits',
          availableCredits,
          requiredCredits: creditCost,
          upgradeUrl: '/pricing'
        });
      }
    } else if (!deviceId) {
      // No user and no deviceId - reject
      return res.status(401).json({ error: 'Authentication or device ID required' });
    }
    // For guests with deviceId, we proceed (client manages credits locally)
    
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
    
    let newCredits = 0;
    
    // Only deduct and log for logged-in users
    // Guests manage their credits locally on device
    if (user) {
      // Deduct credits
      await deductCredits(user.id, creditCost);
      
      // Calculate approximate cost (for analytics)
      const costPerInputToken = aiResponse.model === 'gpt-4o' ? 0.005 / 1000 : 0.00015 / 1000;
      const costPerOutputToken = aiResponse.model === 'gpt-4o' ? 0.015 / 1000 : 0.0006 / 1000;
      const costUsd = (aiResponse.tokensInput * costPerInputToken) + (aiResponse.tokensOutput * costPerOutputToken);
      
      // Log usage
      await logUsage(
        user.id,
        action,
        hasImage,
        creditCost,
        aiResponse.tokensInput,
        aiResponse.tokensOutput,
        costUsd
      );
      
      // Get updated credit balance
      newCredits = await getAvailableCredits(user.id);
    }
    
    return res.status(200).json({
      success: true,
      result: aiResponse.text,
      creditsUsed: creditCost,
      creditsRemaining: user ? newCredits : undefined,  // Only return for logged-in users
      isGuest: !user,
    });
    
  } catch (error: any) {
    console.error('AI processing error:', error);
    
    return res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
}






