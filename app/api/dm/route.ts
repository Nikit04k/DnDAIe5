import { NextRequest, NextResponse } from 'next/server';
import { CharacterSheet, WorldSettings, ChatMessage, DmResponse, PartyCompanion, LorebookEntry } from '@/types/dnd';
import { parseAndAdvanceTime } from '@/lib/timeUtils';

function enrichStateUpdateFromNarrative(
  parsed: DmResponse,
  rawNarrative: string,
  currentCharacter?: CharacterSheet,
  actionText: string = '',
  currentDay: number = 1,
  currentMinutes: number = 480,
  partyPlayers: Array<{ id: string; name: string; character: CharacterSheet }> = []
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

  // 1. Extract location name from 📊 [Хроника мира]
  if (!parsed.state_update.location_name || parsed.state_update.location_name.includes('Текущая') || parsed.state_update.location_name.includes('Неизведанная')) {
    const locMatch = text.match(/(?:📍\s*\*{0,2}Локация:?\*{0,2}|Локация:)\s*([^\n|]+)/i);
    if (locMatch && locMatch[1]) {
      const cleanLoc = locMatch[1].replace(/\*\*/g, '').replace(/\|.*/, '').trim();
      if (cleanLoc.length > 1) {
        parsed.state_update.location_name = cleanLoc;
      }
    }
  }

  // 2. Extract HP changes from text if hp_change is 0
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

  // 3. Extract Gold changes from text if gold_change is 0
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

  // 4. Extract Items from text & chronicle status block
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

  // Also check 🎒 **Инвентарь и золото:** in chronicle block
  const invLineMatch = text.match(/🎒\s*\*{0,2}(?:Инвентарь(?:\s*и\s*золото)?):?\*{0,2}\s*([^\n]+)/i);
  if (invLineMatch && invLineMatch[1]) {
    const itemsPart = invLineMatch[1].replace(/\d+\s*(?:gp|золот\w*)/gi, '').trim();
    const splitItems = itemsPart.split(/[,;•]/).map((s) => s.trim().replace(/^\*+|\*+$/g, '')).filter((s) => s.length > 2 && s.length < 50);

    for (const it of splitItems) {
      if (!it.toLowerCase().includes('базовое') && !it.toLowerCase().includes('ничего') && !it.toLowerCase().includes('пусто')) {
        if (!currentCharacter?.inventory?.includes(it) && !parsed.state_update.added_items.includes(it)) {
          if (it.match(/зелье|ключ|свиток|меч|амулет|кольцо|рунный|кинжал|доспех|щит|трофей|камень|кристалл/i)) {
            parsed.state_update.added_items.push(it);
          }
        }
      }
    }
  }

  // Determine acting player name from actionText (e.g. "[Игрок: Воин Торгрим]: ..." or "[Торгрим]: ...")
  let actionAuthorName = '';
  const authorMatch = actionText.match(/\[(?:Игрок: )?([^\]\n:]+)(?::|\s*\])/i);
  if (authorMatch && authorMatch[1]) {
    actionAuthorName = authorMatch[1].replace(/^(?:Воин|Маг|Плут|Жрец|Паладин|Следопыт|Варвар|Бард|Друид|Колдун|Чародей|Монах)\s+/i, '').trim();
  }

  // 5. Extract requires_roll if needed is false but action or narrative implies an attempt/skill check
  const isAlreadyRoll =
    actionText.includes('[бросок') ||
    actionText.includes('[свободный бросок') ||
    actionText.includes('[проверка') ||
    actionText.includes('🎲') ||
    actionText.includes('итог:') ||
    actionText.includes('итого:') ||
    actionText.includes('d20 =');

  if (!isAlreadyRoll && (!parsed.requires_roll || !parsed.requires_roll.needed)) {
    const combinedSearch = `${actionText}\n${text}`;

    const isSurvival = /кост[её]р|разжечь|палк(?:ой|у)\s+о\s+палк|привал|шалаш|укрыти[ея]|выживан|охот|пищ|следопыт|дич|собрать\s+ветк|ночлег\s+в\s+лесу|добыть\s+огонь|развести\s+огонь|поиск\s+воды|ориентир|попробую.*(ветк|огонь|ночлег|привал|шалаш)/i.test(combinedSearch);
    const isAttack = /(?:совершите|сделайте|бросьте|проверка)\s+(?:атаку|бросок атаки)|атакуйте|атакую|нападаю|рублю|стреляю|бью клинком|ударю/i.test(combinedSearch);
    const isPerception = /(?:внимательност|восприяти|perception|осмотр|исследован|поиск)/i.test(combinedSearch) && /(?:брос|проверк|киньте|кубик|d20|попробую|пытаюсь|хочу)/i.test(combinedSearch);
    const isInvestigation = /(?:анализ|расследовани|поиск\s+тайник|investigation|обыск|исследовать\s+руин|разгадать)/i.test(combinedSearch) && /(?:брос|проверк|киньте|d20|попробую|пытаюсь)/i.test(combinedSearch);
    const isStealth = /(?:скрытност|stealth|прокраст|подкраст|спрятат|скрадыва|красться)/i.test(combinedSearch);
    const isSleightOfHand = /(?:ловкость\s+рук|взлом|отмычк|карманн|украст|стащит|спрятать\s+в\s+рукав)/i.test(combinedSearch);
    const isAthletics = /(?:атлетик|прыж|карабкан|силов|вскарабкат|залезть|выбить\s+двер|переплыт|поднять\s+тяжест)/i.test(combinedSearch);
    const isAcrobatics = /(?:акробатик|равновеси|сальто|увернут|пролезть|кувырок)/i.test(combinedSearch);
    const isAnimalHandling = /(?:прируч|успокоить\s+звер|коня|лошад|волк|животн|оседлать)/i.test(combinedSearch);
    const isInsight = /(?:проницательност|понять\s+врет|распознать\s+ложь|мотив|намерени|раскусить)/i.test(combinedSearch);
    const isMedicine = /(?:медицин|перевязать|раны|остановить\s+кров|лечени|осмотр\s+труп|первая\s+помощь)/i.test(combinedSearch);
    const isNature = /(?:природ|растени|травы|ягод|грибы|повадки\s+звер|флор|фаун)/i.test(combinedSearch);
    const isArcana = /(?:маги[яи]|руны|заклинани|артефакт|портал|опознать\s+магию)/i.test(combinedSearch);
    const isHistory = /(?:истори[яи]|древн|легенд|королевств|герб)/i.test(combinedSearch);
    const isReligion = /(?:религи[яи]|бог[а-я]|культ|молитв|храм|нежить)/i.test(combinedSearch);
    const isPersuasion = /(?:убеждени|уговорит|договорит|торг|убедить)/i.test(combinedSearch) && /(?:брос|проверк|киньте|d20|попробую|пытаюсь)/i.test(combinedSearch);
    const isDeception = /(?:обман|солгат|притворит|соврать|блеф)/i.test(combinedSearch);
    const isIntimidation = /(?:запугиван|угроз|надавит|испугат)/i.test(combinedSearch);
    const isSavingThrow = /спасбросок/i.test(combinedSearch);

    if (isSurvival) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Survival',
        ability: 'WIS',
        dc: 12,
        reason: 'Проверка Выживания (Survival) для обустройства лагеря и разведения огня',
      };
    } else if (isAttack) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'attack_roll',
        ability: 'STR',
        dc: 14,
        reason: 'Бросок атаки по противнику',
      };
    } else if (isStealth) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Stealth',
        ability: 'DEX',
        dc: 13,
        reason: 'Проверка Скрытности (Stealth) при перемещении',
      };
    } else if (isSleightOfHand) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Sleight of Hand',
        ability: 'DEX',
        dc: 14,
        reason: 'Проверка Ловкости рук (Sleight of Hand)',
      };
    } else if (isAthletics) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Athletics',
        ability: 'STR',
        dc: 13,
        reason: 'Проверка Атлетики (Athletics) для преодоления препятствия',
      };
    } else if (isAcrobatics) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Acrobatics',
        ability: 'DEX',
        dc: 13,
        reason: 'Проверка Акробатики (Acrobatics)',
      };
    } else if (isAnimalHandling) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Animal Handling',
        ability: 'WIS',
        dc: 13,
        reason: 'Проверка Ухода за животными (Animal Handling)',
      };
    } else if (isPerception) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Perception',
        ability: 'WIS',
        dc: 13,
        reason: 'Проверка Внимательности (Perception)',
      };
    } else if (isInvestigation) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Investigation',
        ability: 'INT',
        dc: 14,
        reason: 'Поиск скрытых деталей и тайников (Investigation)',
      };
    } else if (isInsight) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Insight',
        ability: 'WIS',
        dc: 13,
        reason: 'Проверка Проницательности (Insight)',
      };
    } else if (isMedicine) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Medicine',
        ability: 'WIS',
        dc: 12,
        reason: 'Проверка Медицины (Medicine)',
      };
    } else if (isNature) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Nature',
        ability: 'INT',
        dc: 12,
        reason: 'Проверка Природы (Nature)',
      };
    } else if (isArcana) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Arcana',
        ability: 'INT',
        dc: 13,
        reason: 'Проверка Магии (Arcana)',
      };
    } else if (isHistory) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'History',
        ability: 'INT',
        dc: 13,
        reason: 'Проверка Истории (History)',
      };
    } else if (isReligion) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Religion',
        ability: 'INT',
        dc: 13,
        reason: 'Проверка Религии (Religion)',
      };
    } else if (isPersuasion) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Persuasion',
        ability: 'CHA',
        dc: 13,
        reason: 'Проверка Убеждения (Persuasion)',
      };
    } else if (isDeception) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Deception',
        ability: 'CHA',
        dc: 13,
        reason: 'Проверка Обмана (Deception)',
      };
    } else if (isIntimidation) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'skill_check',
        skill: 'Intimidation',
        ability: 'CHA',
        dc: 13,
        reason: 'Проверка Запугивания (Intimidation)',
      };
    } else if (isSavingThrow) {
      parsed.requires_roll = {
        needed: true,
        roll_type: 'saving_throw',
        ability: 'DEX',
        dc: 14,
        reason: 'Спасбросок от опасности или магии',
      };
    }
  }

  // 6. Targeted Multiplayer Roll Resolution: Ensure target_character_name & target_character_id are filled
  if (parsed.requires_roll && parsed.requires_roll.needed) {
    if (!parsed.requires_roll.target_character_name || parsed.requires_roll.target_character_name.trim().length === 0) {
      // If action had an explicit author, assign to them
      if (actionAuthorName) {
        parsed.requires_roll.target_character_name = actionAuthorName;
      } else if (currentCharacter?.name) {
        parsed.requires_roll.target_character_name = currentCharacter.name;
      } else if (partyPlayers.length > 0) {
        parsed.requires_roll.target_character_name = partyPlayers[0].name || partyPlayers[0].character?.name || 'Герой';
      }
    }

    // Match with party player to set target_character_id
    if (parsed.requires_roll.target_character_name) {
      const targetNameLower = parsed.requires_roll.target_character_name.toLowerCase().trim();
      const matchedPlayer = partyPlayers.find(
        (p) =>
          p.name.toLowerCase() === targetNameLower ||
          p.character?.name?.toLowerCase() === targetNameLower ||
          targetNameLower.includes(p.name.toLowerCase()) ||
          (p.character?.name && targetNameLower.includes(p.character.name.toLowerCase()))
      );

      if (matchedPlayer) {
        parsed.requires_roll.target_character_id = matchedPlayer.id;
        parsed.requires_roll.target_character_name = matchedPlayer.name || matchedPlayer.character?.name;
      }
    }
  }

  // 7. High Precision Adaptive Time parser
  const timeResult = parseAndAdvanceTime(
    currentDay,
    currentMinutes,
    actionText,
    text,
    parsed.state_update.time_passed_minutes,
    parsed.state_update.new_time,
    parsed.state_update.new_day
  );

  parsed.state_update.time_passed_minutes = timeResult.timePassedMinutes;
  parsed.state_update.new_time = timeResult.formatted;
  parsed.state_update.new_day = timeResult.nextDay;

  return parsed;
}

function parseJsonResponse(
  raw: string,
  currentCharacter?: CharacterSheet,
  actionText: string = '',
  currentDay: number = 1,
  currentMinutes: number = 480,
  partyPlayers: Array<{ id: string; name: string; character: CharacterSheet }> = []
): DmResponse {
  try {
    let clean = raw.trim();
    clean = clean.replace(/^```(?:json)?\s*/i, '');
    clean = clean.replace(/\s*```$/i, '');
    clean = clean.trim();

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(clean);
    if (!parsed.narrative && parsed.text) {
      parsed.narrative = parsed.text;
    }
    return enrichStateUpdateFromNarrative(parsed as DmResponse, raw, currentCharacter, actionText, currentDay, currentMinutes, partyPlayers);
  } catch (err) {
    const fallbackObj: DmResponse = {
      narrative: raw,
      suggested_actions: ['Осмотреться вокруг', 'Исследовать окрестности', 'Двигаться дальше'],
      requires_roll: { needed: false },
      state_update: {
        hp_change: 0,
        added_items: [],
        removed_items: [],
        gold_change: 0,
        location_name: 'Текущая зона',
        time_passed_minutes: 15,
      },
    };
    return enrichStateUpdateFromNarrative(fallbackObj, raw, currentCharacter, actionText, currentDay, currentMinutes, partyPlayers);
  }
}

// Extract thinking/reasoning process and clean JSON narrative
function extractThinkingAndJson(
  raw: string,
  rawReasoning?: string,
  currentCharacter?: CharacterSheet,
  actionText: string = '',
  currentDay: number = 1,
  currentMinutes: number = 480,
  partyPlayers: Array<{ id: string; name: string; character: CharacterSheet }> = []
): DmResponse {
  let thought = rawReasoning || '';
  let content = raw || '';

  // 1. Extract <think>...</think> or <thought>...</thought> tags
  const thinkRegex = /<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/gi;
  let match;
  while ((match = thinkRegex.exec(content)) !== null) {
    if (match[1]) {
      thought = (thought ? thought + '\n\n' : '') + match[1].trim();
    }
  }
  content = content.replace(thinkRegex, '').trim();

  // 2. Extract ```thought ... ``` code blocks
  const thoughtBlockRegex = /```(?:thought|thinking)\s*([\s\S]*?)```/gi;
  while ((match = thoughtBlockRegex.exec(content)) !== null) {
    if (match[1]) {
      thought = (thought ? thought + '\n\n' : '') + match[1].trim();
    }
  }
  content = content.replace(thoughtBlockRegex, '').trim();

  const parsed = parseJsonResponse(content, currentCharacter, actionText, currentDay, currentMinutes, partyPlayers);
  if (thought && thought.trim().length > 0) {
    parsed.thought = thought.trim();
  }

  // Strip out any "📊 [Хроника мира]..." or "Варианты действий:" technical blocks from narrative
  if (parsed.narrative) {
    parsed.narrative = parsed.narrative
      .replace(/\s*---\s*📊\s*\*{0,2}\[?Хроника\s+мира\]?\*{0,2}[\s\S]*$/i, '')
      .replace(/\s*📊\s*\*{0,2}\[?Хроника\s+мира\]?\*{0,2}[\s\S]*$/i, '')
      .replace(/\s*---\s*📍\s*\*{0,2}Локация:?[\s\S]*$/i, '')
      .replace(/\n+\s*(\*{0,2}(?:Возможные\s+)?(?:Варианты|варианты)\s+действий:?\*{0,2}|\b(?:Что\s+вы\s+(?:будете\s+делать|сделаете|предпримете|решите|хотите\s+сделать)\??))[\s\S]*$/i, '')
      .replace(/\n+\s*(?:[1-4]\.|\*|-)\s+[А-Яа-яЁёA-Za-z0-9\s()«»"—,-]+(?:\n+\s*(?:[1-4]\.|\*|-)\s+[А-Яа-яЁёA-Za-z0-9\s()«»"—,-]+){1,5}\s*$/i, '')
      .trim();
  }

  return parsed;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      character = {} as CharacterSheet,
      world = {} as WorldSettings,
      history = [] as ChatMessage[],
      action = '',
      partyPlayers = [] as Array<{ id: string; name: string; character: CharacterSheet; isHost?: boolean; color?: string }>,
      partyCompanions = [] as PartyCompanion[],
      journalEntries = [],
      lorebookEntries = [] as LorebookEntry[],
      storySummary = '',
      inGameDay = 1,
      inGameMinutes = 480,
      inGameTime,
      apiKey: userApiKey,
      model: userModel,
      modelName: userModelName,
      baseUrl: userBaseUrl,
      customPrompt: userCustomPrompt,
      useGemini = false,
      geminiApiKey: userGeminiApiKey,
      geminiModel: userGeminiModel,
      useLmStudio = false,
      lmStudioUrl: userLmStudioUrl,
      lmStudioModel: userLmStudioModel,
      lmStudioApiKey: userLmStudioApiKey,
    }: {
      character: CharacterSheet;
      world: WorldSettings;
      history: ChatMessage[];
      action?: string;
      partyPlayers?: Array<{ id: string; name: string; character: CharacterSheet; isHost?: boolean; color?: string }>;
      partyCompanions?: PartyCompanion[];
      journalEntries?: Array<{ id: string; title: string; text: string; type: string }>;
      lorebookEntries?: LorebookEntry[];
      storySummary?: string;
      inGameDay?: number;
      inGameMinutes?: number;
      inGameTime?: string;
      apiKey?: string;
      model?: string;
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
    } = body;

    const isOpenRouterActive = body.useOpenRouter !== false;
    const isLmStudioActive = Boolean(useLmStudio);
    const lmStudioUrl = userLmStudioUrl || 'http://localhost:1234/v1';
    const lmStudioModel = userLmStudioModel || '';
    const lmStudioApiKey = userLmStudioApiKey || 'lm-studio';
    const geminiApiKey = (userGeminiApiKey && userGeminiApiKey.trim().length > 0 ? userGeminiApiKey.trim() : '') || process.env.GEMINI_API_KEY || '';
    const geminiModel = (userGeminiModel && userGeminiModel.trim().length > 0 ? userGeminiModel.trim().replace(/^models\//, '') : 'gemini-3.7-flash');
    const isGeminiActive = Boolean(useGemini && geminiApiKey);

    const chosenModel = userModel || userModelName || 'nvidia/nemotron-3-super-120b-a12b:free';

    const apiKey =
      (userApiKey && userApiKey.trim().length > 0 ? userApiKey.trim() : '') ||
      process.env.OPENROUTER_API_KEY ||
      '';

    let resolvedBaseUrl = (userBaseUrl && userBaseUrl.trim().length > 0 ? userBaseUrl.trim() : '').replace(/\/+$/, '');
    if (!resolvedBaseUrl) {
      resolvedBaseUrl = apiKey ? 'https://openrouter.ai/api/v1' : 'https://text.pollinations.ai/openai';
    }

    // 0. Calculate in-game clock and day period
    const currentDay = inGameDay || 1;
    const currentMinutes = inGameMinutes !== undefined ? inGameMinutes : 480;
    const clockHours = Math.floor((currentMinutes % 1440) / 60);
    const clockMins = Math.floor(currentMinutes % 60);
    const hh = String(clockHours).padStart(2, '0');
    const mm = String(clockMins).padStart(2, '0');
    const formattedClock = inGameTime || `День ${currentDay} • ${hh}:${mm}`;

    let timeOfDayDesc = 'Утро (восход, начало дня)';
    if (clockHours >= 5 && clockHours < 12) {
      timeOfDayDesc = 'Утро (восход солнца, свежесть, пробуждение мира)';
    } else if (clockHours >= 12 && clockHours < 17) {
      timeOfDayDesc = 'День / Полдень (яркое солнце в зените, тепло, отличная видимость)';
    } else if (clockHours >= 17 && clockHours < 22) {
      timeOfDayDesc = 'Вечер / Сумерки (закат, сгущаются тени, зажигаются огни)';
    } else {
      timeOfDayDesc = 'Ночь / Полночь (глубокая тьма, лунный свет, тишина, нужен факел/свет)';
    }

    const worldTimeBlock = `[⏰ ТЕКУЩЕЕ ИГРОВОЕ ВРЕМЯ И СУТКИ В МИРЕ]:
- Текущее время: ${formattedClock} (${timeOfDayDesc})
- ПРАВИЛО ОСВЕЩЕНИЯ И АТМОСФЕРЫ: Всегда органично вплетай текущее время суток в повествование (положение солнца или луны, видимость, тени, закрытие лавок на ночь, отдых жителей, патрули стражи с факелами, активность ночных созданий).`;

    // 1. Match Lorebook Entries based on keywords in action & recent context
    const recentContextText = [
      action,
      ...history.slice(-6).map((m) => m.text),
    ].join(' ').toLowerCase();

    const activeLorebookSnippets: string[] = [];
    for (const lb of lorebookEntries) {
      if (!lb.enabled) continue;
      const isTriggered = lb.constant || (lb.keys && lb.keys.some((k) => k && recentContextText.includes(k.toLowerCase().trim())));
      if (isTriggered && lb.content) {
        activeLorebookSnippets.push(`📖 [${lb.title || 'ЛОР'}]:\n${lb.content.trim()}`);
      }
    }

    // Check user custom notes in journal
    if (journalEntries && journalEntries.length > 0) {
      for (const j of journalEntries) {
        if (j.title && (recentContextText.includes(j.title.toLowerCase().trim()) || j.type === 'quest')) {
          activeLorebookSnippets.push(`📜 [Заметка журнала: ${j.title} (${j.type})]: ${j.text}`);
        }
      }
    }

    // 2. Build Live Party Roster (LAN Multiplayer Group)
    let partyRosterPrompt = '';
    if (partyPlayers && partyPlayers.length > 0) {
      partyRosterPrompt = `\n[👥 ОТРЯД ЖИВЫХ ИГРОКОВ (PARTY ROSTER - ${partyPlayers.length} УЧАСТНИКОВ)]:\n` +
        partyPlayers.map((p, idx) => {
          const c = p.character || {};
          const s = c.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
          const fmtM = (val: number) => {
            const m = Math.floor((val - 10) / 2);
            return m >= 0 ? `+${m}` : `${m}`;
          };
          const saves = (c.savingThrowProficiencies || []).map((sv) => sv.toUpperCase()).join(', ') || 'Базовые';
          const skills = (c.skillProficiencies || []).join(', ') || 'Базовые';
          const pEquipped = c.equippedItems && c.equippedItems.length > 0 ? c.equippedItems.join(', ') : 'Базовое снаряжение';
          const pInv = c.inventory && c.inventory.length > 0 ? c.inventory.join(', ') : 'Пусто';
          return `${idx + 1}. ПЕРСОНАЖ: "${p.name || c.name || 'Герой'}" (ID: "${p.id}") | Класс: ${c.class || 'Воин'} ${c.level || 1} ур. (${c.race || 'Человек'}) | HP: ${c.currentHp || 10}/${c.maxHp || 10}, AC: ${c.ac || 10} | СИЛ ${s.str} (${fmtM(s.str)}), ЛОВ ${s.dex} (${fmtM(s.dex)}), ТЕЛ ${s.con} (${fmtM(s.con)}), ИНТ ${s.int} (${fmtM(s.int)}), МУД ${s.wis} (${fmtM(s.wis)}), ХАР ${s.cha} (${fmtM(s.cha)}) | Спасброски: ${saves} | Навыки: ${skills} | 🛡️ Надето: [${pEquipped}] | 🎒 Инвентарь: [${pInv}] | 💰 Золото: ${c.gold || 0} gp`;
        }).join('\n');
    }

    // 3. Build Party Companions Roster
    let companionsPrompt = '';
    if (partyCompanions && partyCompanions.length > 0) {
      companionsPrompt = `\n[СПУТНИКИ И ОТРЯД ГЕРОЯ (${partyCompanions.length})]:\n` +
        partyCompanions.map((c) => `- ${c.name} (${c.role}): Отношение: ${c.affinity || 'friendly'} | Связь: "${c.relationship}" | HP: ${c.hp}/${c.maxHp} | AC: ${c.ac} | Стат: ${c.mainStat} | Способности: ${c.specialAbilities} | Характер: ${c.personality} | Статус: ${c.status}`).join('\n');
    }

    // 4. Build Persona & Primary Character Sheet
    const equippedList = character.equippedItems && character.equippedItems.length > 0
      ? character.equippedItems.join(', ')
      : 'Базовое оружие и одежда';

    const backpackList = character.inventory && character.inventory.length > 0
      ? character.inventory.join(', ')
      : 'Пусто';

    const strVal = character.stats?.str || 10;
    const dexVal = character.stats?.dex || 10;
    const conVal = character.stats?.con || 10;
    const intVal = character.stats?.int || 10;
    const wisVal = character.stats?.wis || 10;
    const chaVal = character.stats?.cha || 10;

    const strMod = Math.floor((strVal - 10) / 2);
    const dexMod = Math.floor((dexVal - 10) / 2);
    const conMod = Math.floor((conVal - 10) / 2);
    const intMod = Math.floor((intVal - 10) / 2);
    const wisMod = Math.floor((wisVal - 10) / 2);
    const chaMod = Math.floor((chaVal - 10) / 2);

    const fmtMod = (m: number) => (m >= 0 ? `+${m}` : `${m}`);

    const savesList = character.savingThrowProficiencies && character.savingThrowProficiencies.length > 0
      ? character.savingThrowProficiencies.map((s) => s.toUpperCase()).join(', ')
      : 'Нет';

    const skillsList = character.skillProficiencies && character.skillProficiencies.length > 0
      ? character.skillProficiencies.join(', ')
      : 'Базовые';

    const charDetails = `[ЛИСТ ПЕРСОНАЖА (ХОСТ / {{user}})]:
- Имя: ${character.name || 'Герой'}
- Класс: ${character.class || 'Воин'} (Уровень ${character.level || 1}${character.subclass ? `, ${character.subclass}` : ''})
- Раса: ${character.race || 'Человек'}${character.background ? ` | Предыстория: ${character.background}` : ''}
- Здоровье: ${character.currentHp || 10}/${character.maxHp || 10} HP (Temp HP: ${character.tempHp || 0})
- Класс Брони (AC): ${character.ac || 10} | Скорость: ${character.speed || 30} фт | Бонус мастерства: +${character.proficiencyBonus || 2}
- Базовые Характеристики: СИЛ ${strVal} (${fmtMod(strMod)}), ЛОВ ${dexVal} (${fmtMod(dexMod)}), ТЕЛ ${conVal} (${fmtMod(conMod)}), ИНТ ${intVal} (${fmtMod(intMod)}), МУД ${wisVal} (${fmtMod(wisMod)}), ХАР ${chaVal} (${fmtMod(chaMod)})
- Владение спасбросками: ${savesList}
- Владение навыками: ${skillsList}
${character.appearance ? `- Внешность: ${character.appearance}` : ''}
${character.personalityTraits ? `- Характер и черты: ${character.personalityTraits}` : ''}
${character.motivation ? `- Цель и мотивация: ${character.motivation}` : ''}
${character.backstory || character.bio ? `- Предыстория: ${character.backstory || character.bio}` : ''}
- 💰 Золото героя: ${character.gold || 0} gp
- 🛡️ НАДЕТОЕ СНАРЯЖЕНИЕ (Оружие в руках, надетая броня, щит): ${equippedList}
- 🎒 РЮКЗАК И РАСХОДНЫЕ ПРЕДМЕТЫ (Зелья, свитки, припасы, не надетое): ${backpackList}`;

    // 5. Master Prompt with Strict Russian Language & Multiplayer Rules
    const systemPrompt = `ТЫ — {{char}}, ОПЫТНЫЙ DUNGEON MASTER ДЛЯ РОЛЕВОЙ ИГРЫ D&D 5e (DUNGEONS & DRAGONS) В РЕЖИМЕ ЛОКАЛЬНОГО МУЛЬТИПЛЕЕРА И СОЛО.
Твоя цель — вести глубокую, атмосферную, последовательную песочницу для отряда игроков, обладая АБСОЛЮТНОЙ ПАМЯТЬЮ обо всех событиях, решениях, деталях сюжета, времени суток, спутниках и NPC.

[🇷🇺 КАТЕГОРИЧЕСКИЙ ЯЗЫКОВОЙ ЗАКОН]:
ВЕСЬ ТВОЙ ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ!
Все описания локаций, мысли, прямая речь NPC, варианты действий и статус-блок генерируются исключительно на чистом, богатом русском языке. Никаких фраз на английском или других языках!

[🎒 ЖЕСТКИЙ ЗАКОН ИНВЕНТАРЯ И АНТИ-ЧИТ (STRICT INVENTORY LOCK)]:
1. АБСОЛЮТНЫЙ ЗАПРЕТ НА ПРЕДМЕТЫ ИЗ ВОЗДУХА:
   Персонаж игрока (и любой член отряда) может использовать, доставать, пить, надевать, бросать, читать или применять ТОЛЬКО те предметы, которые ПРЯМО ПЕРЕЧИСЛЕНЫ в его списке «🛡️ НАДЕТОЕ СНАРЯЖЕНИЕ» или «🎒 РЮКЗАК И РАСХОДНЫЕ ПРЕДМЕТЫ»!
2. ОТКАЗ И РЕАКЦИЯ НА ПОПЫТКУ ВЗЯТЬ НЕСУЩЕСТВУЮЩИЙ ПРЕДМЕТ:
   Если игрок в тексте действия утверждает, что он достает, пьет, использует, зажигает, читает или надевает предмет, которого НЕТ в его инвентаре/рюкзаке (например: пишет «достаю зелье невидимости/лечения», «вынимаю свиток огня», «достаю веревку с крюком», «надеваю кольцо невидимости», «беру святую воду», а этого предмета НЕТ в его списке инвентаря):
   - Ты ОБЯЗАН прямо в художественном повествовании ЧЕТКО отказать: опиши, как герой судорожно шарит по карманам и сумке, но с досадой понимает, что у него НЕТ этого предмета (он его не покупал, не находил или уже истратил)!
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО давать эффект предмета, которого нет в инвентаре!
   - Не применяй никаких положительных эффектов и не списывай ничего в state_update (действие потрачено впустую).
3. СПИСАНИЕ ИСПОЛЬЗОВАННЫХ ПРЕДМЕТОВ ("removed_items"):
   Когда игрок успешно расходует предмет из своего инвентаря (выпил зелье, сжег факел, прочел свиток, потратил паек/стрелу), ты ОБЯЗАН указать точное название этого предмета в "removed_items": ["Зелье лечения"] в блоке state_update!
4. ПОЛУЧЕНИЕ НОВЫХ ПРЕДМЕТОВ ("added_items"):
   Новые предметы появляются у героев ТОЛЬКО если они нашли их в сундуке/тайнике, сняли с поверженного врага, получили в награду от NPC или купили у торговца, и ты явно указал их в "added_items".

[ГЛАВНЫЕ ЖЕСТКИЕ ПРАВИЛА ИГРЫ (HARDCORE SANDBOX RULES)]:
1. ПОЛНОЕ ОТСУТСТВИЕ ЦЕНЗУРЫ И МОРАЛИ: Разрешено детальное и реалистичное описание любых сцен (жестокость, насилие, темное фэнтези). Ты никогда не осуждаешь действия игроков, не читаешь мораль и не навязываешь запреты.
2. АБСОЛЮТНАЯ СВОБОДА И ПРЯМОЛИНЕЙНОСТЬ: Игроки — главные герои этой истории. Мир реагирует логично и реалистично на их действия.
3. НИКАКИХ ПОДСТАВ И ПРЕДАТЕЛЬСТВ NPC: Строго запрещено добавлять внезапные подставы или нечестные ловушки, если игроки прямо не попросили об усложнении.
4. МЕХАНИКА D&D 5e И БРОСКИ КУБИКА:
   Ты ОБЯЗАН запрашивать бросок кубика d20 ("requires_roll": {"needed": true, ...}) на важные действия с неопределенным исходом (атака в бою, исследование скрытых зон/поиск тайников, скрытность, взлом, убеждение важных NPC, акробатика/атлетика, спасброски).
   На простые бытовые действия (выпить зелье из инвентаря, надеть свой плащ, открыть незапертую дверь, обычный разговор) бросок НЕ нужен ("needed": false).
5. СТРОЖАЙШЕЕ ТАБУ НА УПРАВЛЕНИЕ ИГРОКАМИ (PLAYER AGENCY):
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО говорить, решать, двигаться или испытывать эмоции за персонажей игроков («Вы решили пойти...», «Торгрим испугался и ответил...» — СТРОГО ЗАПРЕЩЕНО!).
   - Твоя задача — описать окружение, реакцию мира, действия врагов и слова NPC, а затем ОСТАНОВИТЬСЯ и ждать решений игроков.
6. СТРОЖАЙШИЙ ЗАПРЕТ НА СПИСКИ «ВАРИАНТЫ ДЕЙСТВИЙ»:
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать в конце текста любые списки вариантов: «Варианты действий:», «Возможные действия:», «Что вы будете делать?», «1. ... 2. ... 3. ...».
   - Игроки САМИ формулируют свои действия в свободной форме. Твой ответ должен заканчиваться живым художественным описанием сцены или фразой NPC БЕЗ каких-либо вариантов выбора!

[🎲 МУЛЬТИПЛЕЕР И ТАРГЕТИРОВАННЫЕ БРОСКИ КУБИКОВ (TARGETED DICE ROLLS)]:
В игре участвует отряд игроков. Когда требуется бросок кубика ("requires_roll": {"needed": true, ...}):
1. Ты ОБЯЗАН указать КОНКРЕТНОГО персонажа из списка [👥 ОТРЯД ЖИВЫХ ИГРОКОВ], который должен совершить бросок:
   - "target_character_name": "Имя персонажа" (например: "Торгрим")
   - "target_character_id": "ID игрока" (например: "player_1" или "client_...")
2. Если действие совершил конкретный игрок (например "[Игрок: Воин Торгрим]: я выбиваю дверь"), запрашивай бросок именно от этого персонажа!
3. Если опасность угрожает конкретному герою или всей группе (спасбросок от заклинания/ловушки), укажи имя целевого персонажа.
4. В поле "reason" на русском языке подробно опиши причину броска (например: "Проверка Атлетики (STR) для взлома двери").

[⚠️ СТРОГОЕ ПРАВИЛО НЕЗАВЕРШЕННОГО ДЕЙСТВИЯ]:
Когда ты требуешь бросок кубика ("needed": true):
- Опиши ТОЛЬКО подготовку к действию и нарастающее напряжение (например: как Торгрим разбегается и бьет плечом в засов).
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать, что действие уже успешно завершилось (дверь сломалась) или провалилось ДО того, как игрок бросил кубик!
- Остановись и жди броска игрока — исход будет определен следующим сообщением по результату выпавшего D20!

[🧠 ЖЕСТКИЙ ПРОТОКОЛ ПАМЯТИ, ХРОНОЛОГИИ И NPC (MEMORY CONTINUITY PROTOCOL)]:
1. АБСОЛЮТНАЯ ПАМЯТЬ ОБ NPC И СПУТНИКАХ:
   - Все когда-либо встреченные NPC и спутники сохраняют имена, расу, характер и отношение к героям.
2. СЮЖЕТНЫЙ КАНОН:
   - Все принятые решения, выполненные квесты и победы являются нерушимой истиной. Никогда не противоречь прошлым событиям истории.
3. ИНВЕНТАРЬ И ЗОЛОТО:
   - Строго учитывай найденные и потраченные предметы. Никогда не позволяй доставать предметы из ниоткуда.

${worldTimeBlock}

${world.customSetting && world.customSetting.trim() ? `[СЕТТИНГ И ОПИСАНИЕ МИРА]:\n${world.customSetting.trim()}\n` : '[СЕТТИНГ]: Классический мир приключений D&D 5e.\n'}
${world.customTone && world.customTone.trim() ? `[ТОНАЛЬНОСТЬ И АТМОСФЕРА]:\n${world.customTone.trim()}\n` : ''}
${world.customRules && world.customRules.trim() ? `[ОСОБЫЕ ПРАВИЛА МИРА]:\n${world.customRules.trim()}\n` : ''}
${userCustomPrompt && userCustomPrompt.trim() ? `[ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ]:\n${userCustomPrompt.trim()}\n` : ''}
${storySummary && storySummary.trim() ? `[ПРЕДЫДУЩАЯ ХРОНИКА СЮЖЕТА (ПАМЯТЬ)]:\n${storySummary.trim()}\n` : ''}
${activeLorebookSnippets.length > 0 ? `[АКТИВНЫЕ ЗАПИСИ ЛОРБУКА И ПАМЯТИ]:\n${activeLorebookSnippets.join('\n\n')}\n` : ''}
${partyRosterPrompt}
${companionsPrompt}

${charDetails}

ФОРМАТ ВЫХОДНЫХ ДАННЫХ:
Возвращай СТРОГО валидный JSON следующей структуры:
{
  "narrative": "Чистый художественный и атмосферный текст ответа Dungeon Master на русском языке в формате Markdown (СТРОГО БЕЗ служебных блоков и СТРОГО БЕЗ списков вариантов действий, только чистое повествование).",
  "requires_roll": {
    "needed": true/false,
    "target_character_name": "Торгрим",
    "target_character_id": "player_id",
    "roll_type": "skill_check"|"saving_throw"|"attack_roll"|"flat_ability",
    "ability": "STR"|"DEX"|"CON"|"INT"|"WIS"|"CHA",
    "skill": "Perception"|"Athletics"|"Stealth"|...,
    "dc": 14,
    "reason": "Проверка Атлетики (STR) для взлома двери"
  },
  "state_update": {
    "hp_change": -4,
    "gold_change": 15,
    "added_items": ["Зелье лечения (2d4+2)"],
    "removed_items": [],
    "location_name": "Название текущей локации",
    "time_passed_minutes": 15,
    "new_time": "18:00"
  },
  "nearby_npcs": [
    {
      "name": "Имя NPC рядом",
      "role": "Роль/Класс",
      "relationship": "Отношение к героям",
      "affinity": "devoted"|"friendly"|"neutral"|"distrustful",
      "hp": 16,
      "maxHp": 16,
      "ac": 14,
      "mainStat": "WIS +3",
      "specialAbilities": "Способности",
      "personality": "Характер"
    }
  ]
}

[⚡ ПРАВИЛА ОБНОВЛЕНИЯ ЛИСТА ПЕРСОНАЖА И ВРЕМЕНИ В STATE_UPDATE]:
1. АДАПТИВНОЕ ИГРОВОЕ ВРЕМЯ ("time_passed_minutes" и "new_time"): Управляй ходом часов и суток мира.
2. УРОН И ЛЕЧЕНИЕ: Отрицательное число при уроне (например: "hp_change": -6), положительное при лечении ("hp_change": 8).
3. ПРЕДМЕТЫ И ЗОЛОТО: Добавляй лут в "added_items", расходники в "removed_items", золото в "gold_change".`;

    // 6. Build chat messages payload with depth anchor
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Keep up to 26 recent messages for extended memory context
    const recentHistory = history.slice(-26);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text || '',
      });
    }

    // Depth Anchor right before user action
    const depthAnchor = `[СИСТЕМНЫЙ ЯКОРЬ ПАМЯТИ: Ты — Dungeon Master. Игровое время: ${formattedClock} (${timeOfDayDesc}). Пиши СТРОГО на русском языке. СТРОГИЙ ЗАПРЕТ ПРЕДМЕТОВ ИЗ ВОЗДУХА: игрок может использовать ТОЛЬКО то, что есть в его инвентаре/снаряжении. Если он пытается достать/использовать предмет не из инвентаря — ОТКАЖИ (персонаж понимает, что у него этого нет). При расходе предметов указывай их в removed_items. При необходимости броска укажи целевого персонажа в requires_roll.]`;

    if (action && action.trim().length > 0) {
      messages.push({
        role: 'user',
        content: `${depthAnchor}\n\n[Действие]: ${action.trim()}`,
      });
    } else if (messages.length === 1) {
      messages.push({
        role: 'user',
        content: world.startingScene && world.startingScene.trim()
          ? `${depthAnchor}\n\nНачни кампанию. Стартовая завязка:\n${world.startingScene.trim()}`
          : `${depthAnchor}\n\nНачни приключение и опиши стартовую сцену на русском языке для отряда, учитывая время суток (${formattedClock}).`,
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey || 'anonymous'}`,
    };

    if (resolvedBaseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://dndaie5.app';
      headers['X-Title'] = 'DnDAIe5 Engine';
    }

    // OpenRouter cascade strictly using the free screenshot models
    const modelCascade = [
      chosenModel,
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-ultra:free',
      'thinking-machines/inkling:free',
      'z-ai/glm-5.2:free',
      'openrouter/free-models-router',
      'google/gemma-4-31b:free',
      'dots-studio/dots3-note-preview:free',
      'minimax/minimax-m3:free',
      'poolside/laguna-s-2.1:free',
      'liquid/lfm-2.5-2.6b:free',
      'nvidia/nemotron-3.5-lightning:free',
      'ling/ling-3.0-flash-fin:free',
    ];

    const uniqueModels = Array.from(new Set(modelCascade));
    let successfulContent = '';
    let successfulReasoning = '';
    let providerUsed = 'openrouter';

    // ================= 0. HIGHEST PRIORITY: LM STUDIO (LOCAL AI) =================
    if (isLmStudioActive) {
      try {
        let lmUrl = (body.lmStudioUrl || 'http://localhost:1234/v1').trim().replace(/\/+$/, '');
        if (!lmUrl.startsWith('http://') && !lmUrl.startsWith('https://')) {
          lmUrl = `http://${lmUrl}`;
        }
        if (!lmUrl.endsWith('/v1') && !lmUrl.includes('/v1/')) {
          lmUrl = `${lmUrl}/v1`;
        }
        const lmKey = (body.lmStudioApiKey && body.lmStudioApiKey.trim().length > 0 ? body.lmStudioApiKey.trim() : 'lm-studio');
        let lmModel = (body.lmStudioModel && body.lmStudioModel.trim().length > 0 ? body.lmStudioModel.trim() : '');

        // If no model name specified, query /models to detect loaded model name
        if (!lmModel) {
          try {
            const mRes = await fetch(`${lmUrl}/models`, {
              headers: { 'Authorization': `Bearer ${lmKey}` },
              signal: AbortSignal.timeout(3000),
            });
            if (mRes.ok) {
              const mData = await mRes.json();
              const found = mData?.data?.[0]?.id || mData?.models?.[0]?.id || mData?.data?.[0]?.name;
              if (found) lmModel = found;
            }
          } catch {}
          if (!lmModel) lmModel = 'local-model';
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s for local LLMs

        const lmRes = await fetch(`${lmUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lmKey}`,
          },
          body: JSON.stringify({
            model: lmModel,
            messages: messages,
            temperature: 0.75,
            max_tokens: 4000,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (lmRes.ok) {
          const data = await lmRes.json();
          const choice = data.choices?.[0];
          let raw = choice?.message?.content || '';
          const reasoning = choice?.message?.reasoning_content || choice?.message?.reasoning || choice?.reasoning || '';
          if (!raw && reasoning) {
            raw = reasoning;
          } else if (!raw && choice?.text) {
            raw = choice.text;
          }

          if (raw && raw.trim().length > 0) {
            successfulContent = raw;
            successfulReasoning = reasoning;
            providerUsed = 'lmstudio';
          }
        }
      } catch (err: any) {
        console.warn('LM Studio local DM error, continuing cascade:', err?.message);
      }
    }

    // ================= 1. SECONDARY PROVIDER: GOOGLE GEMINI API =================
    if (!successfulContent && isGeminiActive) {
      const geminiCascade = Array.from(
        new Set([
          geminiModel,
          'gemini-3.7-flash',
          'gemini-3.6-flash',
          'gemini-2.5-flash',
          'google/gemini-3.7-flash',
          'google/gemini-3.6-flash',
          'google/gemini-2.5-flash',
        ])
      );

      for (const curGeminiModel of geminiCascade) {
        if (successfulContent) break;

        // Try OpenAI compatibility endpoint
        try {
          const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 18000);

          const geminiRes = await fetch(geminiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${geminiApiKey}`,
            },
            body: JSON.stringify({
              model: curGeminiModel,
              messages: messages,
              temperature: 0.75,
              max_tokens: 3000,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const choice = data.choices?.[0];
            const raw = choice?.message?.content || '';
            const reasoning = choice?.message?.reasoning || choice?.reasoning || '';
            if (raw && raw.trim().length > 0) {
              successfulContent = raw;
              successfulReasoning = reasoning;
              providerUsed = 'gemini';
              break;
            }
          }
        } catch (err: any) {
          console.warn(`Gemini OpenAI endpoint error for ${curGeminiModel}:`, err?.message);
        }

        // Try Native REST API endpoint fallback
        if (!successfulContent) {
          try {
            const nativeEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${curGeminiModel}:generateContent?key=${geminiApiKey}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 18000);

            const fullPrompt = `${systemPrompt}\n\n[ИСТОРИЯ ДИАЛОГА И ПОСЛЕДНЕЕ ДЕЙСТВИЕ]:\n` +
              messages.slice(1).map((m) => `${m.role === 'user' ? 'Игрок' : 'Мастер'}: ${m.content}`).join('\n\n');

            const geminiRes = await fetch(nativeEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                generationConfig: { temperature: 0.75, maxOutputTokens: 3000 },
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (geminiRes.ok) {
              const data = await geminiRes.json();
              const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (raw && raw.trim().length > 0) {
                successfulContent = raw;
                providerUsed = 'gemini';
                break;
              }
            }
          } catch (err: any) {
            console.warn(`Gemini native REST error for ${curGeminiModel}:`, err?.message);
          }
        }
      }
    }

    // 2. OpenRouter Cascade (if enabled and higher-priority providers were not active or failed)
    if (!successfulContent && isOpenRouterActive) {
      for (const currentModel of uniqueModels) {
        try {
          const endpointUrl = `${resolvedBaseUrl}/chat/completions`;
          const payload = {
            model: currentModel,
            messages: messages,
            temperature: 0.75,
            max_tokens: 3000,
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const apiRes = await fetch(endpointUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (apiRes.ok) {
            const data = await apiRes.json();
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
        } catch (err: any) {
          console.warn(`Fetch error for ${currentModel}:`, err?.message);
        }
      }
    }

    // Return clear API error if all models failed or network is down
    if (!successfulContent) {
      return NextResponse.json(
        {
          error: 'Не удалось получить ответ от нейросети. Проверьте интернет-соединение или настройки выбранных провайдеров (OpenRouter / Gemini / LM Studio) в Настройках.',
          isApiError: true,
        },
        { status: 502 }
      );
    }

    const parsedResponse = extractThinkingAndJson(
      successfulContent,
      successfulReasoning,
      character,
      action,
      currentDay,
      currentMinutes,
      partyPlayers
    );

    if (!parsedResponse.requires_roll) {
      parsedResponse.requires_roll = { needed: false };
    }
    if (!parsedResponse.suggested_actions || !Array.isArray(parsedResponse.suggested_actions)) {
      parsedResponse.suggested_actions = ['Осмотреться вокруг', 'Прислушаться', 'Двигаться дальше'];
    }
    if (!parsedResponse.state_update) {
      parsedResponse.state_update = {
        hp_change: 0,
        added_items: [],
        removed_items: [],
        gold_change: 0,
        location_name: 'Текущая зона',
      };
    }

    return NextResponse.json({
      ...parsedResponse,
      providerUsed,
    });
  } catch (error: any) {
    console.error('--- GENERAL ERROR IN /api/dm ---', error);
    return NextResponse.json(
      {
        error: error?.message || 'Сбой соединения с сервером нейросети. Проверьте подключение и повторите запрос.',
        isApiError: true,
      },
      { status: 500 }
    );
  }
}