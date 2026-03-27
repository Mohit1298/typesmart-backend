import { RealtimeSegmentBuffer, SonioxNodeClient } from '@soniox/node';

/** Balance: fewer WebSocket frames (less overhead) vs. first-byte latency on very short clips. */
const CHUNK_BYTES = 24 * 1024;

/**
 * Transcribe a full audio file via Soniox real-time WebSocket (stt-rt-v4).
 * Faster than async REST (upload file → poll job) for typical dictation clips.
 */
export async function transcribeBufferViaSonioxRealtime(
  audioBuffer: Buffer,
  languageHints: string[]
): Promise<string> {
  const apiKey = process.env.SONIOX_API_KEY || '';
  if (!apiKey) {
    throw new Error('SONIOX_API_KEY not configured');
  }

  const client = new SonioxNodeClient({ api_key: apiKey });
  const segmentBuffer = new RealtimeSegmentBuffer({ final_only: true });
  let manualFinalText = '';

  const session = client.realtime.stt({
    model: 'stt-rt-v4',
    audio_format: 'auto',
    language_hints: languageHints,
    language_hints_strict: true,
    // Per-token language ID is unused for dictation; disabling saves model work.
    enable_language_identification: false,
    // Pre-recorded clips: semantic endpointing can add up to max_endpoint_delay_ms (default 2000)
    // after the last audio byte. We finalize explicitly after the file instead.
    enable_endpoint_detection: false,
  });

  session.on('result', (result) => {
    if (result.finished) return;
    for (const t of result.tokens) {
      if (t.is_final) manualFinalText += t.text;
    }
    segmentBuffer.add(result);
  });

  let sessionError: Error | null = null;
  session.on('error', (err) => {
    sessionError = err;
  });

  await session.connect();

  async function* chunkAudio(): AsyncGenerator<Uint8Array> {
    const u8 = new Uint8Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength);
    for (let i = 0; i < u8.length; i += CHUNK_BYTES) {
      yield u8.subarray(i, Math.min(i + CHUNK_BYTES, u8.length));
    }
  }

  try {
    await session.sendStream(chunkAudio(), { finish: false });
    // Forces final tokens without endpointing. Keep trailing_silence small — each ms here is pure wait
    // on top of Soniox’s own processing (their ~250ms figure is model latency, not this tail).
    session.finalize({ trailing_silence_ms: 80 });
    await session.finish();
  } catch (e) {
    session.close();
    throw e;
  }

  if (sessionError) {
    throw sessionError;
  }

  const segments = segmentBuffer.flushAll();
  let text = segments.map((s) => s.text).join('').trim();
  if (!text) {
    text = manualFinalText.trim();
  }

  return text;
}
