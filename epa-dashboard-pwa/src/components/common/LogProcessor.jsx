import React from 'react';
import { 
  Signal, 
  Smartphone, 
  ArrowRightLeft, 
  ShieldAlert, 
  History, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

const LogProcessor = ({ log }) => {
  const getLogConfig = () => {
    const type = log.type || 'RAW_SYSTEM';
    
    switch (type) {
      case 'DEVICE_ONLINE':
        return {
          icon: Smartphone,
          label: 'Node Online',
          desc: `Device ${log.device_id?.slice(-8) || 'Unknown'} synchronized`,
          color: 'text-emerald-500',
          bg: 'bg-emerald-50'
        };
      case 'DEVICE_OFFLINE':
        return {
          icon: Smartphone,
          label: 'Node Offline',
          desc: `Device ${log.device_id?.slice(-8)} disconnected`,
          color: 'text-rose-500',
          bg: 'bg-rose-50'
        };
      case 'USSD_REQUEST':
        return {
          icon: Zap,
          label: 'Outbound Request',
          desc: log.code || 'Initiating connection...',
          color: 'text-blue-500',
          bg: 'bg-blue-50'
        };
      case 'USSD_RESPONSE':
        // Clean carrier menu text
        const cleanBody = log.body?.replace(/[\r\n]+/g, ' ').slice(0, 60) || 'Response received';
        return {
          icon: Signal,
          label: 'Carrier Response',
          desc: cleanBody,
          color: 'text-amber-500',
          bg: 'bg-amber-50'
        };
      case 'WEBHOOK_SENT':
        return {
          icon: ArrowRightLeft,
          label: 'Relay Broadcast',
          desc: `Sent to ${log.url?.slice(0, 30)}...`,
          color: 'text-indigo-500',
          bg: 'bg-indigo-50'
        };
      case 'ERROR':
        return {
          icon: AlertCircle,
          label: 'System Exception',
          desc: log.message || 'Unknown failure',
          color: 'text-red-600',
          bg: 'bg-red-50'
        };
      default:
        // Try to guess from data
        if (log.trx_id) return {
          icon: History,
          label: 'Transaction Update',
          desc: `TRX: ${log.trx_id}`,
          color: 'text-slate-500',
          bg: 'bg-slate-50'
        };
        
        return {
          icon: Activity,
          label: type.replace('_', ' '),
          desc: typeof log.data === 'string' ? log.data : JSON.stringify(log.data || log).slice(0, 50),
          color: 'text-slate-400',
          bg: 'bg-slate-50'
        };
    }
  };

  const config = getLogConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-4 p-4 group transition-all">
      <div className={`w-9 h-9 rounded-xl ${config.bg} ${config.color} flex items-center justify-center shrink-0 border border-current opacity-20 group-hover:opacity-40 transition-opacity`}>
        <Icon size={16} strokeWidth={2.5} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
            {config.label}
          </span>
          <span className="text-[9px] font-medium text-slate-400">
            {new Date(log.timestamp || Date.now()).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <p className="text-[11px] font-medium text-slate-600 truncate leading-relaxed lowercase first-letter:uppercase">
          {config.desc}
        </p>
      </div>
    </div>
  );
};

export default LogProcessor;
// Re-importing missing icons
import { Zap, Activity } from 'lucide-react';
