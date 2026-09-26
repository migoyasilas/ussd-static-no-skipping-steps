import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutGrid, 
  ArrowRightLeft, 
  Smartphone, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Terminal, 
  Key,
  Database
} from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutGrid, group: 'Operations' },
    { id: 'transactions', label: 'Ledger', icon: ArrowRightLeft, group: 'Operations' },
    { id: 'fleet', label: 'Fleet Nodes', icon: Smartphone, group: 'Operations' },
    
    { id: 'scripts', label: 'Protocols', icon: Cpu, group: 'Engineering' },
    { id: 'registry', label: 'Extraction', icon: Database, group: 'Engineering' },
    { id: 'developer', label: 'API & Keys', icon: Key, group: 'Engineering' },
    { id: 'debug', label: 'Live Console', icon: Terminal, group: 'Engineering' },
  ];

  const groups = ['Operations', 'Engineering'];

  return (
    <aside className="hidden lg:flex w-64 h-screen bg-white border-r border-slate-100 flex-col sticky top-0 shrink-0">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-10">
           <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
             <ShieldCheck size={18} strokeWidth={2.5} />
           </div>
           <div>
             <h1 className="text-sm font-bold tracking-tight text-slate-900 uppercase leading-none">Eksses gate</h1>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Enterprise</p>
           </div>
        </div>

        <nav className="space-y-8">
          {groups.map(group => (
            <div key={group} className="space-y-3">
              <h3 className="label-micro px-3 lowercase first-letter:uppercase">{group}</h3>
              <div className="space-y-1">
                {menuItems.filter(item => item.group === group).map((item) => (
                  <NavLink
                    key={item.id}
                    to={`/${item.id}`}
                    className={({ isActive }) => `sidebar-link w-full ${isActive ? 'active' : ''}`}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-8 border-t border-slate-100 bg-slate-50/30">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <Zap size={12} className="text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-900 truncate">Admin Shell</p>
              <p className="text-[9px] font-medium text-slate-400">Live session</p>
            </div>
         </div>
      </div>
    </aside>
  );
};

export default Sidebar;
