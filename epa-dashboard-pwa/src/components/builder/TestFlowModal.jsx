import React, { useState } from 'react';
import { Smartphone, Zap, X, Play, Loader2, AlertCircle } from 'lucide-react';
import useStore from '../../store/useStore';

const TestFlowModal = ({ isOpen, onClose, script }) => {
  const { devices } = useStore();
  const [selectedDevice, setSelectedDevice] = useState('');
  const [variables, setVariables] = useState({});
  const [isFiring, setIsFiring] = useState(false);
  const [result, setResult] = useState(null);
  
  // Timing overrides
  const [timings, setTimings] = useState({
    grace_period_ms: 3500,
    settling_delay_ms: 400,
    step_cooldown_ms: 2000,
    step_input_delay_ms: 300
  });

  // Extract {{variables}} from ussd_code and steps
  const extractVariables = () => {
    const text = [script.ussd_code, ...(script.steps || [])].join(' ');
    const matches = text.match(/{{([^}]+)}}/g) || [];
    return [...new Set(matches.map(m => m.replace(/{{|}}/g, '')))];
  };

  const detectedVars = extractVariables();

  const handleFire = async () => {
    if (!selectedDevice) return;
    setIsFiring(true);
    setResult(null);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/api/trigger`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_id: selectedDevice,
          ussd_code: script.ussd_code,
          steps: script.steps,
          variables: variables,
          ...timings // Send overrides
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ status: 'ERROR', message: err.message });
    } finally {
      setIsFiring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-[var(--action-blue)]">
                 <Smartphone size={18} strokeWidth={3} />
              </div>
              <div>
                 <h4 className="label-micro !text-[var(--core-navy)]">Protocol Test Rig</h4>
                 <p className="text-[8px] font-black text-[var(--slate-400)] uppercase tracking-widest leading-none">Real-Device Verification</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 text-slate-300 hover:text-[var(--core-navy)] transition-colors">
              <X size={20} />
           </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
           {/* Device Selection */}
           <div className="space-y-2">
              <label className="label-micro ml-1">Select Target Node</label>
              <div className="grid grid-cols-1 gap-2">
                 {devices.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-100 flex items-center gap-3 text-slate-300">
                       <AlertCircle size={14} />
                       <span className="text-[10px] font-bold uppercase">No Nodes Online</span>
                    </div>
                 ) : (
                    devices.map(dev => (
                       <button 
                         key={dev}
                         onClick={() => setSelectedDevice(dev)}
                         className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                           selectedDevice === dev 
                             ? 'border-[var(--action-blue)] bg-blue-50/10' 
                             : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                         }`}
                       >
                          <div className="flex items-center gap-3">
                             <div className={`w-2 h-2 rounded-full ${selectedDevice === dev ? 'bg-[var(--action-blue)]' : 'bg-slate-200'}`} />
                             <span className="text-[10px] font-black text-[var(--core-navy)] uppercase tracking-tight">{dev}</span>
                          </div>
                          <span className="text-[8px] font-black text-slate-300 uppercase letter-spacing-widest">v2.1</span>
                       </button>
                    ))
                 )}
              </div>
           </div>

           {/* Variable Inputs */}
           {detectedVars.length > 0 && (
              <div className="space-y-3">
                 <label className="label-micro ml-1 text-blue-400">Parameter Mapping</label>
                 <div className="space-y-3">
                    {detectedVars.map(v => (
                       <div key={v} className="relative">
                          <input 
                             className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[11px] font-black text-[var(--core-navy)] focus:bg-white focus:border-[var(--action-blue)] outline-none transition-all"
                             placeholder={`Enter ${v.toUpperCase()}...`}
                             value={variables[v] || ''}
                             onChange={e => setVariables({...variables, [v]: e.target.value})}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-200 uppercase pointer-events-none">
                             {v}
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           )}

           {/* Timing Overrides */}
           <div className="space-y-3">
              <label className="label-micro ml-1 text-emerald-500">Timing Overrides (ms)</label>
              <div className="grid grid-cols-2 gap-3">
                 {[
                   { key: 'grace_period_ms', label: 'Grace' },
                   { key: 'settling_delay_ms', label: 'Settle' },
                   { key: 'step_cooldown_ms', label: 'Cooldown' },
                   { key: 'step_input_delay_ms', label: 'Input' }
                 ].map(t => (
                   <div key={t.key} className="space-y-1">
                      <div className="text-[7px] font-black text-slate-400 uppercase ml-1">{t.label}</div>
                      <input 
                         type="number"
                         className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black text-[var(--core-navy)] focus:bg-white focus:border-emerald-400 outline-none transition-all"
                         value={timings[t.key]}
                         onChange={e => setTimings({...timings, [t.key]: parseInt(e.target.value) || 0})}
                      />
                   </div>
                 ))}
              </div>
           </div>

           {/* Execution Preview */}
           <div className="p-4 rounded-2xl bg-[var(--core-navy)] text-white/90">
              <div className="flex items-center gap-2 mb-3">
                 <Zap size={12} className="text-yellow-400" strokeWidth={3} />
                 <h5 className="label-micro !text-yellow-400">Chain Logic</h5>
              </div>
              <div className="font-mono text-[9px] space-y-1 opacity-60">
                 <div className="flex gap-2">
                    <span className="text-blue-400">INIT</span>
                    <span className="truncate">{script.ussd_code || '*...#'}</span>
                 </div>
                 {script.steps?.map((s, i) => (
                    <div key={i} className="flex gap-2">
                       <span className="text-blue-400">STEP {i+1}</span>
                       <span className="truncate">{s}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-slate-50/50 flex flex-col gap-3">
           <button 
             onClick={handleFire}
             disabled={!selectedDevice || isFiring}
             className="w-full py-4 bg-[var(--action-blue)] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
           >
              {isFiring ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              {isFiring ? 'TRANSMITTING...' : 'FIRE PROTOCOL TEST'}
           </button>
           
           {result && (
              <div className={`p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-1 ${
                result.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}>
                 {result.status === 'SUCCESS' ? <AlertCircle size={14} /> : <AlertCircle size={14} />}
                 <span className="text-[10px] font-black uppercase tracking-tight">
                    {result.status === 'SUCCESS' ? `DISPATCHED: ${result.execution_id}` : `FAILED: ${result.message}`}
                 </span>
              </div>
           )}
        </div>

      </div>
    </div>
  );
};

export default TestFlowModal;
