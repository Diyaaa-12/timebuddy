import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Check, 
  Mail, 
  MessageSquare, 
  ExternalLink,
  Edit,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (taskId: string) => void;
  onMarkAtRiskOrMissed: (taskId: string, newStatus: 'pending' | 'missed' | 'at_risk') => void;
  onDelete: (taskId: string) => void;
  onUpdateDraftMessage: (taskId: string, draft: string) => void;
  onApproveDraft: (taskId: string) => void;
}

export default function TaskCard({ 
  task, 
  onToggleComplete, 
  onMarkAtRiskOrMissed, 
  onDelete,
  onUpdateDraftMessage,
  onApproveDraft
}: TaskCardProps) {
  const [isDraftEditing, setIsDraftEditing] = useState(false);
  const [editedDraft, setEditedDraft] = useState(task.draftMessage || '');
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const isCommunicationTask = task.tags.includes('send email') || task.tags.includes('send message');

  const formattedDeadline = new Date(task.deadline).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getUrgencyBadge = (u: number) => {
    const labels = ["", "Low", "Moderate", "Medium", "High", "Critical"];
    const colors = [
      "", 
      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      "text-blue-400 bg-blue-500/10 border-blue-500/20",
      "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
      "text-orange-400 bg-orange-500/10 border-orange-500/20",
      "text-rose-400 bg-rose-500/10 border-rose-500/20"
    ];
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${colors[u] || colors[3]}`}>
        {labels[u] || labels[3]}
      </span>
    );
  };

  const getStatusStyle = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'border-emerald-500/30 bg-emerald-500/5 shadow-emerald-500/5';
      case 'missed': return 'border-rose-500/30 bg-rose-500/5 shadow-rose-500/5';
      case 'at_risk': return 'border-amber-500/40 bg-amber-500/5 shadow-amber-500/5 animate-pulse-subtle';
      default: return 'border-slate-800 bg-slate-900/40 hover:border-slate-700';
    }
  };

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(task.draftMessage || '');
    alert('Draft copied to clipboard!');
  };

  const handleMailto = () => {
    const isEmail = task.tags.includes('send email');
    const subject = encodeURIComponent(`Regarding Task: ${task.title}`);
    const body = encodeURIComponent(task.draftMessage || '');
    
    if (isEmail) {
      window.open(`mailto:?subject=${subject}&body=${body}`);
    } else {
      window.open(`sms:?body=${body}`);
    }
    onApproveDraft(task.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`relative rounded-2xl border p-5 transition-all duration-300 flex flex-col gap-4 shadow-lg ${getStatusStyle(task.status)}`}
    >
      {/* Top row: Checkbox, Title, Badges */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1">
          {/* Status Toggle Checkbox */}
          <button
            onClick={() => onToggleComplete(task.id)}
            className={`w-5.5 h-5.5 rounded-lg border flex items-center justify-center shrink-0 cursor-pointer mt-1 transition-all ${
              task.status === 'completed'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 text-white'
                : 'border-slate-700 hover:border-teal-400 text-transparent hover:text-teal-400'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>

          {/* Title and Description */}
          <div className="space-y-1 overflow-hidden">
            <h4 className={`text-sm font-semibold tracking-tight leading-snug truncate ${
              task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-100'
            }`}>
              {task.title}
            </h4>
            {task.description && (
              <p className={`text-xs font-sans line-clamp-2 leading-relaxed ${
                task.status === 'completed' ? 'text-slate-600' : 'text-slate-400'
              }`}>
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Priority and Trash */}
        <div className="flex items-center gap-2 shrink-0">
          {task.priorityScore && task.priorityScore > 0 ? (
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 flex flex-col items-center">
              <span className="text-[9px] font-mono font-bold uppercase text-teal-400 leading-none">Priority</span>
              <span className="text-xs font-mono font-extrabold text-teal-300 mt-0.5 leading-none">{task.priorityScore}</span>
            </div>
          ) : null}
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meta attributes: Deadline, Effort, Tags */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-slate-500 border-t border-slate-900 pt-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span className={task.status === 'at_risk' ? 'text-amber-400 font-bold' : ''}>{formattedDeadline}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {task.estimatedEffort >= 60 
              ? `${Math.round(task.estimatedEffort / 60 * 10) / 10} hr`
              : `${task.estimatedEffort} min`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {getUrgencyBadge(task.urgency)}
        </div>
        {task.missedCount !== undefined && task.missedCount > 0 ? (
          <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 text-[10px] text-rose-400 font-mono font-bold shrink-0">
            <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
            Missed: {task.missedCount}
          </div>
        ) : null}
      </div>

      {/* Tags capsules */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.tags.map((tag) => {
            const isSpecial = tag === 'send email' || tag === 'send message';
            return (
              <span 
                key={tag} 
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isSpecial 
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* At Risk alert description banner */}
      {task.status === 'at_risk' && task.riskReason && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 mt-1 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400 animate-bounce" />
          <div className="space-y-0.5">
            <span className="font-bold font-mono text-[10px] uppercase tracking-wider block text-amber-400">At Risk Warning</span>
            <p className="font-sans leading-relaxed text-amber-200">{task.riskReason}</p>
          </div>
        </div>
      )}

      {/* Special Autonomous Action: Draft Message Box */}
      {isCommunicationTask && task.draftMessage && task.status !== 'completed' && (
        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/10 flex flex-col gap-3 mt-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 text-[10px] uppercase font-mono tracking-wider text-amber-500/30 select-none pointer-events-none">
            Agent Autonomous Draft
          </div>
          <div className="flex items-center gap-2">
            {task.tags.includes('send email') ? (
              <Mail className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-xs font-mono font-bold text-amber-300">
              {task.tags.includes('send email') ? 'PROPOSED EMAIL' : 'PROPOSED CHAT MESSAGE'}
            </span>
            {task.approved && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded px-1.5 py-0.5">
                <Check className="w-3 h-3" /> APPROVED
              </span>
            )}
          </div>

          {/* Draft text display or edit form */}
          {isDraftEditing ? (
            <textarea
              value={editedDraft}
              onChange={(e) => setEditedDraft(e.target.value)}
              rows={4}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
            />
          ) : (
            <p className="text-xs text-slate-300 bg-slate-900/50 border border-slate-900 p-3 rounded-lg leading-relaxed whitespace-pre-wrap font-sans select-text select-all selection:bg-amber-500/20">
              {task.draftMessage}
            </p>
          )}

          {/* Buttons: Edit, Approve, Launch */}
          <div className="flex gap-2">
            {isDraftEditing ? (
              <>
                <button
                  onClick={() => {
                    onUpdateDraftMessage(task.id, editedDraft);
                    setIsDraftEditing(false);
                  }}
                  className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold hover:bg-amber-500/30 cursor-pointer transition-all"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => {
                    setEditedDraft(task.draftMessage || '');
                    setIsDraftEditing(false);
                  }}
                  className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-750 cursor-pointer transition-all"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsDraftEditing(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-mono flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Draft
                </button>
                <button
                  onClick={handleMailto}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-teal-600 hover:from-amber-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/10"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {task.tags.includes('send email') ? 'Launch Email' : 'Launch Message'}
                </button>
                <button
                  onClick={handleCopyDraft}
                  className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 rounded-lg transition-all cursor-pointer"
                  title="Copy Text to Clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual status correction overrides for the user */}
      <div className="flex items-center justify-between border-t border-slate-900/60 pt-3 mt-1">
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-teal-400 flex items-center gap-1 transition-all cursor-pointer"
          >
            Adjust TimeBuddy State
            {showStatusMenu ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showStatusMenu && (
            <div className="absolute left-0 bottom-full mb-1 w-36 rounded-xl bg-slate-900 border border-slate-800 p-1 flex flex-col z-10 shadow-xl">
              {(['pending', 'at_risk', 'missed'] as const).map((status) => {
                const labels = { pending: 'Pending', at_risk: 'At Risk ⚠️', missed: 'Missed ❌' };
                const isCurrent = task.status === status;
                return (
                  <button
                    key={status}
                    onClick={() => {
                      onMarkAtRiskOrMissed(task.id, status);
                      setShowStatusMenu(false);
                    }}
                    className={`px-3 py-1.5 text-left text-xs font-semibold rounded-lg cursor-pointer ${
                      isCurrent 
                        ? 'bg-teal-500/10 text-teal-400' 
                        : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    {labels[status]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Timeblock allocation metadata */}
        {task.scheduledStart && task.scheduledEnd && task.status !== 'completed' ? (
          <span className="text-[10px] font-mono text-teal-400 flex items-center gap-1 bg-teal-500/5 px-2.5 py-1 rounded-lg border border-teal-500/10 animate-pulse-subtle">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Blocked: {new Date(task.scheduledStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(task.scheduledEnd).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-600">No Block Slotted</span>
        )}
      </div>
    </motion.div>
  );
}
