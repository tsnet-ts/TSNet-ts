export interface Coordinates {
  x: number;
  y: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: 'junction' | 'reservoir' | 'tank';
  elevation: number;
  coordinates: Coordinates;
  baseDemand?: number;
  demandPattern?: string;
  // Reservoir-specific
  totalHead?: number;
  headPattern?: string;
  // Tank-specific
  initLevel?: number;
  minLevel?: number;
  maxLevel?: number;
  tankDiameter?: number;
  minVolume?: number;
}

export type ValveType = 'PRV' | 'PSV' | 'PBV' | 'FCV' | 'TCV' | 'GPV';

export interface NetworkLink {
  id: string;
  name: string;
  type: 'pipe' | 'valve' | 'pump';
  startNodeId: string;
  endNodeId: string;
  length?: number;
  diameter?: number;
  roughness?: number;
  status?: string;
  vertices?: Coordinates[];
  minorLoss?: number;
  // Valve-specific
  valveType?: ValveType;
  setting?: number;
  // Pump-specific
  pumpType?: string;
  power?: number;
  speed?: number;
  headCurveIndex?: number;
}

export type UnitSystem = 'SI' | 'US';

export interface NetworkData {
  nodes: Map<string, NetworkNode>;
  links: Map<string, NetworkLink>;
  title: string;
  unitSystem: UnitSystem;
  flowUnitsLabel: string;
}

export type TransientEventType =
  | 'valve-closure'
  | 'valve-opening'
  | 'pump-shutdown'
  | 'pump-startup'
  | 'burst'
  | 'leak'
  | 'demand-pulse'
  | 'surge-tank';

export interface BaseEvent {
  id: string;
  type: TransientEventType;
  elementId: string;
  elementName: string;
}

export interface ValveEvent extends BaseEvent {
  type: 'valve-closure' | 'valve-opening';
  tc: number; // duration [s]
  ts: number; // start time [s]
  se: number; // end open percentage
  m: number;  // closure/opening constant
}

export interface PumpEvent extends BaseEvent {
  type: 'pump-shutdown' | 'pump-startup';
  tc: number;
  ts: number;
  se: number;
  m: number;
}

export interface BurstEvent extends BaseEvent {
  type: 'burst';
  ts: number;           // burst start time [s]
  tc: number;           // development time [s]
  finalBurstCoeff: number; // final burst coefficient [m^3/s/(m H2O)^(1/2)]
}

export interface LeakEvent extends BaseEvent {
  type: 'leak';
  coeff: number;        // emitter coefficient [m^3/s/(m H2O)^(1/2)]
}

export interface DemandPulseEvent extends BaseEvent {
  type: 'demand-pulse';
  tc: number; // total duration [s]
  ts: number; // start time [s]
  tp: number; // transmission time [s]
  dp: number; // peak amplitude [unitless]
}

export interface SurgeTankEvent extends BaseEvent {
  type: 'surge-tank';
  tankType: 'open' | 'closed';
  area: number;       // cross-sectional area [m^2]
  height?: number;    // tank height [m] (closed only)
  waterLevel?: number; // initial water level [m] (closed only)
}

export type TransientEvent =
  | ValveEvent
  | PumpEvent
  | BurstEvent
  | LeakEvent
  | DemandPulseEvent
  | SurgeTankEvent;

export type FrictionModel = 'steady' | 'quasi-steady' | 'unsteady';

export interface SimulationSettings {
  wavespeed: number;       // m/s
  simulationPeriod: number; // seconds
  dt: number | null;       // time step in seconds, null = auto (max allowed)
  frictionModel: FrictionModel;
}

export interface SimulationResults {
  time: number[];
  nodes: Record<string, {
    head: number[];
    velocity?: number[];
  }>;
  pipes: Record<string, {
    startHead: number[];
    endHead: number[];
    startVelocity: number[];
    endVelocity: number[];
  }>;
}

export type SimulationStatus = 'idle' | 'running' | 'success' | 'error';
