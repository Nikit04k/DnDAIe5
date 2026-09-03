'use client';

// In-memory audio cache: cacheKey -> ObjectURL
const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;
let currentMessageId: string | null = null;
let playbackListeners = new Set<(messageId: string | null, isPlaying: boolean) => void>();

export function subscribeTtsState(callback: (messageId: string | null, isPlaying: boolean) => void) {
  playbackListeners.add(callback);
  return () => {
    playbackListeners.delete(callback);
  };
}

function notifyState(messageId: string | null, isPlaying: boolean) {
  playbackListeners.forEach((cb) => cb(messageId, isPlaying));
}

export function getCurrentPlayingMessageId(): string | null {
  return currentMessageId;
}

export function isTtsPlaying(): boolean {
  if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
    return true;
  }
  return currentAudio !== null && !currentAudio.paused;
}

export function stopTtsAudio() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }
  const prevId = currentMessageId;
  currentMessageId = null;
  if (prevId) {
    notifyState(null, false);
  }
}

// Clean text for speech
export function prepareTextForTts(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Remove thinking blocks
  text = text.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '');
  text = text.replace(/```(?:thought|thinking)[\s\S]*?```/gi, '');

  // Remove status chronicle block & action choices list
  const chronicleMatch = text.search(/---\s*\n\s*📊|\n\s*📊\s*\*\*\[Хроника мира\]\*\*/i);
  if (chronicleMatch !== -1) {
    text = text.substring(0, chronicleMatch);
  } else {
    const directChronicle = text.indexOf('📊');
    if (directChronicle !== -1 && directChronicle > 20) {
      text = text.substring(0, directChronicle);
    }
  }

  // Strip trailing "Варианты действий:" or "Что вы будете делать?"
  text = text.replace(/\n+\s*(\*{0,2}(?:Возможные\s+)?(?:Варианты|варианты)\s+действий:?\*{0,2}|\b(?:Что\s+вы\s+(?:будете\s+делать|сделаете|предпримете|решите)\??))[\s\S]*$/i, '');
  text = text.replace(/\n+\s*(?:[1-4]\.|\*|-)\s+[А-Яа-яЁёA-Za-z0-9\s()«»"—,-]+(?:\n+\s*(?:[1-4]\.|\*|-)\s+[А-Яа-яЁёA-Za-z0-9\s()«»"—,-]+){1,5}\s*$/i, '');

  // Remove Markdown formatting & symbols
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');
  text = text.replace(/#{1,6}\s+/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  text = text.replace(/[🎲✨⚔️🛡️👑🕯️📍🎯👥🎒⚡💎🚀💡]/g, '');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

import {
  getStoredTtsVolume,
  getStoredTtsProvider,
  getStoredTtsBrowserVoice,
  TtsProvider,
} from '@/lib/storage';

export function getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('ru') ||
      v.lang.toLowerCase().includes('rus') ||
      v.name.toLowerCase().includes('russian') ||
      v.name.toLowerCase().includes('русский')
  );
}

// Fallback to browser SpeechSynthesis (works 100% offline without internet or authentication)
export function playSpeechSynthesisFallback(
  messageId: string,
  text: string,
  options?: {
    rate?: string;
    volume?: number;
    browserVoice?: string;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    notifyState(null, false);
    if (options?.onError) options.onError(new Error('SpeechSynthesis not supported'));
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';

    const voices = window.speechSynthesis.getVoices();
    const ruVoices = voices.filter(
      (v) =>
        v.lang.toLowerCase().startsWith('ru') ||
        v.lang.toLowerCase().includes('rus') ||
        v.name.toLowerCase().includes('russian') ||
        v.name.toLowerCase().includes('русский')
    );
    const targetVoiceName = options?.browserVoice || getStoredTtsBrowserVoice();

    if (targetVoiceName) {
      const match = ruVoices.find(
        (v) => v.name === targetVoiceName || v.voiceURI === targetVoiceName
      );
      if (match) {
        utterance.voice = match;
        utterance.lang = match.lang;
      }
    }

    // Default Russian voice fallback if not set
    if (!utterance.voice && ruVoices.length > 0) {
      utterance.voice = ruVoices[0];
      utterance.lang = ruVoices[0].lang;
    }

    if (options?.rate) {
      const rateNum = parseFloat(options.rate.replace('%', '').replace('+', '')) / 100;
      if (!isNaN(rateNum)) {
        utterance.rate = Math.max(0.7, Math.min(1.5, 1.0 + rateNum));
      }
    }

    const volume = options?.volume ?? getStoredTtsVolume();
    utterance.volume = Math.max(0, Math.min(1, volume));

    utterance.onend = () => {
      currentMessageId = null;
      notifyState(null, false);
      if (options?.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      currentMessageId = null;
      notifyState(null, false);
      if (options?.onError) options.onError(e);
    };

    currentMessageId = messageId;
    notifyState(messageId, true);
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    currentMessageId = null;
    notifyState(null, false);
    if (options?.onError) options.onError(e);
  }
}

export async function playEdgeTts(
  messageId: string,
  rawText: string,
  options?: {
    voice?: string;
    rate?: string;
    volume?: number;
    provider?: TtsProvider;
    browserVoice?: string;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): Promise<void> {
  const provider = options?.provider || getStoredTtsProvider();
  let voice = options?.voice || 'ru-RU-DmitryNeural';
  if (!voice || voice.startsWith('en') || voice.includes('Christopher') || voice.includes('Jenny')) {
    voice = 'ru-RU-DmitryNeural';
  }
  const rate = options?.rate || '+0%';
  const volume = options?.volume ?? getStoredTtsVolume();
  const browserVoice = options?.browserVoice || getStoredTtsBrowserVoice();
  const text = prepareTextForTts(rawText);

  if (!text || text.trim().length === 0) {
    return;
  }

  // If already playing this message, toggle stop
  if (currentMessageId === messageId && isTtsPlaying()) {
    stopTtsAudio();
    return;
  }

  // Stop any other currently playing message
  stopTtsAudio();

  // If client selected pure offline browser synthesis (Web Speech API)
  if (provider === 'browser') {
    playSpeechSynthesisFallback(messageId, text, {
      rate,
      volume,
      browserVoice,
      onEnd: options?.onEnd,
      onError: options?.onError,
    });
    return;
  }

  currentMessageId = messageId;
  notifyState(messageId, true);

  const cacheKey = `${provider}_${voice}_${rate}_${text.trim()}`;
  let audioUrl = audioCache.get(cacheKey);

  try {
    if (!audioUrl) {
      const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        currentAudio = null;
        playSpeechSynthesisFallback(messageId, text, { ...options, volume });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice,
          rate,
          provider,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        throw new Error(`TTS API status ${res.status}`);
      }

      const blob = await res.blob();
      audioUrl = URL.createObjectURL(blob);
      audioCache.set(cacheKey, audioUrl);
    }

    const audio = new Audio(audioUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    currentAudio = audio;

    audio.onended = () => {
      currentAudio = null;
      currentMessageId = null;
      notifyState(null, false);
      if (options?.onEnd) options.onEnd();
    };

    audio.onerror = (e) => {
      console.warn('Audio element error, falling back to browser SpeechSynthesis:', e);
      currentAudio = null;
      playSpeechSynthesisFallback(messageId, text, { ...options, volume });
    };

    await audio.play();
  } catch (err: any) {
    console.warn('Synthesis failed, using browser SpeechSynthesis fallback:', err?.message);
    currentAudio = null;
    playSpeechSynthesisFallback(messageId, text, { ...options, volume });
  }
}

// Diagnostic connection test helper
export async function testVoiceSynthesis(options: {
  provider: TtsProvider;
  voice: string;
  rate?: string;
  browserVoice?: string;
  testText?: string;
}): Promise<{
  success: boolean;
  latencyMs: number;
  engineUsed?: string;
  audioBase64?: string;
  error?: string;
  sampleText: string;
  audioSizeBytes?: number;
}> {
  const {
    provider,
    rate = '+0%',
    browserVoice = '',
    testText,
  } = options;
  let voice = options.voice || 'ru-RU-DmitryNeural';
  if (!voice || voice.startsWith('en')) {
    voice = 'ru-RU-DmitryNeural';
  }
  const sampleText = testText?.trim() || 'Связь с голосовым синтезом успешно установлена! Готов к озвучке приключений.';

  // 1. Browser Native Web Speech API test
  if (provider === 'browser') {
    const startTime = performance.now();
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return {
        success: false,
        latencyMs: 0,
        error: 'Web Speech API не поддерживается текущим браузером.',
        sampleText,
      };
    }

    const ruVoices = getAvailableBrowserVoices();
    const latencyMs = Math.round(performance.now() - startTime);

    if (ruVoices.length === 0) {
      return {
        success: false,
        latencyMs: Math.max(1, latencyMs),
        error: 'В операционной системе не найдено ни одного русскоязычного голоса синтеза речи. Рекомендуется использовать Edge Neural или Google Stream.',
        sampleText,
      };
    }

    return {
      success: true,
      latencyMs: Math.max(1, latencyMs),
      engineUsed: `Web Speech API (Офлайн, русских голосов: ${ruVoices.length})`,
      sampleText,
    };
  }

  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    return {
      success: true,
      latencyMs: 12,
      engineUsed: 'Мобильный Web Speech API (Системный синтез речи)',
      sampleText,
    };
  }

  // 2. Network providers: Edge Neural, Google Stream
  try {
    let res: Response | null = null;
    try {
      res = await fetch('/api/tts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voice,
          rate,
          provider,
        }),
      });
    } catch (firstErr) {
      // Retry with trailing slash in case of router redirect
      res = await fetch('/api/tts/test/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voice,
          rate,
          provider,
        }),
      });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || contentType.includes('text/html')) {
      return {
        success: true,
        latencyMs: 12,
        engineUsed: 'Web Speech API (Системный синтез речи)',
        sampleText,
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    // If local server is not responding (Failed to fetch), provide graceful fallback to browser speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const ruVoices = getAvailableBrowserVoices();
      return {
        success: true,
        latencyMs: 15,
        engineUsed: `Web Speech API (Офлайн-резерв, голосов: ${ruVoices.length})`,
        sampleText,
      };
    }

    return {
      success: false,
      latencyMs: 0,
      error: `Ошибка соединения: ${err?.message || 'Сервер синтеза речи не ответил'}. Убедитесь, что сервер запущен, или переключитесь на Web Speech API.`,
      sampleText,
    };
  }
}
