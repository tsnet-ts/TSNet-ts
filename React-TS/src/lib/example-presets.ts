import type { SimulationSettings } from '@/types';
import { publicUrl } from '@/lib/public-url';

export interface PresetEvent {
  type: string;
  elementId: string;
  elementName: string;
  [key: string]: unknown;
}

export interface ExamplePreset {
  id: string;
  name: string;
  description: string;
  network: string;         // filename in public/demo/
  file: string;            // URL path to fetch
  mode: 'gis' | 'schematic';
  settings: SimulationSettings;
  events: PresetEvent[];
}

export const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    id: 'us-style-leak',
    name: 'US Style — Leak @ J124',
    description: '168-pipe georeferenced network (Hamilton, ON) with background leak at J124',
    network: '02-us-style.inp',
    file: publicUrl('demo/02-us-style.inp'),
    mode: 'gis',
    settings: {
      wavespeed: 1200,
      simulationPeriod: 20,
      dt: null,
      frictionModel: 'steady',
    },
    events: [
      {
        type: 'leak',
        elementId: 'J124',
        elementName: 'J124',
        coeff: 0.01,
      },
    ],
  },
  {
    id: 'tnet0-valve-closure',
    name: 'Tnet0 — Valve Closure',
    description: 'Simple 3-pipe network with instantaneous valve closure',
    network: 'Tnet0.inp',
    file: publicUrl('demo/Tnet0.inp'),
    mode: 'schematic',
    settings: {
      wavespeed: 1200,
      simulationPeriod: 25,
      dt: 0.01,
      frictionModel: 'steady',
    },
    events: [
      {
        type: 'valve-closure',
        elementId: '3',
        elementName: '3',
        tc: 0,
        ts: 0,
        se: 0,
        m: 1,
      },
    ],
  },
  {
    id: 'tnet1-demand-pulse',
    name: 'Tnet1 — Demand Pulse',
    description: '8-node network with demand pulse at junction N2',
    network: 'Tnet1.inp',
    file: publicUrl('demo/Tnet1.inp'),
    mode: 'schematic',
    settings: {
      wavespeed: 1200,
      simulationPeriod: 20,
      dt: 0.1,
      frictionModel: 'steady',
    },
    events: [
      {
        type: 'demand-pulse',
        elementId: 'N2',
        elementName: 'N2',
        tc: 1,
        ts: 1,
        tp: 0.2,
        dp: 1,
      },
    ],
  },
  {
    id: 'tnet2-pump-shutdown',
    name: 'Tnet2 — Pump Shutdown',
    description: 'Complex network with pump trip and unsteady friction',
    network: 'Tnet2.inp',
    file: publicUrl('demo/Tnet2.inp'),
    mode: 'schematic',
    settings: {
      wavespeed: 1200,
      simulationPeriod: 10,
      dt: null,
      frictionModel: 'unsteady',
    },
    events: [
      {
        type: 'pump-shutdown',
        elementId: 'PUMP2',
        elementName: 'PUMP2',
        tc: 1,
        ts: 0,
        se: 0,
        m: 1,
      },
    ],
  },
  {
    id: 'tnet3-burst',
    name: 'Tnet3 — Burst Leak',
    description: 'Large network with pipe burst at Junction-20',
    network: 'Tnet3.inp',
    file: publicUrl('demo/Tnet3.inp'),
    mode: 'schematic',
    settings: {
      wavespeed: 1200,
      simulationPeriod: 20,
      dt: null,
      frictionModel: 'steady',
    },
    events: [
      {
        type: 'burst',
        elementId: 'JUNCTION-20',
        elementName: 'JUNCTION-20',
        ts: 1,
        tc: 1,
        finalBurstCoeff: 0.01,
      },
    ],
  },
  {
    id: 'tnet0-valve-closure-surge-tank',
    name: 'Tnet0 — Valve Closure + Surge Tank',
    description: 'Valve closure with open surge tank protection at Node 2',
    network: 'Tnet0.inp',
    file: publicUrl('demo/Tnet0.inp'),
    mode: 'schematic',
    settings: {
      wavespeed: 1200,
      simulationPeriod: 60,
      dt: 0.1,
      frictionModel: 'steady',
    },
    events: [
      {
        type: 'valve-closure',
        elementId: '3',
        elementName: '3',
        tc: 0,
        ts: 2,
        se: 0,
        m: 1,
      },
      {
        type: 'surge-tank',
        elementId: '2',
        elementName: '2',
        tankType: 'open',
        area: 100,
      },
    ],
  },
  {
    id: 'tnet3-burst-surge-tank',
    name: 'Tnet3 — Burst + Surge Tank',
    description: 'Pipe burst at Junction-73 with closed surge tank at Junction-89',
    network: 'Tnet3.inp',
    file: publicUrl('demo/Tnet3.inp'),
    mode: 'schematic',
    settings: {
      wavespeed: 1200,
      simulationPeriod: 20,
      dt: null,
      frictionModel: 'steady',
    },
    events: [
      {
        type: 'burst',
        elementId: 'JUNCTION-73',
        elementName: 'JUNCTION-73',
        ts: 1,
        tc: 1,
        finalBurstCoeff: 0.01,
      },
      {
        type: 'surge-tank',
        elementId: 'JUNCTION-89',
        elementName: 'JUNCTION-89',
        tankType: 'closed',
        area: 10,
        height: 10,
        waterLevel: 5,
      },
    ],
  },
];
