/**
 * Deepgram pre-recorded STT (https://developers.deepgram.com/docs/pre-recorded-audio).
 * Hindi in Latin script uses language=hi-Latn (see models-languages-overview; base/nova support hi-Latn).
 *
 * The app sends WAV (same native CAF→WAV path as Soniox dictation); Deepgram reads the container.
 *
 * Override query via env: DEEPGRAM_LISTEN_QUERY=model=nova-3&language=multi&smart_format=true
 */

export function parseDeepgramTranscript(data: unknown): string {
  const d = data as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };
  const t = d?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  return typeof t === 'string' ? t.trim() : '';
}

export async function transcribeBufferViaDeepgram(
  buffer: Buffer,
  contentType: string
): Promise<{ transcript: string; deepgramMs: number }> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    throw new Error('DEEPGRAM_API_KEY not configured');
  }

  const query =
    process.env.DEEPGRAM_LISTEN_QUERY || 'model=base&language=hi-Latn&smart_format=true';
  const url = `https://api.deepgram.com/v1/listen?${query}`;

  const dgStart = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${key}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(buffer),
  });
  const deepgramMs = Date.now() - dgStart;

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Deepgram HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = await res.json();
  return { transcript: parseDeepgramTranscript(json), deepgramMs };
}

export function contentTypeForDictationFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'wav':
      return 'audio/wav';
    case 'caf':
      return 'audio/x-caf';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/m4a';
    case 'flac':
      return 'audio/flac';
    default:
      return 'application/octet-stream';
  }
}
