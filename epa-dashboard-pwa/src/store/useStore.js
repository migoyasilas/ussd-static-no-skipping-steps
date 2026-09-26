import { create } from 'zustand'

const useStore = create((set) => ({
  devices: [],
  logs: [],
  payments: [],
  methods: [],
  scripts: [],
  ussdLogs: [],
  credentials: null,
  isConnected: false,
  isSyncing: false,
  
  // Normalized ID Helper (Global)
  normalizeId: (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    if (obj.$oid) return obj.$oid;
    if (obj._id) return useStore.getState().normalizeId(obj._id);
    return obj.toString();
  },

  setDevices: (fn) => set((state) => ({ 
    devices: typeof fn === 'function' ? fn(state.devices) : fn 
  })),
  addLog: (log) => set((state) => ({ logs: [log, ...state.logs].slice(0, 100) })),
  setPayments: (fn) => set((state) => ({ 
    payments: typeof fn === 'function' ? fn(state.payments) : fn 
  })),
  setMethods: (fn) => set((state) => ({ 
    methods: typeof fn === 'function' ? fn(state.methods) : fn 
  })),
  setScripts: (fn) => set((state) => ({ 
    scripts: typeof fn === 'function' ? fn(state.scripts) : fn 
  })),
  setUssdLogs: (fn) => set((state) => ({ 
    ussdLogs: typeof fn === 'function' ? fn(state.ussdLogs) : fn 
  })),
  setCredentials: (credentials) => set({ credentials }),
  setConnected: (isConnected) => set({ isConnected }),
  setSyncing: (isSyncing) => set({ isSyncing })
}))

export default useStore
