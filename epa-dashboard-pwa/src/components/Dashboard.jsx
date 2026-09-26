import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  Activity, 
  ShieldCheck, 
  BarChart3, 
  History,
  Cpu,
  ArrowUpRight
} from 'lucide-react';
import useStore from '../store/useStore';
import LogProcessor from './common/LogProcessor';

const Dashboard = () => {
  const { logs, devices, isConnected, payments } = useStore();

  // Calculate Real Metrics
  const paymentList = Array.isArray(payments) ? payments : [];
  const totalVolume = paymentList.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const successCount = paymentList.filter(p => (p.status || '').toUpperCase() === 'SUCCESS').length;
  const integrity = paymentList.length > 0 ? (successCount / paymentList.length * 100).toFixed(1) : '100';

  const metrics = [
    { label: 'Settlement volume', val: `৳${totalVolume.toLocaleString()}`, status: 'Live', icon: BarChart3, color: 'text-slate-900' },
    { label: 'Active nodes', val: Array.isArray(devices) ? devices.length : 0, status: isConnected ? 'Operational' : 'Link offline', icon: Zap, color: isConnected ? 'text-emerald-600' : 'text-rose-500' },
    { label: 'Integrity rate', val: `${integrity}%`, status: 'System nominal', icon: ShieldCheck, color: 'text-slate-900' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((m, i) => (
          <div key={i} className="native-surface">
            <div className="flex items-center justify-between mb-4">
               <div className="p-2.5 rounded-xl bg-slate-50 text-slate-900 border border-slate-100">
                  <m.icon size={16} strokeWidth={2} />
               </div>
               <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${m.status === 'Operational' || m.status === 'System nominal' || m.status === 'Live' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>
                  {m.status}
               </span>
            </div>
            <div className="space-y-1">
               <p className="label-micro tracking-widest">{m.label}</p>
               <h3 className={`text-2xl font-bold tracking-tight ${m.color}`}>{m.val}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between px-1">
               <div className="flex items-center gap-2">
                  <Activity size={14} className="text-slate-900" />
                  <h3 className="text-xs font-bold text-slate-900">Live traffic signals</h3>
               </div>
               <button className="text-[10px] font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest">
                  View full logs
               </button>
            </div>
            
            <div className="native-surface !p-0 overflow-hidden divide-y divide-slate-50">
              {logs.length === 0 ? (
                <div className="py-20 text-center bg-white">
                   <Activity size={24} className="mx-auto mb-3 text-slate-100" />
                   <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Listening for signals...</p>
                </div>
              ) : (
                logs.slice(0, 6).map((log, i) => (
                  <LogProcessor key={i} log={log} />
                ))
              )}
            </div>
         </div>

        <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-xs font-bold text-slate-900">Fleet integrity</h3>
               <Cpu size={14} className="text-slate-200" />
            </div>
            
            <div className="native-surface space-y-3">
               {devices.length === 0 ? (
                 <div className="py-10 text-center text-[10px] font-bold uppercase text-slate-200 border border-dashed border-slate-100 rounded-xl">
                    No nodes active
                 </div>
               ) : (
                 devices.map(dev => (
                   <div key={dev} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex items-center gap-3">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                         <span className="text-[11px] font-bold text-slate-900 uppercase">
                            {dev.slice(-8)}
                         </span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase">Live link</span>
                   </div>
                 ))
               )}
            </div>

            <div className="native-surface bg-slate-900 border-none text-white relative h-32 flex flex-col justify-center overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ShieldCheck size={64} />
               </div>
               <div className="relative z-10">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Encrypted Gateway</p>
                  <h4 className="text-sm font-bold tracking-tight">Access control active</h4>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
