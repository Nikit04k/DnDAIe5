'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SaveSlot, GameSessionState } from '@/types/dnd';
import {
  getAllSaveSlots,
  saveCurrentGameToSlot,
  loadGameFromSlot,
  deleteSaveSlot,
  exportSaveSlotToFile,
  importSaveSlotFromFile,
} from '@/lib/storage';
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
} from 'lucide-react';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGameStarted: boolean;
  currentSession: GameSessionState | null;
  onSessionLoaded: (loadedSession: GameSessionState) => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  onClose,
  isGameStarted,
  currentSession,
  onSessionLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<'load' | 'save'>(isGameStarted ? 'save' : 'load');
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [newSaveName, setNewSaveName] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSlots = () => {
    setSlots(getAllSaveSlots());
  };

  useEffect(() => {
    if (isOpen) {
      refreshSlots();
      setActiveTab(isGameStarted ? 'save' : 'load');
      if (currentSession?.character) {
        const timeStr = currentSession.inGameDay ? `День ${currentSession.inGameDay}` : '';
        setNewSaveName(`${currentSession.character.name} — ${currentSession.currentLocation || 'В пути'} ${timeStr}`.trim());
      } else {
        setNewSaveName('');
      }
      setFeedbackMsg(null);
    }
  }, [isOpen, isGameStarted, currentSession]);

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

    const title = newSaveName.trim() || undefined;
    const saved = saveCurrentGameToSlot(targetSlotId, title, false);
    if (saved) {
      refreshSlots();
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

  const handleDeleteSlot = (slotId: string, slotName: string) => {
    if (confirm(`Удалить сохранение "${slotName}"?`)) {
      deleteSaveSlot(slotId);
      refreshSlots();
      showFeedback(`Сохранение "${slotName}" удалено`);
    }
  };

  const handleExportSlot = (slotId: string) => {
    exportSaveSlotToFile(slotId);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importSaveSlotFromFile(file);
      refreshSlots();
      showFeedback(`Сохранение "${imported.name}" успешно импортировано!`);
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
                Управление прогрессом, слотами кампании и резервными копиями
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

        {/* Tabs & Quick Import Bar */}
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
              <span>Загрузить игру ({slots.length})</span>
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
                <span>Сохранить игру</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
              title="Импортировать сохранение из JSON файла"
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
              {/* Hardcore Ironman Warning */}
              {isCurrentHardcore && (
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

              {/* New Save Creation Box */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label className="text-[11px] uppercase font-bold text-amber-400 block">
                  {isCurrentHardcore ? 'Перезаписать хардкор-слот' : 'Название нового сохранения'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSaveName}
                    onChange={(e) => setNewSaveName(e.target.value)}
                    placeholder="Например: Перед боем с драконом в руинах..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => handleCreateSave()}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5 shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isCurrentHardcore && hardcoreSlotExists ? 'Перезаписать' : 'Сохранить'}</span>
                  </button>
                </div>
              </div>

              {/* Overwrite Existing Slots List */}
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
            </div>
          )}

          {/* TAB 2: LOAD GAME */}
          {activeTab === 'load' && (
            <div className="space-y-3">
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
