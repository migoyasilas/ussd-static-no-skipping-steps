import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, 
  Terminal, 
  Play, 
  Save, 
  Trash,
  ChevronRight,
  Code2,
  Database,
  Cpu,
  X,
  Zap,
  Activity,
  History,
  CheckCircle2,
  XCircle,
  BarChart3,
  RefreshCcw,
  Clock,
  Settings2,
  Layers,
  ArrowRight,
  TrendingUp,
  Files
} from 'lucide-react';
import useStore from '../store/useStore';
import StepBuilder from './builder/StepBuilder';

const GatewayConsole = ({ logs }) => {
  const scrollRef = useRef(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogStyle = (status) => {
    switch(status?.toLowerCase()) {
      case 'info': return 'text-blue-400';
      case 'live_menu': return 'text-amber-400';
      case 'timeout': return 'text-rose-400 font-bold';
      case 'success': return 'text-emerald-400 font-bold';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
       <div 
         ref={scrollRef}
         className="bg-slate-900 rounded-[32px] p-8 h-[600px] overflow-y-auto font-mono text-[11px] leading-relaxed shadow-inner border border-slate-800"
       >
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 italic">
               Waiting for gateway telemetry...
            </div>
          ) : (
            <div className="space-y-2">
               {logs.map((log, i) => (
                 <div key={i} className="flex gap-4 group hover:bg-white/5 p-1 rounded transition-colors">
                    <span className="text-slate-700 shrink-0 tabular-nums font-medium">
                       [{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]
                    </span>
                    <span className="text-slate-500 shrink-0 font-bold uppercase tracking-widest w-20">
                       {log.status || 'event'}
                    </span>
                    <span className={`${getLogStyle(log.status)} break-all`}>
                       {log.response || log.message || 'Processing orchestration packet...'}
                    </span>
                 </div>
               ))}
            </div>
          )}
       </div>
    </div>
  );
};

const Scripts = () => {
  const { scripts, setScripts, isSyncing, normalizeId, devices, ussdLogs, setUssdLogs } = useStore();
  const [activeScript, setActiveScript] = useState(null);
  const [activeTab, setActiveTab] = useState('library'); // library | console | reporting
  const [saving, setSaving] = useState(false);
  
  const [showTestModal, setShowTestModal] = useState(false);
  const [testVars, setTestVars] = useState({});
  const [targetNode, setTargetNode] = useState('');
  const [executing, setExecuting] = useState(false);

  // Split logs for different views
  const orchestrationResults = useMemo(() => {
    const criticalStates = ['SUCCESS', 'FAILED', 'ERROR', 'timeout', 'REJECTED'];
    return ussdLogs.filter(log => criticalStates.includes(log.status?.toUpperCase()));
  }, [ussdLogs]);

  const telemetryLogs = useMemo(() => {
    return ussdLogs.slice(0, 100).reverse();
  }, [ussdLogs]);

  const stats = useMemo(() => {
    const total = orchestrationResults.length;
    const success = orchestrationResults.filter(l => l.status?.toUpperCase() === 'SUCCESS').length;
    const failed = orchestrationResults.filter(l => ['FAILED', 'ERROR', 'TIMEOUT'].includes(l.status?.toUpperCase())).length;
    const rate = total > 0 ? ((success / total) * 100).toFixed(1) : '0.0';
    return { total, success, failed, rate };
  }, [orchestrationResults]);

  useEffect(() => {
    if (activeTab === 'reporting') fetchHistory();
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/api/ussd/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUssdLogs(data || []);
      }
    } catch (e) {}
  };

  const executeTest = async () => {
    if (!targetNode) return alert("Select target node");
    setExecuting(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/api/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          device_id: targetNode,
          ussd_code: activeScript.ussd_code,
          steps: activeScript.steps,
          variables: testVars
        })
      });
      if (res.ok) {
        setShowTestModal(false);
        setActiveTab('console'); // JUMP TO CONSOLE ON EXECUTION
      }
    } catch (err) { alert(err.message); } finally { setExecuting(false); }
  };

  const saveScript = async (script) => {
    setSaving(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/api/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(script)
      });
      if (res.ok) {
        const saved = await res.json();
        setScripts(prev => {
          const sid = normalizeId(saved._id || saved.id);
          const exists = prev.find(s => normalizeId(s._id || s.id) === sid);
          return exists ? prev.map(s => normalizeId(s._id || s.id) === sid ? saved : s) : [...prev, saved];
        });
        setActiveScript(saved);
        alert('Protocol deployed');
      }
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  if (activeScript) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-700 pb-20">
        <div className="flex items-center justify-between px-1">
          <button onClick={() => setActiveScript(null)} className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors flex items-center gap-2">
            <ArrowRight size={14} className="rotate-180" /> Back to library
          </button>
          <div className="flex items-center gap-3">
             <button onClick={() => {
                const foundVars = Array.from(new Set([activeScript.ussd_code, ...(activeScript.steps || [])].join(' ').match(/\{\{(.*?)\}\}/g)?.map(m => m.slice(2, -2)) || []));
                const init = {}; foundVars.forEach(v => init[v] = ''); setTestVars(init);
                if (devices.length > 0) setTargetNode(devices[0]);
                setShowTestModal(true);
             }} className="btn-secondary flex items-center gap-2 px-6">
                <Play size={14} className="text-emerald-500" /> Pre-flight
             </button>
             <button onClick={() => saveScript(activeScript)} disabled={saving} className="btn-primary flex items-center gap-2 shadow-lg shadow-slate-200 px-8">
                <Save size={14} /> {saving ? 'Wiring...' : 'Deploy changes'}
             </button>
          </div>
        </div>

        <div className="native-surface !p-0 overflow-hidden relative border-none shadow-2xl rounded-[40px]">
          <div className="bg-slate-900 p-10 flex items-center justify-between text-white">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Protocol architect</label>
                 <input className="bg-transparent border-none text-2xl font-black text-white focus:outline-none p-0 w-full placeholder:text-white/20 tracking-tight" value={activeScript.name} onChange={e => setActiveScript({...activeScript, name: e.target.value})} />
              </div>
              <button onClick={async () => {
                 const id = normalizeId(activeScript?._id || activeScript?.id);
                 if (id && window.confirm('Delete protocol?')) {
                   const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
                   const token = localStorage.getItem('token');
                   const res = await fetch(`${baseUrl}/api/scripts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                   if (res.ok) { setScripts(prev => prev.filter(s => normalizeId(s._id || s.id) !== id)); setActiveScript(null); }
                 }
              }} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 transition-all flex items-center justify-center"><Trash size={20} /></button>
          </div>
          <div className="p-2 sm:p-0">
             <StepBuilder setScript={setActiveScript} script={activeScript} />
          </div>
        </div>

        {showTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-4xl bg-white rounded-[48px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
               <div className="p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Direct Node Trigger</h3>
                  <button onClick={() => setShowTestModal(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"><X size={24} /></button>
               </div>
               <div className="p-10 space-y-12 overflow-y-auto grow">
                  <div className="grid grid-cols-2 gap-12">
                     <div className="space-y-6">
                        <label className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] block">Target Cluster Node</label>
                        <div className="grid grid-cols-1 gap-3">
                           {devices.map(dev => (
                             <button 
                               key={dev} 
                               onClick={() => setTargetNode(dev)} 
                               className={`p-5 rounded-3xl border text-left transition-all flex items-center justify-between ${targetNode === dev ? 'bg-slate-900 border-slate-900 text-white shadow-xl translate-x-2' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}
                             >
                                <div className="flex items-center gap-3">
                                   <Cpu size={18} />
                                   <span className="text-[11px] font-black uppercase tracking-widest">Node {dev.slice(-8).toUpperCase()}</span>
                                </div>
                                {targetNode === dev && <CheckCircle2 size={16} />}
                             </button>
                           ))}
                           {devices.length === 0 && <p className="text-xs text-rose-500 font-bold uppercase tracking-widest italic pt-4">No active nodes connected</p>}
                        </div>
                     </div>
                     <div className="space-y-6">
                        <label className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] block">Variable Injection Map</label>
                        <div className="space-y-4">
                           {Object.keys(testVars).map(v => (
                              <div key={v} className="bg-slate-50 border border-slate-100 rounded-3xl p-5 group focus-within:border-slate-900 transition-all">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-focus-within:text-slate-900">{v}</p>
                                 <input className="bg-transparent border-none text-xs font-black text-slate-900 w-full outline-none p-0" placeholder={`Enter ${v}...`} value={testVars[v]} onChange={e => setTestVars({...testVars, [v]: e.target.value})} />
                              </div>
                           ))}
                           {Object.keys(testVars).length === 0 && <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest pt-8 text-center italic">Static sequence detected (no variables)</p>}
                        </div>
                     </div>
                  </div>
               </div>
               <div className="p-10 bg-slate-50 border-t border-slate-100 shrink-0">
                  <button onClick={executeTest} disabled={executing || !targetNode || devices.length === 0} className="w-full py-6 bg-slate-900 text-white rounded-[32px] text-xs font-black uppercase tracking-[0.3em] hover:bg-slate-800 disabled:opacity-30 disabled:grayscale transition-all shadow-xl shadow-slate-300">{executing ? 'Transmitting payload...' : 'Initialize Sequence'}</button>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 px-1">
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">Protocol architect</h2>
           <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-3">Multi-node orchestration cluster</p>
        </div>
        
        <div className="flex bg-slate-100 p-2 rounded-3xl border border-slate-100">
           {[
             { id: 'library', label: 'Library', icon: Database },
             { id: 'console', label: 'Console', icon: Terminal },
             { id: 'reporting', label: 'Audit', icon: History }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 activeTab === tab.id ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               <tab.icon size={14} /> {tab.label}
             </button>
           ))}
        </div>
      </div>

      {activeTab === 'library' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div 
                onClick={() => setActiveScript({ name: 'Untitled Protocol', ussd_code: '*123#', steps: [''], rules: [] })}
                className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] flex flex-col items-center justify-center py-16 group cursor-pointer hover:border-slate-300 hover:bg-slate-50/50 transition-all shadow-sm"
              >
                 <div className="w-16 h-16 rounded-3xl bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white group-hover:rotate-90 transition-all mb-6">
                    <Plus size={32} />
                 </div>
                 <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Expand Sequence Library</p>
              </div>
              {scripts.map((script) => (
                <div key={normalizeId(script._id || script.id)} onClick={() => setActiveScript(script)} className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:scale-[1.02] hover:border-slate-300 transition-all group cursor-pointer">
                  <div className="flex items-center justify-between mb-10">
                    <div className="w-14 h-14 rounded-[20px] bg-slate-900 text-white flex items-center justify-center shadow-lg"><Code2 size={24} /></div>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full text-[9px] font-black text-slate-400 uppercase group-hover:bg-slate-900 group-hover:text-white transition-all">
                       <Layers size={10} /> {script.steps?.length || 0} Steps
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-1 tracking-tight">{script.name}</h3>
                  <div className="flex items-center gap-2">
                     <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Dialer:</span>
                     <span className="text-[11px] font-black text-slate-900 lowercase font-mono">{script.ussd_code}</span>
                  </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'console' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                 <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Activity size={14} className="text-emerald-500" /> Live Telemetry
                 </h3>
              </div>
              <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                 <div className="w-1 h-1 rounded-full bg-rose-500" /> Recording
              </span>
           </div>
           <GatewayConsole logs={telemetryLogs} />
        </div>
      )}

      {activeTab === 'reporting' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Success Rate</p>
                 <div className="flex items-center justify-between">
                    <h4 className="text-2xl font-black text-emerald-600 tracking-tighter">{stats.rate}%</h4>
                    <TrendingUp size={20} className="text-emerald-500" />
                 </div>
              </div>
              <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Throughput</p>
                 <div className="flex items-center justify-between">
                    <h4 className="text-2xl font-black text-slate-900 tracking-tighter">{stats.total}</h4>
                    <Database size={20} className="text-slate-300" />
                 </div>
              </div>
              <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Faults</p>
                 <div className="flex items-center justify-between">
                    <h4 className="text-2xl font-black text-rose-600 tracking-tighter">{stats.failed}</h4>
                    <AlertTriangle size={20} className="text-rose-500" />
                 </div>
              </div>
              <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Active Nodes</p>
                 <div className="flex items-center justify-between">
                    <h4 className="text-2xl font-black text-slate-900 tracking-tighter">{devices.length}</h4>
                    <Cpu size={20} className="text-slate-300" />
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[48px] overflow-hidden border border-slate-100 shadow-2xl">
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                       <th className="p-6 px-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">Log Moment</th>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gateway Node</th>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Payload</th>
                       <th className="p-6 px-10 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Disposition</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {orchestrationResults.length === 0 ? (
                       <tr><td colSpan="4" className="p-32 text-center text-[11px] font-black text-slate-300 uppercase letter-spacing-2 italic">Zero orchestration history found</td></tr>
                    ) : (
                       orchestrationResults.map((log) => (
                          <tr key={normalizeId(log._id || log.execution_id)} className="group hover:bg-slate-50/50 transition-all">
                             <td className="p-6 px-10 tabular-nums">
                                <div className="flex flex-col">
                                   <span className="text-[12px] font-black text-slate-900">{new Date(log.timestamp || Date.now()).toLocaleTimeString()}</span>
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(log.timestamp || Date.now()).toLocaleDateString()}</span>
                                </div>
                             </td>
                             <td className="p-6">
                                <span className="bg-slate-900 text-white text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">#{normalizeId(log.device_id)?.slice(-6)}</span>
                             </td>
                             <td className="p-6 text-[12px] text-slate-500 font-medium max-w-sm truncate">{log.response}</td>
                             <td className="p-6 px-10 text-right">
                                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${log.status?.toUpperCase() === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                   {log.status?.toUpperCase() === 'SUCCESS' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                   {log.status}
                                </div>
                             </td>
                          </tr>
                       ))
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default Scripts;
