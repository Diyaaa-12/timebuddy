import React from 'react';
import { motion } from 'motion/react';
import { 
  Clock, 
  LayoutDashboard, 
  Calendar, 
  Settings, 
  LogOut, 
  Sparkles,
  CheckSquare
} from 'lucide-react';
import { auth } from '../firebase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onRefresh: () => void;
  isProcessing: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, user, onRefresh, isProcessing }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'TimeBuddy Deck', icon: LayoutDashboard },
    { id: 'tasks', label: 'Secure Tasks', icon: CheckSquare },
    { id: 'schedule', label: 'Blocked Timeline', icon: Calendar },
    { id: 'preferences', label: 'Agent Config', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="w-80 h-full bg-slate-950 border-r border-slate-900 text-slate-100 flex flex-col justify-between p-6 select-none font-sans">
      <div className="flex flex-col gap-8">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-amber-500 flex items-center justify-center shadow-lg shadow-teal-500/20 animate-pulse-subtle">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
              TIME
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-amber-400">BUDDY</span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest font-mono text-slate-500 mt-1 font-semibold">
              AI TimeBuddy Agent v1.2
            </p>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-900 flex items-center gap-3">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="w-10 h-10 rounded-xl object-cover border border-teal-500/30"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
                {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="overflow-hidden">
              <h2 className="text-xs font-semibold text-slate-200 truncate">{user.displayName || 'Operator'}</h2>
              <p className="text-[10px] font-mono text-teal-400 truncate mt-0.5">{user.email}</p>
            </div>
          </div>
        )}

        {/* Sync Agent Button */}
        <button
          onClick={onRefresh}
          disabled={isProcessing}
          className="relative group w-full py-3 px-4 rounded-xl font-bold text-xs font-mono uppercase tracking-wider text-white bg-slate-900 border border-teal-500/30 hover:border-teal-500/60 overflow-hidden transition-all duration-300 shadow-lg cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="inline-block"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </motion.span>
              PLANNING STATE...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              SYNC TIMEBUDDY AI
            </span>
          )}
        </button>

        {/* Navigation Menu */}
        <nav className="flex flex-col gap-1.5 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative group w-full py-3.5 px-4 rounded-xl flex items-center gap-3.5 font-medium text-sm transition-all duration-300 cursor-pointer ${
                  isActive 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active-indicator" 
                    className="absolute inset-0 bg-teal-500/10 border border-teal-500/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 ${isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Footer */}
      <button
        onClick={handleLogout}
        className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 hover:border-rose-500/20 border border-transparent transition-all duration-300 cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        Terminate Session
      </button>
    </div>
  );
}
