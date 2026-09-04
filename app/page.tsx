'use client';

import React, { useState, useEffect, useRef } from 'react';
import { lanSocket } from '@/lib/multiplayerSocket';
import {
  CharacterSheet,
  WorldSettings,
  ChatMessage,
  DmResponse,
  RollRequirement,
  DmRollRequest,
  StateUpdate,
  DmStateUpdate,
  AbilityScoreKey,
  SkillName,
  GameSessionState,
  PartyCompanion,
  LorebookEntry,
  NetworkPlayer,
  PlayerRoundAction,
  DiceRollResult,
  SaveSlot,
  GameDifficulty,
  CoopSaveSession,
} from '@/types/dnd';
import {
  triggerRestOrNewDayAutosave,
  saveCoopSession,
} from '@/lib/coopStorage';


const DEFAULT_LOREBOOK_ENTRIES: LorebookEntry[] = [
  {
    id: 'lb_memory_rules',
    title: 'Память сюжета и хроника D&D',
    keys: ['сюжет', 'квест', 'задание', 'цель', 'хроника', 'история', 'кампания', 'миссия'],
    content: '[ПАМЯТЬ СЮЖЕТА]: Dungeon Master строго помнит все события, принятые решения, завершенные и текущие квесты игрока.',
    enabled: true,
    constant: true,
    category: 'rule',
  },
  {
    id: 'lb_npc_memory',
    title: 'Постоянство NPC и Спутников',
    keys: ['спутник', 'спутница', 'напарник', 'союзник', 'npc', 'персонаж', 'отряд', 'попутчик'],
    content: '[ПАМЯТЬ ОБ NPC]: Все встреченные NPC сохраняют свой характер, статус, внешность, расу и отношение к герою. Они помнят все прошлые диалоги и поступки.',
    enabled: true,
    constant: false,
    category: 'npc',
  },
  {
    id: 'lb_inventory_memory',
    title: 'Строгий инвентарь и управление предметами Мастером',
    keys: ['инвентарь', 'артефакт', 'зелье', 'свиток', 'золото', 'оружие', 'доспех', 'снаряжение', 'лут', 'предмет', 'рюкзак', 'достаю', 'вынимаю', 'пью', 'надеваю', 'зажигаю', 'беру', 'взял', 'забираю', 'подбираю', 'покупаю'],
    content: '[СТРОГИЙ ЗАКОН ИНВЕНТАРЯ И АВТОМАТИЧЕСКОЕ ДОБАВЛЕНИЕ]: Игрок не может создавать предметы вручную. Новые предметы добавляет только Dungeon Master в added_items при согласии игрока или словах «я беру...», «я взял...», «забираю...», «подбираю...». Использовать можно ТОЛЬКО имеющиеся в инвентаре предметы. Попытки достать несуществующее немедленно пресекаются!',
    enabled: true,
    constant: true,
    category: 'item',
  },
];
import {
  CHARACTER_PRESETS,
  normalizeRationItem,
  addItemToInventory,
  removeItemFromInventory,
  getLevelFromXp,
  calculateHpGainOnLevelUp,
  isClassSpellcaster,
  CANTRIP_SUGGESTIONS_BY_CLASS,
  SPELL_SUGGESTIONS_BY_CLASS,
  SKILL_RUSSIAN_NAMES,
  recoverSpellSlots,
} from '@/lib/dndRules';

import { parseAndAdvanceTime, formatInGameClock } from '@/lib/timeUtils';
import { executeDirectDmTurn, isStandaloneMobile } from '@/lib/directAiClient';
import {
  saveSessionState,
  loadSessionState,
  clearSessionState,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  getStoredBaseUrl,
  setStoredBaseUrl,
  getStoredCustomPrompt,
  setStoredCustomPrompt,
  exportSessionToFile,
  parseImportedSession,
  getStoredTtsVoice,
  isAutoTtsEnabled,
  getStoredTtsSpeed,
  getStoredTtsVolume,
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  isGeminiApiActive,
  setGeminiApiActive,
  getStoredGeminiModel,
  setStoredGeminiModel,
  recordGeminiUsage,
  getStoredUseOpenRouter,
  setStoredUseOpenRouter,
  getStoredUseLmStudio,
  setStoredUseLmStudio,
  getStoredLmStudioUrl,
  setStoredLmStudioUrl,
  getStoredLmStudioModel,
  setStoredLmStudioModel,
  getStoredLmStudioApiKey,
  setStoredLmStudioApiKey,
  isGpuSaverEnabled,
  setGpuSaverEnabled,
  getStoredWorldSettings,
  setStoredWorldSettings,
  saveCurrentGameToSlot,
} from '@/lib/storage';
import { playEdgeTts } from '@/lib/edgeTts';
import {
  isSoundEnabled,
  setSoundEnabled,
  playDiceRollSound,
  playCriticalHitSound,
  playCriticalFailSound,
  playDamageSound,
  playHealSound,
  playCoinSound,
  playItemGainSound,
} from '@/lib/diceSound';
import { Header } from '@/components/Header';
import { CharacterSheetView } from '@/components/CharacterSheetView';
import { ChatFeed } from '@/components/ChatFeed';
import { SuggestedActions } from '@/components/SuggestedActions';
import { ActionRollCard } from '@/components/ActionRollCard';
import { DiceRollerModal } from '@/components/DiceRollerModal';
import { SettingsModal } from '@/components/SettingsModal';
import { JournalModal } from '@/components/JournalModal';
import { CharacterCreatorModal } from '@/components/CharacterCreatorModal';
import { LanMultiplayerModal } from '@/components/LanMultiplayerModal';
import { SaveLoadModal } from '@/components/SaveLoadModal';
import { ScreenDiceRoller, ScreenDiceRollOptions } from '@/components/ScreenDiceRoller';
import { PartyRosterPanel } from '@/components/PartyRosterPanel';
import {
  Shield,
  Sparkles,
  ScrollText,
  Dices,
  Users,
  Settings,
  Radio,
  ChevronDown,
  ChevronUp,
  Award,
  Heart,
  Coins,
  Save,
  FolderOpen,
} from 'lucide-react';

export default function DnDApp() {
  // Game session states
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [character, setCharacter] = useState<CharacterSheet | null>(null);
  const [world, setWorld] = useState<WorldSettings>({
    customSetting: '',
    customTone: '',
    customRules: '',
    startingScene: '',
  });
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string>('Вход в Пустоши');
  const [pendingRoll, setPendingRoll] = useState<RollRequirement | DmRollRequest | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [locationsVisited, setLocationsVisited] = useState<string[]>(['Вход в Пустоши']);
  const [partyCompanions, setPartyCompanions] = useState<PartyCompanion[]>([]);
  const [nearbyNpcs, setNearbyNpcs] = useState<Array<Omit<PartyCompanion, 'id'>>>([]);
  const [journalEntries, setJournalEntries] = useState<
    Array<{ id: string; timestamp: number; title: string; text: string; type: 'location' | 'quest' | 'npc' | 'lore' }>
  >([]);
  const [lorebookEntries, setLorebookEntries] = useState<LorebookEntry[]>(DEFAULT_LOREBOOK_ENTRIES);
  const [storySummary, setStorySummary] = useState<string>('');

  // In-Game Day and Time Tracker (Starts at Day 1, 08:00 AM)
  const [inGameDay, setInGameDay] = useState<number>(1);
  const [inGameMinutes, setInGameMinutes] = useState<number>(8 * 60); // 480 mins = 08:00
  const [lastFailedAction, setLastFailedAction] = useState<string | null>(null);

  const formatInGameTime = (day: number, totalMinutes: number): string => {
    return formatInGameClock(day, totalMinutes);
  };

  // User Settings State
  const [apiKey, setApiKey] = useState<string>('');
  const [modelName, setModelName] = useState<string>('nvidia/nemotron-3-super-120b-a12b:free');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [useOpenRouter, setUseOpenRouter] = useState<boolean>(true);
  const [soundActive, setSoundActive] = useState<boolean>(true);

  // LM Studio (Local AI) State
  const [useLmStudio, setUseLmStudio] = useState<boolean>(false);
  const [lmStudioUrl, setLmStudioUrl] = useState<string>('http://localhost:1234/v1');
  const [lmStudioModel, setLmStudioModel] = useState<string>('');
  const [lmStudioApiKey, setLmStudioApiKey] = useState<string>('lm-studio');

  // Gemini Free Tier State
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [useGemini, setUseGemini] = useState<boolean>(false);
  const [geminiModel, setGeminiModel] = useState<string>('gemini-3.7-flash');



  // GPU Saver / Performance Mode
  const [gpuSaverActive, setGpuSaverActive] = useState<boolean>(true);

  const handleToggleGpuSaver = (active: boolean) => {
    setGpuSaverActive(active);
    setGpuSaverEnabled(active);
    if (typeof document !== 'undefined' && document.body) {
      if (active) {
        document.body.classList.add('gpu-saver');
      } else {
        document.body.classList.remove('gpu-saver');
      }
    }
  };

  // Top dropdown Character Sheet drawer state
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);

  // Modals & Panels
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isDiceRollerOpen, setIsDiceRollerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const [isSaveLoadOpen, setIsSaveLoadOpen] = useState(false);
  const [activeScreenRoll, setActiveScreenRoll] = useState<ScreenDiceRollOptions | null>(null);

  // LAN Multiplayer State
  const [isMultiplayerConnected, setIsMultiplayerConnected] = useState<boolean>(false);
  const [isHost, setIsHost] = useState<boolean>(true);
  const [lanIp, setLanIp] = useState<string>('127.0.0.1');
  const [networkPlayers, setNetworkPlayers] = useState<NetworkPlayer[]>([]);
  const [networkPing, setNetworkPing] = useState<number>(0);
  const [localPlayerId, setLocalPlayerId] = useState<string>('');
  const [roundActions, setRoundActions] = useState<Record<string, PlayerRoundAction>>({});

  // Initialize persistent player ID & discover LAN IP
  useEffect(() => {
    let pid = '';
    try {
      pid = localStorage.getItem('dnd5e_local_player_id') || '';
      if (!pid) {
        pid = 'player_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
        localStorage.setItem('dnd5e_local_player_id', pid);
      }
    } catch {
      pid = 'player_' + Date.now().toString(36);
    }
    setLocalPlayerId(pid);

    fetch('/api/lan/info')
      .then((res) => res.json())
      .then((data) => {
        if (data.primaryLanIp) setLanIp(data.primaryLanIp);
      })
      .catch(() => {});

    setUseOpenRouter(getStoredUseOpenRouter());

    // Synchronize world settings from persistent storage
    const savedWorld = getStoredWorldSettings();
    if (savedWorld && (savedWorld.customSetting || savedWorld.customTone || savedWorld.customRules)) {
      setWorld((prev) => ({
        ...prev,
        customSetting: savedWorld.customSetting || prev.customSetting,
        customTone: savedWorld.customTone || prev.customTone,
        customRules: savedWorld.customRules || prev.customRules,
      }));
    }
  }, []);

  const handleSaveWorld = (newWorld: WorldSettings) => {
    setWorld(newWorld);
    setStoredWorldSettings(newWorld);
  };

  // Global PC Keyboard Shortcuts (Esc to close, Alt+D for Dice, Alt+J for Journal, Alt+S for Settings, Alt+M for LAN)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        setIsJournalOpen(false);
        setIsDiceRollerOpen(false);
        setIsLanModalOpen(false);
        setIsCreatorOpen(false);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'd' || key === 'в') {
          e.preventDefault();
          setIsDiceRollerOpen((prev) => !prev);
        } else if (key === 'j' || key === 'о') {
          e.preventDefault();
          setIsJournalOpen((prev) => !prev);
        } else if (key === 's' || key === 'ы') {
          e.preventDefault();
          setIsSettingsOpen((prev) => !prev);
        } else if (key === 'm' || key === 'ь') {
          e.preventDefault();
          setIsLanModalOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Central state ref to avoid stale closures in socket events and async handlers
  const gameStateRef = useRef<any>({});
  gameStateRef.current = {
    character,
    world,
    history,
    networkPlayers,
    inGameDay,
    inGameMinutes,
    partyCompanions,
    journalEntries,
    lorebookEntries,
    storySummary,
    apiKey,
    modelName,
    baseUrl,
    customPrompt,
    useOpenRouter,
    useGemini,
    geminiApiKey,
    geminiModel,
    useLmStudio,
    lmStudioUrl,
    lmStudioModel,
    lmStudioApiKey,
    isMultiplayerConnected,
    isHost,
    localPlayerId,
    roundActions,
    loading,
  };

  // Centralized DM turn executor on the Host (processes actions from Host or connected Client players)
  const executeDmTurn = async (
    actionText: string,
    actingUserMessage?: ChatMessage,
    rollResultData?: DiceRollResult,
    isPromptHiddenFromChat: boolean = false
  ) => {
    const state = gameStateRef.current;
    if (!actionText || !actionText.trim() || !state.character) return;

    // Snapshot of in-game time when player takes the action
    const actionStartTime = formatInGameTime(state.inGameDay, state.inGameMinutes);

    let newHistory: ChatMessage[];
    if (isPromptHiddenFromChat) {
      // In multiplayer party rounds or roll resolutions, player messages already exist in chat feed
      // We do NOT create a duplicate prompt bubble in the visible UI
      newHistory = state.history.filter((m: ChatMessage) => !m.isError);
    } else {
      const userMessage: ChatMessage = actingUserMessage || {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        role: 'user',
        text: actionText,
        timestamp: Date.now(),
        gameTime: actionStartTime,
        senderId: state.localPlayerId,
        senderName: state.character.name,
        senderCharacterName: state.character.name,
        senderClass: state.character.class,
        senderRace: state.character.race,
        senderColor: state.isHost ? '#f59e0b' : '#38bdf8',
        rollResult: rollResultData,
      };

      newHistory = [
        ...state.history.filter((m: ChatMessage) => !m.isError && m.id !== userMessage.id),
        userMessage,
      ];
      setHistory(newHistory);
    }

    // If in multiplayer and we are Host, broadcast thinking spinner to all clients
    if (state.isMultiplayerConnected && state.isHost) {
      lanSocket.broadcastDmThinking();
    }

    setPendingRoll(null);
    setLoading(true);

    try {
      const activePartyPlayers = state.isMultiplayerConnected && state.networkPlayers.length > 0
        ? state.networkPlayers
        : [{ id: state.localPlayerId, name: state.character.name, character: state.character, isHost: true }];

      let data: DmResponse & { providerUsed?: string };

      const isMobileStandalone = isStandaloneMobile();

      if (isMobileStandalone && !state.isMultiplayerConnected) {
        // Standalone Direct Client Cloud AI (Google Gemini / OpenRouter) on Mobile
        data = await executeDirectDmTurn({
          world: state.world,
          character: state.character,
          partyPlayers: activePartyPlayers,
          history: newHistory,
          action: actionText,
          partyCompanions: state.partyCompanions,
          journalEntries: state.journalEntries,
          lorebookEntries: state.lorebookEntries,
          storySummary: state.storySummary,
          inGameDay: state.inGameDay,
          inGameMinutes: state.inGameMinutes,
          inGameTime: actionStartTime,
          apiKey: state.apiKey && state.apiKey.trim().length > 10 ? state.apiKey.trim() : undefined,
          modelName: state.modelName,
          baseUrl: state.baseUrl || undefined,
          customPrompt: state.customPrompt || undefined,
          useOpenRouter: state.useOpenRouter,
          useGemini: state.useGemini,
          geminiApiKey: state.geminiApiKey && state.geminiApiKey.trim().length > 5 ? state.geminiApiKey.trim() : undefined,
          geminiModel: state.geminiModel,
          useLmStudio: state.useLmStudio,
          lmStudioUrl: state.lmStudioUrl || undefined,
          lmStudioModel: state.lmStudioModel || undefined,
          lmStudioApiKey: state.lmStudioApiKey || undefined,
        });
      } else {
        try {
          const res = await fetch('/api/dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              world: state.world,
              character: state.character,
              partyPlayers: activePartyPlayers,
              history: newHistory,
              action: actionText,
              partyCompanions: state.partyCompanions,
              journalEntries: state.journalEntries,
              lorebookEntries: state.lorebookEntries,
              storySummary: state.storySummary,
              inGameDay: state.inGameDay,
              inGameMinutes: state.inGameMinutes,
              inGameTime: actionStartTime,
              apiKey: state.apiKey && state.apiKey.trim().length > 10 ? state.apiKey.trim() : undefined,
              modelName: state.modelName,
              baseUrl: state.baseUrl || undefined,
              customPrompt: state.customPrompt || undefined,
              useOpenRouter: state.useOpenRouter,
              useGemini: state.useGemini,
              geminiApiKey: state.geminiApiKey && state.geminiApiKey.trim().length > 5 ? state.geminiApiKey.trim() : undefined,
              geminiModel: state.geminiModel,
              useLmStudio: state.useLmStudio,
              lmStudioUrl: state.lmStudioUrl || undefined,
              lmStudioModel: state.lmStudioModel || undefined,
              lmStudioApiKey: state.lmStudioApiKey || undefined,
            }),
          });

          const contentType = res.headers.get('content-type') || '';
          if (!res.ok || contentType.includes('text/html')) {
            const errorJson = !contentType.includes('text/html') ? await res.json().catch(() => null) : null;
            const apiError = new Error(errorJson?.error || `Сервер API вернул статус ${res.status}`);
            (apiError as any).isApiError = true;
            throw apiError;
          }

          data = await res.json();
        } catch (serverErr: any) {
          if (serverErr.isApiError) {
            throw serverErr;
          }
          console.warn('API /api/dm request failed, executing direct client AI fallback:', serverErr?.message);
          data = await executeDirectDmTurn({
            world: state.world,
            character: state.character,
            partyPlayers: activePartyPlayers,
            history: newHistory,
            action: actionText,
            partyCompanions: state.partyCompanions,
            journalEntries: state.journalEntries,
            lorebookEntries: state.lorebookEntries,
            storySummary: state.storySummary,
            inGameDay: state.inGameDay,
            inGameMinutes: state.inGameMinutes,
            inGameTime: actionStartTime,
            apiKey: state.apiKey && state.apiKey.trim().length > 10 ? state.apiKey.trim() : undefined,
            modelName: state.modelName,
            baseUrl: state.baseUrl || undefined,
            customPrompt: state.customPrompt || undefined,
            useOpenRouter: state.useOpenRouter,
            useGemini: state.useGemini,
            geminiApiKey: state.geminiApiKey && state.geminiApiKey.trim().length > 5 ? state.geminiApiKey.trim() : undefined,
            geminiModel: state.geminiModel,
          });
        }
      }

      if (!data || !data.narrative) {
        throw new Error('Нейросеть не вернула повествование.');
      }

      if (data.providerUsed === 'gemini') {
        recordGeminiUsage();
      }

      setLastFailedAction(null);

      // High-Precision Adaptive In-Game Time Calculation
      const timeResult = parseAndAdvanceTime(
        state.inGameDay,
        state.inGameMinutes,
        actionText,
        data.narrative || '',
        data.state_update?.time_passed_minutes,
        data.state_update?.new_time,
        data.state_update?.new_day
      );

      setInGameDay(timeResult.nextDay);
      setInGameMinutes(timeResult.nextMinutes);
      const updatedInGameTime = timeResult.formatted;

      const appliedState = {
        ...data.state_update,
        time_passed_minutes: timeResult.timePassedMinutes,
        new_time: timeResult.formatted,
        new_day: timeResult.nextDay,
      };

      const dmMessage: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: data.narrative,
        thought: data.thought,
        timestamp: Date.now(),
        gameTime: updatedInGameTime,
        stateUpdateApplied: appliedState,
        rollRequest: data.requires_roll?.needed ? data.requires_roll : undefined,
        waitingPlayerName: data.requires_roll?.target_character_name,
        isTargetedRollWaiting: Boolean(data.requires_roll?.needed),
        privateNarratives: data.private_narratives,
      };

      setHistory([...newHistory, dmMessage]);
      setRoundActions({});
      applyDmStateUpdate(data);

      const rollReq = data.requires_roll?.needed ? data.requires_roll : null;
      setPendingRoll(rollReq);
      if (data.suggested_actions) setSuggestedActions(data.suggested_actions);

      // Detect Rest & New Day events for D&D 5e rest rules and autosave
      const lowerAction = actionText.toLowerCase();
      const lowerNarrative = (data.narrative || '').toLowerCase();
      const isLongRest =
        actionText.includes('ДЛИТЕЛЬНЫЙ ОТДЫХ') ||
        lowerAction.includes('длительный отдых') ||
        lowerAction.includes('long rest') ||
        lowerNarrative.includes('длительный отдых') ||
        lowerNarrative.includes('завершили ночлег');

      const isShortRest =
        !isLongRest &&
        (actionText.includes('КОРОТКИЙ ОТДЫХ') ||
         lowerAction.includes('короткий отдых') ||
         lowerAction.includes('short rest'));

      const isNextDay = timeResult.nextDay > state.inGameDay;

      // Rest recovery for player character
      if (isLongRest) {
        setCharacter((prev) => {
          if (!prev) return prev;
          const recoveredSlotsChar = recoverSpellSlots(prev, 'long');
          return { ...recoveredSlotsChar, currentHp: prev.maxHp };
        });
      } else if (isShortRest) {
        setCharacter((prev) => {
          if (!prev) return prev;
          return recoverSpellSlots(prev, 'short');
        });
      }

      // STRICT AUTOSAVE RULE: Auto-save strictly on Long Rest or at the start of a New Day
      if (isLongRest || isNextDay) {
        try {
          const currentDiff = state.world?.difficulty || 'standard';
          const reasonTag = isLongRest ? 'Длит. отдых' : 'Новый день';

          if (state.isMultiplayerConnected) {
            // Multiplayer Co-op campaign autosave
            const coopSessionToSave: CoopSaveSession = {
              id: `coop_active_${state.localPlayerId}`,
              saveName: `⚡ Авто (${reasonTag}, День ${timeResult.nextDay})`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              world: state.world,
              partyPlayers: activePartyPlayers,
              history: [...newHistory, dmMessage],
              storySummary: state.storySummary,
              inGameDay: timeResult.nextDay,
              inGameMinutes: timeResult.nextMinutes,
              inGameTime: updatedInGameTime,
              partyCompanions: state.partyCompanions,
              journalEntries: state.journalEntries,
              camp_inventory: (state as any).camp_inventory || [],
              unclaimed_loot: (state as any).unclaimed_loot || [],
            };
            triggerRestOrNewDayAutosave(coopSessionToSave, isLongRest ? 'long_rest' : 'new_day');
          } else {
            // Solo game autosave
            if (currentDiff === 'hardcore') {
              saveCurrentGameToSlot('slot_hardcore', '💀 Хардкор (Ironman)', false);
            } else {
              saveCurrentGameToSlot('slot_auto', `⚡ Авто (${reasonTag}, День ${timeResult.nextDay})`, true);
            }
          }
        } catch (e) {
          console.error('Rest / New Day Auto-save error:', e);
        }
      }


      // Broadcast DM response to all connected LAN multiplayer clients
      if (state.isMultiplayerConnected && state.isHost) {
        lanSocket.broadcastDmResponse(
          dmMessage,
          appliedState,
          rollReq,
          data.suggested_actions,
          data.nearby_npcs
        );
      }

      if (isAutoTtsEnabled() && data.narrative) {
        playEdgeTts(dmMessage.id, data.narrative, {
          voice: getStoredTtsVoice(),
          rate: getStoredTtsSpeed(),
          volume: getStoredTtsVolume(),
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to execute DM turn:', err);
      setLastFailedAction(actionText);
      const errorMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: `⚠️ **Ошибка ответа Мастера:** ${err?.message || 'Сбой сети'}.\n\nПроверьте соединение с интернетом или настройки API в меню Настройки.`,
        timestamp: Date.now(),
        gameTime: actionStartTime,
        isError: true,
        failedAction: actionText,
      };
      setHistory([...newHistory, errorMsg]);
      setSuggestedActions(['🔄 Повторить запрос', '⚙️ Настройки API']);
    } finally {
      setLoading(false);
    }
  };

  // Compile all players' actions into a joint group turn and execute DM turn
  const executeMultiplayerPartyRound = async (actionsMap: Record<string, PlayerRoundAction>) => {
    const actions = Object.values(actionsMap || {});
    if (!actions || actions.length === 0) return;
    if (gameStateRef.current.loading) return;

    if (actions.length === 1) {
      const a = actions[0];
      const singlePrompt = `[Ход игрока: "${a.characterName}" | ID: "${a.playerId}" | Персонаж: ${a.characterName}${a.playerClass ? ` (${a.playerClass})` : ''}]: ${a.actionText}`;
      await executeDmTurn(singlePrompt, undefined, undefined, true);
      return;
    }

    const actionsList = actions
      .map(
        (a, idx) =>
          `- Игрок ${idx + 1} ("${a.characterName}", ID: "${a.playerId}"): "${a.actionText}"`
      )
      .join('\n');

    const jointActionPrompt = `[СОВМЕСТНЫЙ РАУНД ОТРЯДА]:\n${actionsList}\n\nОпиши совместный результат действий всех участников отряда в рамках одной сцены, нарастающее напряжение, реакцию мира и дальнейшие события!`;

    // Hidden from visible chat feed - sent directly to AI DM
    await executeDmTurn(jointActionPrompt, undefined, undefined, true);
  };

  // Subscribe to LAN Multiplayer WebSocket events
  useEffect(() => {
    const unsub = lanSocket.subscribe((msg) => {
      switch (msg.type) {
        case 'ROOM_STATE':
          setIsMultiplayerConnected(true);
          if (msg.state.players) setNetworkPlayers(msg.state.players);
          if (msg.state.currentLocation) setCurrentLocation(msg.state.currentLocation);
          if (msg.state.inGameDay) setInGameDay(msg.state.inGameDay);
          if (msg.state.inGameMinutes !== undefined) setInGameMinutes(msg.state.inGameMinutes);
          if (msg.state.pendingRoll !== undefined) setPendingRoll(msg.state.pendingRoll);
          if (msg.state.roundActions) setRoundActions(msg.state.roundActions);
          if (msg.state.partyCompanions) setPartyCompanions(msg.state.partyCompanions);
          if (Array.isArray(msg.state.history)) {
            setHistory(msg.state.history);
          }
          break;

        case 'PLAYER_JOINED':
        case 'PLAYER_UPDATED':
          setNetworkPlayers((prev) => {
            const idx = prev.findIndex((p) => p.id === msg.player.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = msg.player;
              return updated;
            }
            return [...prev, msg.player];
          });
          break;

        case 'PLAYER_LEFT':
          setNetworkPlayers((prev) => prev.filter((p) => p.id !== msg.playerId));
          break;

        case 'CHAT_MESSAGE':
          setHistory((prev) => {
            if (prev.some((m) => m.id === msg.message.id)) return prev;
            return [...prev.filter((m) => !m.isError), msg.message];
          });
          break;

        case 'ROUND_STATE_UPDATE':
          setRoundActions(msg.roundActions || {});
          // If we are Host and ALL active connected players have submitted their moves, trigger the DM round!
          if (gameStateRef.current.isHost) {
            const curPlayers = gameStateRef.current.networkPlayers;
            const activePlayers = curPlayers.length > 0 ? curPlayers : [{ id: gameStateRef.current.localPlayerId }];
            const submittedCount = Object.keys(msg.roundActions || {}).length;

            if (activePlayers.length > 1 && submittedCount >= activePlayers.length) {
              executeMultiplayerPartyRound(msg.roundActions || {});
            }
          }
          break;

        case 'FORCE_DM_TURN':
          if (gameStateRef.current.isHost) {
            executeMultiplayerPartyRound(gameStateRef.current.roundActions || {});
          }
          break;

        case 'DM_START_THINKING':
          setLoading(true);
          break;

        case 'DM_RESPONSE':
          setLoading(false);
          setRoundActions({});
          if (msg.message) {
            setHistory((prev) => {
              if (prev.some((m) => m.id === msg.message.id)) return prev;
              return [...prev.filter((m) => !m.isError), msg.message];
            });
            if (isAutoTtsEnabled() && msg.message.text) {
              playEdgeTts(msg.message.id, msg.message.text, {
                voice: getStoredTtsVoice(),
                rate: getStoredTtsSpeed(),
                volume: getStoredTtsVolume(),
              }).catch(() => {});
            }
          }
          if (msg.stateUpdate) {
            applyDmStateUpdate({
              narrative: msg.message?.text || '',
              requires_roll: msg.pendingRoll || { needed: false },
              suggested_actions: msg.suggestedActions || [],
              state_update: msg.stateUpdate,
              nearby_npcs: msg.nearbyNpcs,
            });
          }
          setPendingRoll(msg.pendingRoll || null);
          if (msg.suggestedActions) setSuggestedActions(msg.suggestedActions);
          break;

        case 'ROLL_REQUEST_BROADCAST':
          setPendingRoll(msg.pendingRoll);
          break;

        case 'ROLL_RESOLVED_BROADCAST':
          setPendingRoll(null);
          // If we are Host, automatically advance story narrative with roll result in context
          if (gameStateRef.current.isHost) {
            const outcomeText = msg.rollResult.passed !== undefined
              ? (msg.rollResult.passed ? 'УСПЕХ' : 'ПРОВАЛ')
              : 'Результат';
            const actionPrompt = `[Результат броска d20 от персонажа "${msg.rollResult.characterName || 'Герой'}"]: ${msg.rollResult.statOrSkill || 'Проверка'} = ${msg.rollResult.total}${msg.rollResult.dc ? ` против DC ${msg.rollResult.dc}` : ''} -> ${outcomeText}. Опиши исход действия!`;
            executeDmTurn(actionPrompt, undefined, undefined, true);
          }
          break;

        case 'STATE_SYNC':
          if (msg.currentLocation) setCurrentLocation(msg.currentLocation);
          if (msg.inGameDay) setInGameDay(msg.inGameDay);
          if (msg.inGameMinutes !== undefined) setInGameMinutes(msg.inGameMinutes);
          if (msg.partyCompanions) setPartyCompanions(msg.partyCompanions);
          if (msg.history) setHistory(msg.history);
          break;

        case 'CHAT_HISTORY_SYNC':
          if (msg.history) {
            setHistory(msg.history);
          }
          break;

        case 'PLAYER_READY_CHANGED':
          setNetworkPlayers((prev) =>
            prev.map((p) => (p.id === msg.playerId ? { ...p, isReady: msg.isReady } : p))
          );
          break;

        case 'GAME_STARTED':
          if (msg.difficulty) {
            setWorld((prev) => ({ ...prev, difficulty: msg.difficulty }));
          }
          if (msg.worldSettings) {
            setWorld(msg.worldSettings);
          }
          if (msg.history !== undefined) {
            setHistory(msg.history);
          }
          if (msg.inGameDay) {
            setInGameDay(msg.inGameDay);
          }
          if (msg.inGameMinutes !== undefined) {
            setInGameMinutes(msg.inGameMinutes);
          }
          if (msg.partyCompanions) {
            setPartyCompanions(msg.partyCompanions);
          }
          if (msg.storySummary !== undefined) {
            setStorySummary(msg.storySummary);
          }
          setIsGameStarted(true);
          setIsLanModalOpen(false);
          playDiceRollSound();
          break;

        case 'LOBBY_SETTINGS_UPDATED':
          if (msg.difficulty) {
            setWorld((prev) => ({ ...prev, difficulty: msg.difficulty }));
          }
          break;

        case 'PONG':
          setNetworkPing(lanSocket.ping);
          break;
      }
    });

    return () => unsub();
  }, []);

  // Initialize from LocalStorage
  useEffect(() => {
    setApiKey(getStoredApiKey());
    setModelName(getStoredModel());
    setBaseUrl(getStoredBaseUrl());
    setCustomPrompt(getStoredCustomPrompt());
    setSoundActive(isSoundEnabled());
    setUseLmStudio(getStoredUseLmStudio());
    setLmStudioUrl(getStoredLmStudioUrl());
    setLmStudioModel(getStoredLmStudioModel());
    setLmStudioApiKey(getStoredLmStudioApiKey());
    setGeminiApiKey(getStoredGeminiApiKey());
    setUseGemini(isGeminiApiActive());
    setGeminiModel(getStoredGeminiModel());

    const gpuSaver = isGpuSaverEnabled();
    setGpuSaverActive(gpuSaver);
    if (typeof document !== 'undefined' && document.body) {
      if (gpuSaver) {
        document.body.classList.add('gpu-saver');
      } else {
        document.body.classList.remove('gpu-saver');
      }
    }

    const saved = loadSessionState();
    if (saved && saved.character) {
      if (!saved.character.equippedItems || saved.character.equippedItems.length === 0) {
        const preset = CHARACTER_PRESETS.find(
          (p) => p.name === saved.character.name || p.class === saved.character.class
        );
        saved.character.equippedItems = preset?.equippedItems || [];
      }
      if (saved.character.inventory && saved.character.inventory.length > 0) {
        saved.character.inventory = saved.character.inventory.map(normalizeRationItem);
      }
      setCharacter(saved.character);
      setWorld(saved.world);
      setHistory(saved.history);
      setCurrentLocation(saved.currentLocation || 'Начало пути');
      setPendingRoll(saved.pendingRoll || null);
      setSuggestedActions(saved.suggestedActions || []);
      setJournalEntries(saved.journalEntries || []);
      if (saved.partyCompanions && saved.partyCompanions.length > 0) {
        setPartyCompanions(saved.partyCompanions);
      }
      if (saved.lorebookEntries && saved.lorebookEntries.length > 0) {
        setLorebookEntries(saved.lorebookEntries);
      }
      if (saved.storySummary) {
        setStorySummary(saved.storySummary);
      }
      if (saved.inGameDay) {
        setInGameDay(saved.inGameDay);
      }
      if (saved.inGameMinutes !== undefined) {
        setInGameMinutes(saved.inGameMinutes);
      }
      setIsGameStarted(true);
    } else {
      setIsCreatorOpen(true);
    }
  }, []);

  // Save changes to LocalStorage on updates
  useEffect(() => {
    if (isGameStarted && character) {
      saveSessionState({
        character,
        world,
        history,
        currentLocation,
        pendingRoll,
        suggestedActions,
        journalEntries,
        partyCompanions,
        lorebookEntries,
        storySummary,
        inGameDay,
        inGameMinutes,
      });
    }
  }, [isGameStarted, character, world, history, currentLocation, pendingRoll, suggestedActions, journalEntries, partyCompanions, lorebookEntries, storySummary, inGameDay, inGameMinutes]);

  // Synchronize state updates received from AI DM
  const applyDmStateUpdate = (dmData: DmResponse) => {
    const update = dmData.state_update;
    if (!update) return;

    // 1. HP changes
    if (typeof update.hp_change === 'number' && update.hp_change !== 0) {
      if (update.hp_change > 0) playHealSound();
      else playDamageSound();

      setCharacter((prev) => {
        if (!prev) return prev;
        const newHp = Math.max(0, Math.min(prev.maxHp, prev.currentHp + (update.hp_change || 0)));
        return { ...prev, currentHp: newHp };
      });
    }

    // 2. Gold changes
    if (typeof update.gold_change === 'number' && update.gold_change !== 0) {
      if (update.gold_change > 0) playCoinSound();
      setCharacter((prev) => {
        if (!prev) return prev;
        return { ...prev, gold: Math.max(0, (prev.gold || 0) + (update.gold_change || 0)) };
      });
    }

    // 3. Experience (XP) & D&D 5e Level-Up Notification
    if (update.xp_change && update.xp_change !== 0) {
      setCharacter((prev) => {
        if (!prev) return prev;
        const multiplier = prev.xpMultiplier || world.xpMultiplier || 1;
        const awardedXp = Math.round(update.xp_change! * multiplier);
        const nextXp = Math.max(0, (prev.experience || 0) + awardedXp);
        const xpInfo = getLevelFromXp(nextXp);

        if (update.level_up_available || xpInfo.level > prev.level) {
          setTimeout(() => {
            setHistory((oldHist) => [
              ...oldHist,
              {
                id: `lvl_${Date.now()}`,
                role: 'system',
                text: `🎉 **НАЧИСЛЕН ОПЫТ (+${awardedXp} XP)!** ${prev.name} готов повысить уровень до **${xpInfo.level}-го**! Откройте лист персонажа вверху экрана, чтобы выбрать новые умения, характеристики и заклинания!`,
                timestamp: Date.now(),
              },
            ]);
          }, 150);
        }

        return {
          ...prev,
          experience: nextXp,
        };
      });
    }

    // 3.5. Inventory & Equipment updates
    if (
      (update.added_items && update.added_items.length > 0) ||
      (update.removed_items && update.removed_items.length > 0)
    ) {
      if (update.added_items && update.added_items.length > 0) {
        playItemGainSound();
      }
      setCharacter((prev) => {
        if (!prev) return prev;
        let updatedInv = [...(prev.inventory || [])];
        let updatedEquipped = [...(prev.equippedItems || [])];

        if (update.removed_items && update.removed_items.length > 0) {
          for (const it of update.removed_items) {
            updatedInv = removeItemFromInventory(updatedInv, it);
            updatedEquipped = removeItemFromInventory(updatedEquipped, it);
          }
        }
        if (update.added_items && update.added_items.length > 0) {
          for (const it of update.added_items) {
            updatedInv = addItemToInventory(updatedInv, it);
          }
        }
        return { ...prev, inventory: updatedInv, equippedItems: updatedEquipped };
      });
    }

    // 4. Location update
    if (update.location_name && update.location_name.trim().length > 0) {
      const newLoc = update.location_name.trim();
      setCurrentLocation(newLoc);
      setLocationsVisited((prev) => (prev.includes(newLoc) ? prev : [...prev, newLoc]));
    }

    // 4.5 Address-based party_updates for co-op players
    if (update.party_updates) {
      const myPatch = update.party_updates[localPlayerId];
      if (myPatch) {
        if (myPatch.hp_change && myPatch.hp_change !== 0) {
          if (myPatch.hp_change > 0) playHealSound();
          else playDamageSound();
          setCharacter((prev) => prev ? { ...prev, currentHp: Math.max(0, Math.min(prev.maxHp, prev.currentHp + myPatch.hp_change!)) } : prev);
        }
        if (myPatch.gold_change && myPatch.gold_change !== 0) {
          if (myPatch.gold_change > 0) playCoinSound();
          setCharacter((prev) => prev ? { ...prev, gold: Math.max(0, (prev.gold || 0) + myPatch.gold_change!) } : prev);
        }
        if (myPatch.xp_change && myPatch.xp_change !== 0) {
          setCharacter((prev) => {
            if (!prev) return prev;
            const multiplier = prev.xpMultiplier || world.xpMultiplier || 1;
            const awardedXp = Math.round(myPatch.xp_change! * multiplier);
            const nextXp = Math.max(0, (prev.experience || 0) + awardedXp);
            const xpInfo = getLevelFromXp(nextXp);
            if (myPatch.level_up_available) {
              setTimeout(() => {
                setHistory((oldHist) => [
                  ...oldHist,
                  {
                    id: `lvl_${Date.now()}`,
                    role: 'system',
                    text: `🎉 **НАЧИСЛЕН ОПЫТ (+${awardedXp} XP)!** ${prev.name} готов повысить уровень до **${xpInfo.level}-го**! Откройте лист персонажа, чтобы настроить новые умения!`,
                    timestamp: Date.now(),
                  },
                ]);
              }, 150);
            }
            return { ...prev, experience: nextXp };
          });
        }
        if (myPatch.added_items?.length || myPatch.removed_items?.length) {
          setCharacter((prev) => {
            if (!prev) return prev;
            let inv = [...prev.inventory];
            if (myPatch.added_items) {
              for (const item of myPatch.added_items) {
                if (item && !inv.includes(item)) inv.push(item);
              }
            }
            if (myPatch.removed_items) {
              inv = inv.filter((it) => !myPatch.removed_items!.includes(it));
            }
            return { ...prev, inventory: inv };
          });
        }
      }

      // Sync networkPlayers character states in lobby roster
      setNetworkPlayers((prev) =>
        prev.map((player) => {
          const patch = update.party_updates![player.id];
          if (!patch || !player.character) return player;
          const char = { ...player.character };
          if (patch.hp_change) char.currentHp = Math.max(0, Math.min(char.maxHp, char.currentHp + patch.hp_change));
          if (patch.gold_change) char.gold = Math.max(0, (char.gold || 0) + patch.gold_change);
          if (patch.xp_change) char.experience = Math.max(0, (char.experience || 0) + patch.xp_change);
          if (patch.added_items) {
            const curInv = [...char.inventory];
            for (const item of patch.added_items) {
              if (item && !curInv.includes(item)) curInv.push(item);
            }
            char.inventory = curInv;
          }
          if (patch.removed_items) {
            char.inventory = char.inventory.filter((it) => !patch.removed_items!.includes(it));
          }
          if (patch.tactical_position) {
            char.tactical_position = patch.tactical_position;
          }
          return { ...player, character: char };
        })
      );
    }

    // 5. Roll requirements & Multi-rolls
    const activeRollReq = (dmData.required_rolls && dmData.required_rolls.length > 0)
      ? dmData.required_rolls[0]
      : dmData.requires_roll;

    if (activeRollReq && 'needed' in activeRollReq && activeRollReq.needed) {
      setPendingRoll(activeRollReq);
    } else if (activeRollReq && !('needed' in activeRollReq) && (activeRollReq as any).dc) {
      setPendingRoll({ needed: true, ...(activeRollReq as any) });
    } else {
      setPendingRoll(null);
    }

    // 6. Suggested actions
    if (dmData.suggested_actions && Array.isArray(dmData.suggested_actions)) {
      setSuggestedActions(dmData.suggested_actions);
    }

    // 7. Nearby Recruitable NPCs from the current scene / story
    if (dmData.nearby_npcs && Array.isArray(dmData.nearby_npcs) && dmData.nearby_npcs.length > 0) {
      setNearbyNpcs(dmData.nearby_npcs as any);
    } else if (dmData.narrative) {
      const narrative = dmData.narrative;
      const discovered: Array<Omit<PartyCompanion, 'id'>> = [];
      if (narrative.includes('Лиана') || narrative.includes('лиана')) {
        discovered.push({
          name: 'Лиана',
          role: 'Эльфийка-жрица',
          relationship: 'Союзница из гильдии «Золотой Дракон»',
          affinity: 'friendly',
          hp: 18,
          maxHp: 18,
          ac: 14,
          mainStat: 'WIS +3',
          specialAbilities: 'Исцеляющее слово (1d4+3), Священное пламя',
          personality: 'Спокойная, внимательная к деталям.',
          status: 'active',
        });
      }
      if (narrative.includes('Иллиадро') || narrative.includes('иллиадро') || narrative.includes('Илиадро')) {
        discovered.push({
          name: 'Иллиадро',
          role: 'Следопыт / Проводник',
          relationship: 'Знаток местных руин и опасных троп',
          affinity: 'friendly',
          hp: 20,
          maxHp: 20,
          ac: 15,
          mainStat: 'DEX +3',
          specialAbilities: 'Стрельба из лука (+5), Следопыт',
          personality: 'Осторожный, немногословный.',
          status: 'active',
        });
      }
      if (narrative.includes('Рикард') || narrative.includes('рикард')) {
        discovered.push({
          name: 'Рыцарь Рикард',
          role: 'Воин-щитоносец',
          relationship: 'Рыцарь-наемник из гильдии',
          affinity: 'neutral',
          hp: 24,
          maxHp: 24,
          ac: 16,
          mainStat: 'STR +3',
          specialAbilities: 'Силовой удар, Второе дыхание',
          personality: 'Прямолинейный боец.',
          status: 'active',
        });
      }
      if (discovered.length > 0) {
        setNearbyNpcs(discovered);
      }
    }
  };

  // Launch a new campaign
  const handleStartCampaign = async (newCharacter: CharacterSheet, newWorld: WorldSettings) => {
    setCharacter(newCharacter);
    setWorld(newWorld);
    setStoredWorldSettings(newWorld);
    setHistory([]);
    setCurrentLocation('Начало пути');
    setLocationsVisited(['Начало пути']);
    setPendingRoll(null);
    setSuggestedActions([]);
    setIsCreatorOpen(false);
    setLoading(true);

    setInGameDay(1);
    setInGameMinutes(8 * 60);
    const startInGameTime = formatInGameTime(1, 8 * 60);

    const initialAction = newWorld.startingScene && newWorld.startingScene.trim().length > 0
      ? `Начни кампанию с заданной сцены: ${newWorld.startingScene.trim()}`
      : 'Начни кампанию. Опиши завязку истории, где находится персонаж, и создай интригующую первую ситуацию.';

    try {
      let data: DmResponse & { providerUsed?: string };

      if (isStandaloneMobile() && !isMultiplayerConnected) {
        data = await executeDirectDmTurn({
          world: newWorld,
          character: newCharacter,
          history: [],
          action: initialAction,
          partyCompanions: [],
          journalEntries: [],
          lorebookEntries: lorebookEntries,
          storySummary: '',
          inGameDay: 1,
          inGameMinutes: 8 * 60,
          inGameTime: startInGameTime,
          apiKey: apiKey && apiKey.trim().length > 10 ? apiKey.trim() : undefined,
          modelName: modelName,
          baseUrl: baseUrl || undefined,
          customPrompt: customPrompt || undefined,
          useOpenRouter: useOpenRouter,
          useGemini: useGemini,
          geminiApiKey: geminiApiKey && geminiApiKey.trim().length > 5 ? geminiApiKey.trim() : undefined,
          geminiModel: geminiModel,
          useLmStudio: useLmStudio,
          lmStudioUrl: lmStudioUrl || undefined,
          lmStudioModel: lmStudioModel || undefined,
          lmStudioApiKey: lmStudioApiKey || undefined,
        });
      } else {
        try {
          const res = await fetch('/api/dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              world: newWorld,
              character: newCharacter,
              history: [],
              action: initialAction,
              partyCompanions: [],
              journalEntries: [],
              lorebookEntries: lorebookEntries,
              storySummary: '',
              inGameDay: 1,
              inGameMinutes: 8 * 60,
              inGameTime: startInGameTime,
              apiKey: apiKey && apiKey.trim().length > 10 ? apiKey.trim() : undefined,
              modelName: modelName,
              baseUrl: baseUrl || undefined,
              customPrompt: customPrompt || undefined,
              useOpenRouter: useOpenRouter,
              useGemini: useGemini,
              geminiApiKey: geminiApiKey && geminiApiKey.trim().length > 5 ? geminiApiKey.trim() : undefined,
              geminiModel: geminiModel,
              useLmStudio: useLmStudio,
              lmStudioUrl: lmStudioUrl || undefined,
              lmStudioModel: lmStudioModel || undefined,
              lmStudioApiKey: lmStudioApiKey || undefined,
            }),
          });

          const contentType = res.headers.get('content-type') || '';
          if (!res.ok || contentType.includes('text/html')) {
            const errorJson = !contentType.includes('text/html') ? await res.json().catch(() => null) : null;
            const apiError = new Error(errorJson?.error || `Сервер API вернул статус ${res.status}`);
            (apiError as any).isApiError = true;
            throw apiError;
          }

          data = await res.json();
        } catch (serverErr: any) {
          if (serverErr.isApiError) {
            throw serverErr;
          }
          console.warn('API /api/dm start game request failed, executing direct client AI fallback:', serverErr?.message);
          data = await executeDirectDmTurn({
            world: newWorld,
            character: newCharacter,
            history: [],
            action: initialAction,
            partyCompanions: [],
            journalEntries: [],
            lorebookEntries: lorebookEntries,
            storySummary: '',
            inGameDay: 1,
            inGameMinutes: 8 * 60,
            inGameTime: startInGameTime,
            apiKey: apiKey && apiKey.trim().length > 10 ? apiKey.trim() : undefined,
            modelName: modelName,
            baseUrl: baseUrl || undefined,
            customPrompt: customPrompt || undefined,
            useOpenRouter: useOpenRouter,
            useGemini: useGemini,
            geminiApiKey: geminiApiKey && geminiApiKey.trim().length > 5 ? geminiApiKey.trim() : undefined,
            geminiModel: geminiModel,
            useLmStudio: useLmStudio,
            lmStudioUrl: lmStudioUrl || undefined,
            lmStudioModel: lmStudioModel || undefined,
            lmStudioApiKey: lmStudioApiKey || undefined,
          });
        }
      }
      if (!data || !data.narrative) {
        throw new Error('Нейросеть не вернула повествование.');
      }

      if (data.providerUsed === 'gemini') {
        recordGeminiUsage();
      }

      setLastFailedAction(null);
      const initialMessage: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: data.narrative,
        thought: data.thought,
        timestamp: Date.now(),
        gameTime: startInGameTime,
        stateUpdateApplied: data.state_update,
        privateNarratives: data.private_narratives,
      };

      setHistory([initialMessage]);
      applyDmStateUpdate(data);
      setIsGameStarted(true);

      if (isAutoTtsEnabled() && data.narrative) {
        playEdgeTts(initialMessage.id, data.narrative, {
          voice: getStoredTtsVoice(),
          rate: getStoredTtsSpeed(),
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to start campaign:', err);
      setLastFailedAction('START_CAMPAIGN');
      const errorMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: `⚠️ **Сбой подключения к нейросети:** ${err?.message || 'Сервер не отвечает'}.\n\nПроверьте интернет-соединение или укажите действующий API-ключ в Настройках.`,
        timestamp: Date.now(),
        gameTime: startInGameTime,
        isError: true,
        failedAction: 'START_CAMPAIGN',
      };
      setHistory([errorMsg]);
      setSuggestedActions(['🔄 Повторить запрос', '⚙️ Настройки API']);
      setIsGameStarted(true);
    } finally {
      setLoading(false);
    }
  };

  // Retry previous failed action
  const handleRetryAction = (actionToRetry?: string) => {
    const action = actionToRetry || lastFailedAction;
    if (!action) return;

    if (action === 'START_CAMPAIGN') {
      if (character && world) {
        handleStartCampaign(character, world);
      }
    } else {
      // Remove trailing error messages from history before retrying so conversation stays clean
      setHistory((prev) => prev.filter((m) => !m.isError));
      handleSendAction(action);
    }
  };

  // Multiplayer Host & Client Handlers
  const handleStartHost = (customPort?: number) => {
    if (!character) return;
    const hostPlayer: NetworkPlayer = {
      id: localPlayerId || 'host_1',
      name: character.name || 'Хост',
      character: character,
      isHost: true,
      color: '#f59e0b',
      ping: 1,
    };
    setIsHost(true);
    lanSocket.connect(`localhost:${customPort || 3000}`, hostPlayer);
    setIsMultiplayerConnected(true);
    setNetworkPlayers([hostPlayer]);
  };

  const handleConnectClient = (hostAddress: string, char: CharacterSheet) => {
    setCharacter(char);
    const clientPlayer: NetworkPlayer = {
      id: localPlayerId || ('client_' + Date.now()),
      name: char.name || 'Игрок',
      character: char,
      isHost: false,
      color: '#38bdf8',
      ping: 10,
    };
    setIsHost(false);
    lanSocket.connect(hostAddress, clientPlayer);
    setIsMultiplayerConnected(true);
    setIsGameStarted(true);
  };

  const handleDisconnectMultiplayer = () => {
    lanSocket.disconnect();
    setIsMultiplayerConnected(false);
    setNetworkPlayers([]);
  };

  // Submit dice roll in Multiplayer or Solo
  const handleRollSubmit = (
    rollText: string,
    rollBreakdown: {
      d20: number;
      modifier: number;
      total: number;
      isCrit: boolean;
      isFumble: boolean;
      passed?: boolean;
      characterName?: string;
    }
  ) => {
    const currentRollReq = pendingRoll;
    setPendingRoll(null);

    const rollResultData: DiceRollResult = {
      diceType: 'd20',
      count: 1,
      rolls: [rollBreakdown.d20],
      modifier: rollBreakdown.modifier,
      total: rollBreakdown.total,
      isCrit: rollBreakdown.isCrit,
      isFumble: rollBreakdown.isFumble,
      passed: rollBreakdown.passed,
      dc: currentRollReq?.dc,
      statOrSkill: currentRollReq?.skill || currentRollReq?.ability || 'Проверка',
      characterName: rollBreakdown.characterName || character?.name || 'Герой',
      characterId: localPlayerId,
      reason: currentRollReq?.reason,
    };

    if (isMultiplayerConnected) {
      lanSocket.submitRoll(rollResultData, currentRollReq || { needed: false });
    }

    // If we are Host or Solo, advance the DM narrative
    if (isHost || !isMultiplayerConnected) {
      handleSendAction(rollText, rollResultData);
    }
  };

  // Send player action to AI DM or LAN Server
  const handleSendAction = async (actionText: string, rollResultData?: DiceRollResult) => {
    if (!actionText.trim() || loading || !character) return;

    // Handle quick buttons from suggested actions
    if (actionText === '🔄 Повторить запрос') {
      handleRetryAction();
      return;
    }
    if (actionText === '⚙️ Настройки API' || actionText === '⚙️ Открыть Настройки') {
      setIsSettingsOpen(true);
      return;
    }

    // If in multiplayer (Client or Host)
    if (isMultiplayerConnected) {
      const senderColor = isHost ? '#f59e0b' : '#38bdf8';
      lanSocket.send({
        type: 'SEND_ACTION',
        actionText,
        characterId: localPlayerId,
        characterName: character.name,
        playerClass: character.class,
        playerRace: character.race,
        playerColor: senderColor,
      });

      setPendingRoll(null);

      // If only 1 player in LAN party, execute DM turn immediately
      if (networkPlayers.length <= 1 && isHost) {
        await executeDmTurn(actionText, undefined, rollResultData);
      }
      return;
    }

    // Offline solo mode
    await executeDmTurn(actionText, undefined, rollResultData);
  };

  // Quick stat roll from Character Sheet with on-screen 3D animation
  const handleRollStat = (statKey: AbilityScoreKey, statName: string, modifier: number) => {
    setActiveScreenRoll({
      title: `Проверка характеристики: ${statName} (${statKey.toUpperCase()})`,
      modifier,
      mode: 'normal',
      targetCharacterName: character?.name,
      onComplete: (res) => {
        const rollResultData: DiceRollResult = {
          diceType: 'd20',
          count: 1,
          rolls: [res.finalD20],
          modifier: res.modifier,
          total: res.total,
          isCrit: res.isCrit,
          isFumble: res.isFumble,
          statOrSkill: `Характеристика: ${statName}`,
          characterName: character?.name || 'Герой',
          characterId: localPlayerId,
        };

        if (isMultiplayerConnected) {
          lanSocket.submitRoll(rollResultData, { needed: false });
        }

        handleSendAction(res.summaryText, rollResultData);
      },
    });
  };

  // Quick skill roll from Character Sheet with on-screen 3D animation
  const handleRollSkill = (skillName: SkillName, modifier: number) => {
    const ruSkill = SKILL_RUSSIAN_NAMES[skillName] || skillName;
    setActiveScreenRoll({
      title: `Проверка навыка: ${ruSkill}`,
      modifier,
      mode: 'normal',
      targetCharacterName: character?.name,
      onComplete: (res) => {
        const rollResultData: DiceRollResult = {
          diceType: 'd20',
          count: 1,
          rolls: [res.finalD20],
          modifier: res.modifier,
          total: res.total,
          isCrit: res.isCrit,
          isFumble: res.isFumble,
          statOrSkill: `Навык: ${ruSkill}`,
          characterName: character?.name || 'Герой',
          characterId: localPlayerId,
        };

        if (isMultiplayerConnected) {
          lanSocket.submitRoll(rollResultData, { needed: false });
        }

        handleSendAction(res.summaryText, rollResultData);
      },
    });
  };

  const handleRestAction = (restType: 'short' | 'long') => {
    if (restType === 'short') {
      handleSendAction('🏕️ [КОРОТКИЙ ОТДЫХ]: Персонаж устраивает короткий привал на 1 час для отдыха, перевязки ран, восстановления сил и проверки снаряжения.');
    } else {
      handleSendAction('🌙 [ДЛИТЕЛЬНЫЙ ОТДЫХ]: Персонаж разбивает лагерь на ночлег (длительный отдых 8 часов): разводит костер, выставляет дозор и погружается в сон.');
    }
  };

  // Settings & Sound toggles
  const handleToggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    setStoredApiKey(key);
  };

  const handleSaveModelName = (model: string) => {
    setModelName(model);
    setStoredModel(model);
  };

  const handleSaveBaseUrl = (url: string) => {
    setBaseUrl(url);
    setStoredBaseUrl(url);
  };

  const handleSaveCustomPrompt = (prompt: string) => {
    setCustomPrompt(prompt);
    setStoredCustomPrompt(prompt);
  };

  const handleSaveUseOpenRouter = (active: boolean) => {
    setUseOpenRouter(active);
    setStoredUseOpenRouter(active);
  };

  const handleSaveGeminiApiKey = (key: string) => {
    setGeminiApiKey(key);
    setStoredGeminiApiKey(key);
  };

  const handleSaveUseGemini = (active: boolean) => {
    setUseGemini(active);
    setGeminiApiActive(active);
  };

  const handleSaveGeminiModel = (model: string) => {
    setGeminiModel(model);
    setStoredGeminiModel(model);
  };

  const handleSaveUseLmStudio = (active: boolean) => {
    setUseLmStudio(active);
    setStoredUseLmStudio(active);
  };

  const handleSaveLmStudioUrl = (url: string) => {
    setLmStudioUrl(url);
    setStoredLmStudioUrl(url);
  };

  const handleSaveLmStudioModel = (model: string) => {
    setLmStudioModel(model);
    setStoredLmStudioModel(model);
  };

  const handleSaveLmStudioApiKey = (key: string) => {
    setLmStudioApiKey(key);
    setStoredLmStudioApiKey(key);
  };

  const handleExportSave = () => {
    if (!character) return;
    const sessionState: GameSessionState = {
      id: 'session_' + Date.now(),
      character,
      world,
      history,
      currentLocation,
      pendingRoll,
      suggestedActions,
      partyCompanions,
      journalEntries,
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
    };
    exportSessionToFile(sessionState);
  };

  const handleImportSave = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = parseImportedSession(content);
        setCharacter(imported.character);
        setWorld(imported.world);
        setHistory(imported.history);
        setCurrentLocation(imported.currentLocation || 'Импортированная зона');
        setPendingRoll(imported.pendingRoll || null);
        setSuggestedActions(imported.suggestedActions || []);
        setJournalEntries(imported.journalEntries || []);
        setPartyCompanions(imported.partyCompanions || []);
        setIsGameStarted(true);
        saveSessionState(imported);
      } catch (err: any) {
        alert('Ошибка импорта файла сохранения: ' + (err?.message || 'Неверный формат'));
      }
    };
    reader.readAsText(file);
  };

  const handleResetGame = () => {
    clearSessionState();
    setCharacter(null);
    setHistory([]);
    setPartyCompanions([]);
    setIsGameStarted(false);
    setIsCreatorOpen(true);
  };

  const handleSessionLoaded = (loaded: GameSessionState) => {
    if (!loaded) return;
    if (loaded.character) setCharacter(loaded.character);
    if (loaded.world) {
      setWorld(loaded.world);
      setStoredWorldSettings(loaded.world);
    }
    if (loaded.history) setHistory(loaded.history);
    if (loaded.currentLocation) setCurrentLocation(loaded.currentLocation);
    if (loaded.inGameDay) setInGameDay(loaded.inGameDay);
    if (loaded.inGameMinutes !== undefined) setInGameMinutes(loaded.inGameMinutes);
    if (loaded.partyCompanions) setPartyCompanions(loaded.partyCompanions);
    if (loaded.journalEntries) setJournalEntries(loaded.journalEntries);
    if (loaded.lorebookEntries) setLorebookEntries(loaded.lorebookEntries);
    if (loaded.suggestedActions) setSuggestedActions(loaded.suggestedActions);
    if (loaded.pendingRoll !== undefined) setPendingRoll(loaded.pendingRoll);
    if (loaded.storySummary) setStorySummary(loaded.storySummary);
    setIsGameStarted(true);
    playDiceRollSound();
  };

  const handleCoopSessionLoaded = (coop: CoopSaveSession) => {
    if (!coop) return;
    if (coop.world) {
      setWorld(coop.world);
      setStoredWorldSettings(coop.world);
    }
    const loadedHistory = coop.history || [];
    const loadedDay = coop.inGameDay || 1;
    const loadedMinutes = coop.inGameMinutes !== undefined ? coop.inGameMinutes : 480;
    const loadedTime = coop.inGameTime || formatInGameTime(loadedDay, loadedMinutes);
    const loadedCompanions = coop.partyCompanions || [];
    const loadedSummary = coop.storySummary || '';

    setHistory(loadedHistory);
    setInGameDay(loadedDay);
    setInGameMinutes(loadedMinutes);
    setStorySummary(loadedSummary);
    setPartyCompanions(loadedCompanions);
    if (coop.journalEntries) setJournalEntries(coop.journalEntries as any);

    const myPlayer = coop.partyPlayers?.find((p) => p.id === localPlayerId || p.isHost);
    if (myPlayer?.character) {
      setCharacter(myPlayer.character);
    } else if (coop.partyPlayers && coop.partyPlayers[0]?.character) {
      setCharacter(coop.partyPlayers[0].character);
    }

    setIsGameStarted(true);
    playDiceRollSound();

    if (isMultiplayerConnected && isHost) {
      lanSocket.syncChatHistory(loadedHistory);
      lanSocket.broadcastStateSync({
        history: loadedHistory,
        inGameDay: loadedDay,
        inGameMinutes: loadedMinutes,
        inGameTime: loadedTime,
        partyCompanions: loadedCompanions,
      });
    }
  };

  const handleLobbyStartGame = async (chosenDiff?: GameDifficulty, campaignSession?: CoopSaveSession | null) => {
    let nextWorld: WorldSettings = {
      ...world,
      difficulty: chosenDiff || world.difficulty || 'standard',
    };

    if (campaignSession) {
      // ===== LOAD EXISTING CO-OP CAMPAIGN =====
      if (campaignSession.world) {
        nextWorld = { ...campaignSession.world, difficulty: chosenDiff || campaignSession.world.difficulty || 'standard' };
      }
      const loadedHistory = campaignSession.history || [];
      const loadedDay = campaignSession.inGameDay || 1;
      const loadedMinutes = campaignSession.inGameMinutes !== undefined ? campaignSession.inGameMinutes : 480;
      const loadedTime = campaignSession.inGameTime || formatInGameTime(loadedDay, loadedMinutes);
      const loadedCompanions = campaignSession.partyCompanions || [];
      const loadedSummary = campaignSession.storySummary || '';

      setHistory(loadedHistory);
      setInGameDay(loadedDay);
      setInGameMinutes(loadedMinutes);
      setStorySummary(loadedSummary);
      setPartyCompanions(loadedCompanions);
      if (campaignSession.journalEntries) {
        setJournalEntries(campaignSession.journalEntries as any);
      }
      setWorld(nextWorld);
      setStoredWorldSettings(nextWorld);
      setIsGameStarted(true);
      setIsLanModalOpen(false);
      playDiceRollSound();

      // Broadcast loaded campaign state & chat history to all connected clients in the room
      lanSocket.startGame(chosenDiff || nextWorld.difficulty, nextWorld, {
        isNewCampaign: false,
        history: loadedHistory,
        inGameDay: loadedDay,
        inGameMinutes: loadedMinutes,
        inGameTime: loadedTime,
        partyCompanions: loadedCompanions,
        storySummary: loadedSummary,
      });
    } else {
      // ===== START BRAND NEW CO-OP ADVENTURE =====
      // 1. Reset all story and chat progress to a pristine clean state
      const startDay = 1;
      const startMinutes = 8 * 60; // 08:00
      const startTime = formatInGameTime(startDay, startMinutes);

      setHistory([]);
      setCurrentLocation('Начало пути');
      setLocationsVisited(['Начало пути']);
      setPendingRoll(null);
      setSuggestedActions([]);
      setRoundActions({});
      setStorySummary('');
      setPartyCompanions([]);
      setJournalEntries([]);
      setInGameDay(startDay);
      setInGameMinutes(startMinutes);
      setWorld(nextWorld);
      setStoredWorldSettings(nextWorld);
      setIsGameStarted(true);
      setIsLanModalOpen(false);
      playDiceRollSound();

      // Notify all connected clients to start new game and clear chat history
      lanSocket.startGame(chosenDiff || nextWorld.difficulty, nextWorld, {
        isNewCampaign: true,
        history: [],
        inGameDay: startDay,
        inGameMinutes: startMinutes,
        inGameTime: startTime,
        partyCompanions: [],
        storySummary: '',
      });

      // 2. Automatically generate the opening DM narrative introducing all party members in the new chat
      const activePlayers = networkPlayers.length > 0 ? networkPlayers : [{ name: character?.name || 'Герой', character }];
      const partyRosterDesc = activePlayers
        .map((p, i) => `${i + 1}. ${p.character?.name || p.name} (${p.character?.race || 'Герой'} ${p.character?.class || 'Искатель приключений'})`)
        .join('\n');

      const initialAction = nextWorld.startingScene && nextWorld.startingScene.trim().length > 0
        ? `Начни кооперативную кампанию для отряда героев:\n${partyRosterDesc}\n\nЗаданная сцена: ${nextWorld.startingScene.trim()}`
        : `Начни кооперативную кампанию для отряда героев:\n${partyRosterDesc}\n\nОпиши яркую завязку истории, где они находятся вместе, их окружение, и создай интригующую первую ситуацию для всей группы.`;

      // Execute initial group intro DM turn
      setTimeout(() => {
        executeDmTurn(initialAction, undefined, undefined, false);
      }, 250);
    }
  };


  // Item consumption callback from character sheet (potions, scrolls, torches, water flask)
  const handleItemUsed = (itemName: string, narrativeAction?: string) => {
    handleSendAction(narrativeAction || `Я применяю: ${itemName}. Опиши эффект и результат этого действия.`);
  };

  return (
    <div className="h-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top App Header */}
      <Header
        character={character}
        currentLocation={currentLocation}
        soundEnabled={soundActive}
        onToggleSound={handleToggleSound}
        onOpenDiceRoller={() => setIsDiceRollerOpen(true)}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSaveLoad={() => setIsSaveLoadOpen(true)}
        onNewAdventure={() => setIsCreatorOpen(true)}
        onExportSave={handleExportSave}
        onImportSave={handleImportSave}
        isGameStarted={isGameStarted}
        modelName={modelName}
        useOpenRouter={useOpenRouter}
        useGemini={useGemini}
        geminiModel={geminiModel}
        useLmStudio={useLmStudio}
        lmStudioModel={lmStudioModel}
        onOpenMultiplayer={() => setIsLanModalOpen(true)}
        isMultiplayerConnected={isMultiplayerConnected}
        isHost={isHost}
        playerCount={networkPlayers.length}
      />

      {/* LAN Multiplayer Party Roster Panel */}
      {isMultiplayerConnected && networkPlayers.length > 0 && (
        <div className="flex-shrink-0">
          <PartyRosterPanel
            players={networkPlayers}
            pendingRoll={pendingRoll}
            roundActions={roundActions}
            isHost={isHost}
            isDmThinking={loading}
            currentLocalPlayerId={localPlayerId}
            onForceDmTurn={() => {
              if (isHost) {
                lanSocket.send({ type: 'FORCE_DM_TURN' });
                executeMultiplayerPartyRound(roundActions);
              }
            }}
            onOpenMultiplayerModal={() => setIsLanModalOpen(true)}
          />
        </div>
      )}

      {/* Main Gameplay Screen with Top Dropdown Character Bar */}
      {isGameStarted && character ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          {/* ================= TOP CHARACTER QUICK BAR & DROPDOWN TOGGLE ================= */}
          {(() => {
            const charXpInfo = getLevelFromXp(character.experience || 0);
            const canLvlUp = charXpInfo.level > character.level;
            const hpRatio = character.currentHp / (character.maxHp || 1);

            return (
              <div className="relative z-30 flex-shrink-0 bg-slate-950/95 border-b border-amber-500/30 px-3 py-2 shadow-lg backdrop-blur-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
                  {/* Left: Avatar, Name, Class & Level */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      onClick={() => setIsCharacterSheetOpen((prev) => !prev)}
                      className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 border border-amber-300 flex items-center justify-center font-cinzel font-bold text-slate-950 text-sm shadow cursor-pointer hover:scale-105 transition shrink-0"
                      title="Нажмите, чтобы открыть лист персонажа"
                    >
                      {character.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => setIsCharacterSheetOpen((prev) => !prev)}
                          className="font-cinzel font-bold text-sm text-amber-200 truncate cursor-pointer hover:text-amber-100 transition"
                        >
                          {character.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                          {character.level} ур.
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block">
                        {character.race} • {character.class}
                      </span>
                    </div>
                  </div>

                  {/* Center: HP, AC, Gold, XP Pill */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
                    {/* HP Pill */}
                    <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 shadow-sm">
                      <Heart className="w-3.5 h-3.5 text-red-400 fill-current/30" />
                      <span className="font-bold text-slate-200">
                        {character.currentHp}/{character.maxHp}
                      </span>
                      <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden ml-1 hidden sm:block">
                        <div
                          className={`h-full rounded-full transition-all ${
                            hpRatio > 0.5 ? 'bg-emerald-500' : hpRatio > 0.25 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, hpRatio * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* AC Badge */}
                    <div className="flex items-center gap-1 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 shadow-sm font-semibold text-slate-300">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span>{character.ac} AC</span>
                    </div>

                    {/* Gold Badge */}
                    <div className="flex items-center gap-1 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 shadow-sm font-semibold text-amber-300">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>{character.gold} gp</span>
                    </div>

                    {/* XP Progress Badge */}
                    <div className="hidden md:flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 shadow-sm text-[11px]">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-300">
                        {character.experience || 0} / {charXpInfo.nextLevelXp} XP
                      </span>
                      <div className="w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden ml-1">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${charXpInfo.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Can Level Up Badge */}
                    {canLvlUp && (
                      <button
                        onClick={() => setIsCharacterSheetOpen(true)}
                        className="px-2.5 py-1 bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-cinzel font-bold text-[10px] rounded-lg animate-pulse shadow-md cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-slate-950" />
                        <span>ПОВЫСИТЬ УРОВЕНЬ!</span>
                      </button>
                    )}
                  </div>

                  {/* Right: Dropdown Toggle Button */}
                  <button
                    onClick={() => setIsCharacterSheetOpen((prev) => !prev)}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-cinzel font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                      isCharacterSheetOpen
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20'
                        : 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 hover:from-amber-900/60 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    <span>📜 Лист персонажа</span>
                    {isCharacterSheetOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* SLIDING TAROT PARCHMENT CHARACTER SHEET (OVERLAY DRAWER) */}
                {isCharacterSheetOpen && (
                  <div className="absolute inset-x-0 top-full z-50 max-h-[85vh] overflow-y-auto bg-[#110e0c]/98 backdrop-blur-xl shadow-2xl border-b-2 border-amber-600/50 animate-dropdownSlideDown">
                    <CharacterSheetView
                      character={character}
                      onUpdateCharacter={(updater) => {
                        setCharacter((prev) => {
                          const updated = prev ? updater(prev) : prev;
                          if (updated && isMultiplayerConnected) {
                            lanSocket.updateCharacter(updated);
                          }
                          return updated;
                        });
                      }}
                      onRollStat={handleRollStat}
                      onRollSkill={handleRollSkill}
                      onRestAction={handleRestAction}
                      onItemUsed={handleItemUsed}
                      onClose={() => setIsCharacterSheetOpen(false)}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Full-Width Narrative Feed & Action Area (100% SCREEN WIDTH) */}
          <main className="flex flex-1 flex-col justify-between overflow-hidden relative w-full h-full min-h-0">
            {/* Dungeon Stone & Centered Mystic Rune Circle Background (Img 1) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 flex items-center justify-center">
              {/* Dark masonry texture */}
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95"
                style={{ backgroundImage: "url('/dungeon_stone_bg.jpg')" }}
              />
              {/* Vignette atmosphere for contrast & depth */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-transparent to-slate-950/85 pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,rgba(2,6,23,0.65)_100%)] pointer-events-none" />

              {/* Faint blue mystical glowing rune circle centered behind text blocks */}
              <div className="relative w-[520px] h-[520px] sm:w-[640px] sm:h-[640px] lg:w-[740px] lg:h-[740px] max-w-[85vw] max-h-[85vh] flex items-center justify-center pointer-events-none">
                <img
                  src="/magic_rune_circle.jpg"
                  alt="Магический круг с рунами"
                  className="w-full h-full object-contain mix-blend-screen opacity-50 filter drop-shadow-[0_0_30px_rgba(56,189,248,0.4)] animate-rune-glow pointer-events-none"
                />
              </div>
            </div>

            {/* Chat Feed (Only this scrollable area scrolls with story text!) */}
            <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden relative z-10">
              <ChatFeed
                history={history}
                loading={loading}
                playerName={character.name}
                localPlayerId={localPlayerId}
                onRetryAction={handleRetryAction}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </div>

            {/* Bottom Action Section (Pinned to bottom) */}
            <div className="flex-shrink-0 p-2 sm:p-4 border-t border-slate-800/80 bg-slate-950/98 z-10 shadow-lg">
              {pendingRoll && pendingRoll.needed ? (
                (() => {
                  const targetName = (pendingRoll.target_character_name || '').toLowerCase().trim();
                  const isGroupOrGeneric =
                    !targetName ||
                    targetName.includes('совместн') ||
                    targetName.includes('отряд') ||
                    targetName.includes('геро') ||
                    targetName.includes('все') ||
                    targetName.includes('раунд');

                  const isMatchedToLocal = Boolean(
                    character &&
                      (targetName === character.name.toLowerCase().trim() ||
                        targetName.includes(character.name.toLowerCase().trim()) ||
                        character.name.toLowerCase().includes(targetName) ||
                        pendingRoll.target_character_id === localPlayerId)
                  );

                  const hasOtherExactPartyMatch = Boolean(
                    isMultiplayerConnected &&
                      networkPlayers.length > 1 &&
                      networkPlayers.some(
                        (p) =>
                          p.id !== localPlayerId &&
                          (p.id === pendingRoll.target_character_id ||
                            (p.character?.name && p.character.name.toLowerCase().trim() === targetName) ||
                            (p.name && p.name.toLowerCase().trim() === targetName))
                      )
                  );

                  const isLocalTarget = isMatchedToLocal || isGroupOrGeneric || !hasOtherExactPartyMatch || !isMultiplayerConnected;

                  if (isLocalTarget) {
                    return (
                      <ActionRollCard
                        rollReq={pendingRoll}
                        character={character}
                        loading={loading}
                        onPerformRoll={handleRollSubmit}
                        onTriggerScreenRoll={(opts) => setActiveScreenRoll(opts)}
                      />
                    );
                  }

                  return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border-2 border-amber-500/40 text-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                          <Dices className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
                            Ожидание броска кубика
                          </span>
                          <p className="text-sm font-medium text-slate-100">
                            Мастер запросил бросок{' '}
                            <strong className="text-amber-300">
                              {pendingRoll.skill || pendingRoll.ability || 'D20'}
                              {pendingRoll.dc ? ` (DC ${pendingRoll.dc})` : ''}
                            </strong>{' '}
                            от персонажа <strong className="text-cyan-300 font-bold">{pendingRoll.target_character_name}</strong>
                          </p>
                          {pendingRoll.reason && (
                            <p className="text-xs text-slate-400 italic mt-0.5">«{pendingRoll.reason}»</p>
                          )}
                        </div>
                      </div>

                      {isHost && (
                        <button
                          onClick={() => {
                            setActiveScreenRoll({
                              title: `Бросок за ${pendingRoll.target_character_name}`,
                              subtitle: pendingRoll.reason,
                              dc: pendingRoll.dc,
                              modifier: 2,
                              mode: 'normal',
                              targetCharacterName: pendingRoll.target_character_name,
                              onComplete: (res) => {
                                handleRollSubmit(
                                  `🎲 [Хост бросил за ${pendingRoll.target_character_name}]: d20 (${res.finalD20}) + 2 = **${res.total}**${pendingRoll.dc ? ` (против DC ${pendingRoll.dc})` : ''}`,
                                  {
                                    d20: res.finalD20,
                                    modifier: 2,
                                    total: res.total,
                                    isCrit: res.isCrit,
                                    isFumble: res.isFumble,
                                    passed: res.passed,
                                    characterName: pendingRoll.target_character_name,
                                  }
                                );
                              },
                            });
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 transition shrink-0 cursor-pointer"
                        >
                          🎲 Бросить за игрока
                        </button>
                      )}
                    </div>
                  );
                })()
              ) : (
                /* Standard player action & AI suggested quick chips */
                (() => {
                  const isLocalSubmitted =
                    isMultiplayerConnected &&
                    networkPlayers.length > 1 &&
                    Boolean(roundActions[localPlayerId]);
                  const readyCount = networkPlayers.filter((p) => roundActions[p.id]).length;
                  const statusText = `${readyCount}/${networkPlayers.length} готовы`;

                  return (
                    <SuggestedActions
                      suggestedActions={suggestedActions}
                      loading={loading}
                      isRoundActionSubmitted={isLocalSubmitted}
                      submittedActionText={roundActions[localPlayerId]?.actionText || ''}
                      roundStatusText={statusText}
                      onSendAction={handleSendAction}
                    />
                  );
                })()
              )}
            </div>
          </main>
        </div>
      ) : (
        /* Empty / Welcome State if modal closed before starting */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
          {/* Centered Dungeon Stone & Mystic Rune Circle Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95"
              style={{ backgroundImage: "url('/dungeon_stone_bg.jpg')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950/90 pointer-events-none" />
            <div className="relative w-[500px] h-[500px] sm:w-[620px] sm:h-[620px] max-w-[85vw] max-h-[85vh] flex items-center justify-center pointer-events-none">
              <img
                src="/magic_rune_circle.jpg"
                alt=""
                className="w-full h-full object-contain mix-blend-screen opacity-50 filter drop-shadow-[0_0_30px_rgba(56,189,248,0.4)] animate-rune-glow pointer-events-none"
              />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="font-cinzel text-2xl font-bold text-amber-300 mb-2">
              Готовы к новому приключению?
            </h2>
            <p className="text-sm text-slate-400 max-w-md mb-6">
              Выберите готового персонажа или создайте собственного героя и погрузитесь в соло-кампанию или LAN мультиплеер с искусственным интеллектом в роли Dungeon Master.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setIsCreatorOpen(true)}
                className="px-8 py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-cinzel font-bold text-sm rounded-xl shadow-lg shadow-amber-600/30 transition cursor-pointer"
              >
                Создать персонажа и начать
              </button>
              <button
                onClick={() => setIsSaveLoadOpen(true)}
                className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-semibold text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>Загрузить сохранение</span>
              </button>
              <button
                onClick={() => setIsLanModalOpen(true)}
                className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
              >
                <Radio className="w-4 h-4 text-amber-400" />
                <span>Мультиплеер LAN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (In flex flow at bottom of viewport, never overlapping chat input) */}
      {isGameStarted && character && (
        <nav className="md:hidden flex-shrink-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 pb-safe pt-1 px-2 flex items-center justify-around shadow-2xl">
          <button
            onClick={() => setIsCharacterSheetOpen(false)}
            className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer active:scale-95 touch-manipulation ${
              !isCharacterSheetOpen
                ? 'text-amber-400 font-bold bg-amber-500/15 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <ScrollText className="w-4 h-4" />
              {pendingRoll && pendingRoll.needed && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse" />
              )}
            </div>
            <span className="text-[10px] font-medium">Сюжет</span>
          </button>

          <button
            onClick={() => setIsCharacterSheetOpen((prev) => !prev)}
            className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer active:scale-95 touch-manipulation ${
              isCharacterSheetOpen
                ? 'text-amber-400 font-bold bg-amber-500/15 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span className="text-[10px] font-medium">Герой</span>
          </button>

          <button
            onClick={() => setIsJournalOpen(true)}
            className="flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-purple-300 transition cursor-pointer active:scale-95 touch-manipulation"
          >
            <div className="relative">
              <Users className="w-4 h-4 text-purple-400" />
              {(partyCompanions.length > 0 || networkPlayers.length > 1) && (
                <span className="absolute -top-1 -right-1.5 px-1 py-0.2 text-[8px] bg-purple-600 text-white rounded-full font-bold shadow-sm">
                  {networkPlayers.length > 1 ? networkPlayers.length : partyCompanions.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Отряд</span>
          </button>

          <button
            onClick={() => setIsDiceRollerOpen(true)}
            className="flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer active:scale-95 touch-manipulation"
          >
            <Dices className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-medium">Дайсы</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer active:scale-95 touch-manipulation"
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span className="text-[10px] font-medium">Опции</span>
          </button>
        </nav>
      )}

      {/* Modals */}
      <LanMultiplayerModal
        isOpen={isLanModalOpen}
        onClose={() => setIsLanModalOpen(false)}
        isHost={isHost}
        isConnected={isMultiplayerConnected}
        lanIp={lanIp}
        players={networkPlayers}
        currentCharacter={character}
        ping={networkPing}
        onStartHost={handleStartHost}
        onConnectClient={handleConnectClient}
        onDisconnect={handleDisconnectMultiplayer}
        onSelectCharacter={(char) => setCharacter(char)}
        onOpenCharacterCreator={() => setIsCreatorOpen(true)}
        onStartGame={handleLobbyStartGame}
        currentDifficulty={world.difficulty || 'standard'}
        onChangeDifficulty={(diff) => {
          const next = { ...world, difficulty: diff };
          setWorld(next);
          setStoredWorldSettings(next);
        }}
      />

      <SaveLoadModal
        isOpen={isSaveLoadOpen}
        onClose={() => setIsSaveLoadOpen(false)}
        isGameStarted={isGameStarted}
        isCoopMode={isMultiplayerConnected}
        coopPlayers={networkPlayers}
        onCoopSessionLoaded={handleCoopSessionLoaded}
        currentSession={{
          id: 'session_' + (character?.name || 'hero'),
          createdAt: Date.now(),
          character: character!,
          world,
          history,
          currentLocation,
          inGameDay,
          inGameMinutes,
          partyCompanions,
          journalEntries,
          lorebookEntries,
          suggestedActions,
          pendingRoll,
          storySummary,
          lastPlayedAt: Date.now(),
        }}
        onSessionLoaded={handleSessionLoaded}
      />


      <CharacterCreatorModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onStartCampaign={handleStartCampaign}
        initialWorld={world}
      />

      <DiceRollerModal
        isOpen={isDiceRollerOpen}
        onClose={() => setIsDiceRollerOpen(false)}
        onSendToChat={(rollSummary) => handleSendAction(rollSummary)}
        onTriggerScreenRoll={(opts) => setActiveScreenRoll(opts)}
      />

      <ScreenDiceRoller
        isOpen={Boolean(activeScreenRoll)}
        options={activeScreenRoll}
        onClose={() => setActiveScreenRoll(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        modelName={modelName}
        onSaveModelName={handleSaveModelName}
        baseUrl={baseUrl}
        onSaveBaseUrl={handleSaveBaseUrl}
        customPrompt={customPrompt}
        onSaveCustomPrompt={handleSaveCustomPrompt}
        useOpenRouter={useOpenRouter}
        onSaveUseOpenRouter={handleSaveUseOpenRouter}
        geminiApiKey={geminiApiKey}
        onSaveGeminiApiKey={handleSaveGeminiApiKey}
        useGemini={useGemini}
        onSaveUseGemini={handleSaveUseGemini}
        geminiModel={geminiModel}
        onSaveGeminiModel={handleSaveGeminiModel}
        useLmStudio={useLmStudio}
        onSaveUseLmStudio={handleSaveUseLmStudio}
        lmStudioUrl={lmStudioUrl}
        onSaveLmStudioUrl={handleSaveLmStudioUrl}
        lmStudioModel={lmStudioModel}
        onSaveLmStudioModel={handleSaveLmStudioModel}
        lmStudioApiKey={lmStudioApiKey}
        onSaveLmStudioApiKey={handleSaveLmStudioApiKey}
        world={world}
        onSaveWorld={handleSaveWorld}
        soundEnabled={soundActive}
        onToggleSound={handleToggleSound}
        onExportSave={handleExportSave}
        onImportSave={handleImportSave}
        onResetGame={handleResetGame}
        gpuSaverActive={gpuSaverActive}
        onToggleGpuSaver={handleToggleGpuSaver}
      />

      <JournalModal
        isOpen={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
        entries={journalEntries}
        locationsVisited={locationsVisited}
        partyCompanions={partyCompanions}
        nearbyNpcs={nearbyNpcs}
        lorebookEntries={lorebookEntries}
        storySummary={storySummary}
        onAddEntry={(entry) =>
          setJournalEntries((prev) => [
            ...prev,
            { ...entry, id: 'entry_' + Date.now(), timestamp: Date.now() },
          ])
        }
        onDeleteEntry={(id) => setJournalEntries((prev) => prev.filter((e) => e.id !== id))}
        onAddCompanion={(comp) => setPartyCompanions((prev) => [...prev, comp])}
        onUpdateCompanion={(id, updater) =>
          setPartyCompanions((prev) => prev.map((c) => (c.id === id ? updater(c) : c)))
        }
        onDeleteCompanion={(id) => setPartyCompanions((prev) => prev.filter((c) => c.id !== id))}
        onAddLorebookEntry={(entry) =>
          setLorebookEntries((prev) => [
            ...prev,
            { ...entry, id: 'lb_' + Date.now() },
          ])
        }
        onToggleLorebookEntry={(id) =>
          setLorebookEntries((prev) =>
            prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
          )
        }
        onDeleteLorebookEntry={(id) =>
          setLorebookEntries((prev) => prev.filter((e) => e.id !== id))
        }
        onSaveStorySummary={(summary) => setStorySummary(summary)}
      />
    </div>
  );
}
