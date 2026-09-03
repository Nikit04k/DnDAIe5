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
  useLmStudio?: boolean;
  lmStudioUrl?: string;
  lmStudioModel?: string;
  lmStudioApiKey?: string;
}

export function isStandaloneMobile(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_EXPORT === 'true') return true;
  if (Boolean((window as any).Capacitor)) return true;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return false;
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

  // 4. Extract Items from player take actions, text narrative & chronicle status block
  if (!parsed.state_update.added_items) {
    parsed.state_update.added_items = [];
  }

  // 4a. Check if player expressed intent to take/pick up items in actionText (e.g. "я беру кинжал", "я взял зелье", "забираю свиток", "подбираю амулет")
  const actionLower = actionText.toLowerCase();
  const isTakeAction = /(?:я\s+)?(?:беру|взял|взяла|забираю|заберу|забрал|забрала|подбираю|подобрал|подобрала|хватаю|покупаю|купил|купила|согласен\s+взять|согласна\s+взять|соглашаюсь\s+взять|кладу\s+в\s+рюкзак|прячу\s+в\s+сумку)/i.test(actionLower);

  if (isTakeAction) {
    const takeMatch = actionText.match(/(?:я\s+)?(?:беру|взял|взяла|забираю|заберу|забрал|забрала|подбираю|подобрал|подобрала|хватаю|покупаю|купил|купила|согласен\s+взять|согласна\s+взять|соглашаюсь\s+взять|кладу\s+в\s+рюкзак|прячу\s+в\s+сумку)\s+(?:себе\s+)?([^.!?\n]+)/i);
    if (takeMatch && takeMatch[1]) {
      const candidateString = takeMatch[1]
        .replace(/^(?:этот|эти|тот|ту|эту|все|всё|их)\s+/i, '')
        .replace(/\s+(?:и\s+кладу.*|и\s+прячу.*|в\s+рюкзак.*|в\s+сумку.*)$/i, '')
        .trim();

      const candidateItems = candidateString
        .split(/(?:,|\s+и\s+)/i)
        .map((s) => s.trim().replace(/[«»"“\[\]]/g, ''))
        .filter((s) => s.length > 2 && s.length < 50);

      for (const rawCandidate of candidateItems) {
        const cleanCandidate = rawCandidate.replace(/^(?:свой|свои|этот|эту|тот|такой|себе)\s+/i, '').trim();
        if (
          cleanCandidate.length > 2 &&
          !cleanCandidate.toLowerCase().includes('урон') &&
          !cleanCandidate.toLowerCase().includes('бросок') &&
          !cleanCandidate.toLowerCase().includes('золот')
        ) {
          const capitalized = cleanCandidate.charAt(0).toUpperCase() + cleanCandidate.slice(1);
          if (!parsed.state_update.added_items.some((it) => it.toLowerCase() === capitalized.toLowerCase())) {
            if (
              !currentCharacter?.inventory?.some((it) => it.toLowerCase() === capitalized.toLowerCase()) &&
              !currentCharacter?.equippedItems?.some((it) => it.toLowerCase() === capitalized.toLowerCase())
            ) {
              const isRefusal = /не\s+(?:удалось|получилось|можете|смог|смогла|хватает|нашел|нашли|нет)/i.test(text);
              if (!isRefusal) {
                parsed.state_update.added_items.push(capitalized);
              }
            }
          }
        }
      }
    }
  }

  // 4b. Extract Items from narrative text
  const itemGainRegex = /(?:наход(?:ите|ит|ят)|получа(?:ете|ет|ют)|вруча(?:ет|ют|ется)(?:\s+вам)?|подбира(?:ете|ет|ют)|подобрал(?:и)?|берет(?:е)?|бер[её]те|взял(?:и)?|забира(?:ете|ет|ют)|забрал(?:и)?|кладет(?:е)?\s+в\s+(?:рюкзак|сумку)|пряч(?:ете|ет)\s+в\s+(?:сумку|карман)|в сундуке(?: лежит)?|награда:)\s*(?:новый предмет:?|предмет:?|трофей:?|себе\s+)?\s*([«"“][^»"”\n]+[»"”]|\[[^\]\n]+\]|\b(?:Зелье|Эликсир|Снадобье|Свиток|Меч|Кинжал|Клинок|Шпага|Рапира|Сабля|Топор|Секира|Молот|Булава|Посох|Жезл|Лук|Арбалет|Щит|Доспех|Кольчуга|Панцирь|Шлем|Плащ|Мантия|Сапоги|Перчатки|Кольцо|Амулет|Оберег|Талисман|Медальон|Ожерелье|Браслет|Ключ|Карта|Книга|Гримуар|Фолиант|Камень|Кристалл|Самоцвет|Рубин|Алмаз|Изумруд|Сапфир|Фляга|Бутыль|Факел|Фонарь|Огниво|Веревка|Отмычки|Кошель|Сухпаек|Рацион)\s+[А-Яа-яЁёA-Za-z0-9\s()+-]+)/gi;

  let itemMatch;
  while ((itemMatch = itemGainRegex.exec(text)) !== null) {
    if (itemMatch[1]) {
      const rawItem = itemMatch[1].replace(/[«»"“\[\]]/g, '').trim();
      if (rawItem.length > 2 && rawItem.length < 60 && !rawItem.toLowerCase().includes('урон') && !rawItem.toLowerCase().includes('золот')) {
        if (!parsed.state_update.added_items.some((it) => it.toLowerCase() === rawItem.toLowerCase())) {
          if (
            !currentCharacter?.inventory?.some((it) => it.toLowerCase() === rawItem.toLowerCase()) &&
            !currentCharacter?.equippedItems?.some((it) => it.toLowerCase() === rawItem.toLowerCase())
          ) {
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
    useLmStudio = false,
    lmStudioUrl: userLmStudioUrl,
    lmStudioModel: userLmStudioModel,
    lmStudioApiKey: userLmStudioApiKey,
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

ПРАВИЛО ИНВЕНТАРЯ И АВТОМАТИЧЕСКОЕ ДОБАВЛЕНИЕ ПРЕДМЕТОВ:
1. Инвентарь персонажа (${character.name}): [${inventoryList}].
2. Золото: ${character.gold} gp.
3. Игрок НЕ МОЖЕТ использовать или доставать предметы, которых нет в этом списке.
4. Игрок не может добавлять предметы вручную. Новые предметы в инвентарь добавляешь ТОЛЬКО ТЫ через "added_items" в state_update!
5. Когда в сюжете найдены предметы/лут/награда или игрок пишет «я беру...», «я взял...», «забираю...», «подбираю...», «покупаю...» — обязательно добавь эти предметы в "added_items": ["Название предмета"] в state_update! При покупке спиши золото через "gold_change": -X. При расходе укажи предмет в "removed_items".

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

  // 1. Try LM Studio if enabled
  if (useLmStudio && userLmStudioUrl) {
    try {
      const lmBase = userLmStudioUrl.replace(/\/+$/, '');
      const lmHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userLmStudioApiKey) lmHeaders['Authorization'] = `Bearer ${userLmStudioApiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const lmRes = await fetch(`${lmBase}/v1/chat/completions`, {
        method: 'POST',
        headers: lmHeaders,
        body: JSON.stringify({
          model: userLmStudioModel || 'local-model',
          messages: messagesPayload,
          temperature: 0.75,
          max_tokens: 3000,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (lmRes.ok) {
        const lmData = await lmRes.json();
        const choice = lmData.choices?.[0];
        const raw = choice?.message?.content || '';
        const reasoning = choice?.message?.reasoning || choice?.reasoning || '';
        if (raw && raw.trim().length > 0) {
          successfulContent = raw;
          successfulReasoning = reasoning;
          providerUsed = 'lmstudio';
        }
      }
    } catch (e) {
      console.warn('[DirectAiClient] LM Studio call error:', e);
    }
  }

  // 2. Try Google Gemini API if enabled
  if (!successfulContent && isGeminiActive && geminiApiKey) {
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

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

  // 3. Try OpenRouter API / Fallback Cloud models if enabled
  if (!successfulContent && isOpenRouterActive) {
    const candidateModels = Array.from(
      new Set([
        userModelName || 'nvidia/nemotron-3-super-120b-a12b:free',
        'nvidia/nemotron-3.5-lightning:free',
        'poolside/laguna-s-2.1:free',
        'minimax/minimax-m2.7:free',
        'liquid/lfm-2.5-2.6b:free',
      ])
    );

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: messagesPayload,
            temperature: 0.75,
            max_tokens: 3000,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

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

export async function testDirectAiConnection(options: {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  testPrompt?: string;
}): Promise<{
  success: boolean;
  status: number;
  latencyMs: number;
  response?: string;
  error?: string;
  modelUsed?: string;
  usage?: any;
}> {
  const startTime = Date.now();
  const {
    apiKey: userApiKey = '',
    model = 'nvidia/nemotron-3-super-120b-a12b:free',
    baseUrl = '',
    testPrompt = 'Ответь кратко (1-2 предложения) на русском языке: "Связь с Мастером Подземелий установлена!" и дай короткое напутствие игроку.',
  } = options;

  const apiKey = (userApiKey && userApiKey.trim().length > 0 ? userApiKey.trim() : '');
  let resolvedBaseUrl = (baseUrl && baseUrl.trim().length > 0 ? baseUrl.trim() : '').replace(/\/+$/, '');
  if (!resolvedBaseUrl) {
    resolvedBaseUrl = 'https://openrouter.ai/api/v1';
  }

  // If testing OpenRouter without key and without custom URL
  if (!apiKey && resolvedBaseUrl.includes('openrouter.ai')) {
    return {
      success: false,
      status: 401,
      latencyMs: 0,
      error: 'API-ключ OpenRouter не введен. Вставьте ваш ключ (sk-or-v1-...) в поле выше. Создать бесплатный ключ можно на openrouter.ai/keys (для моделей :free баланс пополнять не нужно).',
      modelUsed: model,
    };
  }

  const endpointUrl = `${resolvedBaseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['HTTP-Referer'] = 'https://dndaie5.app';
    headers['X-Title'] = 'DnDAIe5 Mobile Test';
  }

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
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let parsedError = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        parsedError = jsonErr.error?.message || jsonErr.message || errorText;
      } catch {}

      let userFriendlyMessage = `Ошибка сервера API (${res.status}): ${parsedError}`;
      if (res.status === 401) {
        userFriendlyMessage = `Неверный или недействительный API Ключ (401 Unauthorized). Проверьте ключ OpenRouter на https://openrouter.ai/keys.`;
      } else if (res.status === 403) {
        userFriendlyMessage = `Доступ ограничен (403 Forbidden). Проверьте настройки ключа на openrouter.ai.`;
      } else if (res.status === 404) {
        userFriendlyMessage = `Модель "${model}" временно недоступна на OpenRouter (404). Выберите другую модель (:free) из списка.`;
      } else if (res.status === 429) {
        userFriendlyMessage = `Превышен лимит запросов к бесплатной модели (429 Rate Limit). Подождите несколько секунд или выберите другую модель (:free).`;
      }

      return {
        success: false,
        status: res.status,
        latencyMs,
        error: userFriendlyMessage,
        modelUsed: model,
      };
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || '';
    text = text.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '').trim();

    if (!text) {
      const reasoning = data.choices?.[0]?.message?.reasoning;
      if (reasoning) {
        text = reasoning;
      } else {
        return {
          success: false,
          status: 200,
          latencyMs,
          error: 'Модель успешно ответила, но тело ответа пустое.',
          modelUsed: model,
        };
      }
    }

    return {
      success: true,
      status: 200,
      latencyMs,
      response: text,
      modelUsed: data.model || model,
      usage: data.usage || null,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted');

    return {
      success: false,
      status: 500,
      latencyMs,
      error: isTimeout
        ? 'Таймаут подключения (20 сек): сервер нейросети не ответил вовремя. Проверьте интернет или выберите другую модель.'
        : `Ошибка сети: ${err?.message || 'Не удалось связаться с сервером нейросети'}`,
      modelUsed: model,
    };
  }
}

export async function testDirectGeminiConnection(options: {
  apiKey?: string;
  model?: string;
  testPrompt?: string;
}): Promise<{
  success: boolean;
  status: number;
  latencyMs: number;
  response?: string;
  error?: string;
  modelUsed?: string;
}> {
  const startTime = Date.now();
  const {
    apiKey: userApiKey = '',
    model: userModel = 'gemini-3.6-flash',
    testPrompt = 'Ответь кратко (1-2 предложения) на русском языке: "Связь с Gemini API успешно установлена!" и приветствуй игрока.',
  } = options;

  const apiKey = userApiKey && userApiKey.trim().length > 0 ? userApiKey.trim() : '';
  if (!apiKey) {
    return {
      success: false,
      status: 401,
      latencyMs: 0,
      error: 'API-ключ Gemini не введён. Получите бесплатный ключ в Google AI Studio (aistudio.google.com) и вставьте в поле выше.',
      modelUsed: userModel,
    };
  }

  const requestedModel = userModel.replace(/^models\//, '');
  const geminiModelsToTry = Array.from(
    new Set([
      requestedModel,
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-2.5-flash',
    ])
  );

  let textResult = '';
  let usedModel = requestedModel;
  let lastError = '';
  let responseStatus = 200;

  for (const curModel of geminiModelsToTry) {
    try {
      const nativeEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
        const errBody = await res.text().catch(() => '');
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
      userFriendly = `Достигнут лимит запросов Gemini Free Tier (429 Rate Limit). Подождите минуту (лимит 15 запросов в минуту).`;
    }

    return {
      success: false,
      status: responseStatus,
      latencyMs,
      error: userFriendly,
      modelUsed: usedModel,
    };
  }

  return {
    success: true,
    status: 200,
    latencyMs,
    response: textResult,
    modelUsed: usedModel,
  };
}

export async function testDirectLmStudioConnection(options: {
  url?: string;
  model?: string;
  apiKey?: string;
  testPrompt?: string;
}): Promise<{
  success: boolean;
  status: number;
  latencyMs: number;
  response?: string;
  error?: string;
  modelUsed?: string;
  availableModels?: string[];
}> {
  const startTime = Date.now();
  const {
    url = 'http://localhost:1234',
    model = '',
    apiKey = '',
    testPrompt = 'Ответь кратко на русском: Связь с локальной нейросетью через LM Studio успешно установлена!',
  } = options;

  const baseUrl = url.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let availableModels: string[] = [];
  try {
    const modelsRes = await fetch(`${baseUrl}/v1/models`, { headers });
    if (modelsRes.ok) {
      const mData = await modelsRes.json();
      if (Array.isArray(mData?.data)) {
        availableModels = mData.data.map((m: any) => m.id).filter(Boolean);
      }
    }
  } catch {}

  const modelToUse = model || availableModels[0] || 'local-model';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelToUse,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      return {
        success: false,
        status: res.status,
        latencyMs,
        error: `LM Studio вернул ошибку (${res.status}): ${errTxt}`,
        modelUsed: modelToUse,
        availableModels,
      };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return {
      success: true,
      status: 200,
      latencyMs,
      response: text,
      modelUsed: data.model || modelToUse,
      availableModels,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      status: 500,
      latencyMs,
      error: `Не удалось связаться с LM Studio по адресу ${baseUrl}: ${err?.message || 'Сервер недоступен'}. Если играете с телефона, укажите локальный IP вашего ПК (например, http://192.168.1.150:1234).`,
      modelUsed: modelToUse,
      availableModels,
    };
  }
}
