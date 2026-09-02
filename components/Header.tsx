'use client';

import React from 'react';
import {
  Dices,
  Volume2,
  VolumeX,
  Settings,
  BookOpen,
  Download,
  Upload,
  PlusCircle,
  Shield,
  Heart,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { CharacterSheet } from '@/types/dnd';

interface HeaderProps {
  character: CharacterSheet | null;
  currentLocation: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenDiceRoller: () => void;
  onOpenJournal: () => void;
  onOpenSettings: () => void;
  onNewAdventure: () => void;
  onExportSave: () => void;
  onImportSave: (file: File) => void;
  isGameStarted: boolean;
  modelName: string;
  useGemini?: boolean;
  geminiModel?: string;
  useLmStudio?: boolean;
  lmStudioModel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  character,
  currentLocation,
  soundEnabled,
  onToggleSound,
  onOpenDiceRoller,
  onOpenJournal,
  onOpenSettings,
  onNewAdventure,
  onExportSave,
  onImportSave,
  isGameStarted,
  modelName,
  useGemini = false,
  geminiModel = 'gemini-3.6-flash',
  useLmStudio = false,
  lmStudioModel = '',
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSave(file);
    }
  };

  const hpPercent = character ? Math.max(0, Math.min(100, (character.currentHp / (character.maxHp || 1)) * 100)) : 100;
  const hpColor = hpPercent > 50 ? 'text-emerald-400' : hpPercent > 20 ? 'text-amber-400' : 'text-red-400';
  const hpBg = hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/98 sticky top-0 z-30 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shadow-md">
      {/* Brand & Campaign Title */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/40 flex-shrink-0">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="font-cinzel text-sm sm:text-lg md:text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 truncate max-w-[170px] sm:max-w-none">
              DnDAIe5
            </h1>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
              AI DM & Party
            </span>
            {useLmStudio ? (
              <span
                className="text-[9px] sm:text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1 flex-shrink-0"
                title={`Локальная нейросеть LM Studio (${lmStudioModel || 'Local Model'})`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span>💻 LM Studio (Local)</span>
              </span>
            ) : useGemini ? (
              <span
                className="text-[9px] sm:text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center gap-1 flex-shrink-0"
                title={`Прямое подключение Gemini API (${geminiModel})`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                <span>♊ Gemini 3.7-Flash</span>
              </span>
            ) : null}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-sans hidden sm:block">
            5th Edition AI Adventure (Solo & Co-op)
          </p>
        </div>
      </div>

      {/* Current Location Badge */}
      {isGameStarted && currentLocation && (
        <div
          className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/95 border border-amber-500/40 text-xs text-amber-200 shadow-md shadow-amber-950/20 max-w-md lg:max-w-xl xl:max-w-2xl mx-2 min-w-0 flex-shrink"
          title={`Текущая локация: ${currentLocation}`}
        >
          <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="font-semibold text-slate-100 truncate">{currentLocation}</span>
        </div>
      )}

      {/* Action Toolbar & Character Quick Badge */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Mobile / Desktop Quick Character HP & AC Status */}
        {isGameStarted && character && (
          <div className="flex items-center gap-2 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 text-xs shadow-inner">
            <div className="flex items-center gap-1.5">
              <Heart className={`w-3.5 h-3.5 ${hpColor} fill-current/20`} />
              <span className={`font-bold ${hpColor}`}>
                {character.currentHp}/{character.maxHp}
              </span>
              {character.tempHp > 0 && (
                <span className="text-cyan-400 text-[10px] font-semibold">(+{character.tempHp})</span>
              )}
            </div>
            <div className="h-3 w-[1px] bg-slate-700" />
            <div className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-bold text-slate-200">{character.ac}</span>
            </div>
          </div>
        )}

        <button
          onClick={onOpenDiceRoller}
          title="Бросить дайсы (Dice Tray)"
          className="hidden sm:flex p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 transition items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
        >
          <Dices className="w-4 h-4" />
          <span className="hidden sm:inline">Дайсы</span>
        </button>

        {isGameStarted && (
          <button
            onClick={onOpenJournal}
            title="Журнал и заметки"
            className="hidden md:flex p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-purple-400 hover:text-purple-300 transition items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Журнал</span>
          </button>
        )}

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            soundEnabled
              ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Save / Export & Import (Desktop) */}
        {isGameStarted && (
          <>
            <button
              onClick={onExportSave}
              title="Экспорт (JSON)"
              className="hidden lg:flex p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Импорт (JSON)"
              className="hidden lg:flex p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </>
        )}

        {/* New Game */}
        <button
          onClick={onNewAdventure}
          title="Новый персонаж / Новая игра"
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-400 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Настройки кампании и ИИ"
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-400 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
