import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIRequestOptions {
  prompt: string;
  imageBase64?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
}

// Credit costs
export const CREDIT_COSTS = {
  text: 1,
  vision: 3,
};

export async function processAIRequest(options: AIRequestOptions): Promise<AIResponse> {
  const { prompt, imageBase64, maxTokens = 500, temperature = 0.7 } = options;
  
  const isVisionRequest = !!imageBase64;
  const model = isVisionRequest ? 'gpt-4o' : 'gpt-4o-mini';
  
  let messages: OpenAI.ChatCompletionMessageParam[];
  
  if (isVisionRequest) {
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: 'auto',
            },
          },
        ],
      },
    ];
  } else {
    messages = [
      { role: 'user', content: prompt },
    ];
  }
  
  const response = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  });
  
  const choice = response.choices[0];
  
  return {
    text: choice.message.content?.trim() || '',
    tokensInput: response.usage?.prompt_tokens || 0,
    tokensOutput: response.usage?.completion_tokens || 0,
    model,
  };
}

// Predefined prompts for different actions
export const AI_PROMPTS = {
  rephrase: (text: string) => 
    `Please rephrase the following text to make it clearer and more professional. Only return the rephrased text, nothing else: "${text}"`,
  
  generate: (text: string) => 
    `Based on this prompt, generate helpful text. Only return the generated text, nothing else: "${text}"`,
  
  grammar: (text: string) => 
    `Please correct the grammar and spelling in the following text while maintaining its original meaning. Only return the corrected text, nothing else: "${text}"`,
  
  formal: (text: string) => 
    `Please rewrite the following text in a more formal tone. Only return the formal version, nothing else: "${text}"`,
  
  casual: (text: string) => 
    `Please rewrite the following text in a more casual and friendly tone. Only return the casual version, nothing else: "${text}"`,
  
  analyze: (text?: string) => 
    text 
      ? `Look at this image. ${text}`
      : `Analyze this image and describe what you see. If it contains text, extract and present it clearly. If it's a conversation or message, suggest an appropriate reply.`,
  
  reply: () => 
    `Look at this screenshot. If it shows a conversation or message, generate an appropriate, friendly reply. If it shows something else, describe what action or response would be appropriate. Only return the reply text, nothing else.`,
  
  extract: () => 
    `Extract all text visible in this image. Return only the extracted text, preserving the original formatting as much as possible.`,
  
  // Vision + text combined
  rephraseWithImage: (text: string) => 
    text 
      ? `Look at this image for context. Rephrase this text to be clearer and more professional: "${text}". Only return the rephrased text, nothing else.`
      : `Look at this image. If there is text in the image, rephrase it to be clearer and more professional. Only return the rephrased text, nothing else.`,
  
  generateWithImage: (text: string) => 
    text 
      ? `Look at this image. Based on the image and this instruction: "${text}", generate the requested content. Only return the generated text, nothing else.`
      : `Look at this image. Based on what you see, generate helpful and relevant text. Only return the generated text, nothing else.`,
  
  grammarWithImage: (text: string) => 
    text 
      ? `Look at this image. Correct the grammar and spelling in this text: "${text}". Only return the corrected text, nothing else.`
      : `Look at this image. If there is text in the image, correct any grammar and spelling errors. Only return the corrected text, nothing else.`,
  
  formalWithImage: (text: string) => 
    text 
      ? `Look at this image for context. Rewrite this text in a more formal tone: "${text}". Only return the formal version, nothing else.`
      : `Look at this image. If there is text in the image, rewrite it in a more formal tone. Only return the formal version, nothing else.`,
  
  casualWithImage: (text: string) => 
    text 
      ? `Look at this image for context. Rewrite this text in a more casual and friendly tone: "${text}". Only return the casual version, nothing else.`
      : `Look at this image. If there is text in the image, rewrite it in a more casual and friendly tone. Only return the casual version, nothing else.`,
};

