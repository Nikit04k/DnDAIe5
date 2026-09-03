'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  playDiceRollSound,
  playCriticalHitSound,
  playCriticalFailSound,
} from '@/lib/diceSound';
import { Sparkles, Skull, Crown, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface ScreenDiceRollOptions {
  title?: string;
  subtitle?: string;
  dc?: number;
  modifier?: number;
  mode?: 'normal' | 'advantage' | 'disadvantage';
  targetCharacterName?: string;
  diceSides?: number;
  onComplete: (result: {
    finalD20: number;
    modifier: number;
    total: number;
    isCrit: boolean;
    isFumble: boolean;
    passed?: boolean;
    roll1: number;
    roll2?: number;
    summaryText: string;
  }) => void;
  onCancel?: () => void;
}

interface ScreenDiceRollerProps {
  options: ScreenDiceRollOptions | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ScreenDiceRoller: React.FC<ScreenDiceRollerProps> = ({
  options,
  isOpen,
  onClose,
}) => {
  const [stage, setStage] = useState<'rolling' | 'settled'>('rolling');
  const [scramble1, setScramble1] = useState<number>(20);
  const [scramble2, setScramble2] = useState<number>(10);
  const [finalResult, setFinalResult] = useState<{
    roll1: number;
    roll2?: number;
    finalD20: number;
    modifier: number;
    total: number;
    isCrit: boolean;
    isFumble: boolean;
    passed?: boolean;
    summaryText: string;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen || !options) {
      setStage('rolling');
      setFinalResult(null);
      if (timerRef.current) clearInterval(timerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      return;
    }

    setStage('rolling');
    setFinalResult(null);
    playDiceRollSound();

    const sides = options.diceSides || 20;
    const isAdvantage = options.mode === 'advantage';
    const isDisadvantage = options.mode === 'disadvantage';
    const hasTwoDice = isAdvantage || isDisadvantage;

    // Rapid scramble
    const scrambleInterval = setInterval(() => {
      setScramble1(Math.floor(Math.random() * sides) + 1);
      if (hasTwoDice) {
        setScramble2(Math.floor(Math.random() * sides) + 1);
      }
    }, 45);

    // Settle after 750ms
    timerRef.current = setTimeout(() => {
      clearInterval(scrambleInterval);

      const r1 = Math.floor(Math.random() * sides) + 1;
      const r2 = Math.floor(Math.random() * sides) + 1;

      let picked = r1;
      if (isAdvantage) picked = Math.max(r1, r2);
      if (isDisadvantage) picked = Math.min(r1, r2);

      const mod = options.modifier || 0;
      const total = picked + mod;
      const isCrit = sides === 20 && picked === 20;
      const isFumble = sides === 20 && picked === 1;

      let passed: boolean | undefined = undefined;
      if (options.dc) {
        passed = isCrit || (!isFumble && total >= options.dc);
      }

      // Audio impact
      if (isCrit) {
        playCriticalHitSound();
      } else if (isFumble) {
        playCriticalFailSound();
      } else {
        playDiceRollSound();
      }

      let explanation = `[${r1}]`;
      if (isAdvantage) explanation = `[${r1}, ${r2} -> лучший: ${picked}]`;
      if (isDisadvantage) explanation = `[${r1}, ${r2} -> худший: ${picked}]`;

      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      let summaryText = `🎲 **${options.title || 'Бросок d20'}**:\n• Выпало на кубике: ${explanation}\n• Модификатор (${modStr}): ${total}\n• **ИТОГО: ${total}**`;

      if (options.dc) {
        summaryText += ` против DC ${options.dc} -> ${
          isCrit
            ? '🌟 **КРИТИЧЕСКИЙ УСПЕХ! (Нат 20)**'
            : isFumble
            ? '💀 **КРИТИЧЕСКИЙ ПРОВАЛ! (Нат 1)**'
            : passed
            ? '✅ **УСПЕХ!**'
            : '❌ **ПРОВАЛ!**'
        }`;
      }

      const res = {
        roll1: r1,
        roll2: hasTwoDice ? r2 : undefined,
        finalD20: picked,
        modifier: mod,
        total,
        isCrit,
        isFumble,
        passed,
        summaryText,
      };

      setScramble1(r1);
      if (hasTwoDice) setScramble2(r2);
      setFinalResult(res);
      setStage('settled');

      // Automatically advance after brief showcase
      closeTimerRef.current = setTimeout(() => {
        options.onComplete(res);
        onClose();
      }, 1500);
    }, 750);

    return () => {
      clearInterval(scrambleInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen, options]);

  if (!isOpen || !options) return null;

  const handleFinishImmediately = () => {
    if (stage === 'settled' && finalResult) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      options.onComplete(finalResult);
      onClose();
    }
  };

  const isAdvantage = options.mode === 'advantage';
  const isDisadvantage = options.mode === 'disadvantage';
  const hasTwoDice = isAdvantage || isDisadvantage;
  const mod = options.modifier || 0;
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

  // Helper renderer for D20 SVG
  const renderD20Svg = (
    value: number,
    isWinner: boolean = true,
    isDiscarded: boolean = false,
    customColor?: 'gold' | 'crit' | 'fumble' | 'dim'
  ) => {
    let strokeColor = '#f59e0b';
    let gradStart = '#78350f';
    let gradMid = '#b45309';
    let gradEnd = '#451a03';
    let textColor = '#fef3c7';

    if (customColor === 'crit') {
      strokeColor = '#fde047';
      gradStart = '#ca8a04';
      gradMid = '#eab308';
      gradEnd = '#854d0e';
      textColor = '#ffffff';
    } else if (customColor === 'fumble') {
      strokeColor = '#ef4444';
      gradStart = '#7f1d1d';
      gradMid = '#991b1b';
      gradEnd = '#450a0a';
      textColor = '#fca5a5';
    } else if (isDiscarded) {
      strokeColor = '#475569';
      gradStart = '#1e293b';
      gradMid = '#0f172a';
      gradEnd = '#020617';
      textColor = '#64748b';
    }

    return (
      <div className={`relative flex flex-col items-center transition-all duration-300 ${isDiscarded ? 'opacity-40 scale-90' : 'scale-100'}`}>
        <svg
          viewBox="0 0 200 200"
          className="w-32 h-32 sm:w-40 sm:h-40 drop-shadow-[0_0_20px_rgba(245,158,11,0.35)]"
        >
          <defs>
            <linearGradient id={`d20grad_${value}_${customColor}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradStart} />
              <stop offset="50%" stopColor={gradMid} />
              <stop offset="100%" stopColor={gradEnd} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* D20 Facets Geometry */}
          {/* Outer Ring / Facets */}
          <polygon
            points="100,10 180,55 180,145 100,190 20,145 20,55"
            fill={`url(#d20grad_${value}_${customColor})`}
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Upper Triangles */}
          <polygon points="100,10 100,55 20,55" fill="rgba(255,255,255,0.08)" stroke={strokeColor} strokeWidth="1.5" />
          <polygon points="100,10 100,55 180,55" fill="rgba(255,255,255,0.18)" stroke={strokeColor} strokeWidth="1.5" />

          {/* Lower Triangles */}
          <polygon points="100,190 100,145 20,145" fill="rgba(0,0,0,0.35)" stroke={strokeColor} strokeWidth="1.5" />
          <polygon points="100,190 100,145 180,145" fill="rgba(0,0,0,0.45)" stroke={strokeColor} strokeWidth="1.5" />

          {/* Side Triangular Facets */}
          <polygon points="20,55 100,55 45,140" fill="rgba(255,255,255,0.04)" stroke={strokeColor} strokeWidth="1.5" />
          <polygon points="180,55 100,55 155,140" fill="rgba(255,255,255,0.12)" stroke={strokeColor} strokeWidth="1.5" />

          {/* Central Face (Where number lives) */}
          <polygon
            points="100,55 155,140 45,140"
            fill="rgba(0,0,0,0.4)"
            stroke={strokeColor}
            strokeWidth="2.5"
          />

          {/* Die Number */}
          <text
            x="100"
            y="112"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Cinzel, serif"
            fontSize={value >= 10 ? '42' : '46'}
            fontWeight="900"
            fill={textColor}
            filter={customColor === 'crit' || customColor === 'fumble' ? 'url(#glow)' : undefined}
          >
            {value}
          </text>
        </svg>

        {/* Die Subtitle badge */}
        {hasTwoDice && (
          <span
            className={`mt-2 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${
              isWinner
                ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            {isWinner ? 'ВЫБРАН' : 'ОТБРОШЕН'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={handleFinishImmediately}
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity duration-200 cursor-pointer ${
        stage === 'settled' && finalResult?.isCrit
          ? 'ring-inset ring-8 ring-amber-500/30'
          : stage === 'settled' && finalResult?.isFumble
          ? 'ring-inset ring-8 ring-red-600/30'
          : ''
      }`}
    >
      <div
        className={`w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden transition-all duration-300 ${
          stage === 'settled'
            ? finalResult?.isCrit
              ? 'border-amber-400 shadow-amber-500/30 animate-crit-burst'
              : finalResult?.isFumble
              ? 'border-red-500 shadow-red-600/30 animate-fumble-burst'
              : finalResult?.passed
              ? 'border-emerald-500 shadow-emerald-500/20 animate-dice-impact'
              : 'border-slate-700 animate-dice-impact'
            : 'border-amber-500/50 shadow-amber-500/10'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />

        {/* Header Title & Reason */}
        <div className="relative z-10 space-y-1 mb-6">
          <div className="flex items-center justify-center gap-2">
            <h2 className="font-cinzel text-lg sm:text-xl font-bold text-amber-200 tracking-wide">
              {options.title || 'Бросок проверки d20'}
            </h2>
            {options.dc && (
              <span className="px-2.5 py-0.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-cinzel font-bold text-xs">
                DC {options.dc}
              </span>
            )}
          </div>

          {options.subtitle && (
            <p className="text-xs text-slate-400 italic">
              «{options.subtitle}»
            </p>
          )}

          {hasTwoDice && (
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-bold">
              {isAdvantage ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Бросок с преимуществом (2d20, лучший)</span>
                </span>
              ) : (
                <span className="text-red-400 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Бросок с помехой (2d20, худший)</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Dice Showcase Area */}
        <div
          className={`relative z-10 flex items-center justify-center gap-6 sm:gap-10 my-2 ${
            stage === 'rolling' ? 'animate-dice-tumble-3d' : 'animate-dice-impact'
          }`}
        >
          {/* Die 1 */}
          {(() => {
            const val = stage === 'rolling' ? scramble1 : finalResult?.roll1 || scramble1;
            const isWinner = hasTwoDice
              ? isAdvantage
                ? (finalResult?.roll1 || 0) >= (finalResult?.roll2 || 0)
                : (finalResult?.roll1 || 0) <= (finalResult?.roll2 || 0)
              : true;
            const isCrit = stage === 'settled' && isWinner && finalResult?.isCrit;
            const isFumble = stage === 'settled' && isWinner && finalResult?.isFumble;

            const color = isCrit ? 'crit' : isFumble ? 'fumble' : undefined;

            return renderD20Svg(val, isWinner, hasTwoDice && !isWinner, color);
          })()}

          {/* Die 2 (Advantage / Disadvantage) */}
          {hasTwoDice &&
            (() => {
              const val = stage === 'rolling' ? scramble2 : finalResult?.roll2 || scramble2;
              const isWinner = isAdvantage
                ? (finalResult?.roll2 || 0) > (finalResult?.roll1 || 0)
                : (finalResult?.roll2 || 0) < (finalResult?.roll1 || 0);
              const isCrit = stage === 'settled' && isWinner && finalResult?.isCrit;
              const isFumble = stage === 'settled' && isWinner && finalResult?.isFumble;

              const color = isCrit ? 'crit' : isFumble ? 'fumble' : undefined;

              return renderD20Svg(val, isWinner, !isWinner, color);
            })()}
        </div>

        {/* Settled Result Outcome Banner */}
        {stage === 'settled' && finalResult ? (
          <div className="relative z-10 space-y-3 mt-6 animate-fadeIn w-full">
            {/* Critical Hit / Fumble banner */}
            {finalResult.isCrit && (
              <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border border-amber-400 py-2 px-4 rounded-2xl flex items-center justify-center gap-2 text-amber-200 font-cinzel font-extrabold text-sm sm:text-base shadow-lg shadow-amber-500/20">
                <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                <span>🌟 КРИТИЧЕСКИЙ УСПЕХ! (НАТ 20) 🌟</span>
              </div>
            )}

            {finalResult.isFumble && (
              <div className="bg-gradient-to-r from-red-600/20 via-red-500/30 to-red-600/20 border border-red-500 py-2 px-4 rounded-2xl flex items-center justify-center gap-2 text-red-200 font-cinzel font-extrabold text-sm sm:text-base shadow-lg shadow-red-600/20">
                <Skull className="w-5 h-5 text-red-400 animate-pulse" />
                <span>💀 КРИТИЧЕСКИЙ ПРОВАЛ! (НАТ 1) 💀</span>
              </div>
            )}

            {/* DC comparison result */}
            {options.dc && !finalResult.isCrit && !finalResult.isFumble && (
              <div
                className={`py-2 px-4 rounded-2xl border flex items-center justify-center gap-2 font-cinzel font-bold text-sm sm:text-base shadow-md ${
                  finalResult.passed
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-emerald-500/20'
                    : 'bg-red-950/60 border-red-500 text-red-300 shadow-red-500/20'
                }`}
              >
                {finalResult.passed ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>УСПЕХ! ({finalResult.total} ≥ DC {options.dc})</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span>ПРОВАЛ! ({finalResult.total} &lt; DC {options.dc})</span>
                  </>
                )}
              </div>
            )}

            {/* Calculation Breakdown */}
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs sm:text-sm text-slate-300 flex items-center justify-between gap-2">
              <span className="text-slate-400 font-mono">
                Кубик: [{finalResult.finalD20}] {mod >= 0 ? `+ ${mod}` : `- ${Math.abs(mod)}`}
              </span>
              <span className="font-cinzel text-base sm:text-lg font-bold text-amber-300">
                ИТОГО: {finalResult.total}
              </span>
            </div>

            {/* Manual Proceed button */}
            <button
              onClick={handleFinishImmediately}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-cinzel font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer"
            >
              Продолжить ➔
            </button>
          </div>
        ) : (
          <div className="relative z-10 text-xs text-amber-400/80 font-mono tracking-widest mt-6 animate-pulse">
            БРОСАЕМ КУБИКИ СУДЬБЫ...
          </div>
        )}
      </div>
    </div>
  );
};
