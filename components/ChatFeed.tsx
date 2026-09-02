'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, StateUpdate } from '@/types/dnd';
import {
  Sparkles,
  User,
  Heart,
  Coins,
  Package,
  MapPin,
  Dices,
  Clock,
  Volume2,
  Square,
  Loader2,
  Brain,
  RotateCcw,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { playEdgeTts, stopTtsAudio, subscribeTtsState } from '@/lib/edgeTts';
import { getStoredTtsVoice, getStoredTtsSpeed, getStoredTtsVolume } from '@/lib/storage';

interface ChatFeedProps {
  history: ChatMessage[];
  loading: boolean;
  playerName: string;
  onRetryAction?: (failedAction: string) => void;
  onOpenSettings?: () => void;
}

// Separate thinking tags from narrative text if still embedded
function extractNarrativeAndThought(text: string, existingThought?: string): { cleanText: string; thought?: string } {
  let thought = existingThought || '';
  let cleanText = text || '';

  // Extract <think>...</think> or <thought>...</thought> tags
  const thinkRegex = /<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/gi;
  let match;
  while ((match = thinkRegex.exec(cleanText)) !== null) {
    if (match[1]) {
      thought = (thought ? thought + '\n\n' : '') + match[1].trim();
    }
  }
  cleanText = cleanText.replace(thinkRegex, '').trim();

  // Extract ```thought ... ``` code blocks
  const thoughtBlockRegex = /```(?:thought|thinking)\s*([\s\S]*?)```/gi;
  while ((match = thoughtBlockRegex.exec(cleanText)) !== null) {
    if (match[1]) {
      thought = (thought ? thought + '\n\n' : '') + match[1].trim();
    }
  }
  cleanText = cleanText.replace(thoughtBlockRegex, '').trim();

  // Strip out any "📊 [Хроника мира]..." or "Варианты действий:" technical blocks from chat bubble
  cleanText = cleanText
    .replace(/\s*---\s*📊\s*\*{0,2}\[?Хроника\s+мира\]?\*{0,2}[\s\S]*$/i, '')
    .replace(/\s*📊\s*\*{0,2}\[?Хроника\s+мира\]?\*{0,2}[\s\S]*$/i, '')
    .replace(/\s*---\s*📍\s*\*{0,2}Локация:?[\s\S]*$/i, '')
    .replace(/\n+\s*(\*{0,2}(?:Возможные\s+)?(?:Варианты|варианты)\s+действий:?\*{0,2}|\b(?:Что\s+вы\s+(?:будете\s+делать|сделаете|предпримете|решите|хотите\s+сделать)\??))[\s\S]*$/i, '')
    .replace(/\n+\s*(?:[1-4]\.|\*|-)\s+[А-Яа-яЁёA-Za-z0-9\s()«»"—,-]+(?:\n+\s*(?:[1-4]\.|\*|-)\s+[А-Яа-яЁёA-Za-z0-9\s()«»"—,-]+){1,5}\s*$/i, '')
    .trim();

  return {
    cleanText,
    thought: thought.trim() || undefined,
  };
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  history,
  loading,
  playerName,
  onRetryAction,
  onOpenSettings,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingTtsId, setLoadingTtsId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length, loading]);

  useEffect(() => {
    const unsubscribe = subscribeTtsState((id, isPlaying) => {
      setPlayingMessageId(isPlaying ? id : null);
      if (!isPlaying) {
        setLoadingTtsId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleToggleTts = async (msgId: string, text: string) => {
    if (playingMessageId === msgId) {
      stopTtsAudio();
      return;
    }

    setLoadingTtsId(msgId);
    const voice = getStoredTtsVoice();
    const rate = getStoredTtsSpeed();
    const volume = getStoredTtsVolume();

    try {
      await playEdgeTts(msgId, text, {
        voice,
        rate,
        volume,
        onEnd: () => setLoadingTtsId(null),
        onError: () => setLoadingTtsId(null),
      });
    } catch (e) {
      setLoadingTtsId(null);
    }
  };

  // Helper to format narrative text with dialogue and paragraph styling
  const renderFormattedNarrative = (text: string) => {
    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);

    return (
      <div className="space-y-3 font-sans leading-relaxed text-slate-200">
        {paragraphs.map((para, i) => {
          const isDialogue = para.trim().startsWith('«') || para.trim().startsWith('—') || para.trim().startsWith('"');

          const formattedParts = para.split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-bold text-amber-300">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          return (
            <p
              key={i}
              className={`text-sm sm:text-[15px] ${
                isDialogue
                  ? 'border-l-2 border-amber-500/40 pl-3 py-0.5 italic text-amber-100/90 font-medium'
                  : 'text-slate-200'
              }`}
            >
              {formattedParts}
            </p>
          );
        })}
      </div>
    );
  };

  // Helper to render state update badges
  const renderStateUpdatePills = (stateUpdate?: StateUpdate) => {
    if (!stateUpdate) return null;
    const hasUpdates =
      stateUpdate.hp_change !== 0 ||
      (stateUpdate.added_items && stateUpdate.added_items.length > 0) ||
      (stateUpdate.removed_items && stateUpdate.removed_items.length > 0) ||
      stateUpdate.gold_change !== 0 ||
      stateUpdate.location_name;

    if (!hasUpdates) return null;

    return (
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60 mt-3">
        {stateUpdate.hp_change !== 0 && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
              stateUpdate.hp_change > 0
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                : 'bg-red-950/80 text-red-300 border border-red-800 animate-shake'
            }`}
          >
            <Heart className="w-3 h-3" />
            <span>
              {stateUpdate.hp_change > 0 ? `+${stateUpdate.hp_change}` : stateUpdate.hp_change} HP
            </span>
          </span>
        )}

        {stateUpdate.gold_change !== 0 && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
              stateUpdate.gold_change > 0
                ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                : 'bg-slate-900 text-slate-400 border border-slate-700'
            }`}
          >
            <Coins className="w-3 h-3 text-amber-400" />
            <span>
              {stateUpdate.gold_change > 0 ? `+${stateUpdate.gold_change}` : stateUpdate.gold_change} GP
            </span>
          </span>
        )}

        {stateUpdate.added_items?.map((item, idx) => (
          <span
            key={`add-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-950/80 text-blue-300 border border-blue-800"
          >
            <Package className="w-3 h-3" />
            <span>+ {item}</span>
          </span>
        ))}

        {stateUpdate.removed_items?.map((item, idx) => (
          <span
            key={`rem-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800 line-through"
          >
            <Package className="w-3 h-3" />
            <span>- {item}</span>
          </span>
        ))}

        {stateUpdate.location_name && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800">
            <MapPin className="w-3 h-3 text-purple-400" />
            <span>{stateUpdate.location_name}</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">
      {history.map((msg, idx) => {
        const isDm = msg.role === 'model';
        const isRollAction = msg.text.includes('[БРОСОК') || msg.text.includes('[Бросок') || msg.text.includes('[Свободный бросок');
        const msgId = msg.id || `msg_${idx}`;
        const isThisPlaying = playingMessageId === msgId;
        const isThisLoading = loadingTtsId === msgId && !isThisPlaying;

        const { cleanText, thought } = isDm
          ? extractNarrativeAndThought(msg.text, msg.thought)
          : { cleanText: msg.text, thought: undefined };

        return (
          <div
            key={msgId}
            className={`chat-message-item flex flex-col ${isDm ? 'items-start' : 'items-end'} animate-fadeIn`}
          >
            {/* Sender Label & Timestamp */}
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="text-[11px] font-bold tracking-wider uppercase flex items-center gap-1 text-slate-400">
                {isDm ? (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400 font-cinzel">Dungeon Master</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 text-cyan-400" />
                    <span className="text-cyan-300">{playerName || 'Герой'}</span>
                  </>
                )}
              </span>
              {msg.timestamp && (
                <span className="text-[10px] text-slate-600">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Message Bubble */}
            {msg.isError ? (
              <div className="max-w-[95%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 shadow-xl bg-gradient-to-r from-red-950/80 via-slate-950 to-slate-900 border-2 border-red-500/50 text-slate-200 animate-fadeIn">
                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Сбой ответа нейросети (API)</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap font-sans">
                  {cleanText.replace(/^⚠️\s*/, '')}
                </p>
                <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-red-900/40">
                  {onRetryAction && (
                    <button
                      type="button"
                      onClick={() => onRetryAction(msg.failedAction || '')}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>🔄 Повторить запрос</span>
                    </button>
                  )}
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>⚙️ Настройки API</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 shadow-lg ${
                  isDm
                    ? 'bg-slate-900/90 border border-slate-800/90 text-slate-200'
                    : isRollAction
                    ? 'bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/40 text-amber-100'
                    : 'bg-gradient-to-r from-cyan-950/40 to-slate-900 border border-cyan-800/40 text-slate-100'
                }`}
              >
                {isDm ? (
                  <>
                    {/* Collapsible Neural Thinking / Reasoning Dropdown */}
                    {thought && (
                      <details className="mb-3.5 rounded-xl bg-slate-950/90 border border-purple-500/30 overflow-hidden text-xs group">
                        <summary className="px-3 py-2 cursor-pointer text-purple-300 hover:text-purple-200 font-medium flex items-center justify-between select-none bg-purple-950/40 hover:bg-purple-950/60 transition">
                          <span className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider">
                            <Brain className="w-3.5 h-3.5 text-purple-400" />
                            <span>💭 Ход мыслей нейросети (нажмите, чтобы развернуть)</span>
                          </span>
                          <span className="text-[10px] text-purple-400/80 group-open:rotate-180 transition-transform duration-200">
                            ▼
                          </span>
                        </summary>
                        <div className="p-3 border-t border-purple-500/20 text-slate-400 text-[11px] leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto bg-slate-950">
                          {thought}
                        </div>
                      </details>
                    )}

                    {renderFormattedNarrative(cleanText)}
                    {renderStateUpdatePills(msg.stateUpdateApplied)}

                    {/* DM Footer: Edge TTS Speaker & Atmospheric Date Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        {/* Edge TTS Voice Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleTts(msgId, cleanText)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                            isThisPlaying
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                              : isThisLoading
                              ? 'bg-slate-800 text-amber-300 border-amber-500/50'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border-slate-800 hover:border-amber-500/40'
                          }`}
                          title="Озвучить речь Мастера через Microsoft Edge TTS"
                        >
                          {isThisLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              <span>Генерация голоса...</span>
                            </>
                          ) : isThisPlaying ? (
                            <>
                              <Square className="w-3 h-3 fill-current text-slate-950" />
                              <span>Остановить</span>
                              {/* Animated Audio Equalizer Wave */}
                              <span className="flex items-center gap-0.5 ml-1">
                                <span className="w-0.5 h-2.5 bg-slate-950 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-0.5 h-3.5 bg-slate-950 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-0.5 h-2 bg-slate-950 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Озвучить (Edge TTS)</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-slate-800 text-amber-300 font-semibold text-[11px] shadow-sm">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>
                            {msg.gameTime || `День 1 • ${new Date(msg.timestamp || Date.now()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-slate-400">
                        🎲 Ход Мастера
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm sm:text-[15px] leading-relaxed">
                    {isRollAction ? (
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
                          <Dices className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-amber-200">{msg.text}</span>
                      </div>
                    ) : (
                      <span>{msg.text}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Thinking Indicator */}
      {loading && (
        <div className="flex flex-col items-start animate-fadeIn">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400 font-cinzel text-[11px] font-bold uppercase tracking-wider">
              Dungeon Master
            </span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl px-5 py-3.5 flex items-center gap-3 text-xs sm:text-sm text-slate-400 italic">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>Мастер взвешивает судьбу и бросает кубики за ширмой...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
