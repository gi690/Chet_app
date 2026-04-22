import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Sparkles, MoveRight, Users, MessageSquare, Video, Key, X, CheckCircle2, ShieldCheck, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { loginWithGoogle, db, auth, setAdminStatus, registerWithEmail, loginWithEmail } from '../lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

interface LoginViewProps {
  onLoginStart: () => void;
  onLoginError: (err: any) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginStart, onLoginError }) => {
  const [showBypass, setShowBypass] = useState(false);
  const [authMode, setAuthMode] = useState<'google' | 'signin' | 'signup'>('google');
  
  // Email Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [bypassKey, setBypassKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleLogin = async () => {
    onLoginStart();
    try {
      await loginWithGoogle();
    } catch (err) {
      onLoginError(err);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onLoginStart();
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        await registerWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setLocalError('This identity is already deployed. Try resuming instead.');
      } else if (err.code === 'auth/weak-password') {
        setLocalError('Governance requires a stronger password (minimum 6 characters).');
      } else if (err.code === 'auth/invalid-email') {
        setLocalError('The provided signal does not match email protocols.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setLocalError('Invalid identity credentials provided.');
      } else {
        onLoginError(err);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleBypass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bypassKey.trim() || !auth.currentUser) {
      if (!auth.currentUser) {
        setErrorMessage('Create an identity first, then apply the bypass key.');
        setKeyStatus('error');
      }
      return;
    }

    setKeyStatus('verifying');
    try {
      const keyDoc = await getDoc(doc(db, 'access_keys', bypassKey.trim()));
      
      if (!keyDoc.exists()) {
        throw new Error('Identity key is invalid or expired.');
      }

      const data = keyDoc.data();
      const user = auth.currentUser;

      if (data.usedBy && data.usedBy.includes(user.uid)) {
         throw new Error('Key already synchronized with your identity.');
      }

      if (data.usedBy && data.usedBy.length >= (data.maxUses || 1)) {
         throw new Error('Key usage limit reached.');
      }

      await updateDoc(doc(db, 'access_keys', bypassKey.trim()), {
        usedBy: arrayUnion(user.uid)
      });

      if (data.role === 'admin') {
        await setAdminStatus(user.uid, true);
      }

      setKeyStatus('success');
      setTimeout(() => setShowBypass(false), 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed');
      setKeyStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-hidden relative premium-gradient" id="login-root">
      {/* Bypass Modal */}
      <AnimatePresence>
        {showBypass && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setShowBypass(false)}
                className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
                id="close-bypass"
              >
                <X size={24} />
              </button>

              <div className="flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
                    <Key size={32} />
                 </div>
                 <h2 className="text-2xl font-black mb-2">Nexus Bypass</h2>
                 <p className="text-slate-400 text-sm mb-8 leading-relaxed px-4">
                   Enter your secret identity key to instantly override system access levels.
                 </p>

                 <form onSubmit={handleBypass} className="w-full space-y-4">
                    <input 
                      type="text"
                      placeholder="ENTER ACCESS KEY..."
                      value={bypassKey}
                      onChange={(e) => setBypassKey(e.target.value.toUpperCase())}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 font-mono text-center tracking-[0.2em] focus:outline-none focus:border-blue-500 transition-all text-sm uppercase"
                    />

                    {keyStatus === 'error' && (
                      <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">{errorMessage}</p>
                    )}

                    {keyStatus === 'success' && (
                      <div className="flex items-center justify-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-[10px]">
                        <CheckCircle2 size={14} /> Synchronized Successfully
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={keyStatus === 'verifying' || keyStatus === 'success'}
                      className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-30"
                    >
                      {keyStatus === 'verifying' ? 'Connecting...' : 'Apply Bypass'}
                    </button>
                 </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 h-screen flex flex-col pt-10">
        {/* Navbar */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10"
        >
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
            <Sparkles className="text-blue-400" size={18} />
            <span className="font-bold tracking-tight text-sm uppercase">SparkChat Enterprise</span>
          </div>

          <button 
            onClick={() => setShowBypass(true)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-400 transition-colors bg-white/5 px-6 py-3 rounded-full border border-white/5"
            id="open-bypass-top"
          >
             <Key size={12} /> Enter Bypass Key
          </button>
        </motion.div>

        <div className="flex-1 grid lg:grid-cols-2 gap-20 items-center">
          <div className="text-left">
            <motion.h1 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-6xl sm:text-7xl font-extrabold tracking-tighter leading-[1.05] mb-8"
            >
              Elite Messaging <br/> For <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">The Nexus.</span>
            </motion.h1>
            
            <p className="text-xl text-slate-400 max-w-lg mb-10 leading-relaxed">
              Experience zero-latency communication with built-in governance blunting standard registration limits.
            </p>

            <div className="hidden lg:flex gap-6 items-center">
               <div className="flex -space-x-3">
                 {[1,2,3].map(i => (
                   <img key={i} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}42`} className="w-10 h-10 rounded-full border-2 border-[#020617] bg-slate-800" alt=""/>
                 ))}
               </div>
               <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Join 2.4k+ Elite Members</p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full"></div>
            
            {authMode === 'google' ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 bg-blue-500/20 rounded-3xl flex items-center justify-center mb-8">
                  <ShieldCheck className="text-blue-400" size={32} />
                </div>
                <h2 className="text-2xl font-black mb-10">Select Entrance Method</h2>
                
                <div className="w-full space-y-4">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-4 bg-white text-black py-5 rounded-2xl font-black uppercase text-xs tracking-[0.1em] hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Quick Synchronize with Google
                  </button>

                  <div className="flex items-center gap-4 py-4">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">OR</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                  </div>

                  <button
                    onClick={() => setAuthMode('signup')}
                    className="w-full bg-transparent border border-white/10 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.1em] hover:bg-white/5 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <Mail size={18} className="text-slate-400" /> Use Email Address
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4">
                <button 
                  onClick={() => setAuthMode('google')}
                  className="mb-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <ArrowRight size={14} className="rotate-180" /> Back to methods
                </button>

                <h2 className="text-2xl font-black mb-8">{authMode === 'signup' ? 'Create Identity' : 'Resume Identity'}</h2>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {localError && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-4"
                    >
                      <p className="text-red-400 text-[10px] font-black uppercase tracking-widest text-center leading-relaxed">
                        {localError}
                      </p>
                    </motion.div>
                  )}
                  {authMode === 'signup' && (
                    <div className="relative group">
                       <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                       <input 
                         type="text"
                         required
                         placeholder="DISPLAY NAME"
                         value={name}
                         onChange={(e) => setName(e.target.value)}
                         className="w-full bg-black/40 border border-white/5 rounded-2xl pl-14 pr-6 py-4 font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                       />
                    </div>
                  )}

                  <div className="relative group">
                     <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                     <input 
                       type="email"
                       required
                       placeholder="EMAIL ADDRESS"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="w-full bg-black/40 border border-white/5 rounded-2xl pl-14 pr-6 py-4 font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                     />
                  </div>

                  <div className="relative group">
                     <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                     <input 
                       type="password"
                       required
                       placeholder="SECURE PASSWORD"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full bg-black/40 border border-white/5 rounded-2xl pl-14 pr-6 py-4 font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                     />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 mt-4 shadow-xl shadow-blue-600/20"
                  >
                    {authLoading ? 'Verifying...' : authMode === 'signup' ? 'Deploy Identity' : 'Access Nexus'}
                  </button>
                </form>

                <p className="text-center mt-10 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {authMode === 'signup' ? 'Already an identity?' : 'Missing identity?'} 
                  <button 
                    onClick={() => {
                      setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                      setLocalError(null);
                    }}
                    className="ml-2 text-white hover:text-blue-400 transition-colors underline underline-offset-4"
                  >
                    {authMode === 'signup' ? 'Resume Here' : 'Create Here'}
                  </button>
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      
      <footer className="absolute bottom-10 left-0 w-full text-center pointer-events-none">
        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Designed & Engineered by Ansh</p>
        <p className="text-slate-700 text-[8px] font-bold uppercase tracking-[0.3em] opacity-40">Antigravity Intelligence Protocols Active</p>
      </footer>
    </div>
  );
};
