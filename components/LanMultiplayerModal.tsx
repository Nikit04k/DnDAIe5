'use client';

import React, { useState, useEffect } from 'react';
import { CharacterSheet, NetworkPlayer } from '@/types/dnd';
import {
  Wifi,
  Users,
  Radio,
  Server,
  Copy,
  Check,
  Shield,
  Heart,
  Sparkles,
  Crown,
  AlertCircle,
  RefreshCw,
  X,
  Play,
  Share2,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { CHARACTER_PRESETS } from '@/lib/dndRules';

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
}) => {
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [hostInput, setHostInput] = useState('');
  const [selectedCharPreset, setSelectedCharPreset] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [detectedLanIp, setDetectedLanIp] = useState<string>(lanIp || '127.0.0.1');
  const [port, setPort] = useState<number>(3000);
  const [loadingIp, setLoadingIp] = useState(false);

  // Fetch host LAN IP from API
  useEffect(() => {
    if (isOpen) {
      setLoadingIp(true);
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
        .catch(() => {})
        .finally(() => setLoadingIp(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fullShareUrl = `http://${detectedLanIp}:${port}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleJoinClick = () => {
    if (!hostInput.trim()) return;

    let characterToUse: CharacterSheet;
    if (selectedCharPreset) {
      const preset = CHARACTER_PRESETS.find((p) => p.id === selectedCharPreset);
      if (preset) {
        characterToUse = {
          name: preset.name,
          class: preset.class,
          race: preset.race,
          background: preset.background,
          level: preset.level,
          maxHp: preset.maxHp,
          currentHp: preset.maxHp,
          tempHp: 0,
          ac: preset.ac,
          speed: preset.speed,
          proficiencyBonus: 2,
          stats: preset.stats,
          savingThrowProficiencies: preset.savingThrowProficiencies,
          skillProficiencies: preset.skillProficiencies,
          inventory: preset.inventory,
          equippedItems: preset.equippedItems,
          gold: preset.gold,
          bio: preset.bio,
        };
      } else {
        characterToUse = currentCharacter || {
          name: 'Игрок',
          class: 'Воин',
          race: 'Человек',
          level: 1,
          maxHp: 12,
          currentHp: 12,
          tempHp: 0,
          ac: 15,
          speed: 30,
          proficiencyBonus: 2,
          stats: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
          savingThrowProficiencies: ['str', 'con'],
          skillProficiencies: ['Athletics', 'Perception'],
          inventory: [],
          gold: 15,
        };
      }
    } else if (currentCharacter) {
      characterToUse = currentCharacter;
    } else {
      const preset = CHARACTER_PRESETS[0];
      characterToUse = {
        name: preset.name,
        class: preset.class,
        race: preset.race,
        background: preset.background,
        level: preset.level,
        maxHp: preset.maxHp,
        currentHp: preset.maxHp,
        tempHp: 0,
        ac: preset.ac,
        speed: preset.speed,
        proficiencyBonus: 2,
        stats: preset.stats,
        savingThrowProficiencies: preset.savingThrowProficiencies,
        skillProficiencies: preset.skillProficiencies,
        inventory: preset.inventory,
        equippedItems: preset.equippedItems,
        gold: preset.gold,
        bio: preset.bio,
      };
    }

    onConnectClient(hostInput, characterToUse);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92dvh] overflow-hidden shadow-2xl flex flex-col relative my-auto">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-5 border-b border-slate-800/80 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10 shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-cinzel text-base sm:text-xl font-bold text-slate-100 flex items-center gap-1.5 sm:gap-2">
                <span>Локальный мультиплеер LAN</span>
                <span className="text-[9px] sm:text-[10px] font-sans font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hidden sm:inline">
                  Host & Client
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Кооперативная D&D 5e сессия с одного Wi-Fi роутера
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('host')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer ${
              activeTab === 'host'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Хост игры (Мастер)</span>
            {isHost && isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer ${
              activeTab === 'join'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Подключиться (Игрок)</span>
            {!isHost && isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
          {activeTab === 'host' ? (
            /* ================= HOST TAB ================= */
            <div className="space-y-4 sm:space-y-6">
              {/* LAN Connection Address Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <span>Адрес для подключения друзей в LAN</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Сервер готов к подключениям
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 font-mono text-sm sm:text-base text-amber-300 flex items-center justify-between select-all">
                    <span>{fullShareUrl}</span>
                    <span className="text-xs text-slate-500 font-sans">LAN IPv4</span>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Другие игроки на своих смартфонах, ноутбуках или ПК (подключенных к тому же Wi-Fi роутеру) могут открыть браузер и перейти по ссылке выше.
                </p>
              </div>

              {/* Connected Players Roster */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Подключенные игроки в группе ({players.length})</span>
                  </h3>
                  {ping > 0 && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{ping} ms</span>
                    </span>
                  )}
                </div>

                {players.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      Пока никто не подключился. Отправьте адрес друзьям в локальной сети!
                    </p>
                    {currentCharacter && (
                      <p className="text-xs text-amber-400/80 font-medium">
                        Вы играете за: {currentCharacter.name} ({currentCharacter.class})
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                    {players.map((p) => {
                      const c = p.character;
                      const hpPct = c ? Math.max(0, Math.min(100, (c.currentHp / (c.maxHp || 1)) * 100)) : 100;
                      return (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 shadow-md"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              style={{ borderColor: p.color || '#f59e0b' }}
                              className="w-10 h-10 rounded-xl bg-slate-900 border-2 flex items-center justify-center font-bold text-sm text-slate-200 shadow-inner flex-shrink-0"
                            >
                              {p.name ? p.name.charAt(0).toUpperCase() : 'Г'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                                  {p.name || c?.name || 'Герой'}
                                </span>
                                {p.isHost && (
                                  <span title="Хост сессии">
                                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">
                                {c?.class || 'Персонаж'} • {c?.race || 'Раса'} ({c?.level || 1} ур.)
                              </p>
                            </div>
                          </div>

                          {c && (
                            <div className="text-right flex-shrink-0">
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 justify-end">
                                <Heart className="w-3 h-3 text-red-400 fill-current/30" />
                                <span>
                                  {c.currentHp}/{c.maxHp}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 justify-end">
                                <Shield className="w-3 h-3 text-blue-400" />
                                <span>AC {c.ac}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Host Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                {isConnected ? (
                  <button
                    onClick={onDisconnect}
                    className="px-4 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 text-xs font-bold transition cursor-pointer"
                  >
                    Остановить LAN сессию
                  </button>
                ) : (
                  <button
                    onClick={() => onStartHost(port)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Активировать LAN хост</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : (
            /* ================= JOIN TAB ================= */
            <div className="space-y-6">
              {/* Host IP Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-amber-400" />
                  <span>IP:Port хоста в локальной сети</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hostInput}
                    onChange={(e) => setHostInput(e.target.value)}
                    placeholder="Например: 192.168.1.105:3000 или localhost:3000"
                    className="flex-1 bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-slate-100 font-mono placeholder:text-slate-600 outline-none transition"
                  />
                  <button
                    onClick={() => setHostInput(typeof window !== 'undefined' ? window.location.host : 'localhost:3000')}
                    className="px-3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                    title="Использовать текущий хост браузера"
                  >
                    Этот ПК
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Узнайте IP-адрес у создателя игры (хоста) и введите его в поле выше.
                </p>
              </div>

              {/* Character Selection for Joining */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Выберите персонажа для входа в игру</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {currentCharacter && (
                    <button
                      onClick={() => setSelectedCharPreset('')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        selectedCharPreset === ''
                          ? 'bg-amber-500/20 border-amber-500/60 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs text-amber-300 truncate">
                        {currentCharacter.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {currentCharacter.class} ({currentCharacter.race})
                      </div>
                      <div className="text-[9px] text-emerald-400 font-semibold mt-1">
                        Текущий персонаж
                      </div>
                    </button>
                  )}

                  {CHARACTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedCharPreset(preset.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        selectedCharPreset === preset.id
                          ? 'bg-amber-500/20 border-amber-500/60 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-200 truncate">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {preset.class} ({preset.race})
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1">
                        HP {preset.maxHp} • AC {preset.ac}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status and Action */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  {isConnected && !isHost ? (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Подключен к хосту ({ping} ms)
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Не подключен</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isConnected && !isHost ? (
                    <button
                      onClick={onDisconnect}
                      className="px-4 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 text-xs font-bold transition cursor-pointer"
                    >
                      Отключиться
                    </button>
                  ) : (
                    <button
                      onClick={handleJoinClick}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/30 transition cursor-pointer active:scale-95"
                    >
                      <span>Подключиться к игре</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
