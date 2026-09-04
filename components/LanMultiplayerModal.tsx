'use client';

import React, { useState, useEffect } from 'react';
import { CharacterSheet, NetworkPlayer, GameDifficulty, CoopSaveSession } from '@/types/dnd';
import {
  Wifi,
  Users,
  Radio,
  Server,
  Copy,
  Check,
  Shield,
  Heart,
  Crown,
  X,
  Play,
  Activity,
  ArrowRight,
  FolderOpen,
  UserPlus,
  Sparkles,
  Swords,
  CheckCircle2,
  Clock,
  Skull,
  BookOpen,
  Package,
  Trash2,
} from 'lucide-react';
import { CHARACTER_PRESETS } from '@/lib/dndRules';
import { getAllSavedCharacters, SavedCharacterEntry } from '@/lib/storage';
import { getCoopSessions, deleteCoopSession } from '@/lib/coopStorage';
import { DIFFICULTY_PROFILES, DIFFICULTY_ORDER } from '@/lib/difficultySettings';
import { lanSocket } from '@/lib/multiplayerSocket';

interface LanMultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  isConnected: boolean;
  lanIp: string;
  players: NetworkPlayer[];
  currentCharacter: CharacterSheet | null;
  ping: number;
  onStartHost: (port?: number) => void;
  onConnectClient: (hostAddress: string, character: CharacterSheet) => void;
  onDisconnect: () => void;
  onSelectCharacter?: (character: CharacterSheet) => void;
  onOpenCharacterCreator?: () => void;
  onStartGame?: (difficulty: GameDifficulty, campaignSession?: CoopSaveSession | null) => void;
  currentDifficulty?: GameDifficulty;
  onChangeDifficulty?: (difficulty: GameDifficulty) => void;
}


export const LanMultiplayerModal: React.FC<LanMultiplayerModalProps> = ({
  isOpen,
  onClose,
  isHost,
  isConnected,
  lanIp,
  players,
  currentCharacter,
  ping,
  onStartHost,
  onConnectClient,
  onDisconnect,
  onSelectCharacter,
  onOpenCharacterCreator,
  onStartGame,
  currentDifficulty = 'standard',
  onChangeDifficulty,
}) => {
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [hostInput, setHostInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [detectedLanIp, setDetectedLanIp] = useState<string>(lanIp || '127.0.0.1');
  const [port] = useState<number>(3000);

  // Character selection mode in lobby: 'saves' | 'presets'
  const [charSourceTab, setCharSourceTab] = useState<'saves' | 'presets'>('saves');
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterEntry[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterSheet | null>(currentCharacter);
  const [isLocalReady, setIsLocalReady] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<GameDifficulty>(currentDifficulty);

  // Campaign source mode in lobby for host: 'new' | 'continue'
  const [campaignMode, setCampaignMode] = useState<'new' | 'continue'>('new');
  const [coopSessions, setCoopSessions] = useState<CoopSaveSession[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CoopSaveSession | null>(null);

  // Fetch host LAN IP from API and load saved campaigns
  useEffect(() => {
    if (isOpen) {
      fetch('/api/lan/info')
        .then((res) => res.json())
        .then((data) => {
          if (data.primaryLanIp) {
            setDetectedLanIp(data.primaryLanIp);
            if (!hostInput) {
              setHostInput(`${data.primaryLanIp}:3000`);
            }
          }
        })
        .catch(() => {});

      // Refresh saved characters and coop campaigns
      const saved = getAllSavedCharacters();
      setSavedCharacters(saved);

      const campaigns = getCoopSessions();
      setCoopSessions(campaigns);
      if (campaigns.length > 0 && !selectedCampaign) {
        setSelectedCampaign(campaigns[0]);
      }

      if (currentCharacter) {
        setSelectedCharacter(currentCharacter);
      } else if (saved.length > 0 && !saved[0].isDead) {
        setSelectedCharacter(saved[0].character);
      } else {
        // Fallback to first preset
        const p = CHARACTER_PRESETS[0];
        setSelectedCharacter(presetToSheet(p));
      }
    }
  }, [isOpen, currentCharacter]);

  // Sync difficulty with props
  useEffect(() => {
    if (currentDifficulty) {
      setSelectedDifficulty(currentDifficulty);
    }
  }, [currentDifficulty]);

  if (!isOpen) return null;

  const fullShareUrl = `http://${detectedLanIp}:${port}`;

  // Ready Check calculation
  const totalPlayers = players.length;
  const readyCount = players.filter((p) => (p.isHost ? isLocalReady : p.isReady)).length;
  const isAllReady = totalPlayers > 0 && players.every((p) => (p.isHost ? isLocalReady : p.isReady));

  function presetToSheet(p: any): CharacterSheet {
    return {
      name: p.name,
      class: p.class,
      race: p.race,
      background: p.background,
      level: p.level || 1,
      maxHp: p.maxHp || 12,
      currentHp: p.maxHp || 12,
      tempHp: 0,
      ac: p.ac || 14,
      speed: p.speed || 30,
      proficiencyBonus: 2,
      stats: p.stats || { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
      savingThrowProficiencies: p.savingThrowProficiencies || ['str', 'con'],
      skillProficiencies: p.skillProficiencies || ['Athletics'],
      inventory: p.inventory || [],
      equippedItems: p.equippedItems || [],
      gold: p.gold || 15,
      bio: p.bio || '',
    };
  }

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePickCharacter = (char: CharacterSheet) => {
    setSelectedCharacter(char);
    if (onSelectCharacter) onSelectCharacter(char);
    if (isConnected) {
      lanSocket.updateCharacter(char);
    }
  };

  const handleToggleReady = () => {
    const next = !isLocalReady;
    setIsLocalReady(next);
    lanSocket.setReady(next);
  };

  const handleDifficultyChange = (diff: GameDifficulty) => {
    setSelectedDifficulty(diff);
    if (onChangeDifficulty) onChangeDifficulty(diff);
    if (isHost && isConnected) {
      lanSocket.updateLobbySettings(diff);
    }
  };

  const handleStartGameClick = () => {
    if (!isAllReady && isHost) {
      return;
    }
    const chosenCampaign = campaignMode === 'continue' ? selectedCampaign : null;
    if (onStartGame) {
      onStartGame(selectedDifficulty, chosenCampaign);
    } else {
      lanSocket.startGame(selectedDifficulty, chosenCampaign?.world);
      onClose();
    }
  };

  const handleJoinClick = () => {
    if (!hostInput.trim() || !selectedCharacter) return;
    onConnectClient(hostInput.trim(), selectedCharacter);
  };

  const diffProfile = DIFFICULTY_PROFILES[selectedDifficulty] || DIFFICULTY_PROFILES.standard;


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg sm:text-xl font-bold text-amber-200">
                Кооперативное Лобби (LAN)
              </h2>
              <p className="text-xs text-slate-400">
                Совместная ролевая игра D&D 5e с друзьями по локальной сети
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

        {/* Top Mode Tabs: Host or Join (if not connected yet) */}
        {!isConnected && (
          <div className="flex border-b border-slate-800/80 bg-slate-950 px-4 sm:px-6">
            <button
              onClick={() => setActiveTab('host')}
              className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'host'
                  ? 'border-amber-400 text-amber-300 bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Создать лобби (Хост)</span>
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'join'
                  ? 'border-amber-400 text-amber-300 bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wifi className="w-4 h-4" />
              <span>Подключиться к другу (Клиент)</span>
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* SECTION 1: CHARACTER PICKER (Choose from saves, create new, or presets) */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs uppercase font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ваш герой в лобби:</span>
              </span>

              {/* Character selection buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCharSourceTab('saves')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                    charSourceTab === 'saves'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Из сохранений ({savedCharacters.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCharSourceTab('presets')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                    charSourceTab === 'presets'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Шаблоны</span>
                </button>
                {onOpenCharacterCreator && (
                  <button
                    type="button"
                    onClick={onOpenCharacterCreator}
                    className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>➕ Создать нового</span>
                  </button>
                )}
              </div>
            </div>

            {/* Currently Selected Character Card */}
            {selectedCharacter ? (
              <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center font-bold text-base text-amber-300 shrink-0">
                    {selectedCharacter.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-slate-100 font-bold truncate">
                        {selectedCharacter.name}
                      </strong>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                        {selectedCharacter.class} {selectedCharacter.level || 1} ур.
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {selectedCharacter.race || 'Человек'}
                      {selectedCharacter.equippedItems && selectedCharacter.equippedItems.length > 0
                        ? ` • 🛡️ ${selectedCharacter.equippedItems.slice(0, 2).join(', ')}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 justify-end">
                    <Heart className="w-3.5 h-3.5 text-red-400 fill-current/30" />
                    <span>{selectedCharacter.currentHp}/{selectedCharacter.maxHp} HP</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-blue-400 justify-end">
                    <Shield className="w-3.5 h-3.5" />
                    <span>AC {selectedCharacter.ac || 10}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                Герой не выбран. Выберите персонажа из списка ниже или создайте нового.
              </div>
            )}

            {/* List of Characters from Saves or Presets */}
            {charSourceTab === 'saves' && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Выберите персонажа из сохранений:
                </span>
                {savedCharacters.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-2 bg-slate-900/50 rounded-lg">
                    Нет сохраненных персонажей. Нажмите «➕ Создать нового» или выберите шаблон.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {savedCharacters.map((entry, idx) => {
                      const c = entry.character;
                      const isSelected = selectedCharacter?.name === c.name && selectedCharacter?.class === c.class;
                      const isDead = entry.isDead;

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isDead}
                          onClick={() => handlePickCharacter(c)}
                          className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex items-center justify-between gap-2 ${
                            isDead
                              ? 'bg-red-950/20 border-red-900/50 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                              : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate text-slate-100">{c.name}</span>
                              {isDead && (
                                <span className="text-[8px] px-1 py-0.2 bg-red-600 text-white rounded font-bold">
                                  ПОГИБ
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {c.class} ({c.race || 'Человек'}) • {entry.source}
                            </div>
                          </div>
                          <div className="text-right text-[10px] text-slate-400 shrink-0">
                            <span className="text-emerald-400">{c.currentHp} HP</span> • AC {c.ac || 10}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {charSourceTab === 'presets' && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Выберите готовый шаблон D&D 5e:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {CHARACTER_PRESETS.map((p) => {
                    const isSelected = selectedCharacter?.name === p.name;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePickCharacter(presetToSheet(p))}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                            : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{p.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {p.class} • {p.race}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: HOST SETUP (If not connected and on host tab) */}
          {!isConnected && activeTab === 'host' && (
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Ваш локальный сетевой адрес (LAN IP):</span>
                </span>
                <span className="text-xs font-mono text-slate-400">Порт: {port}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs sm:text-sm text-emerald-400 flex items-center justify-between">
                  <span>{fullShareUrl}</span>
                  <span className="text-xs text-slate-500 font-sans">LAN IPv4</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </div>

              <button
                onClick={() => onStartHost(port)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Открыть лобби для друзей</span>
              </button>
            </div>
          )}

          {/* SECTION 3: JOIN SETUP (If not connected and on join tab) */}
          {!isConnected && activeTab === 'join' && (
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-amber-400" />
                  <span>IP-адрес хоста:</span>
                </label>
                <input
                  type="text"
                  placeholder="192.168.1.50:3000"
                  value={hostInput}
                  onChange={(e) => setHostInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={handleJoinClick}
                disabled={!hostInput.trim() || !selectedCharacter}
                className={`w-full py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                  hostInput.trim() && selectedCharacter
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <ArrowRight className="w-4 h-4" />
                <span>Подключиться к лобби хоста</span>
              </button>
            </div>
          )}

          {/* SECTION 4: PRE-GAME LOBBY ROOM (Active when connected) */}
          {isConnected && (
            <div className="space-y-4">
              {/* Host Settings: Campaign Mode & Difficulty Selection */}
              {isHost ? (
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3.5">
                  {/* Mode switch: New Campaign vs Continue Saved Campaign */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Режим кампании:</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Начните с чистого листа или продолжите историю
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCampaignMode('new')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                          campaignMode === 'new'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50 shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>✨ Новая кампания</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCampaignMode('continue')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                          campaignMode === 'continue'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50 shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>📂 Продолжить ({coopSessions.length})</span>
                      </button>
                    </div>

                    {/* Saved Campaigns Picker */}
                    {campaignMode === 'continue' && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Выберите сохраненную кампанию для отряда:
                        </span>
                        {coopSessions.length === 0 ? (
                          <p className="text-xs text-slate-500 italic p-2 bg-slate-900/50 rounded-lg">
                            Нет сохраненных кампаний. Начните новую или импортируйте файл в меню сохранений.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                            {coopSessions.map((camp) => {
                              const isSelected = selectedCampaign?.id === camp.id;
                              return (
                                <div
                                  key={camp.id}
                                  className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                                    isSelected
                                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow-md'
                                      : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCampaign(camp)}
                                    className="flex-1 min-w-0 text-left cursor-pointer"
                                  >
                                    <div className="text-xs font-bold truncate text-slate-100">{camp.saveName}</div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      👥 {camp.partyPlayers?.map((p) => p.name || p.character?.name).join(', ')} • ⏳ {camp.inGameTime || `День ${camp.inGameDay || 1}`}
                                    </div>
                                  </button>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right text-[10px] text-amber-400 font-bold hidden sm:block">
                                      {camp.camp_inventory?.length || 0} предм.
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Удалить сохраненную кампанию "${camp.saveName}"?`)) {
                                          deleteCoopSession(camp.id);
                                          const updated = getCoopSessions();
                                          setCoopSessions(updated);
                                          if (selectedCampaign?.id === camp.id) {
                                            setSelectedCampaign(updated[0] || null);
                                          }
                                        }
                                      }}
                                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-950/80 border border-slate-800 hover:border-red-600/60 text-slate-400 hover:text-red-400 transition cursor-pointer"
                                      title="Удалить кампанию"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Difficulty Selection */}
                  <div className="space-y-2 pt-1 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold text-amber-400 flex items-center gap-1.5">
                        <Swords className="w-3.5 h-3.5" />
                        <span>Сложность кампании для отряда:</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Определяет лут, врагов и правила жизни
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {DIFFICULTY_ORDER.map((diffKey) => {
                        const prof = DIFFICULTY_PROFILES[diffKey];
                        const isSelected = selectedDifficulty === diffKey;
                        return (
                          <button
                            key={diffKey}
                            type="button"
                            onClick={() => handleDifficultyChange(diffKey)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? `${prof.borderClass} ring-1 ring-amber-400/50 shadow-md ${prof.bgLightClass}`
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-cinzel font-bold text-xs flex items-center gap-1.5 text-slate-100">
                                <span>{prof.icon}</span>
                                <span>{prof.name}</span>
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                isSelected ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {prof.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight">
                              {prof.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* Client sees host selected difficulty */
                <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${diffProfile.bgLightClass} ${diffProfile.borderClass}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{diffProfile.icon}</span>
                    <div>
                      <span className="text-xs font-bold text-slate-100 block">
                        Сложность кампании: {diffProfile.name}
                      </span>
                      <span className="text-[10px] text-slate-300">
                        {diffProfile.description}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-900 text-amber-300 border border-slate-700 shrink-0">
                    {diffProfile.badge}
                  </span>
                </div>
              )}

              {/* Connected Players Roster */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Отряд в лобби ({players.length} игроков)</span>
                  </h3>
                  {ping > 0 && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{ping} ms</span>
                    </span>
                  )}
                </div>

                {players.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                    Ожидание подключения игроков...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {players.map((p) => {
                      const c = p.character;
                      const ready = p.isReady;

                      return (
                        <div
                          key={p.id}
                          className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 shadow-md"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              style={{ borderColor: p.color || '#f59e0b' }}
                              className="w-9 h-9 rounded-xl bg-slate-900 border-2 flex items-center justify-center font-bold text-xs text-slate-200 shrink-0"
                            >
                              {p.name ? p.name.charAt(0).toUpperCase() : 'Г'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-100 truncate">
                                  {p.name || c?.name || 'Герой'}
                                </span>
                                {p.isHost && (
                                  <span title="Хост сессии">
                                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">
                                {c?.class || 'Воин'} • {c?.race || 'Человек'} ({c?.level || 1} ур.)
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                                ready
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {ready ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>ГОТОВ</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 animate-spin" />
                                  <span>ВЫБИРАЕТ</span>
                                </>
                              )}
                            </span>
                            {c && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {c.currentHp}/{c.maxHp} HP • AC {c.ac}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ready check button for client / host */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <button
                  onClick={handleToggleReady}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    isLocalReady
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{isLocalReady ? '✅ Вы готовы к бою' : '⏳ Нажмите «Готов»'}</span>
                </button>

                {isHost && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={handleStartGameClick}
                      disabled={!isAllReady}
                      className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-cinzel font-extrabold flex items-center justify-center gap-2 transition shadow-lg ${
                        isAllReady
                          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/30 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/80 cursor-not-allowed'
                      }`}
                    >
                      <Swords className="w-4 h-4" />
                      <span>
                        {isAllReady
                          ? `⚔️ Начать приключение (${readyCount}/${totalPlayers} готовы)`
                          : `⏳ Ожидание игроков (${readyCount} из ${totalPlayers} готовы)`}
                      </span>
                    </button>
                    {!isAllReady && (
                      <span className="text-[10px] text-amber-400/90 font-medium text-center sm:text-right">
                        Все подключенные игроки должны нажать «Готов»
                      </span>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 text-xs font-bold transition cursor-pointer"
            >
              Отключиться от лобби
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              Подключение по одной сети Wi-Fi или LAN
            </span>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
