import React, { useEffect } from 'react';
import { Smartphone, Signal, Box, Activity, ShieldCheck, Zap } from 'lucide-react';
import useStore from '../store/useStore';

const Fleet = () => {
  const { devices, isConnected } = useStore();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between px-1">
        <div>
           <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fleet nodes</h2>
           <p className="text-xs font-medium text-slate-400">Live hardware telemetry and relay status</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">
           <Zap size={12} className="animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-widest">Active Discovery</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.length === 0 ? (
          <div className="col-span-full py-20 text-center native-surface border-dashed border-slate-200 bg-slate-50/50">
             <Smartphone size={32} className="mx-auto mb-4 text-slate-200" />
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active nodes detected</p>
             <p className="text-[10px] text-slate-400 mt-1 lowercase">Ensure your gateway device is connected via WebSocket</p>
          </div>
        ) : (
          devices.map((dev, i) => (
            <div key={i} className="native-surface group hover:border-slate-300 transition-all">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-900 group-hover:bg-white transition-all">
                  <Smartphone size={24} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isConnected ? 'Online' : 'Offline'}
                  </div>
                  <span className="text-[9px] font-bold text-slate-300 font-mono">ID: {dev.slice(-8)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Relay Information</h4>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Signal size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">95% Signal</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Excellent</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Battery</p>
                    <p className="text-xs font-bold text-slate-900">88%</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Queue</p>
                    <p className="text-xs font-bold text-slate-900">0 Items</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                 <button className="text-[10px] font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest">
                    Diagnostics
                 </button>
                 <ShieldCheck size={16} className="text-emerald-500 opacity-20" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Fleet;
