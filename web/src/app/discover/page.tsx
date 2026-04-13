"use client";

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { collection, query, orderBy, onSnapshot, limit, addDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  Search, 
  Zap, 
  ExternalLink,
  Loader2,
  Plus,
  X,
  Globe,
  MessageSquare,
  Sparkles,
  MapPin,
  Home,
  PawPrint,
  Sun,
  RefreshCw,
  Bell,
  History,
  Cpu,
  BedDouble,
  Wind,
  LayoutGrid,
  Trash2
} from 'lucide-react';

// --- SCHEMAS (ZOD) ---
const ListingSchema = z.object({
  id: z.string(),
  title: z.string().default("Untitiled Property"),
  price: z.number().default(0),
  address: z.string().default("Unknown Address"),
  bedrooms: z.number().optional(),
  is_pet_friendly: z.boolean().default(false),
  has_solar: z.boolean().default(false),
  platform: z.string().default("Web"),
  timestamp: z.any(),
  imageUrl: z.string().optional(),
  source_url: z.string().optional(),
  match_score: z.number().optional(),
  match_reason: z.string().optional(),
});

const TaskSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  query: z.string().default(""),
  status: z.string().default("Pending"),
  logs: z.array(z.string()).default([]),
  timestamp: z.any(),
  completed: z.boolean().default(false),
});

const SourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
});

const MODEL_OPTIONS = [
  { value: 'gemini-flash-latest', label: 'Gemini Flash', desc: 'High-speed extraction' },
  { value: 'gemini-pro-latest', label: 'Gemini Pro', desc: 'Complex reasoning' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Preview', desc: 'Experimental Intelligence' }
];

type Listing = z.infer<typeof ListingSchema>;
type Source = z.infer<typeof SourceSchema>;
type Task = z.infer<typeof TaskSchema>;

export default function DiscoverPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mounted, setMounted] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].value);

  useEffect(() => {
    setMounted(true);
    // 1. Listen for Listings
    const qListings = query(
      collection(db, 'listings'),
      where('user_id', '==', 'demo-user'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeListings = onSnapshot(qListings, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = { id: doc.id, ...doc.data() };
        return ListingSchema.parse(raw); // This will "clean" and validate the data!
      });
      setListings(data); // Don't fallback to mock data, it confuses the user!
      setLoading(false);
    }, (error) => {
      console.warn("Firestore Indexing in progress (Listings)...", error);
      if (error.message.includes("requires an index")) {
        setIndexError("Listings Index Needed");
      }
    });

    // 2. Listen for Sources
    const qSources = query(collection(db, 'sources'), where('user_id', '==', 'demo-user'));
    const unsubscribeSources = onSnapshot(qSources, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = { id: doc.id, ...doc.data() };
        return SourceSchema.parse(raw);
      });
      setSources(data);
    });

    // 3. Listen for Tasks (Active and History)
    const qTasks = query(
      collection(db, 'tasks'),
      where('user_id', '==', 'demo-user'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const taskList = snapshot.docs.map(doc => {
        const raw = { id: doc.id, ...doc.data() };
        return TaskSchema.parse(raw);
      });
      setTasks(taskList);
      
      // Update active task if it's not completed
      const current = taskList.find(t => !t.completed);
      setActiveTask(current || null);
    }, (error) => {
      console.warn("Firestore Indexing in progress (Tasks)...", error);
      if (error.message.includes("requires an index")) {
        setIndexError("System Index Needed");
      }
    });

    return () => {
      unsubscribeListings();
      unsubscribeSources();
      unsubscribeTasks();
    };
  }, []);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceUrl) return;
    try {
      const name = new URL(newSourceUrl).hostname.replace('www.', '');
      await addDoc(collection(db, 'sources'), {
        url: newSourceUrl,
        name: name,
        user_id: 'demo-user',
        createdAt: serverTimestamp()
      });
      setNewSourceUrl('');
    } catch (err) {
      console.error("Error adding source:", err);
      alert("Invalid URL");
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sources', id));
    } catch (err) {
      console.error("Error deleting source:", err);
    }
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt || isDeploying || activeTask) return;
    
    setIsDeploying(true);
    try {
      const response = await fetch('http://localhost:8000/deploy-sniper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: "demo-user",
          search_query: aiPrompt,
          model: selectedModel,
          alert_enabled: alertEnabled
        })
      });
      
      const data = await response.json();
      if (data.status === 'accepted') {
        // Task started! Listener will pick it up
      } else {
        alert(data.message || "Failed to deploy sniper");
      }
    } catch (err) {
      console.error("Deploy error:", err);
    } finally {
        setIsDeploying(false);
    }
  };


  if (!mounted) {
    return <div className="min-h-screen bg-[#050505]" />;
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white font-outfit">
      {/* Header */}
      <nav className="px-8 py-6 flex justify-between items-center border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Target className="w-6 h-6 text-emerald-primary" />
          <span className="text-xl font-black tracking-tighter">HOME<span className="text-emerald-primary">SEEK</span></span>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-emerald-primary animate-pulse" />
              Sniper Active
           </div>
        </div>
      </nav>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden">
        {/* Left Side: Controls */}
        <div className="w-full lg:w-[400px] border-r border-white/5 p-8 space-y-10 overflow-y-auto shrink-0 bg-[#080808]">
          
          {/* AI Prompt Window */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-primary">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">AI Filter Search</h3>
            </div>
            <div className="glass-emerald p-6 rounded-[2rem] border border-emerald-primary/10 space-y-4">
              <div className="bg-black/40 p-4 rounded-2xl text-[11px] font-medium leading-relaxed text-white/60 border border-white/5">
                <p className="mb-2 text-emerald-primary font-bold uppercase tracking-widest">Instructions:</p>
                Describe your dream home. Mention <span className="text-white">budget</span>, <span className="text-white">neighborhoods</span>, <span className="text-white">pet policy</span>, and <span className="text-white">solar needs</span>. 
                Our AI will parse sources and alert you instantly when a match lands.
              </div>
              <form onSubmit={handleAiSearch} className="space-y-4">
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. 2 Bedroom in Claremont, pet friendly, under R20k with solar..."
                  className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 min-h-[100px] resize-none placeholder:text-white/20"
                />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <Bell className={`w-4 h-4 ${alertEnabled ? 'text-emerald-primary' : 'text-white/20'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Alerts</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setAlertEnabled(!alertEnabled)}
                      className={`w-10 h-5 rounded-full relative transition-all ${alertEnabled ? 'bg-emerald-primary' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${alertEnabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Model Selector */}
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="w-3 h-3 text-emerald-primary" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Intelligence Level</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                       {MODEL_OPTIONS.map((opt) => (
                         <button
                           key={opt.value}
                           type="button"
                           onClick={() => setSelectedModel(opt.value)}
                           className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${selectedModel === opt.value ? 'bg-emerald-primary/10 border-emerald-primary/40' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
                         >
                            <span className={`text-[10px] font-bold ${selectedModel === opt.value ? 'text-emerald-primary' : 'text-white'}`}>{opt.label}</span>
                            <span className="text-[8px] text-white/30 font-medium">{opt.desc}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  {isDeploying || activeTask ? (
                    <div className="flex gap-2 w-full">
                      <button 
                        disabled 
                        className="flex-1 bg-emerald-primary/10 text-emerald-primary/50 cursor-not-allowed font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-sm border border-emerald-primary/10"
                      >
                        EXTRACTING... <RefreshCw className="w-3 h-3 animate-spin" />
                      </button>
                      <button 
                        type="button"
                        onClick={async () => {
                          if (activeTask) {
                            try {
                              await deleteDoc(doc(db, 'tasks', activeTask.id));
                              setActiveTask(null);
                            } catch (e) { console.error(e); }
                          }
                        }}
                        className="p-4 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-2xl border border-red-500/20 transition-all flex items-center justify-center"
                        title="Force Stop & Clear Stuck Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="submit"
                      className="w-full bg-emerald-primary hover:bg-emerald-secondary text-black font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      UPDATE INTELLIGENCE <Zap className="w-3 h-3 fill-black" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>

          {/* Logs moved to center */}

          {/* History Sidebar */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-white/40">
              <History className="w-4 h-4" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">History</h3>
            </div>
            <div className="space-y-3">
              {tasks.filter((t: any) => t.completed).slice(0, 3).map((task: any) => (
                <div key={task.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
                      {task.timestamp?.toDate ? new Date(task.timestamp.toDate()).toLocaleDateString() : 'Recent'}
                    </span>
                    <span className="text-[9px] bg-emerald-primary/10 text-emerald-primary px-2 py-0.5 rounded-full font-bold">SAVED</span>
                  </div>
                  <p className="text-[11px] text-white/60 line-clamp-1 leading-relaxed italic group-hover:text-white transition-colors">
                    "{task.query}"
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Sources CRUD */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/40">
                <Globe className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em]">Sources</h3>
              </div>
              <span className="text-[10px] font-black text-white/20 uppercase">{sources.length} Tracking</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {sources.map(source => (
                  <motion.div 
                    key={source.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-white/5 border border-white/10 rounded-full group hover:border-emerald-primary/40 transition-all"
                  >
                    <span className="text-[10px] font-bold text-white/60 capitalize">{source.name}</span>
                    <button 
                      onClick={() => handleDeleteSource(source.id)}
                      className="p-1 hover:bg-red-500/20 rounded-full text-white/20 hover:text-red-500 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              <form onSubmit={handleAddSource} className="relative w-full mt-2">
                <input 
                  type="text" 
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="Add new source URL..."
                  className="w-full bg-white/5 border border-dashed border-white/10 rounded-2xl px-5 py-3 text-xs focus:outline-none focus:border-emerald-primary/50 transition-all placeholder:text-white/20"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-primary rounded-xl text-black hover:bg-emerald-secondary transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </form>
            </div>
          </section>

          {/* Notification Status */}
          <section className="pt-6 border-t border-white/5">
             <div className="flex items-center gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                <div className="p-2 bg-blue-500/20 rounded-xl text-blue-500">
                   <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Alerts Configured</p>
                  <p className="text-xs text-white/40 font-medium">WhatsApp: +27 72 *** ****</p>
                </div>
             </div>
          </section>

        </div>

        {/* Right Side: Results Grid */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-black">
          <div className="max-w-6xl mx-auto space-y-10">
            {activeTask ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto w-full pt-12"
              >
                <div className="relative group">
                  {/* Decorative Elements */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-primary/20 via-blue-500/10 to-emerald-primary/20 rounded-[2.5rem] blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  
                  <div className="relative bg-[#0a0a0a] border border-emerald-primary/20 rounded-[2.5rem] overflow-hidden">
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-primary/10 rounded-2xl flex items-center justify-center border border-emerald-primary/20">
                          <Cpu className="w-6 h-6 text-emerald-primary animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black uppercase tracking-widest text-white">Sniper Engine</h3>
                          <p className="text-[10px] font-mono text-emerald-primary/50">ACTIVE SESSION: {activeTask.id.slice(0,12)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-primary/10 rounded-full border border-emerald-primary/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-primary animate-ping" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-primary">Processing...</span>
                      </div>
                    </div>

                    {/* Terminal Window */}
                    <div className="p-8 font-mono text-[12px] leading-relaxed min-h-[400px] max-h-[60vh] overflow-y-auto custom-scrollbar bg-black/50">
                      <div className="space-y-3">
                        {activeTask.logs?.map((log: string, idx: number) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="flex gap-4 group/log"
                          >
                            <span className="text-white/20 shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                            <span className="text-emerald-primary/40 shrink-0">[{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                            <span className={`
                              ${idx === activeTask.logs.length - 1 ? 'text-emerald-primary font-bold' : 'text-white/60'}
                              ${log.includes('🚀') || log.includes('🕷️') ? 'text-white flex items-center gap-2' : ''}
                            `}>
                              {log}
                              {idx === activeTask.logs.length - 1 && (
                                <span className="inline-block w-1.5 h-4 bg-emerald-primary ml-1 animate-pulse" />
                              )}
                            </span>
                          </motion.div>
                        ))}
                        {activeTask.logs.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-20 text-white/20 space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p className="tracking-[0.3em] font-black uppercase text-[10px]">Initializing Core...</p>
                          </div>
                        )}
                        <div id="logs-end" />
                      </div>
                    </div>

                    {/* Footer Progress */}
                    <div className="px-8 py-6 border-t border-white/5 bg-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3 h-3 text-white/20" />
                          <span className="text-[10px] font-bold text-white/40 uppercase">Sources: 1/1</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3 text-white/20" />
                          <span className="text-[10px] font-bold text-white/40 uppercase">AI: Neural-V2</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className={`w-8 h-1 rounded-full ${i <= 3 ? 'bg-emerald-primary/40' : 'bg-white/5'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-10">
                <div className="flex items-center justify-between">
                   <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                     Intelligence Feed
                     <span className="text-[10px] bg-emerald-primary/10 text-emerald-primary px-3 py-1 rounded-full border border-emerald-primary/20">LIVE</span>
                   </h2>
                   <div className="flex gap-2">
                      <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                        <Search className="w-4 h-4 text-white/40" />
                      </div>
                   </div>
                </div>

                {loading && listings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    {indexError ? (
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                          <Zap className="w-8 h-8 text-amber-500 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-amber-500">Database Indexing Required</h3>
                          <p className="text-white/40 text-sm max-w-sm mt-1">Please check your browser console and click the Google link to enable this search view.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Loader2 className="w-10 h-10 text-emerald-primary animate-spin" />
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Decrypting feed...</p>
                      </>
                    )}
                  </div>
                ) : listings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                       <Search className="w-6 h-6 text-white/20" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-lg font-bold text-white/60">No Intelligence Found</h3>
                       <p className="text-xs text-white/20 max-w-xs mx-auto">Try broadening your AI search parameters or adding more sources to scan.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                      {listings.map((item, i) => (
                        <motion.div 
                          key={item.id} 
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="glass overflow-hidden group hover:border-emerald-primary/30 transition-all duration-500 flex flex-col rounded-[2rem] border border-white/5"
                        >
                          <div className="h-48 bg-white/5 relative overflow-hidden">
                            <img 
                              src={item.imageUrl || `/assets/property-${(i % 3) + 1}.png`} 
                              alt="" 
                              className="w-full h-full object-cover grayscale-[0.5] transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black border border-white/10 uppercase tracking-widest">
                              <Home className="w-2.5 h-2.5 text-emerald-primary" />
                              {item.platform}
                            </div>
                            <div className="absolute bottom-4 left-4">
                               <span className="text-2xl font-black text-white">
                                 R {item.price.toLocaleString()}
                               </span>
                            </div>
                          </div>
                          
                          <div className="p-6 space-y-4 flex-1 flex flex-col">
                            <div className="flex-1 space-y-1">
                              <h3 className="text-base font-bold leading-tight line-clamp-2 group-hover:text-emerald-primary transition-colors">
                                {item.title}
                              </h3>
                              <p className="text-[11px] text-white/40 font-medium flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-emerald-primary" />
                                {item.address}
                              </p>
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5">
                              {item.bedrooms && (
                                <span className="bg-white/5 px-3 py-1 rounded-lg text-[9px] border border-white/5 font-bold uppercase">{item.bedrooms} BEDS</span>
                              )}
                              {item.is_pet_friendly && (
                                <div className="bg-emerald-primary/10 text-emerald-primary px-3 py-1 rounded-lg text-[9px] border border-emerald-primary/20 font-black flex items-center gap-1.5">
                                  <PawPrint className="w-2.5 h-2.5" /> PETS
                                </div>
                              )}
                              {item.has_solar && (
                                <div className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-lg text-[9px] border border-amber-500/20 font-black flex items-center gap-1.5">
                                  <Sun className="w-2.5 h-2.5" /> SOLAR
                                </div>
                              )}
                            </div>

                            {/* AI Match Reason */}
                            {(item as any).match_reason && (
                              <div className="bg-emerald-primary/5 p-4 rounded-2xl border border-emerald-primary/10 relative overflow-hidden group/reason">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 text-emerald-primary">
                                    <Sparkles className="w-3 h-3" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">AI Match Intel</span>
                                  </div>
                                  <span className="text-[10px] font-black text-emerald-primary/40">{(item as any).match_score}%</span>
                                </div>
                                <p className="text-[11px] text-white/60 leading-relaxed italic">
                                  "{ (item as any).match_reason }"
                                </p>
                              </div>
                            )}
                            
                            <a 
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-emerald-primary hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 text-xs mt-2"
                            >
                              OPEN LISTING <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

