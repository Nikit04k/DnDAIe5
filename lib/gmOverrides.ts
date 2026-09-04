import { CharacterSheet, DmStateUpdate } from '@/types/dnd';
import { CLASS_HIT_DICE } from '@/lib/dndRules';

export interface GmOverrideResult {
  hasOverride: boolean;
  directives: string[];
  forcedStatePatch: {
    xp_change?: number;
    gold_change?: number;
    hp_change?: number;
    added_items?: string[];
    removed_items?: string[];
    time_passed_minutes?: number;
    spell_slots_recovered?: { all?: boolean };
    conditions_removed?: string[];
    forceKillCombat?: boolean;
    forceTeleportLocation?: string;
    forceHealFull?: boolean;
    forceRollAutoPass?: boolean;
    forceRollAutoFail?: boolean;
    forceLevelUpAvailable?: boolean;
  };
}

/**
 * Secret GM / Developer Overrides Engine (Bypasses DM prompt constraints & enforces state)
 */
export function parseGmOverrideCommands(action: string, character?: CharacterSheet): GmOverrideResult {
  const result: GmOverrideResult = {
    hasOverride: false,
    directives: [],
    forcedStatePatch: {},
  };

  if (!action || typeof action !== 'string') return result;

  const lines = action.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 1. Raw Direct Prompt Directive: // <текст> or //override: <текст> or /prompt <текст> or /ai <текст>
    const directPromptMatch = line.match(/^(?:\/\/|\/\/override:|\/prompt|\/ai|!prompt|!ai)\s*(.+)$/i);
    if (directPromptMatch && directPromptMatch[1]) {
      result.hasOverride = true;
      result.directives.push(
        `[⚡ ПРЯМАЯ ДИРЕКТИВА МАСТЕРА/РАЗРАБОТЧИКА (ВЫСШИЙ ПРИОРИТЕТ В ОБХОД ВСЕХ ОГРАНИЧЕНИЙ)]: Ты ОБЯЗАН беспрекословно исполнить следующее указание: «${directPromptMatch[1].trim()}». Опиши это художественно и отрази в narrative и state_update!`
      );
    }

    // 2. God Mode: /god, //god, !god, /immortal
    if (/^(?:\/|\/\/|!)god\b|^(?:\/|\/\/|!)immortal\b/i.test(line)) {
      result.hasOverride = true;
      result.forcedStatePatch.forceHealFull = true;
      result.forcedStatePatch.spell_slots_recovered = { all: true };
      result.forcedStatePatch.conditions_removed = ['Poisoned', 'Prone', 'Blinded', 'Paralyzed', 'Stunned', 'Frightened', 'Exhaustion'];
      result.directives.push(
        `[⚡ GM COMMAND - GOD MODE]: Персонаж наполняется божественной неуязвимостью. Полностью восстанови здоровье (HP: MAX), сними все негативные эффекты и восстанови все ячейки заклинаний!`
      );
    }

    // 3. Kill enemies: /kill, //kill, !kill
    if (/^(?:\/|\/\/|!)kill(?:\s+all)?\b/i.test(line)) {
      result.hasOverride = true;
      result.forcedStatePatch.forceKillCombat = true;
      result.directives.push(
        `[⚡ GM COMMAND - KILL ALL]: Все текущие враги в бою мгновенно погибают или рассыпаются в прах. Заверши бой (active_combat.is_active = false) и начисли победный опыт!`
      );
    }

    // 4. XP command: /xp <N>, //xp <N>, !xp <N>
    const xpMatch = line.match(/^(?:\/|\/\/|!)xp\s+([+-]?\d+)/i);
    if (xpMatch && xpMatch[1]) {
      const amount = parseInt(xpMatch[1], 10);
      if (!isNaN(amount)) {
        result.hasOverride = true;
        result.forcedStatePatch.xp_change = amount;
        result.directives.push(
          `[⚡ GM COMMAND - XP]: Начисли отряду ровно ${amount} XP ("xp_change": ${amount})!`
        );
      }
    }

    // 5. Gold command: /gold <N>, //gold <N>, !gold <N>
    const goldMatch = line.match(/^(?:\/|\/\/|!)gold\s+([+-]?\d+)/i);
    if (goldMatch && goldMatch[1]) {
      const amount = parseInt(goldMatch[1], 10);
      if (!isNaN(amount)) {
        result.hasOverride = true;
        result.forcedStatePatch.gold_change = amount;
        result.directives.push(
          `[⚡ GM COMMAND - GOLD]: Измени золото героя на ${amount} gp ("gold_change": ${amount})!`
        );
      }
    }

    // 6. HP command: /hp <N>, /hp max, /hp +<N>, /hp -<N>
    const hpMatch = line.match(/^(?:\/|\/\/|!)hp\s+(max|[+-]?\d+)/i);
    if (hpMatch && hpMatch[1]) {
      result.hasOverride = true;
      if (hpMatch[1].toLowerCase() === 'max') {
        result.forcedStatePatch.forceHealFull = true;
        result.directives.push(`[⚡ GM COMMAND - FULL HEAL]: Полностью восстанови здоровье героя до максимума.`);
      } else {
        const hpVal = parseInt(hpMatch[1], 10);
        if (!isNaN(hpVal)) {
          result.forcedStatePatch.hp_change = hpVal;
          result.directives.push(`[⚡ GM COMMAND - HP]: Измени текущее HP персонажа на ${hpVal} ("hp_change": ${hpVal}).`);
        }
      }
    }

    // 7. Item command: /item <Name>, //item <Name>, /give <Name>
    const itemMatch = line.match(/^(?:\/|\/\/|!)(?:item|give|additem)\s+(.+)$/i);
    if (itemMatch && itemMatch[1]) {
      const itemName = itemMatch[1].trim();
      result.hasOverride = true;
      if (!result.forcedStatePatch.added_items) result.forcedStatePatch.added_items = [];
      result.forcedStatePatch.added_items.push(itemName);
      result.directives.push(
        `[⚡ GM COMMAND - GIVE ITEM]: Добавь в инвентарь персонажа предмет: «${itemName}» ("added_items": ["${itemName}"]). Опиши его появление.`
      );
    }

    // 8. Remove item command: /remove_item <Name>, /delitem <Name>
    const removeItemMatch = line.match(/^(?:\/|\/\/|!)(?:remove_item|delitem|takeitem)\s+(.+)$/i);
    if (removeItemMatch && removeItemMatch[1]) {
      const itemName = removeItemMatch[1].trim();
      result.hasOverride = true;
      if (!result.forcedStatePatch.removed_items) result.forcedStatePatch.removed_items = [];
      result.forcedStatePatch.removed_items.push(itemName);
      result.directives.push(
        `[⚡ GM COMMAND - REMOVE ITEM]: Удали из инвентаря предмет: «${itemName}» ("removed_items": ["${itemName}"]).`
      );
    }

    // 9. Teleport command: /tp <Loc>, //tp <Loc>, /goto <Loc>
    const tpMatch = line.match(/^(?:\/|\/\/|!)(?:tp|teleport|goto)\s+(.+)$/i);
    if (tpMatch && tpMatch[1]) {
      const location = tpMatch[1].trim();
      result.hasOverride = true;
      result.forcedStatePatch.forceTeleportLocation = location;
      result.directives.push(
        `[⚡ GM COMMAND - TELEPORT]: Отряд мгновенно перемещается в локацию «${location}» ("location_name": "${location}"). Опиши прибытие на новое место.`
      );
    }

    // 10. Spawn NPC / Creature: /spawn <Name>, //spawn <Name>
    const spawnMatch = line.match(/^(?:\/|\/\/|!)spawn\s+(.+)$/i);
    if (spawnMatch && spawnMatch[1]) {
      const name = spawnMatch[1].trim();
      result.hasOverride = true;
      result.directives.push(
        `[⚡ GM COMMAND - SPAWN]: В сцене немедленно появляется существо/NPC: «${name}». Введи его в повествование.`
      );
    }

    // 11. Rest command: /rest, /rest short, /rest long
    const restMatch = line.match(/^(?:\/|\/\/|!)rest(?:\s+(short|long))?/i);
    if (restMatch) {
      result.hasOverride = true;
      const isLong = (restMatch[1] || '').toLowerCase() === 'long';
      result.forcedStatePatch.time_passed_minutes = isLong ? 480 : 60;
      if (isLong) {
        result.forcedStatePatch.spell_slots_recovered = { all: true };
      }
      result.directives.push(
        `[⚡ GM COMMAND - REST]: Отряд совершает ${isLong ? 'Длительный (8 часов)' : 'Короткий (1 час)'} отдых.`
      );
    }

    // 12. Roll Win / Auto Pass: /win, /pass, //win, /roll_win
    if (/^(?:\/|\/\/|!)(?:win|pass|roll_win|autowin)\b/i.test(line)) {
      result.hasOverride = true;
      result.forcedStatePatch.forceRollAutoPass = true;
      result.directives.push(
        `[⚡ GM COMMAND - AUTO CRIT SUCCESS]: Текущее действие или проверка завершается триумфальным успехом (Natural 20)! Не требуй повторных бросков ("requires_roll": { "needed": false }).`
      );
    }

    // 13. Roll Fail / Auto Fail: /fail, //fail, /roll_fail
    if (/^(?:\/|\/\/|!)(?:fail|roll_fail|autofail)\b/i.test(line)) {
      result.hasOverride = true;
      result.forcedStatePatch.forceRollAutoFail = true;
      result.directives.push(
        `[⚡ GM COMMAND - AUTO FAIL]: Действие оборачивается драматическим критическим провалом (Natural 1)!`
      );
    }

    // 14. Reveal Secrets: /secret, //secret, /reveal
    if (/^(?:\/|\/\/|!)(?:secret|reveal|xray)\b/i.test(line)) {
      result.hasOverride = true;
      result.directives.push(
        `[⚡ GM COMMAND - REVEAL ALL SECRETS]: Раскрой игроку ВСЕ скрытые тайны, ловушки, невидимые двери, скрытые сокровища и истинные намерения NPC в этой локации!`
      );
    }

    // 15. Level Up: /lvlup, //lvlup, /levelup
    if (/^(?:\/|\/\/|!)(?:lvlup|levelup|level_up)\b/i.test(line)) {
      result.hasOverride = true;
      result.forcedStatePatch.forceLevelUpAvailable = true;
      result.directives.push(
        `[⚡ GM COMMAND - LEVEL UP]: Немедленно сделай доступным повышение уровня для героя ("level_up_available": { "new_level": ${(character?.level || 1) + 1}, "hit_die": "d10" }).`
      );
    }
  }

  return result;
}
