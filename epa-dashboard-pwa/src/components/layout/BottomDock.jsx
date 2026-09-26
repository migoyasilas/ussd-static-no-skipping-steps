import React from 'react';
import { NavLink } from 'react-router-dom';
import { Layout, Smartphone, ArrowRightLeft, Shield, Zap, Terminal } from 'lucide-react';

const BottomDock = () => {
  const tabs = [
    { id: 'dashboard', icon: Layout },
    { id: 'fleet', icon: Smartphone },
    { id: 'transactions', icon: ArrowRightLeft },
    { id: 'registry', icon: Shield },
    { id: 'scripts', icon: Zap },
    { id: 'debug', icon: Terminal },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden z-50">
      <div className="mx-6 mb-6 safe-bottom">
        <div className="bg-white/95 backdrop-blur-md border border-slate-100 rounded-2xl h-14 flex items-center justify-around px-2 shadow-lg shadow-slate-200/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            
            return (
              <NavLink
                key={tab.id}
                to={`/${tab.id}`}
                className={({ isActive }) => `flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all ${
                  isActive ? 'text-slate-900 bg-slate-50' : 'text-slate-400'
                }`}
              >
                {({ isActive }) => (
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomDock;
