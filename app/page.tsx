'use client';

import React, { useState, useEffect } from 'react';
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
    title: 'Инвентарь и Артефакты',
    keys: ['инвентарь', 'артефакт', 'зелье', 'свиток', 'золото', 'оружие', 'доспех', 'снаряжение', 'лут'],
    content: '[ИНВЕНТАРЬ]: Игрок владеет только теми предметами, золотом и оружием, которые были найдены или получены в ходе игры. Потраченные предметы списываются.',
    enabled: true,
    constant: false,
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

  // Send player action to AI DM
  const handleSendAction = async (actionText: string) => {
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

    // Snapshot of in-game time when player takes the action
    const actionStartTime = formatInGameTime(inGameDay, inGameMinutes);

    const userMessage: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: actionText,
      timestamp: Date.now(),
      gameTime: actionStartTime,
    };

    // Filter out previous error bubble when taking new action
    const newHistory = [...history.filter((m) => !m.isError), userMessage];
    setHistory(newHistory);
    setPendingRoll(null);
    setLoading(true);

    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          world,
          character,
          history: newHistory,
          action: actionText,
          partyCompanions,
          journalEntries,
          lorebookEntries,
          storySummary,
          inGameDay,
          inGameMinutes,
          inGameTime: actionStartTime,
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

      // High-Precision Adaptive In-Game Time Calculation
      const timeResult = parseAndAdvanceTime(
        inGameDay,
        inGameMinutes,
        actionText,
        data.narrative || '',
        data.state_update?.time_passed_minutes,
        data.state_update?.new_time,
        data.state_update?.new_day
      );

      setInGameDay(timeResult.nextDay);
      setInGameMinutes(timeResult.nextMinutes);
      const updatedInGameTime = timeResult.formatted;

      const dmMessage: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: data.narrative,
        thought: data.thought,
        timestamp: Date.now(),
        gameTime: updatedInGameTime,
        stateUpdateApplied: {
          ...data.state_update,
          time_passed_minutes: timeResult.timePassedMinutes,
          new_time: timeResult.formatted,
          new_day: timeResult.nextDay,
        },
      };

      setHistory([...newHistory, dmMessage]);
      applyDmStateUpdate(data);

      if (isAutoTtsEnabled() && data.narrative) {
        playEdgeTts(dmMessage.id, data.narrative, {
          voice: getStoredTtsVoice(),
          rate: getStoredTtsSpeed(),
          volume: getStoredTtsVolume(),
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to send action to AI DM:', err);
      setLastFailedAction(actionText);
      const errorMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: `⚠️ **Ошибка отправки действия:** ${err?.message || 'Сбой сети'}.\n\nПроверьте соединение с интернетом или настройки API в меню Настройки.`,
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
        useGemini={useGemini}
        geminiModel={geminiModel}
        useLmStudio={useLmStudio}
        lmStudioModel={lmStudioModel}
      />

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
              onUpdateCharacter={(updater) => setCharacter((prev) => (prev ? updater(prev) : prev))}
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
                /* Card when DM requests an active D20 roll with DC */
                <ActionRollCard
                  rollReq={pendingRoll}
                  character={character}
                  loading={loading}
                  onPerformRoll={(rollText) => handleSendAction(rollText)}
                />
              ) : (
                /* Standard player action & AI suggested quick chips */
                <SuggestedActions
                  suggestedActions={suggestedActions}
                  loading={loading}
                  onSendAction={handleSendAction}
                />
              )}
            </div>
          </main>

          {/* Mobile Bottom Navigation Bar (Fixed for smartphones with all buttons: Story, Hero, Party, Map, Dice, New Game, Settings) */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/98 border-t border-slate-800/90 px-1.5 py-1.5 flex items-center justify-around shadow-lg">
            <button
              onClick={() => setMobileTab('story')}
              className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                mobileTab === 'story'
                  ? 'text-amber-400 font-bold bg-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <ScrollText className="w-4 h-4" />
                {pendingRoll && pendingRoll.needed && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                )}
              </div>
              <span className="text-[9px]">Сюжет</span>
            </button>

            <button
              onClick={() => setMobileTab('character')}
              className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                mobileTab === 'character'
                  ? 'text-amber-400 font-bold bg-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="text-[9px]">Герой</span>
            </button>

            <button
              onClick={() => setIsJournalOpen(true)}
              className="flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-purple-300 transition cursor-pointer"
            >
              <div className="relative">
                <Users className="w-4 h-4 text-purple-400" />
                {partyCompanions.length > 0 && (
                  <span className="absolute -top-1 -right-1.5 px-1 py-0.2 text-[8px] bg-purple-600 text-white rounded-full font-bold">
                    {partyCompanions.length}
                  </span>
                )}
              </div>
              <span className="text-[9px]">Отряд</span>
            </button>

            <button
              onClick={() => setIsDiceRollerOpen(true)}
              className="flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer"
            >
              <Dices className="w-4 h-4 text-amber-400" />
              <span className="text-[9px]">Дайсы</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-300" />
              <span className="text-[9px]">Опции</span>
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
            Выберите готового персонажа или создайте собственного героя и погрузитесь в соло-кампанию с искусственным интеллектом в роли Dungeon Master.
          </p>
          <button
            onClick={() => setIsCreatorOpen(true)}
            className="px-8 py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-cinzel font-bold text-sm rounded-xl shadow-lg shadow-amber-600/30 transition cursor-pointer"
          >
            Создать персонажа и начать
          </button>
        </div>
      )}

      {/* Modals */}
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
