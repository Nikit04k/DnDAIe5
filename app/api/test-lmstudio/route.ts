import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      url: userUrl = 'http://localhost:1234/v1',
      model: userModel = '',
      apiKey: userApiKey = 'lm-studio',
      testPrompt = 'Ответь кратко (1-2 предложения) на русском языке: "Связь с локальной нейросетью через LM Studio успешно установлена!" и пожелай удачи в игре.',
    } = body;

    let baseUrl = (userUrl || 'http://localhost:1234/v1').trim().replace(/\/+$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `http://${baseUrl}`;
    }
    if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/')) {
      baseUrl = `${baseUrl}/v1`;
    }

    const apiKey = userApiKey && userApiKey.trim().length > 0 ? userApiKey.trim() : 'lm-studio';

    // 1. First attempt to query LM Studio /models to detect loaded models
    let availableModels: string[] = [];
    let detectedModel = userModel.trim();

    try {
      const modelsController = new AbortController();
      const modelsTimeout = setTimeout(() => modelsController.abort(), 4000);

      const modelsRes = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: modelsController.signal,
      });

      clearTimeout(modelsTimeout);

      if (modelsRes.ok) {
        const data = await modelsRes.json();
        if (Array.isArray(data?.data)) {
          availableModels = data.data.map((m: any) => m.id || m.name || '').filter(Boolean);
        } else if (Array.isArray(data?.models)) {
          availableModels = data.models.map((m: any) => m.id || m.name || '').filter(Boolean);
        }
      }
    } catch (e) {
      console.warn('LM Studio /models query warning (proceeding to chat/completions):', e);
    }

    // If no specific model was provided, pick the loaded model from LM Studio if available
    if (!detectedModel) {
      if (availableModels.length > 0) {
        detectedModel = availableModels[0];
      } else {
        detectedModel = 'local-model';
      }
    }

    // 2. Test chat completion endpoint
    const chatEndpoint = `${baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout for local models

    const res = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: detectedModel,
        messages: [
          {
            role: 'system',
            content: 'Ты — опытный Dungeon Master в D&D 5e. Твой ответ должен быть СТРОГО на русском языке.',
          },
          {
            role: 'user',
            content: testPrompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      let parsedMessage = errText;
      try {
        const json = JSON.parse(errText);
        parsedMessage = json.error?.message || json.message || errText;
      } catch {}

      return NextResponse.json({
        success: false,
        status: res.status,
        latencyMs,
        error: `LM Studio вернул ошибку (${res.status}): ${parsedMessage}`,
        modelUsed: detectedModel,
        availableModels,
      });
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    let textResult = (choice?.message?.content || '').trim();
    const reasoningText = (choice?.message?.reasoning_content || choice?.message?.reasoning || '').trim();

    // If main content is empty but model produced reasoning (thinking model)
    if (!textResult && reasoningText) {
      textResult = reasoningText;
    } else if (!textResult && choice?.text) {
      textResult = (choice.text || '').trim();
    }

    if (!textResult) {
      return NextResponse.json({
        success: false,
        status: 200,
        latencyMs,
        error: 'LM Studio успешно ответил, но текст ответа пуст. Убедитесь, что модель в LM Studio загружена в память.',
        modelUsed: detectedModel,
        availableModels,
      });
    }

    return NextResponse.json({
      success: true,
      status: 200,
      latencyMs,
      response: textResult,
      modelUsed: detectedModel,
      availableModels,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
    const isRefused = err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed');

    let userMessage = `Ошибка подключения: ${err.message || 'Не удалось связаться с LM Studio'}`;
    if (isRefused) {
      userMessage = `Не удалось подключиться к серверу LM Studio по указанному адресу. Убедитесь, что приложение LM Studio открыто, в разделе 'Developer' / 'Local Server' включен локальный сервер (порт 1234) и загружена модель.`;
    } else if (isTimeout) {
      userMessage = `Таймаут подключения к LM Studio (120 сек). Модель не успела завершить генерацию вовремя. Убедитесь, что видеокарта/процессор не перегружены.`;
    }

    return NextResponse.json({
      success: false,
      status: 500,
      latencyMs,
      error: userMessage,
      modelUsed: 'local-model',
      availableModels: [],
    });
  }
}
