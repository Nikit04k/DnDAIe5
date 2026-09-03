import { NextRequest, NextResponse } from 'next/server';
import { synthesizeAudioBuffer } from '@/lib/ttsCore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text = '',
      voice = 'ru-RU-DmitryNeural',
      rate = '+0%',
      provider = 'edge',
    }: {
      text: string;
      voice?: string;
      rate?: string;
      provider?: string;
    } = body;

    const result = await synthesizeAudioBuffer({
      text,
      voice,
      rate,
      provider,
    });

    if (!result.buffer || result.buffer.length === 0) {
      return NextResponse.json(
        { error: result.error || 'Failed to synthesize audio' },
        { status: 500 }
      );
    }

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': result.buffer.length.toString(),
        'X-TTS-Engine': encodeURIComponent(result.engineUsed),
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
    const provider = searchParams.get('provider') || 'edge';

    const result = await synthesizeAudioBuffer({
      text: rawText,
      voice,
      rate,
      provider,
    });

    if (!result.buffer || result.buffer.length === 0) {
      return NextResponse.json({ error: result.error || 'Failed' }, { status: 500 });
    }

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': result.buffer.length.toString(),
        'X-TTS-Engine': encodeURIComponent(result.engineUsed),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
