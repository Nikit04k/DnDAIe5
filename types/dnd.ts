export type AbilityScoreKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type SkillName =
  | 'Acrobatics'
  | 'Animal Handling'
  | 'Arcana'
  | 'Athletics'
  | 'Deception'
  | 'History'
  | 'Insight'
  | 'Intimidation'
  | 'Investigation'
  | 'Medicine'
  | 'Nature'
  | 'Perception'
  | 'Performance'
  | 'Persuasion'
  | 'Religion'
  | 'Sleight of Hand'
  | 'Stealth'
  | 'Survival';

export interface Currency {
  gp: number; // Gold Pieces
  sp: number; // Silver Pieces
  cp: number; // Copper Pieces
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  category?: 'weapon' | 'armor' | 'potion' | 'tool' | 'misc' | 'quest';
  description?: string;
}

export interface CharacterSheet {
  name: string;
  class: string;
  subclass?: string;
  race: string;
  background?: string;
  level: number;
  experience?: number;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  ac: number;
  speed: number;
  proficiencyBonus: number;
  stats: Stats;
  savingThrowProficiencies: AbilityScoreKey[];
  skillProficiencies: SkillName[];
  equippedItems?: string[];  // Надетое снаряжение (оружие, доспех, щит, шлем, плащ)
  inventory: string[];       // Имеющиеся, но не надетые предметы в рюкзаке
  gold: number;
  deathSaves?: {
    successes: number;
    failures: number;
  };
  hitDiceMax?: number;
  hitDiceCurrent?: number;
  spellSlots?: {
    level1?: { max: number; current: number };
    level2?: { max: number; current: number };
    level3?: { max: number; current: number };
  };
  bio?: string;             // Detailed custom lore & backstory written by player
  backstory?: string;       // Origin, history, upbringing
  motivation?: string;      // Goals, why they started the journey, secrets
  appearance?: string;      // Physical description, scars, outfit
  personalityTraits?: string; // Character flaws, habits, values
  alignment?: string;
}

export interface WorldSettings {
  customSetting: string;    // Player's custom world lore, geography, magic, factions
  customTone: string;       // Atmosphere, narrative style (Grimdark, High Fantasy, Eldritch, etc.)
  customRules: string;      // World taboos, unique mechanics, deities, danger level
  startingScene?: string;   // Player's custom starting situation/scene where the game begins
  difficulty?: 'story' | 'standard' | 'hardcore';
  selectedPresetId?: string;
}

export type RollType = 'skill_check' | 'attack_roll' | 'saving_throw' | 'initiative' | 'ability_check';

export interface RollRequirement {
  needed: boolean;
  target_character_id?: string; // ID of the character required to roll
  target_character_name?: string; // Name of the character required to roll (e.g. "Торгрим")
  roll_type?: RollType | string;
  ability?: string; // e.g. "WIS", "DEX", "STR"
  skill?: string;   // e.g. "Perception", "Stealth", "Athletics"
  dc?: number;
  reason?: string;
}

export interface StateUpdate {
  hp_change: number;         // Negative = damage, Positive = healing
  added_items: string[];     // New items gained
  removed_items: string[];   // Items spent/lost
  gold_change: number;       // Change in gold (can be negative or positive)
  location_name?: string;    // Current location description
  time_passed_minutes?: number; // In-game time passed in minutes (e.g. 15 for fast action, 60 for 1h, 360 for wait to evening, 600 for 10h travel, 480 for sleep)
  new_time?: string;         // Explicit target time (e.g. "18:00", "День 1 • 18:00")
  new_day?: number;          // Explicit target day (e.g. 2)
}

export interface DmResponse {
  narrative: string;
  thought?: string; // Neural network reasoning/thinking process
  requires_roll: RollRequirement;
  suggested_actions: string[];
  state_update: StateUpdate;
  nearby_npcs?: Array<{
    name: string;
    role: string;
    relationship: string;
    affinity?: 'devoted' | 'friendly' | 'neutral' | 'distrustful';
    hp?: number;
    maxHp?: number;
    ac?: number;
    mainStat?: string;
    specialAbilities?: string;
    personality?: string;
  }>;
}

export interface DiceRollResult {
  diceType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
  count: number;
  rolls: number[];
  modifier: number;
  modifierName?: string;
  total: number;
  advantage?: boolean;
  disadvantage?: boolean;
  isCrit?: boolean;     // Nat 20
  isFumble?: boolean;   // Nat 1
  statOrSkill?: string;
  dc?: number;
  passed?: boolean;
  characterName?: string;
  characterId?: string;
  reason?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  thought?: string; // Collapsible neural network thinking/reasoning
  timestamp: number;
  gameTime?: string; // e.g. "День 1 • 08:30"
  senderId?: string;
  senderName?: string;
  senderCharacterName?: string;
  senderClass?: string;
  senderRace?: string;
  senderColor?: string;
  rollResult?: DiceRollResult;
  rollRequest?: RollRequirement;
  isTargetedRollWaiting?: boolean;
  waitingPlayerName?: string;
  stateUpdateApplied?: StateUpdate;
  isError?: boolean; // Error message indicator
  failedAction?: string; // Original action to retry
}

export interface PartyCompanion {
  id: string;
  name: string;
  role: string;          // e.g. "Жрица Света", "Воин-щитоносец", "Эльфийка-плутовка", "Боевой волк"
  relationship: string;  // Связь с главным героем: "Друг детства", "Спасенная пленница", "Наемник по контракту", "Оруженосец"
  affinity: 'devoted' | 'friendly' | 'neutral' | 'distrustful'; // Преданность / отношение
  hp: number;
  maxHp: number;
  ac: number;
  mainStat: string;      // e.g. "WIS +3", "STR +4", "DEX +3"
  specialAbilities: string; // e.g. "Малое исцеление (1d8+3), Свет, Благословение"
  personality: string;   // Характер, манеры, привычки
  status: 'active' | 'injured' | 'unconscious' | 'dead';
}

export interface LorebookEntry {
  id: string;
  keys: string[];        // Trigger keywords e.g. ["Лиана", "Жрица", "Таверна", "Артефакт"]
  title: string;
  content: string;
  enabled: boolean;
  constant?: boolean;    // Always injected into every prompt
  category?: 'npc' | 'location' | 'quest' | 'item' | 'rule';
}

export interface GameSessionState {
  id: string;
  character: CharacterSheet;
  world: WorldSettings;
  history: ChatMessage[];
  currentLocation: string;
  pendingRoll: RollRequirement | null;
  suggestedActions: string[];
  inGameDay?: number;
  inGameMinutes?: number;
  partyCompanions?: PartyCompanion[];
  journalEntries: Array<{
    id: string;
    timestamp: number;
    title: string;
    text: string;
    type: 'location' | 'quest' | 'npc' | 'lore';
  }>;
  lorebookEntries?: LorebookEntry[];
  storySummary?: string;
  createdAt: number;
  lastPlayedAt: number;
}

export interface CharacterPreset {
  id: string;
  name: string;
  title: string;
  class: string;
  race: string;
  background: string;
  level: number;
  maxHp: number;
  ac: number;
  speed: number;
  stats: Stats;
  savingThrowProficiencies: AbilityScoreKey[];
  skillProficiencies: SkillName[];
  equippedItems?: string[];
  inventory: string[];
  gold: number;
  bio: string;
  avatarIcon: string;
  accentColor: string;
}

// LAN Multiplayer Types
export interface NetworkPlayer {
  id: string; // Unique client socket ID / UUID
  name: string; // Player user name (or character name)
  character: CharacterSheet;
  isHost?: boolean;
  isReady?: boolean;
  connectedAt?: number;
  color?: string; // Player badge accent color
  ping?: number;
}

export interface PlayerRoundAction {
  playerId: string;
  characterName: string;
  playerClass?: string;
  playerRace?: string;
  playerColor?: string;
  actionText: string;
  timestamp: number;
}

export interface MultiplayerRoomState {
  isHost: boolean;
  connected: boolean;
  hostAddress: string;
  roomName: string;
  players: NetworkPlayer[];
  currentLocation: string;
  inGameDay: number;
  inGameMinutes: number;
  inGameTime: string;
  pendingRoll: RollRequirement | null;
  isDmThinking: boolean;
  history: ChatMessage[];
  roundActions?: Record<string, PlayerRoundAction>;
}

export type WsClientMessage =
  | { type: 'JOIN_ROOM'; player: { id: string; name: string; character: CharacterSheet; isHost?: boolean; color?: string } }
  | { type: 'UPDATE_CHARACTER'; character: CharacterSheet }
  | { type: 'SEND_ACTION'; actionText: string; characterId: string; characterName: string; playerClass?: string; playerRace?: string; playerColor?: string }
  | { type: 'SUBMIT_ROLL'; rollResult: DiceRollResult; rollReq: RollRequirement }
  | { type: 'TRIGGER_NEXT_DM_STEP'; triggerReason?: string }
  | { type: 'FORCE_DM_TURN' }
  | { type: 'UPDATE_STATE_HOST'; state: Partial<MultiplayerRoomState> }
  | { type: 'PING'; timestamp: number };

export type WsServerMessage =
  | { type: 'ROOM_STATE'; state: MultiplayerRoomState }
  | { type: 'PLAYER_JOINED'; player: NetworkPlayer }
  | { type: 'PLAYER_LEFT'; playerId: string; playerName: string }
  | { type: 'PLAYER_UPDATED'; player: NetworkPlayer }
  | { type: 'CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'CHAT_HISTORY_SYNC'; history: ChatMessage[] }
  | { type: 'DM_START_THINKING' }
  | { type: 'DM_RESPONSE'; message: ChatMessage; stateUpdate: StateUpdate; pendingRoll: RollRequirement | null; suggestedActions?: string[]; nearbyNpcs?: any[] }
  | { type: 'ROUND_STATE_UPDATE'; roundActions: Record<string, PlayerRoundAction> }
  | { type: 'FORCE_DM_TURN' }
  | { type: 'ROLL_REQUEST_BROADCAST'; pendingRoll: RollRequirement }
  | { type: 'ROLL_RESOLVED_BROADCAST'; rollMessage: ChatMessage; rollResult: DiceRollResult }
  | { type: 'STATE_SYNC'; currentLocation?: string; inGameDay?: number; inGameMinutes?: number; inGameTime?: string; partyCompanions?: PartyCompanion[] }
  | { type: 'PONG'; clientTimestamp: number; serverTimestamp: number }
  | { type: 'ERROR'; error: string };

