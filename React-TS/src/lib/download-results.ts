import type {
  NetworkData,
  SimulationResults,
  SimulationSettings,
  TimeSeries,
  TransientEvent,
} from '@/types';
import { nodeElevation } from '@/lib/result-metrics';

export interface DownloadResultsContext {
  fileName?: string;
  network?: NetworkData | null;
  settings?: SimulationSettings;
  events?: TransientEvent[];
}

function toNumberArray(series: TimeSeries): number[] {
  return Array.from(series);
}

export function downloadSimulationResults(
  results: SimulationResults,
  context: DownloadResultsContext | string = {},
): void {
  const ctx: DownloadResultsContext = typeof context === 'string' ? { fileName: context } : context;
  const baseName = ctx.fileName ?? 'tsnet-results';
  const safeName = baseName.replace(/\.inp$/i, '').replace(/[^\w.-]+/g, '_') || 'tsnet-results';

  const nodes: Record<string, Record<string, number[]>> = {};
  for (const [id, node] of Object.entries(results.nodes)) {
    const elevation = nodeElevation(ctx.network, id);
    const payload: Record<string, number[]> = {
      head: toNumberArray(node.head),
      pressure: toNumberArray(node.head).map((h) => h - elevation),
      demandDischarge: toNumberArray(node.demandDischarge),
      emitterDischarge: toNumberArray(node.emitterDischarge),
    };
    if (node.waterLevel) payload.waterLevel = toNumberArray(node.waterLevel);
    if (node.tankFlow) payload.tankFlow = toNumberArray(node.tankFlow);
    nodes[id] = payload;
  }

  const pipes: Record<string, Record<string, number[]>> = {};
  for (const [id, pipe] of Object.entries(results.pipes)) {
    pipes[id] = {
      startHead: toNumberArray(pipe.startHead),
      endHead: toNumberArray(pipe.endHead),
      startVelocity: toNumberArray(pipe.startVelocity),
      endVelocity: toNumberArray(pipe.endVelocity),
      startFlow: toNumberArray(pipe.startFlow),
      endFlow: toNumberArray(pipe.endFlow),
    };
  }

  const payload = {
    fileName: ctx.fileName ?? null,
    unitSystem: ctx.network?.unitSystem ?? null,
    settings: ctx.settings ?? null,
    events: ctx.events ?? [],
    time: toNumberArray(results.time),
    nodes,
    pipes,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}-transient-results.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
