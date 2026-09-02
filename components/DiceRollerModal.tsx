'use client';

import React, { useState } from 'react';
import { Dices, X, Plus, Minus, RotateCcw, ArrowUpRight, ArrowDownRight, Send } from 'lucide-react';
import { playDiceRollSound, playCriticalHitSound, playCriticalFailSound } from '@/lib/diceSound';
import { DiceRollResult } from '@/types/dnd';

interface DiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (rollSummary: string) => void;
}

type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

const DICE_CONFIG: Array<{ type: DiceType; label: string; sides: number; color: string }> = [
  { type: 'd4', label: 'd4', sides: 4, color: 'from-amber-600 to-yellow-800' },
  { type: 'd6', label: 'd6', sides: 6, color: 'from-emerald-600 to-green-900' },
  { type: 'd8', label: 'd8', sides: 8, color: 'from-blue-600 to-indigo-900' },
  { type: 'd10', label: 'd10', sides: 10, color: 'from-purple-600 to-violet-950' },
  { type: 'd12', label: 'd12', sides: 12, color: 'from-pink-600 to-rose-950' },
  { type: 'd20', label: 'd20', sides: 20, color: 'from-amber-500 to-amber-700' },
  { type: 'd100', label: 'd100', sides: 100, color: 'from-cyan-600 to-slate-900' },
];

export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({
  isOpen,
  onClose,
  onSendToChat,
}) => {
  const [selectedDice, setSelectedDice] = useState<DiceType>('d20');
  const [diceCount, setDiceCount] = useState<number>(1);
  const [modifier, setModifier] = useState<number>(0);
  const [mode, setMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [rollHistory, setRollHistory] = useState<DiceRollResult[]>([]);
  const [latestResult, setLatestResult] = useState<DiceRollResult | null>(null);

  if (!isOpen) return null;

  const currentDiceConfig = DICE_CONFIG.find((d) => d.type === selectedDice)!;

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);
    playDiceRollSound();

    setTimeout(() => {
      let rolls: number[] = [];
      let isCrit = false;
      let isFumble = false;

      if (selectedDice === 'd20' && diceCount === 1 && mode !== 'normal') {
        const r1 = Math.floor(Math.random() * 20) + 1;
        const r2 = Math.floor(Math.random() * 20) + 1;
        const picked = mode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
        rolls = [r1, r2];
        if (picked === 20) isCrit = true;
        if (picked === 1) isFumble = true;
      } else {
        for (let i = 0; i < diceCount; i++) {
          const r = Math.floor(Math.random() * currentDiceConfig.sides) + 1;
          rolls.push(r);
          if (selectedDice === 'd20' && r === 20) isCrit = true;
          if (selectedDice === 'd20' && r === 1) isFumble = true;
        }
      }

      let rawSum = 0;
      if (selectedDice === 'd20' && diceCount === 1 && mode !== 'normal') {
        rawSum = mode === 'advantage' ? Math.max(rolls[0], rolls[1]) : Math.min(rolls[0], rolls[1]);
      } else {
        rawSum = rolls.reduce((a, b) => a + b, 0);
      }

      const total = rawSum + modifier;

      if (isCrit) playCriticalHitSound();
      else if (isFumble) playCriticalFailSound();

      const result: DiceRollResult = {
        diceType: selectedDice,
        count: diceCount,
        rolls,
        modifier,
        total,
        advantage: mode === 'advantage',
        disadvantage: mode === 'disadvantage',
        isCrit,
        isFumble,
      };

      setLatestResult(result);
      setRollHistory((prev) => [result, ...prev.slice(0, 9)]);
      setIsRolling(false);
    }, 450);
  };

  const handleSendResult = (res: DiceRollResult) => {
    if (!onSendToChat) return;
    const modStr = res.modifier !== 0 ? (res.modifier > 0 ? ` + ${res.modifier}` : ` - ${Math.abs(res.modifier)}`) : '';
    const critTag = res.isCrit ? ' [🌟 КРИТИЧЕСКИЙ УСПЕХ!]' : res.isFumble ? ' [💀 КРИТИЧЕСКИЙ ПРОВАЛ!]' : '';
    const text = `[Свободный бросок ${res.count}${res.diceType}]: Выпало (${res.rolls.join(', ')})${modStr} = ИТОГО: ${res.total}${critTag}`;
    onSendToChat(text);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel font-bold text-base text-amber-200">Башня дайсов (Dice Tray)</h3>
              <p className="text-[11px] text-slate-400">Свободные броски кубиков D&D 5e</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Dice Selector Grid */}
          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
              Выберите тип дайса
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {DICE_CONFIG.map((dice) => (
                <button
                  key={dice.type}
                  onClick={() => setSelectedDice(dice.type)}
                  className={`py-3 px-2 rounded-xl font-cinzel font-bold text-sm transition flex flex-col items-center gap-1 border ${
                    selectedDice === dice.type
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30'
                      : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <span>{dice.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dice Count & Modifier Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Количество кубиков</span>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setDiceCount(Math.max(1, diceCount - 1))}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-cinzel text-lg font-bold text-amber-300">{diceCount}</span>
                <button
                  onClick={() => setDiceCount(Math.min(10, diceCount + 1))}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Модификатор</span>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setModifier(modifier - 1)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-cinzel text-lg font-bold text-amber-300">
                  {modifier >= 0 ? `+${modifier}` : modifier}
                </span>
                <button
                  onClick={() => setModifier(modifier + 1)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Advantage / Disadvantage Mode (only for 1d20) */}
          {selectedDice === 'd20' && diceCount === 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode('normal')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  mode === 'normal'
                    ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800'
                }`}
              >
                Обычный
              </button>
              <button
                onClick={() => setMode('advantage')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center justify-center gap-1 ${
                  mode === 'advantage'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800'
                }`}
              >
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                <span>Преимущество</span>
              </button>
              <button
                onClick={() => setMode('disadvantage')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center justify-center gap-1 ${
                  mode === 'disadvantage'
                    ? 'bg-red-950 text-red-300 border-red-500'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800'
                }`}
              >
                <ArrowDownRight className="w-3 h-3 text-red-400" />
                <span>Помеха</span>
              </button>
            </div>
          )}

          {/* Roll Button */}
          <button
            onClick={handleRoll}
            disabled={isRolling}
            className="w-full py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-cinzel font-extrabold text-base rounded-xl shadow-lg shadow-amber-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Dices className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
            <span>{isRolling ? 'Бросок кубиков...' : `Бросить ${diceCount}${selectedDice}${modifier !== 0 ? ` (${modifier >= 0 ? `+${modifier}` : modifier})` : ''}`}</span>
          </button>

          {/* Latest Result Banner */}
          {latestResult && (
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              latestResult.isCrit
                ? 'bg-amber-950/40 border-amber-400 shadow-lg shadow-amber-400/20'
                : latestResult.isFumble
                ? 'bg-red-950/40 border-red-500'
                : 'bg-slate-950 border-slate-800'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">
                    {latestResult.count}{latestResult.diceType}: ({latestResult.rolls.join(', ')})
                    {latestResult.modifier !== 0 && ` ${latestResult.modifier > 0 ? `+ ${latestResult.modifier}` : `- ${Math.abs(latestResult.modifier)}`}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-cinzel text-2xl font-black text-amber-300">
                    ИТОГО: {latestResult.total}
                  </span>
                  {latestResult.isCrit && <span className="text-xs font-bold text-amber-400">🌟 NAT 20!</span>}
                  {latestResult.isFumble && <span className="text-xs font-bold text-red-400">💀 NAT 1!</span>}
                </div>
              </div>

              {onSendToChat && (
                <button
                  onClick={() => handleSendResult(latestResult)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>В чат</span>
                </button>
              )}
            </div>
          )}

          {/* History */}
          {rollHistory.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block px-1">
                Предыдущие броски
              </span>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {rollHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-950/60 rounded border border-slate-800/80">
                    <span className="text-slate-400">
                      {h.count}{h.diceType} ({h.rolls.join(', ')}) {h.modifier !== 0 && (h.modifier > 0 ? `+${h.modifier}` : h.modifier)}
                    </span>
                    <span className="font-bold text-amber-300">{h.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
