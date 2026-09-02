'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  X,
  MapPin,
  Plus,
  Trash2,
  Bookmark,
  Users,
  Heart,
  Sparkles,
  UserPlus,
  Compass,
  Key,
  ShieldCheck,
  Scroll,
  Zap,
} from 'lucide-react';
import { PartyCompanion, LorebookEntry } from '@/types/dnd';

interface JournalEntry {
  id: string;
  timestamp: number;
  title: string;
  text: string;
  type: 'location' | 'quest' | 'npc' | 'lore';
}

interface JournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  locationsVisited: string[];
  partyCompanions: PartyCompanion[];
  nearbyNpcs?: Array<Omit<PartyCompanion, 'id'>>;
  lorebookEntries?: LorebookEntry[];
  storySummary?: string;
  onAddEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  onDeleteEntry: (id: string) => void;
  onAddCompanion: (companion: PartyCompanion) => void;
  onUpdateCompanion: (companionId: string, updater: (prev: PartyCompanion) => PartyCompanion) => void;
  onDeleteCompanion: (companionId: string) => void;
  onAddLorebookEntry?: (entry: Omit<LorebookEntry, 'id'>) => void;
  onToggleLorebookEntry?: (id: string) => void;
  onDeleteLorebookEntry?: (id: string) => void;
  onSaveStorySummary?: (summary: string) => void;
}

const AFFINITY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  devoted: { label: 'Преданность 100%', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: '💖' },
  friendly: { label: 'Дружелюбие', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30', icon: '🤝' },
  neutral: { label: 'Нейтрально / Контракт', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: '⚖️' },
  distrustful: { label: 'Настороженность', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: '⚠️' },
};

export const JournalModal: React.FC<JournalModalProps> = ({
  isOpen,
  onClose,
  entries,
  locationsVisited,
  partyCompanions = [],
  nearbyNpcs = [],
  lorebookEntries = [],
  storySummary = '',
  onAddEntry,
  onDeleteEntry,
  onAddCompanion,
  onUpdateCompanion,
  onDeleteCompanion,
  onAddLorebookEntry,
  onToggleLorebookEntry,
  onDeleteLorebookEntry,
  onSaveStorySummary,
}) => {
  const [activeTab, setActiveTab] = useState<'party' | 'lorebook' | 'locations' | 'notes'>('party');
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingCompanion, setIsAddingCompanion] = useState(false);
  const [isAddingLorebook, setIsAddingLorebook] = useState(false);

  // Companion creation form state
  const [compName, setCompName] = useState('');
  const [compRole, setCompRole] = useState('');
  const [compRelationship, setCompRelationship] = useState('');
  const [compHp, setCompHp] = useState('18');
  const [compAc, setCompAc] = useState('15');
  const [compMainStat, setCompMainStat] = useState('STR +3');
  const [compAbilities, setCompAbilities] = useState('');
  const [compPersonality, setCompPersonality] = useState('');
  const [compAffinity, setCompAffinity] = useState<'devoted' | 'friendly' | 'neutral' | 'distrustful'>('friendly');

  // Lorebook form state
  const [lbTitle, setLbTitle] = useState('');
  const [lbKeys, setLbKeys] = useState('');
  const [lbContent, setLbContent] = useState('');
  const [lbConstant, setLbConstant] = useState(false);
  const [lbCategory, setLbCategory] = useState<'npc' | 'location' | 'quest' | 'item' | 'rule'>('npc');

  // Summary state
  const [summaryText, setSummaryText] = useState(storySummary);

  if (!isOpen) return null;

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddEntry({
      title: newTitle.trim(),
      text: newText.trim(),
      type: 'lore',
    });
    setNewTitle('');
    setNewText('');
    setIsAddingNote(false);
  };

  const handleCreateCompanion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    const maxHp = parseInt(compHp) || 15;
    const ac = parseInt(compAc) || 12;

    const newComp: PartyCompanion = {
      id: `comp_${Date.now()}`,
      name: compName.trim(),
      role: compRole.trim() || 'Спутник героя',
      relationship: compRelationship.trim() || 'Верный спутник в странствиях',
      affinity: compAffinity,
      hp: maxHp,
      maxHp: maxHp,
      ac: ac,
      mainStat: compMainStat.trim() || 'STR +2',
      specialAbilities: compAbilities.trim() || 'Базовая атака оружием',
      personality: compPersonality.trim() || 'Предан отряду.',
      status: 'active',
    };

    onAddCompanion(newComp);
    setCompName('');
    setCompRole('');
    setCompRelationship('');
    setCompAbilities('');
    setCompPersonality('');
    setIsAddingCompanion(false);
  };

  const handleCreateLorebookEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lbTitle.trim() || !onAddLorebookEntry) return;

    const keysArray = lbKeys
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    onAddLorebookEntry({
      title: lbTitle.trim(),
      keys: keysArray.length > 0 ? keysArray : [lbTitle.trim().toLowerCase()],
      content: lbContent.trim(),
      enabled: true,
      constant: lbConstant,
      category: lbCategory,
    });

    setLbTitle('');
    setLbKeys('');
    setLbContent('');
    setLbConstant(false);
    setIsAddingLorebook(false);
  };

  const handleRecruitNearbyNpc = (npc: Omit<PartyCompanion, 'id'>) => {
    const newComp: PartyCompanion = {
      ...npc,
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      hp: npc.hp || npc.maxHp || 16,
      maxHp: npc.maxHp || 16,
      ac: npc.ac || 13,
      mainStat: npc.mainStat || 'STR +2',
      specialAbilities: npc.specialAbilities || 'Помощь в бою и исследованиях',
      personality: npc.personality || 'Следует за героем.',
      affinity: npc.affinity || 'friendly',
      status: 'active',
    };
    onAddCompanion(newComp);
  };

  // Filter nearby NPCs that are not already recruited in the party
  const partyNames = new Set(partyCompanions.map((c) => c.name.toLowerCase().trim()));
  const unrecruitedNpcs = nearbyNpcs.filter(
    (npc) => !partyNames.has(npc.name.toLowerCase().trim())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400 shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel font-bold text-base sm:text-lg text-purple-200">
                Журнал, Лорбук и Летопись
              </h3>
              <p className="text-[11px] text-slate-400">Спутники отряда, база знаний SillyTavern World Info и хроника</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex gap-1.5 p-2.5 bg-slate-950 border-b border-slate-800 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('party')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer ${
              activeTab === 'party'
                ? 'bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>Отряд ({partyCompanions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lorebook')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer ${
              activeTab === 'lorebook'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Key className="w-4 h-4 text-cyan-400" />
            <span>Лорбук / Память ({lorebookEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('locations')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer ${
              activeTab === 'locations'
                ? 'bg-purple-950/80 text-purple-300 border border-purple-600/50 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4 text-purple-400" />
            <span>Локации ({locationsVisited.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-purple-950/80 text-purple-300 border border-purple-600/50 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4 text-blue-400" />
            <span>Заметки ({entries.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* ================= TAB 1: PARTY & COMPANIONS ================= */}
          {activeTab === 'party' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase text-amber-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" /> Члены вашего отряда ({partyCompanions.length}):
                </span>
                <button
                  onClick={() => setIsAddingCompanion(!isAddingCompanion)}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Добавить спутника</span>
                </button>
              </div>

              {isAddingCompanion && (
                <form
                  onSubmit={handleCreateCompanion}
                  className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-xl animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="text-xs font-bold text-amber-300 uppercase">Новый член отряда / Спутник</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCompanion(false)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Имя персонажа:</label>
                      <input
                        type="text"
                        placeholder="Например: Лиана, Ронан, Сильвия..."
                        value={compName}
                        onChange={(e) => setCompName(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Роль / Класс:</label>
                      <input
                        type="text"
                        placeholder="Например: Жрица Света, Воин-щитоносец..."
                        value={compRole}
                        onChange={(e) => setCompRole(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                      Связь с главным персонажем (как встретились / почему в отряде):
                    </label>
                    <input
                      type="text"
                      placeholder="Например: Спасенная из плена / Старый друг детства / Наемник..."
                      value={compRelationship}
                      onChange={(e) => setCompRelationship(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Макс. HP:</label>
                      <input
                        type="number"
                        value={compHp}
                        onChange={(e) => setCompHp(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 text-center focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Броня (AC):</label>
                      <input
                        type="number"
                        value={compAc}
                        onChange={(e) => setCompAc(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 text-center focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Главный стат:</label>
                      <input
                        type="text"
                        value={compMainStat}
                        onChange={(e) => setCompMainStat(e.target.value)}
                        placeholder="STR +3 / WIS +3"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-100 text-center focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                      Способности, атаки и заклинания:
                    </label>
                    <input
                      type="text"
                      placeholder="Например: Исцеляющее слово (1d4+3), Удар щитом, Скрытая атака..."
                      value={compAbilities}
                      onChange={(e) => setCompAbilities(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingCompanion(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-md transition"
                    >
                      Сохранить спутника
                    </button>
                  </div>
                </form>
              )}

              {partyCompanions.length > 0 ? (
                <div className="space-y-3">
                  {partyCompanions.map((comp) => {
                    const hpPercent = Math.round((comp.hp / (comp.maxHp || 1)) * 100);
                    const affinityInfo = AFFINITY_LABELS[comp.affinity] || AFFINITY_LABELS.friendly;

                    return (
                      <div
                        key={comp.id}
                        className="bg-slate-950/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-md transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-purple-700 flex items-center justify-center text-slate-950 font-cinzel font-bold text-sm shadow-md border border-amber-400/40">
                              {comp.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-cinzel text-base font-bold text-amber-200">{comp.name}</h4>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800 font-semibold">
                                  {comp.role}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full border mt-0.5 ${affinityInfo.color}`}
                              >
                                <span>{affinityInfo.icon}</span>
                                <span>{affinityInfo.label}</span>
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => onDeleteCompanion(comp.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition cursor-pointer"
                            title="Удалить из отряда"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2 text-xs">
                          <span className="text-[10px] uppercase font-bold text-amber-400/80 block mb-0.5">
                            Связь с главным героем:
                          </span>
                          <p className="text-slate-200 italic leading-relaxed">{comp.relationship}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1 text-red-400 font-bold">
                                <Heart className="w-3.5 h-3.5 fill-red-400/20" />
                                <span>{comp.hp}/{comp.maxHp} HP</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">Здоровье</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className={`h-full transition-all ${
                                  hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${hpPercent}%` }}
                              />
                            </div>
                          </div>

                          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-around text-center text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Броня (AC)</span>
                              <span className="font-bold text-blue-300 text-sm">{comp.ac} AC</span>
                            </div>
                            <div className="h-6 w-[1px] bg-slate-800" />
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Стат</span>
                              <span className="font-bold text-amber-300 text-xs">{comp.mainStat}</span>
                            </div>
                          </div>

                          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-center items-center text-center text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Статус</span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                comp.status === 'active'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : comp.status === 'injured'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-red-500/20 text-red-300'
                              }`}
                            >
                              {comp.status === 'active' ? 'В строю' : comp.status === 'injured' ? 'Ранен' : 'Без сознания'}
                            </span>
                          </div>
                        </div>

                        {comp.specialAbilities && (
                          <div className="text-xs text-slate-300">
                            <span className="text-[10px] uppercase font-bold text-purple-400 block mb-0.5">
                              Способности и атаки:
                            </span>
                            <p className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/80 text-[11px]">
                              {comp.specialAbilities}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-2">
                  <Users className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="font-cinzel text-sm font-bold text-slate-300">В отряде пока нет спутников</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Вы путешествуете в одиночку. Приглашайте встреченных персонажей из сюжета ниже!
                  </p>
                </div>
              )}

              {/* Recruitable Nearby Characters */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-xs font-bold uppercase text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Персонажи рядом с вами (из сюжета):
                  </span>
                  <span className="text-[10px] text-slate-500">В текущей локации</span>
                </div>

                {unrecruitedNpcs.length > 0 ? (
                  <div className="space-y-2.5">
                    {unrecruitedNpcs.map((npc, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-cinzel text-sm font-bold text-amber-200">{npc.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-300 border border-slate-700 font-medium">
                              {npc.role}
                            </span>
                            {npc.ac && (
                              <span className="text-[10px] text-blue-400 font-bold">
                                {npc.ac} AC
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 italic">
                            «{npc.relationship}»
                          </p>
                          {npc.specialAbilities && (
                            <p className="text-[10px] text-purple-300/90">
                              ✨ {npc.specialAbilities}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => handleRecruitNearbyNpc(npc)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Пригласить в отряд</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900/50 rounded-xl text-center space-y-1">
                    <p className="text-xs text-slate-400">
                      В этой сцене пока нет свободных NPC.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Общайтесь с персонажами в тавернах, спасайте пленников или нанимайте проводников в диалогах с Мастером — они сразу появятся здесь!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 2: LOREBOOK & WORLD INFO ================= */}
          {activeTab === 'lorebook' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Lorebook Info Banner */}
              <div className="bg-gradient-to-r from-cyan-950/60 to-blue-950/50 border border-cyan-500/30 rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span>SillyTavern World Info (Лорбук памяти)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Записи из этого лорбука автоматически внедряются в память нейросети, когда в чате упоминаются их ключевые слова (или при включенном режиме «Всегда активно»).
                </p>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase text-cyan-300 flex items-center gap-1.5">
                  <Key className="w-4 h-4" /> Записи базы знаний ({lorebookEntries.length}):
                </span>
                <button
                  onClick={() => setIsAddingLorebook(!isAddingLorebook)}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать запись лора</span>
                </button>
              </div>

              {/* Form: Add Lorebook Entry */}
              {isAddingLorebook && (
                <form
                  onSubmit={handleCreateLorebookEntry}
                  className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-xl animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="text-xs font-bold text-cyan-300 uppercase">Новая сущность лорбука</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingLorebook(false)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Название / Сущность:</label>
                      <input
                        type="text"
                        placeholder="Например: Лиана, Темный Культ, Эльдория..."
                        value={lbTitle}
                        onChange={(e) => setLbTitle(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Категория:</label>
                      <select
                        value={lbCategory}
                        onChange={(e) => setLbCategory(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="npc">Персонаж (NPC)</option>
                        <option value="location">Локация / Город</option>
                        <option value="quest">Сюжетный Квест / Тайна</option>
                        <option value="item">Артефакт / Предмет</option>
                        <option value="rule">Закон / Правило мира</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                      Ключевые слова-триггеры (через запятую):
                    </label>
                    <input
                      type="text"
                      placeholder="лиана, жрица, эльфийка, культ, амулет..."
                      value={lbKeys}
                      onChange={(e) => setLbKeys(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                      Содержание и факты для памяти ИИ:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Опишите факты, предысторию, мотивы, характер или свойства, которые ИИ обязан помнить..."
                      value={lbContent}
                      onChange={(e) => setLbContent(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lbConstant}
                        onChange={(e) => setLbConstant(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                      />
                      <span>Всегда активно (Constant — внедрять в каждый ход)</span>
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingLorebook(false)}
                        className="px-3 py-1 rounded-xl border border-slate-800 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-md transition"
                      >
                        Сохранить в Лорбук
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* List of Lorebook Entries */}
              {lorebookEntries.length > 0 ? (
                <div className="space-y-3">
                  {lorebookEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`bg-slate-950/90 border rounded-2xl p-4 space-y-2 transition ${
                        entry.enabled ? 'border-slate-800 hover:border-cyan-500/40' : 'border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-cinzel text-sm font-bold text-cyan-200">{entry.title}</h4>
                          {entry.constant && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                              Постоянно активно
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                            {entry.category || 'лор'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {onToggleLorebookEntry && (
                            <button
                              type="button"
                              onClick={() => onToggleLorebookEntry(entry.id)}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                                entry.enabled
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-slate-900 text-slate-500 border-slate-800'
                              }`}
                            >
                              {entry.enabled ? 'ВКЛ' : 'ВЫКЛ'}
                            </button>
                          )}
                          {onDeleteLorebookEntry && (
                            <button
                              type="button"
                              onClick={() => onDeleteLorebookEntry(entry.id)}
                              className="p-1 text-slate-600 hover:text-red-400 transition"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {entry.keys && entry.keys.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Триггеры:</span>
                          {entry.keys.map((k, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-cyan-300/90 border border-slate-800">
                              {k}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80">
                        {entry.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-2">
                  <Key className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="font-cinzel text-sm font-bold text-slate-300">Лорбук пока пуст</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Добавьте важных персонажей, фракции или законы магии с ключевыми словами — нейросеть будет мгновенно вспоминать их!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: LOCATIONS ================= */}
          {activeTab === 'locations' && (
            <div className="space-y-3 animate-fadeIn">
              <span className="text-xs font-bold uppercase text-slate-400 block">Исследованные земли:</span>
              <div className="space-y-2">
                {locationsVisited.map((loc, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-200">{loc}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800">
                      Открыто
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 4: NOTES & CHRONICLE ================= */}
          {activeTab === 'notes' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase text-slate-400">Личные заметки героя:</span>
                <button
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить запись</span>
                </button>
              </div>

              {isAddingNote && (
                <form onSubmit={handleCreateNote} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <input
                    type="text"
                    placeholder="Заголовок (например: Странный символ на алтаре)..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                  <textarea
                    placeholder="Текст заметки или детали квеста..."
                    rows={3}
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNote(false)}
                      className="px-3 py-1 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-sm"
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              )}

              {entries.length > 0 ? (
                <div className="space-y-2.5">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 relative group"
                    >
                      <div className="flex items-center justify-between pr-6">
                        <h4 className="font-bold text-xs text-purple-300">{entry.title}</h4>
                        <span className="text-[10px] text-slate-500">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                      <button
                        onClick={() => onDeleteEntry(entry.id)}
                        className="absolute top-3 right-3 text-slate-600 hover:text-red-400 transition"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">
                  Записей пока нет. Нажмите «Добавить запись», чтобы зафиксировать важные детали квеста.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
