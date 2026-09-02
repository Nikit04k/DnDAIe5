'use client';

import React, { useState, useEffect, useRef } from 'react';
import { lanSocket } from '@/lib/multiplayerSocket';
import {
  CharacterSheet,
  WorldSettings,
  ChatMessage,
  DmResponse,
  RollRequirement,
  AbilityScoreKey,
  SkillName,
  GameSessionState,
  PartyCompanion,
  LorebookEntry,
  NetworkPlayer,
  PlayerRoundAction,
  DiceRollResult,
} from '@/types/dnd';

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
    title: 'Строгий инвентарь и запрет читов',
    keys: ['инвентарь', 'артефакт', 'зелье', 'свиток', 'золото', 'оружие', 'доспех', 'снаряжение', 'лут', 'предмет', 'рюкзак', 'достаю', 'вынимаю', 'пью', 'надеваю', 'зажигаю'],
    content: '[СТРОГИЙ ЗАКОН ИНВЕНТАРЯ И АНТИ-ЧИТ]: Игрок и союзники могут использовать ТОЛЬКО предметы, которые прямо есть в их рюкзаке или надеты. Если игрок пытается достать или использовать предмет, которого нет в рюкзаке (зелье, веревку, свиток, факел, оружие) — Dungeon Master ОБЯЗАН отказать и описать, что герой шарит по карманам, но предмета там нет!',
    enabled: true,
    constant: true,
    category: 'item',
  },
];
import { CHARACTER_PRESETS, normalizeRationItem } from '@/lib/dndRules';
import { parseAndAdvanceTime, formatInGameClock } from '@/lib/timeUtils';
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
import { PartyRosterPanel } from '@/components/PartyRosterPanel';
import {
  Shield,
  Sparkles,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Dices,
  BookOpen,
  MapPin,
  Users,
  PlusCircle,
  Settings,
  Radio,
} from 'lucide-react';

export default function DnDApp() {
  // Game session states
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [character, setCharacter] = useState<CharacterSheet | null>(null);
  const [mobileTab, setMobileTab] = useState<'story' | 'character'>('story');
  const [world, setWorld] = useState<WorldSettings>({
    customSetting: '',
    customTone: '',
    customRules: '',
    startingScene: '',
  });
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string>('Вход в Пустоши');
  const [pendingRoll, setPendingRoll] = useState<RollRequirement | null>(null);
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

  const advanceInGameTime = (minutesToAdd: number): string => {
    let nextMinutes = inGameMinutes + minutesToAdd;
    let nextDay = inGameDay;
    if (nextMinutes >= 1440) {
      nextDay += Math.floor(nextMinutes / 1440);
      nextMinutes = nextMinutes % 1440;
    }
    setInGameDay(nextDay);
    setInGameMinutes(nextMinutes);
    return formatInGameClock(nextDay, nextMinutes);
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

  // Resizable left column width state (Desktop)
  const [sidebarWidth, setSidebarWidth] = useState<number>(360);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Modals & Panels
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isDiceRollerOpen, setIsDiceRollerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);

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
  }, []);

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

      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

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
        } else if (key === 'b' || key === 'и') {
          e.preventDefault();
          setIsSidebarOpen((prev) => !prev);
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

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        throw new Error(errorJson?.error || `Сервер API вернул статус ${res.status}`);
      }

      const data: DmResponse & { providerUsed?: string } = await res.json();
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
      };

      setHistory([...newHistory, dmMessage]);
      setRoundActions({});
      applyDmStateUpdate(data);

      const rollReq = data.requires_roll?.needed ? data.requires_roll : null;
      setPendingRoll(rollReq);
      if (data.suggested_actions) setSuggestedActions(data.suggested_actions);

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
      const singlePrompt = `[Игрок: ${a.playerClass ? `${a.playerClass} ` : ''}${a.characterName}]: ${a.actionText}`;
      await executeDmTurn(singlePrompt, undefined, undefined, true);
      return;
    }

    const actionsList = actions
      .map(
        (a, idx) =>
          `${idx + 1}. [${a.playerClass ? `${a.playerClass} ` : ''}${a.characterName}]: ${a.actionText}`
      )
      .join('\n');

    const jointActionPrompt = `[СОВМЕСТНЫЕ ДЕЙСТВИЯ ОТРЯДА В ЭТОМ РАУНДЕ (${actions.length} игроков)]:\n${actionsList}\n\nОпиши совместный результат действий всех участников отряда, реакцию мира/врагов, последствия и дальнейшее развитие событий!`;

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
          if (msg.state.history && msg.state.history.length > 0) {
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
          break;

        case 'PONG':
          setNetworkPing(lanSocket.ping);
          break;
      }
    });

    return () => unsub();
  }, []);

  // Load saved sidebar width
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('dnd5e_sidebar_width');
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 280 && parsed <= 650) {
          setSidebarWidth(parsed);
        }
      }
    } catch {}
  }, []);

  // Handle mouse resizing drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const clampedWidth = Math.max(280, Math.min(650, e.clientX));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        try {
          localStorage.setItem('dnd5e_sidebar_width', String(sidebarWidth));
        } catch {}
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, sidebarWidth]);

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
    if (update.hp_change && update.hp_change !== 0) {
      if (update.hp_change > 0) playHealSound();
      else playDamageSound();

      setCharacter((prev) => {
        if (!prev) return prev;
        const newHp = Math.max(0, Math.min(prev.maxHp, prev.currentHp + update.hp_change));
        return { ...prev, currentHp: newHp };
      });
    }

    // 2. Gold changes
    if (update.gold_change && update.gold_change !== 0) {
      if (update.gold_change > 0) playCoinSound();
      setCharacter((prev) => {
        if (!prev) return prev;
        return { ...prev, gold: Math.max(0, (prev.gold || 0) + update.gold_change) };
      });
    }

    // 3. Inventory & Equipment updates
    if (
      (update.added_items && update.added_items.length > 0) ||
      (update.removed_items && update.removed_items.length > 0)
    ) {
      setCharacter((prev) => {
        if (!prev) return prev;
        let updatedInv = [...(prev.inventory || [])];
        let updatedEquipped = [...(prev.equippedItems || [])];

        if (update.removed_items && update.removed_items.length > 0) {
          updatedInv = updatedInv.filter((item) => !update.removed_items.includes(item));
          updatedEquipped = updatedEquipped.filter((item) => !update.removed_items.includes(item));
        }
        if (update.added_items && update.added_items.length > 0) {
          for (const it of update.added_items) {
            if (!updatedInv.includes(it) && !updatedEquipped.includes(it)) {
              updatedInv.push(it);
            }
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

    // 5. Roll requirements
    if (dmData.requires_roll?.needed) {
      setPendingRoll(dmData.requires_roll);
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
          useGemini: useGemini,
          geminiApiKey: geminiApiKey && geminiApiKey.trim().length > 5 ? geminiApiKey.trim() : undefined,
          geminiModel: geminiModel,
          useLmStudio: useLmStudio,
          lmStudioUrl: lmStudioUrl || undefined,
          lmStudioModel: lmStudioModel || undefined,
          lmStudioApiKey: lmStudioApiKey || undefined,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        throw new Error(errorJson?.error || `Сервер API вернул статус ${res.status}`);
      }

      const data: DmResponse & { providerUsed?: string } = await res.json();
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

  // Quick stat roll from Character Sheet
  const handleRollStat = (statKey: AbilityScoreKey, statName: string, modifier: number) => {
    playDiceRollSound();
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;
    const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    const isCrit = d20 === 20;
    const isFumble = d20 === 1;

    if (isCrit) playCriticalHitSound();
    else if (isFumble) playCriticalFailSound();

    const text = `🎲 [Проверка характеристики: ${statName} (${statKey.toUpperCase()})]: Выпало d20 = ${d20} (${modStr}) = ИТОГО: ${total}${
      isCrit ? ' 🌟 КРИТИЧЕСКИЙ УСПЕХ!' : isFumble ? ' 💀 КРИТИЧЕСКИЙ ПРОВАЛ!' : ''
    }`;
    handleSendAction(text);
  };

  // Quick skill roll from Character Sheet
  const handleRollSkill = (skillName: SkillName, modifier: number) => {
    playDiceRollSound();
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;
    const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    const isCrit = d20 === 20;
    const isFumble = d20 === 1;

    if (isCrit) playCriticalHitSound();
    else if (isFumble) playCriticalFailSound();

    const text = `🎲 [Проверка навыка: ${skillName}]: Выпало d20 = ${d20} (${modStr}) = ИТОГО: ${total}${
      isCrit ? ' 🌟 КРИТИЧЕСКИЙ УСПЕХ!' : isFumble ? ' 💀 КРИТИЧЕСКИЙ ПРОВАЛ!' : ''
    }`;
    handleSendAction(text);
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

  // Item consumption callback from character sheet (potions, scrolls, torches)
  const handleItemUsed = (itemName: string, narrativeAction: string) => {
    handleSendAction(`Я применяю: ${itemName}. Опиши эффект и результат этого действия.`);
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top App Header */}
      <Header
        character={character}
        currentLocation={currentLocation}
        soundEnabled={soundActive}
        onToggleSound={handleToggleSound}
        onOpenDiceRoller={() => setIsDiceRollerOpen(true)}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
      )}

      {/* Main Gameplay Screen */}
      {isGameStarted && character ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative pb-16 md:pb-0 h-[calc(100vh-61px)]">
          {/* Left Column: Character Sheet (Resizable on Desktop, Fullscreen on Mobile) */}
          <aside
            style={{
              width: mobileTab === 'character' ? '100%' : `${sidebarWidth}px`,
              minWidth: mobileTab === 'character' ? '100%' : '280px',
              maxWidth: mobileTab === 'character' ? '100%' : '650px',
            }}
            className={`${
              mobileTab === 'character' ? 'flex flex-1 w-full' : 'hidden md:flex'
            } flex-shrink-0 z-10 h-full min-h-0 overflow-y-auto border-r border-slate-800/80 bg-slate-950 shadow-2xl md:shadow-none relative`}
          >
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
            />
          </aside>

          {/* Resizer Divider Handle (Desktop only) */}
          <div
            onMouseDown={() => setIsResizing(true)}
            className="hidden md:flex w-2.5 -ml-1 cursor-col-resize z-20 items-center justify-center bg-transparent hover:bg-amber-500/30 active:bg-amber-500/60 transition-colors group select-none relative"
            title="Потяните, чтобы изменить ширину колонки персонажа"
          >
            <div
              className={`w-1 rounded-full transition-all duration-150 ${
                isResizing
                  ? 'bg-amber-400 h-16 shadow-lg shadow-amber-400/50'
                  : 'bg-slate-700/80 group-hover:bg-amber-400 group-hover:h-12'
              }`}
            />
          </div>

          {/* Right Column: Narrative Feed & Action Area (Desktop or Mobile Active Tab - INDEPENDENT SCROLL) */}
          <main
            className={`${
              mobileTab === 'story' ? 'flex flex-1' : 'hidden md:flex'
            } flex-col justify-between overflow-hidden bg-slate-950 relative w-full h-full min-h-0`}
          >
            {/* Chat Feed (Only this scrollable area scrolls with story text!) */}
            <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
              <ChatFeed
                history={history}
                loading={loading}
                playerName={character.name}
                onRetryAction={handleRetryAction}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </div>

            {/* Bottom Action Section (Pinned to bottom) */}
            <div className="flex-shrink-0 p-3 sm:p-5 border-t border-slate-800/80 bg-slate-950/98 z-10 shadow-lg">
              {pendingRoll && pendingRoll.needed ? (
                (() => {
                  const isLocalTarget =
                    !pendingRoll.target_character_name ||
                    (character &&
                      (pendingRoll.target_character_name.toLowerCase().trim() === character.name.toLowerCase().trim() ||
                        pendingRoll.target_character_id === localPlayerId));

                  if (isLocalTarget) {
                    return (
                      <ActionRollCard
                        rollReq={pendingRoll}
                        character={character}
                        loading={loading}
                        onPerformRoll={handleRollSubmit}
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
                            const d20 = Math.floor(Math.random() * 20) + 1;
                            const total = d20 + 2;
                            handleRollSubmit(
                              `🎲 [Хост бросил за ${pendingRoll.target_character_name}]: d20 (${d20}) + 2 = **${total}**${pendingRoll.dc ? ` (против DC ${pendingRoll.dc})` : ''}`,
                              {
                                d20,
                                modifier: 2,
                                total,
                                isCrit: d20 === 20,
                                isFumble: d20 === 1,
                                passed: pendingRoll.dc ? total >= pendingRoll.dc : true,
                                characterName: pendingRoll.target_character_name,
                              }
                            );
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

          {/* Mobile Bottom Navigation Bar (Fixed for smartphones with safe-area padding) */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 pb-safe pt-1.5 px-2 flex items-center justify-around shadow-2xl">
            <button
              onClick={() => setMobileTab('story')}
              className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer active:scale-95 touch-manipulation ${
                mobileTab === 'story'
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
              onClick={() => setMobileTab('character')}
              className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer active:scale-95 touch-manipulation ${
                mobileTab === 'character'
                  ? 'text-amber-400 font-bold bg-amber-500/15 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="text-[10px] font-medium">Герой</span>
            </button>

            <button
              onClick={() => setIsJournalOpen(true)}
              className="flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-purple-300 transition cursor-pointer active:scale-95 touch-manipulation"
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
              className="flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer active:scale-95 touch-manipulation"
            >
              <Dices className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-medium">Дайсы</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer active:scale-95 touch-manipulation"
            >
              <Settings className="w-4 h-4 text-slate-300" />
              <span className="text-[10px] font-medium">Опции</span>
            </button>
          </nav>
        </div>
      ) : (
        /* Empty / Welcome State if modal closed before starting */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
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
              onClick={() => setIsLanModalOpen(true)}
              className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
            >
              <Radio className="w-4 h-4 text-amber-400" />
              <span>Мультиплеер LAN</span>
            </button>
          </div>
        </div>
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
      />

      <CharacterCreatorModal
        isOpen={isCreatorOpen}
        onStartCampaign={handleStartCampaign}
      />

      <DiceRollerModal
        isOpen={isDiceRollerOpen}
        onClose={() => setIsDiceRollerOpen(false)}
        onSendToChat={(rollSummary) => handleSendAction(rollSummary)}
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
        onSaveWorld={setWorld}
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
