import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, LogOut, Search, Settings, Hash, Shield, Plus, Video, Phone, X, LayoutGrid, MessageSquare as MsgIcon, Users as UsersIcon, Sparkles, Trash2 } from 'lucide-react';
import { 
  db, 
  auth, 
  logout, 
  ChatMessage, 
  handleFirestoreError,
  ChatRoomData,
  UserProfile
} from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc,
  getDoc,
  where,
  deleteDoc
} from 'firebase/firestore';
import { UserSearch } from './UserSearch';
import { RoomCreate } from './RoomCreate';
import { VideoCall } from './VideoCall';
import { AiAdvisor } from './AiAdvisor';

interface ChatRoomProps {
  onOpenAdmin: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ onOpenAdmin }) => {
  const [rooms, setRooms] = useState<ChatRoomData[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Modals
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showAiAdvisor, setShowAiAdvisor] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeCall, setActiveCall] = useState<{ userId: string; userName: string; isIncoming: boolean; callId?: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ callId: string; callerId: string; callerName: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // Check admin status
    const checkAdmin = async () => {
      if (user.email === 'gs931461@gmail.com') {
        setIsAdmin(true);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (adminDoc.exists()) setIsAdmin(true);
      } catch (err) {}
    };
    checkAdmin();

    // Listen for rooms
    const qRooms = query(collection(db, 'rooms'), orderBy('createdAt', 'asc'));
    const unsubRooms = onSnapshot(qRooms, (snapshot) => {
      const roomList = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ChatRoomData[];
      setRooms([{ id: 'global', name: 'global-lounge', createdBy: 'system', createdAt: null }, ...roomList]);
    });

    // Listen for incoming calls
    const qCalls = query(
      collection(db, 'calls'), 
      where('receiverId', '==', user.uid), 
      where('status', '==', 'incoming')
    );
    const unsubCalls = onSnapshot(qCalls, (snapshot) => {
      if (!snapshot.empty) {
        const callData = snapshot.docs[0].data();
        const callId = snapshot.docs[0].id;
        setIncomingCall({ callId, callerId: callData.callerId, callerName: 'Incoming Video Session...' });
      } else {
        setIncomingCall(null);
      }
    });

    return () => {
      unsubRooms();
      unsubCalls();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !activeRoomId) return;

    setLoading(true);
    const msgCollection = activeRoomId === 'global' 
      ? collection(db, 'messages') 
      : collection(db, 'rooms', activeRoomId, 'messages');

    const q = query(msgCollection, orderBy('createdAt', 'asc'), limit(150));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeRoomId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const text = newMessage;
    setNewMessage('');

    try {
      const msgCollection = activeRoomId === 'global' ? collection(db, 'messages') : collection(db, 'rooms', activeRoomId, 'messages');
      await addDoc(msgCollection, {
        text,
        senderId: user.uid,
        senderName: user.displayName || 'User',
        senderPhoto: user.photoURL || '',
        roomId: activeRoomId,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, 'create', 'messages');
    }
  };

  const startVideoCall = (targetUser: UserProfile) => {
    setActiveCall({ userId: targetUser.uid, userName: targetUser.displayName, isIncoming: false });
    setShowSearch(false);
  };

  const acceptCall = () => {
    if (incomingCall) {
      setActiveCall({ userId: incomingCall.callerId, userName: incomingCall.callerName, isIncoming: true, callId: incomingCall.callId });
      setIncomingCall(null);
    }
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900 font-sans p-0 md:p-4 overflow-hidden" id="chat-root">
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`${showSidebar ? 'fixed inset-y-4 left-4 right-4 z-[70] flex' : 'hidden'} md:static md:flex flex-col w-72 h-full bg-white border border-slate-200 rounded-3xl shadow-sm mr-0 md:mr-4 transition-all`} id="chat-sidebar">
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-200">
                 <Sparkles size={20} />
              </div>
              <div className="flex-1">
                 <h1 className="font-extrabold text-lg tracking-tight text-slate-800 leading-none">ChatHub</h1>
                 <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">Enterprise v2.0</p>
              </div>
            </div>
            <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-xl">
               <X size={20} />
            </button>
          </div>

          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Channels</span>
            <button 
              onClick={() => setShowCreateRoom(true)}
              className="p-1 cursor-pointer text-slate-400 hover:text-brand-600 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <nav className="space-y-1 mb-8 overflow-y-auto flex-1">
            {rooms.map(room => (
              <motion.div 
                whileHover={{ x: 2 }}
                key={room.id}
                onClick={() => { setActiveRoomId(room.id); setShowSidebar(false); }}
                className={`group px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-all relative ${
                  activeRoomId === room.id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Hash size={16} className={activeRoomId === room.id ? 'text-brand-400' : 'text-slate-300 group-hover:text-slate-400'} />
                <span className="font-semibold text-[13px] truncate">{room.name}</span>
                {activeRoomId === room.id && (
                  <motion.div layoutId="active-pill" className="absolute left-[-12px] w-1 h-4 bg-brand-600 rounded-full" />
                )}
              </motion.div>
            ))}
          </nav>

          <div className="px-2">
             <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 block">Settings</span>
             <div className="space-y-1">
                <div 
                  onClick={() => setShowAiAdvisor(true)}
                  className="px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 text-brand-600 bg-brand-50/30 hover:bg-brand-50 transition-all font-bold text-[13px] border border-brand-100/50 mb-2"
                >
                   <Sparkles size={16} className="text-brand-500" /> Nexus Advisor
                </div>
                {isAdmin && (
                  <div 
                    onClick={onOpenAdmin}
                    className="px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 text-slate-600 hover:bg-slate-50 transition-all font-semibold text-[13px]"
                  >
                    <Shield size={16} className="text-slate-300" /> Administrative
                  </div>
                )}
                <div className="px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 text-slate-600 hover:bg-slate-50 transition-all font-semibold text-[13px]">
                   <UsersIcon size={16} className="text-slate-300" /> Members
                </div>
             </div>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
          <div className="flex items-center gap-3 p-2 bg-white rounded-2xl shadow-sm border border-slate-100">
             <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'nexus'}`} className="w-10 h-10 rounded-xl bg-slate-100" alt="avatar" />
             <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.displayName}</p>
                <p className="text-[10px] font-black text-blue-600 truncate tracking-widest uppercase mt-0.5">Nexus Architect: Ansh</p>
             </div>
             <button 
               onClick={logout} 
               className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all active:scale-95 group"
             >
                <LogOut size={14} className="group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Sign Out</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-full glass-panel rounded-3xl overflow-hidden relative" id="chat-main">
        {/* Modern Header */}
        <header className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center justify-between z-20" id="chat-header">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSidebar(true)}
              className="md:hidden p-2 -ml-2 text-slate-400 hover:text-brand-600 transition-colors"
            >
              <LayoutGrid size={20} />
            </button>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-slate-300 font-light text-xl">/</span>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight truncate">{activeRoom?.name}</h2>
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full ml-1 shrink-0"></div>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1">
             <button 
               onClick={logout}
               className="md:hidden p-2 text-slate-400 hover:text-red-600 transition-colors"
               title="Sign Out"
             >
               <LogOut size={18} />
             </button>
             <button 
               onClick={() => setShowAiAdvisor(true)}
               className="md:hidden p-2 text-brand-600 hover:bg-white rounded-xl transition-all"
               title="AI Advisor"
             >
               <Sparkles size={18} />
             </button>
             <button 
               onClick={() => setShowCreateRoom(true)}
               className="md:hidden p-2 text-brand-600 hover:bg-white rounded-xl transition-all"
               title="New Workspace"
             >
               <Plus size={18} />
             </button>
             {(isAdmin || activeRoom?.createdBy === user?.uid) && activeRoomId !== 'global' && (
               <button 
                onClick={async () => {
                  if (window.confirm('Erase this workspace and all its data?')) {
                    try {
                      await deleteDoc(doc(db, 'rooms', activeRoomId));
                      setActiveRoomId('global');
                    } catch (err) {
                      handleFirestoreError(err, 'delete', `rooms/${activeRoomId}`);
                    }
                  }
                }}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Erase Workspace"
               >
                 <Trash2 size={16} />
               </button>
             )}
             <button 
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-white text-slate-700 text-xs font-bold rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
             >
               <Search size={14} className="text-slate-400" /> Search Workspace
             </button>
          </div>
        </header>

        {/* Messages Component */}
        <div className="flex-1 overflow-y-auto px-10 py-8 space-y-10" ref={scrollRef} id="messages-container">
          {loading ? (
            <div className="h-full flex items-center justify-center">
               <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-xs mx-auto">
               <div className="w-20 h-20 bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-300 rotate-12">
                  <LayoutGrid size={40} />
               </div>
               <div>
                  <h3 className="font-bold text-slate-800">Fresh Workspace</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">No history found for #{activeRoom?.name}. Be the first to fuel the conversation.</p>
               </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => {
                const isMe = msg.senderId === user?.uid;
                const prevMsg = messages[index - 1];
                const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ease: "easeOut", duration: 0.3 }}
                    className={`flex items-start gap-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-inner bg-slate-100 ${!showAvatar ? 'opacity-0 h-0' : ''}`}>
                      <img src={msg.senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId || 'void'}`} alt="" />
                    </div>
                    <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {showAvatar && (
                        <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest">{isMe ? 'You' : msg.senderName}</span>
                          <span className="text-[9px] font-bold text-slate-300">{msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      <div className={`px-5 py-3.5 rounded-2xl text-[14px] font-medium leading-[1.6] transition-all ${
                        isMe 
                          ? 'bg-brand-600 text-white rounded-tr-none shadow-lg shadow-brand-200/50' 
                          : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Premium Input Bar */}
        <footer className="p-10 relative z-30" id="chat-footer">
          <form 
            onSubmit={handleSendMessage} 
            className="flex items-center gap-2 bg-white p-3 rounded-3xl border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.05)] focus-within:border-brand-500 transition-all max-w-4xl mx-auto" 
            id="send-form"
          >
            <button 
              type="button"
              onClick={() => setShowCreateRoom(true)}
              className="p-3 text-slate-300 hover:text-brand-500 transition-colors cursor-pointer hidden sm:block"
            >
               <Plus size={22} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Collaborate in #${activeRoom?.name}...`}
              className="flex-1 bg-transparent px-2 text-sm font-semibold placeholder-slate-300 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-30 disabled:grayscale transition-all shadow-xl active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2"
            >
              Send <Send size={14} className="text-brand-400" />
            </button>
          </form>
        </footer>

        {/* Call Toast */}
        <AnimatePresence>
          {incomingCall && (
            <motion.div 
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.9 }}
              className="fixed bottom-32 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-50 px-8"
            >
              <div className="bg-slate-950 text-white shadow-2xl rounded-3xl p-5 flex items-center gap-5 border border-white/10 backdrop-blur-2xl">
                 <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center animate-pulse shadow-lg shadow-brand-500/30">
                    <Video size={28} />
                 </div>
                 <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-lg truncate">Encrypted Session</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Incoming from peer-server</p>
                 </div>
                 <div className="flex gap-3">
                    <button onClick={() => setIncomingCall(null)} className="p-4 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-2xl transition-all border border-white/5"><X size={20} /></button>
                    <button onClick={acceptCall} className="p-4 bg-brand-600 text-white rounded-2xl hover:bg-brand-500 transition-all shadow-lg scale-110 active:scale-95"><Phone size={20} fill="currentColor" /></button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Overlays */}
      <AnimatePresence>
        {showSearch && <UserSearch onClose={() => setShowSearch(false)} onStartChat={(u) => { setActiveRoomId('global'); setShowSearch(false); }} onVideoCall={startVideoCall} />}
        {showCreateRoom && <RoomCreate onCreated={(id) => { setActiveRoomId(id); setShowCreateRoom(false); }} onClose={() => setShowCreateRoom(false)} />}
        {showAiAdvisor && <AiAdvisor onClose={() => setShowAiAdvisor(false)} />}
        {activeCall && <VideoCall remoteUserId={activeCall.userId} remoteUserName={activeCall.userName} isIncoming={activeCall.isIncoming} callId={activeCall.callId} onEnd={() => setActiveCall(null)} />}
      </AnimatePresence>
    </div>
  );
};
