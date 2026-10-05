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
  demandModel: 'DD',
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
  setResults: (results) => set({ results }),
  setError: (error) => set({ error, status: 'error' }),
  reset: () => set({ events: [], settings: defaultSettings, status: 'idle', progress: 0, progressStage: '', results: null, error: null }),
}));

// --- Animation Store ---
export type AnimationMetric =
  | 'headChange'
  | 'pressure'
  | 'velocity'
  | 'flowrate'
  | 'demandDischarge'
  | 'emitterDischarge';

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

export type PlottedElementType = NetworkNode['type'] | NetworkLink['type'];

export interface PlottedElement {
  id: string;
  type: PlottedElementType;
}

const PLOTTED_CAP = 8;

function samePlotted(a: PlottedElement, b: PlottedElement): boolean {
  return a.id === b.id && a.type === b.type;
}

// --- UI Store ---
interface UIState {
  selectedElementId: string | null;
  selectedElementType: PlottedElementType | null;
  plottedElements: PlottedElement[];
  sidebarTab: 'network' | 'events' | 'settings' | 'results';
  sidebarMode: 'network' | 'transient';
  sidebarOpen: boolean;
  showUpload: boolean;
  zoomToElementId: string | null;
  selectElement: (id: string | null, type: PlottedElementType | null) => void;
  addPlottedElement: (el: PlottedElement) => void;
  removePlottedElement: (el: PlottedElement) => void;
  setPlottedElements: (els: PlottedElement[]) => void;
  setSidebarTab: (tab: UIState['sidebarTab']) => void;
  setSidebarMode: (mode: UIState['sidebarMode']) => void;
  setSidebarOpen: (open: boolean) => void;
  setShowUpload: (show: boolean) => void;
  zoomToElement: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedElementId: null,
  selectedElementType: null,
  plottedElements: [],
  sidebarTab: 'network',
  sidebarMode: 'network',
  sidebarOpen: true,
  showUpload: true,
  zoomToElementId: null,
  selectElement: (id, type) => set({ selectedElementId: id, selectedElementType: type }),
  addPlottedElement: (el) =>
    set((s) => {
      if (s.plottedElements.some((e) => samePlotted(e, el))) return s;
      if (s.plottedElements.length >= PLOTTED_CAP) return s;
      return { plottedElements: [...s.plottedElements, el] };
    }),
  removePlottedElement: (el) =>
    set((s) => ({
      plottedElements: s.plottedElements.filter((e) => !samePlotted(e, el)),
    })),
  setPlottedElements: (els) => set({ plottedElements: els.slice(0, PLOTTED_CAP) }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setShowUpload: (show) => set({ showUpload: show }),
  zoomToElement: (id) => set({ zoomToElementId: id }),
}));
