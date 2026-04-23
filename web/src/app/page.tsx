"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Target, 
  Zap, 
  Search, 
  Bell, 
  Smartphone, 
  Mail, 
  Globe, 
  ArrowRight,
  ShieldCheck,
  Cpu
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white font-outfit overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-md bg-black/50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Target className="w-8 h-8 text-emerald-primary" />
          <span className="text-2xl font-black tracking-tighter">HOME<span className="text-emerald-primary">SEEK</span></span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-bold uppercase tracking-widest text-white/60">
          <a href="#how-it-works" className="hover:text-emerald-primary transition-colors">Alerts</a>
          <a href="#features" className="hover:text-emerald-primary transition-colors">Explore</a>
          <a href="#pricing" className="hover:text-emerald-primary transition-colors">Pricing</a>
        </div>
        <Link 
          href="/discover" 
          className="bg-emerald-primary hover:bg-emerald-secondary text-black px-6 py-2 rounded-full text-sm font-black transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        >
          LAUNCH SNIPER
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-primary/10 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] -z-10 -translate-x-1/2 translate-y-1/2" />
        
        <div className="text-center space-y-8 relative">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.3em] text-emerald-primary mb-6">
              AI-Powered Real Estate Intake
            </span>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
              NEVER MISS A <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-primary via-emerald-300 to-emerald-primary bg-[length:200%_auto] animate-gradient-slow">PERFECT HOME.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-white/50 text-xl font-medium leading-relaxed">
              The first autonomous rental sniper designed for the South African market. 
              We monitor 10+ platforms 24/7 so you don't have to. 
              Get alerts before anyone else.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link 
              href="/discover"
              className="w-full sm:w-auto bg-white text-black px-10 py-5 rounded-2xl text-lg font-black flex items-center justify-center gap-3 hover:bg-emerald-primary hover:text-white transition-all group active:scale-95 shadow-xl"
            >
              START SNIPING <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#how-it-works"
              className="w-full sm:w-auto bg-white/5 border border-white/10 px-10 py-5 rounded-2xl text-lg font-black flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
            >
              SEE INTEL <Zap className="w-5 h-5 fill-emerald-primary text-emerald-primary" />
            </a>
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-20 relative px-4"
        >
          <div className="glass-emerald rounded-[3rem] p-4 lg:p-8 aspect-video border border-white/10 shadow-2xl relative">
             <div className="absolute inset-0 bg-transparent rounded-[2.5rem] overflow-hidden">
                <div className="w-full h-full bg-[#050505] flex flex-col p-6 space-y-6">
                   <div className="h-4 w-1/4 bg-white/5 rounded-full" />
                   <div className="grid grid-cols-3 gap-4">
                      <div className="h-40 bg-white/5 rounded-3xl" />
                      <div className="h-40 bg-white/5 rounded-3xl" />
                      <div className="h-40 bg-white/5 rounded-3xl" />
                   </div>
                   <div className="h-8 w-1/3 bg-white/10 rounded-full" />
                   <div className="grid grid-cols-2 gap-4">
                      <div className="h-24 bg-white/5 rounded-2xl border border-emerald-primary/10" />
                      <div className="h-24 bg-white/5 rounded-2xl border border-emerald-primary/10" />
                   </div>
                </div>
             </div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-emerald-primary/10 backdrop-blur-2xl border border-emerald-primary/20 p-8 rounded-full">
                   <Search className="w-12 h-12 text-emerald-primary animate-pulse" />
                </div>
             </div>
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 px-8 max-w-7xl mx-auto space-y-24">
        <div className="text-center space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-primary">The Protocol</h2>
          <p className="text-4xl md:text-5xl font-black">HOW THE SNIPER WORKS</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { 
              icon: Globe, 
              title: "GLOBAL SCAN", 
              desc: "Our engine patrols Gumtree, Facebook, Property24, and private portals simultaneously every 10 minutes." 
            },
            { 
              icon: Cpu, 
              title: "AI ANALYSIS", 
              desc: "Gemini 1.5 Flash instantly filters noise, extracts requirements, and validates listing quality in real-time." 
            },
            { 
              icon: Bell, 
              title: "INSTANT DEPLOYMENT", 
              desc: "When a match is found, we blast notifications via WhatsApp or Email before the link even goes viral." 
            }
          ].map((item, i) => (
            <div key={i} className="space-y-6 group">
              <div className="p-5 bg-white/5 rounded-3xl border border-white/5 group-hover:border-emerald-primary/30 transition-all">
                <item.icon className="w-10 h-10 text-emerald-primary" />
              </div>
              <h3 className="text-2xl font-black">{item.title}</h3>
              <p className="text-white/40 leading-relaxed font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-32 bg-white/5 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
           <div className="space-y-12">
              <div className="space-y-4">
                 <h2 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-primary">Intelligence</h2>
                 <p className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1]">WHY HOME SEEK IS <br />OVERPOWERED.</p>
              </div>
              
              <div className="space-y-8">
                 {[
                   { icon: Smartphone, t: "WhatsApp Integration", d: "Paid users get direct messages with listing details and direct links." },
                   { icon: Mail, t: "Email Digests", d: "Free users receive high-frequency email summaries of new findings." },
                   { icon: ShieldCheck, t: "Scam Detection", d: "AI automatically flags suspicious listings based on historical data patterns." }
                 ].map((feat, i) => (
                   <div key={i} className="flex gap-6 items-start">
                      <div className="p-3 bg-emerald-primary/10 rounded-2xl text-emerald-primary mt-1">
                         <feat.icon className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                         <h4 className="text-xl font-bold">{feat.t}</h4>
                         <p className="text-white/40 text-sm font-medium">{feat.d}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
           
           <div className="relative">
              <div className="glass p-8 rounded-[3rem] border border-white/10 space-y-6">
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-bold opacity-40 uppercase tracking-widest">Incoming Intel</span>
                    <span className="bg-emerald-primary text-black text-[10px] font-black px-2 py-1 rounded-full animate-pulse">LIVE</span>
                 </div>
                 <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex gap-4">
                       <div className="w-12 h-12 bg-white/10 rounded-xl" />
                       <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-white/20 rounded-full" />
                          <div className="h-3 w-1/2 bg-white/10 rounded-full" />
                       </div>
                    </div>
                    <div className="bg-emerald-primary/5 p-4 rounded-2xl border border-emerald-primary/20 flex gap-4">
                       <div className="w-12 h-12 bg-emerald-primary/20 rounded-xl" />
                       <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-emerald-primary/40 rounded-full" />
                          <div className="h-3 w-1/2 bg-emerald-primary/20 rounded-full" />
                       </div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex gap-4">
                       <div className="w-12 h-12 bg-white/10 rounded-xl" />
                       <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-white/20 rounded-full" />
                          <div className="h-3 w-1/2 bg-white/10 rounded-full" />
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-primary">Access Protocols</h2>
          <p className="text-4xl md:text-5xl font-black">CHOOSE YOUR INTEL TANK</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* FREE */}
          <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-between hover:border-white/10 transition-all group">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2">Standard</h3>
                <p className="text-4xl font-black">FREE</p>
              </div>
              <ul className="space-y-4 text-sm font-medium text-white/60">
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                   24h Check-in Frequency
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                   Email Summaries
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                   Basic Dashboard
                </li>
              </ul>
            </div>
            <Link href="/discover" className="mt-12 block text-center py-4 rounded-2xl bg-white/5 border border-white/10 font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all">Select Protocol</Link>
          </div>

          {/* BRONZE */}
          <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-between hover:border-white/10 transition-all">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-emerald-primary uppercase tracking-widest mb-2">Silent Hunter</h3>
                <p className="text-4xl font-black">R149<span className="text-sm opacity-40">/mo</span></p>
              </div>
              <ul className="space-y-4 text-sm font-medium text-white/80">
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-emerald-primary rounded-full" />
                   8h Check-in Frequency
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-emerald-primary rounded-full" />
                   WhatsApp Notifications
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-emerald-primary rounded-full" />
                   Automated Tracking
                </li>
              </ul>
            </div>
            <Link href="/discover" className="mt-12 block text-center py-4 rounded-2xl bg-emerald-primary/10 border border-emerald-primary/20 text-emerald-primary font-black text-sm uppercase tracking-widest hover:bg-emerald-primary/20 transition-all">Upgrade to Bronze</Link>
          </div>

          {/* SILVER */}
          <div className="bg-white/5 border-2 border-emerald-primary/30 p-8 rounded-[2.5rem] flex flex-col justify-between relative overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.1)]">
            <div className="absolute top-0 right-0 bg-emerald-primary text-black px-4 py-1 text-[10px] font-black uppercase tracking-tighter rounded-bl-xl">POPULAR</div>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2">Proactive Sniper</h3>
                <p className="text-4xl font-black">R299<span className="text-sm opacity-40">/mo</span></p>
              </div>
              <ul className="space-y-4 text-sm font-medium text-white/90">
                <li className="flex items-center gap-3 text-emerald-primary">
                   <Zap className="w-4 h-4 text-emerald-primary fill-emerald-primary" />
                   4h Check-in Frequency
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-emerald-primary rounded-full" />
                   Priority Support
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-emerald-primary rounded-full" />
                   Advanced Area Filters
                </li>
              </ul>
            </div>
            <Link href="/discover" className="mt-12 block text-center py-4 rounded-2xl bg-emerald-primary text-black font-black text-sm uppercase tracking-widest hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all">Upgrade to Silver</Link>
          </div>

          {/* GOLD */}
          <div className="bg-gradient-to-br from-emerald-950/50 to-black border-2 border-emerald-primary/50 p-8 rounded-[2.5rem] flex flex-col justify-between shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-2">Discovery Overlord</h3>
                <p className="text-4xl font-black">R499<span className="text-sm opacity-40">/mo</span></p>
              </div>
              <ul className="space-y-4 text-sm font-medium text-white">
                <li className="flex items-center gap-3 text-emerald-primary font-bold">
                   <Zap className="w-4 h-4 text-emerald-primary fill-emerald-primary" />
                   1h Check-in Frequency
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-emerald-primary rounded-full" />
                   Instant Smart Alerts
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-emerald-primary rounded-full" />
                   Unlimited Alert Tasks
                </li>
              </ul>
            </div>
            <Link href="/discover" className="mt-12 block text-center py-4 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-emerald-primary hover:text-white transition-all shadow-xl">Activate Overlord</Link>
          </div>
        </div>
        
        <p className="text-center text-white/20 text-xs font-bold uppercase tracking-[0.2em]">
           * MULTIPLEX ALERTS enable real-time detection across all discovery missions in the network.
        </p>
      </section>

      {/* Footer */}
      <footer className="py-20 px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-2">
            <Target className="w-8 h-8 text-emerald-primary" />
            <span className="text-2xl font-black tracking-tighter">HOME<span className="text-emerald-primary">SEEK</span></span>
          </div>
          <div className="text-white/20 text-sm font-medium">
            &copy; 2026 Home Seek Protocol. All systems nominal.
          </div>
          <div className="flex gap-6">
            <a href="#" className="p-3 bg-white/5 rounded-full hover:bg-emerald-primary transition-all group">
              <Mail className="w-5 h-5 text-white/50 group-hover:text-black transition-colors" />
            </a>
            <a href="#" className="p-3 bg-white/5 rounded-full hover:bg-emerald-primary transition-all group">
              <Smartphone className="w-5 h-5 text-white/50 group-hover:text-black transition-colors" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

