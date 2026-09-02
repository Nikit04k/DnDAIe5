import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Clean text for natural speech synthesis
function cleanTextForSpeech(raw: string): string {
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

// Engine 1: Microsoft Edge Neural TTS via Python CLI
async function synthesizeWithEdgeTts(
  text: string,
  voice: string = 'ru-RU-DmitryNeural',
  rate: string = '+0%'
): Promise<Buffer | null> {
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const txtFile = path.join(os.tmpdir(), `edge_tts_input_${fileId}.txt`);
  const tmpFile = path.join(os.tmpdir(), `edge_tts_out_${fileId}.mp3`);
  const scriptPath = path.join(process.cwd(), 'scripts', 'edge_tts_synth.py');

  try {
    // Write text to UTF-8 file to prevent Windows CLI argument length and encoding errors
    fs.writeFileSync(txtFile, text, { encoding: 'utf-8' });

    return await new Promise((resolve) => {
      execFile(
        'python',
        [scriptPath, txtFile, tmpFile, voice, rate],
        { timeout: 30000, maxBuffer: 20 * 1024 * 1024 },
        (err) => {
          // Clean up txtFile
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
function splitTextIntoSentences(text: string, maxChunkLen = 160): string[] {
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

async function fetchAudioChunk(chunk: string): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=ru&client=tw-ob`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!res.ok) {
    throw new Error(`TTS provider returned ${res.status}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function synthesizeWithGoogleFallback(text: string): Promise<Buffer | null> {
  const chunks = splitTextIntoSentences(text.slice(0, 3000));
  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    try {
      const buf = await fetchAudioChunk(chunk);
      audioBuffers.push(buf);
    } catch (err) {
      console.warn('Chunk audio fetch error:', err);
    }
  }

  if (audioBuffers.length === 0) return null;
  return Buffer.concat(audioBuffers);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text = '',
      voice = 'ru-RU-DmitryNeural',
      rate = '+0%',
    }: { text: string; voice?: string; rate?: string } = body;

    const speechText = cleanTextForSpeech(text);
    if (!speechText || speechText.trim().length === 0) {
      return NextResponse.json({ error: 'Text is empty' }, { status: 400 });
    }

    // 1. Try Microsoft Edge Neural TTS first
    let audioBuffer = await synthesizeWithEdgeTts(speechText.slice(0, 3000), voice, rate);

    // 2. If Edge TTS is unavailable, fall back to Google Audio Stream
    if (!audioBuffer) {
      console.info('Falling back to Google Neural Audio stream...');
      audioBuffer = await synthesizeWithGoogleFallback(speechText);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Failed to synthesize audio' }, { status: 500 });
    }

    return new Response(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to synthesize speech' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawText = searchParams.get('text') || 'Привет, путник!';
    const voice = searchParams.get('voice') || 'ru-RU-DmitryNeural';
    const rate = searchParams.get('rate') || '+0%';

    const clean = cleanTextForSpeech(rawText);
    let audioBuffer = await synthesizeWithEdgeTts(clean.slice(0, 3000), voice, rate);

    if (!audioBuffer) {
      audioBuffer = await synthesizeWithGoogleFallback(clean);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }

    return new Response(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
