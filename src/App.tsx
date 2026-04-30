/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  Star, 
  Mic, 
  Camera, 
  Rocket, 
  Languages,
  RotateCcw,
  Check,
  Lock,
  X,
  Globe,
  Zap,
  ArrowRight,
  Music,
  Play,
  LogOut,
  User as UserIcon
} from 'lucide-react';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

// --- Firestore Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---
type AppState = 'LOGIN' | 'HOME' | 'LESSON_PLAYER' | 'FINISHED_LESSON' | 'MUSIC' | 'SHOP' | 'AD_BREAK';
type Language = 'EN' | 'BN';

interface Song {
  id: string;
  title: string;
  bnTitle: string;
  youtubeId: string;
  emoji: string;
}

const SONGS: Song[] = [
  { id: 's1', title: 'Baby Shark', bnTitle: 'বেবি শার্ক', youtubeId: 'XqZsoesa55w', emoji: '🦈' },
  { id: 's2', title: 'Wheels on the Bus', bnTitle: 'চাকার গান', youtubeId: 'e_04ZrNroTo', emoji: '🚌' },
  { id: 's3', title: 'Johny Johny Yes Papa', bnTitle: 'জনি জনি', youtubeId: 'F4tHL8reOtA', emoji: '👶' },
  { id: 's4', title: 'Hatti Matim Tim', bnTitle: 'হাট্টি মাট্টিম টিম', youtubeId: 'v8v7rVlR0Is', emoji: '👺' },
  { id: 's5', title: 'Aaye Aaye Chad Mama', bnTitle: 'আয় আয় চাঁদ মামা', youtubeId: '66kToYvL22M', emoji: '🌙' },
];

interface Task {
  id: string;
  type: 'LEARNING' | 'QUIZ' | 'TRACING' | 'CAMERA' | 'MIC';
  title: string;
  bnTitle: string;
  emoji?: string;
  options?: { emoji: string; label: string; correct: boolean }[];
  targetLetter?: string;
  targetColor?: string;
}

interface Lesson {
  id: string;
  title: string;
  bnTitle: string;
  icon: string;
  color: string;
  tasks: Task[];
}

interface GameState {
  stars: number;
  unlockedLessonIndex: number;
  currentLesson: Lesson | null;
  currentTaskIndex: number;
  lang: Language;
  isPremium: boolean;
}

// --- Lessons Data ---
const LESSONS: Lesson[] = [
  {
    id: 'l1',
    title: 'Alphabets',
    bnTitle: 'বর্ণমালা',
    icon: '🔤',
    color: 'from-purple-500 to-indigo-600',
    tasks: [
      { id: 't1', type: 'LEARNING', title: "This is 'A' for Apple", bnTitle: "এটি হলো 'A', A-তে অ্যাপল" },
      { id: 't2', type: 'MIC', title: "Say APPLE out loud!", bnTitle: "জোরে বলো— অ্যাপল!" },
      { id: 't3', type: 'QUIZ', title: "Find the Apple", bnTitle: "অ্যাপলটি খুঁজে বের করো", options: [
        { emoji: '🍎', label: 'Apple', correct: true },
        { emoji: '🍌', label: 'Banana', correct: false },
        { emoji: '🍉', label: 'Watermelon', correct: false },
        { emoji: '🍍', label: 'Pineapple', correct: false },
      ]},
    ]
  },
  {
    id: 'l2',
    title: 'Colors',
    bnTitle: 'রঙের খেলা',
    icon: '🎨',
    color: 'from-pink-500 to-rose-600',
    tasks: [
      { id: 't4', type: 'CAMERA', title: "Find something RED!", bnTitle: "লাল রঙের কিছু দেখাও!", targetColor: 'RED' },
      { id: 't5', type: 'QUIZ', title: "Which one is RED?", bnTitle: "কোনটি লাল?", options: [
        { emoji: '🔴', label: 'Red', correct: true },
        { emoji: '🔵', label: 'Blue', correct: false },
        { emoji: '🟢', label: 'Green', correct: false },
        { emoji: '🟡', label: 'Yellow', correct: false },
      ]},
    ]
  },
  {
    id: 'l3',
    title: 'Writing',
    bnTitle: 'হাতের লেখা',
    icon: '✍️',
    color: 'from-emerald-500 to-teal-600',
    tasks: [
      { id: 't6', type: 'TRACING', title: "Trace the letter 'B'", bnTitle: "তোমার আঙুল দিয়ে 'B' লিখে দেখাও!", targetLetter: 'B' },
      { id: 't7', type: 'QUIZ', title: "Which letter is this?", bnTitle: "এটি কোন অক্ষর?", options: [
        { emoji: '🅱️', label: 'B', correct: true },
        { emoji: '🅰️', label: 'A', correct: false },
        { emoji: '🌀', label: 'C', correct: false },
        { emoji: '💠', label: 'D', correct: false },
      ]},
    ]
  }
];

const content = {
  EN: {
    welcome: "Galaxy Learning Path",
    lessonComplete: "Lesson Completed!",
    keepGoing: "Keep Going!",
    locked: "Locked",
    next: "Next",
    back: "Back",
    starsWon: "Stars Earned",
    missionAccomplished: "Mission Accomplished!",
    startLesson: "Start Mission",
    tryAgain: "Try again, explorer!",
    beautiful: "Beautiful!",
    check: "Check",
    musicWorld: "Music World",
    musicDesc: "Listen to your favorite space rhymes!",
    getStars: "Free Stars",
    shop: "Space Shop",
    removeAds: "No Ads",
    premium: "Go Premium",
    watchingAd: "Receiving Signal...",
    adReward: "You got 20 Stars!",
    buy: "Buy",
    login: "Login with Google",
    loginDesc: "Save your progress and stars across space!",
    logout: "Logout",
    loading: "Loading Profile..."
  },
  BN: {
    welcome: "গ্যালাক্সি লার্নিং পাথ",
    lessonComplete: "লেসন শেষ হয়েছে!",
    keepGoing: "আরো এগিয়ে যাও!",
    locked: "বন্ধ",
    next: "পরবর্তী",
    back: "পেছনে",
    starsWon: "অর্জিত স্টার",
    missionAccomplished: "মিশন সফল হয়েছে!",
    startLesson: "মিশন শুরু করো",
    tryAgain: "আবার চেষ্টা করো বন্ধু!",
    beautiful: "খুব সুন্দর!",
    check: "যাচাই করো",
    musicWorld: "মিউজিক ওয়ার্ল্ড",
    musicDesc: "তোমার প্রিয় ছড়াগুলো শোনো!",
    getStars: "ফ্রি স্টার",
    shop: "স্পেস শপ",
    removeAds: "অ্যাড নেই",
    premium: "প্রিমিয়াম হও",
    watchingAd: "সিগন্যাল আসছে...",
    adReward: "তুমি ২০টি স্টার পেয়েছ!",
    buy: "কিনুন",
    login: "গুগল দিয়ে লগইন",
    loginDesc: "তোমার প্রোগ্রেস এবং স্টার সবসময় সেভ রাখো!",
    logout: "লগআউট",
    loading: "প্রোফাইল আসছে..."
  }
};

// --- Components ---

const TracingCanvas = ({ targetLetter, onComplete, t }: { targetLetter: string, onComplete: () => void, t: any }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth clear animation using a fade-out loop
    let alpha = 0;
    const fadeOut = () => {
      ctx.fillStyle = `rgba(15, 23, 42, 0.15)`; // Match background roughly
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      alpha += 0.05;
      if (alpha < 1) {
        requestAnimationFrame(fadeOut);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    fadeOut();
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * (800 / rect.width),
      y: (clientY - rect.top) * (800 / rect.height)
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Prevent scrolling when drawing on touch devices
    if ('touches' in e) e.preventDefault();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Layer 1: Wide Outer Glow
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#a855f7';
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 45;
    ctx.lineTo(x, y);
    ctx.stroke();

    // Layer 2: Medium Soft Glow
    ctx.shadowBlur = 10;
    ctx.lineWidth = 25;
    ctx.strokeStyle = '#d8b4fe';
    ctx.stroke();

    // Layer 3: Sharp White Core
    ctx.shadowBlur = 0;
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);

    if ('touches' in e) e.preventDefault();
  };

  const stopDrawing = () => setIsDrawing(false);

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <div className="glass-card w-full aspect-square relative overflow-hidden neon-border group">
         <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 0.1 }}
           className="absolute inset-0 flex items-center justify-center pointer-events-none"
         >
           <span className="text-[20rem] font-black">{targetLetter}</span>
         </motion.div>
         <canvas
          ref={canvasRef}
          width={800} height={800}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
         />
      </div>
      <div className="flex gap-4 w-full">
         <motion.button 
           whileHover={{ scale: 1.1, rotate: -10 }}
           whileTap={{ scale: 0.9 }}
           onClick={clearCanvas} 
           className="bg-white/10 p-5 rounded-2xl hover:bg-white/20 transition-all border border-white/10"
         >
           <RotateCcw className="w-8 h-8 text-red-400" />
         </motion.button>
         <motion.button 
           whileHover={{ scale: 1.02 }}
           whileTap={{ scale: 0.98 }}
           onClick={onComplete} 
           className="btn-futuristic flex-1 bg-green-500/20 text-green-400 border-green-500/30"
         >
           {t.beautiful}
         </motion.button>
      </div>
    </div>
  );
};

const Tuni = ({ message }: { message: string }) => (
  <motion.div 
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="flex items-center gap-4 mb-8 bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/20 w-full"
  >
    <motion.div
      animate={{ 
        y: [0, -10, 0], 
        rotate: [0, 5, -5, 0],
        scale: [1, 1.05, 1] 
      }}
      transition={{ 
        repeat: Infinity, 
        duration: 4,
        ease: "easeInOut" 
      }}
      className="text-6xl drop-shadow-2xl"
    >
      🦜
    </motion.div>
    <motion.p 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      key={message}
      className="text-xl font-bold text-white font-sans leading-tight"
    >
      {message}
    </motion.p>
  </motion.div>
);

const ProgressBar = ({ current, total }: { current: number, total: number }) => (
  <div className="w-full bg-white/10 h-4 rounded-full overflow-hidden border border-white/10">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${(current / total) * 100}%` }}
      transition={{ type: 'spring', stiffness: 50, damping: 15 }}
      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
    />
  </div>
);

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [appState, setAppState] = useState<AppState>('LOGIN');
  const [gameState, setGameState] = useState<GameState>({
    stars: 0,
    unlockedLessonIndex: 0,
    currentLesson: null,
    currentTaskIndex: 0,
    lang: 'BN',
    isPremium: false
  });

  const t = content[gameState.lang];

  // --- Auth & Data Persistence ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await loadUserProfile(u.uid);
      } else {
        setAppState('LOGIN');
        setLoading(false);
      }
    });

    // Test Connection as per instructions
    const testConn = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConn();

    return () => unsub();
  }, []);

  const loadUserProfile = async (uid: string) => {
    setLoading(true);
    const userRef = doc(db, 'users', uid);
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setGameState(prev => ({
          ...prev,
          stars: data.stars,
          unlockedLessonIndex: data.unlockedLessonIndex,
          lang: data.lang,
          isPremium: data.isPremium
        }));
        setAppState('HOME');
      } else {
        // Create new profile
        const newProfile = {
          uid,
          stars: 0,
          unlockedLessonIndex: 0,
          lang: 'BN',
          isPremium: false,
          updatedAt: serverTimestamp()
        };
        await setDoc(userRef, newProfile);
        setGameState(prev => ({ ...prev, stars: 0, unlockedLessonIndex: 0, lang: 'BN', isPremium: false }));
        setAppState('HOME');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    } finally {
      setLoading(false);
    }
  };

  const syncToFirebase = useCallback(async (updates: Partial<GameState>) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAppState('LOGIN');
  };

  const startLesson = (lesson: Lesson, index: number) => {
    if (index > gameState.unlockedLessonIndex) return;
    
    // Simulate Interstitial Ad if not premium
    if (!gameState.isPremium && Math.random() > 0.4) {
      setAppState('AD_BREAK');
      setTimeout(() => {
        setGameState(prev => ({ 
          ...prev, 
          currentLesson: lesson, 
          currentTaskIndex: 0 
        }));
        setAppState('LESSON_PLAYER');
      }, 3000);
    } else {
      setGameState(prev => ({ 
        ...prev, 
        currentLesson: lesson, 
        currentTaskIndex: 0 
      }));
      setAppState('LESSON_PLAYER');
    }
  };

  const showRewardedAd = () => {
    setAppState('AD_BREAK');
    setTimeout(() => {
      const newStars = gameState.stars + 20;
      setGameState(prev => ({ ...prev, stars: newStars }));
      syncToFirebase({ stars: newStars });
      alert(t.adReward);
      setAppState('HOME');
    }, 4000);
  };

  const nextTask = () => {
    if (!gameState.currentLesson) return;
    
    if (gameState.currentTaskIndex < gameState.currentLesson.tasks.length - 1) {
      setGameState(prev => ({ ...prev, currentTaskIndex: prev.currentTaskIndex + 1 }));
    } else {
      const isNewLesson = LESSONS.indexOf(gameState.currentLesson) === gameState.unlockedLessonIndex;
      const newStars = gameState.stars + 20;
      const newIndex = isNewLesson ? gameState.unlockedLessonIndex + 1 : gameState.unlockedLessonIndex;
      
      setGameState(prev => ({ 
        ...prev, 
        stars: newStars,
        unlockedLessonIndex: newIndex
      }));
      
      syncToFirebase({ stars: newStars, unlockedLessonIndex: newIndex });
      setAppState('FINISHED_LESSON');
    }
  };

  const toggleLang = () => {
    const newLang = gameState.lang === 'EN' ? 'BN' : 'EN';
    setGameState(prev => ({ ...prev, lang: newLang }));
    syncToFirebase({ lang: newLang });
  };

  return (
    <div className="min-h-screen nebula-bg flex flex-col items-center p-6 font-sans overflow-x-hidden text-white selection:bg-purple-500">
      {/* Top Bar (HUD) */}
      <div className="fixed top-0 left-0 right-0 h-24 flex items-center justify-between px-6 z-50 bg-slate-950/20 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleLang}
            className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <Languages className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-sm tracking-tighter uppercase">{gameState.lang === 'EN' ? 'BN' : 'EN'}</span>
          </button>
          
          {user && (
            <button 
              onClick={handleLogout}
              className="bg-red-500/10 backdrop-blur-md p-2 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all"
              title={t.logout}
            >
              <LogOut className="w-5 h-5 text-red-400" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setAppState('SHOP')}
            className="bg-yellow-500/20 text-yellow-400 p-2 rounded-xl border border-yellow-500/30 hover:bg-yellow-500/30 transition-all flex items-center justify-center"
          >
            <Zap className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 bg-gradient-to-r from-purple-600/50 to-blue-600/50 px-5 py-2 rounded-2xl shadow-xl border border-white/10">
            <Star className="text-yellow-400 fill-current w-6 h-6 animate-pulse" />
            <span className="text-xl font-black">{gameState.stars}</span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* LOADING STATE */}
        {loading && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-40 flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-black tracking-widest text-purple-300 animate-pulse">{t.loading}</p>
          </motion.div>
        )}

        {/* LOGIN SCREEN */}
        {!loading && appState === 'LOGIN' && !user && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="mt-40 w-full max-w-md flex flex-col items-center glass-card p-10 text-center"
          >
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-8 shadow-2xl">
              <UserIcon className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter text-white">{t.login}</h2>
            <p className="text-slate-400 mb-10 leading-relaxed font-medium">{t.loginDesc}</p>
            <button 
              onClick={handleGoogleLogin}
              className="btn-futuristic w-full flex items-center justify-center gap-4 py-4"
            >
              <Globe className="w-6 h-6" />
              {t.login}
            </button>
          </motion.div>
        )}

        {/* HOMEPAGE - LESSON PATH */}
        {appState === 'HOME' && user && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-28 w-full max-w-md flex flex-col items-center gap-10 pb-32"
          >
            <Tuni message={t.welcome} />
            
            {/* Free Stars Ad Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={showRewardedAd}
              className="w-full flex items-center gap-4 p-4 glass-card border-green-500/30 bg-green-500/5 mb-2 overflow-hidden"
            >
              <div className="bg-green-500 p-2 rounded-xl shadow-lg">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <p className="font-black text-sm text-green-400 uppercase tracking-widest">{t.getStars}</p>
                <p className="text-slate-400 text-xs">+20 Galactic Stars</p>
              </div>
              <div className="ml-auto bg-green-500/20 px-3 py-1 rounded-full text-[10px] font-bold">ADS</div>
            </motion.button>
            
            {/* Music Shortcut */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAppState('MUSIC')}
              className="w-full flex items-center gap-6 p-6 glass-card border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-blue-900/20 mb-8 overflow-hidden group"
            >
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-4 rounded-2xl shadow-lg group-hover:rotate-12 transition-transform">
                <Music className="w-8 h-8 text-white" />
              </div>
              <div className="text-left">
                <p className="font-black text-xl text-yellow-300 uppercase tracking-tighter">{t.musicWorld}</p>
                <p className="text-slate-400 text-sm">{t.musicDesc}</p>
              </div>
              <ArrowRight className="ml-auto w-6 h-6 text-slate-500 group-hover:translate-x-2 transition-transform" />
            </motion.button>

            <motion.div 
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.2
                  }
                }
              }}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center gap-6 w-full relative"
            >
              {LESSONS.map((lesson, idx) => {
                const isLocked = idx > gameState.unlockedLessonIndex;
                const isCurrent = idx === gameState.unlockedLessonIndex;
                const isCompleted = idx < gameState.unlockedLessonIndex;
                const shift = idx % 2 === 0 ? '-30px' : '30px';

                return (
                  <motion.div 
                    key={lesson.id}
                    variants={{
                      hidden: { x: idx % 2 === 0 ? -50 : 50, opacity: 0 },
                      show: { x: 0, opacity: 1 }
                    }}
                    className="relative flex flex-col items-center group"
                    style={{ transform: `translateX(${shift})` }}
                  >
                    <motion.button
                      whileHover={!isLocked ? { scale: 1.15, rotate: 5 } : {}}
                      whileTap={!isLocked ? { scale: 0.9 } : {}}
                      onClick={() => startLesson(lesson, idx)}
                      className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl shadow-2xl relative transition-all duration-300
                        ${isLocked ? 'bg-slate-900 border-white/5 opacity-40' : `bg-gradient-to-br ${lesson.color} border-white/20`}
                        ${isCurrent ? 'ring-4 ring-yellow-400 ring-offset-4 ring-offset-slate-950 shadow-[0_0_40px_rgba(168,85,247,0.4)]' : ''}
                        border-b-8 border-black/30
                      `}
                    >
                      {isLocked ? <Lock className="w-12 h-12 text-slate-600" /> : lesson.icon}
                      {isCompleted && (
                        <div className="absolute -top-1 -right-1 bg-green-500 p-2 rounded-full border-2 border-white shadow-lg">
                          <Check className="w-4 h-4 text-white font-bold" />
                        </div>
                      )}
                      {isCurrent && (
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute -inset-4 border-2 border-yellow-400 rounded-full"
                        />
                      )}
                    </motion.button>
                    <div className={`mt-4 font-black tracking-widest text-center uppercase text-xs px-4 py-1 rounded-full backdrop-blur-md
                      ${isLocked ? 'text-slate-600 bg-white/5' : 'text-white bg-purple-500/20'}
                    `}>
                      {gameState.lang === 'EN' ? lesson.title : lesson.bnTitle}
                    </div>
                  </motion.div>
                );
              })}
              <div className="absolute top-0 bottom-0 left-1/2 -ml-0.5 w-1 border-l-4 border-dashed border-white/5 -z-10 h-full" />
            </motion.div>
          </motion.div>
        )}

        {/* LESSON PLAYER */}
        {appState === 'LESSON_PLAYER' && gameState.currentLesson && (
          <motion.div 
            key="player"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="mt-28 w-full max-w-lg flex flex-col items-center"
          >
            <div className="w-full flex items-center gap-6 mb-10">
              <button 
                onClick={() => setAppState('HOME')} 
                className="p-3 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/20 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <ProgressBar 
                current={gameState.currentTaskIndex + 1} 
                total={gameState.currentLesson.tasks.length} 
              />
            </div>
            {(() => {
              const task = gameState.currentLesson.tasks[gameState.currentTaskIndex];
              return (
                <div className="w-full flex flex-col items-center min-h-[60vh]">
                  <Tuni message={gameState.lang === 'EN' ? task.title : task.bnTitle} />
                  <div className="w-full flex-1 flex flex-col items-center justify-center gap-8 px-4">
                    {task.type === 'LEARNING' && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        className="w-full flex flex-col items-center"
                      >
                        <motion.div 
                          animate={{ scale: [1, 1.02, 1] }}
                          transition={{ repeat: Infinity, duration: 3 }}
                          className="w-72 h-72 glass-card flex items-center justify-center mb-10 neon-border scale-110"
                        >
                          <div className="text-[14rem] font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-purple-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">A</div>
                        </motion.div>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={nextTask} 
                          className="btn-futuristic w-full group"
                        >
                          {t.next} <ArrowRight className="inline ml-2 group-hover:translate-x-2 transition-transform" />
                        </motion.button>
                      </motion.div>
                    )}
                    {task.type === 'MIC' && (
                      <motion.div className="flex flex-col items-center gap-12">
                        <div className="text-9xl p-12 glass-card bg-purple-500/20 shadow-[0_0_50px_rgba(239,68,68,0.2)]">🍎</div>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={nextTask} 
                          className="w-24 h-24 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full shadow-[0_0_40px_rgba(59,130,246,0.6)] flex items-center justify-center animate-pulse"
                        >
                          <Mic className="w-10 h-10 text-white" />
                        </motion.button>
                        <p className="font-black text-blue-400 tracking-widest animate-bounce">APPLE!</p>
                      </motion.div>
                    )}
                    {task.type === 'QUIZ' && (
                      <div className="grid grid-cols-2 gap-6 w-full">
                        {task.options?.map((opt, i) => (
                          <motion.button 
                            key={i}
                            whileHover={{ scale: 1.05, y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => opt.correct ? nextTask() : alert(t.tryAgain)}
                            className="glass-card p-10 flex flex-col items-center gap-4 hover:bg-white/20 hover:border-purple-500 transition-all border border-white/5 group"
                          >
                            <span className="text-7xl group-hover:scale-110 transition-transform">{opt.emoji}</span>
                            <span className="font-black text-purple-200 tracking-wide">{opt.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    )}
                    {task.type === 'TRACING' && (
                      <TracingCanvas 
                        targetLetter={task.targetLetter || 'A'} 
                        onComplete={nextTask} 
                        t={t}
                      />
                    )}
                    {task.type === 'CAMERA' && (
                      <div className="flex flex-col items-center gap-10 text-center w-full">
                        <div className="w-full aspect-video glass-card flex items-center justify-center border-dashed border-white/20 neon-border">
                          <div className="bg-white/5 p-12 rounded-full">
                            <Camera className="w-24 h-24 text-white/20 animate-pulse" />
                          </div>
                        </div>
                        <button onClick={nextTask} className="btn-futuristic w-full bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/30">
                           {t.beautiful}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* MUSIC WORLD */}
        {appState === 'MUSIC' && (
          <motion.div 
            key="music"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="mt-28 w-full max-w-2xl flex flex-col items-center pb-20"
          >
            <div className="w-full flex items-center justify-between mb-8 px-4">
              <button 
                onClick={() => setAppState('HOME')} 
                className="p-4 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2 font-bold"
              >
                <ArrowRight className="w-6 h-6 rotate-180" />
                {t.back}
              </button>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 uppercase tracking-tighter">
                {t.musicWorld}
              </h2>
            </div>
            <Tuni message={t.musicDesc} />
            <div className="w-full flex flex-col gap-8 overflow-y-auto px-4 max-h-[70vh]">
              {SONGS.map((song, idx) => (
                <motion.div
                  key={song.id}
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-card overflow-hidden border-white/5 hover:border-yellow-500/50 transition-all relative group"
                >
                  <div className="aspect-video w-full bg-slate-900">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${song.youtubeId}?modestbranding=1&rel=0`}
                      title={song.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-t-3xl"
                    />
                  </div>
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{song.emoji}</span>
                      <div>
                        <h3 className="font-black text-xl text-white uppercase tracking-tight">
                          {gameState.lang === 'EN' ? song.title : song.bnTitle}
                        </h3>
                        <p className="text-slate-400 text-sm">Official Rhymes</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* SHOP SCREEN */}
        {appState === 'SHOP' && (
          <motion.div 
            key="shop"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="mt-28 w-full max-w-md flex flex-col items-center pb-20"
          >
            <div className="w-full flex items-center justify-between mb-8 px-4">
              <button 
                onClick={() => setAppState('HOME')} 
                className="p-4 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2 font-bold"
              >
                <ArrowRight className="w-6 h-6 rotate-180" />
                {t.back}
              </button>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 uppercase tracking-tighter">
                {t.shop}
              </h2>
            </div>
            <Tuni message="এখানে তুমি রকেট আর জাদুর পোশাক কিনতে পারো!" />
            <div className="w-full flex flex-col gap-6 px-4">
              <div className="glass-card p-6 border-purple-500/30 bg-purple-500/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">👑</div>
                  <div>
                    <h3 className="font-black text-white">{t.premium}</h3>
                    <p className="text-slate-400 text-xs">{t.removeAds}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setGameState(prev => ({ ...prev, isPremium: true }));
                    syncToFirebase({ isPremium: true });
                    alert("congratulations! You are now a Premium Explorer!");
                  }}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-950 px-6 py-2 rounded-xl font-bold shadow-lg"
                >
                  $4.99
                </button>
              </div>
              <div className="glass-card p-6 border-blue-500/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🚀</div>
                  <div>
                    <h3 className="font-black text-white">Super Rocket</h3>
                    <p className="text-slate-400 text-xs">Unlock All Lessons Now</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const newStars = gameState.stars - 100;
                    if(gameState.stars >= 100) {
                      setGameState(prev => ({ ...prev, stars: newStars, unlockedLessonIndex: LESSONS.length }));
                      syncToFirebase({ stars: newStars, unlockedLessonIndex: LESSONS.length });
                      alert("Super Rocket Activated!");
                    } else {
                      alert("Not enough stars! Watch ads to earn more.");
                    }
                  }}
                  className="bg-blue-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2"
                >
                  <Star className="w-4 h-4 fill-current" /> 100
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* AD BREAK SCREEN */}
        {appState === 'AD_BREAK' && (
          <motion.div 
            key="ad-break"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] nebula-bg flex flex-col items-center justify-center p-8"
          >
            <div className="w-full max-w-md aspect-video glass-card border-purple-500/50 flex flex-col items-center justify-center relative overflow-hidden bg-slate-900 shadow-[0_0_100px_rgba(168,85,247,0.3)]">
               <p className="text-slate-500 font-mono tracking-widest animate-pulse">TRANSMITTING AD_BLOCK_01...</p>
               <div className="absolute top-4 right-4 bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold">SPONSORED</div>
               <div className="absolute bottom-0 left-0 h-1 bg-purple-500 w-full animate-[loading_3s_linear]" />
            </div>
            <div className="mt-10 flex flex-col items-center gap-4">
              <Rocket className="w-12 h-12 text-purple-400 animate-bounce" />
              <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-300 uppercase tracking-[0.2em]">
                {t.watchingAd}
              </p>
            </div>
          </motion.div>
        )}

        {/* FINISH SCREEN */}
        {appState === 'FINISHED_LESSON' && (
          <motion.div 
            key="finished"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-36 flex flex-col items-center text-center p-8 glass-card border-white/10"
          >
            <motion.div 
              animate={{ y: [0, -30, 0], rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="text-[10rem] mb-10 drop-shadow-[0_0_50px_rgba(139,92,246,0.6)]"
            >
              🏁
            </motion.div>
            <h2 className="text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">
              {t.lessonComplete}
            </h2>
            <div className="flex justify-center gap-4 mb-12">
              {[1, 2, 3].map(i => (
                <Star key={i} className="w-16 h-16 text-yellow-400 fill-current drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
              ))}
            </div>
            <div className="mb-12">
              <p className="text-6xl font-black text-white">+20</p>
            </div>
            <button onClick={() => setAppState('HOME')} className="btn-futuristic px-20 bg-gradient-to-r from-purple-600 to-indigo-600 border-none w-full">
              {t.keepGoing}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 pointer-events-none -z-20">
         <div className="absolute top-[15%] left-[10%] w-2 h-2 bg-white rounded-full blur-[2px] animate-pulse" />
         <div className="absolute top-[60%] right-[15%] w-3 h-3 bg-purple-500 rounded-full blur-[5px] animate-float opacity-50" />
      </div>
    </div>
  );
}
