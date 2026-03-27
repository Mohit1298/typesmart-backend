/**
 * Deepgram pre-recorded STT (https://developers.deepgram.com/docs/pre-recorded-audio).
 * Hindi in Latin script uses language=hi-Latn (see models-languages-overview; base/nova support hi-Latn).
 *
 * Core Audio (.caf) is not a listed container on Deepgram’s supported-formats page; we decode CAF to
 * headerless linear16 PCM and pass encoding + sample_rate + channels per
 * https://developers.deepgram.com/docs/encoding
 *
 * Override query via env: DEEPGRAM_LISTEN_QUERY=model=nova-3&language=multi&smart_format=true
 */

export function interleaveChannelsFloat32ToInt16LE(channels: Float32Array[]): Buffer {
  const nCh = channels.length;
  const nFrames = channels[0]?.length ?? 0;
  const buf = Buffer.alloc(nFrames * nCh * 2);
  let o = 0;
  for (let i = 0; i < nFrames; i++) {
    for (let c = 0; c < nCh; c++) {
      const sample = channels[c][i] ?? 0;
      const s = Math.max(-1, Math.min(1, sample));
      const int16 = s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
      buf.writeInt16LE(int16, o);
      o += 2;
    }
  }
  return buf;
}

export function parseDeepgramTranscript(data: unknown): string {
  const d = data as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };
  const t = d?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  return typeof t === 'string' ? t.trim() : '';
}

export type DeepgramRawLinear16 = { sampleRate: number; channels: number };

function buildListenUrl(rawLinear16?: DeepgramRawLinear16): string {
  const base =
    process.env.DEEPGRAM_LISTEN_QUERY || 'model=base&language=hi-Latn&smart_format=true';
  const params = new URLSearchParams(base);
  if (rawLinear16) {
    params.set('encoding', 'linear16');
    params.set('sample_rate', String(rawLinear16.sampleRate));
    params.set('channels', String(rawLinear16.channels));
  }
  return `https://api.deepgram.com/v1/listen?${params.toString()}`;
}

export async function transcribeBufferViaDeepgram(
  buffer: Buffer,
  contentType: string,
  rawLinear16?: DeepgramRawLinear16
): Promise<{ transcript: string; deepgramMs: number }> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    throw new Error('DEEPGRAM_API_KEY not configured');
  }

  const url = buildListenUrl(rawLinear16);

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
