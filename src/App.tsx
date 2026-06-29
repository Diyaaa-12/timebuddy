import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut,
  OperationType,
  handleFirestoreError
} from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch 
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Task, AgentReasoning, UserPreferences } from './types';
import Sidebar from './components/Sidebar';
import TaskForm from './components/TaskForm';
import TaskCard from './components/TaskCard';
import ScheduleView from './components/ScheduleView';
import AgentReasoningView from './components/AgentReasoningView';
import { 
  ShieldAlert, 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  LogIn, 
  Activity, 
  BookOpen,
  Sliders,
  BellRing,
  Mail
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // App states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reasoning, setReasoning] = useState<AgentReasoning | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // User preferences
  const [prefs, setPrefs] = useState<UserPreferences>({
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    accountabilityName: '',
    accountabilityEmail: ''
  });

  // 1. Listen for Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // 2. Fetch User Preferences from Firestore once logged in
  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      try {
        const prefDoc = await getDoc(doc(db, 'preferences', user.uid));
        if (prefDoc.exists()) {
          const data = prefDoc.data();
          setPrefs({
            workingHoursStart: data.workingHoursStart || '09:00',
            workingHoursEnd: data.workingHoursEnd || '17:00',
            accountabilityName: data.accountabilityName || '',
            accountabilityEmail: data.accountabilityEmail || ''
          });
        }
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, `preferences/${user.uid}`);
      }
    };
    fetchPrefs();
  }, [user]);

  // 3. Setup real-time listeners for Tasks and reasoning
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setReasoning(null);
      return;
    }

    // Listen to tasks
    const tasksQuery = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks: Task[] = [];
      snapshot.forEach((doc) => {
        fetchedTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      // Sort tasks locally by priority score descending or creation if undefined
      fetchedTasks.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
      setTasks(fetchedTasks);
    }, (error) => {
      console.error("Firestore tasks subscription error:", error);
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    // Listen to agent reasoning
    const reasoningDoc = doc(db, 'reasonings', user.uid);
    const unsubscribeReasoning = onSnapshot(reasoningDoc, (docSnap) => {
      if (docSnap.exists()) {
        setReasoning(docSnap.data() as AgentReasoning);
      } else {
        setReasoning(null);
      }
    }, (error) => {
      console.error("Firestore reasoning subscription error:", error);
      handleFirestoreError(error, OperationType.GET, `reasonings/${user.uid}`);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeReasoning();
    };
  }, [user]);

  // 4. Trigger the Express backend for agent planning (re-plan and save result to Firestore)
  const triggerAgentReplan = async (currentTasks: Task[], actionName: string = 'schedule') => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const localTimeISO = new Date().toISOString();
      const response = await fetch('/api/agent/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: currentTasks,
          currentLocalTime: localTimeISO,
          action: actionName,
          workingHoursStart: prefs.workingHoursStart,
          workingHoursEnd: prefs.workingHoursEnd,
          accountabilityName: prefs.accountabilityName || null,
          accountabilityEmail: prefs.accountabilityEmail || null
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server processing error');
      }

      const { scheduledTasks = [], agentReasoning = "" } = await response.json();

      // Write changes inside a Firestore batch to update all tasks and the reasoning text atomicly
      const batch = writeBatch(db);

      // Update tasks in Firestore
      for (const updatedTask of scheduledTasks) {
        // Only update if task exists in Firestore (ignore completed/deleted or newly completed)
        const taskRef = doc(db, 'tasks', updatedTask.id);
        batch.set(taskRef, {
          priorityScore: updatedTask.priorityScore || 0,
          scheduledStart: updatedTask.scheduledStart || null,
          scheduledEnd: updatedTask.scheduledEnd || null,
          draftMessage: updatedTask.draftMessage || null,
          status: updatedTask.status || 'pending',
          riskReason: updatedTask.riskReason || null,
          missedCount: updatedTask.missedCount !== undefined ? updatedTask.missedCount : 0,
          escalationDraft: updatedTask.escalationDraft || null,
          escalationApproved: updatedTask.escalationApproved !== undefined ? updatedTask.escalationApproved : false
        }, { merge: true });
      }

      // Save reasoning
      const reasoningRef = doc(db, 'reasonings', user.uid);
      const reasoningData: AgentReasoning = {
        id: user.uid,
        userId: user.uid,
        reasoning: agentReasoning,
        updatedAt: localTimeISO
      };
      batch.set(reasoningRef, reasoningData);

      await batch.commit();

    } catch (err: any) {
      console.error('Agent process execution failed:', err);
      handleFirestoreError(err, OperationType.WRITE, `batch-tasks-and-reasoning-${user.uid}`);
      const errMsg = (err.message || '').toLowerCase();
      if (
        errMsg.includes('503') || 
        errMsg.includes('unavailable') || 
        errMsg.includes('failed') || 
        errMsg.includes('server') || 
        errMsg.includes('processing') ||
        errMsg.includes('fetch')
      ) {
        setErrorMessage('TimeBuddy is briefly unavailable, retrying...');
      } else {
        setErrorMessage(err.message || 'An error occurred while communicating with the AI Agent.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Google authentication login action
  const handleLogin = async () => {
    if (isLoggingIn) return;
    try {
      setIsLoggingIn(true);
      setErrorMessage(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        console.log('Authentication flow cancelled or closed by user.');
        setErrorMessage('Authentication cancelled. Please try again.');
      } else {
        console.error('Login failed:', err);
        setErrorMessage(err.message || 'Authentication failed. Make sure popup blocker is disabled.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 5. App User interaction handlers
  const handleAddTask = async (taskData: Omit<Task, 'id' | 'userId' | 'status' | 'createdAt'>) => {
    if (!user) return;
    try {
      const taskCollectionRef = collection(db, 'tasks');
      const tempId = Math.random().toString(36).substring(2, 9); // Create unique temp key to trigger update batch
      
      const newTask: Omit<Task, 'id'> = {
        userId: user.uid,
        title: taskData.title,
        description: taskData.description,
        deadline: taskData.deadline,
        estimatedEffort: taskData.estimatedEffort,
        urgency: taskData.urgency,
        status: 'pending',
        tags: taskData.tags,
        createdAt: new Date().toISOString(),
        missedCount: 0,
        escalationDraft: '',
        escalationApproved: false
      };

      // Add to Firestore
      const docRef = await addDoc(taskCollectionRef, newTask);
      
      // Call replanning directly after adding the task
      const updatedTasksLocal = [...tasks, { id: docRef.id, ...newTask } as Task];
      await triggerAgentReplan(updatedTasksLocal, 'schedule');

    } catch (err: any) {
      console.error('Add task error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'tasks');
      setErrorMessage('Could not add task. Check Firestore rules.');
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = (task.status === 'completed' ? 'pending' : 'completed') as Task['status'];
    
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await setDoc(taskRef, { status: newStatus }, { merge: true });
      
      // Generate immediate local representation and trigger reprioritization
      const updatedTasksLocal = tasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      );
      await triggerAgentReplan(updatedTasksLocal, 'reprioritize');

    } catch (err) {
      console.error('Toggle complete error:', err);
      handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  const handleMarkAtRiskOrMissed = async (taskId: string, newStatus: 'pending' | 'missed' | 'at_risk') => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const statusChanged = task.status !== newStatus;
      const isEnteringRiskOrMissed = newStatus === 'missed' || newStatus === 'at_risk';
      const newMissedCount = (statusChanged && isEnteringRiskOrMissed) 
        ? (task.missedCount || 0) + 1 
        : (task.missedCount || 0);

      const taskRef = doc(db, 'tasks', taskId);
      await setDoc(taskRef, { 
        status: newStatus,
        missedCount: newMissedCount
      }, { merge: true });
      
      const updatedTasksLocal = tasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus, missedCount: newMissedCount } : t
      );
      await triggerAgentReplan(updatedTasksLocal, 'reprioritize');

    } catch (err) {
      console.error('Status override error:', err);
      handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  const handleUpdateEscalationDraft = async (taskId: string, newDraft: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await setDoc(taskRef, { escalationDraft: newDraft }, { merge: true });
    } catch (err) {
      console.error('Update escalation draft error:', err);
      handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  const handleApproveEscalationDraft = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await setDoc(taskRef, { escalationApproved: true }, { merge: true });
    } catch (err) {
      console.error('Approve escalation draft error:', err);
      handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskRef);

      const updatedTasksLocal = tasks.filter(t => t.id !== taskId);
      await triggerAgentReplan(updatedTasksLocal, 'schedule');

    } catch (err) {
      console.error('Delete task error:', err);
      handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const handleUpdateDraftMessage = async (taskId: string, newDraft: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await setDoc(taskRef, { draftMessage: newDraft }, { merge: true });
    } catch (err) {
      console.error('Update draft error:', err);
      handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  const handleApproveDraft = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await setDoc(taskRef, { approved: true }, { merge: true });
    } catch (err) {
      console.error('Approve draft error:', err);
      handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, 'preferences', user.uid), prefs);
      setNotification('Settings saved — TimeBuddy recalculating...');
      setTimeout(() => {
        setNotification(null);
      }, 3000);
      // Trigger schedule replan to account for new active hours constraints!
      await triggerAgentReplan(tasks, 'schedule');
    } catch (err) {
      console.error('Save preferences error:', err);
      handleFirestoreError(err, OperationType.WRITE, `preferences/${user.uid}`);
    }
  };

  // 6. Auth loading view
  if (authLoading) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/20"
        >
          <Clock className="w-6 h-6 text-white" />
        </motion.div>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-mono font-bold">
          Authenticating Operator...
        </p>
      </div>
    );
  }

  // 7. Logged out view
  if (!user) {
    return (
      <div className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans relative overflow-hidden">
        {/* Background visual graphics */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 blur-3xl rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 blur-3xl rounded-full" />

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: 'spring' }}
          className="w-full max-w-md bg-slate-900 border border-slate-850 p-8 rounded-3xl shadow-2xl flex flex-col items-center relative z-10"
        >
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-amber-500 flex items-center justify-center shadow-2xl shadow-teal-500/20 mb-6">
            <Clock className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white text-center leading-tight">
            TIME
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-amber-400">BUDDY</span>
          </h1>
          <p className="text-xs uppercase font-mono tracking-widest text-slate-500 mt-2 font-bold">
            Proactive Cognitive Planning Agent
          </p>

          <p className="text-slate-400 text-center text-sm leading-relaxed mt-4 mb-8 font-sans">
            A secure full-stack companion that mathematically tracks priorities, schedules non-overlapping time blocks, drafts autonomous updates, and reasons on at-risk constraints.
          </p>

          {errorMessage && (
            <div className="w-full p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-semibold font-sans">
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={`w-full py-4 px-6 rounded-xl text-sm font-extrabold flex items-center justify-center gap-3 transition-all duration-300 shadow-xl ${
              isLoggingIn 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-white hover:bg-slate-100 text-slate-900 cursor-pointer'
            }`}
          >
            <LogIn className={`w-4 h-4 ${isLoggingIn ? 'text-slate-500 animate-pulse' : 'text-slate-900'}`} />
            {isLoggingIn ? 'Authenticating...' : 'Authenticate with Google'}
          </button>

          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mt-8 text-center font-semibold">
            SECURE ACCESS AUTHORIZATION REQUIRED
          </div>
        </motion.div>
      </div>
    );
  }

  // Filter lists for dashboard overview
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'at_risk');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const missedTasks = tasks.filter(t => t.status === 'missed');
  const escalationAlerts = tasks.filter(t => t.escalationDraft && t.status !== 'completed' && (t.missedCount || 0) >= 2);

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans">
      
      {/* 1. Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        onRefresh={() => triggerAgentReplan(tasks, 'schedule')}
        isProcessing={isProcessing}
      />

      {/* 2. Main Content Stage */}
      <main className="flex-1 h-full overflow-y-auto p-8 bg-slate-950 select-none">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Header Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex justify-between items-center font-bold">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white cursor-pointer font-bold">Dismiss</button>
            </div>
          )}

          {/* TAB 1: THE MAIN TIMEBUDDY DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Header block */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    TimeBuddy Command Center
                  </h1>
                  <p className="text-xs font-mono uppercase text-slate-500 mt-0.5">Active Operation Panel</p>
                </div>
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-amber-600 hover:from-teal-500 hover:to-amber-500 text-white text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-500/15 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Task Unit
                </button>
              </div>

              {/* Status Stats bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 flex items-center gap-3.5 shadow-md">
                  <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Pending Units</span>
                    <h3 className="text-lg font-mono font-extrabold text-slate-100">{pendingTasks.length}</h3>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 flex items-center gap-3.5 shadow-md">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Completed</span>
                    <h3 className="text-lg font-mono font-extrabold text-slate-100">{completedTasks.length}</h3>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 flex items-center gap-3.5 shadow-md">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">At Risk</span>
                    <h3 className="text-lg font-mono font-extrabold text-slate-100">
                      {tasks.filter(t => t.status === 'at_risk').length}
                    </h3>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 flex items-center gap-3.5 shadow-md">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Overdue / Missed</span>
                    <h3 className="text-lg font-mono font-extrabold text-slate-100">{missedTasks.length}</h3>
                  </div>
                </div>
              </div>

              {/* Main Split Layout: Tasks list VS Agent Reasoning */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Task Section (7/12) */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Escalation Alerts Section */}
                  {escalationAlerts.length > 0 && (
                    <div className="space-y-4 pb-4">
                      <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-rose-400 flex items-center gap-2">
                        <ShieldAlert className="w-4.5 h-4.5 text-rose-500 animate-pulse" />
                        Escalation Alerts
                      </h3>
                      <div className="space-y-4">
                        {escalationAlerts.map((task) => (
                          <div 
                            key={task.id} 
                            className="p-5 rounded-2xl border border-rose-500/30 bg-rose-500/5 shadow-lg shadow-rose-500/5 flex flex-col gap-4 relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-2 text-[10px] uppercase font-mono tracking-wider text-rose-500/40 select-none pointer-events-none">
                              Severity Tier: High
                            </div>
                            
                            {/* Task meta info */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-400 uppercase font-bold">
                                  Missed Count: {task.missedCount}
                                </span>
                                <h4 className="text-sm font-semibold tracking-tight text-white mt-1">
                                  {task.title}
                                </h4>
                                {task.description && (
                                  <p className="text-xs text-slate-400 font-sans line-clamp-1">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-xs font-mono text-slate-500 shrink-0">
                                <span className="block font-bold text-rose-400">Deadline</span>
                                <span>{new Date(task.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>

                            {/* Escalation Draft block */}
                            <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/20 flex flex-col gap-3 relative">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-rose-400" />
                                  <span className="text-xs font-mono font-bold text-rose-300">
                                    Escalation draft to accountability contact
                                  </span>
                                </div>
                                {task.escalationApproved && (
                                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded px-1.5 py-0.5">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> APPROVED & READY
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-300 bg-slate-900/40 p-3 rounded-lg leading-relaxed whitespace-pre-wrap font-sans">
                                {task.escalationDraft}
                              </p>

                              <div className="flex items-center gap-2 mt-1">
                                {!task.escalationApproved ? (
                                  <button
                                    onClick={() => handleApproveEscalationDraft(task.id)}
                                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10 transition-all"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                                    Approve and Authorize Send
                                  </button>
                                ) : (
                                  <div className="text-xs font-mono text-slate-500 flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    Escalation approved by operator. Supportive check-in drafted.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                    <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-teal-500" />
                      Prioritized Task Queue
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">Sorted by Priority Score</span>
                  </div>

                  {pendingTasks.length === 0 ? (
                    <div className="p-12 border border-dashed border-slate-800 bg-slate-950/40 rounded-3xl text-center">
                      <p className="text-slate-400 text-sm font-semibold">Workspace completely clear!</p>
                      <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                        No pending units allocated. Click "New Task Unit" to initialize a task deadline.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggleComplete={handleToggleComplete}
                          onMarkAtRiskOrMissed={handleMarkAtRiskOrMissed}
                          onDelete={handleDeleteTask}
                          onUpdateDraftMessage={handleUpdateDraftMessage}
                          onApproveDraft={handleApproveDraft}
                        />
                      ))}
                    </div>
                  )}

                  {/* Completed tasks expansion */}
                  {completedTasks.length > 0 && (
                    <div className="space-y-4 pt-4">
                      <h4 className="text-xs font-bold font-mono text-slate-600 uppercase tracking-widest border-b border-slate-900 pb-1.5 flex items-center gap-1">
                        Completed Queue ({completedTasks.length})
                      </h4>
                      <div className="space-y-3 opacity-60 hover:opacity-90 transition-opacity">
                        {completedTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onToggleComplete={handleToggleComplete}
                            onMarkAtRiskOrMissed={handleMarkAtRiskOrMissed}
                            onDelete={handleDeleteTask}
                            onUpdateDraftMessage={handleUpdateDraftMessage}
                            onApproveDraft={handleApproveDraft}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Agent Reasoning Panel (5/12) */}
                <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-8">
                  <div className="pb-2 border-b border-slate-900">
                    <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <BellRing className="w-4 h-4 text-amber-500" />
                      TimeBuddy Agent Brain
                    </h3>
                  </div>
                  <AgentReasoningView 
                    reasoning={reasoning} 
                    isProcessing={isProcessing} 
                    onReplan={() => triggerAgentReplan(tasks, 'schedule')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXPLICIT TASKS VIEW (Grid view of all user tasks) */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-4">
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    Secure Task Units
                  </h1>
                  <p className="text-xs font-mono uppercase text-slate-500 mt-0.5">Database Registry List</p>
                </div>
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-amber-600 hover:from-teal-500 hover:to-amber-500 text-white text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-500/15 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Task Unit
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="py-20 text-center border border-slate-900 bg-slate-950/40 rounded-3xl">
                  <p className="text-slate-400 text-sm font-semibold">No tasks currently recorded.</p>
                  <button
                    onClick={() => setIsFormOpen(true)}
                    className="mt-4 px-4 py-2 text-xs font-mono uppercase border border-teal-500/20 bg-teal-500/5 text-teal-400 rounded-xl hover:border-teal-400 transition-all cursor-pointer"
                  >
                    Add Your First Task
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggleComplete={handleToggleComplete}
                      onMarkAtRiskOrMissed={handleMarkAtRiskOrMissed}
                      onDelete={handleDeleteTask}
                      onUpdateDraftMessage={handleUpdateDraftMessage}
                      onApproveDraft={handleApproveDraft}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SCHEDULE TIMELINE BLOCK VIEW */}
          {activeTab === 'schedule' && (
            <ScheduleView tasks={tasks} />
          )}

          {/* TAB 4: PREFERENCES & WORK ACTIVE HOURS CONFIG */}
          {activeTab === 'preferences' && (
            <div className="space-y-6 max-w-xl">
              <div className="border-b border-slate-900 pb-4">
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Cognitive Preferences
                </h1>
                <p className="text-xs font-mono uppercase text-slate-500 mt-0.5">Working hours & constraint settings</p>
              </div>

              <form onSubmit={handleSavePreferences} className="p-6 bg-slate-900 border border-slate-850 rounded-3xl shadow-xl space-y-6">
                <div className="flex items-center gap-3.5 pb-4 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Clock className="w-5 h-5 animate-spin-slow" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">Active Calendar Working Hours</h3>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">Defines your available planning boundaries</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase font-bold text-slate-400">
                      Workday Start Time
                    </label>
                    <input
                      type="time"
                      value={prefs.workingHoursStart}
                      onChange={(e) => setPrefs({ ...prefs, workingHoursStart: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-teal-500 font-mono transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase font-bold text-slate-400">
                      Workday End Time
                    </label>
                    <input
                      type="time"
                      value={prefs.workingHoursEnd}
                      onChange={(e) => setPrefs({ ...prefs, workingHoursEnd: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-teal-500 font-mono transition-all"
                    />
                  </div>
                </div>

                {/* Accountability Contact Settings Section */}
                <div className="flex items-center gap-3.5 pb-4 border-b border-slate-800 pt-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">Accountability Contact</h3>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">Escalates supportive alerts when tasks are missed multiple times</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase font-bold text-slate-400">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jane Smith"
                      value={prefs.accountabilityName || ''}
                      onChange={(e) => setPrefs({ ...prefs, accountabilityName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-rose-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase font-bold text-slate-400">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. jane@example.com"
                      value={prefs.accountabilityEmail || ''}
                      onChange={(e) => setPrefs({ ...prefs, accountabilityEmail: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-rose-500 transition-all"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900 text-xs text-slate-500 leading-normal font-sans">
                  The TimeBuddy scheduling model is mathematically constrained by these values. When a task has missed its mark twice or more, a supportive, non-alarming escalation message will be drafted automatically to check in.
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-amber-600 hover:from-teal-500 hover:to-amber-500 text-white text-xs font-bold text-white shadow-lg cursor-pointer transition-all animate-pulse-subtle"
                  >
                    Save & Re-Evaluate Plan
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* 3. New Task Unit Modal Dialog */}
      <TaskForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAddTask}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-2xl shadow-emerald-500/5 flex items-center gap-3 max-w-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">System Success</p>
              <p className="text-xs text-slate-300 font-sans mt-0.5">{notification}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
