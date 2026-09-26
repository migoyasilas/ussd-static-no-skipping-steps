import React, { useState } from 'react';
import { Terminal, Shield, Zap, Activity, Binary, Cpu } from 'lucide-react';
import useStore from '../store/useStore';
import LogProcessor from './common/LogProcessor';

const Debug = () => {
  const { logs, isConnected } = useStore();
  const [command, setCommand] = useState('');
  const [activeOutput, setActiveOutput] = useState('// System standby. Ready for telemetry...');
  const [ussdReq, setUssdReq] = useState({ 
    deviceId: '', 
    code: '', 
    variables: {},
    v_amount: '' 
  });

  const transmitCommand = () => {
     if (!command && !ussdReq.v_amount) return;
     setActiveOutput(`$ Dispatched override directive\n> Status: SENT\n> Node: ${ussdReq.deviceId || 'GLOBAL'}\n> TS: ${new Date().toISOString()}`);
     setCommand('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Engineering console</h2>
          <p className="text-xs font-medium text-slate-400">Low-level logic override</p>
        </div>
        <button onClick={transmitCommand} className="btn-primary px-8">
          Transmit
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
           <div className="native-surface">
              <div className="flex items-center gap-2 mb-6">
                 <Shield size={14} className="text-slate-900" />
                 <h3 className="text-xs font-bold text-slate-900">Protocol signals</h3>
              </div>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="label-micro lowercase first-letter:uppercase">Transaction reference</label>
                    <input 
                       className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:bg-white focus:border-slate-300 outline-none transition-all"
                       placeholder="TRX ID"
                       value={command}
                       onChange={e => setCommand(e.target.value)}
                    />
                 </div>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="label-micro lowercase first-letter:uppercase">Target node</label>
                       <input 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:bg-white focus:border-slate-300 outline-none transition-all"
                          placeholder="Node ID"
                          value={ussdReq.deviceId}
                          onChange={e => setUssdReq({...ussdReq, deviceId: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="label-micro lowercase first-letter:uppercase">Override value</label>
                       <input 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-300 outline-none transition-all"
                          placeholder="0.00"
                          type="number"
                          value={ussdReq.v_amount}
                          onChange={e => setUssdReq({...ussdReq, v_amount: e.target.value})}
                       />
                    </div>
                 </div>
              </div>

              <button className="w-full btn-secondary mt-6">
                 Force system flush
              </button>
           </div>

           <div className="native-surface bg-slate-900 border-none text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Cpu size={48} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                   <Cpu size={14} className="text-slate-400" />
                   <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Relay stability</h3>
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                      <span>Precision Rate</span>
                      <span className="text-emerald-400">99.8%</span>
                   </div>
                   <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[99.8%]" />
                   </div>
                </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                 <Binary size={14} className="text-slate-900" />
                 <h3 className="text-xs font-bold text-slate-900">Live telemetry stream</h3>
              </div>
              <button 
                onClick={() => setActiveOutput('// Log cleared.')}
                className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
              >
                Clear
              </button>
           </div>

           <div className="native-surface !p-0 overflow-hidden border-slate-100">
              <div className="bg-[#0f172a] p-8 font-mono text-[11px] text-emerald-400/90 leading-relaxed border-b border-white/5">
                 <div className="whitespace-pre-wrap">{activeOutput}</div>
              </div>

              <div className="bg-white">
                 <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between px-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Protocol stream</span>
                    <div className="flex items-center gap-2">
                       <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Node link</span>
                    </div>
                 </div>
                 
                 <div className="divide-y divide-slate-50">
                    {logs.length === 0 ? (
                       <div className="py-20 text-center text-[10px] font-bold uppercase text-slate-200">
                          Waiting for traffic...
                       </div>
                    ) : (
                      logs.slice(0, 10).map((log, i) => (
                        <LogProcessor key={i} log={log} />
                      ))
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Debug;
