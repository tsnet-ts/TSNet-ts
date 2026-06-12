import { useMemo } from 'react';
import { useAnimationStore, useSimulationStore } from '@/store';
import { computeColorRange, valueToColor } from '@/lib/color-scale';

const LEGEND_HEIGHT = 200;
const LEGEND_WIDTH = 20;
const NUM_STOPS = 20;

export function ColorLegend() {
  const animationActive = useAnimationStore((s) => s.animationActive);
  const animationMetric = useAnimationStore((s) => s.animationMetric);
  const results = useSimulationStore((s) => s.results);

  const range = useMemo(() => {
    if (!results) return null;
    return computeColorRange(results, animationMetric);
  }, [results, animationMetric]);

  if (!animationActive || !range) return null;

  const { min, max } = range;

  // Generate gradient stops (top = max, bottom = min)
  const stops: string[] = [];
  for (let i = 0; i < NUM_STOPS; i++) {
    const t = 1 - i / (NUM_STOPS - 1); // top=1 → bottom=0
    const value = min + t * (max - min);
    stops.push(valueToColor(value, min, max));
  }

  const label = animationMetric === 'headChange' ? 'Head Change (m)' : 'Velocity (m/s)';

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-3 flex flex-col items-center select-none">
      <span className="text-[10px] font-medium text-gray-600 mb-1 whitespace-nowrap">{label}</span>

      {/* Max label */}
      <span className="text-[10px] text-gray-500 mb-0.5">+{max.toFixed(2)}</span>

      {/* Gradient bar with tick marks */}
      <div className="relative" style={{ width: LEGEND_WIDTH + 30, height: LEGEND_HEIGHT }}>
        <div
          style={{ width: LEGEND_WIDTH, height: LEGEND_HEIGHT }}
          className="rounded-sm overflow-hidden flex flex-col"
        >
          {stops.map((color, i) => (
            <div
              key={i}
              style={{
                backgroundColor: color,
                flex: 1,
              }}
            />
          ))}
        </div>

        {/* Tick marks at sqrt-spaced positions showing actual values */}
        {/* sqrt scale: position on bar corresponds to sqrt(|value/max|) */}
        {/* Show ticks at actual values: ±75%, ±50%, ±25% of max, and 0 */}
        {[0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75].map((frac) => {
          // Position: apply sqrt to get visual position
          // frac is in [-1, 1], visual position uses sqrt mapping
          const sqrtPos = Math.sign(frac) * Math.sqrt(Math.abs(frac));
          // Convert to % from top: sqrtPos=1 → 0%, sqrtPos=-1 → 100%
          const pct = (1 - sqrtPos) / 2 * 100;
          const actualValue = frac * max;
          return (
            <span
              key={frac}
              className="absolute text-[9px] text-gray-500 leading-none"
              style={{ top: `${pct}%`, left: LEGEND_WIDTH + 3, transform: 'translateY(-50%)' }}
            >
              {actualValue >= 0 ? '+' : ''}{actualValue.toFixed(2)}
            </span>
          );
        })}
      </div>

      {/* Min label */}
      <span className="text-[10px] text-gray-500 mt-0.5">{min.toFixed(2)}</span>
    </div>
  );
}
