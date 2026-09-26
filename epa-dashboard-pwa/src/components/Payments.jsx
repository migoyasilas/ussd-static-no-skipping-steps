import React, { useEffect } from 'react';
import { ShieldCheck, Receipt, ArrowRight, Clock, User, Hash } from 'lucide-react';
import useStore from '../store/useStore';

const Payments = () => {
  const { payments, setPayments } = useStore();

  const fetchPayments = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const res = await fetch(`${baseUrl}/api/payments`);
      const data = await res.json();
      setPayments(data || []);
    } catch (err) {
      console.error("Payments Fetch Error", err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 pb-10 space-y-4">
      
      {/* High-Density Segment Header */}
      <div className="native-surface border-none !p-0">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center text-[var(--action-blue)] border border-blue-100 shadow-sm">
                <Receipt size={16} strokeWidth={3} />
              </div>
              <div>
                <h4 className="label-micro !text-[var(--core-navy)]">Settlement Ledger</h4>
                <p className="text-[8px] font-black text-[var(--slate-400)] uppercase tracking-widest">{payments.length} Verified Events</p>
              </div>
           </div>
           <button onClick={fetchPayments} className="btn-secondary !py-1.5 !px-3 font-black">
             SYNC
           </button>
        </div>
      </div>

      {/* Framed Integrated Payment Surface */}
      <div className="native-surface !p-0">
        {payments.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white opacity-20">
             <Receipt size={24} strokeWidth={1} />
             <p className="label-micro mt-2">Awaiting Protocols...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {payments.map((p, i) => {
              const isSuccess = p.status === 'SUCCESS';
              const isExpired = !isSuccess && (Date.now() / 1000 - p.timestamp > 172800);
              
              return (
                <div key={i} className="list-item-native !py-3.5 !px-5 flex items-center group">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSuccess ? 'bg-slate-50 text-slate-200' : 'bg-blue-50 text-[var(--action-blue)]'
                    }`}>
                      <Receipt size={14} />
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-2">
                       <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black text-[var(--core-navy)] tracking-tight uppercase leading-none">{p.method || 'GATEWAY'}</span>
                          <span className={`text-[7px] font-black uppercase tracking-widest ${
                            isSuccess ? 'text-slate-200' : isExpired ? 'text-[var(--error)]' : 'text-[var(--success)]'
                          }`}>
                            {isSuccess ? 'CLAIMED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                          </span>
                       </div>
                       
                       <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black text-[var(--action-blue)] opacity-40 font-mono truncate">{p.trx_id || 'XN-8822'}</span>
                       </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                     <p className={`text-[12px] font-black tracking-tighter text-finance leading-none ${isSuccess ? 'text-slate-100' : 'text-[var(--core-navy)]'}`}>
                       {p.amount || '0.00'}
                     </p>
                     <span className="text-[7px] font-bold text-slate-200 uppercase block mt-1">
                        {new Date(p.timestamp * 1000).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                     </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integrated Security Banner - Framed */}
      <div className="native-surface bg-[var(--core-navy)] !p-6 text-white relative overflow-hidden border-none">
         <div className="absolute top-0 right-0 p-8 opacity-[0.05] pointer-events-none">
            <ShieldCheck size={80} />
         </div>
         <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
               <h4 className="label-micro !text-white opacity-80 mb-1">Security Nexus</h4>
               <p className="text-[10px] text-blue-300/40 uppercase font-black tracking-widest">Manual Override Active</p>
            </div>
            <button className="bg-white text-[var(--core-navy)] px-6 py-3 rounded-xl label-micro active:scale-95 transition-all shadow-xl shadow-black/10">
               INITIALIZE OVERRIDE
            </button>
         </div>
      </div>
    </div>
  );
};

export default Payments;
