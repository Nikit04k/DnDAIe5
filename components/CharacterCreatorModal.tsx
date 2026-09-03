'use client';

import React, { useState, useEffect } from 'react';
import {
  CharacterPreset,
  CharacterSheet,
  WorldSettings,
  GameDifficulty,
  Stats,
  AbilityScoreKey,
  SkillName,
} from '@/types/dnd';
import { DIFFICULTY_PROFILES, DIFFICULTY_ORDER } from '@/lib/difficultySettings';
import {
  CHARACTER_PRESETS,
  getAbilityModifier,
  formatModifier,
  POINT_BUY_TOTAL_BUDGET,
  getPointBuyCost,
  getTotalPointBuySpent,
  DND_5E_RACES,
  DND_5E_CLASSES,
  getDnd5eHpDetails,
  calculateDnd5eAc,
  Dnd5eRace,
  Dnd5eClass,
  DND_5E_ARMOR_OPTIONS,
  DND_5E_PRIMARY_WEAPONS,
  DND_5E_SECONDARY_OPTIONS,
  DND_5E_ADVENTURING_PACKS,
  ABILITY_FULL_NAMES,
  normalizeRationItem,
  isClassSpellcaster,
  CANTRIP_SUGGESTIONS_BY_CLASS,
  SPELL_SUGGESTIONS_BY_CLASS,
} from '@/lib/dndRules';
import {
  Sparkles,
  Shield,
  Heart,
  Swords,
  Globe,
  Feather,
  Trash2,
  Compass,
  User,
  Scroll,
  Plus,
  Minus,
  Zap,
  Package,
  X,
} from 'lucide-react';
import { playDiceRollSound } from '@/lib/diceSound';

interface CharacterCreatorModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onStartCampaign: (character: CharacterSheet, world: WorldSettings) => void;
  initialWorld?: WorldSettings;
}

type StatGenerationMode = 'point_buy' | 'standard_array';

export const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({
  isOpen,
  onClose,
  onStartCampaign,
  initialWorld,
}) => {
  // Navigation section
  const [activeSection, setActiveSection] = useState<'lore' | 'world' | 'stats'>('lore');

  // 1. Character Identity & Lore
  const [name, setName] = useState('');
  const [race, setRace] = useState('Человек');
  const [characterClass, setCharacterClass] = useState('Воин');
  const [background, setBackground] = useState('Искатель приключений');
  const [bio, setBio] = useState('');
  const [backstory, setBackstory] = useState('');
  const [motivation, setMotivation] = useState('');
  const [personalityTraits, setPersonalityTraits] = useState('');
  const [appearance, setAppearance] = useState('');

  // 2. Worldbuilding & Setting (Synchronized with Settings)
  const [customSetting, setCustomSetting] = useState(initialWorld?.customSetting || '');
  const [customTone, setCustomTone] = useState(initialWorld?.customTone || '');
  const [customRules, setCustomRules] = useState(initialWorld?.customRules || '');
  const [startingScene, setStartingScene] = useState(initialWorld?.startingScene || '');
  const [xpMultiplier, setXpMultiplier] = useState<number>(initialWorld?.xpMultiplier || 1);
  const [difficulty, setDifficulty] = useState<GameDifficulty>(initialWorld?.difficulty || 'standard');

  // Synchronize world parameters when modal opens
  useEffect(() => {
    if (isOpen && initialWorld) {
      if (initialWorld.customSetting) setCustomSetting(initialWorld.customSetting);
      if (initialWorld.customTone) setCustomTone(initialWorld.customTone);
      if (initialWorld.customRules) setCustomRules(initialWorld.customRules);
      if (initialWorld.xpMultiplier) setXpMultiplier(initialWorld.xpMultiplier);
      if (initialWorld.difficulty) setDifficulty(initialWorld.difficulty);
    }
  }, [isOpen, initialWorld]);

  // 3. Stat Generation Mode (Point Buy or Standard Array only)
  const [statMode, setStatMode] = useState<StatGenerationMode>('point_buy');

  // Base stats (before racial bonuses)
  const [baseStats, setBaseStats] = useState<Stats>({
    str: 15,
    dex: 14,
    con: 13,
    int: 12,
    wis: 10,
    cha: 8,
  });

  // Selected Race preset for bonuses
  const [selectedRaceId, setSelectedRaceId] = useState<string>('human');
  const [selectedClassId, setSelectedClassId] = useState<string>('fighter');

  // Armor & Shield Selection
  const [selectedArmorId, setSelectedArmorId] = useState<string>('chain_mail');
  const [hasShield, setHasShield] = useState<boolean>(true);

  // Weapons & Equipment Selection
  const [selectedPrimaryWeaponId, setSelectedPrimaryWeaponId] = useState<string>('longsword');
  const [selectedSecondaryId, setSelectedSecondaryId] = useState<string>('handaxes_pair');
  const [selectedPackId, setSelectedPackId] = useState<string>('dungeoneer');

  // Bonus Consumables
  const [hasHealingPotion, setHasHealingPotion] = useState<boolean>(true);
  const [hasLantern, setHasLantern] = useState<boolean>(false);
  const [hasRope, setHasRope] = useState<boolean>(false);
  const [hasHolyWater, setHasHolyWater] = useState<boolean>(false);

  // Starter Gold (clamped to max 500)
  const [gold, setGold] = useState(25);

  // Selected saving throws & skills
  const [savingThrows, setSavingThrows] = useState<AbilityScoreKey[]>(['str', 'con']);
  const [skillProficiencies, setSkillProficiencies] = useState<SkillName[]>([
    'Athletics',
    'Perception',
    'Acrobatics',
  ]);

  // Find active race bonuses
  const activeRace = DND_5E_RACES.find((r) => r.id === selectedRaceId);
  const racialBonuses: Partial<Stats> = activeRace ? activeRace.bonuses : {};

  // Compute final effective stats: Base + Racial Bonus
  const finalStats: Stats = {
    str: (baseStats.str || 8) + (racialBonuses.str || 0),
    dex: (baseStats.dex || 8) + (racialBonuses.dex || 0),
    con: (baseStats.con || 8) + (racialBonuses.con || 0),
    int: (baseStats.int || 8) + (racialBonuses.int || 0),
    wis: (baseStats.wis || 8) + (racialBonuses.wis || 0),
    cha: (baseStats.cha || 8) + (racialBonuses.cha || 0),
  };

  // Point buy points tracking
  const pointsSpent = getTotalPointBuySpent(baseStats);
  const pointsRemaining = POINT_BUY_TOTAL_BUDGET - pointsSpent;

  // Fully Automated 5e HP & AC calculation with custom Armor & Shield
  const hpDetails = getDnd5eHpDetails(characterClass || selectedClassId, finalStats.con);
  const acDetails = calculateDnd5eAc(characterClass || selectedClassId, finalStats, selectedArmorId, hasShield);
  const computedMaxHp = hpDetails.hp;
  const computedAc = acDetails.ac;

  // Compile active inventory list
  const primaryWeaponObj = DND_5E_PRIMARY_WEAPONS.find((w) => w.id === selectedPrimaryWeaponId);
  const secondaryObj = DND_5E_SECONDARY_OPTIONS.find((s) => s.id === selectedSecondaryId);
  const packObj = DND_5E_ADVENTURING_PACKS.find((p) => p.id === selectedPackId);
  const activeArmor = DND_5E_ARMOR_OPTIONS.find((a) => a.id === selectedArmorId);

  const compiledInventory: string[] = [
    ...(primaryWeaponObj && primaryWeaponObj.id !== 'none' ? [`${primaryWeaponObj.nameRu} (${primaryWeaponObj.damage})`] : []),
    ...(secondaryObj && secondaryObj.id !== 'none' ? [secondaryObj.nameRu] : []),
    ...(packObj && packObj.id !== 'none' ? packObj.items : []),
    ...(hasHealingPotion ? ['Зелье лечения (2d4+2 HP)'] : []),
    ...(hasLantern ? ['Масляный фонарь и 2 фляги масла'] : []),
    ...(hasRope ? ['Шелковая веревка с кошкой (15м)'] : []),
    ...(hasHolyWater ? ['Флакон со святой водой'] : []),
  ];

  if (!isOpen) return null;

  // Handle Race selection
  const handleSelectRace = (raceItem: Dnd5eRace) => {
    setSelectedRaceId(raceItem.id);
    setRace(raceItem.nameRu);
  };

  // Handle Class selection
  const handleSelectClass = (classItem: Dnd5eClass) => {
    setSelectedClassId(classItem.id);
    setCharacterClass(classItem.nameRu.split(' ')[0]);
    setSavingThrows([...classItem.savingThrows]);
    setSkillProficiencies([...classItem.defaultSkills]);

    // Set sensible default armor, shield, weapons & pack based on class
    const lowerId = classItem.id.toLowerCase();
    if (lowerId === 'fighter' || lowerId === 'paladin') {
      setSelectedArmorId('chain_mail');
      setHasShield(true);
      setSelectedPrimaryWeaponId('longsword');
      setSelectedSecondaryId('handaxes_pair');
      setSelectedPackId('dungeoneer');
    } else if (lowerId === 'barbarian') {
      setSelectedArmorId('none');
      setHasShield(false);
      setSelectedPrimaryWeaponId('greataxe');
      setSelectedSecondaryId('handaxes_pair');
      setSelectedPackId('explorer');
    } else if (lowerId === 'rogue') {
      setSelectedArmorId('studded_leather');
      setHasShield(false);
      setSelectedPrimaryWeaponId('rapier');
      setSelectedSecondaryId('thieves_tools');
      setSelectedPackId('burglar');
    } else if (lowerId === 'ranger') {
      setSelectedArmorId('studded_leather');
      setHasShield(false);
      setSelectedPrimaryWeaponId('longbow');
      setSelectedSecondaryId('shortsword');
      setSelectedPackId('explorer');
    } else if (lowerId === 'cleric') {
      setSelectedArmorId('scale_mail');
      setHasShield(true);
      setSelectedPrimaryWeaponId('warhammer');
      setSelectedSecondaryId('holy_symbol');
      setSelectedPackId('priest');
    } else if (lowerId === 'wizard') {
      setSelectedArmorId('none');
      setHasShield(false);
      setSelectedPrimaryWeaponId('quarterstaff');
      setSelectedSecondaryId('spellbook');
      setSelectedPackId('scholar');
    } else if (lowerId === 'bard') {
      setSelectedArmorId('leather');
      setHasShield(false);
      setSelectedPrimaryWeaponId('rapier');
      setSelectedSecondaryId('musical_instrument');
      setSelectedPackId('diplomat');
    } else if (lowerId === 'monk') {
      setSelectedArmorId('none');
      setHasShield(false);
      setSelectedPrimaryWeaponId('quarterstaff');
      setSelectedSecondaryId('daggers_pair');
      setSelectedPackId('dungeoneer');
    } else if (lowerId === 'druid') {
      setSelectedArmorId('leather');
      setHasShield(true);
      setSelectedPrimaryWeaponId('quarterstaff');
      setSelectedSecondaryId('herbalism_kit');
      setSelectedPackId('explorer');
    } else {
      setSelectedArmorId('leather');
      setHasShield(false);
      setSelectedPrimaryWeaponId('light_crossbow');
      setSelectedSecondaryId('daggers_pair');
      setSelectedPackId('scholar');
    }
  };

  // Point Buy handlers
  const handlePointBuyAdjust = (statKey: AbilityScoreKey, delta: number) => {
    const currentVal = baseStats[statKey] || 8;
    const newVal = currentVal + delta;

    if (newVal < 8 || newVal > 15) return;

    const testStats = { ...baseStats, [statKey]: newVal };
    const newPointsSpent = getTotalPointBuySpent(testStats);

    if (delta > 0 && newPointsSpent > POINT_BUY_TOTAL_BUDGET) return;

    setBaseStats(testStats);
  };

  // Apply Standard Array Preset
  const handleApplyStandardArrayPreset = (archetype: 'str' | 'dex' | 'int' | 'wis' | 'cha') => {
    playDiceRollSound();
    if (archetype === 'str') {
      setBaseStats({ str: 15, con: 14, dex: 13, wis: 12, cha: 10, int: 8 });
    } else if (archetype === 'dex') {
      setBaseStats({ dex: 15, con: 14, wis: 13, cha: 12, int: 10, str: 8 });
    } else if (archetype === 'int') {
      setBaseStats({ int: 15, con: 14, dex: 13, wis: 12, cha: 10, str: 8 });
    } else if (archetype === 'wis') {
      setBaseStats({ wis: 15, con: 14, dex: 13, str: 12, cha: 10, int: 8 });
    } else {
      setBaseStats({ cha: 15, dex: 14, con: 13, wis: 12, int: 10, str: 8 });
    }
  };

  // Clear all fields for a 100% blank canvas
  const handleClearAll = () => {
    setName('');
    setRace('Человек');
    setCharacterClass('Воин');
    setBackground('');
    setBio('');
    setBackstory('');
    setMotivation('');
    setPersonalityTraits('');
    setAppearance('');
    setCustomSetting('');
    setCustomTone('');
    setCustomRules('');
    setStartingScene('');
    setBaseStats({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
    setGold(25);
  };

  // Load a template into editable fields if player wants inspiration
  const handleLoadTemplate = (preset: CharacterPreset) => {
    setName(preset.name);
    setRace(preset.race);
    setCharacterClass(preset.class);
    setBackground(preset.background);
    setBio(preset.bio);
    setBaseStats(preset.stats);
    setGold(Math.min(500, preset.gold || 25));
  };

  const isPointBuyOverspent = statMode === 'point_buy' && pointsRemaining < 0;

  const handleLaunch = () => {
    if (isPointBuyOverspent) {
      return;
    }

    const armorItemName = activeArmor && activeArmor.id !== 'none'
      ? `${activeArmor.nameRu.split(' (')[0]} (AC ${activeArmor.baseAc})`
      : 'Походная одежда';
    const shieldItemName = hasShield ? 'Щит (+2 AC)' : null;
    const mainWeaponName = primaryWeaponObj && primaryWeaponObj.id !== 'none'
      ? `${primaryWeaponObj.nameRu} (${primaryWeaponObj.damage})`
      : 'Безоружный бой (Кулаки)';
    const secondaryItemName = secondaryObj && secondaryObj.id !== 'none' ? secondaryObj.nameRu : null;

    const equippedArray = [
      mainWeaponName,
      armorItemName,
      ...(shieldItemName ? [shieldItemName] : []),
      ...(secondaryItemName ? [secondaryItemName] : []),
    ];

    const clampedGold = Math.max(0, Math.min(500, gold || 0));

    const isSpellcasterClass = isClassSpellcaster(characterClass);
    const initialCantrips = isSpellcasterClass
      ? (CANTRIP_SUGGESTIONS_BY_CLASS[characterClass]?.slice(0, 3) || ['Свет', 'Огненный снаряд'])
      : [];
    const initialSpells = isSpellcasterClass
      ? (SPELL_SUGGESTIONS_BY_CLASS[characterClass]?.slice(0, 2) || ['Волшебная стрела', 'Щит'])
      : [];

    const finalChar: CharacterSheet = {
      name: name.trim() || 'Безымянный герой',
      class: characterClass.trim() || 'Странник',
      race: race.trim() || 'Человек',
      background: background.trim() || 'Искатель приключений',
      level: 1,
      experience: 0,
      xpMultiplier: xpMultiplier,
      cantrips: initialCantrips,
      spells: initialSpells,
      maxHp: computedMaxHp,
      currentHp: computedMaxHp,
      tempHp: 0,
      ac: computedAc,
      speed: race.toLowerCase().includes('дварф') || race.toLowerCase().includes('халфлинг') ? 25 : 30,
      proficiencyBonus: 2,
      stats: finalStats,
      savingThrowProficiencies: savingThrows,
      skillProficiencies: skillProficiencies,
      equippedItems: equippedArray,
      inventory: compiledInventory.length > 0 ? compiledInventory.map(normalizeRationItem) : ['Походный нож', 'Сухпаек (3 шт.)', 'Фляга с водой'],
      gold: clampedGold,
      deathSaves: { successes: 0, failures: 0 },
      hitDiceMax: 1,
      hitDiceCurrent: 1,
      bio: bio.trim(),
      backstory: backstory.trim(),
      motivation: motivation.trim(),
      personalityTraits: personalityTraits.trim(),
      appearance: appearance.trim(),
    };

    const finalWorld: WorldSettings = {
      customSetting: customSetting.trim(),
      customTone: customTone.trim(),
      customRules: customRules.trim(),
      startingScene: startingScene.trim(),
      xpMultiplier: xpMultiplier,
      difficulty: difficulty,
    };

    onStartCampaign(finalChar, finalWorld);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
      onClick={() => { if (onClose) onClose(); }}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md">
              <Feather className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg sm:text-xl font-bold text-amber-200">
                Конструктор Героя и Сеттинга Мира
              </h2>
              <p className="text-xs text-slate-400">
                Пропишите уникальный лор персонажа, атмосферу и законы вашего мира
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-red-950/50 border border-slate-800 hover:border-red-800/60 text-xs text-slate-400 hover:text-red-300 transition flex items-center gap-1.5 font-medium cursor-pointer"
              title="Очистить все поля и начать с чистого листа"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Чистый лист</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="Закрыть окно конструктора (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-slate-800/80 bg-slate-950 px-4 sm:px-6">
          <button
            onClick={() => setActiveSection('lore')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeSection === 'lore'
                ? 'border-amber-400 text-amber-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>1. Лор и личность героя</span>
          </button>
          <button
            onClick={() => setActiveSection('world')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeSection === 'world'
                ? 'border-amber-400 text-amber-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>2. Сеттинг мира и завязка</span>
          </button>
          <button
            onClick={() => setActiveSection('stats')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeSection === 'stats'
                ? 'border-amber-400 text-amber-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>3. Характеристики & Инвентарь</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* SECTION 1: CHARACTER IDENTITY & LORE */}
          {activeSection === 'lore' && (
            <div className="space-y-5">
              {/* Race & Class Quick Presets */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <div>
                  <label className="text-[11px] uppercase font-bold text-amber-400 block mb-1.5 flex items-center justify-between">
                    <span>Выберите расу D&D 5e (применяет расовые бонусы к характеристикам)</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {activeRace ? activeRace.description : ''}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DND_5E_RACES.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectRace(r)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                          selectedRaceId === r.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
                        }`}
                      >
                        {r.nameRu}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] uppercase font-bold text-amber-400 block mb-1.5">
                    Выберите класс D&D 5e (определяет кубик хитов HP, спасброски и снаряжение)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DND_5E_CLASSES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectClass(c)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                          selectedClassId === c.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
                        }`}
                      >
                        {c.nameRu.split(' ')[0]} <span className="text-[10px] opacity-75 font-normal">(d{c.hitDie})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-[11px] uppercase font-bold text-amber-400 block mb-1">
                    Имя персонажа *
                  </label>
                  <input
                    type="text"
                    placeholder="Например: Каэлин Тенеход"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Раса
                  </label>
                  <input
                    type="text"
                    placeholder="Человек, Эльф, Тифлинг..."
                    value={race}
                    onChange={(e) => setRace(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Класс / Специализация
                  </label>
                  <input
                    type="text"
                    placeholder="Плут, Чародей, Паладин..."
                    value={characterClass}
                    onChange={(e) => setCharacterClass(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Предыстория / Титул
                  </label>
                  <input
                    type="text"
                    placeholder="Опальный рыцарь, Наёмник..."
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Bio & Deep Backstory */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] uppercase font-bold text-amber-400 flex items-center gap-1.5">
                    <Scroll className="w-3.5 h-3.5" />
                    Биография, прошлое и происхождение персонажа
                  </label>
                  <span className="text-[10px] text-slate-500">Мастер учтет все детали при ведении сюжета</span>
                </div>
                <textarea
                  placeholder="Опишите историю вашего героя: где он вырос, какие события привели его сюда, какие тайны или грехи прошлого он скрывает..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 min-h-[90px]"
                />
              </div>

              {/* Motivation and Goals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Главная цель и мотивация
                  </label>
                  <textarea
                    placeholder="Зачем он отправился в путь? Чего жаждет: мести, древних артефактов, искупления, спасения клана?.."
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 min-h-[70px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Характер, слабости и привычки
                  </label>
                  <textarea
                    placeholder="Особенности поведения, страхи, кодекс чести, вредные привычки или слабости перед искушением..."
                    value={personalityTraits}
                    onChange={(e) => setPersonalityTraits(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 min-h-[70px]"
                  />
                </div>
              </div>

              {/* Appearance */}
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Внешность и особые приметы
                </label>
                <input
                  type="text"
                  placeholder="Высокий рост, обожженная левая рука, старый шрам через бровь, потертый черный плащ..."
                  value={appearance}
                  onChange={(e) => setAppearance(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Optional preset loader for inspiration */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-500 block mb-1">
                  Или возьмите за основу готового персонажа:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CHARACTER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleLoadTemplate(p)}
                      className="px-2 py-0.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-amber-300 transition"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: WORLDBUILDING & SETTING */}
          {activeSection === 'world' && (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase font-bold text-amber-400 block mb-1">
                  Собственный сеттинг и описание мира
                </label>
                <textarea
                  placeholder="Опишите мир приключения: эпоху, географию, природу магии, враждующие фракции, древние руины или опасности..."
                  value={customSetting}
                  onChange={(e) => setCustomSetting(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Тональность и атмосфера игры
                  </label>
                  <textarea
                    placeholder="Например: Grimdark, давящая тишина, реалистичные ранения, цена каждой ошибки, мрачная эстетика..."
                    value={customTone}
                    onChange={(e) => setCustomTone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 min-h-[80px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Правила, табу и уникальные законы
                  </label>
                  <textarea
                    placeholder="Например: Боги безмолвны, магия требует жертвы плоти, огнестрельное оружие под запретом, смерть необратима..."
                    value={customRules}
                    onChange={(e) => setCustomRules(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 min-h-[80px]"
                  />
                </div>
              </div>

              {/* Starting Scene Prompt */}
              <div>
                <label className="text-[11px] uppercase font-bold text-amber-400 block mb-1">
                  Стартовая завязка / Первая сцена (по желанию)
                </label>
                <textarea
                  placeholder="Опишите, в какой ситуации и где именно начинается игра (например: 'Очнулся в цепях в затопленной камере темницы' или 'Подхожу к воротам проклятой деревни в полночь'). Если оставить пустым — DM создаст завязку сам."
                  value={startingScene}
                  onChange={(e) => setStartingScene(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 min-h-[75px]"
                />
              </div>

              {/* XP Multiplier Selector */}
              <div>
                <label className="text-[11px] uppercase font-bold text-amber-400 block mb-1">
                  Мультипликатор опыта (XP Multiplier):
                </label>
                <p className="text-[10px] text-slate-400 mb-2">
                  Определяет, с какой скоростью персонаж будет получать опыт от Мастера (AI) за победы и квесты.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: 0.5, label: '0.5x', desc: 'Медленная прокачка / Хардкор' },
                    { val: 1.0, label: '1.0x', desc: 'Стандартный темп D&D 5e' },
                    { val: 1.5, label: '1.5x', desc: 'Ускоренное развитие' },
                    { val: 2.0, label: '2.0x', desc: 'Быстрый / Эпический рост' },
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setXpMultiplier(m.val)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        xpMultiplier === m.val
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-cinzel font-bold text-sm text-amber-300">{m.label}</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Mode Selector */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase font-bold text-amber-400 block">
                    Уровень сложности кампании (3 режима):
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Меняет шансы лута, врагов, сложность DC и сюжет
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {DIFFICULTY_ORDER.map((diffKey) => {
                    const prof = DIFFICULTY_PROFILES[diffKey];
                    const isSelected = difficulty === diffKey;
                    return (
                      <button
                        key={diffKey}
                        type="button"
                        onClick={() => setDifficulty(diffKey)}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                          isSelected
                            ? `${prof.borderClass} ring-1 ring-amber-400/50 shadow-md ${prof.bgLightClass}`
                            : 'bg-slate-950/90 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-cinzel font-bold text-xs flex items-center gap-1.5 text-slate-100">
                              <span>{prof.icon}</span>
                              <span>{prof.shortName}</span>
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              isSelected ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}>
                              {prof.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug mb-2">
                            {prof.description}
                          </p>
                        </div>

                        <div className="space-y-1 pt-2 border-t border-slate-800/60 text-[10px] text-slate-300">
                          <div className="flex items-start gap-1">
                            <span className="shrink-0 text-amber-400">🎁</span>
                            <span className="line-clamp-2"><strong className="text-slate-200">Добыча:</strong> {prof.lootRate}</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="shrink-0 text-red-400">⚔️</span>
                            <span className="line-clamp-2"><strong className="text-slate-200">Враги:</strong> {prof.enemyThreat}</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="shrink-0 text-cyan-400">🎲</span>
                            <span className="line-clamp-2"><strong className="text-slate-200">DC:</strong> {prof.checkDifficulty}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
             {/* SECTION 3: D&D 5e STATS, VITALS & INVENTORY */}
          {activeSection === 'stats' && (
            <div className="space-y-5">
              {/* Method Selector Tabs */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] uppercase font-bold text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Правило характеристик D&D 5e
                  </span>

                  {/* Mode Switches: Point Buy or Standard Array only */}
                  <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setStatMode('point_buy')}
                      className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                        statMode === 'point_buy'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🎯 Point Buy (27 очков)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatMode('standard_array')}
                      className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                        statMode === 'standard_array'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      📋 Стандартный набор [15,14,13,12,10,8]
                    </button>
                  </div>
                </div>

                {/* Sub-panels for each mode */}
                {statMode === 'point_buy' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-300">
                        Покупка характеристик (8–15). Нажимайте <strong className="text-amber-300">+</strong> и <strong className="text-amber-300">-</strong> для распределения очков:
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Осталось очков:</span>
                        <span
                          className={`text-sm font-extrabold px-2.5 py-0.5 rounded-lg border font-mono ${
                            pointsRemaining === 0
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : pointsRemaining > 0
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : 'bg-red-950 text-red-200 border-red-500 shadow-md shadow-red-500/30 animate-pulse ring-1 ring-red-500/60'
                          }`}
                        >
                          {pointsRemaining} / {POINT_BUY_TOTAL_BUDGET}
                        </span>
                      </div>
                    </div>

                    {isPointBuyOverspent && (
                      <div className="bg-red-950/80 border border-red-500/60 rounded-xl p-3 text-xs text-red-200 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-lg flex-shrink-0">⛔</span>
                          <span>
                            <strong>Перерасход очков Point Buy: {Math.abs(pointsRemaining)}!</strong> Вы превысили лимит 27 очков D&D 5e. Уменьшите характеристики, чтобы начать игру.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBaseStats({ str: 15, dex: 14, con: 13, wis: 12, cha: 10, int: 8 })}
                          className="px-2.5 py-1 bg-red-900/80 hover:bg-red-800 text-red-100 rounded-lg text-[11px] font-bold border border-red-600 cursor-pointer flex-shrink-0 ml-2 shadow-sm transition"
                        >
                          Сбросить к 27
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {statMode === 'standard_array' && (
                  <div className="space-y-2 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">
                      Официальный стандартный набор 5e: <strong className="text-amber-300">[15, 14, 13, 12, 10, 8]</strong>. Выберите быстрый архетип:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyStandardArrayPreset('str')}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-amber-300 font-medium cursor-pointer"
                      >
                        ⚔️ Силач (СИЛ 15, ТЕЛ 14)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyStandardArrayPreset('dex')}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-cyan-300 font-medium cursor-pointer"
                      >
                        🗡️ Ловкач (ЛОВ 15, ТЕЛ 14)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyStandardArrayPreset('int')}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-purple-300 font-medium cursor-pointer"
                      >
                        🔮 Маг (ИНТ 15, ТЕЛ 14)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyStandardArrayPreset('wis')}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-emerald-300 font-medium cursor-pointer"
                      >
                        ✨ Жрец (МУД 15, ТЕЛ 14)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyStandardArrayPreset('cha')}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-rose-300 font-medium cursor-pointer"
                      >
                        🎭 Харизматик (ХАР 15, ЛОВ 14)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 6 Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {(Object.keys(baseStats) as AbilityScoreKey[]).map((statKey) => {
                  const baseVal = baseStats[statKey] || 8;
                  const bonusVal = racialBonuses[statKey] || 0;
                  const totalVal = finalStats[statKey];
                  const mod = getAbilityModifier(totalVal);
                  const fullName = ABILITY_FULL_NAMES[statKey]?.ru || statKey.toUpperCase();

                  const nextUpCost = getPointBuyCost(baseVal + 1) - getPointBuyCost(baseVal);
                  const canIncreasePointBuy = statMode === 'point_buy' && baseVal < 15 && pointsRemaining >= nextUpCost;
                  const canDecreasePointBuy = statMode === 'point_buy' && baseVal > 8;

                  return (
                    <div
                      key={statKey}
                      className="bg-slate-950 border border-slate-800/90 p-3.5 rounded-2xl text-center flex flex-col justify-between shadow-lg relative"
                    >
                      {/* Stat Header */}
                      <div>
                        <div className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
                          {statKey.toUpperCase()}
                        </div>
                        <div className="text-[9px] text-slate-400">{fullName}</div>
                      </div>

                      {/* Main Value Display */}
                      <div className="my-2 flex flex-col items-center">
                        <div className="text-2xl font-cinzel font-extrabold text-slate-100 leading-none">
                          {totalVal}
                        </div>
                        <div className="mt-1 text-xs font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/50">
                          {formatModifier(mod)}
                        </div>
                      </div>

                      {/* Controls depending on mode */}
                      {statMode === 'point_buy' ? (
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={!canDecreasePointBuy}
                              onClick={() => handlePointBuyAdjust(statKey, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-mono font-bold text-slate-300 w-5 text-center">
                              {baseVal}
                            </span>
                            <button
                              type="button"
                              disabled={!canIncreasePointBuy}
                              onClick={() => handlePointBuyAdjust(statKey, 1)}
                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {bonusVal > 0 ? (
                            <div className="text-[9px] text-emerald-400 font-medium">
                              +{bonusVal} раса
                            </div>
                          ) : (
                            <div className="text-[9px] text-slate-600">база {baseVal}</div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5 pt-1 text-center">
                          <div className="text-xs font-mono font-bold text-slate-300">
                            Базовое: {baseVal}
                          </div>
                          {bonusVal > 0 ? (
                            <div className="text-[9px] text-emerald-400 font-medium">
                              +{bonusVal} раса
                            </div>
                          ) : (
                            <div className="text-[9px] text-slate-600">без бонуса</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vitals Breakdown: HP & AC (Auto-calculated) and Gold (capped to 500) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Auto HP Card */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/20 shadow-md flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5" />
                      Хиты (HP 1 Уровня)
                    </label>
                    <span className="text-[10px] text-emerald-400/90 bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-800/40">
                      Авторасчет 5e
                    </span>
                  </div>
                  <div className="my-1">
                    <div className="text-2xl font-cinzel font-extrabold text-emerald-300">
                      {computedMaxHp} HP
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {hpDetails.formula}
                    </div>
                  </div>
                </div>

                {/* Auto AC Card */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/20 shadow-md flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      Класс Брони (AC)
                    </label>
                    <span className="text-[10px] text-cyan-400/90 bg-cyan-950/70 px-2 py-0.5 rounded-md border border-cyan-800/40">
                      Авторасчет 5e
                    </span>
                  </div>
                  <div className="my-1">
                    <div className="text-2xl font-cinzel font-extrabold text-cyan-300">
                      {computedAc} AC
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {acDetails.formula}
                    </div>
                  </div>
                </div>

                {/* Starter Gold Card (Capped at 500) */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/20 shadow-md flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] uppercase font-bold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Стартовое золото (GP)
                    </label>
                    <span className="text-[10px] text-amber-400/80 font-mono">Макс: 500 GP</span>
                  </div>
                  <div className="flex items-center gap-2 my-1">
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={gold}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setGold(Math.max(0, Math.min(500, val)));
                      }}
                      className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-lg font-cinzel font-extrabold text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-slate-400">gp (0 – 500)</span>
                  </div>
                </div>
              </div>

              {/* Armor & Shield Interactive Selection (Below Vitals) */}
              <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    Стартовый доспех и щит (влияет на Класс Брони выше)
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition select-none">
                    <input
                      type="checkbox"
                      checked={hasShield}
                      onChange={(e) => setHasShield(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-cyan-300">🛡️ Надет щит (+2 AC)</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                  {DND_5E_ARMOR_OPTIONS.map((armor) => (
                    <button
                      key={armor.id}
                      type="button"
                      onClick={() => setSelectedArmorId(armor.id)}
                      className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                        selectedArmorId === armor.id
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{armor.nameRu.split(' (')[0]}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">{armor.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* WEAPONS & EQUIPMENT SELECTOR */}
              <div className="space-y-4 pt-1">
                {/* 1. Primary Weapon */}
                <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-amber-400 flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-amber-400" />
                      1. Основное боевое оружие
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Выбрано: <strong className="text-amber-300">{primaryWeaponObj?.nameRu} ({primaryWeaponObj?.damage})</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                    {DND_5E_PRIMARY_WEAPONS.map((wpn) => (
                      <button
                        key={wpn.id}
                        type="button"
                        onClick={() => setSelectedPrimaryWeaponId(wpn.id)}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                          selectedPrimaryWeaponId === wpn.id
                            ? 'bg-amber-950/80 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                            : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{wpn.nameRu}</div>
                        <div className="text-[9px] text-amber-400/90 font-mono mt-0.5">{wpn.damage} • {wpn.type.split(' (')[0]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Secondary Item / Tool */}
                <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-emerald-400" />
                      2. Второстепенное оружие / Инструменты
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Выбрано: <strong className="text-emerald-300">{secondaryObj?.nameRu}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {DND_5E_SECONDARY_OPTIONS.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setSelectedSecondaryId(sec.id)}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                          selectedSecondaryId === sec.id
                            ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/50'
                            : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{sec.nameRu}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">{sec.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Adventuring Pack */}
                <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-purple-400 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-purple-400" />
                      3. Набор снаряжения путешественника (Adventuring Pack)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Выбрано: <strong className="text-purple-300">{packObj?.nameRu}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {DND_5E_ADVENTURING_PACKS.map((pack) => (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => setSelectedPackId(pack.id)}
                        className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                          selectedPackId === pack.id
                            ? 'bg-purple-950/80 border-purple-400 text-purple-200 shadow-md shadow-purple-500/10 ring-1 ring-purple-400/50'
                            : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-100">{pack.nameRu}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{pack.description}</div>
                        <div className="text-[9px] text-purple-300/80 mt-1 font-mono leading-relaxed line-clamp-2">
                          {pack.items.join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Extra Consumables & Live Inventory Preview */}
                <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      4. Дополнительные полезные припасы
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-300 hover:border-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={hasHealingPotion}
                          onChange={(e) => setHasHealingPotion(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                        />
                        <span>🧪 Зелье лечения</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-300 hover:border-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={hasLantern}
                          onChange={(e) => setHasLantern(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                        />
                        <span>🏮 Фонарь и масло</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-300 hover:border-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={hasRope}
                          onChange={(e) => setHasRope(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"
                        />
                        <span>🧗 Веревка с кошкой</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-300 hover:border-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={hasHolyWater}
                          onChange={(e) => setHasHolyWater(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
                        />
                        <span>✨ Святая вода</span>
                      </label>
                    </div>
                  </div>

                  {/* Live Backpack Preview */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                      <span>🎒 Итоговый инвентарь ({compiledInventory.length} предметов):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {compiledInventory.map((item, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-lg flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80"></span>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400 hidden sm:block">
            Герой: <strong className="text-amber-300">{name || 'Безымянный'}</strong>
            {characterClass && ` • ${characterClass}`}
            {race && ` (${race})`}
            {` • HP: ${computedMaxHp} • AC: ${computedAc} • Золото: ${Math.min(500, gold)} gp`}
          </div>
          <button
            onClick={handleLaunch}
            disabled={isPointBuyOverspent}
            className={`w-full sm:w-auto px-8 py-3.5 font-cinzel font-extrabold text-sm sm:text-base rounded-xl shadow-lg transition transform active:scale-95 ${
              isPointBuyOverspent
                ? 'bg-slate-800 text-slate-500 border border-red-500/30 cursor-not-allowed opacity-75 shadow-none ring-1 ring-red-500/20'
                : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 shadow-amber-600/30 cursor-pointer'
            }`}
          >
            {isPointBuyOverspent
              ? `⛔ Перерасход Point Buy (${pointsRemaining} очков)`
              : 'Начать приключение по правилам D&D 5e! ⚔️'}
          </button>
        </div>
      </div>
    </div>
  );
};
