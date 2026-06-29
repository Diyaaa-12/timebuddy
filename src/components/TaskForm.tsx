import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, Sparkles, Plus, AlertCircle } from 'lucide-react';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: {
    title: string;
    description?: string;
    deadline: string;
    estimatedEffort: number; // in minutes
    urgency: number; // 1-5
    tags: string[];
  }) => void;
}

export default function TaskForm({ isOpen, onClose, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [effortValue, setEffortValue] = useState<number>(30);
  const [effortUnit, setEffortUnit] = useState<'m' | 'h'>('m');
  const [urgency, setUrgency] = useState<number>(3);
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleAddTag = (tagToAdd?: string) => {
    const tag = (tagToAdd || tagInput).trim().toLowerCase();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Please enter a task title.");
      return;
    }

    if (!deadlineDate) {
      setFormError("Please select a date.");
      return;
    }

    let finalTime = deadlineTime;
    if (!finalTime) {
      // Default to current time if left blank
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      finalTime = `${hours}:${minutes}`;
    }

    const combinedDeadline = `${deadlineDate}T${finalTime}`;
    const parsedDate = new Date(combinedDeadline);
    if (isNaN(parsedDate.getTime())) {
      setFormError("Please also set a time.");
      return;
    }

    // Convert estimated effort to minutes
    const estimatedEffort = effortUnit === 'h' ? effortValue * 60 : effortValue;

    onSubmit({
      title,
      description: description.trim() || undefined,
      deadline: combinedDeadline,
      estimatedEffort,
      urgency,
      tags: selectedTags,
    });

    // Reset Form
    setTitle('');
    setDescription('');
    setDeadlineDate('');
    setDeadlineTime('');
    setFormError(null);
    setEffortValue(30);
    setEffortUnit('m');
    setUrgency(3);
    setSelectedTags([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-teal-500/5 overflow-hidden z-10"
          >
            {/* Header banner decoration */}
            <div className="h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-amber-500" />

            <div className="p-6 space-y-6">
              {/* Top Row: Icon, Title, and Close */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Sparkles className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-slate-100 font-bold text-sm">Initialize New Task</h3>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">TIMEBUDDY ACTIVE INPUT</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Task Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Draft quarterly board presentation"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-teal-500 transition-all font-sans"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Context Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide exact task context, dependencies, or goals..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-teal-500 transition-all resize-none font-sans"
                  />
                </div>

                {/* Deadline & Effort Stack */}
                <div className="space-y-4">
                  {/* Deadline */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Absolute Deadline <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-[3]">
                        <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="date"
                          required
                          value={deadlineDate}
                          onChange={(e) => {
                            setDeadlineDate(e.target.value);
                            setFormError(null);
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-all font-sans"
                        />
                      </div>
                      <div className="relative flex-[2]">
                        <Clock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="time"
                          value={deadlineTime}
                          onChange={(e) => {
                            setDeadlineTime(e.target.value);
                            setFormError(null);
                          }}
                          placeholder="HH:MM"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-all font-sans"
                        />
                      </div>
                    </div>
                    {formError && (
                      <div className="text-rose-400 text-[11px] font-mono flex items-center gap-1.5 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}
                  </div>

                  {/* Effort */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Estimated Effort
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        required
                        value={effortValue}
                        onChange={(e) => setEffortValue(Number(e.target.value))}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-all font-sans"
                      />
                      <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0">
                        {(['m', 'h'] as const).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => {
                              setEffortUnit(unit);
                              // Simple scaling adjustment on toggle
                              if (unit === 'h' && effortUnit === 'm') {
                                setEffortValue(Math.max(1, Math.round(effortValue / 60)));
                              } else if (unit === 'm' && effortUnit === 'h') {
                                setEffortValue(effortValue * 60);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                              effortUnit === unit
                                ? 'bg-teal-500/15 border border-teal-500/30 text-teal-400'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {unit === 'm' ? 'MIN' : 'HRS'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Urgency Rank */}
                <div className="space-y-1.5">
                  <span className="text-xs font-mono font-bold text-teal-400">
                    Urgency Weighting: {urgency}
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    {([1, 2, 3, 4, 5] as const).map((level) => {
                      const colors = {
                        1: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
                        2: 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20',
                        3: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20',
                        4: 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20',
                        5: 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20',
                      };
                      const activeClass = urgency === level ? colors[level] + ' border-2 shadow-lg shadow-teal-500/5' : 'border-slate-800 text-slate-500 hover:text-slate-300';
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setUrgency(level)}
                          className={`py-2 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${activeClass}`}
                        >
                          {level === 1 ? 'LOW' : level === 5 ? 'CRIT' : level}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tag Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Context Tags
                    </label>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                      <AlertCircle className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                      Type and press Add
                    </span>
                  </div>

                  {/* Predefined tag shortcuts */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['send email', 'send message', 'focus', 'admin', 'review'].map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      const isSpecial = tag === 'send email' || tag === 'send message';
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddTag(tag)}
                          disabled={isSelected}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                            isSelected 
                              ? 'opacity-40 cursor-not-allowed border-transparent text-slate-600'
                              : isSpecial
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                          }`}
                        >
                          + {tag}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add custom tags..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs placeholder:text-slate-600 focus:outline-none focus:border-teal-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag()}
                      className="px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Selected Tags list */}
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {selectedTags.map((tag) => {
                        const isSpecial = tag === 'send email' || tag === 'send message';
                        return (
                          <span
                            key={tag}
                            className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              isSpecial
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                            }`}
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:text-rose-400 font-bold shrink-0 ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Draft notification explanation */}
                  {selectedTags.some(t => t === 'send email' || t === 'send message') && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex gap-2.5 mt-2">
                      <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 mt-0.5 text-amber-400">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[11px] leading-relaxed text-slate-400">
                        <span className="font-semibold text-slate-300">Autonomous Drafts enabled</span>: Tagging tasks with <span className="font-mono text-amber-400 font-bold">send email</span> or <span className="font-mono text-amber-400 font-bold">send message</span> triggers the TimeBuddy Agent to draft exact communication copy. You can inspect, modify, and mailto/copy it upon approval.
                      </div>
                    </div>
                  )}
                </div>

                {formError && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5 font-bold"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{formError}</span>
                  </motion.div>
                )}

                {/* Submit Row */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-900/60">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-3 rounded-xl hover:bg-slate-850 text-xs font-mono font-bold text-slate-400 hover:text-slate-200 cursor-pointer transition-all"
                  >
                    Cancel Action
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-amber-600 hover:from-teal-500 hover:to-amber-500 text-xs font-bold text-white shadow-lg shadow-teal-500/20 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Deploy Task
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
