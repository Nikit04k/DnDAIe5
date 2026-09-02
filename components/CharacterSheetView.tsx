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
  SKILL_ABILITY_MAP,
  SKILL_RUSSIAN_NAMES,
  ABILITY_FULL_NAMES,
  normalizeRationItem,
} from '@/lib/dndRules';
import {
  Heart,
  Shield,
  Zap,
  Footprints,
  Sparkles,
  Coins,
  Package,
  Moon,
  Sun,
  Scroll,
  Edit3,
  Check,
  Plus,
  Trash2,
  Sword,
  Shirt,
  Crosshair,
  Gem,
  ArrowRight,
  FlaskConical,
  Flame,
  Utensils,
  BookOpen,
} from 'lucide-react';
import { playDamageSound, playHealSound, playCoinSound, playDiceRollSound } from '@/lib/diceSound';

interface CharacterSheetProps {
  character: CharacterSheet;
  onUpdateCharacter: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
  onRollStat: (statKey: AbilityScoreKey, statName: string, modifier: number) => void;
  onRollSkill: (skillName: SkillName, modifier: number) => void;
  onRestAction?: (restType: 'short' | 'long') => void;
  onItemUsed?: (itemName: string, narrativeAction: string) => void;
}

// Helper to determine if an item is consumable/usable (potion, scroll, food, torch, etc.)
export function isConsumableItem(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('зелье') ||
    lower.includes('эликсир') ||
    lower.includes('снадобье') ||
    lower.includes('флакон') ||
    lower.includes('святая вода') ||
    lower.includes('яд') ||
    lower.includes('свиток') ||
    lower.includes('рацион') ||
    lower.includes('сухпаек') ||
    lower.includes('еда') ||
    lower.includes('бинт') ||
    lower.includes('аптечка') ||
    lower.includes('факел') ||
    lower.includes('огниво') ||
    lower.includes('свеч') ||
    lower.includes('елей') ||
    lower.includes('мазь') ||
    lower.includes('настойк') ||
    lower.includes('травы') ||
    lower.includes('растени') ||
    lower.includes('элем') ||
    lower.includes('пиво') ||
    lower.includes('вино')
  );
}

// Helper to determine item slot icon
function getItemSlotIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('зелье') || lower.includes('эликсир') || lower.includes('флакон') || lower.includes('вода') || lower.includes('мазь') || lower.includes('елей')) {
    return <FlaskConical className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
  }
  if (lower.includes('свиток') || lower.includes('гримуар') || lower.includes('книга')) {
    return <Scroll className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
  }
  if (lower.includes('рацион') || lower.includes('сухпаек') || lower.includes('элем') || lower.includes('фляга')) {
    return <Utensils className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
  }
  if (lower.includes('факел') || lower.includes('огниво') || lower.includes('свеч')) {
    return <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />;
  }
  if (lower.includes('меч') || lower.includes('кинжал') || lower.includes('молот') || lower.includes('секира') || lower.includes('посох') || lower.includes('шпага') || lower.includes('рапира') || lower.includes('лук') || lower.includes('арбалет') || lower.includes('топор')) {
    return <Sword className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  }
  if (lower.includes('щит')) {
    return <Shield className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  }
  if (lower.includes('доспех') || lower.includes('кольчуг') || lower.includes('рубах') || lower.includes('камзол') || lower.includes('жилет') || lower.includes('мантия') || lower.includes('чешуй')) {
    return <Shirt className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
  }
  if (lower.includes('амулет') || lower.includes('кольцо') || lower.includes('тотем') || lower.includes('символ') || lower.includes('кристалл') || lower.includes('оберег')) {
    return <Gem className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
  }
  if (lower.includes('плащ') || lower.includes('шлем') || lower.includes('сапог') || lower.includes('перчатк')) {
    return <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
  }
  return <Package className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
}

export const CharacterSheetView: React.FC<CharacterSheetProps> = ({
  character,
  onUpdateCharacter,
  onRollStat,
  onRollSkill,
  onRestAction,
  onItemUsed,
}) => {
  const [activeTab, setActiveTab] = useState<'vitals' | 'skills' | 'equipment' | 'lore'>('vitals');
  const [isEditingLore, setIsEditingLore] = useState(false);
  const [newBackpackItem, setNewBackpackItem] = useState('');
  const [showAddBackpack, setShowAddBackpack] = useState(false);
  const [newEquippedItem, setNewEquippedItem] = useState('');
  const [showAddEquipped, setShowAddEquipped] = useState(false);
  const [usedItemNotice, setUsedItemNotice] = useState<string | null>(null);

  const equippedList = character.equippedItems || [];
  const backpackList = (character.inventory || []).map(normalizeRationItem);

  // Equip item: move from backpack to equipped (for weapons, armor, etc.)
  const handleEquipItem = (itemToEquip: string) => {
    onUpdateCharacter((prev) => {
      const currentEquipped = prev.equippedItems || [];
      const updatedInv = (prev.inventory || []).map(normalizeRationItem).filter((it) => it !== itemToEquip);
      return {
        ...prev,
        inventory: updatedInv,
        equippedItems: [...currentEquipped, itemToEquip],
      };
    });
  };

  // Unequip item: move from equipped to backpack
  const handleUnequipItem = (itemToUnequip: string) => {
    onUpdateCharacter((prev) => {
      const currentEquipped = prev.equippedItems || [];
      const updatedEquipped = currentEquipped.filter((it) => it !== itemToUnequip);
      const currentInv = (prev.inventory || []).map(normalizeRationItem);
      return {
        ...prev,
        equippedItems: updatedEquipped,
        inventory: [...currentInv, itemToUnequip],
      };
    });
  };

  // Use / Consume item (potions, scrolls, food, rations, torches, etc.)
  const handleUseItem = (itemToUse: string, index: number) => {
    const normalized = normalizeRationItem(itemToUse);
    const lower = normalized.toLowerCase();
    let healAmount = 0;
    let effectMessage = `Игрок применил: ${normalized}`;
    let nextItemState: string | null = null; // null means consume and remove; string means replace with decremented piece count

    if (lower.includes('зелье лечения') || lower.includes('лечения') || lower.includes('исцелени') || lower.includes('аптечка')) {
      // Roll 2d4 + 2
      const d1 = Math.floor(Math.random() * 4) + 1;
      const d2 = Math.floor(Math.random() * 4) + 1;
      healAmount = d1 + d2 + 2;
      effectMessage = `Выпито зелье лечения: ${normalized} (+${healAmount} HP)`;
      playHealSound();
    } else if (lower.includes('рацион') || lower.includes('сухпаек') || lower.includes('еда')) {
      healAmount = 2;
      // 1 штука = 1 день пропитания
      const countMatch = normalized.match(/(?:сухпаек|сухой па[её]к|рацион).*?\((\d+)\s*шт\.?\)/i);
      if (countMatch) {
        const count = parseInt(countMatch[1], 10);
        if (count > 1) {
          const remaining = count - 1;
          nextItemState = `Сухпаек (${remaining} шт.)`;
          effectMessage = `Съеден сухпаек (1 шт. на 1 день, осталось: ${remaining} шт.) (+2 HP)`;
        } else {
          nextItemState = null;
          effectMessage = `Съеден последний сухпаек (1 шт. на 1 день) (+2 HP)`;
        }
      } else {
        nextItemState = null;
        effectMessage = `Съеден сухпаек (1 шт. на 1 день) (+2 HP)`;
      }
      playHealSound();
    } else {
      effectMessage = `Использован предмет: ${normalized}`;
      playDiceRollSound();
    }

    // Apply HP changes & update consumed item in backpack
    onUpdateCharacter((prev) => {
      const currentInv = (prev.inventory || []).map(normalizeRationItem);
      let newInv: string[];
      if (nextItemState) {
        newInv = [...currentInv];
        newInv[index] = nextItemState;
      } else {
        newInv = currentInv.filter((_, i) => i !== index);
      }
      const newHp = healAmount > 0 ? Math.min(prev.maxHp, prev.currentHp + healAmount) : prev.currentHp;
      return {
        ...prev,
        currentHp: newHp,
        inventory: newInv,
      };
    });

    setUsedItemNotice(effectMessage);
    setTimeout(() => setUsedItemNotice(null), 4000);

    // Notify DM & Chat so neural network sees and reacts to item usage
    if (onItemUsed) {
      onItemUsed(normalized, effectMessage);
    }
  };

  // Remove backpack item
  const handleRemoveBackpackItem = (index: number) => {
    onUpdateCharacter((prev) => {
      const currentInv = (prev.inventory || []).map(normalizeRationItem);
      return {
        ...prev,
        inventory: currentInv.filter((_, i) => i !== index),
      };
    });
  };

  // Remove equipped item
  const handleRemoveEquippedItem = (index: number) => {
    onUpdateCharacter((prev) => {
      const currentEquipped = prev.equippedItems || [];
      return {
        ...prev,
        equippedItems: currentEquipped.filter((_, i) => i !== index),
      };
    });
  };

  // Add custom backpack item
  const handleAddBackpackItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBackpackItem.trim()) return;
    const normalized = normalizeRationItem(newBackpackItem.trim());
    onUpdateCharacter((prev) => {
      const currentInv = (prev.inventory || []).map(normalizeRationItem);
      return {
        ...prev,
        inventory: [...currentInv, normalized],
      };
    });
    setNewBackpackItem('');
    setShowAddBackpack(false);
  };

  // Add custom equipped item
  const handleAddEquippedItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquippedItem.trim()) return;
    onUpdateCharacter((prev) => {
      const currentEquipped = prev.equippedItems || [];
      return {
        ...prev,
        equippedItems: [...currentEquipped, newEquippedItem.trim()],
      };
    });
    setNewEquippedItem('');
    setShowAddEquipped(false);
  };

  // Short Rest Trigger (narrated by DM)
  const handleShortRest = () => {
    if (onRestAction) {
      onRestAction('short');
    } else {
      const conMod = getAbilityModifier(character.stats.con);
      const hitDieSize =
        character.class.toLowerCase().includes('воин') ||
        character.class.toLowerCase().includes('fighter') ||
        character.class.toLowerCase().includes('паладин') ||
        character.class.toLowerCase().includes('paladin')
          ? 10
          : 8;
      const roll = Math.floor(Math.random() * hitDieSize) + 1;
      const healAmount = Math.max(1, roll + conMod);

      playHealSound();
      onUpdateCharacter((prev) => ({
        ...prev,
        currentHp: Math.min(prev.maxHp, prev.currentHp + healAmount),
        hitDiceCurrent: Math.max(0, (prev.hitDiceCurrent ?? 1) - 1),
      }));
    }
  };

  // Long Rest Trigger (narrated by DM)
  const handleLongRest = () => {
    if (onRestAction) {
      onRestAction('long');
    } else {
      playHealSound();
      onUpdateCharacter((prev) => ({
        ...prev,
        currentHp: prev.maxHp,
        tempHp: 0,
        hitDiceCurrent: prev.hitDiceMax || prev.level || 1,
        deathSaves: { successes: 0, failures: 0 },
      }));
    }
  };

  const hpPercentage = Math.round((character.currentHp / (character.maxHp || 1)) * 100);

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80">
      {/* Character Header Banner */}
      <div className="p-4 border-b border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/40">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-cinzel text-lg font-bold text-amber-300 truncate max-w-[180px] sm:max-w-[220px]">
                {character.name}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                Ур. {character.level}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {character.race} • {character.class}
            </p>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Бонус мастерства
            </span>
            <span className="text-sm font-bold text-amber-400 font-cinzel">
              +{character.proficiencyBonus || 2}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 gap-1 mt-3 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setActiveTab('vitals')}
            className={`py-1.5 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'vitals'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Статы
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`py-1.5 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'skills'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Навыки
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`py-1.5 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'equipment'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Вещи ({equippedList.length + backpackList.length})
          </button>
          <button
            onClick={() => setActiveTab('lore')}
            className={`py-1.5 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'lore'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Лор героя
          </button>
        </div>
      </div>

      {/* Notice Toast for Item Usage */}
      {usedItemNotice && (
        <div className="mx-3 mt-2 p-2 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn shadow-sm">
          <FlaskConical className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{usedItemNotice}</span>
        </div>
      )}

      {/* Main Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: VITALS & STATS + BACKPACK (UN-EQUIPPED) & GOLD */}
        {activeTab === 'vitals' && (
          <>
            {/* HP & Health Meter */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-500 fill-red-500/30" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Очки Здоровья (HP)
                  </span>
                </div>
                <div className="text-sm font-extrabold text-slate-100">
                  <span className={character.currentHp < character.maxHp * 0.3 ? 'text-red-400' : 'text-emerald-400'}>
                    {character.currentHp}
                  </span>
                  <span className="text-slate-500"> / {character.maxHp}</span>
                  {character.tempHp && character.tempHp > 0 && (
                    <span className="text-cyan-400 text-xs font-semibold ml-1">
                      (+{character.tempHp} вр.)
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    hpPercentage > 50
                      ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                      : hpPercentage > 25
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-red-600 to-red-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, hpPercentage))}%` }}
                />
              </div>
            </div>

            {/* Combat Stats Grid (AC, Speed, Initiative) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center shadow-sm">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] uppercase font-bold">Броня (AC)</span>
                </div>
                <span className="text-base font-bold text-slate-100">{character.ac}</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center shadow-sm">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                  <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] uppercase font-bold">Скорость</span>
                </div>
                <span className="text-base font-bold text-slate-100">{character.speed || 30} фт</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center shadow-sm">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] uppercase font-bold">Инициатива</span>
                </div>
                <span className="text-base font-bold text-slate-100">
                  {formatModifier(getAbilityModifier(character.stats.dex))}
                </span>
              </div>
            </div>

            {/* Ability Scores Grid */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Базовые Характеристики (клик для броска d20)
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(character.stats) as AbilityScoreKey[]).map((statKey) => {
                  const score = character.stats[statKey];
                  const mod = getAbilityModifier(score);
                  const isProficientSave = character.savingThrowProficiencies?.includes(statKey);
                  const saveMod = getSavingThrowModifier(character, statKey);

                  return (
                    <button
                      key={statKey}
                      onClick={() => onRollStat(statKey, ABILITY_FULL_NAMES[statKey].ru, mod)}
                      className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-xl p-2 text-center transition group cursor-pointer shadow-sm relative overflow-hidden"
                    >
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 group-hover:text-amber-400 block">
                        {statKey.toUpperCase()}
                      </span>
                      <span className="text-lg font-black text-amber-300 font-cinzel block my-0.5">
                        {formatModifier(mod)}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-medium">Спас: {formatModifier(saveMod)}</span>
                      {isProficientSave && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ================= BACKPACK & GOLD ================= */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Рюкзак & Золото
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30 text-amber-300 text-xs font-bold font-mono">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{character.gold || 0} GP</span>
                </div>
              </div>

              {/* Items in Backpack */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Предметы в сумке ({backpackList.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddBackpack(!showAddBackpack)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showAddBackpack ? 'Скрыть' : 'Добавить'}</span>
                  </button>
                </div>

                {showAddBackpack && (
                  <form onSubmit={handleAddBackpackItem} className="flex gap-1 pt-1">
                    <input
                      type="text"
                      placeholder="Название предмета..."
                      value={newBackpackItem}
                      onChange={(e) => setNewBackpackItem(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      +
                    </button>
                  </form>
                )}

                {backpackList.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic p-2 bg-slate-950/60 rounded-lg text-center border border-slate-800/80">
                    Рюкзак пуст. Найденные в приключении трофеи и зелья попадают сюда.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                    {backpackList.map((item, idx) => {
                      const consumable = isConsumableItem(item);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/90 text-xs hover:border-slate-700 transition"
                        >
                          <div className="flex items-center gap-2 text-slate-200 text-[11px] font-medium truncate pr-1">
                            {getItemSlotIcon(item)}
                            <span className="truncate">{item}</span>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {consumable ? (
                              <button
                                type="button"
                                onClick={() => handleUseItem(item, idx)}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer shadow-sm"
                                title="Применить / выпить этот предмет"
                              >
                                <FlaskConical className="w-2.5 h-2.5" />
                                <span>Применить</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEquipItem(item)}
                                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer shadow-sm"
                                title="Надеть этот предмет"
                              >
                                <Sword className="w-2.5 h-2.5" />
                                <span>Надеть</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveBackpackItem(idx)}
                              className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition cursor-pointer"
                              title="Удалить / выбросить"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Resting Actions */}
            <div className="pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1 mb-2">
                Отдых и Восстановление сил
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleShortRest}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 text-amber-300 flex items-center justify-center gap-2 text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Короткий отдых</span>
                </button>
                <button
                  onClick={handleLongRest}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-indigo-300 flex items-center justify-center gap-2 text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span>Длительный отдых</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: SKILLS */}
        {activeTab === 'skills' && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
              Навыки D&D 5e (клик для броска d20)
            </span>
            <div className="space-y-1">
              {(Object.keys(SKILL_RUSSIAN_NAMES) as SkillName[]).map((skillKey) => {
                const isProficient = character.skillProficiencies?.includes(skillKey);
                const mod = getSkillModifier(character, skillKey);
                const relatedStat = SKILL_ABILITY_MAP[skillKey];

                return (
                  <button
                    key={skillKey}
                    onClick={() => onRollSkill(skillKey, mod)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer border ${
                      isProficient
                        ? 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/30 text-amber-200 font-medium'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isProficient ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-slate-700'
                        }`}
                      />
                      <span>{SKILL_RUSSIAN_NAMES[skillKey]}</span>
                      <span className="text-[10px] text-slate-600 uppercase font-bold">
                        ({relatedStat.toUpperCase()})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-300">{formatModifier(mod)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: EQUIPPED GEAR (НАДЕТОЕ СНАРЯЖЕНИЕ) */}
        {activeTab === 'equipment' && (
          <div className="space-y-4">
            {/* Header & Quick Action */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-100 block">
                      Надетое снаряжение ({equippedList.length})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Оружие в руках, надетая броня, щит и экипированные артефакты
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddEquipped(!showAddEquipped)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Надеть новое</span>
                </button>
              </div>

              {showAddEquipped && (
                <form onSubmit={handleAddEquippedItem} className="flex gap-1 pt-1">
                  <input
                    type="text"
                    placeholder="Например: Длинный меч, Кольчуга..."
                    value={newEquippedItem}
                    onChange={(e) => setNewEquippedItem(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    + Надеть
                  </button>
                </form>
              )}
            </div>

            {/* Equipped Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Экипировано на герое:
                </span>
                <span className="text-[10px] text-slate-500">
                  AC: {character.ac}
                </span>
              </div>

              {equippedList.length === 0 ? (
                <div className="p-4 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-1.5">
                  <p className="text-xs text-slate-400 font-medium">На герое ничего не надето.</p>
                  <p className="text-[11px] text-slate-500">
                    Перейдите на вкладку «Статы» и нажмите «Надеть» у любого оружия или доспеха в рюкзаке.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {equippedList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/95 border border-slate-800 hover:border-amber-500/30 text-xs shadow-sm transition"
                    >
                      <div className="flex items-center gap-2.5 text-slate-100 font-semibold truncate pr-2">
                        <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                          {getItemSlotIcon(item)}
                        </div>
                        <span className="truncate">{item}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUnequipItem(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer"
                          title="Снять предмет и положить в рюкзак"
                        >
                          <Package className="w-3 h-3 text-amber-400" />
                          <span>В рюкзак</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveEquippedItem(idx)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                          title="Снять и выбросить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: LORE & BACKSTORY */}
        {activeTab === 'lore' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
                <Scroll className="w-3.5 h-3.5" />
                Лор и личность персонажа
              </span>
              <button
                onClick={() => setIsEditingLore(!isEditingLore)}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {isEditingLore ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                <span>{isEditingLore ? 'Готово' : 'Редактировать'}</span>
              </button>
            </div>

            {/* Bio / Backstory */}
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Биография и прошлое
              </span>
              {isEditingLore ? (
                <textarea
                  value={character.bio || ''}
                  onChange={(e) =>
                    onUpdateCharacter((prev) => ({
                      ...prev,
                      bio: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 min-h-[90px]"
                />
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  {character.bio || character.backstory || 'История героя пока не записана...'}
                </p>
              )}
            </div>

            {/* Personality Traits */}
            {character.personalityTraits && (
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Черты характера и идеалы
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {character.personalityTraits}
                </p>
              </div>
            )}

            {/* Motivation */}
            {character.motivation && (
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Мотивация и цель приключения
                </span>
                <p className="text-xs text-slate-300 leading-relaxed text-amber-200/90">
                  {character.motivation}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
