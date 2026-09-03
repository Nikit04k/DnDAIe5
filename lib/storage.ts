import { GameSessionState, CharacterSheet, WorldSettings, ChatMessage, RollRequirement } from '@/types/dnd';

const STORAGE_KEYS = {
  CURRENT_SESSION: 'dnd_solo_current_session',
  USER_API_KEY: 'dnd_deepseek_api_key',
  LEGACY_GEMINI_KEY: 'dnd_gemini_api_key',
  USER_MODEL: 'dnd_deepseek_model',
  USER_BASE_URL: 'dnd_deepseek_base_url',
  USER_CUSTOM_PROMPT: 'dnd_deepseek_custom_prompt',
  SOUND_ENABLED: 'dnd_sound_enabled',
  SAVED_CHARACTERS: 'dnd_saved_characters',
  TTS_VOICE: 'dnd_tts_voice',
  TTS_AUTO_PLAY: 'dnd_tts_auto_play',
  TTS_SPEED: 'dnd_tts_speed',
  TTS_VOLUME: 'dnd_tts_volume',
  TTS_PROVIDER: 'dnd_tts_provider',
  TTS_BROWSER_VOICE: 'dnd_tts_browser_voice',
  GPU_SAVER: 'dnd_gpu_saver_enabled',
  WORLD_SETTINGS: 'dnd_world_settings',
};

export function saveSessionState(state: Partial<GameSessionState>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadSessionState();
    const merged: GameSessionState = {
      id: state.id || existing?.id || 'session_' + Date.now(),
      character: state.character || existing?.character!,
      world: state.world || existing?.world!,
      history: state.history || existing?.history || [],
      currentLocation: state.currentLocation ?? existing?.currentLocation ?? 'Начало пути',
      pendingRoll: state.pendingRoll !== undefined ? state.pendingRoll : (existing?.pendingRoll ?? null),
      suggestedActions: state.suggestedActions || existing?.suggestedActions || [],
      journalEntries: state.journalEntries || existing?.journalEntries || [],
      partyCompanions: state.partyCompanions || existing?.partyCompanions || [],
      lorebookEntries: state.lorebookEntries || existing?.lorebookEntries || [],
      storySummary: state.storySummary !== undefined ? state.storySummary : (existing?.storySummary || ''),
      inGameDay: state.inGameDay !== undefined ? state.inGameDay : (existing?.inGameDay || 1),
      inGameMinutes: state.inGameMinutes !== undefined ? state.inGameMinutes : (existing?.inGameMinutes || 480),
      createdAt: existing?.createdAt || Date.now(),
      lastPlayedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save session to localStorage:', err);
  }
}

export function loadSessionState(): GameSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    if (!data) return null;
    return JSON.parse(data) as GameSessionState;
  } catch (err) {
    console.error('Failed to load session from localStorage:', err);
    return null;
  }
}

export function clearSessionState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
}

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  const key = localStorage.getItem(STORAGE_KEYS.USER_API_KEY);
  if (key) return key;
  return localStorage.getItem(STORAGE_KEYS.LEGACY_GEMINI_KEY) || '';
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER_API_KEY, key.trim());
}

export function getStoredModel(): string {
  const defaultModel = 'nvidia/nemotron-3-super-120b-a12b:free';
  if (typeof window === 'undefined') return defaultModel;
  const saved = localStorage.getItem(STORAGE_KEYS.USER_MODEL);
  if (!saved || saved.includes('deepseek') || saved.includes('gemini') || saved.includes('llama-3.3')) {
    return defaultModel;
  }
  return saved;
}

export function setStoredModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER_MODEL, model);
}

export function getStoredBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.USER_BASE_URL) || '';
}

export function setStoredBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER_BASE_URL, url.trim());
}

export function getStoredCustomPrompt(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.USER_CUSTOM_PROMPT) || '';
}

export function setStoredCustomPrompt(prompt: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER_CUSTOM_PROMPT, prompt);
}

export function getStoredTtsVoice(): string {
  if (typeof window === 'undefined') return 'ru-RU-DmitryNeural';
  const v = localStorage.getItem(STORAGE_KEYS.TTS_VOICE);
  if (!v || v.startsWith('en') || v === 'en-US-ChristopherNeural' || v === 'en-US-JennyNeural') {
    return 'ru-RU-DmitryNeural';
  }
  return v;
}

export function setStoredTtsVoice(voice: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TTS_VOICE, voice);
}

export function isAutoTtsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.TTS_AUTO_PLAY) === 'true';
}

export function setAutoTtsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TTS_AUTO_PLAY, enabled ? 'true' : 'false');
}

export function getStoredTtsSpeed(): string {
  if (typeof window === 'undefined') return '+0%';
  return localStorage.getItem(STORAGE_KEYS.TTS_SPEED) || '+0%';
}

export function setStoredTtsSpeed(speed: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TTS_SPEED, speed);
}

export function getStoredTtsVolume(): number {
  if (typeof window === 'undefined') return 1.0;
  const vol = localStorage.getItem(STORAGE_KEYS.TTS_VOLUME);
  if (vol === null) return 1.0;
  const num = parseFloat(vol);
  return isNaN(num) ? 1.0 : Math.max(0, Math.min(1, num));
}

export function setStoredTtsVolume(volume: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TTS_VOLUME, volume.toString());
}

export type TtsProvider = 'edge' | 'google' | 'browser';

export function getStoredTtsProvider(): TtsProvider {
  if (typeof window === 'undefined') return 'edge';
  const val = localStorage.getItem(STORAGE_KEYS.TTS_PROVIDER);
  if (val === 'google' || val === 'browser') return val;
  return 'edge';
}

export function setStoredTtsProvider(provider: TtsProvider): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TTS_PROVIDER, provider);
}

export function getStoredTtsBrowserVoice(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.TTS_BROWSER_VOICE) || '';
}

export function setStoredTtsBrowserVoice(voiceUri: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TTS_BROWSER_VOICE, voiceUri);
}

/**
 * Export current session as downloadable JSON
 */
export function exportSessionToFile(session: GameSessionState): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const charName = session.character.name.replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_');
  downloadAnchor.setAttribute('download', `dnd_save_${charName}_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Import session from JSON string
 */
export function parseImportedSession(jsonString: string): GameSessionState {
  const parsed = JSON.parse(jsonString);
  if (!parsed.character || !parsed.world || !parsed.history) {
    throw new Error('Некорректный формат файла сохранения D&D 5e.');
  }
  return parsed as GameSessionState;
}

/* ================= GEMINI FREE TIER API STORAGE & USAGE TRACKING ================= */

export interface GeminiUsageStats {
  date: string; // YYYY-MM-DD
  requestsToday: number;
  maxRequestsPerDay: number;
  requestsThisMinute: number;
  lastMinuteTimestamp: number;
  maxRequestsPerMinute: number;
  lastUsedTimestamp: number;
}

export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('dnd_gemini_free_key') || localStorage.getItem('dnd_gemini_api_key') || '';
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dnd_gemini_free_key', key.trim());
}

export function isGeminiApiActive(): boolean {
  if (typeof window === 'undefined') return false;
  const val = localStorage.getItem('dnd_use_gemini_api');
  if (val !== null) return val === 'true';
  const key = getStoredGeminiApiKey();
  return !!key;
}

export function setGeminiApiActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dnd_use_gemini_api', active ? 'true' : 'false');
}

export function getStoredGeminiModel(): string {
  if (typeof window === 'undefined') return 'gemini-3.7-flash';
  const val = localStorage.getItem('dnd_gemini_model');
  const allowed = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
  if (!val || !allowed.includes(val)) {
    return 'gemini-3.7-flash';
  }
  return val;
}

export function setStoredGeminiModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dnd_gemini_model', model);
}


export function getGeminiUsageStats(): GeminiUsageStats {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultStats: GeminiUsageStats = {
    date: todayStr,
    requestsToday: 0,
    maxRequestsPerDay: 1500,
    requestsThisMinute: 0,
    lastMinuteTimestamp: Date.now(),
    maxRequestsPerMinute: 15,
    lastUsedTimestamp: Date.now(),
  };

  if (typeof window === 'undefined') return defaultStats;

  try {
    const raw = localStorage.getItem('dnd_gemini_usage_stats');
    if (!raw) return defaultStats;
    const parsed = JSON.parse(raw) as GeminiUsageStats;

    if (parsed.date !== todayStr) {
      return {
        ...defaultStats,
        date: todayStr,
      };
    }

    if (Date.now() - (parsed.lastMinuteTimestamp || 0) > 60000) {
      parsed.requestsThisMinute = 0;
      parsed.lastMinuteTimestamp = Date.now();
    }

    return parsed;
  } catch (e) {
    return defaultStats;
  }
}

export function recordGeminiUsage(): GeminiUsageStats {
  const stats = getGeminiUsageStats();
  const now = Date.now();

  if (now - stats.lastMinuteTimestamp > 60000) {
    stats.requestsThisMinute = 1;
    stats.lastMinuteTimestamp = now;
  } else {
    stats.requestsThisMinute += 1;
  }

  stats.requestsToday += 1;
  stats.lastUsedTimestamp = now;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('dnd_gemini_usage_stats', JSON.stringify(stats));
    } catch (e) {}
  }

  return stats;
}

export function resetGeminiUsageStats(): GeminiUsageStats {
  const todayStr = new Date().toISOString().split('T')[0];
  const fresh: GeminiUsageStats = {
    date: todayStr,
    requestsToday: 0,
    maxRequestsPerDay: 1500,
    requestsThisMinute: 0,
    lastMinuteTimestamp: Date.now(),
    maxRequestsPerMinute: 15,
    lastUsedTimestamp: Date.now(),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('dnd_gemini_usage_stats', JSON.stringify(fresh));
    } catch (e) {}
  }
  return fresh;
}

// ================= OPENROUTER STORAGE =================

export function getStoredUseOpenRouter(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem('dnd_use_openrouter');
  if (val === null) return true;
  return val === 'true';
}

export function setStoredUseOpenRouter(active: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dnd_use_openrouter', active ? 'true' : 'false');
}

// ================= LM STUDIO (LOCAL AI) STORAGE =================

export function getStoredUseLmStudio(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('dnd_use_lm_studio') === 'true';
}

export function setStoredUseLmStudio(active: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dnd_use_lm_studio', active ? 'true' : 'false');
}

export function getStoredLmStudioUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:1234/v1';
  return localStorage.getItem('dnd_lm_studio_url') || 'http://localhost:1234/v1';
}

export function setStoredLmStudioUrl(url: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dnd_lm_studio_url', url.trim());
}

export function getStoredLmStudioModel(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('dnd_lm_studio_model') || '';
}

export function setStoredLmStudioModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dnd_lm_studio_model', model.trim());
}

export function getStoredLmStudioApiKey(): string {
  if (typeof window === 'undefined') return 'lm-studio';
  return localStorage.getItem('dnd_lm_studio_api_key') || 'lm-studio';
}

export function setStoredLmStudioApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dnd_lm_studio_api_key', key.trim());
}

// ================= GPU SAVER / PERFORMANCE MODE =================

export function isGpuSaverEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GPU_SAVER);
    if (stored === null) return true;
    return stored === 'true';
  } catch {
    return true;
  }
}

export function setGpuSaverEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.GPU_SAVER, enabled ? 'true' : 'false');
  } catch {}
}

// ================= WORLD SETTINGS (SETTING, TONE, RULES) =================

export function getStoredWorldSettings(): WorldSettings {
  const defaultWorld: WorldSettings = {
    customSetting: '',
    customTone: '',
    customRules: '',
    startingScene: '',
  };
  if (typeof window === 'undefined') return defaultWorld;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORLD_SETTINGS);
    if (!raw) {
      const session = loadSessionState();
      if (session?.world) return session.world;
      return defaultWorld;
    }
    const parsed = JSON.parse(raw);
    return {
      customSetting: parsed.customSetting || '',
      customTone: parsed.customTone || '',
      customRules: parsed.customRules || '',
      startingScene: parsed.startingScene || '',
      difficulty: parsed.difficulty || 'standard',
      selectedPresetId: parsed.selectedPresetId || '',
    };
  } catch {
    return defaultWorld;
  }
}

export function setStoredWorldSettings(world: WorldSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.WORLD_SETTINGS, JSON.stringify(world));
    saveSessionState({ world });
  } catch (err) {
    console.error('Failed to save world settings:', err);
  }
}



