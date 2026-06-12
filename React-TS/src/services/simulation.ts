import type { TransientEvent, SimulationSettings, SimulationResults } from '@/types';
import type { WorkerTransientEvent, WorkerSimulationResults } from '@/workers/simulation-worker';

const LOG_PREFIX = '[TSNet Debug]';

let workerInstance: Worker | null = null;

/** Terminate the worker (e.g. on unmount or before re-run) */
export function terminateWorker(): void {
  workerInstance?.terminate();
  workerInstance = null;
}

function toWorkerEvent(event: TransientEvent): WorkerTransientEvent {
  switch (event.type) {
    case 'valve-closure':
    case 'valve-opening':
      return {
        type: event.type,
        elementName: event.elementName,
        tc: event.tc,
        ts: event.ts,
        se: event.se,
        m: event.m,
      };
    case 'pump-shutdown':
    case 'pump-startup':
      return {
        type: event.type,
        elementName: event.elementName,
        tc: event.tc,
        ts: event.ts,
        se: event.se,
        m: event.m,
      };
    case 'burst':
      return {
        type: 'burst',
        elementName: event.elementName,
        ts: event.ts,
        tc: event.tc,
        finalBurstCoeff: event.finalBurstCoeff,
      };
    case 'leak':
      return {
        type: 'leak',
        elementName: event.elementName,
        coeff: event.coeff,
      };
    case 'demand-pulse':
      return {
        type: 'demand-pulse',
        elementName: event.elementName,
        tc: event.tc,
        ts: event.ts,
        tp: event.tp,
        dp: event.dp,
      };
    case 'surge-tank':
      return {
        type: 'surge-tank',
        elementName: event.elementName,
        tankType: event.tankType,
        area: event.area,
        height: event.height,
        waterLevel: event.waterLevel,
      };
  }
}

/**
 * Run transient simulation using the real TSNET-TS engine in a Web Worker.
 */
export async function runSimulation(
  rawInpContent: string,
  events: TransientEvent[],
  settings: SimulationSettings,
  onProgress: (progress: number, stage: string) => void
): Promise<SimulationResults> {
  terminateWorker();

  console.group(`${LOG_PREFIX} runSimulation — start`);
  console.log('settings', settings);
  console.log('events', events.map((e) => ({ type: e.type, element: e.elementName, id: e.elementId })));
  console.log('inp size (bytes)', rawInpContent.length);

  workerInstance = new Worker(
    new URL('../workers/simulation-worker.ts', import.meta.url),
    { type: 'module' }
  );

  return new Promise<SimulationResults>((resolve, reject) => {
    const cleanup = () => {
      workerInstance?.removeEventListener('message', onMessage);
      workerInstance?.removeEventListener('error', onWorkerError);
      workerInstance?.removeEventListener('messageerror', onMessageError);
    };

    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'debug':
          console.log(`${LOG_PREFIX} [worker→main] ${msg.stage}`, msg.detail ?? '');
          break;
        case 'progress':
          console.log(`${LOG_PREFIX} progress ${msg.value}% — ${msg.stage}`);
          onProgress(msg.value, msg.stage);
          break;
        case 'result':
          console.log(`${LOG_PREFIX} runSimulation — success`, {
            timeSteps: msg.result.time?.length,
            nodes: Object.keys(msg.result.nodes ?? {}).length,
            pipes: Object.keys(msg.result.pipes ?? {}).length,
          });
          console.groupEnd();
          cleanup();
          resolve({
            time: msg.result.time,
            nodes: msg.result.nodes,
            pipes: msg.result.pipes,
          });
          break;
        case 'error': {
          const errMsg = msg.error as string;
          const stack = msg.stack as string | undefined;
          const stage = msg.stage as string | undefined;
          console.error(`${LOG_PREFIX} runSimulation — FAILED`, { stage, error: errMsg, stack });
          console.groupEnd();
          cleanup();
          const full = stack ? `${errMsg}\n\n${stack}` : errMsg;
          reject(new Error(full));
          break;
        }
      }
    };

    const onWorkerError = (e: ErrorEvent) => {
      console.error(`${LOG_PREFIX} worker uncaught error`, {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error,
      });
      console.groupEnd();
      cleanup();
      reject(new Error(`Worker crashed: ${e.message}${e.error?.stack ? `\n\n${e.error.stack}` : ''}`));
    };

    const onMessageError = (e: MessageEvent) => {
      console.error(`${LOG_PREFIX} worker messageerror (deserialization failed)`, e.data);
      console.groupEnd();
      cleanup();
      reject(new Error('Worker message deserialization failed'));
    };

    workerInstance!.addEventListener('message', onMessage);
    workerInstance!.addEventListener('error', onWorkerError);
    workerInstance!.addEventListener('messageerror', onMessageError);

    console.log(`${LOG_PREFIX} posting run message to worker`);
    workerInstance!.postMessage({
      type: 'run',
      input: {
        inpContent: rawInpContent,
        events: events.map(toWorkerEvent),
        settings: {
          wavespeed: settings.wavespeed,
          simulationPeriod: settings.simulationPeriod,
          dt: settings.dt,
          frictionModel: settings.frictionModel,
        },
      },
    });
  });
}
