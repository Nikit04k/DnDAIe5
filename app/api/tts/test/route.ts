import { NextRequest, NextResponse } from 'next/server';
import { synthesizeAudioBuffer } from '@/lib/ttsCore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const startTime = performance.now();
  try {
    const body = await req.json();
    const {
      text = 'Связь с голосовым синтезом успешно установлена! Готов к озвучке приключений.',
      voice = 'ru-RU-DmitryNeural',
      rate = '+0%',
      provider = 'edge',
    }: {
      text?: string;
      voice?: string;
      rate?: string;
      provider?: string;
    } = body;

    const sampleText = text.trim() || 'Связь с голосовым синтезом успешно установлена!';

    const result = await synthesizeAudioBuffer({
      text: sampleText,
      voice,
      rate,
      provider,
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!result.buffer || result.buffer.length === 0) {
      return NextResponse.json({
        success: false,
        latencyMs,
        provider,
        voice,
        error: result.error || 'Не удалось синтезировать проверочный аудиопоток.',
      });
    }

    const base64 = result.buffer.toString('base64');
    const audioDataUri = `data:audio/mp3;base64,${base64}`;

    return NextResponse.json({
      success: true,
      latencyMs,
      provider,
      voice,
      engineUsed: result.engineUsed,
      audioBase64: audioDataUri,
      audioSizeBytes: result.buffer.length,
      sampleText,
    });
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return NextResponse.json({
      success: false,
      latencyMs,
      error: error?.message || 'Внутренняя ошибка при проверке синтезатора речи',
    });
  }
}
