import { CharacterPreset, CharacterSheet, SkillName, AbilityScoreKey, Stats } from '@/types/dnd';

export const SKILL_ABILITY_MAP: Record<SkillName, AbilityScoreKey> = {
  'Athletics': 'str',
  'Acrobatics': 'dex',
  'Sleight of Hand': 'dex',
  'Stealth': 'dex',
  'Arcana': 'int',
  'History': 'int',
  'Investigation': 'int',
  'Nature': 'int',
  'Religion': 'int',
  'Animal Handling': 'wis',
  'Insight': 'wis',
  'Medicine': 'wis',
  'Perception': 'wis',
  'Survival': 'wis',
  'Deception': 'cha',
  'Intimidation': 'cha',
  'Performance': 'cha',
  'Persuasion': 'cha',
};

export const SKILL_RUSSIAN_NAMES: Record<SkillName, string> = {
  'Athletics': 'Атлетика (STR)',
  'Acrobatics': 'Акробатика (DEX)',
  'Sleight of Hand': 'Ловкость рук (DEX)',
  'Stealth': 'Скрытность (DEX)',
  'Arcana': 'Магия (INT)',
  'History': 'История (INT)',
  'Investigation': 'Анализ / Расследование (INT)',
  'Nature': 'Природа (INT)',
  'Religion': 'Религия (INT)',
  'Animal Handling': 'Уход за животными (WIS)',
  'Insight': 'Проницательность (WIS)',
  'Medicine': 'Медицина (WIS)',
  'Perception': 'Внимательность (WIS)',
  'Survival': 'Выживание (WIS)',
  'Deception': 'Обман (CHA)',
  'Intimidation': 'Запугивание (CHA)',
  'Performance': 'Выступление (CHA)',
  'Persuasion': 'Убеждение (CHA)',
};

export const ABILITY_FULL_NAMES: Record<AbilityScoreKey, { en: string; ru: string }> = {
  str: { en: 'Strength', ru: 'Сила' },
  dex: { en: 'Dexterity', ru: 'Ловкость' },
  con: { en: 'Constitution', ru: 'Телосложение' },
  int: { en: 'Intelligence', ru: 'Интеллект' },
  wis: { en: 'Wisdom', ru: 'Мудрость' },
  cha: { en: 'Charisma', ru: 'Харизма' },
};

/**
 * Standard D&D 5e modifier calculation: floor((score - 10) / 2)
 */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Calculate proficiency bonus from character level
 */
export function getProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

/**
 * Calculate total modifier for a skill check
 */
export function getSkillModifier(character: CharacterSheet, skill: SkillName): number {
  const abilityKey = SKILL_ABILITY_MAP[skill];
  const baseMod = getAbilityModifier(character.stats[abilityKey] || 10);
  const isProficient = (character.skillProficiencies || []).includes(skill);
  const profBonus = character.proficiencyBonus || getProficiencyBonus(character.level || 1);
  return baseMod + (isProficient ? profBonus : 0);
}

/**
 * Calculate saving throw modifier
 */
export function getSavingThrowModifier(character: CharacterSheet, ability: AbilityScoreKey): number {
  const baseMod = getAbilityModifier(character.stats[ability] || 10);
  const isProficient = (character.savingThrowProficiencies || []).includes(ability);
  const profBonus = character.proficiencyBonus || getProficiencyBonus(character.level || 1);
  return baseMod + (isProficient ? profBonus : 0);
}

/**
 * D&D 5e Point Buy Calculator & Rules
 */
export const POINT_BUY_TOTAL_BUDGET = 27;

export const POINT_BUY_COST_TABLE: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export function getPointBuyCost(score: number): number {
  if (score <= 8) return 0;
  if (score > 15) return 9 + (score - 15) * 2;
  return POINT_BUY_COST_TABLE[score] ?? 0;
}

export function getTotalPointBuySpent(stats: Stats): number {
  return (
    getPointBuyCost(stats.str) +
    getPointBuyCost(stats.dex) +
    getPointBuyCost(stats.con) +
    getPointBuyCost(stats.int) +
    getPointBuyCost(stats.wis) +
    getPointBuyCost(stats.cha)
  );
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export interface Dnd5eRace {
  id: string;
  nameRu: string;
  bonuses: Partial<Stats>;
  description: string;
}

export const DND_5E_RACES: Dnd5eRace[] = [
  { id: 'human', nameRu: 'Человек', bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, description: '+1 ко всем характеристикам' },
  { id: 'high_elf', nameRu: 'Высший эльф', bonuses: { dex: 2, int: 1 }, description: '+2 ЛОВ, +1 ИНТ' },
  { id: 'wood_elf', nameRu: 'Лесной эльф', bonuses: { dex: 2, wis: 1 }, description: '+2 ЛОВ, +1 МУД' },
  { id: 'drow', nameRu: 'Дроу (Темный эльф)', bonuses: { dex: 2, cha: 1 }, description: '+2 ЛОВ, +1 ХАР' },
  { id: 'mountain_dwarf', nameRu: 'Горный дварф', bonuses: { con: 2, str: 2 }, description: '+2 ТЕЛ, +2 СИЛ' },
  { id: 'hill_dwarf', nameRu: 'Холмовой дварф', bonuses: { con: 2, wis: 1 }, description: '+2 ТЕЛ, +1 МУД' },
  { id: 'half_orc', nameRu: 'Полуорк', bonuses: { str: 2, con: 1 }, description: '+2 СИЛ, +1 ТЕЛ' },
  { id: 'half_elf', nameRu: 'Полуэльф', bonuses: { cha: 2, dex: 1, con: 1 }, description: '+2 ХАР, +1 к двум другим' },
  { id: 'tiefling', nameRu: 'Тифлинг', bonuses: { cha: 2, int: 1 }, description: '+2 ХАР, +1 ИНТ' },
  { id: 'dragonborn', nameRu: 'Драконорожденный', bonuses: { str: 2, cha: 1 }, description: '+2 СИЛ, +1 ХАР' },
  { id: 'lightfoot_halfling', nameRu: 'Легконогий халфлинг', bonuses: { dex: 2, cha: 1 }, description: '+2 ЛОВ, +1 ХАР' },
  { id: 'stout_halfling', nameRu: 'Коренастый халфлинг', bonuses: { dex: 2, con: 1 }, description: '+2 ЛОВ, +1 ТЕЛ' },
  { id: 'rock_gnome', nameRu: 'Скальный гном', bonuses: { int: 2, con: 1 }, description: '+2 ИНТ, +1 ТЕЛ' },
  { id: 'forest_gnome', nameRu: 'Лесной гном', bonuses: { int: 2, dex: 1 }, description: '+2 ИНТ, +1 ЛОВ' },
  { id: 'custom', nameRu: 'Свободный выбор (+2 / +1)', bonuses: {}, description: 'Настраиваемые расовые бонусы' },
];

export interface Dnd5eClass {
  id: string;
  nameRu: string;
  hitDie: number; // 6, 8, 10, 12
  primaryStats: AbilityScoreKey[];
  savingThrows: [AbilityScoreKey, AbilityScoreKey];
  defaultSkills: SkillName[];
  defaultAc: number;
  starterEquipment: string;
}

export const DND_5E_CLASSES: Dnd5eClass[] = [
  {
    id: 'barbarian',
    nameRu: 'Варвар (Barbarian)',
    hitDie: 12,
    primaryStats: ['str', 'con'],
    savingThrows: ['str', 'con'],
    defaultSkills: ['Athletics', 'Perception', 'Intimidation'],
    defaultAc: 14,
    starterEquipment: 'Секира (1d12), Два ручных топора, 4 дротика, Набор путешественника',
  },
  {
    id: 'fighter',
    nameRu: 'Воин (Fighter)',
    hitDie: 10,
    primaryStats: ['str', 'con'],
    savingThrows: ['str', 'con'],
    defaultSkills: ['Athletics', 'Perception', 'Acrobatics'],
    defaultAc: 16,
    starterEquipment: 'Длинный меч (1d8+STR), Щит (+2 AC), Кольчуга (AC 16), Легкий арбалет и 20 болтов',
  },
  {
    id: 'paladin',
    nameRu: 'Паладин (Paladin)',
    hitDie: 10,
    primaryStats: ['str', 'cha'],
    savingThrows: ['wis', 'cha'],
    defaultSkills: ['Athletics', 'Persuasion', 'Religion'],
    defaultAc: 16,
    starterEquipment: 'Двуручный меч (2d6), Священный символ, Кольчуга (AC 16), Набор священника',
  },
  {
    id: 'ranger',
    nameRu: 'Следопыт (Ranger)',
    hitDie: 10,
    primaryStats: ['dex', 'wis'],
    savingThrows: ['str', 'dex'],
    defaultSkills: ['Stealth', 'Perception', 'Survival'],
    defaultAc: 14,
    starterEquipment: 'Длинный лук и 20 стрел, Два коротких меча, Кожаный доспех (AC 12+DEX), Набор исследователя',
  },
  {
    id: 'cleric',
    nameRu: 'Жрец (Cleric)',
    hitDie: 8,
    primaryStats: ['wis', 'con'],
    savingThrows: ['wis', 'cha'],
    defaultSkills: ['Insight', 'Religion', 'Medicine'],
    defaultAc: 16,
    starterEquipment: 'Боевой молот, Щит (+2 AC), Чешуйчатый доспех, Священный символ, Набор жреца',
  },
  {
    id: 'druid',
    nameRu: 'Друид (Druid)',
    hitDie: 8,
    primaryStats: ['wis', 'con'],
    savingThrows: ['int', 'wis'],
    defaultSkills: ['Nature', 'Animal Handling', 'Perception'],
    defaultAc: 13,
    starterEquipment: 'Деревянный щит, Скимитар, Кожаный доспех, Фокусировка друида',
  },
  {
    id: 'bard',
    nameRu: 'Бард (Bard)',
    hitDie: 8,
    primaryStats: ['cha', 'dex'],
    savingThrows: ['dex', 'cha'],
    defaultSkills: ['Performance', 'Persuasion', 'Deception'],
    defaultAc: 13,
    starterEquipment: 'Рапира, Кожаный доспех, Лютня, Набор дипломата, Кинжал',
  },
  {
    id: 'rogue',
    nameRu: 'Плут (Rogue)',
    hitDie: 8,
    primaryStats: ['dex', 'int'],
    savingThrows: ['dex', 'int'],
    defaultSkills: ['Stealth', 'Sleight of Hand', 'Acrobatics', 'Perception'],
    defaultAc: 14,
    starterEquipment: 'Рапира, Короткий лук и 20 стрел, Кожаный доспех, Воровские инструменты, Пара кинжалов',
  },
  {
    id: 'monk',
    nameRu: 'Монах (Monk)',
    hitDie: 8,
    primaryStats: ['dex', 'wis'],
    savingThrows: ['str', 'dex'],
    defaultSkills: ['Acrobatics', 'Athletics', 'Insight'],
    defaultAc: 15,
    starterEquipment: 'Короткий меч, 10 дротиков, Набор исследователя подземелий',
  },
  {
    id: 'warlock',
    nameRu: 'Колдун (Warlock)',
    hitDie: 8,
    primaryStats: ['cha', 'con'],
    savingThrows: ['wis', 'cha'],
    defaultSkills: ['Arcana', 'Deception', 'Intimidation'],
    defaultAc: 12,
    starterEquipment: 'Простой кинжал, Кожаный доспех, Фокусировка заклинаний, Гримуар',
  },
  {
    id: 'sorcerer',
    nameRu: 'Чародей (Sorcerer)',
    hitDie: 6,
    primaryStats: ['cha', 'con'],
    savingThrows: ['con', 'cha'],
    defaultSkills: ['Arcana', 'Persuasion'],
    defaultAc: 12,
    starterEquipment: 'Легкий арбалет и 20 болтов, Два кинжала, Магическая фокусировка, Набор исследователя',
  },
  {
    id: 'wizard',
    nameRu: 'Волшебник (Wizard)',
    hitDie: 6,
    primaryStats: ['int', 'con'],
    savingThrows: ['int', 'wis'],
    defaultSkills: ['Arcana', 'History', 'Investigation'],
    defaultAc: 11,
    starterEquipment: 'Боевой посох, Книга заклинаний, Фокусировка заклинаний, Сумка с реагентами',
  },
];

export function calculateDnd5eHp(classIdOrName: string, conScore: number): number {
  const conMod = getAbilityModifier(conScore);
  const matched = DND_5E_CLASSES.find(
    (c) =>
      c.id.toLowerCase() === classIdOrName.toLowerCase() ||
      c.nameRu.toLowerCase().includes(classIdOrName.toLowerCase()) ||
      classIdOrName.toLowerCase().includes(c.id.toLowerCase())
  );
  const hitDie = matched ? matched.hitDie : 10;
  return Math.max(1, hitDie + conMod);
}

export function getDnd5eHpDetails(classIdOrName: string, conScore: number): { hp: number; hitDie: number; conMod: number; formula: string } {
  const conMod = getAbilityModifier(conScore);
  const matched = DND_5E_CLASSES.find(
    (c) =>
      c.id.toLowerCase() === classIdOrName.toLowerCase() ||
      c.nameRu.toLowerCase().includes(classIdOrName.toLowerCase()) ||
      classIdOrName.toLowerCase().includes(c.id.toLowerCase())
  );
  const hitDie = matched ? matched.hitDie : 10;
  const hp = Math.max(1, hitDie + conMod);
  return {
    hp,
    hitDie,
    conMod,
    formula: `Кубик d${hitDie} (${matched?.nameRu.split(' ')[0] || 'Класс'}) + ${formatModifier(conMod)} (ТЕЛ)`,
  };
}

export interface Dnd5eArmorOption {
  id: string;
  nameRu: string;
  category: 'none' | 'light' | 'medium' | 'heavy';
  baseAc: number;
  maxDexMod: number | null; // null = full DEX, 2 = max +2, 0 = no DEX
  description: string;
}

export const DND_5E_ARMOR_OPTIONS: Dnd5eArmorOption[] = [
  { id: 'none', nameRu: 'Без доспеха (Обычная одежда)', category: 'none', baseAc: 10, maxDexMod: null, description: '10 + ЛОВ (или защита класса)' },
  { id: 'leather', nameRu: 'Кожаный доспех (Light)', category: 'light', baseAc: 11, maxDexMod: null, description: '11 + ЛОВ' },
  { id: 'studded_leather', nameRu: 'Проклепанная кожа (Light)', category: 'light', baseAc: 12, maxDexMod: null, description: '12 + ЛОВ' },
  { id: 'hide', nameRu: 'Шкурный доспех (Medium)', category: 'medium', baseAc: 12, maxDexMod: 2, description: '12 + ЛОВ (макс. +2)' },
  { id: 'chain_shirt', nameRu: 'Кольчужная рубаха (Medium)', category: 'medium', baseAc: 13, maxDexMod: 2, description: '13 + ЛОВ (макс. +2)' },
  { id: 'scale_mail', nameRu: 'Чешуйчатый доспех (Medium)', category: 'medium', baseAc: 14, maxDexMod: 2, description: '14 + ЛОВ (макс. +2)' },
  { id: 'breastplate', nameRu: 'Кираса / Нагрудник (Medium)', category: 'medium', baseAc: 14, maxDexMod: 2, description: '14 + ЛОВ (макс. +2)' },
  { id: 'half_plate', nameRu: 'Полулаты (Medium)', category: 'medium', baseAc: 15, maxDexMod: 2, description: '15 + ЛОВ (макс. +2)' },
  { id: 'ring_mail', nameRu: 'Кольчатый доспех (Heavy)', category: 'heavy', baseAc: 14, maxDexMod: 0, description: '14 (без бонуса ЛОВ)' },
  { id: 'chain_mail', nameRu: 'Кольчуга (Heavy)', category: 'heavy', baseAc: 16, maxDexMod: 0, description: '16 (без бонуса ЛОВ)' },
  { id: 'splint', nameRu: 'Наборный доспех (Heavy)', category: 'heavy', baseAc: 17, maxDexMod: 0, description: '17 (без бонуса ЛОВ)' },
  { id: 'plate', nameRu: 'Полные латы (Heavy)', category: 'heavy', baseAc: 18, maxDexMod: 0, description: '18 (полные латы)' },
];

export interface Dnd5eWeaponOption {
  id: string;
  nameRu: string;
  damage: string;
  type: string;
}

export const DND_5E_PRIMARY_WEAPONS: Dnd5eWeaponOption[] = [
  { id: 'none', nameRu: 'Без оружия (Кулаки)', damage: '1+STR', type: 'Дробящий (Безоружный удар)' },
  { id: 'longsword', nameRu: 'Длинный меч', damage: '1d8/1d10', type: 'Рубящий (Универсальное)' },
  { id: 'greatsword', nameRu: 'Двуручный меч', damage: '2d6', type: 'Рубящий (Тяжелое, Двуручное)' },
  { id: 'greataxe', nameRu: 'Двуручная секира', damage: '1d12', type: 'Рубящий (Тяжелое, Двуручное)' },
  { id: 'rapier', nameRu: 'Рапира', damage: '1d8', type: 'Колющий (Фехтовальное)' },
  { id: 'scimitar', nameRu: 'Скимитар', damage: '1d6', type: 'Рубящий (Фехтовальное, Легкое)' },
  { id: 'shortsword', nameRu: 'Короткий меч', damage: '1d6', type: 'Колющий (Фехтовальное, Легкое)' },
  { id: 'warhammer', nameRu: 'Боевой молот', damage: '1d8/1d10', type: 'Дробящий (Универсальное)' },
  { id: 'halberd', nameRu: 'Алебарда / Глефа', damage: '1d10', type: 'Рубящий (Досягаемость)' },
  { id: 'mace', nameRu: 'Тяжелая булава', damage: '1d6', type: 'Дробящий (Простое)' },
  { id: 'quarterstaff', nameRu: 'Боевой посох', damage: '1d6/1d8', type: 'Дробящий (Фокусировка магии)' },
  { id: 'longbow', nameRu: 'Длинный лук и 20 стрел', damage: '1d8', type: 'Колющий (Дистанция 150/600)' },
  { id: 'shortbow', nameRu: 'Короткий лук и 20 стрел', damage: '1d6', type: 'Колющий (Дистанция 80/320)' },
  { id: 'heavy_crossbow', nameRu: 'Тяжелый арбалет и 20 болтов', damage: '1d10', type: 'Колющий (Дистанция 100/400)' },
  { id: 'light_crossbow', nameRu: 'Легкий арбалет и 20 болтов', damage: '1d8', type: 'Колющий (Дистанция 80/320)' },
  { id: 'arcane_focus', nameRu: 'Магический жезл / Сфера', damage: 'Фокус', type: 'Магический проводник заклинаний' },
];

export interface Dnd5eSecondaryOption {
  id: string;
  nameRu: string;
  description: string;
}

export const DND_5E_SECONDARY_OPTIONS: Dnd5eSecondaryOption[] = [
  { id: 'none', nameRu: 'Без доп. оружия/инструментов', description: 'Свободная вторая рука' },
  { id: 'daggers_pair', nameRu: 'Два кинжала (1d4)', description: 'Фехтовальное, метательное (20/60)' },
  { id: 'handaxes_pair', nameRu: 'Два ручных топора (1d6)', description: 'Легкое, метательное оружие' },
  { id: 'thieves_tools', nameRu: 'Воровские инструменты', description: 'Отмычки и щупы для замков' },
  { id: 'holy_symbol', nameRu: 'Священный символ / Амулет', description: 'Знак веры жреца или паладина' },
  { id: 'spellbook', nameRu: 'Книга заклинаний (Гримуар)', description: 'Кожаная книга с тайными формулами' },
  { id: 'musical_instrument', nameRu: 'Лютня / Флейта', description: 'Музыкальный инструмент барда' },
  { id: 'herbalism_kit', nameRu: 'Набор травника', description: 'Ступка, флаконы и целебные травы' },
];

export interface Dnd5eAdventuringPack {
  id: string;
  nameRu: string;
  description: string;
  items: string[];
}

export const DND_5E_ADVENTURING_PACKS: Dnd5eAdventuringPack[] = [
  {
    id: 'none',
    nameRu: 'Без набора снаряжения',
    description: 'Налегке (без походных припасов)',
    items: [],
  },
  {
    id: 'dungeoneer',
    nameRu: 'Набор исследователя подземелий',
    description: 'Для походов в пещеры, катакомбы и темницы',
    items: ['Рюкзак', 'Спальник', 'Факел (10 шт.)', 'Трутница', 'Пеньковая веревка 15м', 'Сухпаек (10 шт.)', 'Фляга для воды'],
  },
  {
    id: 'explorer',
    nameRu: 'Набор путешественника / Следопыта',
    description: 'Для дальних странствий по дикой природе',
    items: ['Рюкзак', 'Спальник', 'Походный котелок', 'Трутница', 'Факел (10 шт.)', 'Сухпаек (10 шт.)', 'Бурдюк с водой'],
  },
  {
    id: 'burglar',
    nameRu: 'Набор взломщика / Грабителя',
    description: 'Для скрытных операций и проникновений',
    items: ['Рюкзак', 'Стальные шарики (1000 шт.)', 'Колокольчик', 'Свеча (5 шт.)', 'Лом', 'Молоток', 'Колышки (10 шт.)', 'Шелковая веревка 15м', 'Сухпаек (5 шт.)'],
  },
  {
    id: 'priest',
    nameRu: 'Набор священника / Клирика',
    description: 'Для служителей богов и паломников',
    items: ['Рюкзак', 'Одеяло', 'Свеча (10 шт.)', 'Трутница', 'Коробка для подаяний', 'Ладан и кадильница', 'Сухпаек (5 шт.)', 'Святая вода (1 шт.)'],
  },
  {
    id: 'scholar',
    nameRu: 'Набор ученого / Мага',
    description: 'Для магов, алхимиков и мудрецов',
    items: ['Рюкзак', 'Книга по фольклору', 'Чернильница и перо', 'Пергамент (10 шт.)', 'Мешочек с песком', 'Сухпаек (5 шт.)'],
  },
  {
    id: 'diplomat',
    nameRu: 'Набор дипломата / Дворянина',
    description: 'Для светских приемов и переговоров',
    items: ['Сундук', 'Футляр для карт (2 шт.)', 'Комплект отличной одежды', 'Флакон чернил', 'Перо', 'Сургуч и печать', 'Сухпаек (5 шт.)'],
  },
];

export function calculateDnd5eAc(
  classIdOrName: string,
  stats: Stats,
  armorId: string = 'none',
  hasShield: boolean = false
): { ac: number; formula: string } {
  const dexMod = getAbilityModifier(stats.dex || 10);
  const conMod = getAbilityModifier(stats.con || 10);
  const wisMod = getAbilityModifier(stats.wis || 10);
  const lowerClass = (classIdOrName || '').toLowerCase();
  const shieldBonus = hasShield ? 2 : 0;
  const shieldStr = hasShield ? ' + 2 (Щит)' : '';

  // 1. Unarmored Defense for Barbarian or Monk when no armor is worn
  if (armorId === 'none') {
    if (lowerClass.includes('варвар') || lowerClass.includes('barbarian')) {
      const ac = 10 + dexMod + conMod + shieldBonus;
      return {
        ac,
        formula: `10 + ${formatModifier(dexMod)} (ЛОВ) + ${formatModifier(conMod)} (ТЕЛ) [Защита без доспехов]${shieldStr}`,
      };
    }
    if (lowerClass.includes('монах') || lowerClass.includes('monk')) {
      const ac = 10 + dexMod + wisMod;
      return {
        ac,
        formula: `10 + ${formatModifier(dexMod)} (ЛОВ) + ${formatModifier(wisMod)} (МУД) [Защита без доспехов]`,
      };
    }
    const ac = 10 + dexMod + shieldBonus;
    return {
      ac,
      formula: `10 (Одежда) + ${formatModifier(dexMod)} (ЛОВ)${shieldStr}`,
    };
  }

  // 2. Specific selected armor
  const armor = DND_5E_ARMOR_OPTIONS.find((a) => a.id === armorId) || DND_5E_ARMOR_OPTIONS[0];

  if (armor.maxDexMod === 0) {
    const ac = armor.baseAc + shieldBonus;
    return {
      ac,
      formula: `${armor.baseAc} (${armor.nameRu.split(' ')[0]})${shieldStr}`,
    };
  }

  if (armor.maxDexMod === 2) {
    const effectiveDex = Math.min(2, Math.max(0, dexMod));
    const ac = armor.baseAc + effectiveDex + shieldBonus;
    return {
      ac,
      formula: `${armor.baseAc} (${armor.nameRu.split(' ')[0]}) + ${effectiveDex} (ЛОВ, макс +2)${shieldStr}`,
    };
  }

  // Light armor
  const ac = armor.baseAc + dexMod + shieldBonus;
  return {
    ac,
    formula: `${armor.baseAc} (${armor.nameRu.split(' ')[0]}) + ${formatModifier(dexMod)} (ЛОВ)${shieldStr}`,
  };
}

/**
 * Roll 4d6 and drop lowest die (Standard 5e character creation method)
 */
export function roll4d6DropLowest(): { rolls: number[]; total: number; dropped: number } {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
  const sorted = [...rolls].sort((a, b) => a - b);
  const dropped = sorted[0];
  const total = sorted[1] + sorted[2] + sorted[3];
  return { rolls, total, dropped };
}

/**
 * 6 Rich Pre-made Character Archetypes
 */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'elven_rogue',
    name: 'Элирион Теневой Клинок',
    title: 'Эльф-следопыт и наёмный плут',
    class: 'Плут (Rogue)',
    race: 'Высший эльф',
    background: 'Преступник / Шпион',
    level: 1,
    maxHp: 10,
    ac: 14,
    speed: 35,
    stats: { str: 10, dex: 16, con: 14, int: 13, wis: 12, cha: 10 },
    savingThrowProficiencies: ['dex', 'int'],
    skillProficiencies: ['Stealth', 'Acrobatics', 'Sleight of Hand', 'Perception', 'Deception'],
    equippedItems: [
      'Изящный короткий меч (1d6+3)',
      'Пара кинжалов из лунной стали',
      'Клепаный кожаный доспех (AC 14)',
      'Плащ ночного охотника',
    ],
    inventory: [
      'Воровские инструменты',
      'Моток шелковой веревки (15м)',
      'Зелье лечения (2d4+2 HP)',
      'Факел (3 шт.)',
      'Огниво',
    ],
    gold: 25,
    bio: 'Бывший разведчик из руин эльфийской цитадели. Движется бесшумно, как ночной туман, и наносит удары точно в уязвимые точки.',
    avatarIcon: 'dagger',
    accentColor: 'from-emerald-600 to-teal-800',
  },
  {
    id: 'human_paladin',
    name: 'Сир Брандар Светоносный',
    title: 'Паладин Клятвы Возмездия',
    class: 'Паладин (Paladin)',
    race: 'Человек',
    background: 'Рыцарь ордена',
    level: 1,
    maxHp: 12,
    ac: 16,
    speed: 30,
    stats: { str: 16, dex: 10, con: 14, int: 9, wis: 12, cha: 15 },
    savingThrowProficiencies: ['wis', 'cha'],
    skillProficiencies: ['Athletics', 'Intimidation', 'Religion', 'Persuasion'],
    equippedItems: [
      'Освященный двуручный меч (2d6)',
      'Кольчужная рубаха и гербовой табард (AC 16)',
      'Священный амулет Солнечного Ордена',
    ],
    inventory: [
      'Тяжелый арбалет',
      'Арбалетные болты (20 шт.)',
      'Зелье лечения (2d4+2 HP)',
      'Сухпаек (5 шт.)',
    ],
    gold: 18,
    bio: 'Преданный воин света, поклявшийся истреблять порождения тьмы и защищать невинных любой ценой.',
    avatarIcon: 'shield',
    accentColor: 'from-amber-500 to-yellow-700',
  },
  {
    id: 'dwarf_cleric',
    name: 'Торин Камнесерд',
    title: 'Дварф-жрец Домена Жизни и Кузни',
    class: 'Жрец (Cleric)',
    race: 'Горный дварф',
    background: 'Служитель кланового храма',
    level: 1,
    maxHp: 11,
    ac: 16,
    speed: 25,
    stats: { str: 14, dex: 10, con: 16, int: 10, wis: 16, cha: 10 },
    savingThrowProficiencies: ['wis', 'cha'],
    skillProficiencies: ['Medicine', 'Insight', 'History', 'Religion'],
    equippedItems: [
      'Окованный рунами боевой молот (1d8+2)',
      'Кованый стальной щит (+2 AC)',
      'Чешуйчатый доспех (AC 14)',
      'Священный тотем предков',
    ],
    inventory: [
      'Святая вода (2 шт.)',
      'Походная аптечка целителя',
      'Освященный елей',
    ],
    gold: 15,
    bio: 'Несокрушимый защитник своих собратьев, черпающий благословение в древней магии горных недр.',
    avatarIcon: 'heart-pulse',
    accentColor: 'from-red-600 to-rose-900',
  },
  {
    id: 'tiefling_warlock',
    name: 'Малакор Вестник Бездны',
    title: 'Тифлинг-колдун Древнего Патрона',
    class: 'Колдун (Warlock)',
    race: 'Тифлинг',
    background: 'Оккультный ученый',
    level: 1,
    maxHp: 9,
    ac: 13,
    speed: 30,
    stats: { str: 8, dex: 14, con: 13, int: 14, wis: 10, cha: 16 },
    savingThrowProficiencies: ['wis', 'cha'],
    skillProficiencies: ['Arcana', 'Investigation', 'Deception', 'Intimidation'],
    equippedItems: [
      'Резной посох с осколком обсидиана (1d6)',
      'Кожаный камзол с тайными рунами (AC 13)',
      'Магический кристалл-фокусировка',
    ],
    inventory: [
      'Гримуар с нечестивыми формулами',
      'Ритуальный обсидиановый кинжал',
      'Свиток мистического зрения',
    ],
    gold: 20,
    bio: 'Заключил опасную сделку с сущностью из-за пределов звезд. Управляет разрушительным Мистическим залпом (Eldritch Blast).',
    avatarIcon: 'flame',
    accentColor: 'from-purple-600 to-indigo-950',
  },
  {
    id: 'dragonborn_fighter',
    name: 'Крашнак Огнерожденный',
    title: 'Драконорождённый военачальник',
    class: 'Воин (Fighter)',
    race: 'Красный драконорождённый',
    background: 'Ветеран наемничьей роты',
    level: 1,
    maxHp: 13,
    ac: 15,
    speed: 30,
    stats: { str: 17, dex: 12, con: 15, int: 9, wis: 10, cha: 11 },
    savingThrowProficiencies: ['str', 'con'],
    skillProficiencies: ['Athletics', 'Survival', 'Intimidation', 'Perception'],
    equippedItems: [
      'Тяжелая секира палача (1d12+3)',
      'Кольчуга наёмника (AC 15)',
      'Шлем с гребнем пламени',
    ],
    inventory: [
      'Набор для ухода за оружием',
      'Трофейный рог',
      'Сухпаек (7 шт.)',
      'Фляга с крепким элем',
    ],
    gold: 12,
    bio: 'Яростный боец с чешуей цвета раскаленной лавы. Способен изрыгать конус смертоносного пламени.',
    avatarIcon: 'swords',
    accentColor: 'from-orange-600 to-red-800',
  },
  {
    id: 'halfling_bard',
    name: 'Пайпер Счастливчик',
    title: 'Полурослик-сказитель и бард',
    class: 'Бард (Bard)',
    race: 'Полурослик',
    background: 'Бродячий менестрель',
    level: 1,
    maxHp: 9,
    ac: 13,
    speed: 25,
    stats: { str: 8, dex: 16, con: 12, int: 12, wis: 12, cha: 16 },
    savingThrowProficiencies: ['dex', 'cha'],
    skillProficiencies: ['Performance', 'Persuasion', 'Insight', 'Acrobatics', 'Stealth'],
    equippedItems: [
      'Старинная серебряная лютня',
      'Изящная шпага (Rapier 1d8+3)',
      'Кожаный плащ путешественника (AC 13)',
    ],
    inventory: [
      'Зеркальце для трюков и грим',
      'Запасная связка шелковых струн',
      'Зелье убеждения',
    ],
    gold: 30,
    bio: 'Обаятельный пройдоха, способный заговорить зубы даже свирепому троллю и вдохновить союзников магической песней.',
    avatarIcon: 'music',
    accentColor: 'from-cyan-600 to-blue-800',
  },
];

export interface ParsedItemQuantity {
  baseName: string;
  count: number;
  formatted: string;
}

/**
 * Universal D&D 5e Item Quantity Parser
 * Accurately parses and normalizes item counts e.g.:
 * - "10 факелов" -> baseName: "Факел", count: 10, formatted: "Факел (10 шт.)"
 * - "Факелы (10 шт.)" -> baseName: "Факел", count: 10, formatted: "Факел (10 шт.)"
 * - "Сухпаек (5 шт.)" -> baseName: "Сухпаек", count: 5, formatted: "Сухпаек (5 шт.)"
 * - "Свечи (5 шт.)" -> baseName: "Свеча", count: 5, formatted: "Свеча (5 шт.)"
 * - "Зелье лечения (2 шт.)" -> baseName: "Зелье лечения", count: 2, formatted: "Зелье лечения (2 шт.)"
 * - "Зелье лечения (2d4+2 HP)" -> baseName: "Зелье лечения (2d4+2 HP)", count: 1
 */
export function parseItemQuantity(rawItem: string): ParsedItemQuantity {
  if (!rawItem || typeof rawItem !== 'string') {
    return { baseName: rawItem || '', count: 1, formatted: rawItem || '' };
  }

  let item = rawItem.trim();
  if (!item) {
    return { baseName: '', count: 1, formatted: '' };
  }

  // 1. Check for existing (X шт.) or (X шт) or (X флакона) or (X флаконов) or (X листов) in parentheses
  const parenCountMatch = item.match(/^(.*?)\s*\((\d+)\s*(?:шт|штук|флакон\w*|лист\w*|порци\w*|стрел\w*|болт\w*|свеч\w*|факел\w*)\.?\)\s*$/i);
  if (parenCountMatch) {
    let base = parenCountMatch[1].trim();
    const count = parseInt(parenCountMatch[2], 10) || 1;
    if (base.toLowerCase() === 'факелы') base = 'Факел';
    if (base.toLowerCase() === 'свечи') base = 'Свеча';
    if (base.toLowerCase() === 'зелья лечения') base = 'Зелье лечения';
    if (base.toLowerCase() === 'футляры для карт') base = 'Футляр для карт';
    if (base.toLowerCase() === 'флаконы святой воды') base = 'Святая вода';
    if (base.toLowerCase() === 'колышки') base = 'Колышки';

    return {
      baseName: base,
      count,
      formatted: count > 1 ? `${base} (${count} шт.)` : base,
    };
  }

  // 2. Check for leading number e.g. "10 факелов", "5 свечей", "1000 стальных шариков", "20 стрел", "2 зелья лечения", "2 флакона святой воды"
  const leadingNumMatch = item.match(/^(\d+)\s+([А-Яа-яЁёA-Za-z0-9\s()+-]+)$/);
  if (leadingNumMatch) {
    const count = parseInt(leadingNumMatch[1], 10) || 1;
    const namePart = leadingNumMatch[2].trim();
    const lowerName = namePart.toLowerCase();

    let base = namePart;
    if (lowerName.includes('факел')) base = 'Факел';
    else if (lowerName.includes('свеч')) base = 'Свеча';
    else if (lowerName.includes('стальных шарик') || lowerName.includes('стальные шарик')) base = 'Стальные шарики';
    else if (lowerName.includes('лист') && lowerName.includes('пергамент')) base = 'Пергамент';
    else if (lowerName.includes('футляр')) base = 'Футляр для карт и свитков';
    else if (lowerName.includes('колышк')) base = 'Колышки';
    else if (lowerName.includes('стрел')) base = 'Стрелы';
    else if (lowerName.includes('болт')) base = 'Арбалетные болты';
    else if (lowerName.includes('зель') && lowerName.includes('лечен')) base = 'Зелье лечения';
    else if (lowerName.includes('фляг') && lowerName.includes('масл')) base = 'Фляга с маслом';
    else if (lowerName.includes('святая вода') || lowerName.includes('святой вод')) base = 'Святая вода';
    else if (lowerName.includes('сухпаек') || lowerName.includes('рацион')) base = 'Сухпаек';
    else {
      base = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }

    return {
      baseName: base,
      count,
      formatted: count > 1 ? `${base} (${count} шт.)` : base,
    };
  }

  // 3. Check for "Огниво и факелы (3 шт)" or "Тяжелый арбалет и 20 болтов"
  if (item.toLowerCase().includes('огниво и факелы')) {
    const m = item.match(/\((\d+)\s*шт\)/i);
    const count = m ? parseInt(m[1], 10) : 3;
    return { baseName: 'Факел', count, formatted: `Факел (${count} шт.)` };
  }

  // 4. Check for "Сухпаек на X дней" or "Сухпаек на неделю"
  const lower = item.toLowerCase();
  if (lower.includes('сухпаек') || lower.includes('сухой паек') || lower.includes('рацион')) {
    if (lower.includes('недел')) {
      return { baseName: 'Сухпаек', count: 7, formatted: 'Сухпаек (7 шт.)' };
    }
    const daysMatch = item.match(/(?:на|хватит на)\s*(\d+)\s*(?:дн|сут)/i);
    if (daysMatch) {
      const count = parseInt(daysMatch[1], 10) || 1;
      return { baseName: 'Сухпаек', count, formatted: count > 1 ? `Сухпаек (${count} шт.)` : 'Сухпаек' };
    }
    return { baseName: 'Сухпаек', count: 1, formatted: 'Сухпаек' };
  }

  // Default: single item
  return {
    baseName: item,
    count: 1,
    formatted: item,
  };
}

export function formatItemWithCount(baseName: string, count: number): string {
  const cleanBase = baseName.replace(/\s*\(\d+\s*шт\.?\)/i, '').trim();
  if (count <= 1) {
    return cleanBase;
  }
  return `${cleanBase} (${count} шт.)`;
}

export function normalizeRationItem(item: string): string {
  return parseItemQuantity(item).formatted;
}

/**
 * Adds an item to the inventory array, automatically stacking quantities
 * if an item with the same base name already exists.
 */
export function addItemToInventory(inventory: string[], newItem: string): string[] {
  const parsedNew = parseItemQuantity(newItem);
  const currentInv = (inventory || []).map(normalizeRationItem);

  const existingIdx = currentInv.findIndex((it) => {
    const parsed = parseItemQuantity(it);
    return parsed.baseName.toLowerCase() === parsedNew.baseName.toLowerCase();
  });

  if (existingIdx !== -1) {
    const existingParsed = parseItemQuantity(currentInv[existingIdx]);
    const totalCount = existingParsed.count + parsedNew.count;
    const updated = [...currentInv];
    updated[existingIdx] = formatItemWithCount(existingParsed.baseName, totalCount);
    return updated;
  }

  return [...currentInv, parsedNew.formatted];
}

/**
 * Removes or decrements an item in the inventory.
 */
export function removeItemFromInventory(inventory: string[], itemToRemove: string): string[] {
  const parsedRemove = parseItemQuantity(itemToRemove);
  const currentInv = (inventory || []).map(normalizeRationItem);

  const existingIdx = currentInv.findIndex((it) => {
    const parsed = parseItemQuantity(it);
    return (
      parsed.baseName.toLowerCase() === parsedRemove.baseName.toLowerCase() ||
      it.toLowerCase() === itemToRemove.toLowerCase()
    );
  });

  if (existingIdx === -1) {
    return currentInv;
  }

  const existingParsed = parseItemQuantity(currentInv[existingIdx]);
  const newCount = existingParsed.count - parsedRemove.count;

  if (newCount > 0) {
    const updated = [...currentInv];
    updated[existingIdx] = formatItemWithCount(existingParsed.baseName, newCount);
    return updated;
  }

  return currentInv.filter((_, i) => i !== existingIdx);
}

// ==========================================
// D&D 5E EXPERIENCE & LEVEL PROGRESSION
// ==========================================

export interface LevelThreshold {
  level: number;
  xp: number;
  proficiencyBonus: number;
}

export const DND5E_LEVEL_XP_THRESHOLDS: LevelThreshold[] = [
  { level: 1, xp: 0, proficiencyBonus: 2 },
  { level: 2, xp: 300, proficiencyBonus: 2 },
  { level: 3, xp: 900, proficiencyBonus: 2 },
  { level: 4, xp: 2700, proficiencyBonus: 2 },
  { level: 5, xp: 6500, proficiencyBonus: 3 },
  { level: 6, xp: 14000, proficiencyBonus: 3 },
  { level: 7, xp: 23000, proficiencyBonus: 3 },
  { level: 8, xp: 34000, proficiencyBonus: 3 },
  { level: 9, xp: 48000, proficiencyBonus: 4 },
  { level: 10, xp: 64000, proficiencyBonus: 4 },
  { level: 11, xp: 85000, proficiencyBonus: 4 },
  { level: 12, xp: 100000, proficiencyBonus: 4 },
  { level: 13, xp: 120000, proficiencyBonus: 5 },
  { level: 14, xp: 140000, proficiencyBonus: 5 },
  { level: 15, xp: 165000, proficiencyBonus: 5 },
  { level: 16, xp: 195000, proficiencyBonus: 5 },
  { level: 17, xp: 225000, proficiencyBonus: 6 },
  { level: 18, xp: 265000, proficiencyBonus: 6 },
  { level: 19, xp: 305000, proficiencyBonus: 6 },
  { level: 20, xp: 355000, proficiencyBonus: 6 },
];

export function getLevelFromXp(xp: number): {
  level: number;
  proficiencyBonus: number;
  currentLevelMinXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  const safeXp = Math.max(0, xp || 0);
  let current = DND5E_LEVEL_XP_THRESHOLDS[0];
  let next = DND5E_LEVEL_XP_THRESHOLDS[1];

  for (let i = DND5E_LEVEL_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (safeXp >= DND5E_LEVEL_XP_THRESHOLDS[i].xp) {
      current = DND5E_LEVEL_XP_THRESHOLDS[i];
      next = DND5E_LEVEL_XP_THRESHOLDS[Math.min(i + 1, DND5E_LEVEL_XP_THRESHOLDS.length - 1)];
      break;
    }
  }

  const range = next.xp - current.xp;
  const progress = range > 0 ? Math.min(100, Math.max(0, Math.round(((safeXp - current.xp) / range) * 100))) : 100;

  return {
    level: current.level,
    proficiencyBonus: current.proficiencyBonus,
    currentLevelMinXp: current.xp,
    nextLevelXp: next.xp,
    progressPercent: progress,
  };
}

export const CLASS_HIT_DICE: Record<string, { die: number; avgHp: number; isSpellcaster: boolean }> = {
  'Воин': { die: 10, avgHp: 6, isSpellcaster: false },
  'Fighter': { die: 10, avgHp: 6, isSpellcaster: false },
  'Варвар': { die: 12, avgHp: 7, isSpellcaster: false },
  'Barbarian': { die: 12, avgHp: 7, isSpellcaster: false },
  'Паладин': { die: 10, avgHp: 6, isSpellcaster: true },
  'Paladin': { die: 10, avgHp: 6, isSpellcaster: true },
  'Следопыт': { die: 10, avgHp: 6, isSpellcaster: true },
  'Ranger': { die: 10, avgHp: 6, isSpellcaster: true },
  'Жрец': { die: 8, avgHp: 5, isSpellcaster: true },
  'Cleric': { die: 8, avgHp: 5, isSpellcaster: true },
  'Друид': { die: 8, avgHp: 5, isSpellcaster: true },
  'Druid': { die: 8, avgHp: 5, isSpellcaster: true },
  'Плут': { die: 8, avgHp: 5, isSpellcaster: false },
  'Rogue': { die: 8, avgHp: 5, isSpellcaster: false },
  'Монах': { die: 8, avgHp: 5, isSpellcaster: false },
  'Monk': { die: 8, avgHp: 5, isSpellcaster: false },
  'Бард': { die: 8, avgHp: 5, isSpellcaster: true },
  'Bard': { die: 8, avgHp: 5, isSpellcaster: true },
  'Колдун': { die: 8, avgHp: 5, isSpellcaster: true },
  'Warlock': { die: 8, avgHp: 5, isSpellcaster: true },
  'Волшебник': { die: 6, avgHp: 4, isSpellcaster: true },
  'Wizard': { die: 6, avgHp: 4, isSpellcaster: true },
  'Чародей': { die: 6, avgHp: 4, isSpellcaster: true },
  'Sorcerer': { die: 6, avgHp: 4, isSpellcaster: true },
};

export function calculateHpGainOnLevelUp(className: string, conScore: number): number {
  const norm = Object.keys(CLASS_HIT_DICE).find((k) => k.toLowerCase() === className.toLowerCase());
  const info = norm ? CLASS_HIT_DICE[norm] : { avgHp: 5, die: 8, isSpellcaster: false };
  const conMod = getAbilityModifier(conScore);
  return Math.max(1, info.avgHp + conMod);
}

export function isClassSpellcaster(className: string): boolean {
  const norm = Object.keys(CLASS_HIT_DICE).find((k) => k.toLowerCase() === className.toLowerCase());
  return norm ? CLASS_HIT_DICE[norm].isSpellcaster : false;
}

export const CANTRIP_SUGGESTIONS_BY_CLASS: Record<string, string[]> = {
  'Волшебник': ['Огненный снаряд (Fire Bolt)', 'Луч холода (Ray of Frost)', 'Волшебная рука (Mage Hand)', 'Свет (Light)', 'Малая иллюзия (Minor Illusion)', 'Брызги кислоты (Acid Splash)'],
  'Wizard': ['Огненный снаряд (Fire Bolt)', 'Луч холода (Ray of Frost)', 'Волшебная рука (Mage Hand)', 'Свет (Light)', 'Малая иллюзия (Minor Illusion)', 'Брызги кислоты (Acid Splash)'],
  'Чародей': ['Огненный снаряд (Fire Bolt)', 'Электрошок (Shocking Grasp)', 'Волшебная рука (Mage Hand)', 'Фокусы (Prestidigitation)', 'Починка (Mending)'],
  'Sorcerer': ['Огненный снаряд (Fire Bolt)', 'Электрошок (Shocking Grasp)', 'Волшебная рука (Mage Hand)', 'Фокусы (Prestidigitation)', 'Починка (Mending)'],
  'Жрец': ['Священное пламя (Sacred Flame)', 'Указание (Guidance)', 'Пощада умирающих (Spare the Dying)', 'Свет (Light)', 'Сопротивление (Resistance)'],
  'Cleric': ['Священное пламя (Sacred Flame)', 'Указание (Guidance)', 'Пощада умирающих (Spare the Dying)', 'Свет (Light)', 'Сопротивление (Resistance)'],
  'Друид': ['Терновый кнут (Thorn Whip)', 'Сотворение пламени (Produce Flame)', 'Указание (Guidance)', 'Искусство друидов (Druidcraft)'],
  'Druid': ['Терновый кнут (Thorn Whip)', 'Сотворение пламени (Produce Flame)', 'Указание (Guidance)', 'Искусство друидов (Druidcraft)'],
  'Бард': ['Злая насмешка (Vicious Mockery)', 'Пляшущие огоньки (Dancing Lights)', 'Волшебная рука (Mage Hand)', 'Фокусы (Prestidigitation)'],
  'Bard': ['Злая насмешка (Vicious Mockery)', 'Пляшущие огоньки (Dancing Lights)', 'Волшебная рука (Mage Hand)', 'Фокусы (Prestidigitation)'],
  'Колдун': ['Мистический залп (Eldritch Blast)', 'Холод могилы (Chill Touch)', 'Волшебная рука (Mage Hand)', 'Малая иллюзия (Minor Illusion)'],
  'Warlock': ['Мистический залп (Eldritch Blast)', 'Холод могилы (Chill Touch)', 'Волшебная рука (Mage Hand)', 'Малая иллюзия (Minor Illusion)'],
};

export const SPELL_SUGGESTIONS_BY_CLASS: Record<string, string[]> = {
  'Волшебник': ['Волшебная стрела (Magic Missile)', 'Щит (Shield)', 'Огненный шар (Fireball)', 'Туманный шаг (Misty Step)', 'Зеркальный образ (Mirror Image)', 'Ускорение (Haste)', 'Невидимость (Invisibility)', 'Контрзаклинание (Counterspell)'],
  'Wizard': ['Волшебная стрела (Magic Missile)', 'Щит (Shield)', 'Огненный шар (Fireball)', 'Туманный шаг (Misty Step)', 'Зеркальный образ (Mirror Image)', 'Ускорение (Haste)', 'Невидимость (Invisibility)', 'Контрзаклинание (Counterspell)'],
  'Жрец': ['Исцеляющее слово (Healing Word)', 'Благословение (Bless)', 'Приказ (Command)', 'Духовное оружие (Spiritual Weapon)', 'Возрождение (Revivify)', 'Стражи духа (Spirit Guardians)'],
  'Cleric': ['Исцеляющее слово (Healing Word)', 'Благословение (Bless)', 'Приказ (Command)', 'Духовное оружие (Spiritual Weapon)', 'Возрождение (Revivify)', 'Стражи духа (Spirit Guardians)'],
  'Паладин': ['Божественная кара (Divine Smite)', 'Лечение ран (Cure Wounds)', 'Приказ (Command)', 'Охотничья метка (Hunter\'s Mark)'],
  'Paladin': ['Божественная кара (Divine Smite)', 'Лечение ран (Cure Wounds)', 'Приказ (Command)', 'Охотничья метка (Hunter\'s Mark)'],
  'Следопыт': ['Метка охотника (Hunter\'s Mark)', 'Град шипов (Hail of Thorns)', 'Лечение ран (Cure Wounds)', 'Туманное облако (Fog Cloud)'],
  'Ranger': ['Метка охотника (Hunter\'s Mark)', 'Град шипов (Hail of Thorns)', 'Лечение ран (Cure Wounds)', 'Туманное облако (Fog Cloud)'],
  'Бард': ['Исцеляющее слово (Healing Word)', 'Очарование личности (Charm Person)', 'Диссонирующий шепот (Dissonant Whispers)', 'Невидимость (Invisibility)'],
  'Bard': ['Исцеляющее слово (Healing Word)', 'Очарование личности (Charm Person)', 'Диссонирующий шепот (Dissonant Whispers)', 'Невидимость (Invisibility)'],
  'Колдун': ['Сглаз (Hex)', 'Руки Хадара (Arms of Hadar)', 'Адское возмездие (Hellish Rebuke)', 'Тьма (Darkness)', 'Голод Хадара (Hunger of Hadar)'],
  'Warlock': ['Сглаз (Hex)', 'Руки Хадара (Arms of Hadar)', 'Адское возмездие (Hellish Rebuke)', 'Тьма (Darkness)', 'Голод Хадара (Hunger of Hadar)'],
};

