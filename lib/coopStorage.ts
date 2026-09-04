import { CoopSaveSession, WorldSettings } from '@/types/dnd';

const COOP_STORAGE_KEY = 'dnd_coop_saves_v1';

/**
 * Получить список всех кооперативных сессий
 */
export function getCoopSessions(): CoopSaveSession[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COOP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error('Failed to load co-op sessions from localStorage:', err);
    return [];
  }
}

/**
 * Найти кооперативную сессию по ее уникальному ID
 */
export function getCoopSessionById(id: string): CoopSaveSession | null {
  if (!id) return null;
  const sessions = getCoopSessions();
  return sessions.find((s) => s.id === id) || null;
}

/**
 * Сохранить или обновить кооперативную сессию
 */
export function saveCoopSession(session: CoopSaveSession): boolean {
  if (typeof localStorage === 'undefined' || !session || !session.id) return false;
  try {
    const sessions = getCoopSessions();
    const now = Date.now();
    const updatedSession: CoopSaveSession = {
      ...session,
      updatedAt: now,
      inGameDay: session.inGameDay || 1,
      inGameMinutes: session.inGameMinutes !== undefined ? session.inGameMinutes : 480,
      camp_inventory: session.camp_inventory || [],
      unclaimed_loot: session.unclaimed_loot || [],
    };

    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = updatedSession;
    } else {
      sessions.unshift(updatedSession);
    }

    localStorage.setItem(COOP_STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (err) {
    console.error('Failed to save co-op session to localStorage:', err);
    return false;
  }
}

export function deleteCoopSession(id: string): boolean {
  if (typeof localStorage === 'undefined' || !id) return false;
  try {
    const sessions = getCoopSessions();
    const filtered = sessions.filter((s) => s.id !== id);
    localStorage.setItem(COOP_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to delete co-op session from localStorage:', err);
    return false;
  }
}

/**
 * Очистить все кооперативные сессии
 */
export function clearAllCoopSessions(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.removeItem(COOP_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('Failed to clear all co-op sessions:', err);
    return false;
  }
}

/**
 * Экспортировать кооперативную сессию в JSON-строку
 */
export function exportCoopSessionAsJson(id: string): string | null {
  const session = getCoopSessionById(id);
  if (!session) return null;
  try {
    return JSON.stringify(session, null, 2);
  } catch (err) {
    console.error('Failed to serialize co-op session to JSON:', err);
    return null;
  }
}

/**
 * Импортировать кооперативную сессию из JSON-строки
 */
export function importCoopSessionFromJson(jsonString: string): CoopSaveSession | null {
  if (!jsonString || typeof jsonString !== 'string') return null;
  try {
    const parsed = JSON.parse(jsonString.trim());
    if (!parsed || typeof parsed !== 'object' || !parsed.world || !parsed.partyPlayers) {
      console.warn('Invalid co-op session format');
      return null;
    }

    const importedSession: CoopSaveSession = {
      id: parsed.id || `coop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      saveName: parsed.saveName || `Совместная кампания ${new Date().toLocaleDateString('ru-RU')}`,
      createdAt: parsed.createdAt || Date.now(),
      updatedAt: Date.now(),
      world: parsed.world,
      partyPlayers: Array.isArray(parsed.partyPlayers) ? parsed.partyPlayers : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      storySummary: parsed.storySummary || '',
      inGameDay: parsed.inGameDay || 1,
      inGameMinutes: parsed.inGameMinutes !== undefined ? parsed.inGameMinutes : 480,
      inGameTime: parsed.inGameTime || 'День 1 • 08:00',
      partyCompanions: Array.isArray(parsed.partyCompanions) ? parsed.partyCompanions : [],
      journalEntries: Array.isArray(parsed.journalEntries) ? parsed.journalEntries : [],
      camp_inventory: Array.isArray(parsed.camp_inventory) ? parsed.camp_inventory : [],
      unclaimed_loot: Array.isArray(parsed.unclaimed_loot) ? parsed.unclaimed_loot : [],
    };

    saveCoopSession(importedSession);
    return importedSession;
  } catch (err) {
    console.error('Failed to import co-op session from JSON:', err);
    return null;
  }
}

/**
 * Экспортировать кооперативную сессию и скачивать как .json файл
 */
export function exportCoopSessionToFile(session: CoopSaveSession): void {
  if (typeof document === 'undefined' || !session) return;
  try {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const cleanName = (session.saveName || 'coop_campaign').replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_');
    downloadAnchor.setAttribute('download', `dnd_coop_${cleanName}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (err) {
    console.error('Failed to export coop session to file:', err);
  }
}

/**
 * Триггер автосохранения кооператива СТРОГО при Длительном отдыхе (Long Rest)
 * или при наступлении нового игрового дня.
 */
export function triggerRestOrNewDayAutosave(
  session: CoopSaveSession,
  reason: 'long_rest' | 'new_day'
): boolean {
  if (!session || !session.id) return false;
  try {
    const prefix = reason === 'long_rest' ? '💤 [Длит. Отдых]' : '🌅 [Новый День]';
    const cleanBaseName = session.saveName.replace(/^(\[.*?\]|\u{1F4A4}|\u{1F305})\s*/u, '').trim();
    const updatedSession: CoopSaveSession = {
      ...session,
      saveName: `${prefix} ${cleanBaseName || 'Кампания'} (День ${session.inGameDay || 1})`,
      updatedAt: Date.now(),
    };
    return saveCoopSession(updatedSession);
  } catch (err) {
    console.error('Failed to trigger rest/new day coop autosave:', err);
    return false;
  }
}

/**
 * Фабрика новой совместной кампании:
 * Тайм-трекер инициализируется строго: inGameDay = 1, inGameMinutes = 480 (08:00 утра).
 */
export function createNewCoopSession(params: {
  saveName?: string;
  world: WorldSettings;
  partyPlayers: CoopSaveSession['partyPlayers'];
}): CoopSaveSession {
  const id = `coop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultTitle = params.saveName?.trim() || `Кампания: ${params.partyPlayers.map((p) => p.name || p.character?.name || 'Герой').join(' и ')}`;

  const newSession: CoopSaveSession = {
    id,
    saveName: defaultTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    world: params.world,
    partyPlayers: params.partyPlayers,
    history: [],
    storySummary: '',
    inGameDay: 1,
    inGameMinutes: 480, // 08:00 утра
    inGameTime: 'День 1 • 08:00',
    partyCompanions: [],
    journalEntries: [],
    camp_inventory: [],
    unclaimed_loot: [],
  };

  saveCoopSession(newSession);
  return newSession;
}

