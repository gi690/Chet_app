import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, X, Video, MessageSquare as MsgIcon, Sparkles } from 'lucide-react';
import { db, UserProfile } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface UserSearchProps {
  onStartChat: (user: UserProfile) => void;
  onVideoCall: (user: UserProfile) => void;
  onClose: () => void;
}

export const UserSearch: React.FC<UserSearchProps> = ({ onStartChat, onVideoCall, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const term = searchTerm.toLowerCase();
      // Run two queries: search by email and search by displayName
      const qEmail = query(
        collection(db, 'users'),
        where('email', '>=', term),
        where('email', '<=', term + '\uf8ff'),
        limit(5)
      );
      const qName = query(
        collection(db, 'users'),
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(5)
      );

      const [snap1, snap2] = await Promise.all([getDocs(qEmail), getDocs(qName)]);
      const usersMap = new Map<string, UserProfile>();
      
      snap1.docs.forEach(d => usersMap.set(d.id, d.data() as UserProfile));
      snap2.docs.forEach(d => usersMap.set(d.id, d.data() as UserProfile));
      
      setResults(Array.from(usersMap.values()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md" id="user-search-modal">
      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        className="glass-panel w-full max-w-xl rounded-[2.5rem] overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.3)] border-white/10"
        id="user-search-content"
      >
        <div className="p-8 border-b border-slate-100 flex items-center gap-6">
          <div className="flex-1 relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
               <Search size={22} />
            </div>
            <input 
              autoFocus
              type="text" 
              placeholder="Search by identity or name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 placeholder-slate-300 transition-all font-sans"
            />
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-slate-900">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[500px] p-4 bg-white/50">
          {loading && (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Filtering Metadata</p>
            </div>
          )}

          {!loading && results.length === 0 && searchTerm.length >= 2 && (
            <div className="text-center p-20">
               <div className="text-4xl mb-4 opacity-20">🔍</div>
               <p className="font-bold text-slate-800">No signals found</p>
               <p className="text-xs text-slate-400 font-medium mt-1">Try a different name or specific email address.</p>
            </div>
          )}

          {!loading && !searchTerm && (
            <div className="text-center p-20 opacity-40">
               <Sparkles className="mx-auto mb-4 text-slate-300" size={40} />
               <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Global Discovery Node</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {results.map((user) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={user.uid} 
                className="p-5 flex items-center gap-5 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 rounded-3xl transition-all group border border-transparent hover:border-slate-100 cursor-default"
              >
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid || 'nexus'}`} alt="" className="w-14 h-14 rounded-2xl bg-slate-100 shadow-inner group-hover:scale-105 transition-transform" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-900 truncate text-[15px]">{user.displayName}</h4>
                  <p className="text-xs font-bold text-slate-400 truncate tracking-tight">{user.email}</p>
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={() => onVideoCall(user)}
                    className="p-3.5 bg-slate-950 text-white rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                    title="Initiate Video Stream"
                  >
                    <Video size={18} />
                  </button>
                  <button 
                    onClick={() => onStartChat(user)}
                    className="p-3.5 bg-slate-100 text-slate-900 rounded-2xl hover:bg-white hover:shadow-md transition-all border border-slate-100 active:scale-95"
                    title="Send Secure Packet"
                  >
                    <MsgIcon size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
