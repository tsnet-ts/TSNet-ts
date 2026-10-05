import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';
import type { Pipe } from '@tsnet-ts/ts-net';

const LOG_PREFIX = '[TSNet Debug]';

function debug(stage: string, detail?: Record<string, unknown> | string): void {
  const payload = typeof detail === 'string' ? { message: detail } : detail;
  console.log(`${LOG_PREFIX} [worker] ${stage}`, payload ?? '');
  self.postMessage({ type: 'debug', stage, detail: payload ?? null, ts: Date.now() });
}

function postProgress(value: number, stage: string): void {
  debug(`progress ${value}%`, stage);
  self.postMessage({ type: 'progress', value, stage });
}

function collectBuffers(result: WorkerSimulationResults): ArrayBuffer[] {
  const seen = new Set<ArrayBuffer>();
  const add = (series?: Float32Array) => {
    if (series && !seen.has(series.buffer)) seen.add(series.buffer);
  };
  add(result.time);
  for (const node of Object.values(result.nodes)) {
    add(node.head);
    add(node.demandDischarge);
    add(node.emitterDischarge);
    add(node.waterLevel);
    add(node.tankFlow);
  }
  for (const pipe of Object.values(result.pipes)) {
    add(pipe.startHead);
    add(pipe.endHead);
    add(pipe.startVelocity);
    add(pipe.endVelocity);
    add(pipe.startFlow);
    add(pipe.endFlow);
  }
  return [...seen];
}

function postResult(result: WorkerSimulationResults): void {
  self.postMessage({ type: 'result', result }, collectBuffers(result));
}

function postError(stage: string, err: unknown): void {
  const error = err instanceof Error ? err : new Error(String(err));
  const message = stage ? `[${stage}] ${error.message}` : error.message;
  const stack = error.stack ?? '';
  console.error(`${LOG_PREFIX} [worker] ERROR at ${stage}:`, error);
  self.postMessage({ type: 'error', error: message, stack, stage });
}

async function runStage<T>(stage: string, fn: () => T | Promise<T>): Promise<T> {
  debug(`${stage} — start`);
  const t0 = performance.now();
  try {
    const result = await fn();
    debug(`${stage} — done`, { elapsedMs: Math.round(performance.now() - t0) });
    return result;
  } catch (err) {
    debug(`${stage} — FAILED`, {
      elapsedMs: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : String(err),
    });
    postError(stage, err);
    throw err;
  }
}

export interface WorkerSimulationInput {
  inpContent: string;
  events: WorkerTransientEvent[];
  settings: {
    wavespeed: number;
    simulationPeriod: number;
    dt: number | null;
    frictionModel: 'steady' | 'quasi-steady' | 'unsteady';
    demandModel?: 'DD' | 'PDD';
  };
}

export type WorkerTransientEvent =
  | { type: 'valve-closure'; elementName: string; tc: number; ts: number; se: number; m: number }
  | { type: 'valve-opening'; elementName: string; tc: number; ts: number; se: number; m: number }
  | { type: 'pump-shutdown'; elementName: string; tc: number; ts: number; se: number; m: number }
  | { type: 'pump-startup'; elementName: string; tc: number; ts: number; se: number; m: number }
  | { type: 'burst'; elementName: string; ts: number; tc: number; finalBurstCoeff: number }
  | { type: 'leak'; elementName: string; coeff: number }
  | { type: 'demand-pulse'; elementName: string; tc: number; ts: number; tp: number; dp: number }
  | { type: 'surge-tank'; elementName: string; tankType: 'open' | 'closed'; area: number; height?: number; waterLevel?: number };

function packSeries(arr: ArrayLike<number> | undefined | null, n: number): Float32Array {
  const out = new Float32Array(n);
  if (arr != null && arr.length > 0) {
    const len = Math.min(n, arr.length);
    for (let i = 0; i < len; i++) out[i] = arr[i] as number;
  }
  return out;
}

function optionalSeries(arr: ArrayLike<number> | undefined | null, n: number): Float32Array | undefined {
  if (arr == null || arr.length === 0) return undefined;
  return packSeries(arr, n);
}

export interface WorkerSimulationResults {
  time: Float32Array;
  nodes: Record<string, {
    head: Float32Array;
    demandDischarge: Float32Array;
    emitterDischarge: Float32Array;
    waterLevel?: Float32Array;
    tankFlow?: Float32Array;
  }>;
  pipes: Record<string, {
    startHead: Float32Array;
    endHead: Float32Array;
    startVelocity: Float32Array;
    endVelocity: Float32Array;
    startFlow: Float32Array;
    endFlow: Float32Array;
  }>;
}

function logModelStats(tm: TransientModel, label: string, extra?: Record<string, unknown>): void {
  let pipeCount = 0;
  let nodeCount = 0;
  let minSegments = Infinity;
  let maxSegments = 0;
  let minPipeLength = Infinity;
  let maxPipeLength = 0;
  let totalSegments = 0;
  let wavev: number | undefined;

  for (const [, pipe] of tm.pipes()) {
    pipeCount++;
    if (wavev === undefined) wavev = pipe.wavev;
    const segs = pipe.number_of_segments ?? 0;
    totalSegments += segs;
    if (segs < minSegments) minSegments = segs;
    if (segs > maxSegments) maxSegments = segs;
    if (pipe.length < minPipeLength) minPipeLength = pipe.length;
    if (pipe.length > maxPipeLength) maxPipeLength = pipe.length;
  }
  for (const [, _node] of tm.nodes()) {
    nodeCount++;
  }

  const tn = tm.time_step > 0 ? Math.floor(tm.simulation_period / tm.time_step) : 0;

  debug(label, {
    ...extra,
    nodes: nodeCount,
    pipes: pipeCount,
    simulationPeriod: tm.simulation_period,
    timeStep: tm.time_step,
    totalTimeSteps: tn,
    totalSegments,
    segmentsPerPipe: { min: minSegments === Infinity ? 0 : minSegments, max: maxSegments },
    pipeLength: {
      min: minPipeLength === Infinity ? 0 : minPipeLength,
      max: maxPipeLength,
    },
    wavespeed: wavev,
  });
}

async function run(input: WorkerSimulationInput): Promise<WorkerSimulationResults> {
  debug('run — input summary', {
    inpBytes: input.inpContent.length,
    eventCount: input.events.length,
    events: input.events.map((e) => ({ type: e.type, element: e.elementName })),
    settings: input.settings,
  });

  postProgress(5, 'Loading EPANET model...');

  let tm = await runStage('createFromContent', () =>
    TransientModel.createFromContent(input.inpContent)
  );
  postProgress(15, 'Loading EPANET model...');
  logModelStats(tm, 'after EPANET load');

  tm = await runStage('set_wavespeed', () => {
    tm.set_wavespeed(input.settings.wavespeed);
    return tm;
  });

  tm = await runStage('set_time', () => {
    tm.set_time(input.settings.simulationPeriod, input.settings.dt);
    return tm;
  });
  logModelStats(tm, 'after discretization');

  postProgress(20, 'Configuring events...');

  for (let i = 0; i < input.events.length; i++) {
    const event = input.events[i];
    await runStage(`applyEvent[${i}] ${event.type}@${event.elementName}`, () => {
      switch (event.type) {
        case 'valve-closure':
          tm.valve_closure(event.elementName, [event.tc, event.ts, event.se, event.m]);
          break;
        case 'valve-opening':
          tm.valve_opening(event.elementName, [event.tc, event.ts, event.se, event.m]);
          break;
        case 'pump-shutdown':
          tm.pump_shut_off(event.elementName, [event.tc, event.ts, event.se, event.m]);
          break;
        case 'pump-startup':
          tm.pump_start_up(event.elementName, [event.tc, event.ts, event.se, event.m]);
          break;
        case 'burst':
          tm.add_burst(event.elementName, event.ts, event.tc, event.finalBurstCoeff);
          break;
        case 'leak':
          tm.add_leak(event.elementName, event.coeff);
          break;
        case 'demand-pulse':
          tm.add_demand_pulse(event.elementName, [event.tc, event.ts, event.tp, event.dp]);
          break;
        case 'surge-tank': {
          const shape = event.tankType === 'open'
            ? [event.area]
            : [event.area, event.height!, event.waterLevel!];
          tm.add_surge_tank(event.elementName, shape, event.tankType);
          break;
        }
      }
      return tm;
    });
  }

  postProgress(25, 'Initializing steady state...');

  tm = await runStage('Initializer', () =>
    Initializer(tm, 0, input.settings.demandModel === 'PDD' ? 'PDD' : 'DD')
  );
  logModelStats(tm, 'after Initializer');

  postProgress(40, 'Running MOC simulation...');

  tm = await runStage('MOCSimulator', () =>
    MOCSimulator(tm, 'results', input.settings.frictionModel, (mocPercent) => {
      postProgress(40 + Math.floor(mocPercent * 0.5), 'Running MOC simulation...');
    })
  );

  postProgress(90, 'Extracting results...');

  const timestamps = tm.simulation_timestamps;
  const n = timestamps.length;
  const time = packSeries(timestamps, n);
  const nodes: WorkerSimulationResults['nodes'] = {};
  for (const [name, node] of tm.nodes()) {
    if (!node._head || node._head.length === 0) continue;
    const entry: WorkerSimulationResults['nodes'][string] = {
      head: packSeries(node._head, n),
      demandDischarge: packSeries(node.demand_discharge, n),
      emitterDischarge: packSeries(node.emitter_discharge, n),
    };
    const waterLevel = optionalSeries(node.water_level_timeseries, n);
    const tankFlow = optionalSeries(node.tank_flow_timeseries, n);
    if (waterLevel) entry.waterLevel = waterLevel;
    if (tankFlow) entry.tankFlow = tankFlow;
    nodes[name] = entry;
  }

  const pipes: WorkerSimulationResults['pipes'] = {};
  for (const [name, link] of tm.pipes()) {
    const pipe = link as unknown as Pipe;
    pipes[name] = {
      startHead: packSeries(pipe.start_node_head, n),
      endHead: packSeries(pipe.end_node_head, n),
      startVelocity: packSeries(pipe.start_node_velocity, n),
      endVelocity: packSeries(pipe.end_node_velocity, n),
      startFlow: packSeries(pipe.start_node_flowrate, n),
      endFlow: packSeries(pipe.end_node_flowrate, n),
    };
  }

  debug('extractResults — done', {
    timeSteps: time.length,
    nodesWithHead: Object.keys(nodes).length,
    pipesWithData: Object.keys(pipes).length,
  });

  postProgress(95, 'Transferring results…');
  return { time, nodes, pipes };
}

self.addEventListener('message', async (e: MessageEvent) => {
  if (e.data?.type === 'run') {
    debug('worker — message received', { type: 'run' });
    try {
      const result = await run(e.data.input);
      debug('worker — posting result');
      postResult(result);
    } catch {
      // postError already sent from runStage
    }
  }
});
