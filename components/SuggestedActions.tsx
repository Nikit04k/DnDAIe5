'use client';

import React, { useState } from 'react';
import { Send, Sparkles, Compass, CheckCircle2, Clock, Shield, FastForward } from 'lucide-react';

interface SuggestedActionsProps {
  suggestedActions: string[];
  loading: boolean;
  isRoundActionSubmitted?: boolean;
  submittedActionText?: string;
  roundStatusText?: string;
  isCoopMode?: boolean;
  onSendAction: (actionText: string) => void;
}

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({
  suggestedActions,
  loading,
  isRoundActionSubmitted = false,
  submittedActionText = '',
  roundStatusText = '',
  isCoopMode = false,
  onSendAction,
}) => {
  const [inputAction, setInputAction] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputAction.trim() || loading || isRoundActionSubmitted) return;
    onSendAction(inputAction.trim());
    setInputAction('');
  };

  const handleChipClick = (actionText: string) => {
    if (loading || isRoundActionSubmitted) return;
    onSendAction(actionText);
  };

  const filteredChips = (suggestedActions || []).filter(
    (action) => action && action.trim().length > 0 && !action.includes('Повторить запрос') && !action.includes('Настройки API')
  );

  return (
    <div className="space-y-2.5">
      {/* Waiting for other party members badge */}
      {isRoundActionSubmitted && !loading && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs shadow-md animate-pulse">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold text-amber-300 shrink-0">Заявка принята:</span>
            <span className="italic text-slate-300 truncate max-w-[240px] sm:max-w-[400px]">
              «{submittedActionText}»
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 shrink-0 pl-2">
            <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>{roundStatusText || 'Ожидание заявки второго игрока...'}</span>
          </div>
        </div>
      )}

      {/* Quick Suggested Action Chips (One-tap on mobile) */}
      {!isRoundActionSubmitted && !loading && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
          {isCoopMode && (
            <>
              <button
                type="button"
                onClick={() => onSendAction('Помогаю напарнику в его действии, прикрывая и содействуя ему')}
                className="px-3 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 text-xs font-semibold text-cyan-200 hover:text-cyan-100 transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>🤝 Поддержать (Помощь)</span>
              </button>
              <button
                type="button"
                onClick={() => onSendAction('Осторожно наблюдаю за обстановкой, не совершая активных действий')}
                className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-slate-100 transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
              >
                <FastForward className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>⏩ Пропустить ход</span>
              </button>
            </>
          )}

          {filteredChips.length > 0 && (
            <>
              <span className="text-[10px] uppercase font-bold text-amber-500/80 shrink-0 flex items-center gap-1 pl-0.5 hidden sm:flex">
                <Compass className="w-3 h-3 text-amber-400" />
                <span>Варианты:</span>
              </span>
              {filteredChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-amber-950/60 border border-slate-700/80 hover:border-amber-500/50 text-xs font-medium text-slate-200 hover:text-amber-300 transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
                >
                  <Sparkles className="w-3 h-3 text-amber-400/90 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-[260px]">{chip}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Freeform Action Input with tactile Send button */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder={
            isRoundActionSubmitted
              ? 'Заявка отправлена. Ожидание заявки второго игрока...'
              : 'Что делает ваш герой? Опишите действие, тактику или фразу...'
          }
          value={inputAction}
          onChange={(e) => setInputAction(e.target.value)}
          disabled={loading || isRoundActionSubmitted}
          className="flex-1 bg-slate-900/95 border border-slate-700/80 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition shadow-inner disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        />
        <button
          type="submit"
          disabled={loading || isRoundActionSubmitted || !inputAction.trim()}
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-cinzel font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 touch-manipulation shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isRoundActionSubmitted ? 'Ожидание' : 'Действие'}
          </span>
        </button>
      </form>
    </div>
  );
};

