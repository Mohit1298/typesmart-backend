import OpenAI from 'openai';
import { Readable } from 'stream';

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

// Credit costs for all AI operations
export const CREDIT_COSTS = {
  text: 1,
  vision: 3,
  // AI Voice costs
  voiceProfileCreate: 10,
  aiVoiceFlat: 3,        // Flat cost per request regardless of count
};

/**
 * Calculate credit cost for AI voice response generation
 * @param responseCount Number of responses to generate (1, 3, or 5)
 * @returns Credit cost - flat 3 credits per request
 */
export function calculateAIVoiceCost(responseCount: number): number {
  return CREDIT_COSTS.aiVoiceFlat;
}

export async function processAIRequest(options: AIRequestOptions): Promise<AIResponse> {
  const { prompt, imageBase64, maxTokens = 500, temperature = 0.7 } = options;
  
  const isVisionRequest = !!imageBase64;
  // Using stable models - gpt-4o-mini for text, gpt-4o for vision
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
    `Please rephrase the following text to make it clearer and more professional. Only return the rephrased text, nothing else. Do not wrap your response in quotation marks.\n\n${text}`,
  
  generate: (text: string) => 
    `Based on this prompt, generate helpful text. Only return the generated text, nothing else. Do not wrap your response in quotation marks.\n\n${text}`,
  
  grammar: (text: string) => 
    `Please correct the grammar and spelling in the following text while maintaining its original meaning. Only return the corrected text, nothing else. Do not wrap your response in quotation marks.\n\n${text}`,
  
  formal: (text: string) => 
    `Please rewrite the following text in a more formal tone. Only return the formal version, nothing else. Do not wrap your response in quotation marks.\n\n${text}`,
  
  casual: (text: string) => 
    `Please rewrite the following text in a more casual and friendly tone. Only return the casual version, nothing else. Do not wrap your response in quotation marks.\n\n${text}`,
  
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
      ? `Look at this image for context. Rephrase this text to be clearer and more professional. Only return the rephrased text, nothing else. Do not wrap your response in quotation marks.\n\n${text}`
      : `Look at this image. If there is text in the image, rephrase it to be clearer and more professional. Only return the rephrased text, nothing else. Do not wrap your response in quotation marks.`,
  
  generateWithImage: (text: string) => 
    text 
      ? `Look at this image. Based on the image and this instruction, generate the requested content. Only return the generated text, nothing else. Do not wrap your response in quotation marks.\n\n${text}`
      : `Look at this image. Based on what you see, generate helpful and relevant text. Only return the generated text, nothing else. Do not wrap your response in quotation marks.`,
  
  grammarWithImage: (text: string) => 
    text 
      ? `Look at this image. Correct the grammar and spelling in this text. Only return the corrected text, nothing else. Do not wrap your response in quotation marks.\n\n${text}`
      : `Look at this image. If there is text in the image, correct any grammar and spelling errors. Only return the corrected text, nothing else. Do not wrap your response in quotation marks.`,
  
  formalWithImage: (text: string) => 
    text 
      ? `Look at this image for context. Rewrite this text in a more formal tone. Only return the formal version, nothing else. Do not wrap your response in quotation marks.\n\n${text}`
      : `Look at this image. If there is text in the image, rewrite it in a more formal tone. Only return the formal version, nothing else. Do not wrap your response in quotation marks.`,
  
  casualWithImage: (text: string) => 
    text 
      ? `Look at this image for context. Rewrite this text in a more casual and friendly tone. Only return the casual version, nothing else. Do not wrap your response in quotation marks.\n\n${text}`
      : `Look at this image. If there is text in the image, rewrite it in a more casual and friendly tone. Only return the casual version, nothing else. Do not wrap your response in quotation marks.`,
};

// ============================================
// AI Voice Response Functions
// ============================================

/**
 * Transcribe audio using OpenAI Whisper
 * @param audioBuffer Audio data as Buffer
 * @param filename Original filename with extension (for format detection)
 * @returns Transcribed text
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string
): Promise<string> {
  // Check for unsupported formats
  const supportedFormats = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  let processedFilename = filename;
  let mimeType = getAudioMimeType(filename);
  
  // CAF files are not natively supported by Whisper
  // The iOS app should convert CAF to M4A before upload, but as a fallback try WAV
  if (ext === 'caf') {
    console.log(`⚠️ CAF file received. iOS should convert to M4A before upload.`);
    console.log(`   Attempting WAV fallback: ${filename} -> ${filename.replace(/\.caf$/i, '.wav')}`);
    processedFilename = filename.replace(/\.caf$/i, '.wav');
    mimeType = 'audio/wav';
  } else if (!supportedFormats.includes(ext)) {
    throw new Error(`Unsupported audio format: ${ext}. Supported formats: ${supportedFormats.join(', ')}`);
  }
  
  // Create a File-like object from the buffer - convert Buffer to Uint8Array for compatibility
  const uint8Array = new Uint8Array(audioBuffer);
  const file = new File([uint8Array], processedFilename, {
    type: mimeType,
  });

  try {
    const response = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en', // Can be made configurable
      response_format: 'text',
    });

    return response;
  } catch (error: any) {
    // Provide more specific error message for format issues
    if (error?.message?.includes('Invalid file format') || error?.status === 400) {
      throw new Error(`Audio format error: Please ensure voice notes are recorded in a supported format (m4a, mp3, wav). Original format: ${ext}`);
    }
    throw error;
  }
}

/**
 * Generate alternative phrasings for a user's voice message using GPT-4
 * @param transcription The transcribed text from user's voice note
 * @param count Number of alternative phrasings to generate
 * @returns Array of alternative phrasings
 */
export async function generateVoiceResponses(
  transcription: string,
  count: number
): Promise<string[]> {
  const systemPrompt = `You help users rephrase their voice messages. Generate exactly ${count} alternative ways to say the same thing.CRITICAL FORMAT RULES:
- Output ONLY the alternatives, nothing else
- Put each alternative on its own line
- Start each line with the number followed by a period (1. 2. 3.)
- Do NOT add any intro text, explanations, or commentary
- Do NOT use quotation marks

CONTENT RULES:
- Keep the SAME meaning and intent
- Each should be 1-3 sentences, suitable for a voice message
- Vary the tone: casual, polished, warm/friendly
- Match the approximate length of the original

Original message: "${transcription}"

Output exactly ${count} numbered alternatives:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  const content = response.choices[0].message.content || '';
  console.log('GPT raw response:', content);
  
  // Parse numbered responses (1. 2. 3. format)
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const responses: string[] = [];
  
  for (const line of lines) {
    // Match lines starting with number and period: "1." "2." "3." etc
    const match = line.match(/^\d+\.\s*(.+)$/);
    if (match) {
      // Remove any quotes around the text
      let text = match[1].trim();
      text = text.replace(/^["']|["']$/g, '');
      if (text.length > 0) {
        responses.push(text);
      }
    }
  }
  
  // If numbered parsing failed, try splitting by common separators
  if (responses.length === 0) {
    const fallbackResponses = content
      .split(/---|\n\n/)
      .map(r => r.trim().replace(/^["']|["']$/g, ''))
      .filter(r => r.length > 0 && !r.match(/^(here|alternative|option)/i));
    
    if (fallbackResponses.length > 0) {
      return fallbackResponses.slice(0, count);
    }
    
    // Last resort: return the whole content as one response
    return [content.trim()];
  }

  return responses.slice(0, count);
}

/**
 * Get MIME type from filename
 */
function getAudioMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
      return 'audio/mp4';
    case 'caf':
      return 'audio/x-caf';
    case 'ogg':
      return 'audio/ogg';
    case 'webm':
      return 'audio/webm';
    default:
      return 'audio/mpeg';
  }
}