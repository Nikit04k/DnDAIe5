import { parseGmOverrideCommands } from '../lib/gmOverrides';
import { CharacterSheet } from '../types/dnd';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const mockChar: CharacterSheet = {
  id: 'test_player',
  name: 'Торгрим',
  class: 'Воин',
  race: 'Дварф',
  level: 1,
  experience: 0,
  maxHp: 20,
  currentHp: 5,
  tempHp: 0,
  stats: { str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8 },
  savingThrowProficiencies: ['str', 'con'],
  skillProficiencies: ['Athletics', 'Intimidation'],
  inventory: ['Боевой топор', 'Щит'],
  equippedItems: ['Боевой топор', 'Щит'],
  gold: 15,
  ac: 16,
  proficiencyBonus: 2,
  speed: 25,
};

console.log('=== TEST 1: Raw AI Directives (// and /prompt) ===');
const resRaw1 = parseGmOverrideCommands('// Сделай так, чтобы за дверью стоял сундук с сокровищами', mockChar);
assert(resRaw1.hasOverride === true, 'Raw // command detected');
assert(resRaw1.directives.some((d) => d.includes('сундук с сокровищами')), 'Directive injected');

const resRaw2 = parseGmOverrideCommands('/prompt Убей дракона молнией с небес', mockChar);
assert(resRaw2.hasOverride === true, '/prompt command detected');
assert(resRaw2.directives.some((d) => d.includes('Убей дракона молнией')), 'Prompt directive injected');

console.log('\n=== TEST 2: God Mode (/god) ===');
const resGod = parseGmOverrideCommands('/god', mockChar);
assert(resGod.hasOverride === true, '/god command detected');
assert(resGod.forcedStatePatch.forceHealFull === true, 'Force full heal set');
assert(resGod.forcedStatePatch.spell_slots_recovered?.all === true, 'Spell slots recovered set');
assert(resGod.forcedStatePatch.conditions_removed?.includes('Poisoned') === true, 'Conditions cleared');

console.log('\n=== TEST 3: Kill Enemies (/kill) ===');
const resKill = parseGmOverrideCommands('/kill all', mockChar);
assert(resKill.hasOverride === true, '/kill command detected');
assert(resKill.forcedStatePatch.forceKillCombat === true, 'Force kill combat set');

console.log('\n=== TEST 4: Add XP and Gold (/xp, /gold) ===');
const resXp = parseGmOverrideCommands('/xp 1500', mockChar);
assert(resXp.hasOverride === true, '/xp detected');
assert(resXp.forcedStatePatch.xp_change === 1500, 'XP change is 1500');

const resGold = parseGmOverrideCommands('/gold 750', mockChar);
assert(resGold.hasOverride === true, '/gold detected');
assert(resGold.forcedStatePatch.gold_change === 750, 'Gold change is 750');

console.log('\n=== TEST 5: Item and Teleport (/item, /tp) ===');
const resItem = parseGmOverrideCommands('/item Меч Драконоборца', mockChar);
assert(resItem.hasOverride === true, '/item detected');
assert(resItem.forcedStatePatch.added_items?.[0] === 'Меч Драконоборца', 'Item added');

const resTp = parseGmOverrideCommands('/tp Цитадель Солнца', mockChar);
assert(resTp.hasOverride === true, '/tp detected');
assert(resTp.forcedStatePatch.forceTeleportLocation === 'Цитадель Солнца', 'Location set');

console.log('\n=== TEST 6: Auto Win / Fail and Level Up (/win, /fail, /lvlup) ===');
const resWin = parseGmOverrideCommands('/win', mockChar);
assert(resWin.forcedStatePatch.forceRollAutoPass === true, '/win auto pass roll');

const resLvl = parseGmOverrideCommands('/lvlup', mockChar);
assert(resLvl.forcedStatePatch.forceLevelUpAvailable === true, '/lvlup level up available');

console.log('\n=== ALL GM OVERRIDE TESTS PASSED SUCCESSFULLY! ===');
