import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Clean text for natural speech synthesis
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. Strip thinking tags
  text = text.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '');
  text = text.replace(/```(?:thought|thinking)[\s\S]*?```/gi, '');

  // 2. Remove chronicle status block
  const chronicleMatch = text.search(/---\s*\n\s*📊|\n\s*📊\s*\*\*\[Хроника мира\]\*\*/i);
  if (chronicleMatch !== -1) {
    text = text.substring(0, chronicleMatch);
  } else {
    const directChronicle = text.indexOf('📊');
    if (directChronicle !== -1 && directChronicle > 20) {
      text = text.substring(0, directChronicle);
    }
  }

  // 3. Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');

  // 4. Remove Markdown bold/italic/links/headers
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');
  text = text.replace(/#{1,6}\s+/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');

  // 5. Remove emoji & special symbols
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  text = text.replace(/[🎲✨⚔️🛡️👑🕯️📍🎯👥🎒⚡💎🚀💡]/g, '');

  // 6. Clean whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Engine 1A: Native Pure Node.js Microsoft Edge Neural TTS (No Python required!)
export async function synthesizeWithNativeMsEdgeTts(
  text: string,
  voice: string = 'ru-RU-DmitryNeural',
  rate: string = '+0%'
): Promise<Buffer | null> {
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate: rate || '+0%' });

    return await new Promise<Buffer | null>((resolve) => {
      const chunks: Buffer[] = [];
      const timeout = setTimeout(() => {
        try { audioStream.destroy(); } catch {}
        resolve(null);
      }, 15000);

      audioStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      audioStream.on('end', () => {
        clearTimeout(timeout);
        const buf = Buffer.concat(chunks);
        resolve(buf.length > 0 ? buf : null);
      });
      audioStream.on('error', (err) => {
        clearTimeout(timeout);
        console.warn('Native MsEdgeTTS error:', err?.message);
        resolve(null);
      });
    });
  } catch (err: any) {
    console.warn('synthesizeWithNativeMsEdgeTts init error:', err?.message);
    return null;
  }
}

// Engine 1B: Microsoft Edge Neural TTS with Native Node.js primary and Python CLI fallback
export async function synthesizeWithEdgeTts(
  text: string,
  voice: string = 'ru-RU-DmitryNeural',
  rate: string = '+0%'
): Promise<Buffer | null> {
  // 1. Try Native Node.js MsEdgeTTS first (fast, pure JS/WS, runs everywhere including packaged PC exe)
  try {
    const nativeBuf = await synthesizeWithNativeMsEdgeTts(text, voice, rate);
    if (nativeBuf && nativeBuf.length > 0) {
      return nativeBuf;
    }
  } catch (nativeErr) {
    console.warn('Native Edge-TTS error, trying Python fallback:', nativeErr);
  }

  // 2. Fallback to Python edge-tts CLI if installed
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const txtFile = path.join(os.tmpdir(), `edge_tts_input_${fileId}.txt`);
  const tmpFile = path.join(os.tmpdir(), `edge_tts_out_${fileId}.mp3`);
  const scriptPath = path.join(process.cwd(), 'scripts', 'edge_tts_synth.py');

  try {
    fs.writeFileSync(txtFile, text, { encoding: 'utf-8' });

    return await new Promise((resolve) => {
      execFile(
        'python',
        [scriptPath, txtFile, tmpFile, voice, rate],
        { timeout: 30000, maxBuffer: 20 * 1024 * 1024 },
        (err) => {
          try {
            if (fs.existsSync(txtFile)) fs.unlinkSync(txtFile);
          } catch {}

          if (err) {
            console.warn('Edge-TTS Python process error:', err.message);
            try {
              if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            } catch {}
            return resolve(null);
          }

          try {
            if (fs.existsSync(tmpFile)) {
              const buf = fs.readFileSync(tmpFile);
              fs.unlinkSync(tmpFile);
              if (buf.length > 0) {
                return resolve(buf);
              }
            }
          } catch (e) {
            console.warn('Edge-TTS file read error:', e);
          }
          resolve(null);
        }
      );
    });
  } catch (err) {
    console.warn('synthesizeWithEdgeTts exception:', err);
    try {
      if (fs.existsSync(txtFile)) fs.unlinkSync(txtFile);
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
    return null;
  }
}

// Engine 2: High-Speed Google Neural Audio Stream
export function splitTextIntoSentences(text: string, maxChunkLen = 160): string[] {
  const parts: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

  let current = '';
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((current + ' ' + trimmed).length <= maxChunkLen) {
      current = current ? current + ' ' + trimmed : trimmed;
    } else {
      if (current) parts.push(current);
      if (trimmed.length <= maxChunkLen) {
        current = trimmed;
      } else {
        const words = trimmed.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).length <= maxChunkLen) {
            sub = sub ? sub + ' ' + w : w;
          } else {
            if (sub) parts.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) parts.push(current);
  return parts;
}

const GOOGLE_TTS_HOSTS = [
  'https://translate.googleapis.com',
  'https://translate.google.com',
  'https://translate.google.ru',
];

export async function fetchAudioChunk(chunk: string, lang = 'ru'): Promise<Buffer> {
  let lastError: any = null;

  for (const host of GOOGLE_TTS_HOSTS) {
    const url = `${host}/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > 0) {
          return Buffer.from(arrayBuf);
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Все серверы Google TTS недоступны или заблокированы провайдером');
}

export async function synthesizeWithGoogleFallback(text: string, lang = 'ru'): Promise<Buffer | null> {
  const chunks = splitTextIntoSentences(text.slice(0, 3000));
  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    try {
      const buf = await fetchAudioChunk(chunk, lang);
      audioBuffers.push(buf);
    } catch (err) {
      console.warn('Chunk audio fetch error:', err);
    }
  }

  if (audioBuffers.length === 0) return null;
  return Buffer.concat(audioBuffers);
}

// Unified synthesis helper used by both streaming audio and diagnostic connection tests
export async function synthesizeAudioBuffer(options: {
  text: string;
  voice?: string;
  rate?: string;
  provider?: string;
}): Promise<{ buffer: Buffer | null; engineUsed: string; error?: string }> {
  const {
    text,
    rate = '+0%',
    provider = 'edge',
  } = options;

  let voice = options.voice || 'ru-RU-DmitryNeural';
  if (!voice || voice.startsWith('en')) {
    voice = 'ru-RU-DmitryNeural';
  }

  const speechText = cleanTextForSpeech(text);
  if (!speechText) {
    return { buffer: null, engineUsed: 'none', error: 'Текст пуст' };
  }

  // 1. Google Speech Engine (Russian) with automatic Edge Neural fallback if blocked
  if (provider === 'google') {
    let buf = await synthesizeWithGoogleFallback(speechText, 'ru');
    if (buf && buf.length > 0) {
      return { buffer: buf, engineUsed: 'Google Speech Stream (RU)' };
    }

    // If Google endpoints are blocked/throttled by ISP, automatically fall back to Microsoft Edge Neural
    console.info('Google TTS unavailable/blocked, auto-fallback to Microsoft Edge Neural...');
    buf = await synthesizeWithEdgeTts(speechText.slice(0, 3000), voice, rate);
    if (buf && buf.length > 0) {
      return { buffer: buf, engineUsed: `Microsoft Edge Neural (Резерв: ${voice})` };
    }

    return {
      buffer: null,
      engineUsed: 'Google Speech',
      error: 'Серверы Google TTS заблокированы или недоступны. Рекомендуется использовать Microsoft Edge Neural или Web Speech API (Офлайн).',
    };
  }

  // 2. Microsoft Edge Neural TTS (Default Russian) with auto-fallback to Google (RU)
  let buf = await synthesizeWithEdgeTts(speechText.slice(0, 3000), voice, rate);
  if (buf && buf.length > 0) {
    return { buffer: buf, engineUsed: `Microsoft Edge Neural (${voice})` };
  }

  // Fallback to Google Russian stream
  console.info('Edge-TTS unavailable, falling back to Google speech stream...');
  buf = await synthesizeWithGoogleFallback(speechText, 'ru');
  if (buf && buf.length > 0) {
    return { buffer: buf, engineUsed: `Google Speech Stream (Резервный канал RU)` };
  }

  return { buffer: null, engineUsed: 'Edge/Google', error: 'Не удалось синтезировать речь ни одним из открытых движков' };
}
