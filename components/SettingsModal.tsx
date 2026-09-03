'use client';

import React, { useState, useEffect } from 'react';
import { WorldSettings, GameDifficulty } from '@/types/dnd';
import { DIFFICULTY_PROFILES, DIFFICULTY_ORDER } from '@/lib/difficultySettings';
import {
  X,
  Key,
  Cpu,
  Volume2,
  Volume1,
  VolumeX,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  CheckCircle2,
  Loader2,
  Play,
  PlusCircle,
  Zap,
  AlertTriangle,
  MessageSquare,
  Send,
  Sliders,
  Server,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import {
  getStoredTtsVoice,
  setStoredTtsVoice,
  isAutoTtsEnabled,
  setAutoTtsEnabled,
  getStoredTtsSpeed,
  setStoredTtsSpeed,
  getStoredTtsVolume,
  setStoredTtsVolume,
  getStoredTtsProvider,
  setStoredTtsProvider,
  getStoredTtsBrowserVoice,
  setStoredTtsBrowserVoice,
  TtsProvider,
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  isGeminiApiActive,
  setGeminiApiActive,
  getStoredGeminiModel,
  setStoredGeminiModel,
  getGeminiUsageStats,
  recordGeminiUsage,
  resetGeminiUsageStats,
  GeminiUsageStats,
  getStoredUseLmStudio,
  setStoredUseLmStudio,
  getStoredLmStudioUrl,
  setStoredLmStudioUrl,
  getStoredLmStudioModel,
  setStoredLmStudioModel,
  getStoredLmStudioApiKey,
  setStoredLmStudioApiKey,
  getStoredUseOpenRouter,
  setStoredUseOpenRouter,
} from '@/lib/storage';
import { playEdgeTts, stopTtsAudio, testVoiceSynthesis, playSpeechSynthesisFallback } from '@/lib/edgeTts';
import {
  testDirectAiConnection,
  testDirectGeminiConnection,
  testDirectLmStudioConnection,
  isStandaloneMobile,
} from '@/lib/directAiClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  modelName: string;
  onSaveModelName: (model: string) => void;
  baseUrl?: string;
  onSaveBaseUrl?: (url: string) => void;
  customPrompt?: string;
  onSaveCustomPrompt?: (prompt: string) => void;
  useOpenRouter?: boolean;
  onSaveUseOpenRouter?: (active: boolean) => void;
  geminiApiKey?: string;
  onSaveGeminiApiKey?: (key: string) => void;
  useGemini?: boolean;
  onSaveUseGemini?: (active: boolean) => void;
  geminiModel?: string;
  onSaveGeminiModel?: (model: string) => void;
  useLmStudio?: boolean;
  onSaveUseLmStudio?: (active: boolean) => void;
  lmStudioUrl?: string;
  onSaveLmStudioUrl?: (url: string) => void;
  lmStudioModel?: string;
  onSaveLmStudioModel?: (model: string) => void;
  lmStudioApiKey?: string;
  onSaveLmStudioApiKey?: (key: string) => void;
  world: WorldSettings;
  onSaveWorld: (world: WorldSettings) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onExportSave: () => void;
  onImportSave: (file: File) => void;
  onResetGame: () => void;
  gpuSaverActive?: boolean;
  onToggleGpuSaver?: (active: boolean) => void;
}

export interface GeminiModelPreset {
  id: string;
  name: string;
  desc: string;
  limitDesc: string;
  isFree: boolean;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelPreset[] = [
  {
    id: 'gemini-3.7-flash',
    name: '⚡ Gemini 3.7 Flash (Рекомендуемая)',
    desc: 'Новейшая флагманская модель Google с глубоким пониманием правил D&D 5e и высочайшей скоростью.',
    limitDesc: '1 500 запросов/день • 15 запр/мин (Free Tier)',
    isFree: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: '⚡ Gemini 3.6 Flash',
    desc: 'Быстрая интеллектуальная модель Gemini 3.6 Flash для динамичного боя и диалогов.',
    limitDesc: '1 500 запросов/день • 15 запр/мин (Free Tier)',
    isFree: true,
  },
  {
    id: 'gemini-3.5-flash',
    name: '⚡ Gemini 3.5 Flash',
    desc: 'Сверхбыстрая оптимизированная модель серии 3.5 с моментальным откликом.',
    limitDesc: '1 500 запросов/день • 15 запр/мин (Free Tier)',
    isFree: true,
  },
];

export interface AiModelPreset {
  id: string;
  name: string;
  provider: string;
  desc: string;
  isFree?: boolean;
  defaultBaseUrl?: string;
}

export const AVAILABLE_AI_MODELS: AiModelPreset[] = [
  // Verified working Free models on OpenRouter
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'NVIDIA: Nemotron 3 Super (free)',
    provider: 'NVIDIA',
    desc: '262144 ctx | Free | Высокая точность рассуждений и отыгрыша D&D',
    isFree: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'NVIDIA: Nemotron 3.5 Lightning (free)',
    provider: 'NVIDIA',
    desc: '1000000 ctx | Free | Сверхбыстрая генерация с 1M окном контекста',
    isFree: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'poolside/laguna-s-2.1:free',
    name: 'Poolside: Laguna S 2.1 (free)',
    provider: 'Poolside',
    desc: '262144 ctx | Free | Сбалансированный нарративный движок',
    isFree: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'poolside/laguna-xs-2.1:free',
    name: 'Poolside: Laguna XS 2.1 (free)',
    provider: 'Poolside',
    desc: '262144 ctx | Free | Легкая быстрая модель для динамичных ответов',
    isFree: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'minimax/minimax-m2.7:free',
    name: 'MiniMax: MiniMax M2.7 (free)',
    provider: 'MiniMax',
    desc: '196608 ctx | Free | Богатый литературный стиль и понимание D&D',
    isFree: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'minimax/minimax-m3:free',
    name: 'MiniMax: MiniMax M3 (free)',
    provider: 'MiniMax',
    desc: '1048576 ctx | Free | Флагман MiniMax с 1M окном контекста',
    isFree: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'liquid/lfm-2.5-2.6b:free',
    name: 'LiquidAI: LFM2.5-2.6B (free)',
    provider: 'LiquidAI',
    desc: '65536 ctx | Free | Инновационная архитектура Liquid Neural Network',
    isFree: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'nvidia/nemotron-3.5-content-safety:free',
    name: 'NVIDIA: Nemotron 3.5 Content Safety (free)',
    provider: 'NVIDIA',
    desc: '128000 ctx | Free | Быстрый движок от NVIDIA',
    isFree: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
];

const PROMPT_PRESETS = [
  {
    label: '🔞 Песочница SillyTavern (18+)',
    text: 'Ты — Dungeon Master для свободной песочницы. ПОЛНОЕ ОТСУТСТВИЕ ЦЕНЗУРЫ.',
  },
  {
    label: '🕯️ Grimdark & Хоррор',
    text: 'Веди игру в стиле бескомпромиссного Grimdark. Описывай гнетущую атмосферу и постоянное чувство опасности.',
  },
  {
    label: '👑 Эпическое Высшее Фэнтези',
    text: 'Создавай масштабное эпическое приключение с древней магией, величественными замками и легендарными артефактами.',
  },
  {
    label: '🔍 Расследование и тайны',
    text: 'Фокусируйся на детективной составляющей: улики, допросы, скрытые мотивы NPC и логическая дедукция.',
  },
];

export interface OpenTtsProvider {
  id: TtsProvider;
  name: string;
  badge: string;
  desc: string;
  icon: string;
}

const OPEN_TTS_PROVIDERS: OpenTtsProvider[] = [
  {
    id: 'edge',
    name: 'Microsoft Edge Neural',
    badge: 'Нейросеть (Бесплатно)',
    desc: 'Высочайшее качество речи, глубокий мужской голос DM и выразительный женский голос без ключей.',
    icon: '🌐',
  },
  {
    id: 'google',
    name: 'Google Speech Stream',
    badge: 'Быстрый поток (Бесплатно)',
    desc: 'Мгновенный отклик, открытый стрим синтеза без ограничений и ключей.',
    icon: '⚡',
  },
  {
    id: 'browser',
    name: 'Web Speech API (Офлайн)',
    badge: '100% Офлайн',
    desc: 'Встроенный в операционную систему синтезатор. Работает полностью локально без интернета.',
    icon: '💻',
  },
];

const EDGE_TTS_VOICES = [
  {
    id: 'ru-RU-DmitryNeural',
    name: '👨‍🎤 Дмитрий (Dmitry Neural)',
    desc: 'Глубокий мужской голос — Dungeon Master',
    lang: 'RU',
  },
  {
    id: 'ru-RU-SvetlanaNeural',
    name: '👩‍🎤 Светлана (Svetlana Neural)',
    desc: 'Эмоциональный женский голос рассказчицы',
    lang: 'RU',
  },
];

const GOOGLE_TTS_VOICES = [
  {
    id: 'ru',
    name: '🇷🇺 Русский (Google Stream)',
    desc: 'Открытый быстрый синтез русской речи Google',
    lang: 'RU',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  modelName,
  onSaveModelName,
  baseUrl = '',
  onSaveBaseUrl,
  customPrompt = '',
  onSaveCustomPrompt,
  useOpenRouter = true,
  onSaveUseOpenRouter,
  geminiApiKey = '',
  onSaveGeminiApiKey,
  useGemini = false,
  onSaveUseGemini,
  geminiModel = 'gemini-3.7-flash',
  onSaveGeminiModel,
  useLmStudio = false,
  onSaveUseLmStudio,
  lmStudioUrl = 'http://localhost:1234/v1',
  onSaveLmStudioUrl,
  lmStudioModel = '',
  onSaveLmStudioModel,
  lmStudioApiKey = 'lm-studio',
  onSaveLmStudioApiKey,
  world,
  onSaveWorld,
  soundEnabled,
  onToggleSound,
  onExportSave,
  onImportSave,
  onResetGame,
  gpuSaverActive = true,
  onToggleGpuSaver,
}) => {
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(modelName);
  const [tempBaseUrl, setTempBaseUrl] = useState(baseUrl);
  const [tempCustomPrompt, setTempCustomPrompt] = useState(customPrompt);
  const [tempUseOpenRouter, setTempUseOpenRouter] = useState(useOpenRouter !== undefined ? useOpenRouter : getStoredUseOpenRouter());

  // LM Studio (Local AI) state
  const [tempUseLmStudio, setTempUseLmStudio] = useState(useLmStudio !== undefined ? useLmStudio : getStoredUseLmStudio());
  const [tempLmStudioUrl, setTempLmStudioUrl] = useState(lmStudioUrl || getStoredLmStudioUrl());
  const [tempLmStudioModel, setTempLmStudioModel] = useState(lmStudioModel || getStoredLmStudioModel());
  const [tempLmStudioApiKey] = useState(lmStudioApiKey || getStoredLmStudioApiKey());
  const [isTestingLmStudio, setIsTestingLmStudio] = useState(false);
  const [isFetchingLmModels, setIsFetchingLmModels] = useState(false);
  const [lmStudioAvailableModels, setLmStudioAvailableModels] = useState<string[]>([]);
  const [lmStudioTestResult, setLmStudioTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    response?: string;
    error?: string;
    modelUsed?: string;
    availableModels?: string[];
  } | null>(null);

  // Gemini state
  const [tempGeminiApiKey, setTempGeminiApiKey] = useState(geminiApiKey || getStoredGeminiApiKey());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [tempUseGemini, setTempUseGemini] = useState(useGemini !== undefined ? useGemini : isGeminiApiActive());
  const validGeminiModels = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
  const rawGeminiModel = geminiModel || getStoredGeminiModel();
  const [selectedGeminiModel, setSelectedGeminiModel] = useState(
    validGeminiModels.includes(rawGeminiModel) ? rawGeminiModel : 'gemini-3.7-flash'
  );
  const [geminiStats, setGeminiStats] = useState<GeminiUsageStats>(getGeminiUsageStats());
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    response?: string;
    error?: string;
    modelUsed?: string;
  } | null>(null);

  const [tempSetting, setTempSetting] = useState(world.customSetting || '');
  const [tempTone, setTempTone] = useState(world.customTone || '');
  const [tempRules, setTempRules] = useState(world.customRules || '');
  const [tempDifficulty, setTempDifficulty] = useState<GameDifficulty>(world.difficulty || 'standard');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Synchronize with latest world and Gemini settings whenever modal opens or world changes
  useEffect(() => {
    if (isOpen) {
      setTempSetting(world.customSetting || '');
      setTempTone(world.customTone || '');
      setTempRules(world.customRules || '');
      setTempDifficulty(world.difficulty || 'standard');
      const currentModel = geminiModel || getStoredGeminiModel();
      if (!validGeminiModels.includes(currentModel)) {
        setSelectedGeminiModel('gemini-3.7-flash');
      } else {
        setSelectedGeminiModel(currentModel);
      }
    }
  }, [isOpen, world, geminiModel]);

  const [tempTtsProvider, setTempTtsProvider] = useState<TtsProvider>(getStoredTtsProvider());
  const [tempTtsBrowserVoice, setTempTtsBrowserVoice] = useState(getStoredTtsBrowserVoice());
  const [browserVoicesList, setBrowserVoicesList] = useState<SpeechSynthesisVoice[]>([]);
  const [tempVoice, setTempVoice] = useState(() => {
    const v = getStoredTtsVoice();
    return v.startsWith('en') ? 'ru-RU-DmitryNeural' : v;
  });
  const [tempAutoTts, setTempAutoTts] = useState(isAutoTtsEnabled());
  const [tempTtsSpeed, setTempTtsSpeed] = useState(getStoredTtsSpeed());
  const [tempTtsVolume, setTempTtsVolume] = useState(getStoredTtsVolume());
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // TTS Diagnostic Connection Test State
  const [isTestingTtsConnection, setIsTestingTtsConnection] = useState(false);
  const [ttsTestResult, setTtsTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    engineUsed?: string;
    audioBase64?: string;
    error?: string;
    sampleText: string;
    audioSizeBytes?: number;
  } | null>(null);
  const [customTtsTestPrompt, setCustomTtsTestPrompt] = useState('Связь с голосовым синтезом успешно установлена! Готов к озвучке приключений.');
  const [showTtsPromptInput, setShowTtsPromptInput] = useState(false);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false);

  // Load OS installed Russian browser voices for offline TTS
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const ruVoices = voices.filter(
          (v) =>
            v.lang.toLowerCase().startsWith('ru') ||
            v.lang.toLowerCase().includes('rus') ||
            v.name.toLowerCase().includes('russian') ||
            v.name.toLowerCase().includes('русский')
        );
        setBrowserVoicesList(ruVoices);
        if (ruVoices.length > 0) {
          const currentMatches = ruVoices.some((v) => (v.name || v.voiceURI) === tempTtsBrowserVoice);
          if (!currentMatches) {
            setTempTtsBrowserVoice(ruVoices[0].name || ruVoices[0].voiceURI);
          }
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [tempTtsBrowserVoice]);

  // AI Connection Test state
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    response?: string;
    error?: string;
    modelUsed?: string;
  } | null>(null);
  const [customTestPrompt, setCustomTestPrompt] = useState('Ответь кратко на русском: Связь с Мастером Подземелий установлена!');
  const [showTestPromptInput, setShowTestPromptInput] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClearWorldSettings = () => {
    setTempSetting('');
    setTempTone('');
    setTempRules('');
    setTempCustomPrompt('');
    setTempDifficulty('standard');
  };

  const handleSelectModel = (preset: AiModelPreset) => {
    setSelectedModel(preset.id);
    if (preset.defaultBaseUrl && (!tempBaseUrl || tempBaseUrl.includes('openrouter.ai') || tempBaseUrl.includes('localhost'))) {
      setTempBaseUrl(preset.defaultBaseUrl);
    }
  };

  const handleTestTtsVoice = async () => {
    setIsTestingVoice(true);
    const sampleText = customTtsTestPrompt || (
      tempVoice.includes('Dmitry')
        ? 'Приветствую тебя, путник! Я твой Dungeon Master.'
        : tempVoice.includes('Svetlana')
        ? 'Приветствую в мире приключений!'
        : 'Приветствую в мире настольных ролевых приключений D&D 5e!'
    );

    try {
      await playEdgeTts('test_tts_preview', sampleText, {
        provider: tempTtsProvider,
        voice: tempVoice,
        rate: tempTtsSpeed,
        volume: tempTtsVolume,
        browserVoice: tempTtsBrowserVoice,
        onEnd: () => setIsTestingVoice(false),
        onError: () => setIsTestingVoice(false),
      });
    } catch (e) {
      setIsTestingVoice(false);
    }
  };

  const handleTestTtsConnection = async () => {
    setIsTestingTtsConnection(true);
    setTtsTestResult(null);
    try {
      const res = await testVoiceSynthesis({
        provider: tempTtsProvider,
        voice: tempVoice,
        rate: tempTtsSpeed,
        browserVoice: tempTtsBrowserVoice,
        testText: customTtsTestPrompt,
      });
      setTtsTestResult(res);

      // Play synthesized audio right away for instant feedback
      if (res.audioBase64) {
        setIsPlayingTestAudio(true);
        const audio = new Audio(res.audioBase64);
        audio.volume = tempTtsVolume;
        audio.onended = () => setIsPlayingTestAudio(false);
        audio.onerror = () => setIsPlayingTestAudio(false);
        audio.play().catch(() => setIsPlayingTestAudio(false));
      } else if (tempTtsProvider === 'browser' && res.success) {
        setIsPlayingTestAudio(true);
        playSpeechSynthesisFallback('test_tts_check', res.sampleText, {
          rate: tempTtsSpeed,
          volume: tempTtsVolume,
          browserVoice: tempTtsBrowserVoice,
          onEnd: () => setIsPlayingTestAudio(false),
          onError: () => setIsPlayingTestAudio(false),
        });
      }
    } catch (err: any) {
      setTtsTestResult({
        success: false,
        latencyMs: 0,
        error: `Ошибка клиента: ${err?.message || 'Сбой при проверке голосового синтеза'}`,
        sampleText: customTtsTestPrompt,
      });
    } finally {
      setIsTestingTtsConnection(false);
    }
  };

  const handlePlaySavedTestAudio = () => {
    if (!ttsTestResult) return;
    if (ttsTestResult.audioBase64) {
      setIsPlayingTestAudio(true);
      const audio = new Audio(ttsTestResult.audioBase64);
      audio.volume = tempTtsVolume;
      audio.onended = () => setIsPlayingTestAudio(false);
      audio.onerror = () => setIsPlayingTestAudio(false);
      audio.play().catch(() => setIsPlayingTestAudio(false));
    } else if (tempTtsProvider === 'browser') {
      setIsPlayingTestAudio(true);
      playSpeechSynthesisFallback('test_tts_check', ttsTestResult.sampleText, {
        rate: tempTtsSpeed,
        volume: tempTtsVolume,
        browserVoice: tempTtsBrowserVoice,
        onEnd: () => setIsPlayingTestAudio(false),
        onError: () => setIsPlayingTestAudio(false),
      });
    }
  };

  const handleTestLmStudioConnection = async () => {
    setIsTestingLmStudio(true);
    setLmStudioTestResult(null);
    try {
      if (isStandaloneMobile()) {
        const directRes = await testDirectLmStudioConnection({
          url: tempLmStudioUrl,
          model: tempLmStudioModel,
          apiKey: tempLmStudioApiKey,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с локальной нейросетью через LM Studio успешно установлена!',
        });
        setLmStudioTestResult(directRes);
        if (Array.isArray(directRes.availableModels) && directRes.availableModels.length > 0) {
          setLmStudioAvailableModels(directRes.availableModels);
          if (!tempLmStudioModel && directRes.modelUsed) {
            setTempLmStudioModel(directRes.modelUsed);
          }
        }
        return;
      }

      const res = await fetch('/api/test-lmstudio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: tempLmStudioUrl,
          model: tempLmStudioModel,
          apiKey: tempLmStudioApiKey,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с локальной нейросетью через LM Studio успешно установлена!',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const directRes = await testDirectLmStudioConnection({
          url: tempLmStudioUrl,
          model: tempLmStudioModel,
          apiKey: tempLmStudioApiKey,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с локальной нейросетью через LM Studio успешно установлена!',
        });
        setLmStudioTestResult(directRes);
        if (Array.isArray(directRes.availableModels) && directRes.availableModels.length > 0) {
          setLmStudioAvailableModels(directRes.availableModels);
          if (!tempLmStudioModel && directRes.modelUsed) {
            setTempLmStudioModel(directRes.modelUsed);
          }
        }
        return;
      }

      const data = await res.json();
      setLmStudioTestResult(data);
      if (Array.isArray(data.availableModels) && data.availableModels.length > 0) {
        setLmStudioAvailableModels(data.availableModels);
        if (!tempLmStudioModel && data.modelUsed) {
          setTempLmStudioModel(data.modelUsed);
        }
      }
    } catch (err: any) {
      try {
        const directRes = await testDirectLmStudioConnection({
          url: tempLmStudioUrl,
          model: tempLmStudioModel,
          apiKey: tempLmStudioApiKey,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с локальной нейросетью через LM Studio успешно установлена!',
        });
        setLmStudioTestResult(directRes);
        if (Array.isArray(directRes.availableModels) && directRes.availableModels.length > 0) {
          setLmStudioAvailableModels(directRes.availableModels);
          if (!tempLmStudioModel && directRes.modelUsed) {
            setTempLmStudioModel(directRes.modelUsed);
          }
        }
      } catch (fallbackErr: any) {
        setLmStudioTestResult({
          success: false,
          latencyMs: 0,
          error: `Ошибка клиента: ${fallbackErr?.message || err?.message || 'Сбой сети при подключении к LM Studio'}`,
        });
      }
    } finally {
      setIsTestingLmStudio(false);
    }
  };

  const handleFetchLmModels = async () => {
    setIsFetchingLmModels(true);
    try {
      if (isStandaloneMobile()) {
        const lmBase = (tempLmStudioUrl || 'http://localhost:1234').replace(/\/+$/, '');
        const headers: Record<string, string> = {};
        if (tempLmStudioApiKey) headers['Authorization'] = `Bearer ${tempLmStudioApiKey}`;
        const mRes = await fetch(`${lmBase}/v1/models`, { headers });
        if (mRes.ok) {
          const mData = await mRes.json();
          if (Array.isArray(mData?.data)) {
            const list = mData.data.map((m: any) => m.id).filter(Boolean);
            if (list.length > 0) {
              setLmStudioAvailableModels(list);
              if (list[0]) setTempLmStudioModel(list[0]);
            }
          }
        }
        return;
      }

      const res = await fetch('/api/test-lmstudio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: tempLmStudioUrl,
          model: tempLmStudioModel,
          apiKey: tempLmStudioApiKey,
          testPrompt: 'тест',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const lmBase = (tempLmStudioUrl || 'http://localhost:1234').replace(/\/+$/, '');
        const headers: Record<string, string> = {};
        if (tempLmStudioApiKey) headers['Authorization'] = `Bearer ${tempLmStudioApiKey}`;
        const mRes = await fetch(`${lmBase}/v1/models`, { headers });
        if (mRes.ok) {
          const mData = await mRes.json();
          if (Array.isArray(mData?.data)) {
            const list = mData.data.map((m: any) => m.id).filter(Boolean);
            if (list.length > 0) {
              setLmStudioAvailableModels(list);
              if (list[0]) setTempLmStudioModel(list[0]);
            }
          }
        }
        return;
      }

      const data = await res.json();
      if (Array.isArray(data.availableModels) && data.availableModels.length > 0) {
        setLmStudioAvailableModels(data.availableModels);
        if (data.availableModels[0]) {
          setTempLmStudioModel(data.availableModels[0]);
        }
      }
    } catch (e) {
    } finally {
      setIsFetchingLmModels(false);
    }
  };


  const handleTestGeminiConnection = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);
    try {
      if (isStandaloneMobile()) {
        const directRes = await testDirectGeminiConnection({
          apiKey: tempGeminiApiKey,
          model: selectedGeminiModel,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с Google Gemini установлена!',
        });
        setGeminiTestResult(directRes);
        if (directRes.success) {
          const updated = recordGeminiUsage();
          setGeminiStats(updated);
        }
        return;
      }

      const res = await fetch('/api/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: tempGeminiApiKey,
          model: selectedGeminiModel,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с Google Gemini установлена!',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const directRes = await testDirectGeminiConnection({
          apiKey: tempGeminiApiKey,
          model: selectedGeminiModel,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с Google Gemini установлена!',
        });
        setGeminiTestResult(directRes);
        if (directRes.success) {
          const updated = recordGeminiUsage();
          setGeminiStats(updated);
        }
        return;
      }

      const data = await res.json();
      setGeminiTestResult(data);
      if (data.success) {
        const updated = recordGeminiUsage();
        setGeminiStats(updated);
      }
    } catch (err: any) {
      try {
        const directRes = await testDirectGeminiConnection({
          apiKey: tempGeminiApiKey,
          model: selectedGeminiModel,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с Google Gemini установлена!',
        });
        setGeminiTestResult(directRes);
        if (directRes.success) {
          const updated = recordGeminiUsage();
          setGeminiStats(updated);
        }
      } catch (fallbackErr: any) {
        setGeminiTestResult({
          success: false,
          latencyMs: 0,
          error: `Ошибка клиента: ${fallbackErr?.message || err?.message || 'Сбой сети при подключении к Gemini'}`,
        });
      }
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      if (isStandaloneMobile()) {
        const directRes = await testDirectAiConnection({
          apiKey: tempApiKey,
          model: selectedModel,
          baseUrl: tempBaseUrl,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с Мастером Подземелий установлена!',
        });
        setAiTestResult(directRes);
        return;
      }

      const res = await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: tempApiKey,
          model: selectedModel,
          baseUrl: tempBaseUrl,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с Мастером Подземелий установлена!',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const directRes = await testDirectAiConnection({
          apiKey: tempApiKey,
          model: selectedModel,
          baseUrl: tempBaseUrl,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с Мастером Подземелий установлена!',
        });
        setAiTestResult(directRes);
        return;
      }

      const data = await res.json();
      setAiTestResult(data);
    } catch (err: any) {
      try {
        const directRes = await testDirectAiConnection({
          apiKey: tempApiKey,
          model: selectedModel,
          baseUrl: tempBaseUrl,
          testPrompt: customTestPrompt || 'Ответь кратко на русском: Связь с Мастером Подземелий установлена!',
        });
        setAiTestResult(directRes);
      } catch (fallbackErr: any) {
        setAiTestResult({
          success: false,
          latencyMs: 0,
          error: `Ошибка клиента: ${fallbackErr?.message || err?.message || 'Сбой сети при отправке запроса'}`,
        });
      }
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSave = () => {
    onSaveApiKey(tempApiKey);
    onSaveModelName(selectedModel);
    if (onSaveBaseUrl) onSaveBaseUrl(tempBaseUrl);
    if (onSaveCustomPrompt) onSaveCustomPrompt(tempCustomPrompt);

    // Save OpenRouter active state
    setStoredUseOpenRouter(tempUseOpenRouter);
    if (onSaveUseOpenRouter) onSaveUseOpenRouter(tempUseOpenRouter);

    // Save LM Studio settings
    setStoredUseLmStudio(tempUseLmStudio);
    setStoredLmStudioUrl(tempLmStudioUrl);
    setStoredLmStudioModel(tempLmStudioModel);
    setStoredLmStudioApiKey(tempLmStudioApiKey);
    if (onSaveUseLmStudio) onSaveUseLmStudio(tempUseLmStudio);
    if (onSaveLmStudioUrl) onSaveLmStudioUrl(tempLmStudioUrl);
    if (onSaveLmStudioModel) onSaveLmStudioModel(tempLmStudioModel);
    if (onSaveLmStudioApiKey) onSaveLmStudioApiKey(tempLmStudioApiKey);

    // Save Gemini settings
    setStoredGeminiApiKey(tempGeminiApiKey);
    setGeminiApiActive(tempUseGemini);
    setStoredGeminiModel(selectedGeminiModel);
    if (onSaveGeminiApiKey) onSaveGeminiApiKey(tempGeminiApiKey);
    if (onSaveUseGemini) onSaveUseGemini(tempUseGemini);
    if (onSaveGeminiModel) onSaveGeminiModel(selectedGeminiModel);

    onSaveWorld({
      ...world,
      customSetting: tempSetting,
      customTone: tempTone,
      customRules: tempRules,
    });

    setStoredTtsProvider(tempTtsProvider);
    setStoredTtsBrowserVoice(tempTtsBrowserVoice);
    setStoredTtsVoice(tempVoice);
    setAutoTtsEnabled(tempAutoTts);
    setStoredTtsSpeed(tempTtsSpeed);
    setStoredTtsVolume(tempTtsVolume);

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const isMobileClient = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
      onClick={() => { stopTtsAudio(); onClose(); }}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-cinzel font-bold text-base text-amber-200">Настройки DnDAIe5 & Озвучки</h3>
          </div>
          <button
            onClick={() => { stopTtsAudio(); onClose(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="bg-gradient-to-r from-cyan-950/50 to-blue-950/40 border border-cyan-500/30 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Бесплатные модели и подключение:</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              1. Ключ OpenRouter: создайте на <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold hover:text-cyan-300 inline-flex items-center gap-0.5">openrouter.ai <ExternalLink className="w-2.5 h-2.5" /></a> (модели с меткой <code>:free</code> бесплатны).
              <br />
              2. <strong>Озвучка речи</strong> работает прямо из коробки без API-ключей и оплаты!
            </p>
          </div>

          <div className="bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/50 border border-purple-500/50 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-slate-950 font-bold text-xs shadow-md shadow-purple-500/30">
                  <Volume2 className="w-4 h-4 text-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                      Озвучка речи (Голосовой синтез)
                    </h4>
                    <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Бесплатно
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Открытые синтезаторы речи без API-ключей, авторизации и оплаты</p>
                </div>
              </div>
              <span className="text-[10px] text-purple-400/80 font-mono hidden sm:inline">
                {tempTtsProvider === 'browser' ? 'Офлайн' : 'Онлайн'}
              </span>
            </div>

            {/* Provider Selection (4 Open Synthesizers) */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" /> Выбор открытого движка синтеза
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {OPEN_TTS_PROVIDERS.map((p) => {
                  const isSelected = tempTtsProvider === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setTempTtsProvider(p.id);
                        if (p.id === 'google') setTempVoice('ru');
                        else if (p.id === 'edge' && tempVoice === 'ru') setTempVoice('ru-RU-DmitryNeural');
                      }}
                      className={`p-2.5 sm:p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-950/70 border-purple-500 text-purple-200 ring-1 ring-purple-500/60 shadow-md shadow-purple-950/50'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{p.icon}</span>
                          <span className="font-bold text-xs text-slate-100">{p.name}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          isSelected
                            ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{p.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voice Options per Provider */}
            {tempTtsProvider === 'edge' && (
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="text-[11px] text-slate-300 font-bold block">
                  Голос нейросети Edge Neural:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EDGE_TTS_VOICES.map((v) => {
                    const isSelected = tempVoice === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setTempVoice(v.id)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-purple-950/60 border-purple-500 text-purple-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-xs text-slate-100">{v.name}</span>
                          <span className="text-[9px] font-mono text-slate-500">{v.lang}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{v.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tempTtsProvider === 'google' && (
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="text-[11px] text-slate-300 font-bold block">
                  Язык синтезатора Google Stream:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {GOOGLE_TTS_VOICES.map((v) => {
                    const isSelected = tempVoice === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setTempVoice(v.id)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-purple-950/60 border-purple-500 text-purple-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-xs text-slate-100">{v.name}</span>
                          <span className="text-[9px] font-mono text-slate-500">{v.lang}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{v.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tempTtsProvider === 'browser' && (
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-300 font-bold block">
                    Русский системный голос устройства (Web Speech API):
                  </label>
                  <span className="text-[10px] text-purple-400 font-mono">
                    Русских голосов: {browserVoicesList.length}
                  </span>
                </div>
                {browserVoicesList.length > 0 ? (
                  <select
                    value={tempTtsBrowserVoice}
                    onChange={(e) => setTempTtsBrowserVoice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    {browserVoicesList.map((v) => (
                      <option key={v.voiceURI || v.name} value={v.name || v.voiceURI}>
                        {v.name} ({v.lang}) {v.default ? '★ По умолчанию' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
                    Русскоязычный голос не обнаружен в операционной системе. Рекомендуется использовать Edge Neural или Google Stream.
                  </div>
                )}
                <p className="text-[10px] text-emerald-400/90 leading-tight">
                  ✓ Этот синтезатор работает полностью автономно даже без интернета (например, в дороге или без связи).
                </p>
              </div>
            )}

            {/* Speed & Quick Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Скорость чтения:
                </label>
                <select
                  value={tempTtsSpeed}
                  onChange={(e) => setTempTtsSpeed(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100"
                >
                  <option value="-20%">0.8x (Медленная, эпичная)</option>
                  <option value="+0%">1.0x (Нормальная)</option>
                  <option value="+25%">1.25x (Быстрая)</option>
                  <option value="+50%">1.5x (Динамичная)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Быстрое прослушивание:
                </label>
                <button
                  type="button"
                  onClick={handleTestTtsVoice}
                  disabled={isTestingVoice}
                  className="w-full py-1.5 px-3 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                >
                  {isTestingVoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isTestingVoice ? 'Синтез...' : 'Прослушать голос'}</span>
                </button>
              </div>
            </div>

            {/* Volume Range */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5">
                  {tempTtsVolume === 0 ? <VolumeX className="w-3.5 h-3.5 text-slate-500" /> : tempTtsVolume < 0.5 ? <Volume1 className="w-3.5 h-3.5 text-purple-400" /> : <Volume2 className="w-3.5 h-3.5 text-purple-400" />}
                  <span>Громкость озвучки:</span>
                </label>
                <span className="text-xs font-bold text-purple-300 font-mono">{Math.round(tempTtsVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={tempTtsVolume}
                onChange={(e) => setTempTtsVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* ================= TTS CONNECTION TEST PANEL ================= */}
            <div className="bg-slate-950/85 border border-purple-500/30 rounded-xl p-3.5 space-y-3 shadow-inner">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>Проверка подключения к голосовому синтезу</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Диагностика TTS
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <button
                  type="button"
                  onClick={handleTestTtsConnection}
                  disabled={isTestingTtsConnection}
                  className="flex-1 py-2 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-slate-100 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isTestingTtsConnection ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                      <span>Тестирование подключения и синтеза...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>Проверить соединение с голосовым синтезом</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTtsPromptInput(!showTtsPromptInput)}
                  className="py-2 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                  title="Настроить проверочный текст для синтеза"
                >
                  <Sliders className="w-3 h-3 text-purple-400" />
                  <span>{showTtsPromptInput ? 'Скрыть текст' : 'Текст теста'}</span>
                </button>
              </div>

              {showTtsPromptInput && (
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] text-slate-400 block font-semibold">
                    Пользовательская проверочная фраза:
                  </label>
                  <input
                    type="text"
                    value={customTtsTestPrompt}
                    onChange={(e) => setCustomTtsTestPrompt(e.target.value)}
                    placeholder="Связь с голосовым синтезом успешно установлена!"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Diagnostic Test Output */}
              {ttsTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                    ttsTestResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/50 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {ttsTestResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">Соединение успешно: голос синтезирован!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-red-300">Ошибка соединения с синтезатором</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      {ttsTestResult.latencyMs > 0 && (
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700 text-amber-300">
                          ⚡ {ttsTestResult.latencyMs} мс
                        </span>
                      )}
                      {ttsTestResult.audioSizeBytes ? (
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                          {Math.round(ttsTestResult.audioSizeBytes / 1024)} КБ
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {ttsTestResult.success && (
                    <div className="bg-slate-950/80 border border-emerald-500/30 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Движок: {ttsTestResult.engineUsed || tempTtsProvider}
                        </span>
                        <button
                          type="button"
                          onClick={handlePlaySavedTestAudio}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          <Play className="w-3 h-3 text-emerald-400" />
                          <span>{isPlayingTestAudio ? 'Воспроизведение...' : 'Воспроизвести'}</span>
                        </button>
                      </div>
                      <p className="text-slate-200 italic leading-relaxed text-[11px]">
                        «{ttsTestResult.sampleText}»
                      </p>
                    </div>
                  )}

                  {!ttsTestResult.success && ttsTestResult.error && (
                    <div className="space-y-1.5">
                      <p className="text-red-300 leading-relaxed text-[11px]">
                        {ttsTestResult.error}
                      </p>
                      <p className="text-slate-400 text-[10px] leading-tight">
                        💡 Совет: Попробуйте переключиться на <strong>Google Speech Stream</strong> или встроенный <strong>Web Speech API (Офлайн)</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto-TTS Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Автоозвучка ходов Мастера</span>
                <span className="text-[10px] text-slate-400">Автоматически зачитывать новые ответы DM вслух</span>
              </div>
              <button
                type="button"
                onClick={() => setTempAutoTts(!tempAutoTts)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                  tempAutoTts
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 ring-1 ring-purple-500/30'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                {tempAutoTts ? '✓ ВКЛ' : 'ВЫКЛ'}
              </button>
            </div>
          </div>


          {/* ================= LM STUDIO (LOCAL AI) PANEL ================= */}
          {!isMobileClient && (
          <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/50 rounded-2xl p-4.5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/30">
                  <HardDrive className="w-3.5 h-3.5 text-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                      Локальная нейросеть LM Studio
                    </h4>
                    <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Приоритет 1
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Прямое подключение к LM Studio / Ollama (локальный AI на вашем ПК)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempUseLmStudio(!tempUseLmStudio)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                  tempUseLmStudio
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500/40'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                <span>{tempUseLmStudio ? '✓ ВКЛЮЧЕН (ТОП 1)' : 'ВЫКЛ'}</span>
              </button>
            </div>

            {tempUseLmStudio && (
              <div className="text-[11px] bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  <strong>LM Studio активен и имеет наивысший приоритет:</strong> Все ходы Мастера будут обрабатываться локально на вашей видеокарте/процессоре без отправки данных в интернет!
                </span>
              </div>
            )}

            {/* LM Studio URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-400" /> Адрес локального сервера (Local Server URL)
                </label>
                <span className="text-[10px] text-slate-400 font-mono">OpenAI-совместимый</span>
              </div>
              <input
                type="text"
                placeholder="http://localhost:1234/v1"
                value={tempLmStudioUrl}
                onChange={(e) => setTempLmStudioUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-400 font-mono"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-500">Пресеты:</span>
                <button
                  type="button"
                  onClick={() => setTempLmStudioUrl('http://localhost:1234/v1')}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 font-mono transition"
                >
                  LM Studio (1234)
                </button>
                <button
                  type="button"
                  onClick={() => setTempLmStudioUrl('http://127.0.0.1:1234/v1')}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 font-mono transition"
                >
                  127.0.0.1:1234
                </button>
                <button
                  type="button"
                  onClick={() => setTempLmStudioUrl('http://localhost:11434/v1')}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-teal-400 font-mono transition"
                >
                  Ollama (11434)
                </button>
              </div>
            </div>

            {/* Model Name & Auto-Detect */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Имя модели (Model Identifier)
                </label>
                <button
                  type="button"
                  onClick={handleFetchLmModels}
                  disabled={isFetchingLmModels}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isFetchingLmModels ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Поиск...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Обнаружить загруженную модель</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                placeholder="Оставьте пустым для авто-выбора или введите имя модели"
                value={tempLmStudioModel}
                onChange={(e) => setTempLmStudioModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-400 font-mono"
              />
              {lmStudioAvailableModels.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-slate-400 block font-semibold">Обнаруженные модели в LM Studio:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {lmStudioAvailableModels.map((m, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTempLmStudioModel(m)}
                        className={`text-[10px] px-2 py-1 rounded-lg border font-mono transition cursor-pointer ${
                          tempLmStudioModel === m
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-emerald-500/40'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Test LM Studio Connection Button */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={handleTestLmStudioConnection}
                disabled={isTestingLmStudio}
                className="w-full py-2 px-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isTestingLmStudio ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Проверка связи с LM Studio...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-slate-950" />
                    <span>⚡ Проверить связь с LM Studio (Тестовый пинг)</span>
                  </>
                )}
              </button>

              {/* LM Studio Test Output */}
              {lmStudioTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                    lmStudioTestResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/50 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {lmStudioTestResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">Локальный сервер LM Studio отвечает!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-red-300">Ошибка связи с LM Studio</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      {lmStudioTestResult.latencyMs > 0 && (
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
                          ⚡ {lmStudioTestResult.latencyMs} мс
                        </span>
                      )}
                      {lmStudioTestResult.modelUsed && (
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                          {lmStudioTestResult.modelUsed}
                        </span>
                      )}
                    </div>
                  </div>

                  {lmStudioTestResult.success && lmStudioTestResult.response && (
                    <div className="bg-slate-950/80 border border-emerald-500/30 rounded-lg p-2.5 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Ответ локальной модели:
                      </span>
                      <p className="text-slate-200 italic leading-relaxed text-[11px]">
                        «{lmStudioTestResult.response}»
                      </p>
                    </div>
                  )}

                  {!lmStudioTestResult.success && lmStudioTestResult.error && (
                    <p className="text-red-300 leading-relaxed text-[11px]">
                      {lmStudioTestResult.error}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          )}

          {/* ================= GOOGLE GEMINI FREE TIER (3-FLASH) PANEL ================= */}
          <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-cyan-950/60 border border-cyan-500/50 rounded-2xl p-4.5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-slate-950 font-bold text-xs">
                  ♊
                </div>
                <div>
                  <h4 className="text-xs font-bold text-cyan-200 uppercase tracking-wider">
                    Google Gemini API (Free Tier 3-Flash)
                  </h4>
                  <p className="text-[10px] text-slate-400">Прямое подключение к Gemini 3-Flash без посредников</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempUseGemini(!tempUseGemini)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                  tempUseGemini
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                <span>{tempUseGemini ? '✓ ВКЛЮЧЕН' : 'ВЫКЛ'}</span>
              </button>
            </div>

            {tempUseGemini && (
              <div className="text-[11px] bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  <strong>Gemini 3-Flash активен:</strong> Все ответы Мастера Подземелий будут генерироваться через прямое API Google вместо OpenRouter!
                </span>
              </div>
            )}

            {/* Gemini API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-400" /> API Ключ Gemini (Google AI Studio)
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-cyan-400 underline hover:text-cyan-300 font-semibold flex items-center gap-1"
                >
                  <span>Получить ключ (aistudio.google.com)</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={tempGeminiApiKey}
                  onChange={(e) => setTempGeminiApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 pr-10 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>



            {/* Gemini Model Selector */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Выбор модели Gemini Free Tier
              </label>
              <div className="grid grid-cols-1 gap-2">
                {AVAILABLE_GEMINI_MODELS.map((gm) => {
                  const isSelected = selectedGeminiModel === gm.id;
                  return (
                    <div
                      key={gm.id}
                      onClick={() => setSelectedGeminiModel(gm.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/50'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-100">{gm.name}</span>
                          <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Free Tier
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{gm.desc}</p>
                        <span className="text-[9px] font-mono text-cyan-300/80 block">{gm.limitDesc}</span>
                      </div>
                      {isSelected && (
                        <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Test Gemini Connection Button */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={handleTestGeminiConnection}
                disabled={isTestingGemini}
                className="w-full py-2 px-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isTestingGemini ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Проверка связи с Gemini API...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-slate-950" />
                    <span>⚡ Проверить связь с Gemini API (Тестовый пинг)</span>
                  </>
                )}
              </button>

              {/* Gemini Test Output */}
              {geminiTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                    geminiTestResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/50 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {geminiTestResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">Связь с Gemini API успешно установлена!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-red-300">Ошибка связи с Gemini</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      {geminiTestResult.latencyMs > 0 && (
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
                          ⚡ {geminiTestResult.latencyMs} мс
                        </span>
                      )}
                      {geminiTestResult.modelUsed && (
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                          {geminiTestResult.modelUsed}
                        </span>
                      )}
                    </div>
                  </div>

                  {geminiTestResult.success && geminiTestResult.response && (
                    <div className="bg-slate-950/80 border border-emerald-500/30 rounded-lg p-2.5 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Ответ Gemini:
                      </span>
                      <p className="text-slate-200 italic leading-relaxed text-[11px]">
                        «{geminiTestResult.response}»
                      </p>
                    </div>
                  )}

                  {!geminiTestResult.success && geminiTestResult.error && (
                    <p className="text-red-300 leading-relaxed text-[11px]">
                      {geminiTestResult.error}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Quota Remaining & Usage Tracker */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  📊 Остаток использования (Gemini Free Tier)
                </span>
                <span className="text-[10px] font-mono text-cyan-300 font-bold">
                  {Math.max(0, geminiStats.maxRequestsPerDay - geminiStats.requestsToday)} / {geminiStats.maxRequestsPerDay} остаток
                </span>
              </div>

              {/* Progress Bar */}
              {(() => {
                const remaining = Math.max(0, geminiStats.maxRequestsPerDay - geminiStats.requestsToday);
                const percent = Math.min(100, Math.max(0, (remaining / geminiStats.maxRequestsPerDay) * 100));
                const barColor = percent > 50 ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' : percent > 20 ? 'bg-amber-500' : 'bg-red-500';

                return (
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Использовано сегодня: {geminiStats.requestsToday}</span>
                      <span>Сброс лимитов: 00:00 UTC</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-800/60">
                <span>Скорость: max 15 запросов / мин (15 RPM)</span>
                <button
                  type="button"
                  onClick={() => {
                    const fresh = resetGeminiUsageStats();
                    setGeminiStats(fresh);
                  }}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Сбросить счетчик
                </button>
              </div>
            </div>
          </div>

          {/* ================= OPENROUTER AI (CLOUD PROVIDER) PANEL ================= */}
          <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-orange-950/60 border border-amber-500/50 rounded-2xl p-4.5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 font-bold text-xs shadow-md shadow-amber-500/30">
                  <Globe className="w-3.5 h-3.5 text-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                      Нейросети OpenRouter (Облачный AI)
                    </h4>
                    <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Облако
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Облачные бесплатные модели (Nemotron, Laguna, MiniMax, Gemma)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempUseOpenRouter(!tempUseOpenRouter)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                  tempUseOpenRouter
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/40'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                <span>{tempUseOpenRouter ? '✓ ВКЛЮЧЕН' : 'ВЫКЛ'}</span>
              </button>
            </div>

            {tempUseOpenRouter && (
              <div className="text-[11px] bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5 text-amber-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  <strong>OpenRouter активен:</strong> Запросы могут обрабатываться через облачные модели OpenRouter (если LM Studio и Gemini отключены или недоступны).
                </span>
              </div>
            )}

            {/* API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" /> API Ключ (OpenRouter API Key)
                </label>
                <span className="text-[10px] text-slate-500">Локально в браузере</span>
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-or-v1-..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 pr-10 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Model Selector */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Выбор нейросети (Бесплатные модели OpenRouter)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {AVAILABLE_AI_MODELS.map((m) => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectModel(m)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/50'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-100">{m.name}</span>
                          {m.isFree && (
                            <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Бесплатно
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">[{m.provider}]</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{m.desc}</p>
                      </div>
                      {isSelected && (
                        <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ================= AI CONNECTION TEST PANEL ================= */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-inner">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Проверка подключения к OpenRouter</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Диагностика API
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={isTestingAi}
                  className="flex-1 py-2 px-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isTestingAi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Отправка тестового запроса...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Проверить доступ и отправить тестовое сообщение</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTestPromptInput(!showTestPromptInput)}
                  className="py-2 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                  title="Настроить текст тестового сообщения"
                >
                  <Sliders className="w-3 h-3 text-cyan-400" />
                  <span>{showTestPromptInput ? 'Скрыть текст' : 'Текст теста'}</span>
                </button>
              </div>

              {showTestPromptInput && (
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] text-slate-400 block font-semibold">
                    Пользовательское тестовое сообщение для ИИ:
                  </label>
                  <input
                    type="text"
                    value={customTestPrompt}
                    onChange={(e) => setCustomTestPrompt(e.target.value)}
                    placeholder="Ответь кратко на русском: Связь с Мастером Подземелий установлена!"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Live Result Output */}
              {aiTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                    aiTestResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/50 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {aiTestResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">Соединение успешно установлено!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-red-300">Ошибка соединения</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      {aiTestResult.latencyMs > 0 && (
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
                          ⚡ {aiTestResult.latencyMs} мс
                        </span>
                      )}
                      {aiTestResult.modelUsed && (
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                          {aiTestResult.modelUsed.split('/').pop() || aiTestResult.modelUsed}
                        </span>
                      )}
                    </div>
                  </div>

                  {aiTestResult.success && aiTestResult.response && (
                    <div className="bg-slate-950/80 border border-emerald-500/30 rounded-lg p-2.5 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Ответ Мастера Подземелий:
                      </span>
                      <p className="text-slate-200 italic leading-relaxed text-[11px]">
                        «{aiTestResult.response}»
                      </p>
                    </div>
                  )}

                  {!aiTestResult.success && aiTestResult.error && (
                    <p className="text-red-300 leading-relaxed text-[11px]">
                      {aiTestResult.error}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Custom System Prompt / DM Instructions */}
          <div className="space-y-2 pt-1">
            <label className="text-xs uppercase font-bold text-slate-300">Стиль и пресеты DM</label>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTempCustomPrompt(p.text)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-[11px] text-slate-300 transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Дополнительные системные инструкции к стилю Мастера..."
              value={tempCustomPrompt}
              onChange={(e) => setTempCustomPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-purple-500 min-h-[75px]"
            />
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-400" /> API Base URL (Опционально)
            </label>
            <input
              type="text"
              placeholder="https://openrouter.ai/api/v1"
              value={tempBaseUrl}
              onChange={(e) => setTempBaseUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Sound Toggle */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              <div>
                <span className="text-xs font-bold text-slate-200 block">Звуковые эффекты кубиков (Web Audio)</span>
                <span className="text-[10px] text-slate-400">Звуки броска кубиков, критов и урона</span>
              </div>
            </div>
            <button
              onClick={onToggleSound}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition border cursor-pointer ${soundEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
            >
              {soundEnabled ? 'ВКЛ' : 'ВЫКЛ'}
            </button>
          </div>

          {/* GPU Optimization Toggle */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 ${gpuSaverActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Оптимизация GPU (Режим высокой производительности)</span>
                <span className="text-[10px] text-slate-400">Снижает нагрев видеокарты: отключает тяжелые тени, фоновые циклы анимаций и разгружает рендеринг</span>
              </div>
            </div>
            <button
              onClick={() => onToggleGpuSaver && onToggleGpuSaver(!gpuSaverActive)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition border cursor-pointer ${gpuSaverActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
            >
              {gpuSaverActive ? 'ВКЛ' : 'ВЫКЛ'}
            </button>
          </div>

          {/* World Settings Tweaks */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase font-bold text-slate-300 block">
                Параметры мира и правила кампании
              </label>
              <button
                type="button"
                onClick={handleClearWorldSettings}
                className="px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition cursor-pointer flex items-center gap-1"
                title="Очистить все параметры мира и настроить кампанию с нуля"
              >
                <span>🧹 Очистить всё (чистый лист)</span>
              </button>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Сеттинг и описание мира</label>
              <textarea
                placeholder="Опишите мир, локации, магию, расы, геополитику или эпоху..."
                value={tempSetting}
                onChange={(e) => setTempSetting(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Тональность и атмосфера</label>
              <input
                type="text"
                placeholder="Например: Высокое героическое фэнтези, мистический детектив, реализм..."
                value={tempTone}
                onChange={(e) => setTempTone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Правила и табу мира</label>
              <textarea
                placeholder="Особые правила, запреты, законы магии или домашние правила D&D..."
                value={tempRules}
                onChange={(e) => setTempRules(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 min-h-[50px]"
              />
            </div>

            {/* Current Difficulty Info (Read-Only) */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Сложность кампании:</span>
              <span className="text-xs px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold flex items-center gap-1.5">
                <span>{DIFFICULTY_PROFILES[world.difficulty || 'standard']?.icon || '⚖️'}</span>
                <span>{DIFFICULTY_PROFILES[world.difficulty || 'standard']?.name || 'Обычная'}</span>
              </span>
            </div>
          </div>

          {/* New Adventure / Start New Campaign Block */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-purple-950/40 border border-amber-500/40 rounded-2xl p-4 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wide">
                <PlusCircle className="w-4 h-4 text-amber-400" />
                <span>Новая игра & Создание персонажа</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Создайте нового героя, выберите класс и предысторию или настройте свой уникальный сеттинг с нуля.
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm('Начать новую игру и перейти к созданию персонажа?')) {
                  stopTtsAudio();
                  onResetGame();
                  onClose();
                }
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>➕ Начать новую игру / Создать персонажа</span>
            </button>
          </div>

          {/* Backup & Reset */}
          <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={onExportSave}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Экспорт</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Импорт</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportSave(f);
                }}
                accept=".json"
                className="hidden"
              />
            </div>

            <button
              onClick={() => {
                if (confirm('Вы уверены, что хотите сбросить текущую игру и начать заново?')) {
                  stopTtsAudio();
                  onResetGame();
                  onClose();
                }
              }}
              className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-emerald-400 font-medium">
            {savedSuccess && '✓ Настройки успешно сохранены!'}
          </span>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            Сохранить изменения
          </button>
        </div>
      </div>
    </div>
  );
};
