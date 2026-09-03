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
  RotateCcw,
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
  useOpenRouter?: boolean;
  useGemini?: boolean;
  geminiModel?: string;
  useLmStudio?: boolean;
  lmStudioModel?: string;
  onOpenMultiplayer?: () => void;
  isMultiplayerConnected?: boolean;
  isHost?: boolean;
  playerCount?: number;
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
  useOpenRouter = true,
  useGemini = false,
  geminiModel = 'gemini-3.7-flash',
  useLmStudio = false,
  lmStudioModel = '',
  onOpenMultiplayer,
  isMultiplayerConnected = false,
  isHost = false,
  playerCount = 0,
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

  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <header className="flex-shrink-0 border-b border-slate-800/80 bg-slate-950/98 sticky top-0 z-30 px-2 sm:px-4 py-1.5 sm:py-2.5 flex items-center justify-between shadow-md gap-1 sm:gap-2">
      {/* Brand & Campaign Title */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 min-w-0">
        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/40 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-slate-950" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="hidden sm:block font-cinzel text-sm sm:text-lg md:text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 truncate max-w-[170px] sm:max-w-none">
              DnDAIe5
            </h1>
            <span className="hidden sm:inline-block text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
              AI DM & Party
            </span>
            {useLmStudio && !isMobile ? (
              <span
                className="text-[9px] sm:text-[10px] font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1 flex-shrink-0"
                title={`Локальная нейросеть LM Studio (${lmStudioModel || 'Local Model'})`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span>💻 LM Studio<span className="hidden sm:inline"> (Local)</span></span>
              </span>
            ) : useGemini ? (
              <span
                className="text-[9px] sm:text-[10px] font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center gap-1 flex-shrink-0"
                title={`Прямое подключение Gemini API (${geminiModel})`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                <span>♊ Gemini<span className="hidden sm:inline"> 3.7-Flash</span></span>
              </span>
            ) : useOpenRouter ? (
              <span
                className="text-[9px] sm:text-[10px] font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1 flex-shrink-0"
                title={`OpenRouter: ${modelName}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                <span>🌐 OpenRouter</span>
              </span>
            ) : (
              <span
                className="text-[9px] sm:text-[10px] font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-400/40 flex items-center gap-1 flex-shrink-0"
                title="Все провайдеры AI отключены"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span>⚠️ AI Откл.</span>
              </span>
            )}
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
      <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
        {/* Mobile-only Quick Character HP & AC Status (hidden on desktop site and desktop apps) */}
        {isGameStarted && character && (
          <div className="flex md:hidden items-center gap-1.5 sm:gap-2 bg-slate-900/90 px-2 sm:px-2.5 py-1 rounded-xl border border-slate-800 text-[11px] sm:text-xs shadow-inner flex-shrink-0">
            <div className="flex items-center gap-1">
              <Heart className={`w-3.5 h-3.5 ${hpColor} fill-current/20 flex-shrink-0`} />
              <span className={`font-bold ${hpColor}`}>
                {character.currentHp}/{character.maxHp}
              </span>
              {character.tempHp > 0 && (
                <span className="text-cyan-400 text-[10px] font-semibold">(+{character.tempHp})</span>
              )}
            </div>
            <div className="h-3 w-[1px] bg-slate-700 flex-shrink-0" />
            <div className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="font-bold text-slate-200">{character.ac}</span>
            </div>
          </div>
        )}

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
          aria-label={soundEnabled ? 'Выключить звук' : 'Включить звук'}
          className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer flex-shrink-0 ${
            soundEnabled
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* LAN Multiplayer Button */}
        {onOpenMultiplayer && (
          <button
            onClick={onOpenMultiplayer}
            title={
              isMultiplayerConnected
                ? isHost
                  ? `LAN Хост активен (игроков: ${playerCount}) [Alt+M]`
                  : 'Подключен к LAN хосту [Alt+M]'
                : 'Локальный мультиплеер LAN [Alt+M]'
            }
            className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer flex-shrink-0 ${
              isMultiplayerConnected
                ? isHost
                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300 hover:bg-cyan-900/60'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:border-amber-500/40'
            }`}
          >
            <div className="relative">
              <span className="text-base leading-none">👥</span>
              {isMultiplayerConnected && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              )}
            </div>
            <span className="hidden sm:inline">
              {isMultiplayerConnected
                ? isHost
                  ? `LAN Хост (${playerCount})`
                  : 'LAN Игрок'
                : 'LAN Игра'}
            </span>
          </button>
        )}

        <button
          onClick={onOpenDiceRoller}
          title="Бросить дайсы (Dice Tray) [Alt+D]"
          className="hidden sm:flex p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 transition items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer flex-shrink-0"
        >
          <Dices className="w-4 h-4" />
          <span className="hidden sm:inline">Дайсы</span>
        </button>

        {isGameStarted && (
          <button
            onClick={onOpenJournal}
            title="Журнал, Лорбук и Отряд [Alt+J]"
            className="hidden md:flex p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-purple-400 hover:text-purple-300 transition items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer flex-shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Журнал</span>
          </button>
        )}

        {/* Save / Export & Import (Desktop) */}
        {isGameStarted && (
          <>
            <button
              onClick={onExportSave}
              title="Экспорт сохранения в файл (JSON)"
              className="hidden lg:flex p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer flex-shrink-0"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Импорт сохранения из файла (JSON)"
              className="hidden lg:flex p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer flex-shrink-0"
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
          title="Создать нового персонажа / Начать новую кампанию"
          className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-400 transition cursor-pointer flex-shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
        </button>


        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Настройки нейросети, моделей и озвучки [Alt+S]"
          className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 transition cursor-pointer flex-shrink-0"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
