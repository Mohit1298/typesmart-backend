/** Shared romanization for dictation (async file + realtime WebSocket flows). */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export function containsNonLatin(text: string): boolean {
  return /[^\u0000-\u024F\u1E00-\u1EFF\s\d.,!?;:'"()\-–—…@#$%^&*+=/<>[\]{}|\\~`_]/.test(text);
}

export interface RomanizeResult {
  text: string;
  didCallOpenAI: boolean;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
}

export async function romanizeDictationText(rawText: string, languageMode: string): Promise<RomanizeResult> {
  if (!containsNonLatin(rawText)) {
    return { text: rawText, didCallOpenAI: false, tokensInput: 0, tokensOutput: 0, costUsd: 0 };
  }

  const languageLabel =
    languageMode === 'hinglish'
      ? 'Hindi/Hinglish'
      : languageMode === 'marathi_english'
      ? 'Marathi'
      : languageMode === 'gujarati_english'
      ? 'Gujarati'
      : 'Indian language';

  const prompt = `You are a romanization engine. Convert the following ${languageLabel} text into Latin/Roman script exactly as a native speaker would type it using English letters. Rules:
- Output ONLY the romanized text, nothing else.
- Preserve the exact meaning and sentence structure. Do NOT translate to English.
- Use natural, commonly-used romanization (e.g. "mujhe bhook lagi hai" not "mujhe bhūkh lagī hai").
- Keep any English words already in the text as-is.
- Preserve punctuation and sentence breaks.
- Do NOT add quotes around the output.

Text to romanize:
${rawText}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    console.error('Romanization OpenAI call failed, returning raw text');
    return { text: rawText, didCallOpenAI: false, tokensInput: 0, tokensOutput: 0, costUsd: 0 };
  }

  const data = await res.json();
  const romanized = data.choices?.[0]?.message?.content?.trim();
  const tokensInput = data.usage?.prompt_tokens || 0;
  const tokensOutput = data.usage?.completion_tokens || 0;
  const costPerInput = 0.00015 / 1000;
  const costPerOutput = 0.0006 / 1000;
  const costUsd = tokensInput * costPerInput + tokensOutput * costPerOutput;

  return {
    text: romanized || rawText,
    didCallOpenAI: true,
    tokensInput,
    tokensOutput,
    costUsd,
  };
}
