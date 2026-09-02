'use client';

import React, { useState } from 'react';
import { Send, Compass, Eye, Volume2, Shield, Sparkles } from 'lucide-react';

interface SuggestedActionsProps {
  suggestedActions: string[];
  loading: boolean;
  onSendAction: (actionText: string) => void;
}

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({
  suggestedActions,
  loading,
  onSendAction,
}) => {
  const [inputAction, setInputAction] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputAction.trim() || loading) return;
    onSendAction(inputAction.trim());
    setInputAction('');
  };

  const handleChipClick = (actionText: string) => {
    if (loading) return;
    onSendAction(actionText);
  };

  return (
    <div className="space-y-2">
      {/* Freeform Action Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Что делает ваш персонаж? Опишите действие, тактику или реплику в диалоге..."
          value={inputAction}
          onChange={(e) => setInputAction(e.target.value)}
          disabled={loading}
          className="flex-1 bg-slate-900/90 border border-slate-700/80 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition shadow-inner disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !inputAction.trim()}
          className="px-5 sm:px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-cinzel font-bold text-sm rounded-xl transition shadow-lg shadow-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Действие</span>
        </button>
      </form>
    </div>
  );
};
