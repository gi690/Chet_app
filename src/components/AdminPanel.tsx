import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  MessageSquare, 
  Trash2, 
  ShieldCheck, 
  ArrowLeft,
  Shield,
  ShieldAlert,
  Search,
  Key,
  Database,
  Plus,
  LogOut
} from 'lucide-react';
import { 
  db, 
  ChatMessage, 
  UserProfile, 
  handleFirestoreError,
  setAdminStatus,
  logout
} from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc,
  getDocs,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'messages' | 'users' | 'keys'>('messages');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userList, setUserList] = useState<(UserProfile & { isAdmin?: boolean })[]>([]);
  const [accessKeys, setAccessKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const qMessages = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
    }, (err) => handleFirestoreError(err, 'list', 'messages'));

    const qUsers = query(collection(db, 'users'), orderBy('lastSeen', 'desc'));
    const unsubUsers = onSnapshot(qUsers, async (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown as UserProfile[];
      try {
        const adminSnapshot = await getDocs(collection(db, 'admins'));
        const adminIds = new Set(adminSnapshot.docs.map(d => d.id));
        setUserList(users.map(u => ({ ...u, isAdmin: adminIds.has(u.uid) })));
      } catch (err) {
        setUserList(users.map(u => ({ ...u, isAdmin: false })));
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, 'list', 'users'));

    // Listen for access keys
    const qKeys = query(collection(db, 'access_keys'));
    const unsubKeys = onSnapshot(qKeys, (snapshot) => {
      setAccessKeys(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, 'list', 'access_keys'));

    return () => {
      unsubMessages();
      unsubUsers();
      unsubKeys();
    };
  }, []);

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('Delete this message permanently?')) return;
    try {
      await deleteDoc(doc(db, 'messages', msgId));
    } catch (err) {
      handleFirestoreError(err, 'delete', `messages/${msgId}`);
    }
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'revoke' : 'grant';
    if (!window.confirm(`Are you sure you want to ${action} admin access for this user?`)) return;
    try {
      await setAdminStatus(userId, !currentStatus);
    } catch (err) {
      handleFirestoreError(err, 'write', `admins/${userId}`);
    }
  };

  const generateBypassKeys = async () => {
    const confirm = window.confirm('Generate 10 official Nexus Bypass Keys?');
    if (!confirm) return;

    const keys = [
      'NEXUS-BYPASS-01-X9', 'NEXUS-BYPASS-02-R4', 'NEXUS-BYPASS-03-K2', 
      'NEXUS-BYPASS-04-M7', 'NEXUS-BYPASS-05-T1', 'NEXUS-BYPASS-06-P5', 
      'NEXUS-BYPASS-07-L8', 'NEXUS-BYPASS-08-V3', 'NEXUS-BYPASS-09-Q6', 
      'NEXUS-BYPASS-10-H0'
    ];

    try {
      for (const k of keys) {
        await setDoc(doc(db, 'access_keys', k), {
          key: k,
          role: 'admin',
          maxUses: 1,
          usedBy: [],
          generatedAt: serverTimestamp()
        });
      }
      alert('Keys deployed to the Nexus Grid.');
    } catch (err) {
      handleFirestoreError(err, 'create', 'access_keys');
    }
  };

  const filteredUsers = userList.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="admin-panel">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-slate-200/50">
               <ShieldCheck size={20} />
            </div>
            <div>
               <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Nexus Control</h1>
               <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Global Governance Peak</p>
            </div>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          {['messages', 'users', 'keys'].map((t) => (
            <button 
              key={t}
              onClick={() => setActiveTab(t as any)}
              className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'messages' ? 'Audits' : t === 'users' ? 'Council' : 'Keys'}
            </button>
          ))}
        </div>

        <button 
          onClick={logout}
          className="ml-6 flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-red-50 hover:border-red-100 hover:text-red-600 transition-all text-slate-400"
        >
          <LogOut size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Sign Out</span>
        </button>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'messages' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                  <MessageSquare className="text-slate-400" size={24} /> Audit Log
                </h2>
                <p className="text-sm text-slate-400 font-medium">Real-time ecosystem monitoring.</p>
              </div>
              <div className="bg-slate-950 text-white px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2">
                 {messages.length} <span className="opacity-40 font-bold uppercase text-[10px] tracking-widest">Captured</span>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Identity</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payload</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Time</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Gate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {messages.map((msg) => (
                      <tr key={msg.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <img src={msg.senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId || 'void'}`} className="w-10 h-10 rounded-xl bg-slate-100" alt="" />
                            <div className="text-sm font-bold text-slate-900">{msg.senderName}</div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-sm text-slate-600 italic">"{msg.text}"</td>
                        <td className="px-8 py-5 text-xs text-slate-400 tabular-nums">{msg.createdAt?.toDate().toLocaleTimeString()}</td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => handleDeleteMessage(msg.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-8">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                    <Users className="text-slate-400" size={24} /> Council Records
                  </h2>
                </div>
                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input type="text" placeholder="Search identities..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border rounded-2xl pl-12 pr-6 py-3 text-sm font-bold w-full md:w-80 shadow-sm" />
                </div>
             </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsers.map((usr) => (
                  <div key={usr.uid} className={`bg-white p-6 rounded-[2rem] border ${usr.isAdmin ? 'border-slate-900 shadow-xl' : 'border-slate-100 shadow-sm'}`}>
                    <div className="flex items-center gap-5 mb-6">
                      <img src={usr.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${usr.uid || 'nexus'}`} className="w-14 h-14 rounded-2xl bg-slate-100 shadow-inner" alt="" />
                      <div>
                        <h3 className="text-sm font-black text-slate-900 truncate">{usr.displayName}</h3>
                        <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-widest">{usr.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                       <span className="text-[10px] font-black uppercase text-slate-400">{usr.isAdmin ? 'Admin' : 'Member'}</span>
                       <button onClick={() => toggleAdmin(usr.uid, !!usr.isAdmin)} className="p-2 rounded-xl text-slate-300 hover:bg-slate-900 hover:text-white transition-all">
                         {usr.isAdmin ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                       </button>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        ) : (
          <div className="space-y-8">
             <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                    <Key className="text-slate-400" size={24} /> Bypass Credentials
                  </h2>
                  <p className="text-sm text-slate-400 font-medium">Manage secret entry codes for the Nexus Gate.</p>
                </div>
                <button 
                  onClick={generateBypassKeys}
                  className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 text-xs uppercase tracking-widest"
                >
                   <Plus size={16} /> Deploy Master Keys
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {accessKeys.map((k) => (
                  <div key={k.id} className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                     <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${k.usedBy?.length > 0 ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>
                           <Database size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identity Voucher</span>
                     </div>
                     <code className="text-[13px] font-mono font-bold bg-slate-100 p-3 rounded-xl mb-4 block overflow-hidden truncate">
                        {k.key}
                     </code>
                     <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <span className="text-[10px] font-black uppercase text-slate-500">Uses: {k.usedBy?.length || 0}/{k.maxUses}</span>
                        <div className={`w-2 h-2 rounded-full ${k.usedBy?.length >= k.maxUses ? 'bg-red-500' : 'bg-emerald-500 anim-pulse'}`}></div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      <footer className="p-8 text-center border-t border-slate-100 bg-slate-50/30">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Nexus Developed & Optimized by Ansh</p>
      </footer>
    </div>
  );
};
