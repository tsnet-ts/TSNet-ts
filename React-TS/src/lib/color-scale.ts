import type { SimulationResults } from '@/types';
import type { AnimationMetric } from '@/store';

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

// Diverging: blue → yellow → red (always vivid, no grey/white)
const BLUE: [number, number, number] = [37, 99, 235];    // #2563eb
const CENTER: [number, number, number] = [250, 204, 21]; // #facc15 (yellow-400)
const RED: [number, number, number] = [220, 38, 38];     // #dc2626

/**
 * Map a value in [min, max] to a diverging blue-yellow-red hex color.
 * Uses sqrt scaling so small changes are more visible while preserving direction.
 * Center (0 for head change) maps to yellow.
 */
export function valueToColor(value: number, min: number, max: number): string {
  if (max === min) return rgbToHex(CENTER);
  // Normalize to [0, 1]
  let t = (value - min) / (max - min);
  // Apply sqrt scaling: preserves 0.5 as center, expands small deviations
  const centered = t * 2 - 1; // [-1, 1]
  const scaled = Math.sign(centered) * Math.sqrt(Math.abs(centered));
  t = (scaled + 1) / 2; // back to [0, 1]

  if (t <= 0.5) {
    // Blue → Yellow
    return rgbToHex(lerpColor(BLUE, CENTER, t * 2));
  } else {
    // Yellow → Red
    return rgbToHex(lerpColor(CENTER, RED, (t - 0.5) * 2));
  }
}

export interface ColorRange {
  min: number;
  max: number;
}

/**
 * Compute the symmetric color range for a given metric across all elements and time steps.
 */
export function computeColorRange(results: SimulationResults, metric: AnimationMetric): ColorRange {
  let absMax = 0;

  if (metric === 'headChange') {
    // Nodes: head change from initial
    for (const nodeData of Object.values(results.nodes)) {
      const initial = nodeData.head[0];
      for (let i = 1; i < nodeData.head.length; i++) {
        absMax = Math.max(absMax, Math.abs(nodeData.head[i] - initial));
      }
    }
    // Pipes: average of start/end head change from initial
    for (const pipeData of Object.values(results.pipes)) {
      const initStart = pipeData.startHead[0];
      const initEnd = pipeData.endHead[0];
      for (let i = 1; i < pipeData.startHead.length; i++) {
        const avg = ((pipeData.startHead[i] - initStart) + (pipeData.endHead[i] - initEnd)) / 2;
        absMax = Math.max(absMax, Math.abs(avg));
      }
    }
  } else {
    // velocity
    for (const nodeData of Object.values(results.nodes)) {
      if (!nodeData.velocity) continue;
      for (const v of nodeData.velocity) {
        absMax = Math.max(absMax, Math.abs(v));
      }
    }
    for (const pipeData of Object.values(results.pipes)) {
      for (let i = 0; i < pipeData.startVelocity.length; i++) {
        const avg = (pipeData.startVelocity[i] + pipeData.endVelocity[i]) / 2;
        absMax = Math.max(absMax, Math.abs(avg));
      }
    }
  }

  // Symmetric range centered at 0
  return { min: -absMax, max: absMax };
}

/**
 * Pre-compute all colors for every element at every time step.
 * Returns Map<elementId, hexColor[]>
 */
export function buildColorMap(
  results: SimulationResults,
  metric: AnimationMetric,
  range: ColorRange,
): Map<string, string[]> {
  const colorMap = new Map<string, string[]>();
  const { min, max } = range;
  const numSteps = results.time.length;

  if (metric === 'headChange') {
    for (const [nodeId, nodeData] of Object.entries(results.nodes)) {
      const initial = nodeData.head[0];
      const colors: string[] = new Array(numSteps);
      for (let i = 0; i < numSteps; i++) {
        colors[i] = valueToColor(nodeData.head[i] - initial, min, max);
      }
      colorMap.set(nodeId, colors);
    }
    for (const [pipeId, pipeData] of Object.entries(results.pipes)) {
      const initStart = pipeData.startHead[0];
      const initEnd = pipeData.endHead[0];
      const colors: string[] = new Array(numSteps);
      for (let i = 0; i < numSteps; i++) {
        const avg = ((pipeData.startHead[i] - initStart) + (pipeData.endHead[i] - initEnd)) / 2;
        colors[i] = valueToColor(avg, min, max);
      }
      colorMap.set(pipeId, colors);
    }
  } else {
    // velocity
    for (const [nodeId, nodeData] of Object.entries(results.nodes)) {
      const colors: string[] = new Array(numSteps);
      if (nodeData.velocity) {
        for (let i = 0; i < numSteps; i++) {
          colors[i] = valueToColor(nodeData.velocity[i], min, max);
        }
      } else {
        colors.fill(rgbToHex(CENTER));
      }
      colorMap.set(nodeId, colors);
    }
    for (const [pipeId, pipeData] of Object.entries(results.pipes)) {
      const colors: string[] = new Array(numSteps);
      for (let i = 0; i < numSteps; i++) {
        const avg = (pipeData.startVelocity[i] + pipeData.endVelocity[i]) / 2;
        colors[i] = valueToColor(avg, min, max);
      }
      colorMap.set(pipeId, colors);
    }
  }

  return colorMap;
}
