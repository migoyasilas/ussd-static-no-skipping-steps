import React from 'react';
import { Plus, Trash, Zap } from 'lucide-react';

const StepBuilder = ({ script, setScript }) => {
  const addStep = () => {
    setScript({
      ...script,
      steps: [...(script.steps || []), '']
    });
  };

  const removeStep = (index) => {
    const newSteps = [...script.steps];
    newSteps.splice(index, 1);
    setScript({ ...script, steps: newSteps });
  };

  const updateStep = (index, value) => {
    const newSteps = [...script.steps];
    newSteps[index] = value;
    setScript({ ...script, steps: newSteps });
  };

  const insertVariable = (index, varName) => {
    updateStep(index, `{{${varName}}}`);
  };

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest px-1">Initial Trigger</label>
        <div className="relative group">
          <input 
            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 font-mono text-xl font-bold text-slate-900 focus:border-slate-300 focus:bg-white focus:outline-none transition-all placeholder:text-slate-200"
            placeholder="*247#" 
            value={script.ussd_code || ''}
            onChange={e => setScript({...script, ussd_code: e.target.value})}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-bold uppercase text-slate-900 tracking-widest">Execution Path</label>
          <span className="text-[10px] font-bold uppercase text-slate-300">{script.steps?.length || 0} Stages</span>
        </div>

        <div className="space-y-3">
          {script.steps?.map((step, i) => (
            <div key={i} className="flex gap-4 group">
              <div className="pt-2">
                 <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-400">
                    {i+1}
                 </div>
              </div>
              
              <div className="flex-1 bg-white border border-slate-100 rounded-xl p-4 space-y-3 hover:border-slate-300 transition-all shadow-sm">
                <textarea 
                  className="w-full bg-transparent border-none text-slate-900 font-mono font-bold text-xs focus:outline-none resize-none placeholder:text-slate-200 leading-tight"
                  placeholder="Selection or {{variable}}..."
                  value={step}
                  rows={2}
                  onChange={e => updateStep(i, e.target.value)}
                />
                
                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => insertVariable(i, 'PAYER')}
                      className="px-2 py-1 rounded bg-slate-50 text-[9px] font-bold text-slate-500 hover:bg-slate-900 hover:text-white transition-all uppercase"
                    >
                      + PAYER
                    </button>
                    <button 
                      onClick={() => insertVariable(i, 'AMOUNT')}
                      className="px-2 py-1 rounded bg-slate-50 text-[9px] font-bold text-slate-500 hover:bg-slate-900 hover:text-white transition-all uppercase"
                    >
                      + AMOUNT
                    </button>
                  </div>
                  
                  <button 
                     onClick={() => removeStep(i)}
                     className="p-1 text-slate-200 hover:text-red-500 transition-colors"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button 
            onClick={addStep}
            className="w-full py-4 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center gap-2 text-slate-300 hover:border-slate-200 hover:text-slate-500 transition-all"
          >
            <Plus size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Append Directive</span>
          </button>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-slate-900 text-white flex gap-4">
        <Zap size={16} className="text-slate-400 shrink-0" />
        <div className="space-y-1">
           <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syntax Protocol</h5>
           <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
              Incorporate <span className="text-emerald-400 font-bold">{"{{variable}}"}</span> to trigger logic hooks. Sequence terminates on empty selection.
           </p>
        </div>
      </div>
    </div>
  );
};

export default StepBuilder;
