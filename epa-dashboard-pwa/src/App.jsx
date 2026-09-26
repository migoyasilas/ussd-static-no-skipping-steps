import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import useStore from './store/useStore';
import Sidebar from './components/layout/Sidebar';
import BottomDock from './components/layout/BottomDock';
import Dashboard from './components/Dashboard';
import Fleet from './components/Fleet';
import Transactions from './components/Transactions';
import Scripts from './components/Scripts';
import Registry from './components/Registry';
import Developers from './components/Developers';
import Debug from './components/Debug';

const App = () => {
  const [isLogin, setIsLogin] = useState(!!localStorage.getItem('token'));
  const [auth, setAuth] = useState({ user: '', pass: '' });
  const [loading, setLoading] = useState(false);
  const setConnected = useStore(s => s.setConnected);
  const addLog = useStore(s => s.addLog);
  const setDevices = useStore(s => s.setDevices);
  const setPayments = useStore(s => s.setPayments);
  const setScripts = useStore(s => s.setScripts);
  const setCredentials = useStore(s => s.setCredentials);
  const setSyncing = useStore(s => s.setSyncing);
  const isConnected = useStore(s => s.isConnected);

  const globalSync = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setSyncing(true);
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [pRes, dRes, sRes, cRes, hRes, mRes] = await Promise.all([
        fetch(`${baseUrl}/api/payments`, { headers }),
        fetch(`${baseUrl}/api/devices`, { headers }),
        fetch(`${baseUrl}/api/scripts`, { headers }),
        fetch(`${baseUrl}/api/credentials`, { headers }).catch(() => null),
        fetch(`${baseUrl}/api/ussd/history`, { headers }).catch(() => null),
        fetch(`${baseUrl}/api/methods`, { headers }).catch(() => null)
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        const { setMethods } = useStore.getState();
        setMethods(mData || []);
      }
      if (hRes && hRes.ok) {
        const hData = await hRes.json();
        useStore.getState().setUssdLogs(hData || []);
      }

      if (pRes.ok) {
        const pData = await pRes.json();
        setPayments([...pData].reverse());
      }
      if (dRes.ok) {
        const dData = await dRes.json();
        // Rust backend returns { "devices": [...] }
        setDevices(Array.isArray(dData.devices) ? dData.devices : []);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setScripts(Array.isArray(sData) ? sData : []);
      }
      if (cRes && cRes.ok) {
        const cData = await cRes.json();
        setCredentials(cData);
      }
    } catch (err) {
      console.error("Master Sync Failure", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: auth.user, password: auth.pass })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setIsLogin(true);
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLogin) globalSync();
  }, [isLogin]);

  useEffect(() => {
    let wsUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3000';
    // Dynamic protocol negotiation (Upgrade to WSS if on HTTPS)
    if (window.location.protocol === 'https:') {
      wsUrl = wsUrl.replace('ws://', 'wss://');
    }
    const ws = new WebSocket(`${wsUrl}/ui`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'DEVICE_ONLINE') {
          setDevices(prev => (prev.includes(data.device_id) ? prev : [...prev, data.device_id]));
        } else if (data.type === 'DEVICE_OFFLINE') {
          setDevices(prev => prev.filter(id => id !== data.device_id));
        } else if (data.type === 'PAYMENT_DETECTED') {
          setPayments(prev => [data.data, ...prev]);
        } else if (data.type === 'USSD_RESPONSE' || data.type === 'HEARTBEAT' || data.status) {
          const { setUssdLogs } = useStore.getState();
          const logPayload = data.type === 'USSD_RESPONSE' ? data.data : data;
          setUssdLogs(prev => [logPayload, ...prev]);
        }
        addLog(data);
      } catch (err) {
        console.error('Link error:', err);
      }
    };
    return () => ws.close();
  }, [isLogin, setConnected, setDevices, addLog]);

  if (!isLogin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px] animate-in fade-in zoom-in-95 duration-700">
           <div className="text-center mb-10">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center text-white mb-5 shadow-xl shadow-slate-200">
                <ShieldCheck size={28} strokeWidth={2} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Eksses gate</h1>
              <p className="label-micro mt-2">Enterprise protocol access</p>
           </div>

           <div className="native-surface">
             <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="label-micro lowercase first-letter:uppercase">Account identity</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:border-slate-900 focus:bg-white outline-none transition-all uppercase placeholder:opacity-30"
                    placeholder="ADMIN"
                    value={auth.user}
                    onChange={e => setAuth({...auth, user: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-micro lowercase first-letter:uppercase">Gateway password</label>
                  <input 
                    type="password"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:border-slate-900 focus:bg-white outline-none transition-all placeholder:opacity-30"
                    placeholder="••••••••"
                    value={auth.pass}
                    onChange={e => setAuth({...auth, pass: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary mt-4"
                >
                  {loading ? 'Initializing session...' : 'Authorize login'}
                </button>
             </form>
           </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        
        <main className="flex-1 flex flex-col pb-24 lg:pb-0 overflow-hidden">
          <header className="h-16 lg:h-20 bg-white border-b border-slate-100 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-40 w-full shrink-0">
             <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">Gateway terminal</h2>
                <div className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="label-micro opacity-40 lowercase first-letter:uppercase">Network command</span>
             </div>

             <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500'}`} />
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">
                    {isConnected ? 'Pulse Nominal' : 'Link offline'}
                  </span>
                </div>
             </div>
          </header>

          <section className="p-6 lg:p-10 max-w-7xl mx-auto w-full flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/scripts" element={<Scripts />} />
              <Route path="/registry" element={<Registry />} />
              <Route path="/developer" element={<Developers />} />
              <Route path="/debug" element={<Debug />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </section>

          <BottomDock />
        </main>
      </div>
    </Router>
  );
};

export default App;
