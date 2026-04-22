/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { LoginView } from './components/LoginView';
import { ChatRoom } from './components/ChatRoom';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'admin'>('chat');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // Sync profile on login
        try {
          await setDoc(doc(db, 'users', authUser.uid), {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName || 'Anonymous',
            photoURL: authUser.photoURL || '',
            lastSeen: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error('Profile sync failed', err);
        }
      }

      if (initializing) setInitializing(false);
      if (!authUser) setView('chat');
    });

    return () => unsubscribe();
  }, [initializing]);

  if (initializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Sparking up...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="antialiased font-sans text-gray-900 overflow-hidden">
      {user ? (
        view === 'chat' ? (
          <ChatRoom onOpenAdmin={() => setView('admin')} />
        ) : (
          <AdminPanel onBack={() => setView('chat')} />
        )
      ) : (
        <LoginView 
          onLoginStart={() => setError(null)} 
          onLoginError={(err) => setError(err.message)} 
        />
      )}
      
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-3">
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="hover:opacity-75">✕</button>
        </div>
      )}
    </div>
  );
}

