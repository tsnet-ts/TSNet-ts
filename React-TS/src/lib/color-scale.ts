import type { NetworkData, SimulationResults } from '@/types';
import type { AnimationMetric } from '@/store';
import {
  getNodeValueAt,
  getPipeAverageAt,
  nodeElevation,
} from '@/lib/result-metrics';

/**
 * Interpolate between two RGB colors.
 */
function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const BLUE: [number, number, number] = [37, 99, 235];
const CENTER: [number, number, number] = [250, 204, 21];
const RED: [number, number, number] = [220, 38, 38];
const CENTER_HEX = rgbToHex(CENTER);

export function valueToColor(value: number, min: number, max: number): string {
  if (max === min) return CENTER_HEX;
  let t = (value - min) / (max - min);
  const centered = t * 2 - 1;
  const scaled = Math.sign(centered) * Math.sqrt(Math.abs(centered));
  t = (scaled + 1) / 2;

  if (t <= 0.5) {
    return rgbToHex(lerpColor(BLUE, CENTER, t * 2));
  }
  return rgbToHex(lerpColor(CENTER, RED, (t - 0.5) * 2));
}

export interface ColorRange {
  min: number;
  max: number;
}

function pipePressureAverage(
  results: SimulationResults,
  network: NetworkData | null | undefined,
  pipeId: string,
  index: number,
): number | null {
  const pipe = results.pipes[pipeId];
  if (!pipe) return null;
  const link = network?.links.get(pipeId);
  if (!link) {
    return ((pipe.startHead[index] ?? 0) + (pipe.endHead[index] ?? 0)) / 2;
  }
  const startElev = nodeElevation(network, link.startNodeId);
  const endElev = nodeElevation(network, link.endNodeId);
  const start = (pipe.startHead[index] ?? 0) - startElev;
  const end = (pipe.endHead[index] ?? 0) - endElev;
  return (start + end) / 2;
}

function elementValue(
  results: SimulationResults,
  network: NetworkData | null | undefined,
  id: string,
  kind: 'node' | 'pipe',
  metric: AnimationMetric,
  index: number,
): number | null {
  if (kind === 'node') {
    const node = results.nodes[id];
    if (!node) return null;
    switch (metric) {
      case 'headChange':
        return getNodeValueAt(node, 'head', index, { delta: true });
      case 'pressure':
        return getNodeValueAt(node, 'pressure', index, { elevation: nodeElevation(network, id) });
      case 'demandDischarge':
        return getNodeValueAt(node, 'demandDischarge', index);
      case 'emitterDischarge':
        return getNodeValueAt(node, 'emitterDischarge', index);
      case 'velocity':
      case 'flowrate':
        return null;
    }
  }

  const pipe = results.pipes[id];
  if (!pipe) return null;
  switch (metric) {
    case 'headChange':
      return getPipeAverageAt(pipe, 'head', index, { delta: true });
    case 'pressure':
      return pipePressureAverage(results, network, id, index);
    case 'velocity':
      return getPipeAverageAt(pipe, 'velocity', index);
    case 'flowrate':
      return getPipeAverageAt(pipe, 'flowrate', index);
    case 'demandDischarge':
    case 'emitterDischarge':
      return null;
  }
}

export function computeColorRange(
  results: SimulationResults,
  metric: AnimationMetric,
  network?: NetworkData | null,
): ColorRange {
  let min = Infinity;
  let max = -Infinity;
  const n = results.time.length;

  const consider = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return;
    min = Math.min(min, value);
    max = Math.max(max, value);
  };

  for (const nodeId of Object.keys(results.nodes)) {
    for (let i = 0; i < n; i++) {
      consider(elementValue(results, network, nodeId, 'node', metric, i));
    }
  }
  for (const pipeId of Object.keys(results.pipes)) {
    for (let i = 0; i < n; i++) {
      consider(elementValue(results, network, pipeId, 'pipe', metric, i));
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: -1, max: 1 };
  }

  if (metric === 'headChange') {
    const absMax = Math.max(Math.abs(min), Math.abs(max));
    return { min: -absMax, max: absMax };
  }

  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    return { min: min - pad, max: max + pad };
  }

  return { min, max };
}

export function buildColorMap(
  results: SimulationResults,
  metric: AnimationMetric,
  range: ColorRange,
  network?: NetworkData | null,
): Map<string, string[]> {
  const colorMap = new Map<string, string[]>();
  const { min, max } = range;
  const numSteps = results.time.length;

  const colorsFor = (id: string, kind: 'node' | 'pipe'): string[] => {
    const colors: string[] = new Array(numSteps);
    for (let i = 0; i < numSteps; i++) {
      const value = elementValue(results, network, id, kind, metric, i);
      colors[i] = value == null ? CENTER_HEX : valueToColor(value, min, max);
    }
    return colors;
  };

  for (const nodeId of Object.keys(results.nodes)) {
    colorMap.set(nodeId, colorsFor(nodeId, 'node'));
  }
  for (const pipeId of Object.keys(results.pipes)) {
    colorMap.set(pipeId, colorsFor(pipeId, 'pipe'));
  }

  return colorMap;
}
