import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Download
} from 'lucide-react';
import useStore from '../store/useStore';

const Transactions = () => {
  const { payments: transactions, isSyncing, normalizeId } = useStore();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const loading = isSyncing && !transactions.length;

  const filtered = transactions.filter(t => {
    const matchesSearch = t.trx_id?.toLowerCase().includes(search.toLowerCase()) || 
                         t.sender?.includes(search) || 
                         t.amount?.toString().includes(search);
    
    if (filter === 'ALL') return matchesSearch;
    return matchesSearch && t.status?.toUpperCase() === filter;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-1">
        <div>
           <h2 className="text-xl font-bold text-slate-900 tracking-tight">Transaction ledger</h2>
           <p className="text-xs font-medium text-slate-400">Consolidated history of USSD settlements</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button className="btn-secondary flex items-center gap-2">
              <Download size={14} />
              Export CSV
           </button>
        </div>
      </div>

      <div className="native-surface !p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
           <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input 
                type="text"
                placeholder="Search reference, sender or amount..."
                className="w-full bg-white border border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:border-slate-300 transition-all outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
           </div>
           
           <div className="flex items-center gap-1 bg-white border border-slate-100 p-1 rounded-xl">
              {['ALL', 'SUCCESS', 'PENDING', 'FAILED'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    filter === f ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f}
                </button>
              ))}
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="p-4 px-6 label-micro uppercase tracking-widest text-slate-400">Timestamp</th>
                <th className="p-4 label-micro uppercase tracking-widest text-slate-400">Reference</th>
                <th className="p-4 label-micro uppercase tracking-widest text-slate-400">Node</th>
                <th className="p-4 label-micro uppercase tracking-widest text-slate-400">Origin</th>
                <th className="p-4 label-micro uppercase tracking-widest text-slate-400">Amount</th>
                <th className="p-4 px-6 label-micro uppercase tracking-widest text-slate-400 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-20 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                     Synchronizing Ledger...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-20 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                     No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map((t, i) => {
                  const dateObj = new Date(t.timestamp ? t.timestamp * 1000 : Date.now());
                  return (
                    <tr key={normalizeId(t._id || t.id) || i} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4 px-6">
                         <p className="text-[11px] font-medium text-slate-900">{dateObj.toLocaleDateString()}</p>
                         <p className="text-[9px] font-bold text-slate-400 lowercase">{dateObj.toLocaleTimeString()}</p>
                      </td>
                    <td className="p-4">
                       <span className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-tight">#{t.trx_id?.slice(-10) || 'UNTITLED'}</span>
                    </td>
                    <td className="p-4">
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-bold text-slate-900 uppercase">Node {t.device_id?.slice(-4)}</span>
                       </div>
                    </td>
                    <td className="p-4 text-[11px] font-medium text-slate-600">{t.sender || 'Unknown'}</td>
                    <td className="p-4">
                       <span className="text-xs font-bold text-slate-900">৳{(parseFloat(t.amount) || 0).toLocaleString()}</span>
                    </td>
                    <td className="p-4 px-6 text-right">
                       <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                         t.status?.toUpperCase() === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 
                         t.status?.toUpperCase() === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                       }`}>
                          {t.status?.toUpperCase() === 'SUCCESS' && <CheckCircle2 size={10} />}
                          {t.status?.toUpperCase() === 'PENDING' && <Clock size={10} />}
                          {t.status?.toUpperCase() === 'FAILED' && <XCircle size={10} />}
                          {t.status}
                       </div>
                    </td>
                  </tr>
                    );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
