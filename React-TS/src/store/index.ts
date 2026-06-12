import { create } from 'zustand';
import type {
  NetworkData,
  NetworkNode,
  NetworkLink,
  TransientEvent,
  SimulationSettings,
  SimulationResults,
  SimulationStatus,
} from '@/types';
import type { Projection } from '@/lib/projection';

// --- Network Store ---
interface NetworkState {
  network: NetworkData | null;
  rawInpContent: string | null;
  fileName: string | null;
  projection: Projection | null;
  setNetwork: (network: NetworkData, rawContent: string, fileName: string, projection: Projection) => void;
  clearNetwork: () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  network: null,
  rawInpContent: null,
  fileName: null,
  projection: null,
  setNetwork: (network, rawContent, fileName, projection) =>
    set({ network, rawInpContent: rawContent, fileName, projection }),
  clearNetwork: () => set({ network: null, rawInpContent: null, fileName: null, projection: null }),
}));

// --- Simulation Store ---
interface SimulationState {
  events: TransientEvent[];
  settings: SimulationSettings;
  status: SimulationStatus;
  progress: number;
  progressStage: string;
  results: SimulationResults | null;
  error: string | null;
  addEvent: (event: TransientEvent) => void;
  removeEvent: (id: string) => void;
  updateEvent: (id: string, event: Partial<TransientEvent>) => void;
  updateSettings: (settings: Partial<SimulationSettings>) => void;
  setStatus: (status: SimulationStatus) => void;
  setProgress: (progress: number, stage?: string) => void;
  setResults: (results: SimulationResults) => void;
  setError: (error: string) => void;
  reset: () => void;
}

const defaultSettings: SimulationSettings = {
  wavespeed: 1200,
  simulationPeriod: 20,
  dt: null,
  frictionModel: 'steady',
};

export const useSimulationStore = create<SimulationState>((set) => ({
  events: [],
  settings: defaultSettings,
  status: 'idle',
  progress: 0,
  progressStage: '',
  results: null,
  error: null,
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
  updateEvent: (id, updates) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? ({ ...e, ...updates } as TransientEvent) : e)),
    })),
  updateSettings: (updates) =>
    set((s) => ({ settings: { ...s.settings, ...updates } })),
  setStatus: (status) =>
    set((s) => ({
      status,
      ...(status === 'running' ? { error: null } : {}),
      ...(status === 'idle' ? { progress: 0, progressStage: '' } : {}),
    })),
  setProgress: (progress, stage) => set((s) => ({ progress, progressStage: stage ?? s.progressStage })),
  setResults: (results) => set({ results, status: 'success' }),
  setError: (error) => set({ error, status: 'error' }),
  reset: () => set({ events: [], settings: defaultSettings, status: 'idle', progress: 0, progressStage: '', results: null, error: null }),
}));

// --- Animation Store ---
export type AnimationMetric = 'headChange' | 'velocity';

interface AnimationState {
  animationActive: boolean;
  playing: boolean;
  currentIndex: number;
  speed: number;
  animationMetric: AnimationMetric;
  startAnimation: () => void;
  stopAnimation: () => void;
  togglePlay: () => void;
  setCurrentIndex: (i: number) => void;
  setSpeed: (s: number) => void;
  setAnimationMetric: (m: AnimationMetric) => void;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  animationActive: false,
  playing: false,
  currentIndex: 0,
  speed: 1,
  animationMetric: 'headChange',
  startAnimation: () => set({ animationActive: true, playing: false, currentIndex: 0 }),
  stopAnimation: () => set({ animationActive: false, playing: false, currentIndex: 0 }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setCurrentIndex: (i) => set({ currentIndex: i }),
  setSpeed: (s) => set({ speed: s }),
  setAnimationMetric: (m) => set({ animationMetric: m }),
}));

// --- UI Store ---
interface UIState {
  selectedElementId: string | null;
  selectedElementType: NetworkNode['type'] | NetworkLink['type'] | null;
  sidebarTab: 'network' | 'events' | 'settings' | 'results';
  sidebarMode: 'network' | 'transient';
  sidebarOpen: boolean;
  showUpload: boolean;
  zoomToElementId: string | null;
  selectElement: (id: string | null, type: NetworkNode['type'] | NetworkLink['type'] | null) => void;
  setSidebarTab: (tab: UIState['sidebarTab']) => void;
  setSidebarMode: (mode: UIState['sidebarMode']) => void;
  setSidebarOpen: (open: boolean) => void;
  setShowUpload: (show: boolean) => void;
  zoomToElement: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedElementId: null,
  selectedElementType: null,
  sidebarTab: 'network',
  sidebarMode: 'network',
  sidebarOpen: true,
  showUpload: true,
  zoomToElementId: null,
  selectElement: (id, type) => set({ selectedElementId: id, selectedElementType: type }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setShowUpload: (show) => set({ showUpload: show }),
  zoomToElement: (id) => set({ zoomToElementId: id }),
}));
