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
    items: ['Рюкзак', 'Спальник', '10 факелов', 'Трутница', 'Пеньковая веревка 15м', 'Сухпаек (10 шт.)', 'Фляга для воды'],
  },
  {
    id: 'explorer',
    nameRu: 'Набор путешественника / Следопыта',
    description: 'Для дальних странствий по дикой природе',
    items: ['Рюкзак', 'Спальник', 'Походный котелок', 'Трутница', '10 факелов', 'Сухпаек (10 шт.)', 'Бурдюк с водой'],
  },
  {
    id: 'burglar',
    nameRu: 'Набор взломщика / Грабителя',
    description: 'Для скрытных операций и проникновений',
    items: ['Рюкзак', '1000 стальных шариков', 'Колокольчик', '5 свечей', 'Лом', 'Молоток и 10 колышков', 'Шелковая веревка 15м', 'Сухпаек (5 шт.)'],
  },
  {
    id: 'priest',
    nameRu: 'Набор священника / Клирика',
    description: 'Для служителей богов и паломников',
    items: ['Рюкзак', 'Одеяло', '10 свечей', 'Трутница', 'Коробка для подаяний', 'Ладан и кадильница', 'Сухпаек (5 шт.)', 'Фляга со святой водой'],
  },
  {
    id: 'scholar',
    nameRu: 'Набор ученого / Мага',
    description: 'Для магов, алхимиков и мудрецов',
    items: ['Рюкзак', 'Книга по фольклору', 'Чернильница и перо', '10 листов пергамента', 'Мешочек с песком', 'Сухпаек (5 шт.)'],
  },
  {
    id: 'diplomat',
    nameRu: 'Набор дипломата / Дворянина',
    description: 'Для светских приемов и переговоров',
    items: ['Сундук', '2 футляра для карт и свитков', 'Комплект отличной одежды', 'Флакон чернил', 'Перо', 'Сургуч и печать', 'Сухпаек (5 шт.)'],
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
      'Огниво и факелы (3 шт)',
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
      'Тяжелый арбалет и 20 болтов',
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
      'Святая вода (2 флакона)',
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

/**
 * Normalizes any ration phrasing ("Сухпаек на 3 дня", "Сухпаек на 10 дней", "Сухпаек на неделю", "Сухпаек на 1 день", "Рацион на 5 дней")
 * into per-day piece count: "Сухпаек (X шт.)" or "Сухпаек (1 шт.)".
 * 1 штука = 1 день пропитания.
 */
export function normalizeRationItem(item: string): string {
  if (!item || typeof item !== 'string') return item;
  const lower = item.toLowerCase().trim();

  if (!lower.includes('сухпаек') && !lower.includes('сухой паек') && !lower.includes('рацион')) {
    return item;
  }

  // Already in "Сухпаек (X шт.)" format
  const piecesMatch = item.match(/(?:сухпаек|сухой па[её]к|рацион).*?\((\d+)\s*шт\.?\)/i);
  if (piecesMatch) {
    const count = parseInt(piecesMatch[1], 10);
    return `Сухпаек (${count} шт.)`;
  }

  // Match "на неделю" -> 7 шт.
  if (lower.includes('недел')) {
    return 'Сухпаек (7 шт.)';
  }

  // Match "на X дней" or "на X дня" or "на X суток"
  const daysMatch = item.match(/(?:на|хватит на)\s*(\d+)\s*(?:дн|сут)/i);
  if (daysMatch) {
    const count = parseInt(daysMatch[1], 10);
    return `Сухпаек (${count} шт.)`;
  }

  // Match "на 1 день" or "на день"
  if (lower.includes('на день') || lower.includes('на 1 день')) {
    return 'Сухпаек (1 шт.)';
  }

  // If simply "Сухпаек" or "Походный рацион" without count, treat as 1 piece
  return 'Сухпаек (1 шт.)';
}

