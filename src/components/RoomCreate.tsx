import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Hash, Lock, Globe } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface RoomCreateProps {
  onCreated: (roomId: string) => void;
  onClose: () => void;
}

export const RoomCreate: React.FC<RoomCreateProps> = ({ onCreated, onClose }) => {
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !auth.currentUser) return;

    setLoading(true);
    try {
      const roomData = {
        name: roomName.trim(),
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        members: [auth.currentUser.uid],
        isPrivate
      };
      const docRef = await addDoc(collection(db, 'rooms'), roomData);
      onCreated(docRef.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" id="create-room-modal">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        id="create-room-content"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Create a Room</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Room Name</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                autoFocus
                type="text" 
                maxLength={64}
                placeholder="e.g. project-x"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border-none font-medium"
              />
            </div>
          </div>

          <div className="space-y-4">
             <div 
              onClick={() => setIsPrivate(false)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${!isPrivate ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
             >
               <div className={`p-3 rounded-xl ${!isPrivate ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                 <Globe size={24} />
               </div>
               <div className="flex-1">
                 <h4 className="font-bold text-gray-900">Public Room</h4>
                 <p className="text-xs text-gray-500">Anyone in the workspace can join.</p>
               </div>
             </div>

             <div 
              onClick={() => setIsPrivate(true)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${isPrivate ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
             >
               <div className={`p-3 rounded-xl ${isPrivate ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                 <Lock size={24} />
               </div>
               <div className="flex-1">
                 <h4 className="font-bold text-gray-900">Private Room</h4>
                 <p className="text-xs text-gray-500">Only invited members can access.</p>
               </div>
             </div>
          </div>

          <button 
            type="submit"
            disabled={!roomName.trim() || loading}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
