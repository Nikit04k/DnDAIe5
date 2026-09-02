import { CharacterSheet, WorldSettings, ChatMessage, DmResponse, PartyCompanion, LorebookEntry } from '@/types/dnd';
import { parseAndAdvanceTime } from '@/lib/timeUtils';

export interface DirectDmRequest {
  world: WorldSettings;
  character: CharacterSheet;
  partyPlayers?: Array<{ id: string; name: string; character: CharacterSheet }>;
  history: ChatMessage[];
  action: string;
  partyCompanions?: PartyCompanion[];
  journalEntries?: any[];
  lorebookEntries?: LorebookEntry[];
  storySummary?: string;
  inGameDay?: number;
  inGameMinutes?: number;
  inGameTime?: string;
  apiKey?: string;
  modelName?: string;
  baseUrl?: string;
  customPrompt?: string;
  useOpenRouter?: boolean;
  useGemini?: boolean;
  geminiApiKey?: string;
  geminiModel?: string;
}

function enrichStateUpdateFromNarrative(
  parsed: DmResponse,
  rawNarrative: string,
  currentCharacter?: CharacterSheet,
  actionText: string = '',
  currentDay: number = 1,
  currentMinutes: number = 480
): DmResponse {
  if (!parsed.state_update) {
    parsed.state_update = {
      hp_change: 0,
      gold_change: 0,
      added_items: [],
      removed_items: [],
      location_name: '',
      time_passed_minutes: 15,
    };
  }

  const text = rawNarrative || parsed.narrative || '';
  if (!text) return parsed;

  // 1. Extract location name from [Хроника мира]
  if (!parsed.state_update.location_name || parsed.state_update.location_name.includes('Текущая') || parsed.state_update.location_name.includes('Неизведанная')) {
    const locMatch = text.match(/(?:📍\s*\*{0,2}Локация:?\*{0,2}|Локация:)\s*([^\n|]+)/i);
    if (locMatch && locMatch[1]) {
      const cleanLoc = locMatch[1].replace(/\*\*/g, '').replace(/\|.*/, '').trim();
      if (cleanLoc.length > 1) {
        parsed.state_update.location_name = cleanLoc;
      }
    }
  }

  // 2. Extract HP changes
  if (!parsed.state_update.hp_change || parsed.state_update.hp_change === 0) {
    const damageMatch = text.match(/(?:получа(?:ете|ет)|нанос(?:ит|ят)(?:\s+вам)?|тер(?:яете|яет)|получив)\s*(\d+)\s*(?:ед(?:\.|иниц)?\s*)?(?:урон(?:а)?|хп|hp)/i)
      || text.match(/-\s*(\d+)\s*(?:хп|hp|ед\.?\s*урона|урона)/i)
      || text.match(/урон(?:а)?:?\s*(\d+)/i);

    if (damageMatch && damageMatch[1]) {
      const dmg = parseInt(damageMatch[1], 10);
      if (!isNaN(dmg) && dmg > 0 && dmg <= 150) {
        parsed.state_update.hp_change = -dmg;
      }
    } else {
      const healMatch = text.match(/(?:исцеля(?:ете|ет)|восстанавл(?:иваете|ивает)|восстановлен(?:о)?|леч(?:итесь|ит|ит вас на))\s*(\d+)\s*(?:хп|hp|очк(?:ов|а)|зд)/i)
        || text.match(/\+\s*(\d+)\s*(?:хп|hp)/i);

      if (healMatch && healMatch[1]) {
        const heal = parseInt(healMatch[1], 10);
        if (!isNaN(heal) && heal > 0 && heal <= 150) {
          parsed.state_update.hp_change = heal;
        }
      }
    }
  }

  // 3. Extract Gold changes
  if (!parsed.state_update.gold_change || parsed.state_update.gold_change === 0) {
    const goldGainMatch = text.match(/(?:наход(?:ите|ит)|получа(?:ете|ет)|зарабатыва(?:ете|ет)|наград(?:а)?:?)\s*(\d+)\s*(?:золот(?:ых|а|о)|gp|монет)/i)
      || text.match(/\+\s*(\d+)\s*(?:gp|золот)/i);

    if (goldGainMatch && goldGainMatch[1]) {
      const g = parseInt(goldGainMatch[1], 10);
      if (!isNaN(g) && g > 0) {
        parsed.state_update.gold_change = g;
      }
    } else {
      const goldSpendMatch = text.match(/(?:плат(?:ите|ит)|потрат(?:или|ил)|отда(?:ете|ет)|стоимост(?:ь)?:?)\s*(\d+)\s*(?:золот(?:ых|а|о)|gp|монет)/i)
        || text.match(/-\s*(\d+)\s*(?:gp|золот)/i);

      if (goldSpendMatch && goldSpendMatch[1]) {
        const g = parseInt(goldSpendMatch[1], 10);
        if (!isNaN(g) && g > 0) {
          parsed.state_update.gold_change = -g;
        }
      }
    }
  }

  // 4. Extract Items
  if (!parsed.state_update.added_items) {
    parsed.state_update.added_items = [];
  }

  const itemGainRegex = /(?:наход(?:ите|ит)|получа(?:ете|ет)|вруча(?:ет|ют)(?:\s+вам)?|подбира(?:ете|ет)|в сундуке(?: лежит)?|награда:)\s*(?:новый предмет:?|предмет:?|трофей:?)?\s*([«"“][^»"”\n]+[»"”]|\[[^\]\n]+\]|\b(?:Зелье|Свиток|Меч|Кинжал|Ключ|Амулет|Кольцо|Доспех|Щит|Артефакт|Книга|Камень|Посох|Лук|Топор|Молот|Шлем|Плащ|Браслет|Фляга|Карта|Кристалл|Эликсир|Фонарь|Оберег)\s+[А-Яа-яЁёA-Za-z0-9\s()+-]+)/gi;

  let itemMatch;
  while ((itemMatch = itemGainRegex.exec(text)) !== null) {
    if (itemMatch[1]) {
      const rawItem = itemMatch[1].replace(/[«»"“\[\]]/g, '').trim();
      if (rawItem.length > 2 && rawItem.length < 60 && !rawItem.toLowerCase().includes('урон') && !rawItem.toLowerCase().includes('золот')) {
        if (!parsed.state_update.added_items.includes(rawItem)) {
          if (!currentCharacter?.inventory?.includes(rawItem)) {
            parsed.state_update.added_items.push(rawItem);
          }
        }
      }
    }
  }

  // 5. Deduct consumables from inventory if action was drinking/using
  if (!parsed.state_update.removed_items) {
    parsed.state_update.removed_items = [];
  }

  const actionLower = actionText.toLowerCase();
  if (currentCharacter?.inventory && currentCharacter.inventory.length > 0) {
    for (const item of currentCharacter.inventory) {
      const itemLower = item.toLowerCase();
      if (
        (actionLower.includes('пью ') || actionLower.includes('выпиваю ') || actionLower.includes('использую ') || actionLower.includes('применяю ')) &&
        actionLower.includes(itemLower) &&
        (itemLower.includes('зелье') || itemLower.includes('эликсир') || itemLower.includes('свиток') || itemLower.includes('рацион') || itemLower.includes('факел'))
      ) {
        if (!parsed.state_update.removed_items.includes(item)) {
          parsed.state_update.removed_items.push(item);
        }
      }
    }
  }

  // 6. Time passed calculation
  const timeAdvance = parseAndAdvanceTime(currentDay, currentMinutes, actionText, text);
  parsed.state_update.time_passed_minutes = timeAdvance.timePassedMinutes;
  parsed.state_update.new_day = timeAdvance.nextDay;
  parsed.state_update.new_time = timeAdvance.formatted;

  return parsed;
}

function extractThinkingAndJson(
  rawText: string,
  rawReasoning: string,
  currentCharacter?: CharacterSheet,
  actionText: string = '',
  currentDay: number = 1,
  currentMinutes: number = 480
): DmResponse {
  let narrative = rawText;
  let thinking = rawReasoning || '';

  const thinkMatch = narrative.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thinking = (thinking ? thinking + '\n\n' : '') + thinkMatch[1].trim();
    narrative = narrative.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  // JSON Extraction
  let jsonString = '';
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i;
  const match = narrative.match(jsonBlockRegex);

  if (match) {
    jsonString = match[1];
    narrative = narrative.replace(jsonBlockRegex, '').trim();
  } else {
    const firstBrace = narrative.lastIndexOf('{');
    const lastBrace = narrative.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = narrative.slice(firstBrace, lastBrace + 1);
      if (candidate.includes('narrative') || candidate.includes('suggested_actions') || candidate.includes('state_update')) {
        jsonString = candidate;
        narrative = narrative.slice(0, firstBrace).trim();
      }
    }
  }

  let parsed: any = null;
  if (jsonString) {
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      try {
        const cleaned = jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = null;
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    if (parsed.thinking && !thinking) {
      thinking = parsed.thinking;
    }

    const finalNarrative = (parsed.narrative && parsed.narrative.trim().length > 0)
      ? parsed.narrative.trim()
      : (narrative && narrative.trim().length > 0 ? narrative.trim() : 'Мастер наблюдает за вашими действиями...');

    const baseResult: DmResponse = {
      narrative: finalNarrative,
      thought: thinking || undefined,
      suggested_actions: Array.isArray(parsed.suggested_actions) && parsed.suggested_actions.length > 0
        ? parsed.suggested_actions.slice(0, 4)
        : [
          'Осмотреться по сторонам и изучить окружение',
          'Осторожно продвигаться вперед',
          'Подготовить оружие и занять защитную стойку',
          'Попытаться заговорить или вступить в диалог',
        ],
      requires_roll: parsed.requires_roll || undefined,
      state_update: parsed.state_update || {
        hp_change: 0,
        gold_change: 0,
        added_items: [],
        removed_items: [],
        location_name: '',
        time_passed_minutes: 15,
      },
    };

    return enrichStateUpdateFromNarrative(
      baseResult,
      finalNarrative,
      currentCharacter,
      actionText,
      currentDay,
      currentMinutes
    );
  }

  const fallbackResult: DmResponse = {
    narrative: narrative || 'Мастер описывает происходящее вокруг...',
    thought: thinking || undefined,
    requires_roll: { needed: false },
    suggested_actions: [
      'Осмотреться по сторонам',
      'Осторожно исследовать локацию',
      'Проверить экипировку',
      'Двигаться дальше по тропе',
    ],
    state_update: {
      hp_change: 0,
      gold_change: 0,
      added_items: [],
      removed_items: [],
      location_name: '',
      time_passed_minutes: 15,
    },
  };

  return enrichStateUpdateFromNarrative(
    fallbackResult,
    narrative,
    currentCharacter,
    actionText,
    currentDay,
    currentMinutes
  );
}

export async function executeDirectDmTurn(request: DirectDmRequest): Promise<DmResponse & { providerUsed?: string }> {
  const {
    world,
    character,
    partyPlayers = [],
    history = [],
    action,
    partyCompanions = [],
    journalEntries = [],
    lorebookEntries = [],
    storySummary = '',
    inGameDay = 1,
    inGameMinutes = 480,
    inGameTime = '',
    apiKey: userApiKey,
    modelName: userModelName,
    baseUrl: userBaseUrl,
    customPrompt: userCustomPrompt,
    useOpenRouter = true,
    useGemini = false,
    geminiApiKey: userGeminiApiKey,
    geminiModel: userGeminiModel,
  } = request;

  const currentDay = inGameDay || 1;
  const currentMinutes = inGameMinutes !== undefined ? inGameMinutes : 480;
  const clockHours = Math.floor((currentMinutes % 1440) / 60);
  const clockMins = Math.floor(currentMinutes % 60);
  const hh = String(clockHours).padStart(2, '0');
  const mm = String(clockMins).padStart(2, '0');
  const formattedClock = inGameTime || `День ${currentDay} • ${hh}:${mm}`;

  const geminiApiKey = (userGeminiApiKey && userGeminiApiKey.trim().length > 0 ? userGeminiApiKey.trim() : '');
  const isGeminiActive = Boolean(useGemini && geminiApiKey);
  const geminiModel = (userGeminiModel && userGeminiModel.trim().length > 0 ? userGeminiModel.trim().replace(/^models\//, '') : 'gemini-3.7-flash');

  const openRouterApiKey = (userApiKey && userApiKey.trim().length > 0 ? userApiKey.trim() : '');
  const isOpenRouterActive = Boolean(useOpenRouter !== false);

  const inventoryList = character.inventory && character.inventory.length > 0
    ? character.inventory.join(', ')
    : 'Пусто (только базовые лохмотья)';

  const systemInstruction = `Ты — элитный Dungeon Master D&D 5-й редакции.
Ведешь атмосферное, захватывающее и честное приключение на русском языке.

ПРАВИЛО ИНВЕНТАРЯ (ЖЕСТКИЙ АНТИЧИТ):
Инвентарь персонажа (${character.name}): [${inventoryList}].
Золото: ${character.gold} gp.
Игрок НЕ МОЖЕТ использовать или доставать предметы, которых нет в этом списке.

МИР И СЕТТИНГ:
- Сеттинг: ${world.customSetting || 'Классическое темное фэнтези Забытых Королевств'}
- Тон: ${world.customTone || 'Героический, с элементами опасности и тайн'}
- Время в игре: ${formattedClock}
${userCustomPrompt ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ:\n${userCustomPrompt}` : ''}

ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В ВИДЕ ПОНЯТНОГО РАССКАЗА С БЛОКОМ JSON В КОНЦЕ:
\`\`\`json
{
  "narrative": "художественный текст повествования...",
  "suggested_actions": ["действие 1", "действие 2", "действие 3", "действие 4"],
  "state_update": {
    "hp_change": 0,
    "gold_change": 0,
    "added_items": [],
    "removed_items": [],
    "location_name": "Название локации"
  }
}
\`\`\``;

  const messagesPayload: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemInstruction },
  ];

  if (history && history.length > 0) {
    const recent = history.slice(-8);
    for (const msg of recent) {
      messagesPayload.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text,
      });
    }
  }

  messagesPayload.push({
    role: 'user',
    content: action,
  });

  let successfulContent = '';
  let successfulReasoning = '';
  let providerUsed = '';

  // 1. Try Google Gemini API if enabled
  if (isGeminiActive && geminiApiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
      const geminiBody = {
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          ...messagesPayload.filter((m) => m.role !== 'system').map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        ],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 3000,
        },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.map((p: any) => p.text || '').join('') || '';
        if (text && text.trim().length > 0) {
          successfulContent = text;
          providerUsed = 'gemini';
        }
      }
    } catch (e) {
      console.warn('[DirectAiClient] Gemini call error:', e);
    }
  }

  // 2. Try OpenRouter API / Fallback Cloud models if enabled
  if (!successfulContent && isOpenRouterActive) {
    const candidateModels = [
      userModelName || 'nvidia/nemotron-3-super-120b-a12b:free',
      'eva-unit-01/eva-qwen-2.5-72b:free',
      'minimax/minimax-01:free',
      'google/gemma-2-9b-it:free',
    ];

    const baseUrl = userBaseUrl && userBaseUrl.trim().length > 0
      ? userBaseUrl.trim().replace(/\/+$/, '')
      : (openRouterApiKey ? 'https://openrouter.ai/api/v1' : 'https://text.pollinations.ai/openai');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (openRouterApiKey) {
      headers['Authorization'] = `Bearer ${openRouterApiKey}`;
      headers['HTTP-Referer'] = 'https://dndaie5.app';
      headers['X-Title'] = 'DnDAIe5 Mobile';
    }

    for (const model of candidateModels) {
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: messagesPayload,
            temperature: 0.75,
            max_tokens: 3000,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const choice = data.choices?.[0];
          const raw = choice?.message?.content || '';
          const reasoning = choice?.message?.reasoning || choice?.reasoning || '';
          if (raw && raw.trim().length > 0) {
            successfulContent = raw;
            successfulReasoning = reasoning;
            providerUsed = 'openrouter';
            break;
          }
        }
      } catch (e) {
        console.warn(`[DirectAiClient] Fetch error for ${model}:`, e);
      }
    }
  }

  if (!successfulContent) {
    throw new Error('Не удалось получить ответ от ИИ. Проверьте интернет-соединение или укажите бесплатный ключ Google Gemini / OpenRouter в Настройках.');
  }

  const parsed = extractThinkingAndJson(
    successfulContent,
    successfulReasoning,
    character,
    action,
    currentDay,
    currentMinutes
  );

  return {
    ...parsed,
    providerUsed,
  };
}
