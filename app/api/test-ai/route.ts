import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      apiKey: userApiKey = '',
      model = 'nvidia/nemotron-3-super-120b-a12b:free',
      baseUrl = '',
      testPrompt = 'Ответь кратко (1-2 предложения) на русском языке: "Связь с Мастером Подземелий установлена!" и дай короткое напутствие игроку.',
    }: {
      apiKey?: string;
      model?: string;
      baseUrl?: string;
      testPrompt?: string;
    } = body;

    const apiKey = (userApiKey && userApiKey.trim().length > 0 ? userApiKey.trim() : '') || process.env.OPENROUTER_API_KEY || '';

    // If no API key provided and no custom Base URL, test OpenRouter connection
    let resolvedBaseUrl = (baseUrl && baseUrl.trim().length > 0 ? baseUrl.trim() : '').replace(/\/+$/, '');
    if (!resolvedBaseUrl) {
      resolvedBaseUrl = 'https://openrouter.ai/api/v1';
    }

    if (!apiKey && !baseUrl) {
      return NextResponse.json({
        success: false,
        status: 401,
        latencyMs: 0,
        error: 'API-ключ не введен. Вставьте ваш ключ OpenRouter (sk-or-v1-...) в поле выше. Создать бесплатный ключ можно на openrouter.ai/keys',
        modelUsed: model,
      });
    }

    const endpointUrl = `${resolvedBaseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey || 'anonymous'}`,
      'HTTP-Referer': 'https://dndaie5.app',
      'X-Title': 'DnDAIe5 Connection Test',
    };

    const payload = {
      model: model || 'nvidia/nemotron-3-super-120b-a12b:free',
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
      max_tokens: 300,
      temperature: 0.7,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text();
      let parsedError = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        parsedError = jsonErr.error?.message || jsonErr.message || errorText;
      } catch {}

      let userFriendlyMessage = `Ошибка сервера API (${res.status}): ${parsedError}`;
      if (res.status === 401) {
        userFriendlyMessage = `Неверный или недействительный API Ключ (401 Unauthorized). Проверьте ключ OpenRouter на https://openrouter.ai/keys.`;
      } else if (res.status === 403) {
        userFriendlyMessage = `Доступ ограничен (403 Forbidden). Проверьте настройки ключа или баланс.`;
      } else if (res.status === 404) {
        userFriendlyMessage = `Модель "${model}" временно недоступна или не найдена на сервере провайдера (404). Выберите другую модель из списка.`;
      } else if (res.status === 429) {
        userFriendlyMessage = `Превышен лимит бесплатных запросов (429 Rate Limit). Подождите несколько секунд или выберите другую модель из списка (:free).`;
      }

      return NextResponse.json({
        success: false,
        status: res.status,
        latencyMs,
        error: userFriendlyMessage,
        modelUsed: model,
      });
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || '';

    // Strip thinking tags if present
    text = text.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '').trim();

    if (!text) {
      // If content is empty but reasoning is present
      const reasoning = data.choices?.[0]?.message?.reasoning;
      if (reasoning) {
        text = reasoning;
      } else {
        return NextResponse.json({
          success: false,
          status: 200,
          latencyMs,
          error: 'Модель успешно ответила, но тело ответа оказалось пустым.',
          modelUsed: model,
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: 200,
      latencyMs,
      response: text,
      modelUsed: data.model || model,
      usage: data.usage || null,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted');

    return NextResponse.json({
      success: false,
      status: 500,
      latencyMs,
      error: isTimeout
        ? 'Таймаут подключения (18 сек): нейросеть не ответила вовремя. Попробуйте другую бесплатную модель из списка.'
        : `Ошибка сети: ${err?.message || 'Не удалось связаться с сервером нейросети'}`,
      modelUsed: 'unknown',
    });
  }
}
