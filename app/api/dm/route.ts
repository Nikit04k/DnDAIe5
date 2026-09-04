import { NextRequest, NextResponse } from 'next/server';
import { CharacterSheet, WorldSettings, ChatMessage, DmResponse, PartyCompanion, LorebookEntry, GameDifficulty, DmRollRequest, CharacterStatePatch, DmStateUpdate } from '@/types/dnd';
import { buildDifficultyPrompt, getDifficultyDC, getRestRules, DND_REST_CONSTANTS } from '@/lib/difficultySettings';
import { parseAndAdvanceTime } from '@/lib/timeUtils';
import {
  checkLevelUp,
  checkPendingLevelUp,
  distributePartyXp,
  getLevelFromXp,
  canAdvanceLevel,
  CLASS_HIT_DICE,
  calculatePassiveScore,
  getCoverAcBonus,
  getAbilityModifier,
} from '@/lib/dndRules';


import { parseGmOverrideCommands } from '@/lib/gmOverrides';

function enrichStateUpdateFromNarrative(
  parsed: DmResponse,
  rawNarrative: string,
  currentCharacter?: CharacterSheet,
  actionText: string = '',
  currentDay: number = 1,
  currentMinutes: number = 480,
  partyPlayers: Array<{ id: string; name: string; character: CharacterSheet }> = [],
  difficulty?: GameDifficulty | string
): DmResponse {
  if (!parsed.state_update) {
    parsed.state_update = {
      hp_change: 0,
      gold_change: 0,
      added_items: [],
      removed_items: [],
      location_name: '',
      time_passed_minutes: 15,
      party_updates: {},
      camp_stash_updates: { added_items: [], removed_items: [] },
      p2p_transfers: [],
    };
  }

  if (!parsed.state_update.party_updates) {
    parsed.state_update.party_updates = {};
  }
  if (!parsed.state_update.camp_stash_updates) {
    parsed.state_update.camp_stash_updates = { added_items: [], removed_items: [] };
  }
  if (!parsed.state_update.p2p_transfers) {
    parsed.state_update.p2p_transfers = [];
  }
  if (!parsed.unclaimed_loot) {
    parsed.unclaimed_loot = [];
  }
  if (!parsed.private_narratives) {
    parsed.private_narratives = [];
  }

  // Extract action author metadata if present (supports joint co-op format)
  let actionAuthorName = '';
  let actingPlayerId = '';
  const authorMatch = actionText.match(/(?:\[(?:Ход игрока|Игрок(?:\s+\d+)?):\s*"?([^"|\]\n:]+)"?\s*\|\s*ID:\s*"([^"]+)")/i);
  if (authorMatch && !/совместн|раунд|отряд|действи/i.test(authorMatch[1])) {
    actionAuthorName = authorMatch[1].trim();
    actingPlayerId = authorMatch[2].trim();
  } else if (partyPlayers.length > 0) {
    actionAuthorName = partyPlayers[0].character?.name || partyPlayers[0].name || '';
    actingPlayerId = partyPlayers[0].id || '';
  } else if (currentCharacter) {
    actionAuthorName = currentCharacter.name || '';
    actingPlayerId = currentCharacter.id || 'player';
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

  // 4c. Also check 🎒 **Инвентарь и золото:** in chronicle block
  const invLineMatch = text.match(/🎒\s*\*{0,2}(?:Инвентарь(?:\s*и\s*золото)?):?\*{0,2}\s*([^\n]+)/i);
  if (invLineMatch && invLineMatch[1]) {
    const itemsPart = invLineMatch[1].replace(/\d+\s*(?:gp|золот\w*)/gi, '').trim();
    const splitItems = itemsPart.split(/[,;•]/).map((s) => s.trim().replace(/^\*+|\*+$/g, '')).filter((s) => s.length > 2 && s.length < 50);

    for (const it of splitItems) {
      if (!it.toLowerCase().includes('базовое') && !it.toLowerCase().includes('ничего') && !it.toLowerCase().includes('пусто')) {
        if (!currentCharacter?.inventory?.some((curr) => curr.toLowerCase() === it.toLowerCase()) && !parsed.state_update.added_items.some((curr) => curr.toLowerCase() === it.toLowerCase())) {
          if (it.match(/зелье|ключ|свиток|меч|амулет|кольцо|рунный|кинжал|доспех|щит|трофей|камень|кристалл|эликсир|фонарь|оберег|талисман|посох/i)) {
            parsed.state_update.added_items.push(it);
          }
        }
      }
    }
  }

  // Determine acting player name from actionText fallback if not found yet
  if (!actionAuthorName || /совместн|раунд|отряд|действи/i.test(actionAuthorName)) {
    actionAuthorName = '';
    const fallbackAuthorMatch = actionText.match(/\[(?:Ход игрока|Игрок(?:\s+\d+)?):\s*"?([^"|\]\n:]+)"?/i);
    if (fallbackAuthorMatch && fallbackAuthorMatch[1] && !/совместн|раунд|отряд|действи/i.test(fallbackAuthorMatch[1])) {
      actionAuthorName = fallbackAuthorMatch[1].replace(/^(?:Воин|Маг|Плут|Жрец|Паладин|Следопыт|Варвар|Бард|Друид|Колдун|Чародей|Монах)\s+/i, '').trim();
    }
  }
  if (!actionAuthorName && partyPlayers.length > 0) {
    actionAuthorName = partyPlayers[0].character?.name || partyPlayers[0].name || '';
  }

  // 5. If player has just performed a roll (action contains dice emoji or roll result), ensure we don't immediately force another roll unless LLM explicitly requested it
  const isAlreadyRoll =
    actionText.includes('[бросок') ||
    actionText.includes('[свободный бросок') ||
    actionText.includes('[проверка') ||
    actionText.includes('🎲') ||
    actionText.includes('итог:') ||
    actionText.includes('итого:') ||
    actionText.includes('d20 =');

  if (isAlreadyRoll && parsed.requires_roll) {
    // If the player just rolled to resolve a previous check, default needed to false so players can freely play and dialogue
    // unless the DM narrative explicitly demands an immediate second saving throw/reaction
    if (!text.match(/(?:сделайте|совершите|бросьте|проверка)\s+(?:спасбросок|бросок|проверку|атаку)/i)) {
      parsed.requires_roll.needed = false;
    }
  }

  // 6. Targeted Multiplayer Roll Resolution & Multi-Rolls (Array of Rolls)
  if (!parsed.required_rolls) {
    parsed.required_rolls = [];
  }

  if (parsed.requires_roll && parsed.requires_roll.needed) {
    const rawTarget = (parsed.requires_roll.target_character_name || '').trim();
    if (!rawTarget || /совместн|раунд|отряд|действи/i.test(rawTarget)) {
      if (actionAuthorName && !/совместн|раунд|отряд|действи/i.test(actionAuthorName)) {
        parsed.requires_roll.target_character_name = actionAuthorName;
      } else if (partyPlayers.length > 0) {
        parsed.requires_roll.target_character_name = partyPlayers[0].character?.name || partyPlayers[0].name || 'Герой';
        parsed.requires_roll.target_character_id = partyPlayers[0].id;
      } else if (currentCharacter?.name) {
        parsed.requires_roll.target_character_name = currentCharacter.name;
        parsed.requires_roll.target_character_id = currentCharacter.id || 'player';
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
        parsed.requires_roll.target_character_name = matchedPlayer.character?.name || matchedPlayer.name;
      } else if (partyPlayers.length > 0 && /совместн|раунд|отряд|действи/i.test(targetNameLower)) {
        parsed.requires_roll.target_character_id = partyPlayers[0].id;
        parsed.requires_roll.target_character_name = partyPlayers[0].character?.name || partyPlayers[0].name;
      }
    }

    if (!parsed.requires_roll.advantage_type) {
      parsed.requires_roll.advantage_type = 'normal';
    }

    // Ensure it exists in required_rolls
    const reqItem = parsed.requires_roll as DmRollRequest;
    const exists = parsed.required_rolls.some(
      (r) => r.target_character_id === reqItem.target_character_id && r.reason === reqItem.reason
    );
    if (!exists) {
      parsed.required_rolls.unshift({
        needed: true,
        target_character_id: reqItem.target_character_id || actingPlayerId || 'player',
        target_character_name: reqItem.target_character_name || actionAuthorName || 'Герой',
        roll_type: (reqItem.roll_type as any) || 'skill_check',
        ability: (reqItem.ability as any) || 'STR',
        skill: reqItem.skill,
        dc: reqItem.dc || 12,
        reason: reqItem.reason || 'Проверка кубика',
        advantage_type: reqItem.advantage_type || 'normal',
        is_group_check: reqItem.is_group_check,
        assisted_by_player_id: reqItem.assisted_by_player_id,
      });
    }
  }

  // Ensure every item in required_rolls has valid player attribution
  for (const r of parsed.required_rolls) {
    if (!r.target_character_name || /совместн|раунд|отряд|действи/i.test(r.target_character_name)) {
      if (actionAuthorName && !/совместн|раунд|отряд|действи/i.test(actionAuthorName)) {
        r.target_character_name = actionAuthorName;
      } else if (partyPlayers.length > 0) {
        r.target_character_name = partyPlayers[0].character?.name || partyPlayers[0].name || 'Герой';
        r.target_character_id = partyPlayers[0].id;
      }
    }
    if (r.target_character_name) {
      const tLower = r.target_character_name.toLowerCase().trim();
      const match = partyPlayers.find(
        (p) =>
          p.name.toLowerCase() === tLower ||
          p.character?.name?.toLowerCase() === tLower ||
          tLower.includes(p.name.toLowerCase()) ||
          (p.character?.name && tLower.includes(p.character.name.toLowerCase()))
      );
      if (match) {
        r.target_character_id = match.id;
        r.target_character_name = match.character?.name || match.name;
      }
    }
    if (!r.target_character_id) {
      r.target_character_id = actingPlayerId || (partyPlayers.length > 0 ? partyPlayers[0].id : 'player');
    }
    if (!r.advantage_type) {
      r.advantage_type = 'normal';
    }
  }

  // Sync back primary roll to requires_roll for single-roll consumers
  if (parsed.required_rolls.length > 0) {
    parsed.requires_roll = {
      ...parsed.required_rolls[0],
      needed: true,
    };
  }

  // 7. P2P Trading / Item Transfer between players
  const transferMatch = actionText.match(/(?:переда(?:ю|ет)|отда(?:ю|ет)|дар(?:ю|ит)|дел(?:юсь|ится))\s+([^.,\n]+?)\s+(?:напарнику|союзнику|игроку|персонажу|товарищу|([А-Яа-яA-Za-z0-9_]+))/i);
  if (transferMatch) {
    const rawItem = transferMatch[1].replace(/(?:сво[ёея]|одно|одну|свой|свои)\s+/i, '').trim();
    const targetNameHint = (transferMatch[2] || '').toLowerCase().trim();
    const receiver = partyPlayers.find(
      (p) =>
        p.id !== actingPlayerId &&
        (targetNameHint ? (p.name.toLowerCase().includes(targetNameHint) || p.character?.name?.toLowerCase().includes(targetNameHint)) : true)
    );

    if (receiver && rawItem && actingPlayerId) {
      if (!parsed.state_update.party_updates![actingPlayerId]) {
        parsed.state_update.party_updates![actingPlayerId] = { removed_items: [] };
      }
      if (!parsed.state_update.party_updates![actingPlayerId].removed_items) {
        parsed.state_update.party_updates![actingPlayerId].removed_items = [];
      }
      if (!parsed.state_update.party_updates![actingPlayerId].removed_items!.includes(rawItem)) {
        parsed.state_update.party_updates![actingPlayerId].removed_items!.push(rawItem);
      }

      if (!parsed.state_update.party_updates![receiver.id]) {
        parsed.state_update.party_updates![receiver.id] = { added_items: [] };
      }
      if (!parsed.state_update.party_updates![receiver.id].added_items) {
        parsed.state_update.party_updates![receiver.id].added_items = [];
      }
      if (!parsed.state_update.party_updates![receiver.id].added_items!.includes(rawItem)) {
        parsed.state_update.party_updates![receiver.id].added_items!.push(rawItem);
      }

      if (!parsed.state_update.p2p_transfers) {
        parsed.state_update.p2p_transfers = [];
      }
      parsed.state_update.p2p_transfers.push({
        from_player_id: actingPlayerId,
        to_player_id: receiver.id,
        item: rawItem,
      });
    }
  }

  // Duplicate general state_update values to actingPlayerId in party_updates
  if (actingPlayerId) {
    if (!parsed.state_update.party_updates![actingPlayerId]) {
      parsed.state_update.party_updates![actingPlayerId] = {};
    }
    const pPatch = parsed.state_update.party_updates![actingPlayerId];
    if (pPatch.hp_change === undefined && parsed.state_update.hp_change !== 0) {
      pPatch.hp_change = parsed.state_update.hp_change;
    }
    if (pPatch.gold_change === undefined && parsed.state_update.gold_change !== 0) {
      pPatch.gold_change = parsed.state_update.gold_change;
    }
    if ((!pPatch.added_items || pPatch.added_items.length === 0) && parsed.state_update.added_items?.length) {
      pPatch.added_items = [...parsed.state_update.added_items];
    }
    if ((!pPatch.removed_items || pPatch.removed_items.length === 0) && parsed.state_update.removed_items?.length) {
      pPatch.removed_items = [...parsed.state_update.removed_items];
    }
  }

  // 8. Strict D&D 5e Rest action duration (Exact 60 min Short Rest, 480 min Long Rest for ALL difficulties)
  const combinedActionAndText = `${actionText} ${text}`.toLowerCase();
  const isShortRest = /(?:короткий\s+отдых|привал|короткая\s+передышка|перевести\s+дух|отдыха(?:ем|ет|ют)\s+1\s+час)/i.test(combinedActionAndText);
  const isLongRest = /(?:длительный\s+отдых|долгий\s+отдых|ночлег|ночуем|разбива(?:ем|ет|ют)\s+лагерь|ночной\s+сон|спим\s+ночью|отдых\s+8\s+часов)/i.test(combinedActionAndText);

  if (isLongRest) {
    parsed.state_update.time_passed_minutes = Math.max(
      parsed.state_update.time_passed_minutes || 0,
      DND_REST_CONSTANTS.LONG_REST_MINUTES
    );
    if (!parsed.state_update.spell_slots_recovered) {
      parsed.state_update.spell_slots_recovered = { all: true };
    }
  } else if (isShortRest) {
    parsed.state_update.time_passed_minutes = Math.max(
      parsed.state_update.time_passed_minutes || 0,
      DND_REST_CONSTANTS.SHORT_REST_MINUTES
    );
  }

  // 8. High Precision Adaptive Time parser
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

  // 9. Ensure active_combat & suggested_actions structures are present
  if (!parsed.active_combat) {
    parsed.active_combat = {
      is_active: false,
      round: 0,
      enemies: [],
    };
  }
  if (!parsed.suggested_actions || !Array.isArray(parsed.suggested_actions) || parsed.suggested_actions.length === 0) {
    parsed.suggested_actions = ['Осмотреться вокруг', 'Прислушаться', 'Двигаться дальше'];
  }

  // 9.5. Fallback parsing for XP from narrative text if not explicitly provided
  if (!parsed.state_update.xp_change) {
    const xpMatch = text.match(/(?:\+|\bполуча(?:ете|ет|ют)\s+)?(\d{2,5})\s*(?:XP|EXP|хп\s+опыта|опыта|ед(?:\.|иниц)?\s+опыта)\b/i);
    if (xpMatch && xpMatch[1]) {
      const parsedXp = parseInt(xpMatch[1], 10);
      if (!isNaN(parsedXp) && parsedXp > 0) {
        parsed.state_update.xp_change = parsedXp;
      }
    }
  }

  // 10. Co-op / Party XP distribution & D&D 5e In-Combat Level Up Rule
  // (Level up is strictly deferred if active_combat.is_active is true)
  const isCombatActive = Boolean(parsed.active_combat?.is_active);
  const totalXpAwarded = parsed.state_update.xp_change || 0;

  if (partyPlayers && partyPlayers.length > 0) {
    // If encounter XP was awarded, divide it equally among all alive party players
    if (totalXpAwarded > 0) {
      const splitXp = distributePartyXp(totalXpAwarded, partyPlayers.length);
      for (const p of partyPlayers) {
        if (!parsed.state_update.party_updates[p.id]) {
          parsed.state_update.party_updates[p.id] = {};
        }
        if (parsed.state_update.party_updates[p.id].xp_change === undefined) {
          parsed.state_update.party_updates[p.id].xp_change = splitXp;
        }
      }
      parsed.state_update.xp_change = splitXp;
    }

    // Process Level Up eligibility for each party member
    for (const p of partyPlayers) {
      if (!p.character) continue;
      const cLevel = p.character.level || 1;
      const cXp = p.character.experience || 0;
      const pGain = parsed.state_update.party_updates[p.id]?.xp_change ?? 0;
      const pending = checkPendingLevelUp(cXp + pGain, cLevel, isCombatActive);

      if (pending.canLevelUp) {
        const cls = CLASS_HIT_DICE[p.character.class];
        if (!parsed.state_update.party_updates[p.id]) {
          parsed.state_update.party_updates[p.id] = {};
        }
        parsed.state_update.party_updates[p.id].level_up_available = {
          new_level: pending.targetLevel,
          hit_die: cls ? `d${cls.die}` : 'd10',
        };
      } else if (parsed.state_update.party_updates[p.id]?.level_up_available) {
        delete parsed.state_update.party_updates[p.id].level_up_available;
      }
    }
  }

  // Check Level Up for host / solo character
  if (currentCharacter) {
    const currentLevel = currentCharacter.level || 1;
    const currentXp = currentCharacter.experience || 0;
    const xpGain = (currentCharacter.id && parsed.state_update.party_updates?.[currentCharacter.id]?.xp_change !== undefined)
      ? parsed.state_update.party_updates[currentCharacter.id].xp_change!
      : (parsed.state_update.xp_change || 0);

    const pending = checkPendingLevelUp(currentXp + xpGain, currentLevel, isCombatActive);
    if (pending.canLevelUp) {
      const cls = CLASS_HIT_DICE[currentCharacter.class];
      parsed.state_update.level_up_available = {
        new_level: pending.targetLevel,
        hit_die: cls ? `d${cls.die}` : 'd10',
      };
    } else {
      delete parsed.state_update.level_up_available;
    }
  }

  // 11. Concentration Check on Damage
  if (currentCharacter?.concentration && typeof parsed.state_update?.hp_change === 'number' && parsed.state_update.hp_change < 0) {
    const dmgTaken = Math.abs(parsed.state_update.hp_change);
    const conDc = Math.max(10, Math.floor(dmgTaken / 2));
    if (!parsed.requires_roll || !parsed.requires_roll.needed) {
      parsed.requires_roll = {
        needed: true,
        target_character_id: currentCharacter.id || 'player',
        target_character_name: currentCharacter.name,
        roll_type: 'saving_throw',
        ability: 'CON',
        dc: conDc,
        reason: `Спасбросок Телосложения (Сл ${conDc}) для удержания концентрации на заклинании «${currentCharacter.concentration.spell_name}» после получения ${dmgTaken} ед. урона`,
        advantage_type: 'normal',
      };
    }
  }

  // 13. Apply Deterministic GM Overrides (God Mode, XP, Gold, Items, Teleport, Kill Combat)
  const gmOverride = parseGmOverrideCommands(actionText, currentCharacter);
  if (gmOverride.hasOverride) {
    const patch = gmOverride.forcedStatePatch;
    if (patch.forceKillCombat) {
      parsed.active_combat = { is_active: false, round: 0, enemies: [] };
    }
    if (patch.forceTeleportLocation) {
      parsed.state_update.location_name = patch.forceTeleportLocation;
    }
    if (patch.forceHealFull && currentCharacter) {
      parsed.state_update.hp_change = Math.max(0, currentCharacter.maxHp - currentCharacter.currentHp);
    }
    if (typeof patch.hp_change === 'number') {
      parsed.state_update.hp_change = patch.hp_change;
    }
    if (typeof patch.xp_change === 'number') {
      parsed.state_update.xp_change = patch.xp_change;
      if (partyPlayers && partyPlayers.length > 0) {
        for (const p of partyPlayers) {
          if (!parsed.state_update.party_updates[p.id]) parsed.state_update.party_updates[p.id] = {};
          parsed.state_update.party_updates[p.id].xp_change = patch.xp_change;
        }
      }
    }
    if (typeof patch.gold_change === 'number') {
      parsed.state_update.gold_change = (parsed.state_update.gold_change || 0) + patch.gold_change;
    }
    if (patch.added_items && patch.added_items.length > 0) {
      parsed.state_update.added_items = Array.from(new Set([...(parsed.state_update.added_items || []), ...patch.added_items]));
    }
    if (patch.removed_items && patch.removed_items.length > 0) {
      parsed.state_update.removed_items = Array.from(new Set([...(parsed.state_update.removed_items || []), ...patch.removed_items]));
    }
    if (patch.forceRollAutoPass) {
      parsed.requires_roll = { needed: false };
      parsed.required_rolls = [];
    }
    if (patch.spell_slots_recovered) {
      parsed.state_update.spell_slots_recovered = patch.spell_slots_recovered;
    }
    if (patch.conditions_removed && patch.conditions_removed.length > 0) {
      parsed.state_update.conditions_removed = Array.from(new Set([...(parsed.state_update.conditions_removed || []), ...patch.conditions_removed]));
    }
    if (patch.time_passed_minutes) {
      parsed.state_update.time_passed_minutes = patch.time_passed_minutes;
    }
    if (patch.forceLevelUpAvailable && currentCharacter) {
      const cls = CLASS_HIT_DICE[currentCharacter.class];
      parsed.state_update.level_up_available = {
        new_level: (currentCharacter.level || 1) + 1,
        hit_die: cls?.die ? `d${cls.die}` : 'd10',
      };
    }
  }

  return parsed;
}

function parseJsonResponse(
  raw: string,
  currentCharacter?: CharacterSheet,
  actionText: string = '',
  currentDay: number = 1,
  currentMinutes: number = 480,
  partyPlayers: Array<{ id: string; name: string; character: CharacterSheet }> = [],
  difficulty?: GameDifficulty | string
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
    return enrichStateUpdateFromNarrative(parsed as DmResponse, raw, currentCharacter, actionText, currentDay, currentMinutes, partyPlayers, difficulty);
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
    return enrichStateUpdateFromNarrative(fallbackObj, raw, currentCharacter, actionText, currentDay, currentMinutes, partyPlayers, difficulty);
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
  partyPlayers: Array<{ id: string; name: string; character: CharacterSheet }> = [],
  difficulty?: GameDifficulty | string
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

  const parsed = parseJsonResponse(content, currentCharacter, actionText, currentDay, currentMinutes, partyPlayers, difficulty);
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

    const isLmStudioActive = Boolean(body.useLmStudio);
    const isOpenRouterActive = body.useOpenRouter !== false;
    const geminiApiKey = (userGeminiApiKey && userGeminiApiKey.trim().length > 0 ? userGeminiApiKey.trim() : '') || process.env.GEMINI_API_KEY || '';
    const rawGeminiModel = (userGeminiModel && userGeminiModel.trim().length > 0 ? userGeminiModel.trim().replace(/^models\//, '') : 'gemini-3.7-flash');
    const geminiModel = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'].includes(rawGeminiModel) ? rawGeminiModel : 'gemini-3.7-flash';
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

    // 2. Build Live Party Roster (Co-op Group of Live Players)
    let partyRosterPrompt = '';
    if (partyPlayers && partyPlayers.length > 0) {
      partyRosterPrompt = `\n[👥 АКТИВНЫЕ ГЕРОИ КООПЕРАТИВНОЙ КАМПАНИИ (ОТРЯД ЖИВЫХ ИГРОКОВ - ${partyPlayers.length} УЧАСТНИКОВ)]:\n` +
        partyPlayers.map((p, idx) => {
          const c = p.character || {};
          const s = c.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
          const fmtM = (val: number) => {
            const m = Math.floor((val - 10) / 2);
            return m >= 0 ? `+${m}` : `${m}`;
          };
          const pWisMod = Math.floor((s.wis - 10) / 2);
          const pIntMod = Math.floor((s.int - 10) / 2);
          const pProf = c.proficiencyBonus || 2;
          const pPassPerc = c.passive_stats?.perception ?? calculatePassiveScore(pWisMod, (c.skillProficiencies || []).includes('Perception'), pProf);
          const pPassIns = c.passive_stats?.insight ?? calculatePassiveScore(pWisMod, (c.skillProficiencies || []).includes('Insight'), pProf);
          const pPassInv = c.passive_stats?.investigation ?? calculatePassiveScore(pIntMod, (c.skillProficiencies || []).includes('Investigation'), pProf);
          const pConc = c.concentration ? ` | 🌀 Концентрация: «${c.concentration.spell_name}»` : '';
          const pPos = c.position ? ` | 📍 Позиция: (${c.position.x}, ${c.position.y})` : '';
          const pTac = c.tactical_position ? ` | 🛡️ Тактическая позиция: [${c.tactical_position}]` : ' | 🛡️ Тактическая позиция: [frontline]';
          const pSlots = c.spellSlots ? ` | 🔮 Ячейки магии: ${JSON.stringify(c.spellSlots)}` : '';

          const saves = (c.savingThrowProficiencies || []).map((sv) => sv.toUpperCase()).join(', ') || 'Базовые';
          const skills = (c.skillProficiencies || []).join(', ') || 'Базовые';
          const pEquipped = c.equippedItems && c.equippedItems.length > 0 ? c.equippedItems.join(', ') : 'Базовое снаряжение';
          const pInv = c.inventory && c.inventory.length > 0 ? c.inventory.join(', ') : 'Пусто';
          return `${idx + 1}. ПЕРСОНАЖ: "${p.name || c.name || 'Герой'}" (ID: "${p.id}") | Класс: ${c.class || 'Воин'} ${c.level || 1} ур. (${c.race || 'Человек'}) | HP: ${c.currentHp || 10}/${c.maxHp || 10}, AC: ${c.ac || 10}${pTac} | СИЛ ${s.str} (${fmtM(s.str)}), ЛОВ ${s.dex} (${fmtM(s.dex)}), ТЕЛ ${s.con} (${fmtM(s.con)}), ИНТ ${s.int} (${fmtM(s.int)}), МУД ${s.wis} (${fmtM(s.wis)}), ХАР ${s.cha} (${fmtM(s.cha)}) | Спасброски: ${saves} | Навыки: ${skills} | 👁️ Пассивные: Внимательность ${pPassPerc}, Проницательность ${pPassIns}, Анализ ${pPassInv}${pConc}${pPos}${pSlots} | 🛡️ Надето: [${pEquipped}] | 🎒 Инвентарь: [${pInv}] | 💰 Золото: ${c.gold || 0} gp`;
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

    const profBonus = character.proficiencyBonus || 2;
    const isPerceptionProf = (character.skillProficiencies || []).includes('Perception');
    const isInsightProf = (character.skillProficiencies || []).includes('Insight');
    const isInvestigationProf = (character.skillProficiencies || []).includes('Investigation');
    const passivePerception = character.passive_stats?.perception ?? calculatePassiveScore(wisMod, isPerceptionProf, profBonus);
    const passiveInsight = character.passive_stats?.insight ?? calculatePassiveScore(wisMod, isInsightProf, profBonus);
    const passiveInvestigation = character.passive_stats?.investigation ?? calculatePassiveScore(intMod, isInvestigationProf, profBonus);
    const concentrationStatus = character.concentration
      ? `Концентрируется на «${character.concentration.spell_name}» (${character.concentration.duration_left_rounds ?? 'несколько'} раундов осталось)`
      : 'Нет';
    const actionEconomyStatus = character.current_action_economy
      ? `Действие: ${character.current_action_economy.action_spent ? 'ПОТРАЧЕНО' : 'доступно'} | Бонусное: ${character.current_action_economy.bonus_action_spent ? 'ПОТРАЧЕНО' : 'доступно'} | Реакция: ${character.current_action_economy.reaction_spent ? 'ПОТРАЧЕНА' : 'доступна'}`
      : 'Все действия раунда доступны';

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
- 👁️ Пассивные чувства D&D 5e: Пассивная внимательность: ${passivePerception} | Пассивная проницательность: ${passiveInsight} | Пассивный анализ: ${passiveInvestigation}
- 🌀 Концентрация: ${concentrationStatus}
- ⚡ Экономика действий в раунде: ${actionEconomyStatus}
- ⚖️ Вес снаряжения: ${character.currentWeight || 55} / ${character.maxCarryWeight || strVal * 15} фунтов
${character.appearance ? `- Внешность: ${character.appearance}` : ''}
${character.personalityTraits ? `- Характер и черты: ${character.personalityTraits}` : ''}
${character.motivation ? `- Цель и мотивация: ${character.motivation}` : ''}
${character.backstory || character.bio ? `- Предыстория: ${character.backstory || character.bio}` : ''}
- 💰 Золото героя: ${character.gold || 0} gp
- 🛡️ НАДЕТОЕ СНАРЯЖЕНИЕ (Оружие в руках, надетая броня, щит): ${equippedList}
- 🎒 РЮКЗАК И РАСХОДНЫЕ ПРЕДМЕТЫ (Зелья, свитки, припасы, не надетое): ${backpackList}`;

    // 5. Master Prompt with Strict Russian Language, D&D 5e Mechanics & JSON Format
    const systemPrompt = `ТЫ — {{char}}, ВЕЛИКИЙ DUNGEON MASTER И РОЛЕВОЙ VTT-ДВИЖОК ПО КАНОНИЧНЫМ ПРАВИЛАМ D&D 5e (DUNGEONS & DRAGONS 5th EDITION) В РЕЖИМЕ ЛОКАЛЬНОГО МУЛЬТИПЛЕЕРА И СОЛО.
Твоя цель — вести глубокую, атмосферную, последовательную песочницу для отряда игроков, обладая АБСОЛЮТНОЙ ПАМЯТЬЮ обо всех событиях, решениях, деталях сюжета, времени суток, спутниках, ячейках заклинаний, состояниях и боевых столкновениях.

[🚨 СТРОЖАЙШИЙ ФОРМАТ ОТВЕТА — ИСКЛЮЧИТЕЛЬНО ЧИСТЫЙ ВАЛИДНЫЙ JSON]:
Ты ОБЯЗАН отвечать ИСКЛЮЧИТЕЛЬНО валидным JSON-объектом указанной структуры.
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать любой вводный текст, прологи, послесловия, технические комментарии или разметку за пределами JSON!

[🇷🇺 КАТЕГОРИЧЕСКИЙ ЯЗЫКОВОЙ ЗАКОН]:
ВЕСЬ ТВОЙ ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ!
Все описания локаций, мысли, прямая речь NPC, названия предметов и варианты действий генерируются исключительно на чистом, богатом русском языке.

[⚔️ ТРЕКЕР БОЯ И ТАКТИЧЕСКАЯ СЕТКА (ACTIVE COMBAT TRACKER & SPATIAL GRID)]:
Когда начинается сражение (засада, нападение монстров, драка в таверне), ты ОБЯЗАН активировать боевой трекер в объекте "active_combat":
- "is_active": true
- "round": номер текущего раунда боя (начиная с 1)
- "current_turn": имя того, чей сейчас ход (персонажа игрока или врага)
- "grid": { "width": 10, "height": 10 } (размер тактической сетки в 5-футовых клетках)
- "enemies": массив всех противников в бою с параметрами:
  * "id": уникальный ID ("goblin_1", "bandit_leader")
  * "name": понятное русское имя ("Гоблин-стрелок", "Главарь разбойников")
  * "hp": текущие очки здоровья противника
  * "max_hp": максимальные очки здоровья
  * "ac": Класс Брони противника (Armor Class)
  * "position": { "x": 4, "y": 2 } (координаты на 5-футовой сетке)
  * "cover": "none" | "half" | "three_quarters" | "full" (укрытие: half = +2 AC, three_quarters = +5 AC)
  * "conditions": массив наложенных состояний (например: ["Prone", "Poisoned"])
  * "resistances": массив сопротивлений урону (например: ["fire"])
  * "vulnerabilities": массив уязвимостей (например: ["radiant"])
Когда все враги побеждены, сдались или бежали — переведи "is_active": false и очисти список врагов.

[📐 ПРОСТРАНСТВО, СЕТКА, ДИСТАНЦИИ И УКРЫТИЯ (SPATIAL GRID & COVER)]:
1. Тактическая 5-футовая сетка: 1 клетка = 5 футов (1.5 метра).
2. Дистанции атак:
   - Ближний бой: 5 футов (1 клетка). Оружие с досягаемостью (Reach, например алебарда/пика) — 10 футов (2 клетки).
   - Стрельба и дальнобойная магия в упор: если стрелок или заклинатель совершает дальнобойную атаку, находясь в пределах 5 футов от дееспособного врага, бросок атаки совершается С ПОМЕХОЙ (disadvantage)!
3. Укрытия (Cover):
   - Половинное укрытие (Half Cover: бочки, столы, парапет, тело союзника/врага): +2 к Классу Брони (AC) и спасброскам Ловкости.
   - Укрытие на три четверти (Three-quarters Cover: бойница, угол массивной стены, тяжелая решетка): +5 к Классу Брони (AC) и спасброскам Ловкости.
   - Полное укрытие (Full / Total Cover): цель полностью скрыта препятствием, её нельзя атаковать напрямую или выбрать целью направленного заклинания.

[⚡ ЭКОНОМИКА ДЕЙСТВИЙ И РЕАКЦИИ (ACTION ECONOMY & REACTIONS)]:
1. Структура хода в раунде:
   - 1 Основное действие (Action): Атака, Сотворение заклинания, Рывок (Dash), Отход (Disengage), Уклонение (Dodge), Помощь (Help), Использование предмета.
   - 1 Бонусное действие (Bonus Action): быстрое заклинание (Misty Step, Healing Word), атака вторым оружием, классовая фича (Cunning Action).
   - 1 Реакция (Reaction) за раунд: Провоцированная атака (Opportunity Attack), заклинания-реакции (Shield, Hellish Rebuke, Counterspell).
   - Перемещение (Move): в пределах базовой скорости героя (обычно 30 фт / 6 клеток).
2. Ограничение заклинаний бонусного действия (PHB p.202):
   Если персонаж сотворил заклинание бонусным действием, единственное заклинание, которое он может сотворить в этот же ход основным действием — это ЗАГОВОР (cantrip) со временем сотворения 1 действие! Нельзя колдовать два ячеечных заклинания за один ход!
3. Провоцированная атака (Opportunity Attack):
   Если существо покидает зону досягаемости противника (выходит из радиуса 5 футов) БЕЗ использования действия «Отход» (Disengage), противник немедленно совершает реакцией провоцированную атаку ближнего боя!
   В таком случае выставляй "opportunity_attack_triggered": true в state_update.

[🌀 КОНЦЕНТРАЦИЯ, ТИПЫ УРОНА И СОПРОТИВЛЕНИЯ (CONCENTRATION & DAMAGE TYPES)]:
1. Правило одной концентрации:
   Персонаж может концентрироваться ТОЛЬКО НА ОДНОМ заклинании одновременно (Bless, Hex, Hunter's Mark, Invisibility и т.д.). Сотворение нового заклинания с концентрацией МГНОВЕННО прекращает предыдущее!
2. Проверка концентрации при получении урона:
   Каждый раз, когда концентрирующийся персонаж получает урон, он обязан пройти спасбросок Телосложения со Сложностью DC = max(10, floor(урон / 2)). При провале концентрация срывается: укажи "concentration_update": { "action": "break" } в state_update! При успешном сохранении: "concentration_update": { "action": "maintain" }.
3. Типы урона и расчет:
   Урон бывает физическим (slashing, piercing, bludgeoning) и стихийным/магическим (fire, cold, lightning, thunder, acid, poison, necrotic, radiant, force, psychic).
   - Сопротивление (Resistance): урон делится на 2 (floor(damage / 2)).
   - Уязвимость (Vulnerability): урон удваивается (damage * 2).
   - Иммунитет (Immunity): урон равен 0.
   Отражай нанесенный тип урона в "damage_details": { "amount": 8, "type": "fire" } в state_update.

[🏆 НАЧИСЛЕНИЕ ОПЫТА И LEVEL UP ВНЕ БИТВЫ (D&D 5e XP ENGINE)]:
1. ИСТОЧНИКИ НАЧИСЛЕНИЯ ОПЫТА (XP):
   - Победа над противниками: убийство, бегство, пленение или успешный скрытный обход врагов (Гоблин 50 XP, Скелет 50 XP, Зомби 50 XP, Орк 100 XP, Лютоволк 200 XP, Главарь бандитов 450 XP, Огр 450 XP, Тролль 1800 XP).
   - Небоевые вызовы (Non-combat Encounters):
     * Обезвреживание и обход смертоносных ловушек (25–100 XP).
     * Социальные успехи: успешные переговоры, раскрытие лжи, примирение враждующих сторон (50–200 XP).
     * Разгадка древних тайн, головоломок и обнаружение скрытых локаций (50–250 XP).
     * Выполнение сюжетных заданий и спасение заложников (100–500 XP).
2. РАСПРЕДЕЛЕНИЕ ОПЫТА В КООПЕРАТИВЕ (PARTY SPLIT):
   - Общий заработанный опыт делится ПОРОВНУ между всеми живыми участниками отряда.
   - В кооперативном режиме указывай опыт каждому персонажу в "party_updates":
     "party_updates": {
       "player_id_1": { "xp_change": 50 },
       "player_id_2": { "xp_change": 50 }
     }
3. СТРОГОЕ ПРАВИЛО: LEVEL UP ТОЛЬКО ВНЕ БИТВЫ (D&D 5e RULES):
   - Повышение уровня (Level Up) происходит ИСКЛЮЧИТЕЛЬНО ВНЕ БОЕВОЙ СХВАТКИ (когда "active_combat.is_active": false).
   - Если нужный порог XP преодолен прямо посреди боя, переход на новый уровень СТРОГО ОТКЛАДЫВАЕТСЯ до полного завершения битвы! НЕ выставляй "level_up_available", пока "active_combat.is_active" равен true.
   - В раунде, когда последний враг повержен или бой окончен ("active_combat.is_active": false), немедленно выстави "level_up_available": { "new_level": 2, "hit_die": "d10" } и красочно опиши в narrative триумф и готовность героев раскрыть новые классовые силы!
4. ПОРОГИ ОПЫТА D&D 5e:
   1 ур. -> 2 ур. (300 XP), 2 ур. -> 3 ур. (900 XP), 3 ур. -> 4 ур. (2700 XP), 4 ур. -> 5 ур. (6500 XP), 5 ур. -> 6 ур. (14000 XP).

[👁️ ПАССИВНЫЕ ПРОВЕРКИ И СОЦИАЛЬНЫЕ ПОРОГИ DMG (PASSIVE PERCEPTION & SOCIAL THRESHOLDS)]:
1. Пассивная Внимательность (Passive Perception) и Пассивный Анализ (Passive Investigation):
   Каждый персонаж имеет базовое пассивное восприятие (10 + МУД/ИНТ + Мастерство).
   МАСТЕР ОБЯЗАН АВТОМАТИЧЕСКИ сравнивать Пассивную Внимательность героя со сложностью (DC) скрытых ловушек, засад и замаскированных дверей!
   - Если Пассивная Внимательность героя >= DC ловушки/засады: он АВТОМАТИЧЕСКИ замечает угрозу ДО броска кубика! Опиши, как его острый взгляд подмечает натянутую леску или подозрительную фигуру в тени.
   - Запрашивай активный бросок проверки кубика ("requires_roll": { "needed": true, ... }) ТОЛЬКО когда игрок САМ объявляет активный и целенаправленный поиск!
2. Социальные пороги взаимодействия по DMG (Dungeon Master's Guide p.245):
   Отношение NPC влияет на сложность проверок Убеждения (Persuasion), Обмана (Deception) и Запугивания (Intimidation):
   - Враждебный (Hostile): DC 20 для прекращения боя или уступки с риском для NPC; DC 10 для отказа от немедленной агрессии.
   - Нейтральный / Равнодушный (Neutral): DC 10 для базовой помощи или информации без риска; DC 20 для действий, требующих затрат или риска со стороны NPC.
   - Дружественный (Friendly): DC 0 для искренней помощи без риска; DC 10 для существенной помощи; DC 20 для готовности пойти на жертвы ради персонажей.

[🔮 КОНТРОЛЬ МАГИИ И ЯЧЕЕК ЗАКЛИНАНИЙ (SPELL SLOTS CONTROL)]:
1. Заговоры (cantrips) 0-го уровня не расходуют ячейки заклинаний и могут сотворяться свободно.
2. Заклинания 1-го уровня и выше КАТЕГОРИЧЕСКИ ТРЕБУЮТ наличия свободных ячеек заклинаний у персонажа!
   Если у заклинателя закончились ячейки требуемого уровня (0 ячеек) — сотворить заклинание НЕВОЗМОЖНО. Опиши, как герой пытается сплести плетение магии, но чувствует магическое истощение!
3. При успешном сотворении заклинания 1-го уровня или выше ОБЯЗАТЕЛЬНО укажи потраченную ячейку в "spell_slots_used" внутри state_update (например: "spell_slots_used": { "1": 1 }).
4. При длительном отдыхе (Long Rest) ячейки заклинаний восстанавливаются: укажи "spell_slots_recovered": { "all": true } в state_update!

[☣️ МЕХАНИКА СОСТОЯНИЙ И ЭФФЕКТОВ D&D 5e (CONDITIONS)]:
Учитывай и управляй состояниями героев и врагов через "conditions_added" и "conditions_removed" в state_update:
- Отравлен (Poisoned): помеха (disadvantage) на броски атак и проверки характеристик.
- Ослеплен (Blinded): атаки ослепленного совершаются с помехой (disadvantage), а атаки по нему — с преимуществом (advantage).
- Сбит с ног (Prone): существо лежит; атаки по нему в упор (до 5 футов) совершаются с преимуществом (advantage).
- Парализован (Paralyzed) / Оглушен (Stunned) / Без сознания (Unconscious): существо недееспособно, а любые попадания атак в упор (до 5 фт) автоматически становятся КРИТИЧЕСКИМИ УДАРАМИ!

[💀 ПРАВИЛО 0 HP И СПАСБРОСКИ ОТ СМЕРТИ (DEATH SAVES)]:
- Когда HP героя опускается до 0, он падает без сознания (Unconscious, Prone) и должен совершать спасброски от смерти (Death Saves, DC 10).
- 3 успеха — стабилизация. 3 провала — смерть.
- В режиме «Хардкор» враги действуют безжалостно: они атакуют лежачих при 0 HP, нанося автоматические критические удары (каждый удар в упор по лежачему герою при 0 HP наносит сразу ДВА автоматических провала спасброска от смерти!).

[👁️ ТЕЛЕГРАФИРОВАНИЕ УГРОЗ И ИНТУИЦИЯ (TELEGRAPHING THREATS)]:
NPC, разбойники и чудовища могут хитрить, лгать, заманивать в ловушки и нападать из засады, НО Мастер ОБЯЗАН соблюдать справедливость:
- Всегда давай тонкие подсказки в описании окружения (скрип половицы, неестественная тишина птиц, странные царапины на камне, бегающий взгляд трактирщика, запах серы или гари).
- Запрашивай проверки Внимательности (Perception) или Проницательности (Insight) ДО внезапного удара врагов, давая персонажам честный шанс заметить ловушку или ложь и избежать засады!

[🎯 МЕХАНИКА ПРЕИМУЩЕСТВА И ПОМЕХИ (ADVANTAGE / DISADVANTAGE)]:
Когда запрашиваешь бросок кубика ("requires_roll": {"needed": true, ...}):
- Если герой имеет тактическое превосходство (атака из невидимости, по лежачему врагу, помощь союзника) — указывай "advantage_type": "advantage" (бросок 2d20, берется лучший результат).
- Если герой скован, отравлен, ослеплен, перегружен или в невыгодных условиях — указывай "advantage_type": "disadvantage" (бросок 2d20, берется худший результат).
- В обычных условиях указывай "advantage_type": "normal".

[🛡️ АВТОМАТИЧЕСКИЙ ПРОСЧЕТ НАДЕТОГО СНАРЯЖЕНИЯ НЕЙРОСЕТЬЮ]:
- Персонаж экипирован: [${equippedList}]. Его Класс Брони (AC): ${character.ac || 10}.
- Игрок НЕ нажимает кнопки атак вручную в интерфейсе. ТЫ САМ ОБЯЗАН видеть всё надетое снаряжение персонажа и детально просчитывать бои и сцены исходя из него!
- В бою описывай атаки героя именно тем оружием, которое экипировано у него в руках. При вражеских атаках учитывай надетую броню и щит: описывай, как удары монстров лязгают о металл брони или блокируются щитом, если атака не пробивает AC ${character.ac || 10}.

[⏰ КАНОНИЧЕСКИЙ УЧЕТ ВРЕМЕНИ (МИНУТЫ, ЧАСЫ, ДНИ)]:
В этой системе НЕТ секунд. Минимальная единица времени — 1 минута.
Ты ОБЯЗАН списывать затраченное время целыми минутами в поле "time_passed_minutes":
- КОРОТКИЙ ОТДЫХ: Всегда занимает РОВНО 60 минут (1 час) вне зависимости от сложности ("time_passed_minutes": 60).
- ДЛИННЫЙ ОТДЫХ: Всегда занимает РОВНО 480 минут (8 часов) вне зависимости от сложности ("time_passed_minutes": 480).
- ПАРАЛЛЕЛЬНЫЕ ДЕЙСТВИЯ: В совместном раунде время НЕ удваивается. Если оба героя 10 минут обыскивали комнату — списывай 10 минут. Если один ждал, пока второй крался — списывай максимум из двух действий.
- БОЕВАЯ СХВАТКА: Любой бой длится минимум 1 минуту ("time_passed_minutes": 1). Затяжной бой = 2–5 минут.
- БЫСТРЫЕ ДЕЙСТВИЯ: Выпить зелье, беглый диалог, взлом замка, выбить дверь = 1 минута.
- ВДУМЧИВОЕ ИССЛЕДОВАНИЕ: Обыск комнаты, разгадка головоломки, допрос = 10–15 минут.
- ПЕРЕДВИЖЕНИЕ:
  * Переход между кварталами: 15–30 минут.
  * Поход по дороге: 1 лига (3 мили) = 60 минут (1 час).
  * Переход через чащу/горы/болото: 1 лига = 120 минут (2 часа).
- РАСХОДНЫЕ ЭФФЕКТЫ:
  * Факел горит ровно 60 минут (1 час) суммарного игрового времени. Списывай в removed_items по истечении.
  * Заклинания на 1 минуту действуют только в рамках одной сцены/боя.
- СМЕНА СУТОК: Время транслируется в часы и дни (new_time, new_day). Описывай утро, зенит, сумерки, ночную тьму и усталость от бодрствования более 16 часов.

[👥 ОБРАБОТКА СОВМЕСТНОГО ХОДА ОТРЯДА]:
Ты получаешь единый блок заявок от ВСЕХ участников партии.
- Твой ответ (narrative) ОБЯЗАН одновременно и последовательно отражать действия КАЖДОГО игрока в рамках одной сцены.
- Описывай, как действия героев дополняют друг друга, мешают или происходят параллельно.
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО игнорировать действие любого из игроков.

[🎲 ПРАВИЛА БРОСКОВ КУБИКОВ И ТЕМП ИГРЫ (DICE ROLLS PACING)]:
1. НЕ СПАМЬ БРОСКАМИ КУБИКОВ! В большинстве ситуаций (разговоры с NPC, вопросы жрецам/торговцам, осмотр залов, переход по безопасной дороге, передача предметов, планирование) бросок кубика НЕ ТРЕБУЕТСЯ! В таких случаях возвращай:
   "requires_roll": { "needed": false },
   "required_rolls": []
   Давай игрокам свободно общаться, узнавать сюжет, исследовать мир и отыгрывать своих персонажей.
2. КОГДА БРОСОК ДЕЙСТВИТЕЛЬНО НУЖЕН:
   Запрашивай бросок ("needed": true) ТОЛЬКО когда действие сопряжено с явной опасностью, атакой противника, уклонением от ловушки, попыткой взлома сложного механизма или острым конфликтом, где провал влечет за собой конкретный урон или сюжетный тупик.
3. ПОСЛЕ БРОСКА ИГРОКА (RESOLVING ROLLS):
   Если игрок в своем сообщении прислал результат броска (например "🎲 [Бросок...]: d20 (14) + 1 = 15"), ты ОБЯЗАН:
   - Описать исход и последствия этой проверки в тексте narrative;
   - Установить "requires_roll": { "needed": false } и "required_rolls": [];
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО сразу же в ответ требовать новый бросок кубика! Дай игрокам перевести дух, отреагировать на исход и свободно выбрать следующее действие!
4. ПОСТАНОВКА ДЕЙСТВИЯ (NARRATIVE ROLL SETUP):
   Когда бросок реально необходим, опиши в narrative завязку и напряжение момента, приложи required_rolls БЕЗ объявления финального исхода.
   В "target_character_name" и "target_character_id" указывай ТОЛЬКО конкретное реальное имя и ID персонажа (например "Торин" или "Педагог"). НИКОГДА не пиши сюда названия раундов или слово "отряд"!

[🎲 МУЛЬТИ-БРОСКИ И МЕХАНИКА «ПОМОЩИ» (HELP ACTION & GROUP CHECKS)]:
1. Если несколько игроков одновременно совершают рискованные действия, возвращай массив "required_rolls" с отдельным элементом для каждого участника с их личными "target_character_id" и "target_character_name".
2. Если один игрок пишет «помогаю напарнику [действие]»:
   - НЕ требуй отдельный бросок от помощника, если ситуация тривиальна.
   - Выдавай бросок основному игроку со значением "advantage_type": "advantage" и укажи "assisted_by_player_id": "ID_помощника".
3. Если оба игрока одновременно крадутся/прячутся — помечай проверку как "is_group_check": true.

[📍 ПОЗИЦИОНИРОВАНИЕ И ЗОНЫ ПОРАЖЕНИЯ (FRIENDLY FIRE)]:
1. Учитывай тактические позиции героев:
   - "frontline" (авангард) — принимает на себя атаки врагов в ближнем бою;
   - "backline" (прикрытие/тыл) — маги и стрелки на безопасной дистанции;
   - "stealth" (скрытность) — действует из засады/теней с преимуществом на скрытность;
   - "separated" (отделился) — находится в другой комнате/зоне.
2. Если герои имеют статус "separated", они не могут помогать друг другу действием Help, обмениваться предметами или переговариваться шёпотом без заклинаний связи!
3. ЗАКЛИНАНИЯ ПО ПЛОЩАДИ И ДРУЖЕСКИЙ ОГОНЬ (Friendly Fire):
   При сотворении заклинаний по площади (Огненный шар, Громовая волна, Руки Хадара) учитывай позиции союзников. Если напарник находится в радиусе поражения, ОБЯЗАТЕЛЬНО назначай спасбросок и союзнику в required_rolls и списывай HP при провале (за исключением заклинателей школы Воплощения со способностью Sculpt Spells).

[🔄 ОБМЕН ВЕЩАМИ И БАНК ЛАГЕРЯ (P2P TRADING & CAMP STASH)]:
1. При передаче предметов или золота между игроками («отдаю зелье напарнику», «делюсь 10 gp»):
   ОБЯЗАТЕЛЬНО списывай предмет у дарителя и добавляй получателю в "party_updates":
   "party_updates": {
     "ID_Дарителя": { "removed_items": ["Зелье лечения"] },
     "ID_Получателя": { "added_items": ["Зелье лечения"] }
   }
   и отражай в "p2p_transfers": [{ "from_player_id": "...", "to_player_id": "...", "item": "Зелье лечения" }].
2. При сбросе тяжелых вещей в лагерь или на лошадь перемещай их в "camp_stash_updates.added_items", удаляя из инвентаря персонажа.

[🤫 ПРИВАТНЫЕ ДЕЙСТВИЯ И ТАЙНЫЕ ЗНАНИЯ (WHISPERS & SECRET KNOWLEDGE)]:
Если действие одного игрока скрытно от напарника (карманная кража, тайный осмотр знака, телепатический шёпот):
- В общем "narrative" опиши картину для всех присутствующих нейтрально.
- В массиве "private_narratives" сформируй скрытое сообщение только для целевого игрока:
  "private_narratives": [{ "target_player_id": "player_id", "text": "Ты незаметно прячешь перстень в сапог..." }]

[❤️ СПАСЕНИЕ, ПЕРВАЯ ПОМОЩЬ И 0 HP (REVIVE & FIRST AID)]:
Когда союзник падает без сознания при 0 HP:
1. «Первая помощь»: требует проверку Медицины (DC 10) от напарника ("required_rolls" с ability "WIS", skill "Medicine"). При успехе союзник стабилизируется (0 HP, спасброски прекращаются).
2. «Набор целителя»: автоматическая стабилизация союзника без броска (списать заряд набора целителя в removed_items).
3. Зелье лечения или исцеляющее заклинание на союзника: немедленный подъем на ноги с восстановленным запасом HP.

[🎁 ОБЩИЙ ПУЛ ДОБЫЧИ (UNCLAIMED LOOT)]:
При обнаружении сокровищницы, тайника или богатого сундука не отдавай всё случайно одному персонажу.
Помещай найденные ценности в массив "unclaimed_loot":
"unclaimed_loot": [{ "id": "loot_1", "name": "Серебряный кубок", "type": "gem", "count": 1 }]
Игроки в следующих репликах сами решат, кто что забирает, после чего ты переведешь предметы в party_updates.added_items.


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
  "suggested_actions": [
    "Атаковать ближайшего врага экипированным оружием",
    "Сотворить заклинание или применить способность",
    "Осмотреть окружение в поисках тактического укрытия"
  ],
  "requires_roll": {
    "needed": true,
    "target_character_name": "Торгрим",
    "target_character_id": "player_id",
    "roll_type": "skill_check",
    "ability": "STR",
    "skill": "Athletics",
    "dc": 14,
    "reason": "Проверка Атлетики (STR) для взлома двери",
    "advantage_type": "normal"
  },
  "required_rolls": [
    {
      "target_character_name": "Торгрим",
      "target_character_id": "player_id_1",
      "roll_type": "skill_check",
      "ability": "STR",
      "skill": "Athletics",
      "dc": 14,
      "reason": "Проверка Атлетики (STR) для выбивания двери",
      "advantage_type": "advantage",
      "assisted_by_player_id": "player_id_2"
    }
  ],
  "party_updates": {
    "player_id_1": {
      "hp_change": 0,
      "removed_items": ["Отмычка"]
    },
    "player_id_2": {
      "hp_change": 0,
      "added_items": ["Факел"]
    }
  },
  "unclaimed_loot": [
    { "id": "loot_1", "name": "Зелье лечения (2d4+2)", "type": "potion", "count": 2 }
  ],
  "private_narratives": [
    { "target_player_id": "player_id_2", "text": "Пока Торгрим ломится в дверь, ты замечаешь скрытый символ воровской гильдии на косяке..." }
  ],
  "state_update": {
    "hp_change": 0,
    "gold_change": 0,
    "xp_change": 50,
    "added_items": [],
    "removed_items": [],
    "spell_slots_used": {},
    "spell_slots_recovered": { "all": false },
    "conditions_added": [],
    "conditions_removed": [],
    "location_name": "Название текущей локации",
    "time_passed_minutes": 1,
    "new_time": "18:00"
  },
  "active_combat": {
    "is_active": false,
    "round": 0,
    "enemies": []
  },
  "nearby_npcs": []
}

[⚡ ПРАВИЛА ОБНОВЛЕНИЯ ЛИСТА ПЕРСОНАЖА И ВРЕМЕНИ В STATE_UPDATE И PARTY_UPDATES]:
1. КАНОНИЧЕСКОЕ ИГРОВОЕ ВРЕМЯ ("time_passed_minutes" и "new_time"): Только целые минуты, никаких секунд! Отдых: 60 мин (короткий), 480 мин (длинный).
2. АДРЕСНОЕ РАСПРЕДЕЛЕНИЕ ("party_updates"): Изменения каждого конкретного персонажа записывай строго в party_updates[player_id].
3. УРОН И ЛЕЧЕНИЕ: Отрицательное число при уроне (например: "hp_change": -6), положительное при лечении ("hp_change": 8).
4. ПРЕДМЕТЫ И ЗОЛОТО: Добавляй лут в "added_items", расходники в "removed_items", золото в "gold_change".
5. ЯЧЕЙКИ И СОСТОЯНИЯ: Списывай слоты в "spell_slots_used", восстанавливай в "spell_slots_recovered", накладывай/снимай эффекты в "conditions_added" / "conditions_removed".
6. НАГРАДА ЗА ОПЫТ D&D 5e ("xp_change"): Всегда награждай отряд опытом за победы, разгадки тайн и преодоление преград.

[🌍 СЕТТИНГ И АТМОСФЕРА МИРА]:
- Сеттинг: ${world.customSetting || 'Классическое темное фэнтези Забытых Королевств'}
- Тон повествования: ${world.customTone || 'Героический, с элементами опасности и тайн'}
${world.customRules ? `- Особые правила мира: ${world.customRules}\n` : ''}
${buildDifficultyPrompt(world.difficulty)}
${userCustomPrompt ? `\n[ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ИГРОКА]:\n${userCustomPrompt}` : ''}`;

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
    const depthAnchor = `[СИСТЕМНЫЙ ЯКОРЬ ПАМЯТИ: Ты — Dungeon Master. Игровое время: ${formattedClock} (${timeOfDayDesc}). Пиши СТРОГО на русском языке. СТРОГИЙ ЗАПРЕТ ПРЕДМЕТОВ ИЗ ВОЗДУХА: игрок может использовать ТОЛЬКО то, что есть в его инвентаре/снаряжении. АВТОМАТИЧЕСКИЙ ИНВЕНТАРЬ: Когда игрок соглашается взять предмет или пишет «я беру...», «я взял...», «забираю...», «подбираю...», «покупаю...» — ОБЯЗАТЕЛЬНО добавь этот предмет в state_update.added_items! При расходе предметов указывай их в removed_items. При необходимости броска укажи целевого персонажа в requires_roll.]`;

    if (action && action.trim().length > 0) {
      const gmOverride = parseGmOverrideCommands(action, character);
      let actionContent = `${depthAnchor}\n\n[Действие]: ${action.trim()}`;
      if (gmOverride.hasOverride && gmOverride.directives.length > 0) {
        actionContent += `\n\n${gmOverride.directives.join('\n\n')}`;
      }

      messages.push({
        role: 'user',
        content: actionContent,
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
            response_format: { type: 'json_object' },
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
          'gemini-3.5-flash',
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
              response_format: { type: 'json_object' },
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
                generationConfig: {
                  temperature: 0.75,
                  maxOutputTokens: 3000,
                  responseMimeType: 'application/json',
                },
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
            response_format: { type: 'json_object' },
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
      const errMsg = 'Не удалось получить ответ от нейросети. Проверьте интернет-соединение или настройки выбранных провайдеров (LM Studio / Gemini / OpenRouter) в Настройках.';

      return NextResponse.json(
        {
          error: errMsg,
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
      partyPlayers,
      world.difficulty
    );

    if (!parsedResponse.requires_roll) {
      parsedResponse.requires_roll = { needed: false, advantage_type: 'normal' };
    } else if (parsedResponse.requires_roll.needed && !parsedResponse.requires_roll.advantage_type) {
      parsedResponse.requires_roll.advantage_type = 'normal';
    }

    if (!parsedResponse.required_rolls) {
      parsedResponse.required_rolls = [];
    }
    if (parsedResponse.requires_roll?.needed && parsedResponse.required_rolls.length === 0) {
      parsedResponse.required_rolls.push(parsedResponse.requires_roll as DmRollRequest);
    }

    if (!parsedResponse.unclaimed_loot) {
      parsedResponse.unclaimed_loot = [];
    }

    if (!parsedResponse.private_narratives) {
      parsedResponse.private_narratives = [];
    }

    if (!parsedResponse.suggested_actions || !Array.isArray(parsedResponse.suggested_actions) || parsedResponse.suggested_actions.length === 0) {
      parsedResponse.suggested_actions = ['Осмотреться вокруг', 'Прислушаться', 'Двигаться дальше'];
    }

    if (!parsedResponse.state_update) {
      parsedResponse.state_update = {
        hp_change: 0,
        added_items: [],
        removed_items: [],
        gold_change: 0,
        location_name: 'Текущая зона',
        time_passed_minutes: 15,
        party_updates: {},
        camp_stash_updates: { added_items: [], removed_items: [] },
        p2p_transfers: [],
      };
    }

    if (!parsedResponse.active_combat) {
      parsedResponse.active_combat = {
        is_active: false,
        round: 0,
        enemies: [],
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
