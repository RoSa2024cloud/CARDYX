'use client';

import { useState } from 'react';
import { Wallet, Plus, ShieldCheck } from 'lucide-react';

interface WalletItem {
  id: string;
  address: string;
  stakeAddress: string | null;
  label: string | null;
  lastChecked: string;
  createdAt: string;
}

interface WalletRadarProps {
  wallets: WalletItem[];
  onWalletAdded: () => void;
}

export default function WalletRadar({ wallets, onWalletAdded }: WalletRadarProps) {
  const [inputAddress, setInputAddress] = useState('');
  const [inputLabel, setInputLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletMessage, setWalletMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputAddress.trim()) return;

    setIsSubmitting(true);
    setWalletMessage(null);

    fetch('http://localhost:4000/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: inputAddress.trim(),
        label: inputLabel.trim() || 'Überwachte Wallet',
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Fehler beim Speichern');
        return res.json();
      })
      .then((json) => {
        setIsSubmitting(false);
        if (json.success) {
          setWalletMessage({ type: 'success', text: 'Wallet erfolgreich im cDOG-Radar registriert!' });
          setInputAddress('');
          setInputLabel('');
          onWalletAdded(); // Löst den Refresh im Haupt-Dashboard aus
        } else {
          setWalletMessage({ type: 'error', text: json.error || 'Fehler beim Speichern.' });
        }
      })
      .catch((err) => {
        console.error(err);
        setIsSubmitting(false);
        setWalletMessage({ type: 'error', text: 'Verbindung zum Server fehlgeschlagen.' });
      });
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Eingabe-Formular */}
      <div className="lg:col-span-1 rounded-2xl border border-slate-900 bg-slate-900/20 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-indigo-400" /> Wallet hinzufügen
        </h2>
        <p className="text-xs text-slate-500 mb-4">Nimm eine Adresse in die cDOG-Überwachung auf.</p>
        
        <form onSubmit={handleAddWallet} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Cardano-Adresse (addr1...)</label>
            <input 
              type="text" 
              required
              placeholder="addr1q8..."
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Label / Alias</label>
            <input 
              type="text" 
              placeholder="z.B. Smart Money Wal"
              value={inputLabel}
              onChange={(e) => setInputLabel(e.target.value)}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold py-2 px-4 rounded-lg shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? 'Wird gespeichert...' : 'Radar aktivieren'}
          </button>
        </form>

        {walletMessage && (
          <div className={`mt-4 p-3 rounded-lg text-xs border ${
            walletMessage.type === 'success' 
              ? 'bg-green-950/30 border-green-900/50 text-green-400' 
              : 'bg-red-950/30 border-red-900/50 text-red-400'
          }`}>
            {walletMessage.text}
          </div>
        )}
      </div>

      {/* Tabelle der überwachten Wallets */}
      <div className="lg:col-span-2 rounded-2xl border border-slate-900 bg-slate-900/10 p-6 backdrop-blur-sm flex flex-col justify-between overflow-x-auto">
        <div>
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-400" /> cDOG Radar-Überwachung
          </h2>
          <p className="text-xs text-slate-500 mb-4">Aktuell in deiner PostgreSQL-Datenbank registrierte Wallets.</p>

          <table className="w-full text-left text-sm text-slate-300 min-w-[500px]">
            <thead className="text-xs text-slate-500 uppercase border-b border-slate-900 bg-slate-950/30">
              <tr>
                <th className="py-2 px-3">Label</th>
                <th className="py-2 px-3">Adresse</th>
                <th className="py-2 px-3 text-right">Registriert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/50">
              {wallets.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-slate-600 italic">
                    Noch keine Wallets im Radar. Füge links deine erste Adresse hinzu!
                  </td>
                </tr>
              ) : (
                wallets.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-3 px-3 font-semibold text-cyan-400 truncate max-w-[120px]">
                      {w.label}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500 font-mono truncate max-w-[200px]" title={w.address}>
                      {w.address}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-400 text-right">
                      {new Date(w.createdAt).toLocaleDateString('de-DE')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
