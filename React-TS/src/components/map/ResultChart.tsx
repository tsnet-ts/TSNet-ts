import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store';
import { useUIStore } from '@/store';
import { useNetworkStore } from '@/store';
import { pickRandomJunctionWithResults } from '@/lib/pick-random-junction';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { X } from 'lucide-react';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea'];

function getTimeUnit(maxTime: number): string {
  if (maxTime < 120) return 's';
  if (maxTime < 7200) return 'min';
  return 'h';
}

function convertTime(seconds: number, unit: string): number {
  if (unit === 'min') return seconds / 60;
  if (unit === 'h') return seconds / 3600;
  return seconds;
}

export function ResultChart() {
  const results = useSimulationStore((s) => s.results);
  const status = useSimulationStore((s) => s.status);
  const network = useNetworkStore((s) => s.network);
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectedElementType = useUIStore((s) => s.selectedElementType);
  const selectElement = useUIStore((s) => s.selectElement);
  const zoomToElement = useUIStore((s) => s.zoomToElement);
  const [dismissed, setDismissed] = useState(false);
  const prevStatusRef = useRef(status);
  const [metric, setMetric] = useState<'head' | 'velocity'>('head');
  const [size, setSize] = useState({ width: 420, height: 220 });
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: size.width, startH: size.height };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dw = dragRef.current.startX - ev.clientX; // drag left = wider
      const dh = dragRef.current.startY - ev.clientY; // drag up = taller
      setSize({
        width: Math.max(320, Math.min(900, dragRef.current.startW + dw)),
        height: Math.max(180, Math.min(600, dragRef.current.startH + dh)),
      });
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [size]);

  // After simulation succeeds, auto-show chart for a random junction
  useEffect(() => {
    if (prevStatusRef.current !== 'success' && status === 'success' && results && network) {
      const junction = pickRandomJunctionWithResults(network, results);
      if (junction) {
        selectElement(junction.id, junction.type);
        zoomToElement(junction.id);
      }
    }
    prevStatusRef.current = status;
  }, [status, results, network, selectElement, zoomToElement]);

  // Reset dismissed state when selection changes
  useEffect(() => {
    setDismissed(false);
  }, [selectedElementId]);

  const elementData = useMemo(() => {
    if (!results || !selectedElementId) return null;

    // Check if it's a node
    const nodeData = results.nodes[selectedElementId];
    if (nodeData) return { kind: 'node' as const, data: nodeData };

    // Check if it's a pipe/link
    const pipeData = results.pipes[selectedElementId];
    if (pipeData) return { kind: 'pipe' as const, data: pipeData };

    return null;
  }, [results, selectedElementId]);

  // Whether velocity data is available for current element
  const hasVelocity = useMemo(() => {
    if (!elementData) return false;
    if (elementData.kind === 'node') return !!elementData.data.velocity;
    return true; // pipes always have velocity
  }, [elementData]);

  // Auto-fallback to head if velocity is not available
  useEffect(() => {
    if (!hasVelocity && metric === 'velocity') {
      setMetric('head');
    }
  }, [hasVelocity, metric]);

  const chartData = useMemo(() => {
    if (!results || !elementData) return [];

    const maxTime = results.time[results.time.length - 1] ?? 0;
    const unit = getTimeUnit(maxTime);

    if (elementData.kind === 'node') {
      const { data } = elementData;
      const h0 = data.head[0] ?? 0;
      return results.time.map((t, i) => ({
        time: convertTime(t, unit),
        'Head Change': data.head[i] - h0,
        ...(data.velocity ? { Velocity: data.velocity[i] } : {}),
      }));
    }

    // Pipe data
    const { data } = elementData;
    const sh0 = data.startHead[0] ?? 0;
    const eh0 = data.endHead[0] ?? 0;
    return results.time.map((t, i) => ({
      time: convertTime(t, unit),
      'Start Head Change': data.startHead[i] - sh0,
      'End Head Change': data.endHead[i] - eh0,
      'Start Velocity': data.startVelocity[i],
      'End Velocity': data.endVelocity[i],
    }));
  }, [results, elementData]) as Record<string, number>[];

  // Don't render if no results, no selection, dismissed, or no data
  if (!results || !selectedElementId || dismissed || !elementData || chartData.length === 0) {
    return null;
  }

  const elementName = selectedElementId;
  const elementType = selectedElementType ?? 'element';
  const maxTime = results.time[results.time.length - 1] ?? 0;
  const timeUnit = getTimeUnit(maxTime);

  // Determine which lines to render
  const lines: { key: string; color: string }[] = [];
  if (elementData.kind === 'node') {
    if (metric === 'head') {
      lines.push({ key: 'Head Change', color: COLORS[0] });
    } else if (elementData.data.velocity) {
      lines.push({ key: 'Velocity', color: COLORS[1] });
    }
  } else {
    if (metric === 'head') {
      lines.push({ key: 'Start Head Change', color: COLORS[0] });
      lines.push({ key: 'End Head Change', color: COLORS[1] });
    } else {
      lines.push({ key: 'Start Velocity', color: COLORS[2] });
      lines.push({ key: 'End Velocity', color: COLORS[3] });
    }
  }

  return (
    <div
      className="absolute bottom-4 right-4 z-[1000] bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border flex flex-col"
      style={{ width: size.width, height: size.height }}
    >
      {/* Resize handle — top-left corner */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 flex items-center justify-center"
        title="Drag to resize"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" className="text-muted-foreground/50">
          <path d="M0 8L8 0M0 5L5 0M0 2L2 0" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{elementName}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {elementType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Metric toggle — only show if both metrics available */}
          {hasVelocity && (
            <div className="flex gap-0.5 p-0.5 bg-muted rounded-md">
              <button
                onClick={() => setMetric('head')}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  metric === 'head' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Head
              </button>
              <button
                onClick={() => setMetric('velocity')}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  metric === 'velocity' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Velocity
              </button>
            </div>
          )}
          <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-3 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => Number(v.toPrecision(3)).toString()}
              label={{
                value: `Time (${timeUnit})`,
                position: 'bottom',
                offset: 0,
                fontSize: 10,
                style: { fill: 'hsl(var(--muted-foreground))' },
              }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => Number(v.toPrecision(4)).toString()}
              label={{
                value: metric === 'head' ? 'Head Change (m)' : 'Velocity (m/s)',
                angle: -90,
                position: 'left',
                offset: 0,
                fontSize: 10,
                style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' },
              }}
              width={60}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              labelFormatter={(v) => `t = ${Number(Number(v).toPrecision(4))} ${timeUnit}`}
              formatter={(value) => [Number(value).toFixed(4), undefined]}
            />
            {lines.length > 1 && <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10, paddingBottom: 4 }} />}
            {lines.map(({ key, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                animationDuration={300}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
