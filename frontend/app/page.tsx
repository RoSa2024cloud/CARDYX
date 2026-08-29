import React from 'react';
import { LineChart, Wallet, Search, BookOpen, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      {/* Top Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white tracking-wider">CX</div>
          <span className="text-xl font-bold tracking-tight text-white">CARDYX</span>
        </div>
        <div className="flex items-center space-x-2 bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-700 w-64">
          <Search className="w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Token Name / PolicyID..." 
            className="bg-transparent border-none outline-none text-sm placeholder-slate-500 w-full"
          />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Digital Asset Intelligence</h1>
          <p className="text-slate-400 mt-2">Willkommen bei CARDYX. Verfolge Token-Metriken, durchleuchte Portfolios und lerne das Cardano-Ökosystem kennen.</p>
        </div>

        {/* Dashboard Grid Card-Skelette */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: ADA Kurs & Markt */}
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Cardano Market Status</span>
              <LineChart className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight">$0.38</span>
              <span className="text-xs font-semibold text-emerald-400 ml-2">+4.2%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="w-2/3 h-full bg-indigo-600 rounded-full"></div>
            </div>
          </div>

          {/* Card 2: Trending Assets */}
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Trending cDOG Scout</span>
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between"><span>1. $SNEK</span> <span className="text-emerald-400">+12.4%</span></div>
              <div className="flex justify-between"><span>2. $HOSKY</span> <span className="text-slate-400">0.0%</span></div>
            </div>
          </div>

          {/* Card 3: Wallet Tracker */}
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Portfolio Verteilung</span>
              <Wallet className="w-5 h-5 text-cyan-500" />
            </div>
            <p className="text-xs text-slate-400">Verbinde eine Cardano-Wallet-Adresse, um Token-Guthaben und NFT-Zuweisungen live zu analysieren.</p>
            <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 transition text-sm font-medium rounded-lg border border-slate-700">
              Wallet analysieren
            </button>
          </div>
        </div>

        {/* ADA-Kurs Sektion Placeholder */}
        <div className="p-6 bg-gradient-to-br from-indigo-900/20 to-slate-900 rounded-xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-indigo-400 text-sm font-medium">
              <BookOpen className="w-4 h-4" />
              <span>CARDYX Academy</span>
            </div>
            <h3 className="text-lg font-bold text-white">Bereit für den ADA-Kurs (Phase 1)?</h3>
            <p className="text-sm text-slate-400 max-w-xl">Erlerne die fundamentalen Bausteine der Cardano-Blockchain direkt in unserem interaktiven Dashboard-Modul.</p>
          </div>
          <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition text-sm font-medium rounded-lg text-white whitespace-nowrap">
            Kurs starten
          </button>
        </div>
      </main>
    </div>
  );
}
