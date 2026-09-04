import {
  distributePartyXp,
  canAdvanceLevel,
  checkPendingLevelUp,
  getLevelFromXp,
  checkLevelUp,
  XP_TABLE,
} from '../lib/dndRules';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('=== TEST 1: XP Distribution (distributePartyXp) ===');

// 2 players, 100 XP -> 50 XP each
const xp2p = distributePartyXp(100, 2);
assert(xp2p === 50, `100 XP between 2 players = 50 XP (got ${xp2p})`);

// 3 players, 100 XP -> 33 XP each (floor)
const xp3p = distributePartyXp(100, 3);
assert(xp3p === 33, `100 XP between 3 players = 33 XP (got ${xp3p})`);

// 2 players, 100 XP, 1.5x multiplier -> 150 total -> 75 XP each
const xpMult = distributePartyXp(100, 2, 1.5);
assert(xpMult === 75, `100 XP with 1.5x multiplier between 2 players = 75 XP (got ${xpMult})`);

// Edge case: 0 XP or 0 party size
assert(distributePartyXp(0, 2) === 0, '0 XP returns 0');
assert(distributePartyXp(100, 0) === 0, '0 party size returns 0');

console.log('\n=== TEST 2: Level Progression Calculation (getLevelFromXp & XP_TABLE) ===');
assert(XP_TABLE[2] === 300, 'Level 2 requires 300 XP');
assert(XP_TABLE[3] === 900, 'Level 3 requires 900 XP');
assert(XP_TABLE[4] === 2700, 'Level 4 requires 2700 XP');
assert(XP_TABLE[5] === 6500, 'Level 5 requires 6500 XP');

const lvl1 = getLevelFromXp(299);
assert(lvl1.level === 1, '299 XP is Level 1');
assert(lvl1.nextLevelXp === 300, 'Next level XP is 300');

const lvl2 = getLevelFromXp(300);
assert(lvl2.level === 2, '300 XP is Level 2');
assert(lvl2.nextLevelXp === 900, 'Next level XP is 900');

const lvl3 = getLevelFromXp(950);
assert(lvl3.level === 3, '950 XP is Level 3');

console.log('\n=== TEST 3: In-Combat Deferred Level Up Rule (checkPendingLevelUp) ===');

// Character Level 1 with 350 XP (enough for Level 2)
// Case A: Combat is ACTIVE -> Level up is DEFERRED
const inCombatCheck = checkPendingLevelUp(350, 1, true);
assert(inCombatCheck.canLevelUp === false, 'Cannot level up during active combat');
assert(inCombatCheck.isDeferred === true, 'Level up is deferred during active combat');
assert(inCombatCheck.targetLevel === 2, 'Target level is 2');

// Case B: Combat is INACTIVE (outside combat / peaceful) -> Level up is AVAILABLE
const outCombatCheck = checkPendingLevelUp(350, 1, false);
assert(outCombatCheck.canLevelUp === true, 'Can level up outside combat');
assert(outCombatCheck.isDeferred === false, 'Level up is not deferred outside combat');
assert(outCombatCheck.targetLevel === 2, 'Target level is 2');

// Case C: Character Level 1 with 200 XP (not enough for Level 2)
const notEnoughXpCheck = checkPendingLevelUp(200, 1, false);
assert(notEnoughXpCheck.canLevelUp === false, 'Cannot level up without enough XP');
assert(notEnoughXpCheck.isDeferred === false, 'Not deferred when not eligible');
assert(notEnoughXpCheck.targetLevel === 1, 'Target level remains 1');

console.log('\n=== ALL XP ENGINE TESTS PASSED SUCCESSFULLY! ===');
