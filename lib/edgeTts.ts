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

import { getStoredTtsVolume } from '@/lib/storage';

// Fallback to browser SpeechSynthesis (works 100% offline or if Edge network fails)
function playSpeechSynthesisFallback(
  messageId: string,
  text: string,
  options?: {
    rate?: string;
    volume?: number;
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

    // Try to find Russian voice
    const voices = window.speechSynthesis.getVoices();
    const ruVoice = voices.find((v) => v.lang.startsWith('ru') || v.name.includes('Russian'));
    if (ruVoice) {
      utterance.voice = ruVoice;
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
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): Promise<void> {
  const voice = options?.voice || 'ru-RU-DmitryNeural';
  const rate = options?.rate || '+0%';
  const volume = options?.volume ?? getStoredTtsVolume();
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

  currentMessageId = messageId;
  notifyState(messageId, true);

  const cacheKey = `${voice}_${rate}_${text.trim()}`;
  let audioUrl = audioCache.get(cacheKey);

  try {
    if (!audioUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, rate }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Edge TTS API status ${res.status}`);
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
      console.warn('Edge TTS Audio element error, falling back to SpeechSynthesis:', e);
      currentAudio = null;
      playSpeechSynthesisFallback(messageId, text, { ...options, volume });
    };

    await audio.play();
  } catch (err: any) {
    console.warn('Edge TTS synthesis failed, using SpeechSynthesis fallback:', err?.message);
    currentAudio = null;
    playSpeechSynthesisFallback(messageId, text, { ...options, volume });
  }
}
