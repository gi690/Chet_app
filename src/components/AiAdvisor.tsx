import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, DollarSign, Send, CheckCircle2, AlertCircle, Loader2, TrendingUp, Wallet } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';

interface AiAdvisorProps {
  onClose: () => void;
}

interface AiTask {
  id: string;
  prompt: string;
  response?: string;
  status?: any;
  createdAt: any;
}

export const AiAdvisor: React.FC<AiAdvisorProps> = ({ onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // This query listens for documents created by the user
    // The extension will populate the 'response' field automatically if installed
    const q = query(
      collection(db, 'ai_tasks'),
      where('createdBy', '==', user.uid),
      limit(20)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AiTask[];
      // Client-side sort to avoid composite index requirement
      const sorted = docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setTasks(sorted.slice(0, 5));
    });

    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const finalPrompt = typeof e === 'string' ? e : prompt;
    
    if (!finalPrompt.trim() || !user) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'ai_tasks'), {
        prompt: finalPrompt,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      if (typeof e !== 'string') setPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const financeShortcuts = [
    { 
      label: "Need money?", 
      icon: <Wallet size={16} />,
      prompt: "I am considering spending money on [ITEM/AMOUNT]. Based on a conservative financial outlook, should I do this? Give me a clear 'YES' or 'NO' first, then followed by 3 reasons why." 
    },
    { 
      label: "Wealth Advisor", 
      icon: <TrendingUp size={16} />,
      prompt: "Analyze the long-term ROI of [ITEM/OPPORTUNITY]. Is this an asset that generates value or an expense that depreciates?" 
    },
    { 
      label: "Savings Logic", 
      icon: <DollarSign size={16} />,
      prompt: "What is the most aggressive but safe way to save $10,000 in the current economic climate?" 
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh] border border-white/20"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-200 shrink-0">
               <Sparkles size={28} />
            </div>
            <div>
               <h2 className="text-xl font-black text-slate-800 tracking-tight">AI Decision Nexus</h2>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Financial Intelligence Unit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Shortcuts Section */}
          <div className="space-y-4">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Quick Nexus Actions</h3>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {financeShortcuts.map((sc, i) => (
                <button 
                  key={i}
                  onClick={() => handleSubmit(sc.prompt)}
                  disabled={loading}
                  className="p-5 bg-white hover:bg-brand-50 border border-slate-100 rounded-2xl text-left transition-all group hover:border-brand-200 shadow-sm hover:shadow-md"
                >
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-brand-600 mb-4 shadow-inner group-hover:bg-white transition-colors">
                    {sc.icon}
                  </div>
                  <p className="text-[13px] font-extrabold text-slate-800">{sc.label}</p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic font-bold">Launch Extension Analysis</p>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Form */}
          <div className="space-y-4">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Custom Financial Query</h3>
             <form onSubmit={handleSubmit} className="relative group">
                <div className="absolute inset-0 bg-brand-500/5 blur-2xl rounded-[3rem] group-focus-within:bg-brand-500/10 transition-all opacity-0 group-focus-within:opacity-100" />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Need money? Ask: Should I spend $1000 on a new GPU?"
                  className="relative w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-8 pr-20 text-sm font-semibold focus:outline-none focus:border-brand-500 focus:bg-white transition-all resize-none h-40 shadow-inner"
                />
                <button 
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="absolute bottom-6 right-6 bg-slate-900 text-white p-5 rounded-2xl hover:bg-brand-600 disabled:opacity-50 transition-all shadow-2xl active:scale-95 z-10"
                >
                  {loading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                </button>
             </form>
          </div>

          {/* History / Responses */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pl-2">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Extension Output Flow</h3>
               <span className="text-[10px] font-bold text-brand-500 bg-brand-50 px-2 py-1 rounded-md">Live Stream Enabled</span>
            </div>
            
            {tasks.length === 0 ? (
              <div className="text-center py-16 bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 shadow-sm">
                   <AlertCircle size={32} />
                </div>
                <p className="text-sm text-slate-400 font-bold max-w-[200px] mx-auto">The Nexus awaits your first financial query.</p>
              </div>
            ) : (
              <div className="space-y-4 pb-10">
                {tasks.map((task) => (
                  <motion.div 
                    layout
                    key={task.id} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm space-y-6 hover:shadow-xl transition-all border-l-4 border-l-brand-600"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">My Inquiry</p>
                        <p className="text-[14px] font-bold text-slate-800 line-clamp-2 italic">"{task.prompt}"</p>
                      </div>
                      <div className="shrink-0 pt-1">
                        {task.response ? (
                          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                             <CheckCircle2 size={14} />
                             <span className="text-[10px] font-black uppercase">Analysis Ready</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-brand-500 bg-brand-50 px-3 py-1 rounded-full animate-pulse">
                             <Loader2 size={14} className="animate-spin" />
                             <span className="text-[10px] font-black uppercase">Processing...</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {task.response && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                           <Sparkles size={100} />
                        </div>
                        <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] mb-4">Gemini Multimodal Response</p>
                        <p className="text-[15px] leading-[1.8] font-medium tracking-tight text-white/90">
                          {task.response}
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Cloud Extension Connected</p>
           </div>
           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Nexus v2.4.9</p>
        </div>
      </motion.div>
    </motion.div>
  );
};
