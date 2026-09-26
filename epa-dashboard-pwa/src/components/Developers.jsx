import React, { useState } from 'react';
import { 
  Key, 
  Copy, 
  Check, 
  ShieldCheck, 
  Zap, 
  Terminal, 
  Code2, 
  Lock,
  ExternalLink,
  BookOpen,
  Globe,
  Database,
  ArrowRight
} from 'lucide-react';
import useStore from '../store/useStore';

const Developers = () => {
  const [copiedKey, setCopiedKey] = useState(null);
  const { credentials, isSyncing } = useStore();
  
  const gatewayUrl = window.location.origin;
  
  const displayCreds = credentials || {
    apiKey: 'epk_live_*************************',
    webhookSecret: null,
    endpoint: `${gatewayUrl}/api`
  };

  const copyToClipboard = (text, type) => {
    if (!text || text.includes('*')) {
        alert('Credential mask active: Secret not available in this session.');
        return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex items-center justify-between px-1">
        <div>
           <h2 className="text-2xl font-black text-slate-900 tracking-tight">API & keys</h2>
           <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage security credentials and platform integration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-12 space-y-8">
           <div className="native-surface border-slate-200 shadow-xl">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                       <Key size={20} />
                    </div>
                    <div>
                       <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Live credentials</h3>
                       <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Production environment</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    <ShieldCheck size={14} />
                    {isSyncing ? 'Syncing...' : 'Encrypted session'}
                 </div>
              </div>

              <div className="space-y-8">
                 {[
                   { label: 'Platform API Key', val: displayCreds.apiKey, type: 'api', desc: 'Used for all authenticated API requests.' },
                   { label: 'Webhook Signing Secret', val: displayCreds.webhookSecret || '—', type: 'secret', desc: 'Used to verify webhook authenticity.' },
                   { label: 'Global Gateway URL', val: displayCreds.endpoint, type: 'endpoint', desc: 'The base URL for all gateway endpoints.' }
                 ].map((item, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex items-center justify-between">
                         <label className="label-micro lowercase first-letter:uppercase text-slate-900 font-black">{item.label}</label>
                         <span className="text-[10px] text-slate-400 font-medium italic">{item.desc}</span>
                      </div>
                      <div className="flex gap-3">
                         <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-mono text-xs font-bold text-slate-600 truncate flex items-center">
                            {copiedKey === item.type ? '******** (Copied to clipboard)' : item.val}
                         </div>
                         <button 
                           onClick={() => copyToClipboard(item.val, item.type)}
                           className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm active:scale-95"
                           disabled={!item.val || item.val === '—'}
                         >
                           {copiedKey === item.type ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                         </button>
                      </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* Integration Guide Section */}
           <div className="native-surface border-slate-200">
             <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                   <BookOpen size={20} />
                </div>
                <div>
                   <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Integration documentation</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Automate USSD orchestration on your platform</p>
                </div>
             </div>

             <div className="space-y-12">
                <section className="space-y-4">
                   <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Zap size={14} className="text-amber-500" /> 1. Trigger USSD Sequence
                   </h4>
                   <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-medium">
                      Dispatch sequential USSD commands to a specific Android node. Injects dynamic variables into your defined protocols.
                   </p>
                   <div className="bg-slate-900 rounded-2xl p-6 relative group overflow-hidden shadow-2xl">
                      <div className="absolute top-4 right-4 text-[9px] font-bold text-slate-600 uppercase">endpoint: POST /api/trigger</div>
                      <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto">
{`curl -X POST ${gatewayUrl}/api/trigger \\
-H "Authorization: Bearer ${displayCreds.apiKey}" \\
-H "Content-Type: application/json" \\
-d '{
  "device_id": "YOUR_DEVICE_ID",
  "ussd_code": "*247#",
  "steps": ["1", "01700000000", "500", "1234"],
  "variables": { "RECIPIENT": "017...", "AMOUNT": "500" }
}'`}
                      </pre>
                   </div>
                </section>

                <section className="space-y-4">
                   <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-500" /> 2. Verify USSD/SMS Payments
                   </h4>
                   <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-medium">
                      Compare a customer's claimed transaction ID against the gateway's real extraction logs.
                   </p>
                   <div className="bg-slate-900 rounded-2xl p-6 relative group overflow-hidden shadow-2xl">
                      <div className="absolute top-4 right-4 text-[9px] font-bold text-slate-600 uppercase">endpoint: POST /api/verify</div>
                      <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto">
{`// Implementation Example (Node.js)
const res = await fetch("${gatewayUrl}/api/verify", {
  method: "POST",
  headers: { "Authorization": "Bearer ${displayCreds.apiKey}" },
  body: JSON.stringify({
    trx_id: "8KADJX9B",
    amount: "500.00"
  })
});

const { status, payment } = await res.json();
if (status === "SUCCESS") {
  console.log("Verified sender:", payment.sender);
}`}
                      </pre>
                   </div>
                </section>

                <section className="space-y-4">
                   <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <ExternalLink size={14} className="text-blue-500" /> 3. Handle Webhook Events
                   </h4>
                   <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-medium text-slate-500 italic">
                      Configure your callback URL in the Extraction Workshop. The gateway will POST events to you instantly.
                   </p>
                   <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Sample Webhook POST Body</p>
                      <pre className="text-[11px] font-mono text-slate-600">
{`{
  "internal_id": "pay_981273x",
  "status": "SUCCESS",
  "method": "bkash",
  "amount": "1200.00",
  "trx_id": "9BJS92LK",
  "sender": "017xxxxxxxx",
  "timestamp": 1712839210000
}`}
                      </pre>
                   </div>
                </section>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Developers;
