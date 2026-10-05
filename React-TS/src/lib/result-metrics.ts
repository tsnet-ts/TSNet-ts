import type {
  NetworkData,
  NodeSimulationResults,
  PipeSimulationResults,
  SimulationResults,
  TimeSeries,
} from '@/types';

export type PlotKind = 'node' | 'pipe';

export type NodeMetricId =
  | 'head'
  | 'pressure'
  | 'demandDischarge'
  | 'emitterDischarge'
  | 'waterLevel'
  | 'tankFlow';

export type PipeMetricId = 'head' | 'velocity' | 'flowrate';

export type PlotMetricId = NodeMetricId | PipeMetricId;

export interface PlotMetricDef {
  id: PlotMetricId;
  kind: PlotKind;
  label: string;
  units: string;
  yAxisLabel: string;
  supportsDelta: boolean;
}

export const NODE_METRICS: PlotMetricDef[] = [
  { id: 'head', kind: 'node', label: 'Head', units: 'm', yAxisLabel: 'Head (m)', supportsDelta: true },
  { id: 'pressure', kind: 'node', label: 'Pressure', units: 'm', yAxisLabel: 'Pressure (m)', supportsDelta: true },
  { id: 'demandDischarge', kind: 'node', label: 'Demand discharge', units: 'm³/s', yAxisLabel: 'Demand discharge (m³/s)', supportsDelta: false },
  { id: 'emitterDischarge', kind: 'node', label: 'Emitter discharge', units: 'm³/s', yAxisLabel: 'Emitter discharge (m³/s)', supportsDelta: false },
  { id: 'waterLevel', kind: 'node', label: 'Water level', units: 'm', yAxisLabel: 'Water level (m)', supportsDelta: false },
  { id: 'tankFlow', kind: 'node', label: 'Tank flow', units: 'm³/s', yAxisLabel: 'Tank flow (m³/s)', supportsDelta: false },
];

export const PIPE_METRICS: PlotMetricDef[] = [
  { id: 'head', kind: 'pipe', label: 'Head', units: 'm', yAxisLabel: 'Head (m)', supportsDelta: true },
  { id: 'velocity', kind: 'pipe', label: 'Velocity', units: 'm/s', yAxisLabel: 'Velocity (m/s)', supportsDelta: false },
  { id: 'flowrate', kind: 'pipe', label: 'Flowrate', units: 'm³/s', yAxisLabel: 'Flowrate (m³/s)', supportsDelta: false },
];

const EMPTY_SERIES = new Float32Array(0);

export function hasSeries(arr: TimeSeries | undefined): arr is TimeSeries {
  return arr != null && arr.length > 0;
}

export function nodeMetricAvailable(metric: NodeMetricId, node: NodeSimulationResults | undefined): boolean {
  if (!node) return false;
  switch (metric) {
    case 'head':
    case 'pressure':
      return hasSeries(node.head);
    case 'demandDischarge':
      return hasSeries(node.demandDischarge);
    case 'emitterDischarge':
      return hasSeries(node.emitterDischarge);
    case 'waterLevel':
      return hasSeries(node.waterLevel);
    case 'tankFlow':
      return hasSeries(node.tankFlow);
  }
}

export function pipeMetricAvailable(metric: PipeMetricId, pipe: PipeSimulationResults | undefined): boolean {
  if (!pipe) return false;
  switch (metric) {
    case 'head':
      return hasSeries(pipe.startHead) || hasSeries(pipe.endHead);
    case 'velocity':
      return hasSeries(pipe.startVelocity) || hasSeries(pipe.endVelocity);
    case 'flowrate':
      return hasSeries(pipe.startFlow) || hasSeries(pipe.endFlow);
  }
}

const CORE_NODE_METRICS = new Set<NodeMetricId>([
  'head',
  'pressure',
  'demandDischarge',
  'emitterDischarge',
]);

export function availableNodeMetrics(node: NodeSimulationResults | undefined): PlotMetricDef[] {
  if (!node) return NODE_METRICS.filter((m) => CORE_NODE_METRICS.has(m.id as NodeMetricId));
  return NODE_METRICS.filter((m) => {
    const id = m.id as NodeMetricId;
    if (CORE_NODE_METRICS.has(id)) return true;
    return nodeMetricAvailable(id, node);
  });
}

export function availablePipeMetrics(_pipe: PipeSimulationResults | undefined): PlotMetricDef[] {
  return PIPE_METRICS;
}

export function isNodePlotType(type: string | null | undefined): boolean {
  return type === 'junction' || type === 'reservoir' || type === 'tank';
}

export function isLinkPlotType(type: string | null | undefined): boolean {
  return type === 'pipe' || type === 'valve' || type === 'pump';
}

export function metricsForPlotted(
  plotted: { id: string; type: string }[],
  results: SimulationResults,
): PlotMetricDef[] {
  if (plotted.length === 0) return [];
  const hasNode = plotted.some((el) => isNodePlotType(el.type));
  const hasLink = plotted.some((el) => isLinkPlotType(el.type));
  if (hasNode && hasLink) {
    return NODE_METRICS.filter((m) => m.id === 'head');
  }
  if (hasLink) {
    return PIPE_METRICS;
  }
  let defs: PlotMetricDef[] | null = null;
  for (const el of plotted) {
    const avail = availableNodeMetrics(results.nodes[el.id]);
    defs = defs ? defs.filter((d) => avail.some((a) => a.id === d.id)) : avail;
  }
  return defs ?? [];
}

export function availableMetricsForKind(
  results: SimulationResults,
  kind: PlotKind,
): PlotMetricDef[] {
  if (kind === 'node') {
    const defs = NODE_METRICS.filter((m) =>
      Object.values(results.nodes).some((node) => nodeMetricAvailable(m.id as NodeMetricId, node)),
    );
    return defs.length > 0 ? defs : NODE_METRICS.filter((m) => m.id === 'head');
  }
  return PIPE_METRICS.filter((m) =>
    Object.values(results.pipes).some((pipe) => pipeMetricAvailable(m.id as PipeMetricId, pipe)),
  );
}

export function nodeElevation(network: NetworkData | null | undefined, nodeId: string): number {
  return network?.nodes.get(nodeId)?.elevation ?? 0;
}

function seriesAt(series: TimeSeries | undefined, index: number): number {
  if (!series || index < 0 || index >= series.length) return 0;
  return series[index] ?? 0;
}

function seriesValue(series: TimeSeries | undefined, index: number, delta: boolean): number {
  const value = seriesAt(series, index);
  return delta ? value - seriesAt(series, 0) : value;
}

function applyDelta(values: TimeSeries | undefined, delta: boolean): TimeSeries {
  if (!values || values.length === 0) return EMPTY_SERIES;
  if (!delta) return values;
  const v0 = values[0] ?? 0;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = (values[i] ?? 0) - v0;
  return out;
}

export function getNodeValues(
  node: NodeSimulationResults,
  metric: NodeMetricId,
  options: { delta?: boolean; elevation?: number } = {},
): TimeSeries {
  const elevation = options.elevation ?? 0;
  const delta = !!options.delta;
  switch (metric) {
    case 'head':
      return applyDelta(node.head, delta);
    case 'pressure': {
      const head = node.head;
      if (!head || head.length === 0) return EMPTY_SERIES;
      const out = new Float32Array(head.length);
      if (delta) {
        const v0 = head[0] ?? 0;
        for (let i = 0; i < head.length; i++) out[i] = (head[i] ?? 0) - v0;
      } else {
        for (let i = 0; i < head.length; i++) out[i] = (head[i] ?? 0) - elevation;
      }
      return out;
    }
    case 'demandDischarge':
      return applyDelta(node.demandDischarge, delta);
    case 'emitterDischarge':
      return applyDelta(node.emitterDischarge, delta);
    case 'waterLevel':
      return applyDelta(node.waterLevel, delta);
    case 'tankFlow':
      return applyDelta(node.tankFlow, delta);
    default:
      return EMPTY_SERIES;
  }
}

export function getNodeValueAt(
  node: NodeSimulationResults,
  metric: NodeMetricId,
  index: number,
  options: { delta?: boolean; elevation?: number } = {},
): number {
  const delta = !!options.delta;
  switch (metric) {
    case 'head':
      return seriesValue(node.head, index, delta);
    case 'pressure':
      return delta
        ? seriesValue(node.head, index, true)
        : seriesAt(node.head, index) - (options.elevation ?? 0);
    case 'demandDischarge':
      return seriesValue(node.demandDischarge, index, delta);
    case 'emitterDischarge':
      return seriesValue(node.emitterDischarge, index, delta);
    case 'waterLevel':
      return seriesValue(node.waterLevel, index, delta);
    case 'tankFlow':
      return seriesValue(node.tankFlow, index, delta);
    default:
      return 0;
  }
}

export function getPipeEndpointValues(
  pipe: PipeSimulationResults,
  metric: PipeMetricId,
  options: { delta?: boolean } = {},
): { start: TimeSeries; end: TimeSeries } {
  let start: TimeSeries | undefined;
  let end: TimeSeries | undefined;
  switch (metric) {
    case 'head':
      start = pipe.startHead;
      end = pipe.endHead;
      break;
    case 'velocity':
      start = pipe.startVelocity;
      end = pipe.endVelocity;
      break;
    case 'flowrate':
      start = pipe.startFlow;
      end = pipe.endFlow;
      break;
    default:
      start = EMPTY_SERIES;
      end = EMPTY_SERIES;
      break;
  }
  const delta = !!options.delta;
  return {
    start: applyDelta(start, delta),
    end: applyDelta(end, delta),
  };
}

export function getPipeAverageAt(
  pipe: PipeSimulationResults,
  metric: PipeMetricId,
  index: number,
  options: { delta?: boolean } = {},
): number {
  const delta = !!options.delta;
  let start: TimeSeries | undefined;
  let end: TimeSeries | undefined;
  switch (metric) {
    case 'head':
      start = pipe.startHead;
      end = pipe.endHead;
      break;
    case 'velocity':
      start = pipe.startVelocity;
      end = pipe.endVelocity;
      break;
    case 'flowrate':
      start = pipe.startFlow;
      end = pipe.endFlow;
      break;
  }
  return (seriesValue(start, index, delta) + seriesValue(end, index, delta)) / 2;
}

export function metricDef(kind: PlotKind, id: PlotMetricId): PlotMetricDef | undefined {
  const list = kind === 'node' ? NODE_METRICS : PIPE_METRICS;
  return list.find((m) => m.id === id);
}

export const ANIMATION_METRIC_OPTIONS: { id: AnimationMetricId; label: string }[] = [
  { id: 'headChange', label: 'Head change (m)' },
  { id: 'pressure', label: 'Pressure (m)' },
  { id: 'velocity', label: 'Velocity (m/s)' },
  { id: 'flowrate', label: 'Flowrate (m³/s)' },
  { id: 'demandDischarge', label: 'Demand discharge (m³/s)' },
  { id: 'emitterDischarge', label: 'Emitter discharge (m³/s)' },
];

export type AnimationMetricId =
  | 'headChange'
  | 'pressure'
  | 'velocity'
  | 'flowrate'
  | 'demandDischarge'
  | 'emitterDischarge';

export function animationMetricLabel(id: AnimationMetricId): string {
  return ANIMATION_METRIC_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function yDomainFromValues(values: ArrayLike<number>): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

export function yDomainFromChartData(rows: Record<string, number>[]): [number, number] {
  const values: number[] = [];
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (key === 'time') continue;
      if (typeof value === 'number') values.push(value);
    }
  }
  return yDomainFromValues(values);
}

