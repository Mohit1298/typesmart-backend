import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth';
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
    // Authenticate user
    const user = await requireAuth(req);
    
    const { action, text, imageBase64 }: RequestBody = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }
    
    // Calculate credit cost
    const hasImage = !!imageBase64;
    const creditCost = hasImage ? CREDIT_COSTS.vision : CREDIT_COSTS.text;
    
    // Check available credits
    const availableCredits = await getAvailableCredits(user.id);
    
    if (availableCredits < creditCost) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        availableCredits,
        requiredCredits: creditCost,
        upgradeUrl: '/pricing'
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
    const newCredits = await getAvailableCredits(user.id);
    
    return res.status(200).json({
      success: true,
      result: aiResponse.text,
      creditsUsed: creditCost,
      creditsRemaining: newCredits,
    });
    
  } catch (error: any) {
    console.error('AI processing error:', error);
    
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
}



