import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store';
import { useUIStore } from '@/store';
import type { PlottedElement } from '@/store';
import { useNetworkStore } from '@/store';
import { pickRandomJunctionWithResults } from '@/lib/pick-random-junction';
import {
  getNodeValues,
  getPipeEndpointValues,
  isLinkPlotType,
  isNodePlotType,
  metricDef,
  metricsForPlotted,
  nodeElevation,
  yDomainFromChartData,
  type NodeMetricId,
  type PipeMetricId,
  type PlotKind,
  type PlotMetricId,
} from '@/lib/result-metrics';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#4f46e5', '#db2777',
  '#65a30d', '#0d9488', '#c026d3', '#d97706',
  '#1d4ed8', '#b91c1c', '#15803d', '#7e22ce',
];

const SEARCH_CAP = 12;

type ChartSearchCandidate = PlottedElement & {
  name: string;
  valveType?: string;
  pumpType?: string;
};

function matchesChartQuery(el: ChartSearchCandidate, q: string): boolean {
  return (
    el.id.toLowerCase().includes(q) ||
    el.name.toLowerCase().includes(q) ||
    el.type.toLowerCase().includes(q) ||
    (el.valveType?.toLowerCase().includes(q) ?? false) ||
    (el.pumpType?.toLowerCase().includes(q) ?? false)
  );
}

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

function seriesKey(el: PlottedElement, endpoint?: 'start' | 'end'): string {
  if (endpoint) return `${el.id} ${endpoint}`;
  return el.id;
}

export function ResultChart() {
  const results = useSimulationStore((s) => s.results);
  const status = useSimulationStore((s) => s.status);
  const network = useNetworkStore((s) => s.network);
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectedElementType = useUIStore((s) => s.selectedElementType);
  const plottedElements = useUIStore((s) => s.plottedElements);
  const selectElement = useUIStore((s) => s.selectElement);
  const addPlottedElement = useUIStore((s) => s.addPlottedElement);
  const removePlottedElement = useUIStore((s) => s.removePlottedElement);
  const setPlottedElements = useUIStore((s) => s.setPlottedElements);
  const [dismissed, setDismissed] = useState(false);
  const prevStatusRef = useRef(status);
  const [metric, setMetric] = useState<PlotMetricId>('head');
  const [delta, setDelta] = useState(true);
  const [size, setSize] = useState({ width: 420, height: 260 });
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: size.width, startH: size.height };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dw = dragRef.current.startX - ev.clientX;
      const dh = dragRef.current.startY - ev.clientY;
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

  useEffect(() => {
    if (prevStatusRef.current !== 'success' && status === 'success' && results && network) {
      const junction = pickRandomJunctionWithResults(network, results);
      if (junction) {
        selectElement(junction.id, junction.type);
        setPlottedElements([{ id: junction.id, type: junction.type }]);
      }
    }
    prevStatusRef.current = status;
  }, [status, results, network, selectElement, setPlottedElements]);

  useEffect(() => {
    if (status !== 'success' || plottedElements.length > 0) return;
    if (!selectedElementId || !selectedElementType) return;
    setPlottedElements([{ id: selectedElementId, type: selectedElementType }]);
  }, [status, plottedElements.length, selectedElementId, selectedElementType, setPlottedElements]);

  useEffect(() => {
    setDismissed(false);
  }, [plottedElements, selectedElementId, selectedElementType]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const candidates = useMemo(() => {
    if (!network) return [];
    const items: ChartSearchCandidate[] = [];
    for (const node of network.nodes.values()) {
      items.push({ id: node.id, type: node.type, name: node.name });
    }
    for (const link of network.links.values()) {
      items.push({
        id: link.id,
        type: link.type,
        name: link.name,
        valveType: link.valveType,
        pumpType: link.pumpType,
      });
    }
    return items;
  }, [network]);

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const plottedKeys = new Set(plottedElements.map((el) => `${el.type}:${el.id}`));
    return candidates
      .filter((el) => !plottedKeys.has(`${el.type}:${el.id}`))
      .filter((el) => (q ? matchesChartQuery(el, q) : true))
      .slice(0, SEARCH_CAP);
  }, [candidates, plottedElements, query]);

  const available = useMemo(
    () => (results ? metricsForPlotted(plottedElements, results) : []),
    [plottedElements, results],
  );

  useEffect(() => {
    if (available.length === 0) return;
    if (!available.some((m) => m.id === metric)) {
      setMetric(available[0].id);
    }
  }, [available, metric]);

  const plotKindForMetric: PlotKind = plottedElements.some((el) => isLinkPlotType(el.type)) &&
    !plottedElements.some((el) => isNodePlotType(el.type))
    ? 'pipe'
    : 'node';
  const plotMetric: PlotMetricId = available.some((m) => m.id === metric)
    ? metric
    : (available[0]?.id ?? 'head');
  const activeDef = metricDef(plotKindForMetric, plotMetric) ?? available[0];
  const useDelta = !!activeDef?.supportsDelta && delta;

  const { chartData, lines } = useMemo(() => {
    const empty = { chartData: [] as Record<string, number>[], lines: [] as { key: string; color: string }[] };
    if (!results || plottedElements.length === 0) return empty;

    const maxTime = results.time[results.time.length - 1] ?? 0;
    const unit = getTimeUnit(maxTime);
    const rows: Record<string, number>[] = new Array(results.time.length);
    for (let i = 0; i < results.time.length; i++) {
      rows[i] = { time: convertTime(results.time[i] ?? 0, unit) };
    }
    const nextLines: { key: string; color: string }[] = [];
    let colorIdx = 0;
    const pipeMetric: PipeMetricId =
      plotMetric === 'velocity' || plotMetric === 'flowrate' ? plotMetric : 'head';
    const nodeMetric: NodeMetricId =
      plotMetric === 'velocity' || plotMetric === 'flowrate' ? 'head' : plotMetric as NodeMetricId;

    for (const el of plottedElements) {
      if (isLinkPlotType(el.type)) {
        const pipe = results.pipes[el.id];
        if (!pipe) continue;
        const { start, end } = getPipeEndpointValues(pipe, pipeMetric, { delta: useDelta });
        const startVals = start ?? [];
        const endVals = end ?? [];
        const startKey = seriesKey(el, 'start');
        const endKey = seriesKey(el, 'end');
        nextLines.push({ key: startKey, color: COLORS[colorIdx++ % COLORS.length] });
        nextLines.push({ key: endKey, color: COLORS[colorIdx++ % COLORS.length] });
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          row[startKey] = startVals[i] ?? 0;
          row[endKey] = endVals[i] ?? 0;
        }
        continue;
      }
      const node = results.nodes[el.id];
      if (!node) continue;
      const values = getNodeValues(node, nodeMetric, {
        delta: useDelta,
        elevation: nodeElevation(network, el.id),
      }) ?? [];
      const key = seriesKey(el);
      nextLines.push({ key, color: COLORS[colorIdx++ % COLORS.length] });
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        row[key] = values[i] ?? 0;
      }
    }

    return { chartData: rows, lines: nextLines };
  }, [results, plottedElements, plotMetric, useDelta, network]);

  const yDomain = useMemo(() => yDomainFromChartData(chartData), [chartData]);

  if (!results || dismissed) return null;
  if (status !== 'success' && plottedElements.length === 0) return null;

  const maxTime = results.time[results.time.length - 1] ?? 0;
  const timeUnit = getTimeUnit(maxTime);
  const yLabel = useDelta && activeDef
    ? `${activeDef.label} change (${activeDef.units})`
    : (activeDef?.yAxisLabel ?? '');
  const chartWidth = Math.max(size.width, plottedElements.length > 1 ? 520 : size.width);
  const plotHeight = Math.max(140, size.height - (plottedElements.length > 0 ? 96 : 56));

  const addFromSearch = (el: PlottedElement) => {
    addPlottedElement(el);
    selectElement(el.id, el.type);
    setQuery('');
    setSearchOpen(false);
  };

  const removeChip = (el: PlottedElement) => {
    removePlottedElement(el);
    if (selectedElementId === el.id && selectedElementType === el.type) {
      const remaining = plottedElements.filter((e) => !(e.id === el.id && e.type === el.type));
      const last = remaining[remaining.length - 1];
      selectElement(last?.id ?? null, last?.type ?? null);
    }
  };

  return (
    <div
      className="absolute bottom-4 right-4 z-[1000] bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border flex flex-col"
      style={{ width: chartWidth, height: size.height }}
    >
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 flex items-center justify-center"
        title="Drag to resize"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" className="text-muted-foreground/50">
          <path d="M0 8L8 0M0 5L5 0M0 2L2 0" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
        <div ref={searchRef} className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Add element…"
            className="h-7 pl-7 text-[11px]"
            aria-label="Add element to plot"
          />
          {searchOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 z-[2000] max-h-40 overflow-auto rounded-md border bg-popover shadow-md">
              {searchMatches.length === 0 ? (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">No matching elements</p>
              ) : (
                searchMatches.map((el) => (
                  <button
                    key={`${el.type}-${el.id}`}
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] hover:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addFromSearch(el)}
                  >
                    <span className="font-medium truncate">{el.id}</span>
                    <span className="ml-auto text-[10px] uppercase text-muted-foreground">{el.type}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {available.length > 0 && (
            <Select value={plotMetric} onValueChange={(v) => setMetric(v as PlotMetricId)}>
              <SelectTrigger className="h-7 w-[11rem] px-2 text-[10px] shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="z-[2000]"
                side="top"
                sideOffset={4}
                avoidCollisions={false}
              >
                {available.map((m) => (
                  <SelectItem key={`${plotKindForMetric}-${m.id}`} value={m.id} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeDef?.supportsDelta && (
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={delta}
                onChange={(e) => setDelta(e.target.checked)}
                className="rounded border-input size-3"
              />
              Δ t₀
            </label>
          )}
          <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {plottedElements.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-1">
          {plottedElements.map((el) => (
            <span
              key={`${el.type}-${el.id}`}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px]"
            >
              <span className="font-medium truncate max-w-[7rem]">{el.id}</span>
              <span className="uppercase text-muted-foreground">{el.type}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${el.id}`}
                onClick={() => removeChip(el)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="px-2 pb-3 min-w-0 w-full" style={{ height: plotHeight }}>
        {lines.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-2 py-6 text-center">Add a node or pipe to plot</p>
        ) : (
          <ResponsiveContainer width="100%" height={plotHeight} minWidth={0} minHeight={140}>
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
                domain={yDomain}
                allowDataOverflow
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => Number(v.toPrecision(4)).toString()}
                label={{
                  value: yLabel,
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
                formatter={(value, name) => [Number(value).toFixed(4), name]}
              />
              {lines.length > 1 && (
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10, paddingBottom: 4 }} />
              )}
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
        )}
      </div>
    </div>
  );
}
