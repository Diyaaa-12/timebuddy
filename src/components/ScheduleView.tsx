import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { Task } from '../types';

interface ScheduleViewProps {
  tasks: Task[];
}

export default function ScheduleView({ tasks }: ScheduleViewProps) {
  // Filter for active/completed tasks with schedule time blocks
  const scheduledTasks = tasks
    .filter(t => t.scheduledStart && t.scheduledEnd)
    .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());

  // Group tasks by Day
  const groupTasksByDay = () => {
    const groups: { [key: string]: Task[] } = {};
    for (const t of scheduledTasks) {
      const dateKey = new Date(t.scheduledStart!).toLocaleDateString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(t);
    }
    return groups;
  };

  const groupedDays = groupTasksByDay();
  const dayKeys = Object.keys(groupedDays);

  if (scheduledTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 border border-slate-900 bg-slate-950/40 rounded-3xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4 shadow-xl">
          <Calendar className="w-8 h-8" />
        </div>
        <h3 className="text-slate-200 font-bold text-base">No Schedule Blocks Allocated</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-sm leading-relaxed font-sans">
          Your TimeBuddy AI hasn't structured any time slots yet. Click <span className="font-mono text-teal-400">Sync TimeBuddy AI</span> on the sidebar to prioritize and block your schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 select-none font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            AI Scheduled Time-Blocks
          </h2>
          <p className="text-xs text-slate-500 font-mono uppercase mt-0.5">Chronological Daily Execution Plan</p>
        </div>
        <span className="px-3 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold font-mono rounded-xl">
          {scheduledTasks.length} Allocated Blocks
        </span>
      </div>

      <div className="space-y-10">
        {dayKeys.map((day, dIdx) => (
          <div key={day} className="space-y-5">
            {/* Day Header */}
            <h3 className="text-sm font-extrabold tracking-wide text-slate-400 uppercase font-mono border-b border-slate-900 pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-500" />
              {day}
            </h3>

            {/* Vertical Timeline wrapper */}
            <div className="relative pl-6 space-y-6">
              {/* Vertical line connector */}
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-teal-500/30 via-teal-500/10 to-transparent" />

              {groupedDays[day].map((task, tIdx) => {
                const startTime = new Date(task.scheduledStart!).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                });
                const endTime = new Date(task.scheduledEnd!).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                const isAtRisk = task.status === 'at_risk';
                const isCompleted = task.status === 'completed';

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: tIdx * 0.05 }}
                    className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      isCompleted 
                        ? 'bg-slate-950/40 border-slate-900 text-slate-500' 
                        : isAtRisk 
                          ? 'bg-amber-500/5 border-amber-500/30 text-slate-200 shadow-lg shadow-amber-500/5' 
                          : 'bg-slate-900/40 border-slate-800 text-slate-200 hover:border-slate-700 shadow-md'
                    }`}
                  >
                    {/* Timeline Node Icon on the vertical bar */}
                    <div className={`absolute -left-[22px] w-3 h-3 rounded-full border-2 ${
                      isCompleted 
                        ? 'bg-emerald-500 border-emerald-400' 
                        : isAtRisk 
                          ? 'bg-amber-500 border-amber-400 animate-ping-subtle' 
                          : 'bg-teal-500 border-teal-400'
                    }`} />

                    {/* Left block: Times and title */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
                      {/* Time slot indicator */}
                      <div className="flex items-center gap-2 bg-slate-950 border border-slate-900 py-1.5 px-3 rounded-xl shrink-0 font-mono text-xs font-bold text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>{startTime} - {endTime}</span>
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-0.5">
                        <h4 className={`text-sm font-semibold tracking-tight ${isCompleted ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-slate-500 line-clamp-1 font-sans">{task.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Right block: Status chips & alert triggers */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                      {/* Effort Tag */}
                      <span className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-900 px-2 py-1 rounded-lg text-slate-500">
                        {task.estimatedEffort} Min
                      </span>

                      {/* Status label */}
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">
                          <CheckCircle2 className="w-3 h-3" /> DONE
                        </span>
                      ) : isAtRisk ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 animate-pulse-subtle">
                          <AlertCircle className="w-3 h-3" /> AT RISK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded px-2 py-1">
                          SLOTTED
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
