import { create } from 'zustand';

interface AppStore {
  activeProjectId: number | null;
  setActiveProjectId: (id: number | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useStore = create<AppStore>(set => ({
  activeProjectId: null,
  setActiveProjectId: id => set({ activeProjectId: id }),
  sidebarOpen: true,
  setSidebarOpen: open => set({ sidebarOpen: open }),
}));
