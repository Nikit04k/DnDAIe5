'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SaveSlot, GameSessionState, CoopSaveSession, NetworkPlayer } from '@/types/dnd';
import {
  getAllSaveSlots,
  saveCurrentGameToSlot,
  loadGameFromSlot,
  deleteSaveSlot,
  exportSaveSlotToFile,
  importSaveSlotFromFile,
} from '@/lib/storage';
import {
  getCoopSessions,
  saveCoopSession,
  deleteCoopSession,
  exportCoopSessionToFile,
  importCoopSessionFromJson,
} from '@/lib/coopStorage';
import { DIFFICULTY_PROFILES } from '@/lib/difficultySettings';
import {
  Save,
  Download,
  Upload,
  Trash2,
  Play,
  RotateCcw,
  X,
  Clock,
  MapPin,
  Shield,
  Heart,
  Sparkles,
  AlertTriangle,
  Skull,
  FileCheck,
  Users,
  User,
  Package,
  Crown,
} from 'lucide-react';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGameStarted: boolean;
  currentSession: GameSessionState | null;
  onSessionLoaded: (loadedSession: GameSessionState) => void;
  isCoopMode?: boolean;
  coopPlayers?: NetworkPlayer[];
  onCoopSessionLoaded?: (loadedCoopSession: CoopSaveSession) => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  onClose,
  isGameStarted,
  currentSession,
  onSessionLoaded,
  isCoopMode = false,
  coopPlayers = [],
  onCoopSessionLoaded,
}) => {
  const [saveCategory, setSaveCategory] = useState<'solo' | 'coop'>(isCoopMode ? 'coop' : 'solo');
  const [activeTab, setActiveTab] = useState<'load' | 'save'>(isGameStarted ? 'save' : 'load');
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [coopSessions, setCoopSessions] = useState<CoopSaveSession[]>([]);
  const [newSaveName, setNewSaveName] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = () => {
    setSlots(getAllSaveSlots());
    setCoopSessions(getCoopSessions());
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
      setActiveTab(isGameStarted ? 'save' : 'load');
      setSaveCategory(isCoopMode ? 'coop' : 'solo');

      if (isCoopMode && coopPlayers.length > 0) {
        const names = coopPlayers.map((p) => p.name || p.character?.name || 'Герой').join(' и ');
        const timeStr = currentSession?.inGameDay ? `День ${currentSession.inGameDay}` : '';
        setNewSaveName(`Кампания: ${names} — ${currentSession?.currentLocation || 'В пути'} ${timeStr}`.trim());
      } else if (currentSession?.character) {
        const timeStr = currentSession.inGameDay ? `День ${currentSession.inGameDay}` : '';
        setNewSaveName(`${currentSession.character.name} — ${currentSession.currentLocation || 'В пути'} ${timeStr}`.trim());
      } else {
        setNewSaveName('');
      }
      setFeedbackMsg(null);
    }
  }, [isOpen, isGameStarted, currentSession, isCoopMode, coopPlayers]);

  if (!isOpen) return null;

  const currentDiff = currentSession?.world?.difficulty || 'standard';
  const isCurrentHardcore = currentDiff === 'hardcore';
  const hardcoreSlotExists = slots.some((s) => s.id === 'slot_hardcore');

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleCreateSave = (targetSlotId?: string) => {
    if (!currentSession || !currentSession.character) {
      showFeedback('Нет активной игры для сохранения', 'error');
      return;
    }

    if (saveCategory === 'coop') {
      const partyPlayersToSave = coopPlayers.length > 0
        ? coopPlayers.map((p) => ({
            id: p.id,
            name: p.name || p.character?.name || 'Игрок',
            character: p.character,
            isHost: p.isHost,
            color: p.color,
          }))
        : [
            {
              id: 'local_host',
              name: currentSession.character.name,
              character: currentSession.character,
              isHost: true,
            },
          ];

      const newCoop: CoopSaveSession = {
        id: targetSlotId || `coop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        saveName: newSaveName.trim() || `Кампания отряда (${new Date().toLocaleDateString('ru-RU')})`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        world: currentSession.world,
        partyPlayers: partyPlayersToSave,
        history: currentSession.history || [],
        storySummary: currentSession.storySummary || '',
        inGameDay: currentSession.inGameDay || 1,
        inGameMinutes: currentSession.inGameMinutes !== undefined ? currentSession.inGameMinutes : 480,
        inGameTime: currentSession.inGameDay ? `День ${currentSession.inGameDay}` : 'День 1 • 08:00',
        partyCompanions: currentSession.partyCompanions || [],
        journalEntries: currentSession.journalEntries || [],
        camp_inventory: (currentSession as any).camp_inventory || [],
        unclaimed_loot: (currentSession as any).unclaimed_loot || [],
      };

      const ok = saveCoopSession(newCoop);
      if (ok) {
        refreshData();
        showFeedback(`Кооперативная кампания сохранена: "${newCoop.saveName}"`);
      } else {
        showFeedback('Ошибка сохранения кампании', 'error');
      }
      return;
    }

    // Solo save
    const title = newSaveName.trim() || undefined;
    const saved = saveCurrentGameToSlot(targetSlotId, title, false);
    if (saved) {
      refreshData();
      showFeedback(`Игра успешно сохранена: "${saved.name}"`);
    } else {
      showFeedback('Ошибка при сохранении игры', 'error');
    }
  };

  const handleLoadSlot = (slotId: string) => {
    const targetSlot = slots.find((s) => s.id === slotId);
    if (targetSlot?.isDead) {
      alert('Этот персонаж погиб в бою в режиме «Хардкор». Воскресить его нельзя!');
      return;
    }

    const loaded = loadGameFromSlot(slotId);
    if (loaded) {
      onSessionLoaded(loaded);
      onClose();
    } else {
      showFeedback('Не удалось загрузить сохранение', 'error');
    }
  };

  const handleLoadCoopSession = (coop: CoopSaveSession) => {
    if (onCoopSessionLoaded) {
      onCoopSessionLoaded(coop);
      onClose();
      return;
    }

    // Fallback if solo page loaded coop session
    const primaryChar = coop.partyPlayers[0]?.character;
    if (primaryChar) {
      const converted: GameSessionState = {
        id: coop.id,
        createdAt: coop.createdAt,
        character: primaryChar,
        world: coop.world,
        history: coop.history,
        currentLocation: 'Лагерь отряда',
        inGameDay: coop.inGameDay,
        inGameMinutes: coop.inGameMinutes,
        partyCompanions: coop.partyCompanions || [],
        journalEntries: (coop.journalEntries as any) || [],
        suggestedActions: [],
        pendingRoll: null,
        storySummary: coop.storySummary || '',
        lastPlayedAt: Date.now(),
      };
      onSessionLoaded(converted);
      onClose();
    }


  };

  const handleDeleteSlot = (slotId: string, slotName: string) => {
    if (confirm(`Удалить сохранение "${slotName}"?`)) {
      deleteSaveSlot(slotId);
      refreshData();
      showFeedback(`Сохранение "${slotName}" удалено`);
    }
  };

  const handleDeleteCoopSession = (sessionId: string, sessionName: string) => {
    if (confirm(`Удалить кампанию "${sessionName}"?`)) {
      deleteCoopSession(sessionId);
      refreshData();
      showFeedback(`Кампания "${sessionName}" удалена`);
    }
  };

  const handleExportSlot = (slotId: string) => {
    exportSaveSlotToFile(slotId);
  };

  const handleExportCoopSession = (session: CoopSaveSession) => {
    exportCoopSessionToFile(session);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed.partyPlayers && Array.isArray(parsed.partyPlayers)) {
        // Co-op campaign format
        const importedCoop = importCoopSessionFromJson(text);
        if (importedCoop) {
          setSaveCategory('coop');
          refreshData();
          showFeedback(`Кооперативная кампания "${importedCoop.saveName}" успешно импортирована!`);
        } else {
          showFeedback('Ошибка импорта кооперативной кампании', 'error');
        }
      } else {
        // Single player slot format
        const imported = await importSaveSlotFromFile(file);
        setSaveCategory('solo');
        refreshData();
        showFeedback(`Сохранение "${imported.name}" успешно импортировано!`);
      }
    } catch (err: any) {
      showFeedback(`Ошибка импорта: ${err?.message || 'Неверный формат'}`, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg sm:text-xl font-bold text-amber-200">
                Сохранения и Загрузка
              </h2>
              <p className="text-xs text-slate-400">
                Управление одиночными слотами и совместными кампаниями отряда
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Selector: Solo vs Co-op */}
        <div className="flex border-b border-slate-800/60 bg-slate-950/50 px-4 sm:px-6 pt-2">
          <button
            onClick={() => setSaveCategory('solo')}
            className={`py-2 px-3.5 text-xs font-bold rounded-t-xl border-t border-x transition flex items-center gap-2 cursor-pointer ${
              saveCategory === 'solo'
                ? 'bg-slate-900 text-amber-300 border-slate-700/80 shadow-inner'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>👤 Одиночная игра ({slots.length})</span>
          </button>
          <button
            onClick={() => setSaveCategory('coop')}
            className={`py-2 px-3.5 text-xs font-bold rounded-t-xl border-t border-x transition flex items-center gap-2 cursor-pointer ${
              saveCategory === 'coop'
                ? 'bg-slate-900 text-amber-300 border-slate-700/80 shadow-inner'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>👥 Кооператив ({coopSessions.length})</span>
          </button>
        </div>

        {/* Action Tabs & Quick Import Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950 px-4 sm:px-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('load')}
              className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'load'
                  ? 'border-amber-400 text-amber-300 bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Загрузить {saveCategory === 'coop' ? 'кампанию' : 'игру'}</span>
            </button>
            {isGameStarted && (
              <button
                onClick={() => setActiveTab('save')}
                className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'save'
                    ? 'border-amber-400 text-amber-300 bg-slate-900/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Сохранить {saveCategory === 'coop' ? 'кампанию' : 'игру'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
              title="Импортировать сохранение или кампанию из JSON файла"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Импорт JSON</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-all ${
              feedbackMsg.type === 'error'
                ? 'bg-red-500/20 text-red-300 border-b border-red-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/30'
            }`}
          >
            <FileCheck className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: SAVE GAME */}
          {activeTab === 'save' && isGameStarted && (
            <div className="space-y-4">
              {/* Hardcore Ironman Warning (for Solo) */}
              {saveCategory === 'solo' && isCurrentHardcore && (
                <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-red-200">
                  <Skull className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-red-300 mb-0.5">
                      💀 Режим «Хардкор» (Ironman & Пермасмерть)
                    </strong>
                    В режиме хардкора доступен только <strong>ОДИН слот сохранения</strong>, который автоматически перезаписывается. В случае гибели воскресить персонажа нельзя!
                  </div>
                </div>
              )}

              {/* Co-op Saving Info */}
              {saveCategory === 'coop' && (
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-200">
                  <Users className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-amber-300 mb-0.5">
                      👥 Сохранение совместной кампании
                    </strong>
                    Сохраняются все персонажи отряда, лагерный банк, нераспределенный лут, хроника приключения и игровое время.
                  </div>
                </div>
              )}

              {/* New Save Creation Box */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label className="text-[11px] uppercase font-bold text-amber-400 block">
                  {saveCategory === 'coop'
                    ? 'Название сохранения совместной кампании'
                    : isCurrentHardcore
                    ? 'Перезаписать хардкор-слот'
                    : 'Название нового сохранения'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSaveName}
                    onChange={(e) => setNewSaveName(e.target.value)}
                    placeholder={
                      saveCategory === 'coop'
                        ? 'Например: Кампания в Цитадели Теней...'
                        : 'Например: Перед боем с драконом в руинах...'
                    }
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => handleCreateSave()}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5 shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {saveCategory === 'solo' && isCurrentHardcore && hardcoreSlotExists
                        ? 'Перезаписать'
                        : 'Сохранить'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Overwrite Existing Solo Slots */}
              {saveCategory === 'solo' && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block">
                    Или перезапишите существующий слот:
                  </span>
                  {slots.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Слотов пока нет.</p>
                  ) : (
                    <div className="space-y-2">
                      {slots.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2 hover:border-slate-700 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-200 truncate">{s.name}</span>
                              {s.isHardcore && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/20 text-red-300 rounded border border-red-500/30">
                                  💀 Хардкор
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {s.characterName} ({s.characterClass} {s.characterLevel} ур.) • {s.currentLocation}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCreateSave(s.id)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400/50 text-slate-300 hover:text-amber-300 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0"
                          >
                            Перезаписать
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOAD GAME */}
          {activeTab === 'load' && (
            <div className="space-y-3">
              {/* CATEGORY: CO-OP CAMPAIGNS */}
              {saveCategory === 'coop' && (
                <>
                  {coopSessions.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                        <Users className="w-6 h-6 text-amber-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-300">Кооперативных кампаний пока нет</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Откройте «👥 Кооперативное Лобби (LAN)» вверху экрана, начните приключение с друзьями или импортируйте JSON файл кампании.
                      </p>
                    </div>
                  ) : (
                    coopSessions.map((session) => {
                      const dateFormatted = new Date(session.updatedAt || session.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const diffProfile =
                        DIFFICULTY_PROFILES[session.world?.difficulty || 'standard'] || DIFFICULTY_PROFILES.standard;

                      return (
                        <div
                          key={session.id}
                          className="p-4 rounded-2xl border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition flex flex-col gap-3 shadow-md"
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-cinzel font-bold text-sm text-amber-200">
                                {session.saveName}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded border font-bold flex items-center gap-1 ${diffProfile.bgLightClass}`}
                              >
                                <span>{diffProfile.icon}</span>
                                <span>{diffProfile.shortName}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1 text-amber-400">
                                <Clock className="w-3 h-3" />
                                <span>{session.inGameTime || `День ${session.inGameDay || 1}`}</span>
                              </span>
                              <span>{dateFormatted}</span>
                            </div>
                          </div>

                          {/* Party Roster Preview */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                              <Users className="w-3 h-3 text-amber-400" />
                              <span>Состав отряда ({session.partyPlayers?.length || 0} героев):</span>
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {session.partyPlayers?.map((p, idx) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      style={{ borderColor: p.color || '#f59e0b' }}
                                      className="w-7 h-7 rounded-lg bg-slate-950 border flex items-center justify-center font-bold text-xs text-amber-300 shrink-0"
                                    >
                                      {p.name ? p.name.charAt(0).toUpperCase() : 'Г'}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs font-bold text-slate-200 truncate">
                                          {p.name || p.character?.name}
                                        </span>
                                        {p.isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                                      </div>
                                      <p className="text-[10px] text-slate-400 truncate">
                                        {p.character?.class} ({p.character?.level || 1} ур.)
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right text-[10px] text-emerald-400 font-bold shrink-0 flex items-center gap-1">
                                    <Heart className="w-3 h-3 text-red-400 fill-current/30" />
                                    <span>{p.character?.currentHp}/{p.character?.maxHp}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Camp Inventory & Action Buttons */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Package className="w-3.5 h-3.5 text-amber-400" />
                                <span>Лагерный банк: {session.camp_inventory?.length || 0} предм.</span>
                              </span>
                              {session.storySummary && (
                                <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                  {session.storySummary}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => handleExportCoopSession(session)}
                                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                title="Скачать кампанию в файл (JSON)"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCoopSession(session.id, session.saveName)}
                                className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-800/60 text-slate-400 hover:text-red-300 transition cursor-pointer"
                                title="Удалить эту кампанию"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleLoadCoopSession(session)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition flex items-center gap-1.5 shadow-md cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Загрузить кампанию</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* CATEGORY: SOLO SLOTS */}
              {saveCategory === 'solo' && (
                <>
                  {slots.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                        <Save className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-300">Сохранений пока нет</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Создайте нового персонажа и начните игру, либо импортируйте файл сохранения JSON.
                      </p>
                    </div>
                  ) : (
                    slots.map((slot) => {
                      const diffProfile = DIFFICULTY_PROFILES[slot.difficulty] || DIFFICULTY_PROFILES.standard;
                      const dateFormatted = new Date(slot.savedAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isDead = slot.isDead;

                      return (
                        <div
                          key={slot.id}
                          className={`p-4 rounded-2xl border transition relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isDead
                              ? 'bg-red-950/20 border-red-900/60 opacity-85'
                              : slot.isHardcore
                              ? 'bg-red-950/10 border-red-500/30 hover:border-red-400/50'
                              : slot.isAutoSave
                              ? 'bg-cyan-950/15 border-cyan-500/30 hover:border-cyan-400/50'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Left info */}
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-cinzel font-bold text-sm text-amber-200 truncate">
                                {slot.name}
                              </span>
                              {slot.isAutoSave && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                                  ⚡ Авто
                                </span>
                              )}
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded border font-bold flex items-center gap-1 ${diffProfile.bgLightClass}`}
                              >
                                <span>{diffProfile.icon}</span>
                                <span>{diffProfile.shortName}</span>
                              </span>
                              {isDead && (
                                <span className="text-[9px] px-2 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500 font-bold flex items-center gap-1">
                                  <Skull className="w-3 h-3 text-red-400" />
                                  <span>ПОГИБ В БОЮ (Воскресить нельзя)</span>
                                </span>
                              )}
                            </div>

                            {/* Character Vitals */}
                            <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                              <strong className="text-slate-100 font-semibold">
                                {slot.characterName}
                              </strong>
                              <span className="text-slate-400">
                                {slot.characterClass} • {slot.characterRace} ({slot.characterLevel} ур.)
                              </span>
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Heart className="w-3 h-3 text-red-400 fill-current/30" />
                                <span>{slot.characterHp}/{slot.characterMaxHp} HP</span>
                              </span>
                              <span className="flex items-center gap-1 text-blue-400">
                                <Shield className="w-3 h-3" />
                                <span>AC {slot.characterAc}</span>
                              </span>
                            </div>

                            {/* Meta: Location & Time */}
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1 text-amber-400/90 truncate max-w-[200px]">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span>{slot.currentLocation}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>{slot.inGameTime}</span>
                              </span>
                              <span className="text-slate-500">
                                {dateFormatted}
                              </span>
                            </div>

                            {isDead && slot.deathReason && (
                              <p className="text-[11px] text-red-300 italic pt-0.5">
                                Причина гибели: {slot.deathReason}
                              </p>
                            )}
                          </div>

                          {/* Right Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              onClick={() => handleExportSlot(slot.id)}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                              title="Скачать файл сохранения (JSON)"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(slot.id, slot.name)}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-800/60 text-slate-400 hover:text-red-300 transition cursor-pointer"
                              title="Удалить это сохранение"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleLoadSlot(slot.id)}
                              disabled={isDead}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                                isDead
                                  ? 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 cursor-pointer'
                              }`}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{isDead ? 'Погиб' : 'Загрузить'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>Все сохранения хранятся локально в вашем браузере</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
