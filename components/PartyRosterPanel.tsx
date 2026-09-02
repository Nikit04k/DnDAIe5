'use client';

import React from 'react';
import { NetworkPlayer, PlayerRoundAction, RollRequirement } from '@/types/dnd';
import { Shield, Heart, Crown, Dices, Users, CheckCircle2, Clock, Play, Radio } from 'lucide-react';

interface PartyRosterPanelProps {
  players: NetworkPlayer[];
  pendingRoll: RollRequirement | null;
  roundActions?: Record<string, PlayerRoundAction>;
  isHost?: boolean;
  isDmThinking?: boolean;
  currentLocalPlayerId?: string;
  onForceDmTurn?: () => void;
  onOpenMultiplayerModal?: () => void;
}

export const PartyRosterPanel: React.FC<PartyRosterPanelProps> = ({
  players,
  pendingRoll,
  roundActions = {},
  isHost = false,
  isDmThinking = false,
  currentLocalPlayerId,
  onForceDmTurn,
  onOpenMultiplayerModal,
}) => {
  if (!players || players.length === 0) return null;

  const totalPlayers = players.length;
  const readyCount = players.filter((p) => roundActions[p.id]).length;
  const isAllReady = totalPlayers > 0 && readyCount === totalPlayers;

  return (
    <div className="border-b border-slate-800/80 bg-slate-950/95 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shadow-sm">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
          <Users className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Отряд:</span>
        </div>

        {totalPlayers > 1 && (
          <div
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border transition-all ${
              isAllReady
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 animate-pulse'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            }`}
            title={`Готовность раунда: ${readyCount} из ${totalPlayers} игроков сделали ход`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>
              Раунд: {readyCount}/{totalPlayers} {isAllReady ? '✅ Готовы' : 'ждут'}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1 overflow-x-auto py-0.5 no-scrollbar">
        {players.map((p) => {
          const c = p.character;
          const isLocal = p.id === currentLocalPlayerId;
          const isRollTarget =
            pendingRoll?.needed &&
            (pendingRoll.target_character_id === p.id ||
              (pendingRoll.target_character_name &&
                (p.name?.toLowerCase().includes(pendingRoll.target_character_name.toLowerCase()) ||
                  c?.name?.toLowerCase().includes(pendingRoll.target_character_name.toLowerCase()))));

          const hasMadeRoundMove = Boolean(roundActions[p.id]);

          const hpPercent = c ? Math.max(0, Math.min(100, (c.currentHp / (c.maxHp || 1)) * 100)) : 100;
          const hpColor = hpPercent > 50 ? 'text-emerald-400' : hpPercent > 20 ? 'text-amber-400' : 'text-red-400';

          return (
            <div
              key={p.id}
              style={{ borderColor: isRollTarget ? '#f59e0b' : p.color ? `${p.color}40` : undefined }}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border text-xs shadow-sm flex-shrink-0 transition-all ${
                isRollTarget
                  ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-950/30 animate-pulse'
                  : hasMadeRoundMove
                  ? 'border-emerald-500/50 bg-slate-900/90'
                  : 'hover:border-slate-700'
              }`}
            >
              {/* Avatar Icon */}
              <div
                style={{ backgroundColor: p.color || '#f59e0b' }}
                className="w-6 h-6 rounded-lg text-slate-950 font-bold text-[11px] flex items-center justify-center flex-shrink-0 shadow-sm relative"
              >
                {p.name ? p.name.charAt(0).toUpperCase() : 'Г'}
                {totalPlayers > 1 && (
                  <span
                    className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                      hasMadeRoundMove ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-ping'
                    }`}
                  />
                )}
              </div>

              {/* Name & Class */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-[11px] text-slate-200 truncate max-w-[90px] sm:max-w-[120px]">
                    {p.name || c?.name || 'Игрок'}
                  </span>
                  {p.isHost && (
                    <span title="Хост"><Crown className="w-3 h-3 text-amber-400 shrink-0" /></span>
                  )}
                  {isLocal && (
                    <span className="text-[9px] text-cyan-400 font-semibold">(Вы)</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[9px]">
                  <span className="text-slate-400 truncate">
                    {c?.class || 'Персонаж'} ({c?.level || 1} ур.)
                  </span>
                  {totalPlayers > 1 && (
                    <span
                      className={`font-semibold shrink-0 ${
                        hasMadeRoundMove ? 'text-emerald-400' : 'text-amber-400/80 italic'
                      }`}
                    >
                      {hasMadeRoundMove ? '• Ход сделан' : '• Думает'}
                    </span>
                  )}
                </div>
              </div>

              {/* HP & AC */}
              {c && (
                <div className="flex items-center gap-1.5 pl-1 border-l border-slate-800 text-[10px]">
                  <span className={`font-semibold flex items-center gap-0.5 ${hpColor}`}>
                    <Heart className="w-2.5 h-2.5 fill-current/30" />
                    <span>{c.currentHp}</span>
                  </span>
                  <span className="text-slate-400 flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5 text-blue-400" />
                    <span>{c.ac}</span>
                  </span>
                </div>
              )}

              {/* Target Roll Badge */}
              {isRollTarget && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[9px] font-bold shadow-sm animate-bounce">
                  <Dices className="w-2.5 h-2.5" />
                  <span>Бросок!</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Host Force DM Turn Button */}
        {isHost && totalPlayers > 1 && onForceDmTurn && (
          <button
            onClick={onForceDmTurn}
            disabled={isDmThinking || readyCount === 0}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition flex items-center gap-1 shadow-sm cursor-pointer ${
              readyCount > 0
                ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950 active:scale-95'
                : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
            }`}
            title="Запустить ход Dungeon Master для сделавших ход игроков"
          >
            <Play className="w-3 h-3 fill-current" />
            <span className="hidden sm:inline">Ход DM</span>
          </button>
        )}

        {onOpenMultiplayerModal && (
          <button
            onClick={onOpenMultiplayerModal}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-300 transition text-[11px] flex-shrink-0 cursor-pointer"
            title="Настройки LAN группы"
          >
            <Radio className="w-3.5 h-3.5 text-amber-400" />
          </button>
        )}
      </div>
    </div>
  );
};
