import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Save, Search, CheckCircle2, Plus, Trash2 } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  approvedIntercepts?: string[];
  activeIntercepts?: any[];
  hasUnhandledCrisis?: boolean;
}

export function SettingsModal({ 
  isOpen, 
  onClose,
  approvedIntercepts = [],
  activeIntercepts = [],
  hasUnhandledCrisis = false
}: SettingsModalProps) {
  const [integrations, setIntegrations] = useState([
    { name: 'Gmail', enabled: true },
    { name: 'Google Calendar', enabled: true },
    { name: 'Google Classroom', enabled: true },
    { name: 'Slack', enabled: true },
    { name: 'Jira', enabled: true },
  ]);
  const [secrets, setSecrets] = useState([
    { name: 'Jira API Token', value: '' },
    { name: 'Slack Bot Token', value: '' },
  ]);
  const [activeTab, setActiveTab] = useState<'integrations' | 'secrets' | 'badges'>('integrations');

  if (!isOpen) return null;

  const addSecret = () => {
    setSecrets([...secrets, { name: '', value: '' }]);
  };

  const toggleIntegration = (index: number) => {
    const newIntegrations = [...integrations];
    newIntegrations[index].enabled = !newIntegrations[index].enabled;
    setIntegrations(newIntegrations);
  };

  const removeSecret = (index: number) => {
    setSecrets(secrets.filter((_, i) => i !== index));
  };

  const updateSecret = (index: number, field: 'name' | 'value', value: string) => {
    const newSecrets = [...secrets];
    newSecrets[index][field] = value;
    setSecrets(newSecrets);
  };

  // Badge unlock checks
  const isCalendarUnlocked = approvedIntercepts.some(id => activeIntercepts.find(i => i.id === id)?.category === "calendar");
  const isAcademicUnlocked = approvedIntercepts.some(id => activeIntercepts.find(i => i.id === id)?.category === "assignment");
  const isWalletUnlocked = approvedIntercepts.some(id => activeIntercepts.find(i => i.id === id)?.category === "bill");
  const isCrisisUnlocked = activeIntercepts.length > 0 && !hasUnhandledCrisis;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b flex justify-between items-center bg-stone-50">
            <h2 className="text-lg font-bold">Settings</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex border-b bg-white">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex-1 p-4 text-sm font-semibold transition-colors ${activeTab === 'integrations' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-stone-500 hover:text-stone-800'}`}
            >
              Integrations
            </button>
            <button
              onClick={() => setActiveTab('secrets')}
              className={`flex-1 p-4 text-sm font-semibold transition-colors ${activeTab === 'secrets' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-stone-500 hover:text-stone-800'}`}
            >
              Secrets
            </button>
            <button
              onClick={() => setActiveTab('badges')}
              className={`flex-1 p-4 text-sm font-semibold transition-colors ${activeTab === 'badges' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-stone-500 hover:text-stone-800'}`}
            >
              Badges
            </button>
          </div>

          <div className="p-6 overflow-y-auto bg-stone-50 flex-1">
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                  <input type="text" placeholder="Search integrations..." className="w-full pl-10 p-2 border border-stone-200 rounded-lg text-sm bg-white" />
                </div>
                <div className="space-y-4">
                  {integrations.map((item, index) => (
                    <div key={item.name} className="flex justify-between items-center p-4 bg-white rounded-xl border border-stone-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-stone-100" />
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{item.name}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleIntegration(index)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${item.enabled ? 'bg-emerald-500' : 'bg-stone-300'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'secrets' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  {secrets.map((secret, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Secret Name</label>
                        <input 
                          type="text" 
                          value={secret.name}
                          onChange={(e) => updateSecret(index, 'name', e.target.value)}
                          className="w-full p-3 border border-stone-200 rounded-lg text-sm bg-white" 
                          placeholder="e.g. Jira API Token" 
                        />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Secret Value</label>
                        <input 
                          type="password" 
                          value={secret.value}
                          onChange={(e) => updateSecret(index, 'value', e.target.value)}
                          className="w-full p-3 border border-stone-200 rounded-lg text-sm bg-white" 
                          placeholder="Enter value" 
                        />
                      </div>
                      <button onClick={() => removeSecret(index)} className="p-3 text-stone-400 hover:text-red-500 rounded-lg border border-stone-200">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={addSecret}
                  className="w-full border-2 border-dashed border-stone-300 text-stone-500 p-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:border-brand-primary hover:text-brand-primary transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add secret
                </button>
                <button className="w-full bg-brand-primary text-white p-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-primary/90 transition-colors">
                  <Save className="w-4 h-4" /> Save Configuration
                </button>
              </div>
            )}
            
            {activeTab === 'badges' && (
              <div className="space-y-6">
                <div className="text-stone-600 text-xs leading-relaxed font-serif bg-stone-100 border border-stone-200/60 p-4 rounded-xl">
                  🏆 Unlock badges by resolving active workspace crises, scheduling slots, and mitigating billing thresholds!
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Calendar Master Badge */}
                  <div className={`p-4 rounded-2xl border flex flex-col items-center text-center transition-all duration-500 ${
                    isCalendarUnlocked 
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-900 shadow-[0_4px_15px_rgba(245,158,11,0.15)]" 
                      : "bg-white border-stone-200 text-stone-400 grayscale opacity-55"
                  }`}>
                    <span className="text-3xl mb-2">📅</span>
                    <h3 className="text-xs font-bold font-mono tracking-tight uppercase mb-1">Calendar Master</h3>
                    <p className="text-[10px] leading-relaxed font-sans text-stone-500">Successfully rescheduled a calendar overlap clash.</p>
                    {isCalendarUnlocked && (
                      <span className="text-[8px] bg-amber-500 text-white font-extrabold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider mt-3 animate-pulse">UNLOCKED</span>
                    )}
                  </div>

                  {/* Academic Shield Badge */}
                  <div className={`p-4 rounded-2xl border flex flex-col items-center text-center transition-all duration-500 ${
                    isAcademicUnlocked 
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-900 shadow-[0_4px_15px_rgba(59,130,246,0.15)]" 
                      : "bg-white border-stone-200 text-stone-400 grayscale opacity-55"
                  }`}>
                    <span className="text-3xl mb-2">🎓</span>
                    <h3 className="text-xs font-bold font-mono tracking-tight uppercase mb-1">Academic Shield</h3>
                    <p className="text-[10px] leading-relaxed font-sans text-stone-500">Deployed a study buffer for a classroom deadline.</p>
                    {isAcademicUnlocked && (
                      <span className="text-[8px] bg-blue-500 text-white font-extrabold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider mt-3 animate-pulse">UNLOCKED</span>
                    )}
                  </div>

                  {/* Wallet Guardian Badge */}
                  <div className={`p-4 rounded-2xl border flex flex-col items-center text-center transition-all duration-500 ${
                    isWalletUnlocked 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 shadow-[0_4px_15px_rgba(16,185,129,0.15)]" 
                      : "bg-white border-stone-200 text-stone-400 grayscale opacity-55"
                  }`}>
                    <span className="text-3xl mb-2">💳</span>
                    <h3 className="text-xs font-bold font-mono tracking-tight uppercase mb-1">Wallet Guardian</h3>
                    <p className="text-[10px] leading-relaxed font-sans text-stone-500">Authorized a critical bill threshold payment.</p>
                    {isWalletUnlocked && (
                      <span className="text-[8px] bg-emerald-500 text-white font-extrabold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider mt-3 animate-pulse">UNLOCKED</span>
                    )}
                  </div>

                  {/* Crisis Defuser Badge */}
                  <div className={`p-4 rounded-2xl border flex flex-col items-center text-center transition-all duration-500 ${
                    isCrisisUnlocked 
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-900 shadow-[0_4px_15px_rgba(168,85,247,0.15)]" 
                      : "bg-white border-stone-200 text-stone-400 grayscale opacity-55"
                  }`}>
                    <span className="text-3xl mb-2">🛡️</span>
                    <h3 className="text-xs font-bold font-mono tracking-tight uppercase mb-1">Crisis Defuser</h3>
                    <p className="text-[10px] leading-relaxed font-sans text-stone-500">Cleared 100% of outstanding active workspace threats.</p>
                    {isCrisisUnlocked && (
                      <span className="text-[8px] bg-purple-500 text-white font-extrabold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider mt-3 animate-pulse">UNLOCKED</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
