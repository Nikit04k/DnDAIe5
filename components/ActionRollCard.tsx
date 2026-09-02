'use client';

import React, { useState } from 'react';
import { RollRequirement, CharacterSheet, AbilityScoreKey, SkillName } from '@/types/dnd';
import {
  getAbilityModifier,
  getSkillModifier,
  getSavingThrowModifier,
  formatModifier,
  SKILL_RUSSIAN_NAMES,
  ABILITY_FULL_NAMES,
} from '@/lib/dndRules';
import {
  playDiceRollSound,
  playCriticalHitSound,
  playCriticalFailSound,
} from '@/lib/diceSound';
import {
  Dices,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Edit3,
  Send,
} from 'lucide-react';

interface ActionRollCardProps {
  rollReq: RollRequirement;
  character: CharacterSheet;
  loading: boolean;
  onPerformRoll: (rollText: string, rollBreakdown: {
    d20: number;
    modifier: number;
    total: number;
    isCrit: boolean;
    isFumble: boolean;
    passed?: boolean;
  }) => void;
}

export const ActionRollCard: React.FC<ActionRollCardProps> = ({
  rollReq,
  character,
  loading,
  onPerformRoll,
}) => {
  const [rollMode, setRollMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [isRolling, setIsRolling] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [customAlternativeAction, setCustomAlternativeAction] = useState('');
  const [showAlternativeInput, setShowAlternativeInput] = useState(false);

  // Determine which modifier to apply
  let calculatedModifier = 0;
  let statOrSkillLabel = 'Проверка характеристики';

  // Check if a specific skill is requested
  const matchedSkillKey = Object.keys(SKILL_RUSSIAN_NAMES).find((key) => {
    const sName = key.toLowerCase();
    const ruName = SKILL_RUSSIAN_NAMES[key as SkillName].toLowerCase();
    const target = (rollReq.skill || rollReq.ability || '').toLowerCase();
    return target.includes(sName) || target.includes(ruName);
  }) as SkillName | undefined;

  if (matchedSkillKey) {
    calculatedModifier = getSkillModifier(character, matchedSkillKey);
    statOrSkillLabel = `Навык: ${SKILL_RUSSIAN_NAMES[matchedSkillKey]}`;
  } else {
    // Check ability score
    const targetAbility = (rollReq.ability || '').toLowerCase();
    const matchedAbilityKey = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as AbilityScoreKey[]).find((key) => {
      const full = ABILITY_FULL_NAMES[key];
      return targetAbility.includes(key) ||
             targetAbility.includes(full.en.toLowerCase()) ||
             targetAbility.includes(full.ru.toLowerCase());
    }) || 'dex';

    if (rollReq.roll_type?.toLowerCase().includes('saving') || rollReq.roll_type?.toLowerCase().includes('спас')) {
      calculatedModifier = getSavingThrowModifier(character, matchedAbilityKey);
      statOrSkillLabel = `Спасбросок: ${ABILITY_FULL_NAMES[matchedAbilityKey].ru}`;
    } else {
      calculatedModifier = getAbilityModifier(character.stats[matchedAbilityKey] || 10);
      statOrSkillLabel = `Характеристика: ${ABILITY_FULL_NAMES[matchedAbilityKey].ru}`;
    }
  }

  const handleRollDice = () => {
    if (isRolling || loading) return;
    setIsRolling(true);
    playDiceRollSound();

    // Visual number scramble animation for 500ms
    let counter = 0;
    const interval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 20) + 1);
      counter++;
      if (counter > 7) {
        clearInterval(interval);

        // Perform actual roll logic
        const roll1 = Math.floor(Math.random() * 20) + 1;
        const roll2 = Math.floor(Math.random() * 20) + 1;

        let finalD20 = roll1;
        let rollExplanation = `[${roll1}]`;

        if (rollMode === 'advantage') {
          finalD20 = Math.max(roll1, roll2);
          rollExplanation = `[${roll1}, ${roll2} -> выбор лучшего: ${finalD20}]`;
        } else if (rollMode === 'disadvantage') {
          finalD20 = Math.min(roll1, roll2);
          rollExplanation = `[${roll1}, ${roll2} -> выбор худшего: ${finalD20}]`;
        }

        const total = finalD20 + calculatedModifier;
        const isCrit = finalD20 === 20;
        const isFumble = finalD20 === 1;

        let passed = false;
        if (rollReq.dc) {
          passed = isCrit || (!isFumble && total >= rollReq.dc);
        }

        // Trigger appropriate sound effect
        if (isCrit) {
          playCriticalHitSound();
        } else if (isFumble) {
          playCriticalFailSound();
        }

        // Format message for chat & LLM
        let resultText = `🎲 **БРОСОК d20 — ${statOrSkillLabel}**:\n`;
        resultText += `• Выпало на кубике: ${rollExplanation}\n`;
        resultText += `• Модификатор (${formatModifier(calculatedModifier)}): ${total}\n`;
        resultText += `• **ИТОГО: ${total}**`;

        if (rollReq.dc) {
          resultText += ` vs DC ${rollReq.dc} -> ${
            isCrit
              ? '🌟 **КРИТИЧЕСКИЙ УСПЕХ! (Нат 20)**'
              : isFumble
              ? '💀 **КРИТИЧЕСКИЙ ПРОВАЛ! (Нат 1)**'
              : passed
              ? '✅ **УСПЕХ!**'
              : '❌ **ПРОВАЛ!**'
          }`;
        }

        setIsRolling(false);
        onPerformRoll(resultText, {
          d20: finalD20,
          modifier: calculatedModifier,
          total,
          isCrit,
          isFumble,
          passed,
        });
      }
    }, 60);
  };

  const handleSendCustomAlternative = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAlternativeAction.trim() || loading) return;
    const actionText = customAlternativeAction.trim();
    setCustomAlternativeAction('');
    setShowAlternativeInput(false);
    onPerformRoll(actionText, {
      d20: 0,
      modifier: 0,
      total: 0,
      isCrit: false,
      isFumble: false,
    });
  };

  return (
    <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 animate-fadeIn">
      {/* Header Badge & Title */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
                Мастер запрашивает бросок кости
              </span>
              {rollReq.target_character_name && (
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                  🎯 {rollReq.target_character_name}
                </span>
              )}
            </div>
            <h3 className="font-cinzel text-base sm:text-lg font-bold text-amber-100">
              {statOrSkillLabel}
            </h3>
          </div>
        </div>

        {rollReq.dc && (
          <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl text-center flex-shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-amber-400 font-bold block">Сложность</span>
            <span className="font-cinzel text-base font-extrabold text-amber-300">DC {rollReq.dc}</span>
          </div>
        )}
      </div>

      {/* Reason Description */}
      {rollReq.reason && (
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs sm:text-sm text-slate-300 italic flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>«{rollReq.reason}»</span>
        </div>
      )}

      {/* Advantage / Disadvantage Mode Picker */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-slate-400 font-medium hidden sm:inline">Режим броска:</span>
        <div className="flex gap-1.5 flex-1 sm:flex-initial">
          <button
            onClick={() => setRollMode('normal')}
            className={`flex-1 sm:flex-initial px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border cursor-pointer ${
              rollMode === 'normal'
                ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Обычный (1d20)
          </button>
          <button
            onClick={() => setRollMode('advantage')}
            className={`flex-1 sm:flex-initial px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border flex items-center justify-center gap-1 cursor-pointer ${
              rollMode === 'advantage'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>Преимущество</span>
          </button>
          <button
            onClick={() => setRollMode('disadvantage')}
            className={`flex-1 sm:flex-initial px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border flex items-center justify-center gap-1 cursor-pointer ${
              rollMode === 'disadvantage'
                ? 'bg-red-950/80 text-red-300 border-red-500/60 shadow-sm shadow-red-500/20'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
            <span>Помеха</span>
          </button>
        </div>
      </div>

      {/* Action Button with Animated D20 */}
      <button
        onClick={handleRollDice}
        disabled={isRolling || loading}
        className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-cinzel font-extrabold text-sm sm:text-base rounded-xl shadow-lg shadow-amber-600/30 transition transform active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
      >
        <Dices className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
        <span>
          {isRolling
            ? `Бросаем кубик... [${displayNumber || '?'}]`
            : `Бросить d20 (${formatModifier(calculatedModifier)})`}
        </span>
      </button>

      {/* Alternative Action Input */}
      <div className="pt-2 border-t border-slate-800/80">
        {!showAlternativeInput ? (
          <button
            type="button"
            onClick={() => setShowAlternativeInput(true)}
            className="text-xs text-amber-400/90 hover:text-amber-300 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-slate-800 transition cursor-pointer font-medium"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Предложить другое действие / обойти проверку</span>
          </button>
        ) : (
          <form onSubmit={handleSendCustomAlternative} className="space-y-2 animate-fadeIn bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-amber-300">Ваш другой вариант действия:</span>
              <button
                type="button"
                onClick={() => setShowAlternativeInput(false)}
                className="text-slate-500 hover:text-slate-300 text-[10px] cursor-pointer"
              >
                Скрыть
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Опишите, что делаете вместо этого броска (например: Я использую веревку / отступаю)..."
                value={customAlternativeAction}
                onChange={(e) => setCustomAlternativeAction(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !customAlternativeAction.trim()}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Отправить</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
