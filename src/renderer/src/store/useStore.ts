import { create } from 'zustand';
import type { ParsedSession, LapSelections, LapColor } from '../types/session';
import { COLOR_ORDER } from '../lib/constants';

export type Tab = 'telemetry' | 'setup' | 'damper' | 'rideheight' | 'tiretemp' | 'shocks' | 'shockvel';
export type Theme = 'dark' | 'light';

interface State {
  sessions: ParsedSession[];
  selections: LapSelections;
  activeTab: Tab;
  theme: Theme;

  // Actions
  addSessions: (incoming: ParsedSession[]) => void;
  removeSession: (index: number) => void;
  setActiveTab: (tab: Tab) => void;
  toggleLapColor: (sessionIdx: number, lapIdx: number, color: LapColor) => void;
  clearSelections: () => void;
  setTheme: (theme: Theme) => void;
}

export const useStore = create<State>((set) => ({
  sessions: [],
  selections: {},
  activeTab: 'telemetry',
  theme: (localStorage.getItem('theme') as Theme) ?? 'dark',

  addSessions: (incoming) =>
    set((s) => ({ sessions: [...s.sessions, ...incoming], selections: {} })),

  removeSession: (index) =>
    set((s) => {
      const sessions = s.sessions.filter((_, i) => i !== index);
      // Re-key selections: drop removed session's laps, shift indices above it down by 1
      const sel: LapSelections = {};
      for (const [key, color] of Object.entries(s.selections)) {
        const colon = key.indexOf(':');
        const sIdx = parseInt(key.substring(0, colon));
        const lPart = key.substring(colon); // ":lapIdx"
        if (sIdx === index) continue;
        const newSIdx = sIdx > index ? sIdx - 1 : sIdx;
        sel[`${newSIdx}${lPart}`] = color;
      }
      return { sessions, selections: sel };
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleLapColor: (sessionIdx, lapIdx, color) =>
    set((s) => {
      const key = `${sessionIdx}:${lapIdx}`;
      const sel = { ...s.selections };
      if (sel[key] === color) {
        // Deselect
        delete sel[key];
      } else {
        // Evict any other lap that held this colour slot
        for (const k of Object.keys(sel)) {
          if (sel[k] === color) delete sel[k];
        }
        // Respect the max 4-slot limit (one per colour)
        const usedSlots = Object.values(sel);
        if (usedSlots.length >= COLOR_ORDER.length && !usedSlots.includes(color)) {
          return s; // already at capacity
        }
        sel[key] = color;
      }
      return { selections: sel };
    }),

  clearSelections: () => set({ selections: {} }),

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
}));
