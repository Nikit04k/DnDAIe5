'use client';

import React, { useState } from 'react';
import {
  CharacterSheet,
  AbilityScoreKey,
  SkillName,
} from '@/types/dnd';
import {
  getAbilityModifier,
  formatModifier,
  getSkillModifier,
  getSavingThrowModifier,
  SKILL_RUSSIAN_NAMES,
  ABILITY_FULL_NAMES,
  normalizeRationItem,
  parseItemQuantity,
  formatItemWithCount,
  getLevelFromXp,
  canAdvanceLevel,
  XP_TABLE,
  calculateHpGainOnLevelUp,
  getInitialSpellSlots,
  canCastSpell,
  deductSpellSlot,
  recoverSpellSlots,
  getSpellCircle,
  isClassSpellcaster,
  CANTRIP_SUGGESTIONS_BY_CLASS,
  SPELL_SUGGESTIONS_BY_CLASS,
  getAvailableClassFeatures,
  DND_FEATS,
  DND_CLASS_FEATURES,
  DndFeatureDef,
} from '@/lib/dndRules';
import {
  Heart,
  Shield,
  Zap,
  Footprints,
  Sparkles,
  Coins,
  Sun,
  Moon,
  Plus,
  ChevronUp,
  Award,
  Flame,
} from 'lucide-react';
import { playDiceRollSound, playHealSound } from '@/lib/diceSound';

interface CharacterSheetProps {
  character: CharacterSheet;
  onUpdateCharacter: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
  onRollStat: (statKey: AbilityScoreKey, statName: string, modifier: number) => void;
  onRollSkill: (skillName: SkillName, modifier: number) => void;
  onRestAction?: (restType: 'short' | 'long') => void;
  onItemUsed?: (itemName: string, narrativeAction: string) => void;
  onClose?: () => void;
}

// Helper to determine if an item is consumable or usable from inventory
export function isConsumableItem(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('зелье') ||
    lower.includes('эликсир') ||
    lower.includes('снадобье') ||
    lower.includes('флакон') ||
    lower.includes('свиток') ||
    lower.includes('рацион') ||
    lower.includes('паек') ||
    lower.includes('факел') ||
    lower.includes('бинт') ||
    lower.includes('противоядие') ||
    lower.includes('трава') ||
    lower.includes('мазь') ||
    lower.includes('бутыль') ||
    lower.includes('еда') ||
    lower.includes('вода') ||
    lower.includes('фляг') ||
    lower.includes('бурдюк') ||
    lower.includes('waterskin') ||
    lower.includes('canteen')
  );
}

// Helper to determine if an item is a water flask / waterskin
export function isWaterFlask(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('фляг') ||
    lower.includes('бурдюк') ||
    lower.includes('waterskin') ||
    lower.includes('canteen')
  );
}

// Helper to determine if a water flask is currently filled
export function isFlaskFilled(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes('пуст') || lower.includes('не наполнен')) {
    return false;
  }
  return true; // Defaults to filled when acquired
}

// Get clean display name of a flask without state suffixes
export function getFlaskBaseName(name: string): string {
  return name
    .replace(/\s*\((?:наполнена|полная|пустая|не наполнена|полный|пустой)\)/gi, '')
    .trim();
}

// Helper to determine if an item is reusable upon use (e.g. water flask, waterskin, canteen)
export function isReusableItem(name: string): boolean {
  return isWaterFlask(name);
}

// Helper to determine if an item can be equipped (weapon, armor, shield, apparel)
export function isEquippableItem(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    // Weapons
    lower.includes('меч') ||
    lower.includes('кинжал') ||
    lower.includes('топор') ||
    lower.includes('секир') ||
    lower.includes('молот') ||
    lower.includes('булав') ||
    lower.includes('лук') ||
    lower.includes('арбалет') ||
    lower.includes('посох') ||
    lower.includes('жезл') ||
    lower.includes('рапир') ||
    lower.includes('сабл') ||
    lower.includes('копь') ||
    lower.includes('клинок') ||
    lower.includes('шпаг') ||
    lower.includes('дубин') ||
    lower.includes('дротик') ||
    lower.includes('алебард') ||
    lower.includes('пик') ||
    lower.includes('цеп') ||
    // Armor & Shields
    lower.includes('доспех') ||
    lower.includes('кольчуг') ||
    lower.includes('панцир') ||
    lower.includes('латы') ||
    lower.includes('кожан') ||
    lower.includes('щит') ||
    lower.includes('кирас') ||
    lower.includes('рубах') ||
    lower.includes('бригандин') ||
    lower.includes('шлем') ||
    // Wearables & Accessories
    lower.includes('плащ') ||
    lower.includes('манти') ||
    lower.includes('сапог') ||
    lower.includes('перчатк') ||
    lower.includes('наруч') ||
    lower.includes('кольцо') ||
    lower.includes('амулет') ||
    lower.includes('ожерель') ||
    lower.includes('пояс') ||
    lower.includes('талисман') ||
    lower.includes('медальон') ||
    lower.includes('роба') ||
    lower.includes('капюшон')
  );
}

// Calculate Armor Class (AC) based on equipped items in 5e
export function calculateEquippedAc(
  equippedItems: string[],
  dexMod: number,
  conMod: number = 0,
  charClass: string = ''
): number {
  let baseAc = 10 + dexMod;
  if (['Варвар', 'Barbarian'].includes(charClass)) {
    baseAc = 10 + dexMod + conMod;
  }

  let hasShield = false;

  for (const item of equippedItems) {
    const l = item.toLowerCase();
    if (l.includes('щит') || l.includes('shield')) {
      hasShield = true;
      continue;
    }

    if (l.includes('латы') || l.includes('латный')) {
      baseAc = 18;
    } else if (l.includes('наборный')) {
      baseAc = 17;
    } else if (l.includes('кольчуг') && !l.includes('рубах')) {
      baseAc = 16;
    } else if (l.includes('полулат')) {
      baseAc = 15 + Math.min(dexMod, 2);
    } else if (l.includes('панцир') || l.includes('чешуйчат')) {
      baseAc = 14 + Math.min(dexMod, 2);
    } else if (l.includes('кольчужная рубах')) {
      baseAc = 13 + Math.min(dexMod, 2);
    } else if (l.includes('проклепан')) {
      baseAc = 12 + dexMod;
    } else if (l.includes('кожан') || l.includes('доспех')) {
      baseAc = 11 + dexMod;
    }
  }

  return baseAc + (hasShield ? 2 : 0);
}

export const CharacterSheetView: React.FC<CharacterSheetProps> = ({
  character,
  onUpdateCharacter,
  onRollStat,
  onRollSkill,
  onRestAction,
  onItemUsed,
  onClose,
}) => {
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);

  // Level Up form state
  const [newCantripInput, setNewCantripInput] = useState('');
  const [newSpellInput, setNewSpellInput] = useState('');
  const [asiMode, setAsiMode] = useState<'+2' | '+1+1' | 'feat'>('+2');
  const [asiSingleStat, setAsiSingleStat] = useState<AbilityScoreKey>('str');
  const [asiStat1, setAsiStat1] = useState<AbilityScoreKey>('str');
  const [asiStat2, setAsiStat2] = useState<AbilityScoreKey>('con');
  const [selectedFeatId, setSelectedFeatId] = useState<string>('feat_tough');

  // Experience and level calculation from 5e rules
  const xpInfo = getLevelFromXp(character.experience || 0);
  const canLevelUp = xpInfo.level > character.level;
  const [spellErrorMsg, setSpellErrorMsg] = useState<string | null>(null);

  const stats = character.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const strMod = getAbilityModifier(stats.str);
  const dexMod = getAbilityModifier(stats.dex);
  const conMod = getAbilityModifier(stats.con);
  const intMod = getAbilityModifier(stats.int);
  const wisMod = getAbilityModifier(stats.wis);
  const chaMod = getAbilityModifier(stats.cha);

  // Active features list (custom or default by class & level)
  const activeFeatures: Array<{ id?: string; name: string; description: string; source?: string }> =
    character.customFeatures && character.customFeatures.length > 0
      ? character.customFeatures
      : (character.features && character.features.length > 0
          ? character.features
          : getAvailableClassFeatures(character.class, character.level));

  // Spellcasting modifier
  const isCaster = isClassSpellcaster(character.class);
  const castingMod = ['Жрец', 'Cleric', 'Друид', 'Druid', 'Следопыт', 'Ranger'].includes(character.class)
    ? wisMod
    : ['Волшебник', 'Wizard'].includes(character.class)
    ? intMod
    : chaMod;

  const spellSaveDc = 8 + character.proficiencyBonus + castingMod;
  const spellAttackBonus = character.proficiencyBonus + castingMod;

  // Passive perception and insight
  const isPerceptionProf = character.skillProficiencies?.includes('Perception');
  const isInsightProf = character.skillProficiencies?.includes('Insight');
  const passivePerception = 10 + wisMod + (isPerceptionProf ? character.proficiencyBonus : 0);
  const passiveInsight = 10 + wisMod + (isInsightProf ? character.proficiencyBonus : 0);

  // Equip item from inventory
  const handleEquipItem = (itemToEquip: string) => {
    playDiceRollSound();
    onUpdateCharacter((prev) => {
      const parsed = parseItemQuantity(itemToEquip);
      const currentInv = (prev.inventory || []).map(normalizeRationItem);
      const idx = currentInv.findIndex((it) => {
        const p = parseItemQuantity(it);
        return p.baseName.toLowerCase() === parsed.baseName.toLowerCase();
      });

      let nextInv = [...currentInv];
      if (idx !== -1) {
        const p = parseItemQuantity(currentInv[idx]);
        const nextCount = p.count - 1;
        if (nextCount > 0) {
          nextInv[idx] = formatItemWithCount(p.baseName, nextCount);
        } else {
          nextInv = nextInv.filter((_, i) => i !== idx);
        }
      } else {
        nextInv = nextInv.filter((it) => it !== itemToEquip);
      }

      const nextEquipped = [...(prev.equippedItems || []), parsed.baseName];
      const nextAc = calculateEquippedAc(nextEquipped, dexMod, conMod, prev.class);

      return {
        ...prev,
        inventory: nextInv,
        equippedItems: nextEquipped,
        ac: nextAc > 0 ? nextAc : prev.ac,
      };
    });

    if (onItemUsed) {
      onItemUsed(itemToEquip, `🛡️ Я экипирую / надеваю: «${itemToEquip}».`);
    }
  };

  // Unequip item back into inventory
  const handleUnequipItem = (itemToUnequip: string) => {
    playDiceRollSound();
    onUpdateCharacter((prev) => {
      const currentEquipped = prev.equippedItems || [];
      const idx = currentEquipped.findIndex(
        (it) => it.toLowerCase().trim() === itemToUnequip.toLowerCase().trim()
      );
      const nextEquipped = idx !== -1
        ? currentEquipped.filter((_, i) => i !== idx)
        : currentEquipped.filter((it) => it !== itemToUnequip);

      const currentInv = (prev.inventory || []).map(normalizeRationItem);
      const invIdx = currentInv.findIndex((it) => {
        const p = parseItemQuantity(it);
        return p.baseName.toLowerCase() === itemToUnequip.toLowerCase();
      });

      let nextInv = [...currentInv];
      if (invIdx !== -1) {
        const p = parseItemQuantity(currentInv[invIdx]);
        nextInv[invIdx] = formatItemWithCount(p.baseName, p.count + 1);
      } else {
        nextInv.push(itemToUnequip);
      }

      const nextAc = calculateEquippedAc(nextEquipped, dexMod, conMod, prev.class);

      return {
        ...prev,
        inventory: nextInv,
        equippedItems: nextEquipped,
        ac: nextAc > 0 ? nextAc : prev.ac,
      };
    });

    if (onItemUsed) {
      onItemUsed(itemToUnequip, `🎒 Я снимаю «${itemToUnequip}» и убираю в рюкзак.`);
    }
  };

  // Drink from water flask (empties flask, does not disappear)
  const handleDrinkFlask = (itemName: string) => {
    playDiceRollSound();
    const baseName = getFlaskBaseName(itemName);
    const emptyName = `${baseName} (пустая)`;

    onUpdateCharacter((prev) => {
      const nextInv = (prev.inventory || []).map((it) => (it === itemName ? emptyName : it));
      const nextEquipped = (prev.equippedItems || []).map((it) => (it === itemName ? emptyName : it));
      return {
        ...prev,
        inventory: nextInv,
        equippedItems: nextEquipped,
      };
    });

    if (onItemUsed) {
      onItemUsed(itemName, `💧 Я делаю освежающий глоток чистой воды из «${baseName}», утоляя жажду. Фляга опустела.`);
    }
  };

  // Refill water flask with clean water
  const handleRefillFlask = (itemName: string) => {
    playDiceRollSound();
    const baseName = getFlaskBaseName(itemName);
    const filledName = `${baseName} (наполнена)`;

    onUpdateCharacter((prev) => {
      const nextInv = (prev.inventory || []).map((it) => (it === itemName ? filledName : it));
      const nextEquipped = (prev.equippedItems || []).map((it) => (it === itemName ? filledName : it));
      return {
        ...prev,
        inventory: nextInv,
        equippedItems: nextEquipped,
      };
    });

    if (onItemUsed) {
      onItemUsed(filledName, `🚰 Я наполняю походную флягу «${baseName}» свежей, чистой водой.`);
    }
  };

  // Equipment / Consumable use
  const handleConsumeItem = (itemName: string) => {
    if (isWaterFlask(itemName)) {
      if (isFlaskFilled(itemName)) {
        handleDrinkFlask(itemName);
      } else {
        handleRefillFlask(itemName);
      }
      return;
    }

    const lower = itemName.toLowerCase();
    let hpHealed = 0;

    if (lower.includes('зелье лечения') || lower.includes('зелье здоровья') || lower.includes('potion of healing')) {
      if (lower.includes('отличное') || lower.includes('superior')) {
        hpHealed = Math.floor(Math.random() * 4 + 1) * 8 + 8;
      } else if (lower.includes('большее') || lower.includes('greater')) {
        hpHealed = Math.floor(Math.random() * 4 + 1) * 4 + 4;
      } else {
        hpHealed = (Math.floor(Math.random() * 4 + 1) + Math.floor(Math.random() * 4 + 1)) + 2;
      }
      playHealSound();
    } else {
      playDiceRollSound();
    }

    if (onItemUsed) {
      const healText = hpHealed > 0 ? ` восстанавливая **+${hpHealed} HP**` : '';
      onItemUsed(itemName, `✨ Я применяю «${itemName}»${healText}.`);
    }

    onUpdateCharacter((prev) => {
      const parsed = parseItemQuantity(itemName);
      const currentInv = (prev.inventory || []).map(normalizeRationItem);
      const idx = currentInv.findIndex((it) => {
        const p = parseItemQuantity(it);
        return p.baseName.toLowerCase() === parsed.baseName.toLowerCase();
      });
      if (idx === -1) return prev;

      const p = parseItemQuantity(currentInv[idx]);
      const nextCount = p.count - 1;
      let nextInv = [...currentInv];
      if (nextCount > 0) {
        nextInv[idx] = formatItemWithCount(p.baseName, nextCount);
      } else {
        nextInv = nextInv.filter((_, i) => i !== idx);
      }

      const nextHp = hpHealed > 0 ? Math.min(prev.maxHp, prev.currentHp + hpHealed) : prev.currentHp;
      return { ...prev, inventory: nextInv, currentHp: nextHp };
    });
  };

  // Cast Spell (Cantrips are free, Leveled Spells consume spell slots)
  const handleCastSpell = (spellName: string, isCantrip: boolean = false) => {
    const effectiveChar: CharacterSheet = character.spellSlots
      ? character
      : { ...character, spellSlots: getInitialSpellSlots(character.class, character.level) };

    const check = canCastSpell(effectiveChar, spellName, isCantrip);

    if (!check.canCast) {
      setSpellErrorMsg(check.reason || 'Нет свободных ячеек заклинаний! Требуется отдых.');
      setTimeout(() => setSpellErrorMsg(null), 4000);
      return;
    }

    setSpellErrorMsg(null);
    playDiceRollSound();

    if (check.circle > 0) {
      onUpdateCharacter((prev) => {
        const base = prev.spellSlots ? prev : { ...prev, spellSlots: getInitialSpellSlots(prev.class, prev.level) };
        return deductSpellSlot(base, check.circle);
      });
    }

    if (onItemUsed) {
      const circleText = check.circle === 0 ? 'Фокус (0 уровень)' : `Заклинание ${check.circle}-го круга (потрачена 1 ячейка)`;
      const text = `✨ **Сотворение заклинания «${spellName}»** [${circleText}]: DC спасброска: ${spellSaveDc}, Бонус атаки: +${spellAttackBonus}.`;
      onItemUsed(spellName, text);
    }
  };

  // Level Up Confirmation
  const handleConfirmLevelUp = () => {
    const targetLevel = xpInfo.level;
    const hpGain = calculateHpGainOnLevelUp(character.class, stats.con);
    const isAsiLevel = targetLevel % 4 === 0 || targetLevel === 19;

    onUpdateCharacter((prev) => {
      const nextSpells = [...(prev.spells || [])];
      const nextCantrips = [...(prev.cantrips || [])];

      if (newSpellInput.trim()) {
        nextSpells.push(newSpellInput.trim());
      }
      if (newCantripInput.trim()) {
        nextCantrips.push(newCantripInput.trim());
      }

      // Automatically add new class features unlocked for targetLevel
      const allClassFeats = DND_CLASS_FEATURES[prev.class] || [];
      const newClassFeats = allClassFeats.filter((f) => f.level === targetLevel);
      const currentFeats = prev.customFeatures || prev.features || getAvailableClassFeatures(prev.class, prev.level);
      let updatedFeats = [...currentFeats];

      for (const feat of newClassFeats) {
        if (!updatedFeats.some((f) => f.name.toLowerCase() === feat.name.toLowerCase())) {
          updatedFeats.push(feat);
        }
      }

      let updatedStats = { ...(prev.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }) };

      if (isAsiLevel) {
        if (asiMode === '+2') {
          updatedStats[asiSingleStat] = (updatedStats[asiSingleStat] || 10) + 2;
          updatedFeats.push({
            id: `asi_${Date.now()}`,
            name: `Увеличение характеристик (${targetLevel} ур.)`,
            description: `+2 к характеристике [${ABILITY_FULL_NAMES[asiSingleStat]?.ru || asiSingleStat}] (стало ${updatedStats[asiSingleStat]})`,
            source: 'Развитие (ASI)',
          });
        } else if (asiMode === '+1+1') {
          updatedStats[asiStat1] = (updatedStats[asiStat1] || 10) + 1;
          updatedStats[asiStat2] = (updatedStats[asiStat2] || 10) + 1;
          updatedFeats.push({
            id: `asi_${Date.now()}`,
            name: `Увеличение характеристик (${targetLevel} ур.)`,
            description: `+1 к [${ABILITY_FULL_NAMES[asiStat1]?.ru || asiStat1}], +1 к [${ABILITY_FULL_NAMES[asiStat2]?.ru || asiStat2}]`,
            source: 'Развитие (ASI)',
          });
        } else if (asiMode === 'feat') {
          const featObj = DND_FEATS.find((f) => f.id === selectedFeatId);
          if (featObj && !updatedFeats.some((f) => f.name.toLowerCase() === featObj.name.toLowerCase())) {
            updatedFeats.push(featObj);
          }
        }
      }

      return {
        ...prev,
        level: targetLevel,
        proficiencyBonus: xpInfo.proficiencyBonus,
        maxHp: prev.maxHp + hpGain,
        currentHp: prev.currentHp + hpGain,
        stats: updatedStats,
        cantrips: nextCantrips,
        spells: nextSpells,
        customFeatures: updatedFeats,
        features: updatedFeats,
      };
    });

    setIsLevelUpModalOpen(false);
    setNewCantripInput('');
    setNewSpellInput('');
  };

  // Suggested cantrips and spells for current class
  const classCantripSuggestions = CANTRIP_SUGGESTIONS_BY_CLASS[character.class] || [];
  const classSpellSuggestions = SPELL_SUGGESTIONS_BY_CLASS[character.class] || [];

  // Currently equipped items (Armor, Shield, Weapons, Accessories)
  const equippedGearList = character.equippedItems || [];

  return (
    <div className="w-full bg-[#110e0c] text-[#2c1810] font-serif-vintage select-none flex flex-col items-center justify-start py-4 px-2 sm:px-6 relative overflow-x-hidden">
      {/* Antique Parchment Outer Container with Gold Border */}
      <div className="w-full max-w-5xl rounded-3xl bg-gradient-to-b from-[#fbf6ea] via-[#f7f2e4] to-[#ebdcc4] p-3 sm:p-5 shadow-2xl border-4 border-[#8f6d33] relative">

        {/* Close / Collapse Button at Top Right */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 px-3 py-1.5 rounded-full bg-[#3a2212]/90 hover:bg-[#27150a] border border-amber-400/60 text-amber-200 text-xs font-cinzel font-bold flex items-center gap-1 cursor-pointer transition shadow-md z-30"
            title="Свернуть лист персонажа"
          >
            <ChevronUp className="w-4 h-4" />
            <span className="hidden sm:inline">Свернуть лист</span>
          </button>
        )}

        {/* =========================================================
            ORNATE PARCHMENT RIBBON (CHARACTER & XP INFO)
            ========================================================= */}
        <div className="max-w-3xl mx-auto mt-1 mb-5">
          <div className="parchment-ribbon p-3 sm:p-4 text-center relative border-2 border-[#7c5a2c]">
            {/* Central Character Name */}
            <h1 className="font-cinzel text-xl sm:text-3xl font-extrabold tracking-wider text-[#24140b] drop-shadow-sm">
              {character.name}
            </h1>

            {/* Left & Right Ribbon Wings */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-[#4a2e16] font-semibold mt-1 border-t border-[#8c6a38]/40 pt-1.5 px-3 sm:px-6">
              {/* Left Tail Info */}
              <div className="flex items-center gap-3">
                <span>Раса: <strong>{character.race}</strong></span>
                <span>•</span>
                <span>Мировоззрение: <strong>{character.alignment || 'Нейтральный'}</strong></span>
                <span>•</span>
                <span>Предыстория: <strong>{character.background || 'Странник'}</strong></span>
              </div>

              {/* Right Tail Info */}
              <div className="flex items-center gap-3">
                <span>Класс: <strong className="text-amber-900">{character.class}</strong></span>
                <span>•</span>
                <span className="bg-amber-900/10 px-2.5 py-0.5 rounded-full border border-amber-900/30 text-amber-950 font-cinzel font-bold text-[11px] sm:text-xs">
                  Уровень: <strong>{character.level}</strong>
                </span>
              </div>
            </div>

            {/* D&D 5e Experience Progress Bar */}
            <div className="mt-2.5 pt-2 border-t border-[#8c6a38]/30 px-3 sm:px-8">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-[#442813] mb-1">
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-700" />
                  <span>Опыт (XP): {character.experience || 0} / {xpInfo.nextLevelXp}</span>
                  {character.xpMultiplier && character.xpMultiplier !== 1 && (
                    <span className="text-[9px] px-1.5 py-0.2 bg-amber-600/20 text-amber-900 rounded border border-amber-700/30">
                      x{character.xpMultiplier} XP
                    </span>
                  )}
                </div>
                <span>{xpInfo.progressPercent}% до {character.level + 1} ур.</span>
              </div>

              <div className="w-full h-2.5 bg-[#d9c7a5] rounded-full overflow-hidden border border-[#8a6833] p-0.5 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${xpInfo.progressPercent}%` }}
                />
              </div>

              {/* Level Up Trigger Badge */}
              {canLevelUp && (
                <div className="mt-2 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setIsLevelUpModalOpen(true)}
                    className="px-4 py-1.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-cinzel font-bold text-xs rounded-full shadow-lg border border-amber-300 flex items-center gap-1.5 animate-level-up cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>ПОВЫСИТЬ УРОВЕНЬ ДО {xpInfo.level}! (Доступны новые силы)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================
            3. MAIN 3-COLUMN PARCHMENT SHEET LAYOUT (AS IN REFERENCE)
            ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* -----------------------------------------------------
              COLUMN 1: PROFICIENCY, ABILITY SCORES, SKILLS (4 Cols)
              ----------------------------------------------------- */}
          <div className="lg:col-span-4 space-y-4">
            {/* Top 4 Circular Seals (Proficiency, Inspiration, Passive Perception, Passive Insight) */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="parchment-card p-2 flex flex-col items-center justify-center">
                <span className="text-[9px] uppercase font-bold text-[#6d4d29] leading-tight">Бонус</span>
                <span className="font-cinzel text-lg font-extrabold text-[#2a1810]">+{character.proficiencyBonus}</span>
                <span className="text-[8px] text-[#7a5b35]">Мастерство</span>
              </div>

              <div
                onClick={() => onUpdateCharacter((prev) => ({ ...prev, tempHp: prev.tempHp > 0 ? 0 : 5 }))}
                className="parchment-card p-2 flex flex-col items-center justify-center cursor-pointer hover:border-amber-700 transition"
                title="Вдохновение от Мастера (Inspiration)"
              >
                <span className="text-[9px] uppercase font-bold text-[#6d4d29] leading-tight">Вдохн.</span>
                <Sparkles className="w-5 h-5 text-amber-700 my-0.5" />
                <span className="text-[8px] text-[#7a5b35]">D&D 5e</span>
              </div>

              <div className="parchment-card p-2 flex flex-col items-center justify-center" title="Пассивная внимательность">
                <span className="text-[9px] uppercase font-bold text-[#6d4d29] leading-tight">Вним.</span>
                <span className="font-cinzel text-lg font-extrabold text-[#2a1810]">{passivePerception}</span>
                <span className="text-[8px] text-[#7a5b35]">Пассивная</span>
              </div>

              <div className="parchment-card p-2 flex flex-col items-center justify-center" title="Пассивная проницательность">
                <span className="text-[9px] uppercase font-bold text-[#6d4d29] leading-tight">Прониц.</span>
                <span className="font-cinzel text-lg font-extrabold text-[#2a1810]">{passiveInsight}</span>
                <span className="text-[8px] text-[#7a5b35]">Пассивная</span>
              </div>
            </div>

            {/* 6 Circular Ability Badges with Saving Throws & Associated Skills */}
            <div className="parchment-card p-3 space-y-3">
              <h3 className="font-cinzel text-xs font-bold text-[#442813] uppercase tracking-wider text-center border-b border-[#8c6a38]/30 pb-1">
                Характеристики и Спасброски
              </h3>

              {([
                { key: 'str', label: 'СИЛА', score: stats.str, mod: strMod, skills: ['Athletics'] as SkillName[] },
                { key: 'dex', label: 'ЛОВКОСТЬ', score: stats.dex, mod: dexMod, skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] as SkillName[] },
                { key: 'con', label: 'ТЕЛОСЛОЖЕНИЕ', score: stats.con, mod: conMod, skills: [] as SkillName[] },
                { key: 'int', label: 'ИНТЕЛЛЕКТ', score: stats.int, mod: intMod, skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'] as SkillName[] },
                { key: 'wis', label: 'МУДРОСТЬ', score: stats.wis, mod: wisMod, skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] as SkillName[] },
                { key: 'cha', label: 'ХАРИЗМА', score: stats.cha, mod: chaMod, skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] as SkillName[] },
              ] as const).map((stat) => {
                const isSaveProf = character.savingThrowProficiencies?.includes(stat.key);
                const saveMod = getSavingThrowModifier(character, stat.key);

                return (
                  <div key={stat.key} className="flex items-start gap-2.5 pt-1 border-b border-[#8c6a38]/20 pb-2">
                    {/* Circle Ability Seal */}
                    <button
                      type="button"
                      onClick={() => onRollStat(stat.key, ABILITY_FULL_NAMES[stat.key].ru, stat.mod)}
                      className="w-12 h-12 rounded-full bg-[#fbf6ea] border-2 border-[#8a6833] flex flex-col items-center justify-center shadow-md hover:bg-amber-100 hover:scale-105 transition cursor-pointer flex-shrink-0"
                      title={`Нажмите, чтобы сделать проверку ${stat.label}`}
                    >
                      <span className="text-[9px] font-bold text-[#5c3c1e]">{stat.label.substring(0, 3)}</span>
                      <span className="font-cinzel text-xs font-extrabold text-[#2a1810]">{stat.score}</span>
                      <span className="text-[8px] font-bold text-amber-800 leading-none">{formatModifier(stat.mod)}</span>
                    </button>

                    {/* Saving Throw & Skills List */}
                    <div className="flex-1 min-w-0 text-[11px]">
                      {/* Saving Throw */}
                      <div
                        onClick={() => onRollStat(stat.key, `Спасбросок (${stat.label})`, saveMod)}
                        className="flex items-center gap-1.5 cursor-pointer hover:text-amber-800 transition py-0.5"
                        title="Нажмите для спасброска"
                      >
                        <span className={`w-2.5 h-2.5 rounded-sm border border-[#7a5b35] flex items-center justify-center text-[8px] ${isSaveProf ? 'bg-[#7a5b35] text-amber-100' : ''}`}>
                          {isSaveProf ? '◆' : ''}
                        </span>
                        <span className="font-bold text-[#3d2412]">Спасбросок: {formatModifier(saveMod)}</span>
                      </div>

                      {/* Associated Skills */}
                      {stat.skills.map((sk) => {
                        const isProf = character.skillProficiencies?.includes(sk);
                        const skMod = getSkillModifier(character, sk);
                        return (
                          <div
                            key={sk}
                            onClick={() => onRollSkill(sk, skMod)}
                            className="flex items-center justify-between text-[10px] text-[#4f341d] hover:bg-[#ebdcc4]/60 px-1 rounded cursor-pointer transition"
                            title={`Бросок навыка ${SKILL_RUSSIAN_NAMES[sk]}`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <span className={`w-2 h-2 rounded-full border border-[#8a6833] ${isProf ? 'bg-[#8a6833]' : ''}`} />
                              <span className={isProf ? 'font-bold text-[#2a1810]' : ''}>{SKILL_RUSSIAN_NAMES[sk]}</span>
                            </span>
                            <span className="font-bold text-amber-900 shrink-0">{formatModifier(skMod)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Racial Traits & Languages Card */}
            <div className="parchment-card p-3 space-y-2 text-xs">
              <h4 className="font-cinzel text-xs font-bold text-[#442813] uppercase tracking-wider border-b border-[#8c6a38]/30 pb-1">
                Языки и Владения
              </h4>
              <p className="text-[11px] text-[#4a2e16] leading-relaxed">
                <strong>Языки:</strong> Общий, {character.race === 'Эльф' ? 'Эльфийский' : character.race === 'Дварф' ? 'Дварфский' : 'Орочий'}
              </p>
              <p className="text-[11px] text-[#4a2e16] leading-relaxed">
                <strong>Доспехи и Оружие:</strong> Простое и воинское оружие, легкие и средние доспехи, щиты.
              </p>
            </div>
          </div>

          {/* -----------------------------------------------------
              COLUMN 2: COMBAT, HP, ATTACKS, SPELLS, EQUIPMENT (5 Cols)
              ----------------------------------------------------- */}
          <div className="lg:col-span-5 space-y-4">
            {/* AC, Initiative, Speed (3 Boxes) */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              {/* Shield Plaque AC */}
              <div className="parchment-card p-2 flex flex-col items-center justify-center border-2 border-[#8c6a38] relative">
                <Shield className="w-4 h-4 text-blue-900 mb-0.5" />
                <span className="font-cinzel text-xl font-extrabold text-[#2a1810]">{character.ac}</span>
                <span className="text-[9px] uppercase font-bold text-[#6d4d29]">Класс Брони</span>
              </div>

              {/* Initiative Banner */}
              <div className="parchment-card p-2 flex flex-col items-center justify-center border-2 border-[#8c6a38]">
                <Zap className="w-4 h-4 text-amber-700 mb-0.5" />
                <span className="font-cinzel text-xl font-extrabold text-[#2a1810]">{formatModifier(dexMod)}</span>
                <span className="text-[9px] uppercase font-bold text-[#6d4d29]">Инициатива</span>
              </div>

              {/* Speed Banner */}
              <div className="parchment-card p-2 flex flex-col items-center justify-center border-2 border-[#8c6a38]">
                <Footprints className="w-4 h-4 text-emerald-800 mb-0.5" />
                <span className="font-cinzel text-xl font-extrabold text-[#2a1810]">{character.speed} фт</span>
                <span className="text-[9px] uppercase font-bold text-[#6d4d29]">Скорость</span>
              </div>
            </div>

            {/* Hit Points & Death Saves Box */}
            <div className="parchment-card p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-[#8c6a38]/30 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-700 fill-current/30" />
                  <span className="font-cinzel text-xs font-bold text-[#442813] uppercase">Очки Здоровья (HP)</span>
                </div>
                <span className="text-xs font-bold text-[#2a1810]">
                  {character.currentHp} / {character.maxHp} HP
                </span>
              </div>

              {/* HP Progress Bar */}
              <div className="w-full h-3 bg-[#d9c7a5] rounded-full overflow-hidden border border-[#8a6833] p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    character.currentHp / character.maxHp > 0.5
                      ? 'bg-emerald-700'
                      : character.currentHp / character.maxHp > 0.25
                      ? 'bg-amber-600'
                      : 'bg-red-700'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (character.currentHp / character.maxHp) * 100))}%` }}
                />
              </div>
            </div>

            {/* Equipped Items & Gear (View-only status, cannot be applied manually, factored by AI DM) */}
            <div className="parchment-card p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-[#8c6a38]/30 pb-1">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-900" />
                  <span className="font-cinzel text-xs font-bold text-[#442813] uppercase tracking-wider">
                    Надетые вещи и экипировка
                  </span>
                </div>
                <span className="text-[10px] text-[#7a5b35] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Учитывается нейросетью</span>
                </span>
              </div>

              <div className="space-y-1.5">
                {equippedGearList.length === 0 ? (
                  <div className="text-center py-2.5 px-3 bg-[#ebdcc4]/40 rounded-lg border border-dashed border-[#8c6a38]/50 text-xs text-[#7a5b35] italic">
                    Ничего не надето. Нажмите «Надеть» на снаряжении в рюкзаке ниже.
                  </div>
                ) : (
                  equippedGearList.map((item, i) => {
                    const lower = item.toLowerCase();
                    const isFlask = isWaterFlask(item);
                    const isFilled = isFlask ? isFlaskFilled(item) : false;
                    const baseItemName = isFlask ? getFlaskBaseName(item) : item;

                    const isArmor = lower.includes('кольчуг') || lower.includes('доспех') || lower.includes('панцир') || lower.includes('латы') || lower.includes('кожан') || lower.includes('ac');
                    const isShield = lower.includes('щит') || lower.includes('shield');
                    const isWeapon = lower.includes('меч') || lower.includes('кинжал') || lower.includes('топор') || lower.includes('лук') || lower.includes('арбалет') || lower.includes('молот') || lower.includes('булав') || lower.includes('посох') || lower.includes('рапир') || lower.includes('сабл') || lower.includes('секир') || lower.includes('копь');

                    const typeLabel = isArmor ? 'Броня' : isShield ? 'Щит' : isWeapon ? 'Оружие' : isFlask ? 'Фляга' : 'Экипировка';
                    const iconEmoji = isArmor ? '🛡️' : isShield ? '🔰' : isWeapon ? '⚔️' : isFlask ? '💧' : '🎽';

                    return (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-[#fbf6ea] border border-[#8c6a38]/60 flex items-center justify-between text-xs select-text shadow-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">{iconEmoji}</span>
                          <span className="font-bold text-[#2a1810] truncate">{baseItemName}</span>
                          {isFlask && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 border ${
                                isFilled
                                  ? 'bg-sky-100 text-sky-800 border-sky-400/60'
                                  : 'bg-stone-200 text-stone-600 border-stone-400/60'
                              }`}
                            >
                              {isFilled ? '💧 Наполнена' : '⚪ Пустая'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {isFlask && (
                            isFilled ? (
                              <button
                                type="button"
                                onClick={() => handleDrinkFlask(item)}
                                className="px-2 py-0.5 rounded bg-sky-800/85 hover:bg-sky-700 text-sky-100 text-[10px] font-bold transition cursor-pointer shadow-xs"
                                title="Сделать глоток воды"
                              >
                                💧 Испить
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRefillFlask(item)}
                                className="px-2 py-0.5 rounded bg-emerald-800/85 hover:bg-emerald-700 text-emerald-100 text-[10px] font-bold transition cursor-pointer shadow-xs"
                                title="Наполнить флягу водой"
                              >
                                🚰 Наполнить
                              </button>
                            )
                          )}
                          <span className="bg-[#ebdcc4] px-2 py-0.5 rounded text-[10px] font-bold text-[#5c3c1e] border border-[#8c6a38]/40">
                            {typeLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnequipItem(item)}
                            className="px-2.5 py-0.5 rounded bg-[#ebdcc4] hover:bg-amber-200 text-[#442813] hover:text-amber-950 border border-[#8c6a38]/60 text-[10px] font-bold transition cursor-pointer shadow-xs"
                            title={`Снять «${item}» и убрать в рюкзак`}
                          >
                            Снять
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-1 border-t border-[#8c6a38]/20 text-[10px] text-[#6d4e2a] italic flex items-center gap-1">
                <span>ℹ️ Надетые предметы формируют защиту (AC {character.ac}) и арсенал. Нейросеть видит ваше снаряжение и сама рассчитывает его в бою.</span>
              </div>
            </div>

            {/* Spells & Magic Section */}
            {isCaster && (
              <div className="parchment-card p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-[#8c6a38]/30 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-800" />
                    <span className="font-cinzel text-xs font-bold text-[#442813] uppercase">Заклинания и Магия</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-amber-900">
                    <span>DC: {spellSaveDc}</span>
                    <span>•</span>
                    <span>Атака: +{spellAttackBonus}</span>
                  </div>
                </div>

                {/* Spell Slots Indicator / Tracker */}
                {(() => {
                  const slots = character.spellSlots || getInitialSpellSlots(character.class, character.level);
                  if (!slots || Object.keys(slots).length === 0) return null;
                  const entries = Object.entries(slots).filter(([k]) => !k.startsWith('level'));
                  if (entries.length === 0) return null;

                  return (
                    <div className="bg-[#ebdcc4]/50 p-2 rounded-lg border border-[#8c6a38]/40 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-[#6d4d29] flex items-center justify-between">
                        <span>🔮 Ячейки заклинаний:</span>
                        <span className="text-[9px] text-[#7a5b35]">
                          {['колдун', 'warlock'].includes(character.class.toLowerCase()) ? 'Восст.: Короткий отдых' : 'Восст.: Длинный отдых'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {entries.map(([circle, slot]) => {
                          if (!slot) return null;
                          return (
                            <div
                              key={circle}
                              className="flex items-center gap-1.5 bg-[#fbf6ea] px-2 py-0.5 rounded border border-[#8c6a38]/50 text-[10px]"
                            >
                              <span className="font-bold text-[#442813]">{circle} круг:</span>
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: slot.max }).map((_, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-block w-2.5 h-2.5 rounded-full border ${
                                      idx < slot.current
                                        ? 'bg-purple-700 border-purple-900 shadow-xs'
                                        : 'bg-stone-300 border-stone-400 opacity-60'
                                    }`}
                                    title={idx < slot.current ? 'Ячейка свободна' : 'Ячейка израсходована'}
                                  />
                                ))}
                              </div>
                              <span className="text-[#6d4d29] font-bold font-mono">
                                ({slot.current}/{slot.max})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Spell Error / Exhaustion Message */}
                {spellErrorMsg && (
                  <div className="p-2 rounded bg-red-950/80 border border-red-500/60 text-red-200 text-[11px] font-semibold animate-pulse flex items-center gap-1.5">
                    <span>⚠️ {spellErrorMsg}</span>
                  </div>
                )}

                {/* Cantrips and Spells Badges */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] uppercase font-bold text-[#6d4d29] flex items-center justify-between">
                    <span>Фокусы (0 уровень, без траты ячеек):</span>
                    <span className="text-[9px] text-emerald-800 font-bold">∞ Бесплатно</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(character.cantrips && character.cantrips.length > 0 ? character.cantrips : ['Свет', 'Огненный снаряд']).map((cantrip, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleCastSpell(cantrip, true)}
                        className="px-2 py-1 rounded-md bg-[#ebdcc4] hover:bg-purple-200 border border-[#8c6a38]/50 text-xs font-semibold text-purple-950 transition cursor-pointer flex items-center gap-1 shadow-xs"
                        title="Сотворить фокус (бесплатно)"
                      >
                        <span>✨ {cantrip}</span>
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] uppercase font-bold text-[#6d4d29] pt-1 flex items-center justify-between">
                    <span>Заклинания кругов (расходуют ячейки):</span>
                    <span className="text-[9px] text-purple-900 font-bold">1 ячейка / каст</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(character.spells && character.spells.length > 0 ? character.spells : ['Волшебная стрела', 'Щит']).map((spell, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleCastSpell(spell, false)}
                        className="px-2 py-1 rounded-md bg-[#ebdcc4] hover:bg-amber-200 border border-[#8c6a38]/50 text-xs font-semibold text-[#2a1810] transition cursor-pointer flex items-center gap-1 shadow-xs"
                        title={`Сотворить «${spell}» (тратит 1 ячейку магии)`}
                      >
                        <span>📜 {spell}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Currencies & Equipment */}
            <div className="parchment-card p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-[#8c6a38]/30 pb-1">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-700" />
                  <span className="font-cinzel text-xs font-bold text-[#442813] uppercase">Кошелек и Монеты</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <span>🟡 {character.gold} gp</span>
                  <span>⚪ 10 sp</span>
                  <span>🟤 25 cp</span>
                </div>
              </div>

              {/* Equipment list */}
              <div className="space-y-1.5 pt-1 max-h-52 overflow-y-auto pr-1">
                <div className="flex items-center justify-between pb-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#6d4d29] block">Снаряжение в рюкзаке:</span>
                  <span className="text-[10px] font-semibold text-[#7a5b35]">{(character.inventory || []).length} предм.</span>
                </div>
                {(character.inventory || []).length === 0 ? (
                  <div className="text-center py-3 text-xs text-[#7a5b35] italic bg-[#ebdcc4]/30 rounded-lg border border-dashed border-[#8c6a38]/40">
                    Рюкзак пуст. Найденные сокровища и трофеи будут появляться здесь.
                  </div>
                ) : (
                  (character.inventory || []).map((item, i) => {
                    const isFlask = isWaterFlask(item);
                    const isFilled = isFlask ? isFlaskFilled(item) : false;
                    const baseItemName = isFlask ? getFlaskBaseName(item) : item;
                    const isConsumable = isConsumableItem(item);
                    const isEquippable = isEquippableItem(item);
                    return (
                      <div
                        key={i}
                        className="p-1.5 rounded-lg bg-[#fbf6ea] border border-[#8c6a38]/40 flex items-center justify-between text-xs gap-2 shadow-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[#3a2211] font-medium truncate">{baseItemName}</span>
                          {isFlask && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 border ${
                                isFilled
                                  ? 'bg-sky-100 text-sky-800 border-sky-400/60'
                                  : 'bg-stone-200 text-stone-600 border-stone-400/60'
                              }`}
                              title={isFilled ? 'Фляга наполнена чистой водой' : 'Фляга пуста'}
                            >
                              {isFilled ? '💧 Наполнена' : '⚪ Пустая'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isEquippable && (
                            <button
                              type="button"
                              onClick={() => handleEquipItem(item)}
                              className="px-2 py-0.5 rounded bg-[#ebdcc4] hover:bg-amber-200 border border-[#8c6a38]/70 text-[#442813] text-[10px] font-bold shadow-xs transition cursor-pointer flex items-center gap-0.5"
                              title={`Надеть «${item}»`}
                            >
                              <span>🛡️ Надеть</span>
                            </button>
                          )}
                          {isFlask ? (
                            isFilled ? (
                              <button
                                type="button"
                                onClick={() => handleDrinkFlask(item)}
                                className="px-2 py-0.5 rounded bg-sky-800/85 hover:bg-sky-700 text-sky-100 text-[10px] font-bold shadow-xs transition cursor-pointer flex items-center gap-0.5"
                                title="Сделать глоток воды (фляга опустеет)"
                              >
                                <span>💧 Испить</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRefillFlask(item)}
                                className="px-2 py-0.5 rounded bg-emerald-800/85 hover:bg-emerald-700 text-emerald-100 text-[10px] font-bold shadow-xs transition cursor-pointer flex items-center gap-0.5"
                                title="Наполнить флягу свежей водой"
                              >
                                <span>🚰 Наполнить</span>
                              </button>
                            )
                          ) : isConsumable ? (
                            <button
                              type="button"
                              onClick={() => handleConsumeItem(item)}
                              className="px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-600 text-amber-100 text-[10px] font-bold shadow-xs transition cursor-pointer flex items-center gap-0.5"
                              title={`Применить «${item}»`}
                            >
                              <span>✨ Применить</span>
                            </button>
                          ) : !isEquippable && (
                            <button
                              type="button"
                              onClick={() => handleConsumeItem(item)}
                              className="px-2 py-0.5 rounded bg-[#ebdcc4] hover:bg-amber-200 border border-[#8c6a38]/60 text-[#442813] text-[10px] font-bold shadow-xs transition cursor-pointer"
                              title={`Использовать «${item}»`}
                            >
                              Применить
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* -----------------------------------------------------
              COLUMN 3: APPEARANCE, PERSONALITY & FEATURES (3 Cols)
              ----------------------------------------------------- */}
          <div className="lg:col-span-3 space-y-4">
            {/* Appearance & Personality Card */}
            <div className="parchment-card p-3 space-y-2 text-xs">
              <h4 className="font-cinzel text-xs font-bold text-[#442813] uppercase tracking-wider border-b border-[#8c6a38]/30 pb-1">
                Внешность и Характер
              </h4>
              <p className="text-[11px] text-[#4a2e16] leading-relaxed">
                {character.appearance || 'Мужественный взгляд, дорожный плащ, следы былых сражений.'}
              </p>
              <div className="border-t border-[#8c6a38]/20 pt-1.5 mt-1.5">
                <span className="text-[10px] font-bold text-[#6d4d29] block mb-0.5">Черты личности:</span>
                <p className="text-[11px] text-[#4a2e16] leading-relaxed italic">
                  «{character.personalityTraits || 'Верность слову, осторожность в чужих землях.'}»
                </p>
              </div>
            </div>

            {/* Features & Traits Card */}
            <div className="parchment-card p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-[#8c6a38]/30 pb-1">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-700" />
                  <span className="font-cinzel text-xs font-bold text-[#442813] uppercase tracking-wider">
                    Умения и Особенности
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-900/10 px-2 py-0.5 rounded border border-amber-900/30">
                  {activeFeatures.length} умений
                </span>
              </div>

              {/* Dynamic Features List */}
              <div className="space-y-2 text-[11px] text-[#4a2e16] max-h-72 overflow-y-auto pr-1">
                {activeFeatures.length === 0 ? (
                  <div className="text-center py-3 text-xs text-[#7a5b35] italic bg-[#ebdcc4]/30 rounded-lg border border-dashed border-[#8c6a38]/40">
                    Умения формируются при создании персонажа и повышении уровня.
                  </div>
                ) : (
                  activeFeatures.map((feat, idx) => (
                    <div
                      key={feat.id || idx}
                      className="p-2 rounded bg-[#fbf6ea] border border-[#8c6a38]/40 shadow-xs space-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <strong className="text-[#2a1810] font-cinzel font-bold block leading-tight">
                          {feat.name}
                        </strong>
                        {feat.source && (
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 bg-amber-900/10 text-amber-900 rounded border border-amber-800/30 shrink-0">
                            {feat.source}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#4a2e16] leading-relaxed pt-0.5">
                        {feat.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

        {/* =========================================================
            4. BOTTOM ARCH PEDESTAL (ROMAN NUMERAL XXI - THE WORLD)
            ========================================================= */}
        <div className="mt-6 pt-4 border-t-2 border-[#8c6a38]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
          {/* Rest Actions */}
          <div className="flex items-center gap-2">
            {onRestAction && (
              <>
                <button
                  type="button"
                  onClick={() => onRestAction('short')}
                  className="px-3 py-1.5 rounded-xl bg-[#ebdcc4] hover:bg-amber-200 border border-[#8c6a38] text-xs font-cinzel font-bold text-[#2a1810] flex items-center gap-1.5 shadow-sm transition"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-700" />
                  <span>Короткий отдых</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRestAction('long')}
                  className="px-3 py-1.5 rounded-xl bg-[#ebdcc4] hover:bg-purple-200 border border-[#8c6a38] text-xs font-cinzel font-bold text-[#2a1810] flex items-center gap-1.5 shadow-sm transition"
                >
                  <Moon className="w-3.5 h-3.5 text-purple-700" />
                  <span>Длинный отдых</span>
                </button>
              </>
            )}
          </div>

          {/* Roman Numeral XXI Pedestal Plaque */}
          <div className="px-6 py-1.5 rounded-full bg-[#fbf6ea] border-2 border-[#8a6833] font-cinzel font-extrabold text-sm text-[#442813] shadow-md tracking-widest">
            XXI • МИР
          </div>

          {/* Bottom Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 text-amber-100 text-xs font-cinzel font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronUp className="w-4 h-4" />
              <span>Свернуть лист персонажа</span>
            </button>
          )}
        </div>

      </div>

      {/* =========================================================
          5. LEVEL UP MODAL (D&D 5e: HP, ABILITIES, ASI/FEATS, SPELLS)
          ========================================================= */}
      {isLevelUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="parchment-card max-w-xl w-full p-4 sm:p-6 space-y-4 shadow-2xl border-4 border-[#8c6a38] relative max-h-[90vh] overflow-y-auto">
            
            <div className="text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-800 tracking-widest">D&D 5e • Повышение Уровня</span>
              <h2 className="font-cinzel text-2xl font-black text-[#2a1810]">
                УРОВЕНЬ {xpInfo.level}!
              </h2>
              <p className="text-xs text-[#5c3c1e]">
                Ваши приключения принесли плоды. Настройте новые силы и способности для уровня {xpInfo.level}.
              </p>
            </div>

            {/* Stat Gains Info */}
            <div className="p-3 bg-[#fbf6ea] rounded-xl border border-[#8c6a38]/40 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-[#2a1810]">
                <span>Прибавка к здоровью (HP):</span>
                <span className="text-emerald-800 font-extrabold">+{calculateHpGainOnLevelUp(character.class, stats.con)} HP</span>
              </div>
              <div className="flex items-center justify-between font-bold text-[#2a1810]">
                <span>Бонус мастерства:</span>
                <span className="text-amber-900 font-extrabold">+{xpInfo.proficiencyBonus}</span>
              </div>
            </div>

            {/* Unlocked Class Features for this Level */}
            {(() => {
              const allClassFeats = DND_CLASS_FEATURES[character.class] || [];
              const newlyUnlocked = allClassFeats.filter((f) => f.level === xpInfo.level);
              if (newlyUnlocked.length === 0) return null;
              return (
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-600/40 space-y-2 text-xs">
                  <div className="font-cinzel font-bold text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                    <span>Новые способности класса ({xpInfo.level} ур.):</span>
                  </div>
                  {newlyUnlocked.map((feat) => (
                    <div key={feat.id} className="p-2.5 bg-[#fbf6ea] rounded-lg border border-[#8c6a38]/40 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <strong className="text-[#2a1810] font-cinzel block font-bold">{feat.name}</strong>
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-900/10 text-emerald-900 rounded font-bold border border-emerald-900/30">
                          ✓ Будет добавлено
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4a2e16] pt-0.5">{feat.description}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ASI / Feat selection (on levels 4, 8, 12, 16, 19) */}
            {(xpInfo.level % 4 === 0 || xpInfo.level === 19) && (
              <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-600/40 space-y-3 text-xs">
                <div className="font-cinzel font-bold text-purple-950 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-purple-800" />
                  <span>Увеличение характеристик или Черта ({xpInfo.level} ур.):</span>
                </div>

                {/* Choice radio buttons */}
                <div className="flex flex-wrap gap-2 bg-[#fbf6ea] p-2 rounded-lg border border-[#8c6a38]/30">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#2a1810]">
                    <input
                      type="radio"
                      name="lvlAsiMode"
                      checked={asiMode === '+2'}
                      onChange={() => setAsiMode('+2')}
                      className="accent-amber-800"
                    />
                    <span>+2 к одной</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#2a1810]">
                    <input
                      type="radio"
                      name="lvlAsiMode"
                      checked={asiMode === '+1+1'}
                      onChange={() => setAsiMode('+1+1')}
                      className="accent-amber-800"
                    />
                    <span>+1 к двум</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#2a1810]">
                    <input
                      type="radio"
                      name="lvlAsiMode"
                      checked={asiMode === 'feat'}
                      onChange={() => setAsiMode('feat')}
                      className="accent-purple-800"
                    />
                    <span>Взять черту (Feat)</span>
                  </label>
                </div>

                {/* Sub-inputs */}
                {asiMode === '+2' && (
                  <div className="space-y-1">
                    <label className="block font-bold text-[#2a1810]">Характеристика (+2):</label>
                    <select
                      value={asiSingleStat}
                      onChange={(e) => setAsiSingleStat(e.target.value as AbilityScoreKey)}
                      className="w-full bg-[#fbf6ea] border border-[#8c6a38] rounded-lg p-1.5 text-xs text-[#2a1810] font-bold focus:outline-none"
                    >
                      {(Object.keys(ABILITY_FULL_NAMES) as AbilityScoreKey[]).map((k) => (
                        <option key={k} value={k}>
                          {ABILITY_FULL_NAMES[k]?.ru} ({k.toUpperCase()}): сейчас {stats[k]} → станет {stats[k] + 2}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {asiMode === '+1+1' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-[#2a1810]">1-я (+1):</label>
                      <select
                        value={asiStat1}
                        onChange={(e) => setAsiStat1(e.target.value as AbilityScoreKey)}
                        className="w-full bg-[#fbf6ea] border border-[#8c6a38] rounded-lg p-1.5 text-xs text-[#2a1810] font-bold focus:outline-none"
                      >
                        {(Object.keys(ABILITY_FULL_NAMES) as AbilityScoreKey[]).map((k) => (
                          <option key={k} value={k}>
                            {ABILITY_FULL_NAMES[k]?.ru}: {stats[k]} → {stats[k] + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-[#2a1810]">2-я (+1):</label>
                      <select
                        value={asiStat2}
                        onChange={(e) => setAsiStat2(e.target.value as AbilityScoreKey)}
                        className="w-full bg-[#fbf6ea] border border-[#8c6a38] rounded-lg p-1.5 text-xs text-[#2a1810] font-bold focus:outline-none"
                      >
                        {(Object.keys(ABILITY_FULL_NAMES) as AbilityScoreKey[]).map((k) => (
                          <option key={k} value={k}>
                            {ABILITY_FULL_NAMES[k]?.ru}: {stats[k]} → {stats[k] + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {asiMode === 'feat' && (
                  <div className="space-y-1">
                    <label className="block font-bold text-[#2a1810]">Выберите черту:</label>
                    <select
                      value={selectedFeatId}
                      onChange={(e) => setSelectedFeatId(e.target.value)}
                      className="w-full bg-[#fbf6ea] border border-[#8c6a38] rounded-lg p-1.5 text-xs text-[#2a1810] font-bold focus:outline-none"
                    >
                      {DND_FEATS.map((feat) => (
                        <option key={feat.id} value={feat.id}>
                          {feat.name}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const sel = DND_FEATS.find((f) => f.id === selectedFeatId);
                      return sel ? <p className="text-[10px] text-[#5c3c1e] italic pt-1">{sel.description}</p> : null;
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Spellcaster Additions (Cantrips & Spells) */}
            {isCaster && (
              <div className="space-y-3 border-t border-[#8c6a38]/30 pt-3 text-xs">
                <div>
                  <label className="block font-bold text-[#442813] mb-1">
                    Новый фокус (0 уровень):
                  </label>
                  <input
                    type="text"
                    value={newCantripInput}
                    onChange={(e) => setNewCantripInput(e.target.value)}
                    placeholder={classCantripSuggestions[0] || 'Например: Свет, Огненный снаряд...'}
                    className="w-full bg-[#fbf6ea] border border-[#8c6a38] rounded-xl px-3 py-1.5 text-xs text-[#2a1810] focus:outline-none"
                  />
                  {classCantripSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {classCantripSuggestions.slice(0, 3).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewCantripInput(s)}
                          className="text-[9px] px-1.5 py-0.5 bg-[#ebdcc4] hover:bg-amber-200 rounded border border-[#8c6a38]/40 text-[#442813]"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#442813] mb-1">
                    Новое заклинание:
                  </label>
                  <input
                    type="text"
                    value={newSpellInput}
                    onChange={(e) => setNewSpellInput(e.target.value)}
                    placeholder={classSpellSuggestions[0] || 'Например: Огненный шар, Щит...'}
                    className="w-full bg-[#fbf6ea] border border-[#8c6a38] rounded-xl px-3 py-1.5 text-xs text-[#2a1810] focus:outline-none"
                  />
                  {classSpellSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {classSpellSuggestions.slice(0, 3).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewSpellInput(s)}
                          className="text-[9px] px-1.5 py-0.5 bg-[#ebdcc4] hover:bg-amber-200 rounded border border-[#8c6a38]/40 text-[#442813]"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#8c6a38]/30">
              <button
                type="button"
                onClick={() => setIsLevelUpModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[#8c6a38] text-xs text-[#5c3c1e] hover:bg-[#ebdcc4] cursor-pointer"
              >
                Отложить
              </button>
              <button
                type="button"
                onClick={handleConfirmLevelUp}
                className="px-5 py-2 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-100 font-cinzel font-bold text-xs rounded-xl shadow-lg border border-amber-400 cursor-pointer transition flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Принять уровень {xpInfo.level}!</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};


