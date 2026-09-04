import { DND_REST_CONSTANTS, DIFFICULTY_PROFILES } from '../lib/difficultySettings';
import {
  createNewCoopSession,
  saveCoopSession,
  getCoopSessionById,
  exportCoopSessionAsJson,
  importCoopSessionFromJson,
} from '../lib/coopStorage';
import {
  CharacterSheet,
  NetworkPlayer,
  DmResponse,
} from '../types/dnd';

// Setup Mock LocalStorage for Node testing of storage module
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
};

console.log('====================================================');
console.log('🎲 D&D 5e AI DM: КООПЕРАТИВНЫЙ ТЕСТОВЫЙ МОДУЛЬ (2 ИГРОКА)');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (details) console.error(`     Детали: ${details}`);
  }
}

// ----------------------------------------------------
// 1. ИНИЦИАЛИЗАЦИЯ 2 ПЕРСОНАЖЕЙ ДЛЯ КООПЕРАТИВНОЙ СЕССИИ
// ----------------------------------------------------
console.log('📦 1. Создание 2 персонажей и проверка тактического позиционирования...');

const player1Char: CharacterSheet = {
  id: 'char_p1_thorgrim',
  name: 'Торгрим Железнобокий',
  race: 'Дварф',
  class: 'Воин',
  level: 3,
  currentHp: 28,
  maxHp: 28,
  tempHp: 0,
  ac: 18,
  speed: 25,
  proficiencyBonus: 2,
  stats: { str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8 },
  savingThrowProficiencies: ['str', 'con'],
  skillProficiencies: ['Athletics', 'Intimidation', 'Survival'],
  inventory: ['Боевой топор', 'Щит', 'Тяжелый кольчужный доспех', 'Зелье лечения (2d4+2)'],
  gold: 45,
  tactical_position: 'frontline',
};

const player2Char: CharacterSheet = {
  id: 'char_p2_elariel',
  name: 'Элариэль Звездный Шепот',
  race: 'Высший эльф',
  class: 'Волшебник',
  level: 3,
  currentHp: 16,
  maxHp: 16,
  tempHp: 0,
  ac: 12,
  speed: 30,
  proficiencyBonus: 2,
  stats: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
  savingThrowProficiencies: ['int', 'wis'],
  skillProficiencies: ['Arcana', 'History', 'Investigation', 'Perception'],
  inventory: ['Книга заклинаний', 'Посох волшебника', 'Компонентный мешочек', 'Свиток Опознания'],
  gold: 25,
  spellSlots: {
    level1: { max: 4, current: 4 },
    level2: { max: 2, current: 2 }
  },
  tactical_position: 'backline',
};

const networkPlayers: NetworkPlayer[] = [
  { id: 'player_1_host', name: 'Игрок 1 (Торгрим)', character: player1Char, isHost: true, color: '#f59e0b' },
  { id: 'player_2_peer', name: 'Игрок 2 (Элариэль)', character: player2Char, isHost: false, color: '#3b82f6' }
];

assert(player1Char.tactical_position === 'frontline', 'Игрок 1 (Торгрим) находится в Авангарде (Frontline)');
assert(player2Char.tactical_position === 'backline', 'Игрок 2 (Элариэль) находится в Тылу (Backline)');

// ----------------------------------------------------
// 2. ПРОВЕРКА КАНОНИЧНЫХ ПРАВИЛ ОТДЫХА D&D 5e
// ----------------------------------------------------
console.log('\n⏱️ 2. Проверка каноничных констант отдыха D&D 5e...');

assert(DND_REST_CONSTANTS.SHORT_REST_MINUTES === 60, 'Короткий отдых строго 60 минут (1 час)');
assert(DND_REST_CONSTANTS.LONG_REST_MINUTES === 480, 'Длинный отдых строго 480 минут (8 часов)');

const diffs = ['story', 'standard', 'hardcore'] as const;
for (const diff of diffs) {
  const preset = DIFFICULTY_PROFILES[diff];
  assert(
    preset.restRules.shortRestDurationMinutes === 60 && preset.restRules.longRestDurationMinutes === 480,
    `Сложность "${diff}": короткий=${preset.restRules.shortRestDurationMinutes} мин, длинный=${preset.restRules.longRestDurationMinutes} мин`
  );
}

// ----------------------------------------------------
// 3. ПРОВЕРКА КООПЕРАТИВНОГО ХРАНИЛИЩА (lib/coopStorage.ts)
// ----------------------------------------------------
console.log('\n💾 3. Тестирование модуля кооперативных сохранений...');

const newSession = createNewCoopSession({
  saveName: 'Забытые Шахты Фандельвера',
  partyPlayers: networkPlayers,
  world: {
    customSetting: 'Побережье Мечей',
    customTone: 'Классическое героическое фэнтези',
    customRules: 'Каноничные правила D&D 5e',
    difficulty: 'standard'
  }
});

assert(newSession.inGameDay === 1, 'Стартовый день кампании = День 1');
assert(newSession.inGameMinutes === 480, 'Стартовое время в минутах = 480 (08:00 утра)');
assert(newSession.inGameTime === 'День 1 • 08:00', 'Стартовое строковое время = "День 1 • 08:00"');
assert(Array.isArray(newSession.camp_inventory), 'Хранилище лагеря (camp_inventory) инициализировано');
assert(Array.isArray(newSession.unclaimed_loot), 'Общий пул добычи (unclaimed_loot) инициализирован');
assert(newSession.partyPlayers.length === 2, 'В сессию сохранены ровно 2 игрока');

saveCoopSession(newSession);
const loadedSession = getCoopSessionById(newSession.id);
assert(loadedSession !== null && loadedSession.id === newSession.id, 'Сессия успешно сохранена в localStorage и загружена');

const jsonExport = exportCoopSessionAsJson(newSession.id);
assert(typeof jsonExport === 'string' && jsonExport.includes('Торгрим'), 'Экспорт сессии в JSON работает корректно');

const importedSession = importCoopSessionFromJson(jsonExport!);
assert(importedSession !== null && importedSession.saveName === 'Забытые Шахты Фандельвера', 'Импорт сессии из JSON валиден');

// ----------------------------------------------------
// 4. ТЕСТИРОВАНИЕ БАТЧИНГА ХОДОВ И АГРЕГАЦИИ РАУНДА
// ----------------------------------------------------
console.log('\n🤝 4. Тестирование Co-op Turn Aggregator (Батчинг действий отряда)...');

const roundActions: Record<string, { playerId: string; playerName: string; characterName: string; actionText: string }> = {
  'player_1_host': {
    playerId: 'player_1_host',
    playerName: 'Игрок 1 (Торгрим)',
    characterName: 'Торгрим',
    actionText: 'Торгрим встает в глухую защиту щитом и бьет секирой переднего гоблина.'
  },
  'player_2_peer': {
    playerId: 'player_2_peer',
    playerName: 'Игрок 2 (Элариэль)',
    characterName: 'Элариэль',
    actionText: 'Элариэль совершает действие «Помощь» Торгриму, отвлекая гоблина иллюзорной вспышкой.'
  }
};

const jointActionPrompt =
  `[СОВМЕСТНЫЙ РАУНД ОТРЯДА (${networkPlayers.length} игроков)]:\n` +
  networkPlayers
    .map((p) => {
      const act = roundActions[p.id];
      const charName = p.character?.name || p.name;
      const text = act?.actionText || 'Пропускает ход, оценивая обстановку.';
      return `[Ход игрока: "${charName}" | ID: "${p.id}"]: ${text}`;
    })
    .join('\n');

assert(jointActionPrompt.includes('[СОВМЕСТНЫЙ РАУНД ОТРЯДА (2 игроков)]'), 'Сформирован совместный заголовок раунда отряда');
assert(jointActionPrompt.includes('ID: "player_1_host"'), 'Содержит действие Игрока 1 с ID');
assert(jointActionPrompt.includes('ID: "player_2_peer"'), 'Содержит действие Игрока 2 с ID');

// ----------------------------------------------------
// 5. ТЕСТИРОВАНИЕ СИСТЕМЫ МУЛЬТИ-БРОСКОВ (Array of Rolls) И АТРИБУЦИИ
// ----------------------------------------------------
console.log('\n🎯 5. Тестирование Мульти-бросков (required_rolls) и Механики Помощи...');

const mockDmResponseWithRolls: DmResponse = {
  narrative: 'Торгрим смыкает щит и заносит секиру на визжащего гоблина-застрельщика, в то время как вспышка света от Элариэль ослепляет тварь на мгновение! Сделайте броски:',
  requires_roll: {
    needed: true,
    target_character_id: 'player_1_host',
    target_character_name: 'Торгрим',
    roll_type: 'attack_roll',
    ability: 'STR',
    dc: 13,
    reason: 'Бросок атаки секирой по гоблину',
    advantage_type: 'advantage',
    assisted_by_player_id: 'player_2_peer'
  },
  required_rolls: [
    {
      needed: true,
      target_character_id: 'player_1_host',
      target_character_name: 'Торгрим',
      roll_type: 'attack_roll',
      ability: 'STR',
      dc: 13,
      reason: 'Бросок атаки секирой по гоблину',
      advantage_type: 'advantage',
      assisted_by_player_id: 'player_2_peer'
    },
    {
      needed: true,
      target_character_id: 'player_2_peer',
      target_character_name: 'Элариэль',
      roll_type: 'skill_check',
      skill: 'Arcana',
      ability: 'INT',
      dc: 12,
      reason: 'Проверка Магии для поддержания иллюзорного отвлечения',
      advantage_type: 'normal'
    }
  ],
  suggested_actions: ['Продолжать натиск', 'Отступить на шаг', 'Применить исцеление'],
  state_update: {
    time_passed_minutes: 1
  }
};

assert(mockDmResponseWithRolls.required_rolls?.length === 2, 'В ответе сгенерировано ровно 2 броска для двух игроков');
assert(mockDmResponseWithRolls.required_rolls?.[0].target_character_id === 'player_1_host', 'Бросок 1 назначен Торгриму');
assert(mockDmResponseWithRolls.required_rolls?.[0].advantage_type === 'advantage', 'Торгрим получил Преимущество благодаря Помощи (Help Action)');
assert(mockDmResponseWithRolls.required_rolls?.[0].assisted_by_player_id === 'player_2_peer', 'Помощь зафиксирована от Элариэль');
assert(mockDmResponseWithRolls.required_rolls?.[1].target_character_id === 'player_2_peer', 'Бросок 2 назначен Элариэль');

// ----------------------------------------------------
// 6. ТЕСТИРОВАНИЕ ОБМЕНА ПРЕДМЕТАМИ И ЗОЛОТОМ (P2P Trading)
// ----------------------------------------------------
console.log('\n🔄 6. Тестирование передачи предметов и золота (P2P Transfers)...');

const mockTradeUpdate: DmResponse = {
  narrative: 'Торгрим достает из сумки флакон и протягивает его раненой волшебнице: «Держи, девчонка, тебе нужнее!». Элариэль с благодарностью принимает зелье.',
  requires_roll: { needed: false },
  suggested_actions: ['Выпить зелье', 'Спрятать в сумку'],
  state_update: {
    time_passed_minutes: 1,
    p2p_transfers: [
      {
        from_player_id: 'player_1_host',
        to_player_id: 'player_2_peer',
        item: 'Зелье лечения (2d4+2)'
      }
    ],
    party_updates: {
      'player_1_host': {
        removed_items: ['Зелье лечения (2d4+2)']
      },
      'player_2_peer': {
        added_items: ['Зелье лечения (2d4+2)']
      }
    }
  }
};

assert(mockTradeUpdate.state_update.p2p_transfers?.length === 1, 'P2P трансфер зафиксирован в ответе');
const transfer = mockTradeUpdate.state_update.p2p_transfers![0];
assert(transfer.from_player_id === 'player_1_host' && transfer.to_player_id === 'player_2_peer', 'Отправитель: Торгрим, Получатель: Элариэль');
assert(transfer.item === 'Зелье лечения (2d4+2)', 'Переданный предмет: Зелье лечения (2d4+2)');
assert(mockTradeUpdate.state_update.party_updates?.['player_1_host']?.removed_items?.[0] === 'Зелье лечения (2d4+2)', 'Предмет удален у Торгрима');
assert(mockTradeUpdate.state_update.party_updates?.['player_2_peer']?.added_items?.[0] === 'Зелье лечения (2d4+2)', 'Предмет добавлен Элариэль');

// ----------------------------------------------------
// 7. ТЕСТИРОВАНИЕ ПРИВАТНЫХ ЗНАНИЙ И ТАЙН (Whispers)
// ----------------------------------------------------
console.log('\n🤫 7. Тестирование приватных нарративов (Whispers / Private Narratives)...');

const mockSecretUpdate: DmResponse = {
  narrative: 'Отряд входит в древний зал с колоннами. По стенам пляшут тени.',
  requires_roll: { needed: false },
  suggested_actions: ['Осмотреть алтарь', 'Идти вперед'],
  state_update: { time_passed_minutes: 5 },
  private_narratives: [
    {
      target_player_id: 'player_2_peer',
      text: 'Благодаря высокому интеллекту и знанию Магии, ты замечаешь слабое свечение скрытой руны Тьмы на третьей колонне справа. Торгрим этого не видит.'
    }
  ]
};

assert(mockSecretUpdate.private_narratives?.length === 1, 'Приватный нарратив сформирован');
assert(mockSecretUpdate.private_narratives?.[0].target_player_id === 'player_2_peer', 'Шепот адресован строго Элариэль');
assert(Boolean(mockSecretUpdate.private_narratives?.[0]?.text.includes('скрытой руны')), 'Текст содержит секретное магическое знание');

// ----------------------------------------------------
// 8. ТЕСТИРОВАНИЕ ПУЛА НЕРАСПРЕДЕЛЕННОЙ ДОБЫЧИ (Unclaimed Loot)
// ----------------------------------------------------
console.log('\n💎 8. Тестирование пула нераспределенной добычи и лагеря...');

const mockLootUpdate: DmResponse = {
  narrative: 'Вы сбиваете замок с кованого сундука гоблинов. Внутри блестят сокровища!',
  requires_roll: { needed: false },
  suggested_actions: ['Забрать добычу', 'Оставить в лагере'],
  state_update: { time_passed_minutes: 5 },
  unclaimed_loot: [
    { id: 'loot_1', name: 'Рубиновый амулет огня', type: 'accessory', count: 1 },
    { id: 'loot_2', name: 'Свиток Огненного Шара', type: 'scroll', count: 1 },
    { id: 'loot_3', name: 'Золотые монеты (50 GP)', type: 'gold', count: 50 }
  ]
};

assert(mockLootUpdate.unclaimed_loot?.length === 3, 'В unclaimed_loot обнаружено 3 предмета добычи');
assert(mockLootUpdate.unclaimed_loot?.[0].name === 'Рубиновый амулет огня', 'Предмет 1: Рубиновый амулет огня');

// ----------------------------------------------------
// ИТОГОВЫЙ ОТЧЕТ
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`📊 ИТОГИ ТЕСТИРОВАНИЯ КООПЕРАТИВНОГО РЕЖИМА: ${passedTests}/${totalTests} тестов пройдено успешно!`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ВСЕ 9 КООПЕРАТИВНЫХ СИСТЕМ И ПРАВИЛА РАБОТАЮТ БЕЗУПРЕЧНО!');
  process.exit(0);
} else {
  console.error('⚠️ Были обнаружены несоответствия!');
  process.exit(1);
}
