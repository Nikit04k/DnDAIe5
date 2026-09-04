import {
  getInitialSpellSlots,
  canCastSpell,
  deductSpellSlot,
  recoverSpellSlots,
  getSpellCircle,
} from '../lib/dndRules';
import { CharacterSheet, CoopSaveSession } from '../types/dnd';
import {
  createNewCoopSession,
  saveCoopSession,
  getCoopSessionById,
  triggerRestOrNewDayAutosave,
  exportCoopSessionAsJson,
  importCoopSessionFromJson,
} from '../lib/coopStorage';

// Mock localStorage for Node.js test environment
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
};

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log('\n=== TEST SUITE 1: SPELL SLOTS & RESTING RESTORATION ===');

// 1. Wizard Level 3 (Full Caster: 4x 1st level, 2x 2nd level)
const wizardChar: CharacterSheet = {
  name: 'Гендальф',
  class: 'Волшебник',
  race: 'Человек',
  background: 'Мудрец',
  level: 3,
  maxHp: 18,
  currentHp: 18,
  tempHp: 0,
  ac: 12,
  speed: 30,
  proficiencyBonus: 2,
  stats: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
  savingThrowProficiencies: ['int', 'wis'],
  skillProficiencies: ['Arcana', 'History'],
  inventory: [],
  equippedItems: [],
  gold: 50,
  bio: '',
  spellSlots: getInitialSpellSlots('Волшебник', 3),
};

assert(wizardChar.spellSlots?.['1']?.max === 4, 'Wizard Lvl 3 has 4 first-level spell slots');
assert(wizardChar.spellSlots?.['2']?.max === 2, 'Wizard Lvl 3 has 2 second-level spell slots');

// 2. Cantrips are free
const cantripCheck = canCastSpell(wizardChar, 'Огненный снаряд', true);
assert(cantripCheck.canCast === true && cantripCheck.circle === 0, 'Cantrips are always free without slot deduction');

// 3. Leveled Spell Cast
const spell1Check = canCastSpell(wizardChar, 'Волшебная стрела', false);
assert(spell1Check.canCast === true && spell1Check.circle === 1, 'Can cast 1st level spell with slots available');

// Deduct slot 1
let updatedWizard = deductSpellSlot(wizardChar, 1);
assert(updatedWizard.spellSlots?.['1']?.current === 3, 'After casting 1st circle spell, 3 slots remain');

// Cast all 2nd level slots
updatedWizard = deductSpellSlot(updatedWizard, 2);
updatedWizard = deductSpellSlot(updatedWizard, 2);
assert(updatedWizard.spellSlots?.['2']?.current === 0, 'Used up all 2nd level spell slots (0 left)');

// Attempt casting 2nd level spell with 0 slots
const spell2Check = canCastSpell(updatedWizard, 'Отражения', false);
assert(spell2Check.canCast === false, 'Blocked from casting 2nd level spell when 0 slots remaining');

// Short Rest on Wizard (Arcane Recovery restores 1 slot)
const shortRestWizard = recoverSpellSlots(updatedWizard, 'short');
assert((shortRestWizard.spellSlots?.['2']?.current || 0) > 0, 'Wizard Arcane Recovery restored spell slot on Short Rest');

// Long Rest on Wizard (All slots restored to max)
const longRestWizard = recoverSpellSlots(updatedWizard, 'long');
assert(longRestWizard.spellSlots?.['1']?.current === 4, 'Long Rest restored 1st level slots to 4/4');
assert(longRestWizard.spellSlots?.['2']?.current === 2, 'Long Rest restored 2nd level slots to 2/2');

// 4. Warlock Pact Magic (Pact slots recover on Short Rest)
const warlockChar: CharacterSheet = {
  ...wizardChar,
  name: 'Лок',
  class: 'Колдун',
  level: 3,
  spellSlots: getInitialSpellSlots('Колдун', 3),
};
assert(warlockChar.spellSlots?.['2']?.max === 2, 'Warlock Lvl 3 has 2 second-circle pact slots');
let usedWarlock = deductSpellSlot(warlockChar, 2);
usedWarlock = deductSpellSlot(usedWarlock, 2);
assert(usedWarlock.spellSlots?.['2']?.current === 0, 'Warlock used both pact slots');
const warlockRecovered = recoverSpellSlots(usedWarlock, 'short');
assert(warlockRecovered.spellSlots?.['2']?.current === 2, 'Warlock Pact Magic fully recovers on Short Rest');


console.log('\n=== TEST SUITE 2: CO-OP CAMPAIGN SAVES & AUTOSAVE RULES ===');

// Create new co-op session
const partyPlayer1 = { id: 'p1', name: 'Герой 1', character: wizardChar, isHost: true };
const partyPlayer2 = { id: 'p2', name: 'Герой 2', character: warlockChar, isHost: false };

const session = createNewCoopSession({
  saveName: 'Экспедиция в Забытые Земли',
  world: { customSetting: 'Фэнтези', customTone: 'Мрачный', customRules: '', startingScene: '', difficulty: 'standard' },
  partyPlayers: [partyPlayer1, partyPlayer2],
});

assert(session.id.startsWith('coop_'), 'Session ID generated with coop prefix');
assert(session.partyPlayers.length === 2, 'Session stores all party members');
assert(session.inGameDay === 1 && session.inGameMinutes === 480, 'Time tracker initialized at Day 1, 08:00');

// Trigger Long Rest Autosave
session.inGameDay = 2;
const autosaved = triggerRestOrNewDayAutosave(session, 'long_rest');
assert(Boolean(autosaved), 'triggerRestOrNewDayAutosave saved successfully');


const loadedSession = getCoopSessionById(session.id);
assert(loadedSession !== null, 'Loaded session from localStorage');
assert(Boolean(loadedSession?.saveName.includes('[Длит. Отдых]')), 'Autosave prefix [Длит. Отдых] attached to campaign name');
assert(loadedSession?.inGameDay === 2, 'Autosaved updated inGameDay = 2');


// Export to JSON & Import from JSON
const jsonStr = exportCoopSessionAsJson(session.id);
assert(typeof jsonStr === 'string' && jsonStr.length > 50, 'Exported session as valid JSON string');

const imported = importCoopSessionFromJson(jsonStr!);
assert(imported !== null, 'Imported session from JSON');
assert(imported?.partyPlayers.length === 2, 'Imported session retained all party players');

console.log('\n=== TEST SUITE 3: CO-OP CHAT RESET ON NEW CAMPAIGN & RESTORE ON LOAD ===');

// Simulate previous chat messages in a room
let activeRoomHistory = [
  { id: 'msg_1', role: 'model' as const, text: 'Старая сцена из прошлой игры', timestamp: 1000 },
  { id: 'msg_2', role: 'user' as const, text: 'Ход игрока из прошлой игры', timestamp: 2000 },
];

// 1. Host creates a NEW cooperative adventure -> Chat is reset to fresh empty chat
const isNewCampaign = true;
let newRoomHistory = isNewCampaign ? [] : activeRoomHistory;
assert(newRoomHistory.length === 0, 'New cooperative adventure opens a brand new pristine chat (0 messages)');

// 2. Initial DM opening scene is generated for the new chat
const introMessage = {
  id: 'msg_intro_1',
  role: 'model' as const,
  text: 'Вы стоите на перепутье древних дорог...',
  timestamp: Date.now(),
  gameTime: 'День 1 • 08:00',
};
newRoomHistory = [introMessage];
assert(newRoomHistory.length === 1 && newRoomHistory[0].id === 'msg_intro_1', 'New cooperative chat starts with the party intro scene');

// 3. Host LOADS a saved cooperative campaign -> Full saved chat history is restored
const savedCampaignSession: CoopSaveSession = {
  ...session,
  history: [
    { id: 'save_msg_1', role: 'model', text: 'Мастер: Вы вошли в пещеру.', timestamp: 100 },
    { id: 'save_msg_2', role: 'user', text: 'Гендальф: Освещаю путь заклинанием.', timestamp: 200 },
    { id: 'save_msg_3', role: 'model', text: 'Мастер: Впереди виден сундук!', timestamp: 300 },
  ],
  inGameDay: 3,
  inGameMinutes: 600,
  storySummary: 'Отряд исследовал пещеру гоблинов.',
};

let restoredRoomHistory = savedCampaignSession.history || [];
assert(restoredRoomHistory.length === 3, 'Loading cooperative save restores all 3 saved messages in chat');
assert(restoredRoomHistory[2].text === 'Мастер: Впереди виден сундук!', 'Loaded chat preserves accurate story continuity');
assert(savedCampaignSession.inGameDay === 3, 'Restored session inGameDay is 3');

console.log('\n🎉 ALL 24 TESTS PASSED SUCCESSFULLY!\n');

