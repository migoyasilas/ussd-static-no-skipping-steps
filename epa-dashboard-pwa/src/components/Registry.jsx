import React, { useState } from 'react';
import { 
  Plus, 
  Terminal, 
  Play, 
  Save, 
  Trash,
  ChevronRight,
  Code2,
  Database,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Settings2,
  Activity,
  Layers,
  Zap
} from 'lucide-react';
import useStore from '../store/useStore';

const Registry = () => {
  const { methods, setMethods, normalizeId } = useStore();
  const [activeMethod, setActiveMethod] = useState({ 
    name: 'New Connection', 
    extractors: [],
    webhook_url: '',
    active: true,
    identifier: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState(null);

  const saveMethod = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/api/methods`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(activeMethod)
      });
      
      if (res.ok) {
        alert('Extraction logic synced to gateway');
        setMethods(prev => {
          const exists = prev.find(m => m.identifier === activeMethod.identifier);
          if (exists) return prev.map(m => m.identifier === activeMethod.identifier ? activeMethod : m);
          return [...prev, activeMethod];
        });
        setEditMode(false);
      } else {
        const msg = res.status === 401 
          ? 'Unauthorized: Account identity validation failed.'
          : `Sync rejected: ${res.status} ${res.statusText}`;
        alert(msg);
      }
    } catch (err) {
      alert('Sync failure: ' + err.message);
    }
  };

  const purgeMethod = async () => {
    if (!activeMethod.identifier || !window.confirm(`Permanently purge "${activeMethod.name}" logic?`)) return;

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/api/methods/${activeMethod.identifier}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setMethods(prev => prev.filter(m => m.identifier !== activeMethod.identifier));
        setEditMode(false);
      } else {
        alert('Purge rejected: Logic is protected or active.');
      }
    } catch (err) {
      alert('Purge failure: ' + err.message);
    }
  };

  const addExtractor = () => {
    setActiveMethod({
      ...activeMethod,
      extractors: [...activeMethod.extractors, { field_name: '', regex: '', group_index: 1 }]
    });
  };

  const removeExtractor = (index) => {
    const next = [...activeMethod.extractors];
    next.splice(index, 1);
    setActiveMethod({ ...activeMethod, extractors: next });
  };

  const runTest = () => {
    const results = {};
    activeMethod.extractors.forEach(ext => {
      try {
        let pattern = ext.regex;
        let flags = 'g';
        
        // POSIX Bridge: Convert inline flags to JS flags
        if (pattern.startsWith('(?i)')) {
          pattern = pattern.slice(4);
          flags += 'i';
        }
        if (pattern.startsWith('(?m)')) {
          pattern = pattern.slice(4);
          flags += 'm';
        }
        
        const regex = new RegExp(pattern, flags);
        const match = testInput.match(regex);
        if (match && match[ext.group_index]) {
          results[ext.field_name || 'unnamed'] = match[ext.group_index];
        } else {
          results[ext.field_name || 'unnamed'] = 'NO MATCH';
        }
      } catch (e) {
        results[ext.field_name || 'unnamed'] = 'INVALID REGEX';
      }
    });
    setTestResult(results);
  };

  if (!editMode) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="flex items-center justify-between px-1">
          <div>
             <h2 className="text-xl font-bold text-slate-900 tracking-tight">Extraction workshop</h2>
             <p className="text-xs font-medium text-slate-400">Logic parser for USSD & SMS payload extraction</p>
          </div>
          <button onClick={() => {
             setActiveMethod({ name: 'New Connection', extractors: [], webhook_url: '', active: true, identifier: '' });
             setTestResult(null);
             setEditMode(true);
          }} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            New Logic
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {methods.map((method) => (
            <div 
              key={method.identifier} 
              onClick={() => { setActiveMethod(method); setEditMode(true); }}
              className="native-surface group cursor-pointer hover:border-slate-300 transition-all border-l-4 border-l-slate-900"
            >
               <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                        <Zap size={20} />
                     </div>
                     <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{method.name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{method.identifier}</p>
                     </div>
                  </div>
                  <Settings2 size={16} className="text-slate-200 group-hover:text-slate-900 transition-colors" />
               </div>

               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parser chain</span>
                     <span className="text-[10px] font-bold text-slate-900">{method.extractors?.length || 0} Stages</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                     <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                        <Activity size={10} /> Live
                     </span>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="lg:col-span-12 flex items-center justify-between mb-4">
         <button onClick={() => setEditMode(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors">
            ← Exit Workshop
         </button>
         <div className="flex items-center gap-3">
            <button 
              onClick={purgeMethod}
              className="btn-secondary text-red-500 border-red-50 flex items-center gap-2"
            >
               <Trash size={14} />
               Purge
            </button>
            <button onClick={saveMethod} className="btn-primary flex items-center gap-2 shadow-lg shadow-slate-200">
               <Save size={14} />
               Sync Logic
            </button>
         </div>
      </div>

      <div className="lg:col-span-5 space-y-6">
         <div className="native-surface border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
               <Settings2 size={14} /> Connection Identity
            </h3>
            
            <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="label-micro lowercase first-letter:uppercase">Method alias</label>
                    <input 
                       className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:bg-white focus:border-slate-300 outline-none transition-all uppercase"
                       value={activeMethod.name}
                       onChange={e => setActiveMethod({...activeMethod, name: e.target.value})}
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="label-micro lowercase first-letter:uppercase">Webhook callback URL</label>
                    <input 
                       className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-medium text-slate-500 focus:bg-white focus:border-slate-300 outline-none transition-all"
                       placeholder="https://your-api.com/webhooks"
                       value={activeMethod.webhook_url || ''}
                       onChange={e => setActiveMethod({...activeMethod, webhook_url: e.target.value})}
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="label-micro lowercase first-letter:uppercase">System identifier</label>
                    <input 
                       className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-400 outline-none transition-all uppercase"
                       placeholder="E.G. BKASH_GATEWAY"
                       value={activeMethod.identifier}
                       onChange={e => setActiveMethod({...activeMethod, identifier: e.target.value})}
                    />
                 </div>
            </div>
         </div>

         <div className="native-surface">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
               <Layers size={14} /> Sandbox testing
            </h3>
            <div className="space-y-4">
               <div>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-[11px] font-mono text-slate-600 focus:bg-white focus:border-slate-300 outline-none transition-all min-h-[120px]"
                    placeholder="Paste raw USSD/SMS payload here..."
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                  />
               </div>
               <button onClick={runTest} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                  <Play size={14} /> Execute Parser
               </button>

               {testResult && (
                  <div className="pt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Extracted Results</p>
                     {Object.entries(testResult).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                           <span className="text-[10px] font-bold text-slate-500 uppercase">{k}</span>
                           <span className={`text-[11px] font-mono font-bold ${
                             v === 'INVALID REGEX' ? 'text-red-500' : 
                             v === 'NO MATCH' ? 'text-amber-500' : 'text-slate-900'
                           }`}>{v}</span>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         </div>
      </div>

      <div className="lg:col-span-7 space-y-6">
         <div className="native-surface h-full">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Database size={14} /> Logic Configuration
               </h3>
               <button onClick={addExtractor} className="text-[10px] font-bold text-slate-900 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-all uppercase tracking-widest">
                  + Add Key
               </button>
            </div>

            <div className="space-y-6">
               {activeMethod.extractors.map((ext, i) => (
                  <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-6 group relative">
                    <button 
                      onClick={() => removeExtractor(i)}
                      className="absolute top-4 right-4 text-slate-200 hover:text-red-500 transition-colors"
                    >
                      <Trash size={14} />
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="label-micro lowercase first-letter:uppercase">Target field</label>
                          <input 
                            className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:border-slate-300 outline-none transition-all"
                            value={ext.field_name}
                            placeholder="e.g. amount"
                            onChange={e => {
                               const next = [...activeMethod.extractors];
                               next[i].field_name = e.target.value;
                               setActiveMethod({...activeMethod, extractors: next});
                            }}
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="label-micro lowercase first-letter:uppercase">Regex group</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:border-slate-300 outline-none transition-all"
                            value={ext.group_index}
                            onChange={e => {
                               const next = [...activeMethod.extractors];
                               next[i].group_index = parseInt(e.target.value);
                               setActiveMethod({...activeMethod, extractors: next});
                            }}
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="label-micro lowercase first-letter:uppercase">Posix regex pattern</label>
                       <div className="relative">
                          <Terminal size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input 
                            className="w-full bg-white border border-slate-100 rounded-xl pl-10 pr-4 py-3 text-[11px] font-mono font-bold text-slate-600 focus:border-slate-300 outline-none transition-all"
                            value={ext.regex}
                            placeholder="(?i)amount:\s*([\d\.]+)"
                            onChange={e => {
                               const next = [...activeMethod.extractors];
                               next[i].regex = e.target.value;
                               setActiveMethod({...activeMethod, extractors: next});
                            }}
                          />
                       </div>
                    </div>
                  </div>
               ))}

               {activeMethod.extractors.length === 0 && (
                  <div className="py-20 text-center">
                     <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                        <Database size={24} />
                     </div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logic chain is empty</p>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Registry;
