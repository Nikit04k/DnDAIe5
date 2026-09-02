import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      apiKey: userApiKey = '',
      model: userModel = 'gemini-3.6-flash',
      testPrompt = 'Ответь кратко (1-2 предложения) на русском языке: "Связь с Gemini API (Free Tier 3.6-Flash) успешно установлена!" и приветствуй игрока.',
    } = body;

    const apiKey = (userApiKey && userApiKey.trim().length > 0 ? userApiKey.trim() : '') || process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        status: 401,
        latencyMs: 0,
        error: 'API-ключ Gemini не введён. Получите бесплатный ключ в Google AI Studio (aistudio.google.com) и вставьте в поле выше.',
        modelUsed: userModel,
      });
    }

    const requestedModel = userModel.replace(/^models\//, '');
    const geminiModelsToTry = Array.from(
      new Set([
        requestedModel,
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        'google/gemini-3.7-flash',
        'google/gemini-3.6-flash',
        'google/gemini-2.5-flash',
      ])
    );

    let textResult = '';
    let usedModel = requestedModel;
    let lastError = '';
    let responseStatus = 200;

    for (const curModel of geminiModelsToTry) {
      // 1. Try OpenAI compatibility endpoint
      try {
        const openaiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(openaiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: curModel,
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
            max_tokens: 600,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        responseStatus = res.status;

        if (res.ok) {
          const data = await res.json();
          const msg = data.choices?.[0]?.message;
          const txt = msg?.content || msg?.reasoning || '';
          if (txt && txt.trim().length > 0) {
            textResult = txt.trim();
            usedModel = curModel;
            break;
          }
        } else {
          const errBody = await res.text();
          let parsedMsg = errBody;
          try {
            const parsed = JSON.parse(errBody);
            parsedMsg = parsed.error?.message || errBody;
          } catch {}
          lastError = `[${curModel}] ${parsedMsg}`;
        }
      } catch (err: any) {
        lastError = err?.message || 'Ошибка сети';
      }

      // 2. Try Native REST API endpoint as fallback for this model
      try {
        const nativeEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(nativeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `[Инструкция: Отвечай строго на русском языке]\n\n${testPrompt}` }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 300,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        responseStatus = res.status;

        if (res.ok) {
          const data = await res.json();
          const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (txt && txt.trim().length > 0) {
            textResult = txt.trim();
            usedModel = curModel;
            break;
          }
        } else {
          const errBody = await res.text();
          let parsedMsg = errBody;
          try {
            const parsed = JSON.parse(errBody);
            parsedMsg = parsed.error?.message || errBody;
          } catch {}
          lastError = `[${curModel}] ${parsedMsg}`;
        }
      } catch (err: any) {
        lastError = err?.message || 'Ошибка сети';
      }
    }

    const latencyMs = Date.now() - startTime;

    if (!textResult) {
      let userFriendly = `Ошибка Gemini API (${responseStatus}): ${lastError}`;
      if (responseStatus === 400 || responseStatus === 403 || responseStatus === 401) {
        userFriendly = `Ошибка ключа или доступа (${responseStatus}): ${lastError || 'Проверьте ваш API-ключ в Google AI Studio.'}`;
      } else if (responseStatus === 429) {
        userFriendly = `Достигнут лимит запросов Gemini Free Tier (429 Rate Limit). Подождите немного (лимит 15 запросов в минуту).`;
      }

      return NextResponse.json({
        success: false,
        status: responseStatus,
        latencyMs,
        error: userFriendly,
        modelUsed: usedModel,
      });
    }

    return NextResponse.json({
      success: true,
      status: 200,
      latencyMs,
      response: textResult,
      modelUsed: usedModel,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');

    return NextResponse.json({
      success: false,
      status: 500,
      latencyMs,
      error: isTimeout
        ? 'Таймаут подключения к Gemini API (12 сек). Проверьте интернет-соединение.'
        : `Ошибка сети: ${err?.message || 'Не удалось связаться с Gemini API'}`,
      modelUsed: 'gemini-2.5-flash',
    });
  }
}
