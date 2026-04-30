/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
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
const firebaseConfigObj = (firebaseConfig && typeof firebaseConfig === 'object') ? firebaseConfig : {};
const app = initializeApp(firebaseConfigObj);
export const db = getFirestore(app, (firebaseConfigObj as any).firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// --- Gemini Initialization ---
const getApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '';
  } catch {
    return '';
  }
};
const ai = new GoogleGenAI({ apiKey: getApiKey() });

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
  type: 'LEARNING' | 'QUIZ' | 'TRACING' | 'CAMERA' | 'MIC' | 'AI_CHALLENGE';
  title: string;
  bnTitle: string;
  emoji?: string;
  options?: { emoji: string; label: string; correct: boolean }[];
  targetLetter?: string;
  targetColor?: string;
  aiPrompt?: string;
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
  customLessons: Lesson[];
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
      { id: 't-ai-1', type: 'AI_CHALLENGE', title: "Can you name something else starting with 'A'?", bnTitle: "'A' দিয়ে শুরু হয় এমন আর কী কী জানো?", aiPrompt: "The kid is learning the letter A. They just learned A is for Apple. Ask them to name something else starting with A. If they answer correctly, congratulate them. If not, give a hint. Keep it short for a kid." },
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
      { id: 't-ai-2', type: 'AI_CHALLENGE', title: "Tell Tuni about other red things!", bnTitle: "টুনিকে আরও কিছু লাল জিনিসের কথা বলো!", aiPrompt: "The kid is learning the color RED. Ask them to name something else that is usually red. Encourage them if they get it right." },
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
  },
  {
    id: 'l4',
    title: 'Numbers',
    bnTitle: 'সংখ্যা গণনা',
    icon: '🔢',
    color: 'from-orange-500 to-amber-600',
    tasks: [
      { id: 't8', type: 'LEARNING', title: "This is number '1'", bnTitle: "এটি হলো সংখ্যা '১'" },
      { id: 't9', type: 'TRACING', title: "Trace the number '1'", bnTitle: "তোমার আঙুল দিয়ে '১' লিখে দেখাও!", targetLetter: '1' },
      { id: 't10', type: 'QUIZ', title: "How many stars are there? ⭐", bnTitle: "এখানে কয়টি তারা আছে? ⭐", options: [
        { emoji: '1️⃣', label: 'One', correct: true },
        { emoji: '2️⃣', label: 'Two', correct: false },
        { emoji: '3️⃣', label: 'Three', correct: false },
        { emoji: '4️⃣', label: 'Four', correct: false },
      ]},
    ]
  },
  {
    id: 'l5',
    title: 'Animals',
    bnTitle: 'পশুপাখি',
    icon: '🦁',
    color: 'from-green-500 to-lime-600',
    tasks: [
      { id: 't11', type: 'LEARNING', title: "The Lion says ROAR!", bnTitle: "সিংহ গর্জন করে— হুঙ্কার!" },
      { id: 't12', type: 'MIC', title: "Roar like a Lion!", bnTitle: "সিংহের মতো গর্জন করো!" },
      { id: 't13', type: 'QUIZ', title: "Which one is the King of Jungle?", bnTitle: "বনের রাজা কোনটি?", options: [
        { emoji: '🦁', label: 'Lion', correct: true },
        { emoji: '🐘', label: 'Elephant', correct: false },
        { emoji: '🦒', label: 'Giraffe', correct: false },
        { emoji: '🦓', label: 'Zebra', correct: false },
      ]},
      { id: 't14', type: 'CAMERA', title: "Find a PET or a TOY animal!", bnTitle: "একটি পোষা প্রাণী বা খেলনা পশু দেখাও!" },
      { id: 't-ai-3', type: 'AI_CHALLENGE', title: "Why is the Lion the King?", bnTitle: "সিংহ কেন বনের রাজা?", aiPrompt: "The kid is learning about animals. Ask them why they think the lion is called the king of the jungle. Encourage their creativity." },
    ]
  },
  {
    id: 'l6',
    title: 'Shapes',
    bnTitle: 'আকার',
    icon: '🔺',
    color: 'from-pink-500 to-rose-600',
    tasks: [
      { id: 't15', type: 'LEARNING', title: "This is a Triangle!", bnTitle: "এটি হলো ত্রিভুজ!" },
      { id: 't16', type: 'TRACING', title: "Trace the triangle shape!", bnTitle: "ত্রিভুজ আকারটি আঁকো!", targetLetter: '△' },
      { id: 't17', type: 'CAMERA', title: "Find something round like a circle!", bnTitle: "বৃত্তের মতো গোল কিছু দেখাও!" },
      { id: 't18', type: 'QUIZ', title: "Which one has 3 sides?", bnTitle: "কোনটির ৩টি দিক আছে?", options: [
        { emoji: '🔺', label: 'Triangle', correct: true },
        { emoji: '🟩', label: 'Square', correct: false },
        { emoji: '🔵', label: 'Circle', correct: false },
        { emoji: '⭐', label: 'Star', correct: false },
      ]},
    ]
  },
  {
    id: 'l7',
    title: 'Vehicles',
    bnTitle: 'যানবাহন',
    icon: '🚗',
    color: 'from-cyan-500 to-blue-600',
    tasks: [
      { id: 't19', type: 'LEARNING', title: "The car goes Vroom!", bnTitle: "গাড়ি চলে ভট ভট ভট ভুম!" },
      { id: 't20', type: 'MIC', title: "Say Vroom!", bnTitle: "বলো ভুম ভুম!" },
      { id: 't-ai-4', type: 'AI_CHALLENGE', title: "Name a vehicle that flies.", bnTitle: "আকাশে ওড়ে এমন একটি গাড়ির নাম বলো।", aiPrompt: "The kid is learning about vehicles. Ask them to name a vehicle that flies in the sky. If they say airplane or helicopter, congratulate them!" },
      { id: 't21', type: 'QUIZ', title: "Which one runs on water?", bnTitle: "কোনটি পানিতে চলে?", options: [
        { emoji: '⛵', label: 'Boat', correct: true },
        { emoji: '🚗', label: 'Car', correct: false },
        { emoji: '✈️', label: 'Airplane', correct: false },
        { emoji: '🚲', label: 'Bicycle', correct: false },
      ]},
    ]
  },
  {
    id: 'l8',
    title: 'Body Parts',
    bnTitle: 'শরীরের অঙ্গ',
    icon: '👀',
    color: 'from-fuchsia-500 to-purple-600',
    tasks: [
      { id: 't22', type: 'LEARNING', title: "We see with our Eyes", bnTitle: "আমরা চোখ দিয়ে দেখি" },
      { id: 't23', type: 'CAMERA', title: "Point to your nose!", bnTitle: "তোমার নাক দেখাও!" },
      { id: 't24', type: 'QUIZ', title: "What do we use to hear?", bnTitle: "আমরা কী দিয়ে শুনি?", options: [
        { emoji: '👂', label: 'Ear', correct: true },
        { emoji: '👁️', label: 'Eye', correct: false },
        { emoji: '👃', label: 'Nose', correct: false },
        { emoji: '👅', label: 'Tongue', correct: false },
      ]},
    ]
  },
  {
    id: 'l9',
    title: 'Vegetables',
    bnTitle: 'শাকসবজি',
    icon: '🥕',
    color: 'from-emerald-500 to-green-600',
    tasks: [
      { id: 't25', type: 'LEARNING', title: "Carrots are healthy!", bnTitle: "গাজর স্বাস্থ্যের জন্য ভালো!" },
      { id: 't26', type: 'TRACING', title: "Trace the letter 'C' for Carrot!", bnTitle: "'C' অক্ষরটি লিখে দেখাও!", targetLetter: 'C' },
      { id: 't-ai-5', type: 'AI_CHALLENGE', title: "Tell Tuni about a green vegetable.", bnTitle: "টুনিকে একটি সবুজ সবজির নাম বলো।", aiPrompt: "The kid is learning about vegetables. Ask them to name a vegetable that is green in color. Be incredibly encouraging." },
      { id: 't27', type: 'QUIZ', title: "Which one is a vegetable?", bnTitle: "কোনটি সবজি?", options: [
        { emoji: '🥦', label: 'Broccoli', correct: true },
        { emoji: '🍎', label: 'Apple', correct: false },
        { emoji: '🍌', label: 'Banana', correct: false },
        { emoji: '🍉', label: 'Watermelon', correct: false },
      ]},
    ]
  },
  {
    id: 'l10',
    title: 'Space',
    bnTitle: 'মহাকাশ',
    icon: '🚀',
    color: 'from-indigo-500 to-violet-600',
    tasks: [
      { id: 't28', type: 'LEARNING', title: "The Moon shines at night!", bnTitle: "চাঁদ রাতে আলো দেয়!" },
      { id: 't29', type: 'MIC', title: "Say MOON!", bnTitle: "বলো চাঁদ!" },
      { id: 't-ai-6', type: 'AI_CHALLENGE', title: "What else is in the night sky?", bnTitle: "রাতের আকাশে আর কী কী দেখা যায়?", aiPrompt: "The kid is learning about space. Ask them what else they can see in the night sky besides the moon (looking for stars, planets, etc.)." },
      { id: 't30', type: 'QUIZ', title: "Which planet do we live on?", bnTitle: "আমরা কোন গ্রহে বাস করি?", options: [
        { emoji: '🌍', label: 'Earth', correct: true },
        { emoji: '☀️', label: 'Sun', correct: false },
        { emoji: '🌕', label: 'Moon', correct: false },
        { emoji: '⭐', label: 'Star', correct: false },
      ]},
    ]
  },
  {
    id: 'l11',
    title: 'Feelings',
    bnTitle: 'অনুভূতি',
    icon: '😊',
    color: 'from-teal-500 to-cyan-600',
    tasks: [
      { id: 't31', type: 'LEARNING', title: "When we are glad, we Smile!", bnTitle: "আমরা খুশি হলে হাসি!" },
      { id: 't32', type: 'MIC', title: "Laugh out loud: HA HA HA!", bnTitle: "জোরে হাসো: হা হা হা!" },
      { id: 't33', type: 'QUIZ', title: "Which face is sad?", bnTitle: "কোন মুখটি দুঃখের?", options: [
        { emoji: '😢', label: 'Sad', correct: true },
        { emoji: '😀', label: 'Happy', correct: false },
        { emoji: '😂', label: 'Laughing', correct: false },
        { emoji: '😎', label: 'Cool', correct: false },
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

const AIChallengeUI = ({ task, onComplete, t }: { task: Task, onComplete: () => void, t: any }) => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: `${task.aiPrompt}\nUser answer: ${input}` }] }],
        config: {
          systemInstruction: "You are Tuni, a friendly space parrot teaching kids. Keep responses very short (max 2 sentences), encouraging, and suitable for a 5-year-old."
        }
      });
      setResponse(response.text || 'Wow! Great job explorer!');
    } catch (error) {
      console.error("AI Challenge Error", error);
      setResponse("That's interesting! Let's keep going!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col items-center gap-6"
    >
      <div className="w-full glass-card p-8 flex flex-col gap-6 neon-border bg-slate-900/40">
        <div className="flex items-center gap-4 border-b border-white/10 pb-4">
          <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="font-black text-purple-200 uppercase tracking-widest text-sm">Space Challenge</h3>
        </div>
        
        {response ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            <p className="text-xl font-bold text-white leading-relaxed">{response}</p>
            <button 
              onClick={onComplete}
              className="btn-futuristic w-full bg-green-600/20 text-green-400 border-green-600/30"
            >
              {t.next} <ArrowRight className="inline ml-2" />
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-4">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-all font-medium"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <button 
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className={`btn-futuristic w-full flex items-center justify-center gap-3 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Rocket className="w-6 h-6" />
              )}
              {loading ? 'Transmitting...' : t.check}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const GenerateLessonNode = ({ onGenerate, lessonIndex, previousLessons }: { onGenerate: (l: Lesson) => void, lessonIndex: number, previousLessons: string[] }) => {
  const [loading, setLoading] = useState(false);
  
  const generate = async () => {
    setLoading(true);
    try {
      const prompt = `Create a fun, educational lesson for a young child (around 5 years old). It is lesson number ${lessonIndex + 1}. Make the topic new and exciting. 
We have already covered these topics: ${previousLessons.join(', ')}. Please choose a completely different topic. As they progress, introduce slightly more advanced vocabulary or new concepts while remaining suitable for a 5-year-old.
JSON format only. Do NOT wrap in markdown.  
The tasks array should contain exactly 4 tasks, using a mix of these shapes:
- {"id":"t_custom_1","type":"LEARNING","title":"Eng...","bnTitle":"Ben..."}
- {"id":"t_custom_2","type":"CAMERA","title":"Eng...","bnTitle":"Ben..."}
- {"id":"t_custom_3","type":"MIC","title":"Eng...","bnTitle":"Ben..."}
- {"id":"t_custom_4","type":"QUIZ","title":"Eng...","bnTitle":"Ben...","options":[{"emoji":"🍎","label":"Apple","correct":true}]}
- {"id":"t_custom_5","type":"AI_CHALLENGE","title":"Eng...","bnTitle":"Ben...","aiPrompt":"Ask them... "}
- {"id":"t_custom_6","type":"TRACING","title":"Eng...","bnTitle":"Ben...","targetLetter":"A"}

Return a JSON object conforming to this structure:
{"id": "l_custom_${Date.now()}", "title": "Topic Title in English", "bnTitle": "Topic Title in Bengali", "icon": "A single emoji", "color": "from-purple-500 to-indigo-600", "tasks": []}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
           responseMimeType: "application/json"
        }
      });
      
      const text = response.text || "{}";
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const newLesson = JSON.parse(cleanText);
      // Give tasks unique random IDs
      newLesson.tasks = newLesson.tasks.map((t: any) => ({ ...t, id: `t_custom_${Math.random()}` }));
      onGenerate(newLesson);
    } catch (e) {
      console.error(e);
      alert("Failed to generate lesson, please try again!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="relative flex flex-col items-center group">
       <div 
         className={`w-32 h-32 rounded-full flex flex-col items-center justify-center p-1 cursor-pointer transition-transform ${loading ? 'animate-pulse' : 'hover:scale-110'}`} 
         onClick={!loading ? generate : undefined}
       >
          <div className="w-full h-full rounded-full border-4 border-dashed border-purple-400 flex items-center justify-center bg-purple-500/20 backdrop-blur-sm shadow-[0_0_40px_rgba(168,85,247,0.3)]">
             {loading ? <div className="w-10 h-10 border-4 border-purple-300 border-t-transparent rounded-full animate-spin" /> : <Star className="w-12 h-12 text-yellow-300 animate-pulse" />}
          </div>
       </div>
       <div className={`mt-4 font-black tracking-widest text-center uppercase text-xs px-4 py-1 rounded-full backdrop-blur-md bg-purple-500/20 text-white`}>
          {loading ? 'Creating...' : 'Unlock via AI'}
       </div>
    </motion.div>
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
    isPremium: false,
    customLessons: []
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
        if (data) {
          setGameState(prev => ({
            ...prev,
            stars: data.stars || 0,
            unlockedLessonIndex: data.unlockedLessonIndex || 0,
            lang: (data.lang as Language) || 'BN',
            isPremium: !!data.isPremium,
            customLessons: data.customLessons || []
          }));
          setAppState('HOME');
        } else {
          throw new Error("User data is null");
        }
      } else {
        // Create new profile
        const newProfile = {
          uid,
          stars: 0,
          unlockedLessonIndex: 0,
          lang: 'BN',
          isPremium: false,
          customLessons: [],
          updatedAt: serverTimestamp()
        };
        await setDoc(userRef, newProfile);
        setGameState(prev => ({ ...prev, stars: 0, unlockedLessonIndex: 0, lang: 'BN', isPremium: false, customLessons: [] }));
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
      const allLessons = [...LESSONS, ...(gameState.customLessons || [])];
      const isNewLesson = allLessons.findIndex(l => l.id === gameState.currentLesson?.id) === gameState.unlockedLessonIndex;
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
      <div className="fixed top-0 left-0 right-0 h-20 md:h-24 flex items-center justify-between px-4 md:px-8 z-50 bg-slate-950/20 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleLang}
            className="bg-white/10 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <Languages className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            <span className="font-bold text-xs md:text-sm tracking-tighter uppercase">{gameState.lang === 'EN' ? 'BN' : 'EN'}</span>
          </button>
          
          {user && (
            <button 
              onClick={handleLogout}
              className="bg-red-500/10 backdrop-blur-md p-1.5 md:p-2 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all"
              title={t.logout}
            >
              <LogOut className="w-4 md:w-5 h-4 md:h-5 text-red-400" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => setAppState('SHOP')}
            className="bg-yellow-500/20 text-yellow-400 p-1.5 md:p-2 rounded-xl border border-yellow-500/30 hover:bg-yellow-500/30 transition-all flex items-center justify-center"
          >
            <Zap className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <div className="flex items-center gap-2 md:gap-3 bg-gradient-to-r from-purple-600/50 to-blue-600/50 px-3 md:px-5 py-1.5 md:py-2 rounded-2xl shadow-xl border border-white/10">
            <Star className="text-yellow-400 fill-current w-5 h-5 md:w-6 md:h-6 animate-pulse" />
            <span className="text-lg md:text-xl font-black">{gameState.stars}</span>
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
            className="mt-32 md:mt-40 w-[90%] max-w-md flex flex-col items-center glass-card p-6 md:p-10 text-center"
          >
            <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-6 md:mb-8 shadow-2xl">
              <UserIcon className="w-12 h-12 md:w-16 md:h-16 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black mb-4 uppercase tracking-tighter text-white">{t.login}</h2>
            <p className="text-slate-400 mb-8 md:mb-10 text-sm md:text-base leading-relaxed font-medium">{t.loginDesc}</p>
            <button 
              onClick={handleGoogleLogin}
              className="btn-futuristic w-full flex items-center justify-center gap-4 py-3 md:py-4"
            >
              <Globe className="w-5 h-5 md:w-6 md:h-6" />
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
            className="mt-24 md:mt-32 w-full max-w-2xl px-4 flex flex-col items-center gap-8 md:gap-10 pb-32"
          >
            <Tuni message={t.welcome} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {/* Free Stars Ad Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={showRewardedAd}
                className="flex items-center gap-4 p-4 glass-card border-green-500/30 bg-green-500/5 overflow-hidden"
              >
                <div className="bg-green-500 p-2 rounded-xl shadow-lg">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-black text-xs md:text-sm text-green-400 uppercase tracking-widest leading-none">{t.getStars}</p>
                  <p className="text-slate-400 text-[10px] md:text-xs">+20 Galactic Stars</p>
                </div>
                <div className="ml-auto bg-green-500/20 px-3 py-1 rounded-full text-[10px] font-bold">ADS</div>
              </motion.button>
              
              {/* Music Shortcut */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale:0.98 }}
                onClick={() => setAppState('MUSIC')}
                className="flex items-center gap-4 p-4 glass-card border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-blue-900/20 overflow-hidden group"
              >
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-black text-sm md:text-base text-yellow-300 uppercase tracking-tighter leading-none">{t.musicWorld}</p>
                  <p className="text-slate-400 text-[10px] md:text-xs">Songs & Rhymes</p>
                </div>
                <ArrowRight className="ml-auto w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </div>

            <motion.div 
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.05
                  }
                }
              }}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center gap-6 w-full relative"
            >
              {(() => { const allLessons = [...LESSONS, ...(gameState.customLessons || [])]; return allLessons.map((lesson, idx) => {
                const isLocked = idx > gameState.unlockedLessonIndex;
                const isCurrent = idx === gameState.unlockedLessonIndex;
                const isCompleted = idx < gameState.unlockedLessonIndex;
                const shift = idx % 2 === 0 ? -30 : 30;

                return (
                  <motion.div 
                    key={lesson.id}
                    variants={{
                      hidden: { x: idx % 2 === 0 ? -100 : 100, opacity: 0 },
                      show: { x: shift, opacity: 1 }
                    }}
                    className="relative flex flex-col items-center group"
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
              })})()}
              
              {(() => { 
                 const allLessons = [...LESSONS, ...(gameState.customLessons || [])]; 
                 return gameState.unlockedLessonIndex >= allLessons.length && (
                   <GenerateLessonNode 
                      onGenerate={(newLesson) => {
                         const updated = [...(gameState.customLessons || []), newLesson];
                         setGameState(p => ({ ...p, customLessons: updated }));
                         syncToFirebase({ customLessons: updated });
                      }} 
                      lessonIndex={allLessons.length}
                      previousLessons={allLessons.map(l => l.title)}
                   />
                 ); 
              })()}
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
            className="mt-24 md:mt-32 w-full max-w-2xl px-4 pb-12"
          >
            <div className="w-full flex items-center gap-4 md:gap-6 mb-8 md:mb-10">
              <button 
                onClick={() => setAppState('HOME')} 
                className="p-2 md:p-3 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/20 transition-all"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
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
                  <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 md:gap-10 px-2 md:px-4">
                    {task.type === 'LEARNING' && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        className="w-full flex flex-col items-center"
                      >
                        <motion.div 
                          animate={{ scale: [1, 1.02, 1] }}
                          transition={{ repeat: Infinity, duration: 3 }}
                          className="w-56 h-56 md:w-72 md:h-72 glass-card flex items-center justify-center mb-8 md:mb-10 neon-border scale-100 md:scale-110"
                        >
                          <div className="text-8xl md:text-[14rem] font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-purple-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">A</div>
                        </motion.div>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={nextTask} 
                          className="btn-futuristic w-full group py-4"
                        >
                          {t.next} <ArrowRight className="inline ml-2 group-hover:translate-x-2 transition-transform" />
                        </motion.button>
                      </motion.div>
                    )}
                    {task.type === 'MIC' && (
                      <motion.div className="flex flex-col items-center gap-10 md:gap-12">
                        <div className="text-8xl md:text-9xl p-8 md:p-12 glass-card bg-purple-500/20 shadow-[0_0_50px_rgba(239,68,68,0.2)]">🍎</div>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={nextTask} 
                          className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full shadow-[0_0_40px_rgba(59,130,246,0.6)] flex items-center justify-center animate-pulse"
                        >
                          <Mic className="w-8 h-8 md:w-10 md:h-10 text-white" />
                        </motion.button>
                        <p className="font-black text-blue-400 tracking-widest animate-bounce">APPLE!</p>
                      </motion.div>
                    )}
                    {task.type === 'QUIZ' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full">
                        {task.options?.map((opt, i) => (
                          <motion.button 
                            key={i}
                            whileHover={{ scale: 1.05, y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => opt.correct ? nextTask() : alert(t.tryAgain)}
                            className="glass-card p-6 md:p-10 flex flex-col items-center gap-3 md:gap-4 hover:bg-white/20 hover:border-purple-500 transition-all border border-white/5 group"
                          >
                            <span className="text-6xl md:text-7xl group-hover:scale-110 transition-transform">{opt.emoji}</span>
                            <span className="font-black text-purple-200 tracking-wide text-sm md:text-base">{opt.label}</span>
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
                      <div className="flex flex-col items-center gap-8 md:gap-10 text-center w-full px-2 md:px-4">
                        <div className="w-full aspect-video glass-card flex items-center justify-center border-dashed border-white/20 neon-border bg-black/20">
                          <div className="bg-white/5 p-8 md:p-12 rounded-full">
                            <Camera className="w-16 h-16 md:w-24 md:h-24 text-white/20 animate-pulse" />
                          </div>
                        </div>
                        <button onClick={nextTask} className="btn-futuristic w-full bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/30 py-4">
                           {t.beautiful}
                        </button>
                      </div>
                    )}
                    {task.type === 'AI_CHALLENGE' && (
                      <AIChallengeUI 
                        task={task} 
                        onComplete={nextTask} 
                        t={t}
                      />
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
            className="mt-24 md:mt-32 w-full max-w-4xl flex flex-col items-center px-4 pb-20"
          >
            <div className="w-full flex items-center justify-between mb-8">
              <button 
                onClick={() => setAppState('HOME')} 
                className="p-3 md:p-4 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2 font-bold"
              >
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6 rotate-180" />
                <span className="hidden sm:inline">{t.back}</span>
              </button>
              <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 uppercase tracking-tighter">
                {t.musicWorld}
              </h2>
            </div>
            <Tuni message={t.musicDesc} />
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
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
                  <div className="p-4 md:p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4">
                      <span className="text-3xl md:text-4xl">{song.emoji}</span>
                      <div>
                        <h3 className="font-black text-base md:text-xl text-white uppercase tracking-tight">
                          {gameState.lang === 'EN' ? song.title : song.bnTitle}
                        </h3>
                        <p className="text-slate-400 text-[10px] md:text-sm">Official Rhymes</p>
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
            className="mt-24 md:mt-32 w-full max-w-lg flex flex-col items-center px-4 pb-20"
          >
            <div className="w-full flex items-center justify-between mb-8">
              <button 
                onClick={() => setAppState('HOME')} 
                className="p-3 md:p-4 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2 font-bold"
              >
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6 rotate-180" />
                <span className="hidden sm:inline">{t.back}</span>
              </button>
              <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 uppercase tracking-tighter">
                {t.shop}
              </h2>
            </div>
            <Tuni message="এখানে তুমি রকেট আর জাদুর পোশাক কিনতে পারো!" />
            <div className="w-full flex flex-col gap-4 md:gap-6">
              <div className="glass-card p-4 md:p-6 border-purple-500/30 bg-purple-500/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-3xl md:text-4xl">👑</div>
                  <div>
                    <h3 className="font-black text-sm md:text-base text-white">{t.premium}</h3>
                    <p className="text-slate-400 text-[10px] md:text-xs">{t.removeAds}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setGameState(prev => ({ ...prev, isPremium: true }));
                    syncToFirebase({ isPremium: true });
                    alert("congratulations! You are now a Premium Explorer!");
                  }}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-950 px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-bold shadow-lg"
                >
                  $4.99
                </button>
              </div>
              <div className="glass-card p-4 md:p-6 border-blue-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-3xl md:text-4xl">🚀</div>
                  <div>
                    <h3 className="font-black text-sm md:text-base text-white">Super Rocket</h3>
                    <p className="text-slate-400 text-[10px] md:text-xs">Unlock All Lessons</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const allLessons = [...LESSONS, ...(gameState.customLessons || [])];
                    const newStars = gameState.stars - 100;
                    if(gameState.stars >= 100) {
                      setGameState(prev => ({ ...prev, stars: newStars, unlockedLessonIndex: allLessons.length }));
                      syncToFirebase({ stars: newStars, unlockedLessonIndex: allLessons.length });
                      alert("Super Rocket Activated!");
                    } else {
                      alert("Not enough stars! Watch ads to earn more.");
                    }
                  }}
                  className="bg-blue-500 text-white px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-bold shadow-lg flex items-center gap-2"
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
