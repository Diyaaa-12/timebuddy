import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { Clock, Sparkles, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';
import { AgentReasoning } from '../types';

interface AgentReasoningViewProps {
  reasoning: AgentReasoning | null;
  isProcessing: boolean;
  onReplan: () => void;
}

export default function AgentReasoningView({ reasoning, isProcessing, onReplan }: AgentReasoningViewProps) {
  return (
    <div className="relative rounded-3xl border border-slate-900 bg-slate-950/40 p-6 flex flex-col gap-5 select-none font-sans overflow-hidden">
      {/* Decorative ambient subtle glow */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-teal-500/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 blur-2xl rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Clock className="w-5 h-5 animate-pulse-subtle" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">TimeBuddy Cognitive Logic</h3>
            <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">Real-Time Plan Explanation</p>
          </div>
        </div>

        {reasoning && (
          <span className="text-[10px] font-mono text-slate-500">
            Updated: {new Date(reasoning.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Content Area */}
      <div className="relative z-10 min-h-[140px] flex flex-col">
        {isProcessing ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent"
            />
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest animate-pulse-subtle">
              Analyzing Constraints & Recalculating Schedule...
            </p>
          </div>
        ) : reasoning ? (
          <div className="prose prose-invert prose-xs text-slate-300 max-w-none space-y-4 text-xs leading-relaxed selection:bg-teal-500/10">
            {/* Custom markdown formatting within our app structure */}
            <div className="markdown-body">
              <ReactMarkdown 
                components={{
                  h1: ({node, ...props}) => <h1 className="text-base font-bold text-slate-100 mt-4 mb-2 border-b border-slate-900 pb-1" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-sm font-extrabold text-teal-400 mt-4 mb-1.5 font-mono uppercase tracking-wide" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-xs font-bold text-slate-200 mt-3 mb-1" {...props} />,
                  p: ({node, ...props}) => <p className="mb-3 text-slate-300 leading-relaxed font-sans" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-3 space-y-1.5" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-3 space-y-1.5" {...props} />,
                  li: ({node, ...props}) => <li className="text-slate-300 font-sans" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-extrabold text-white" {...props} />,
                  blockquote: ({node, ...props}) => (
                    <blockquote className="border-l-2 border-amber-500 bg-amber-500/5 px-4 py-2 rounded-r-xl my-3 text-slate-300 italic" {...props} />
                  ),
                }}
              >
                {reasoning.reasoning}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-400 font-sans">No active reasoning logs found.</p>
            <p className="text-[11px] text-slate-600 mt-1 max-w-xs font-sans">
              Click Sync to calculate priorities and trigger the AI agent.
            </p>
            <button
              onClick={onReplan}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Trigger Active Plan
            </button>
          </div>
        )}
      </div>

      {/* Footer Banner */}
      {reasoning && !isProcessing && (
        <div className="mt-2 p-3.5 rounded-xl bg-slate-950 border border-slate-900 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed relative z-10 font-sans">
          <AlertCircle className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
          <div>
            The agent continuously monitors your deadline constraints. Toggling a task completion or marking it missed will auto-trigger a complete schedule recalculation.
          </div>
        </div>
      )}
    </div>
  );
}
