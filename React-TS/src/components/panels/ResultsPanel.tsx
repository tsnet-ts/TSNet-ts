import { useState, useMemo } from 'react';
import { useSimulationStore } from '@/store';
import { useNetworkStore } from '@/store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { downloadSimulationResults } from '@/lib/download-results';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

export function ResultsPanel() {
  const results = useSimulationStore((s) => s.results);
  const fileName = useNetworkStore((s) => s.fileName);
  const error = useSimulationStore((s) => s.error);
  const status = useSimulationStore((s) => s.status);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [metric, setMetric] = useState<'head' | 'velocity'>('head');

  const nodeNames = useMemo(() => {
    if (!results) return [];
    return Object.keys(results.nodes);
  }, [results]);

  const chartData = useMemo(() => {
    if (!results || selectedNodes.length === 0) return [];
    return results.time.map((t, i) => {
      const point: Record<string, number> = { time: t };
      for (const node of selectedNodes) {
        const data = results.nodes[node];
        if (data) {
          point[node] = metric === 'head' ? data.head[i] : (data.velocity?.[i] ?? 0);
        }
      }
      return point;
    });
  }, [results, selectedNodes, metric]);

  const handleExport = () => {
    if (!results) return;
    downloadSimulationResults(results, fileName ?? undefined);
  };

  if (status === 'error') {
    return (
      <div className="p-4">
        <Card className="border-destructive/20 bg-destructive/5 py-3 gap-2">
          <CardContent>
            <p className="text-sm font-medium text-destructive">Simulation Error</p>
            <p className="text-xs text-destructive/80 mt-1">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="p-4 text-center py-12">
        <BarChart3 className="size-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No results yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Configure events and run the simulation
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Simulation Results
        </h3>
        <Button variant="ghost" size="sm" onClick={handleExport}>
          <Download className="size-3.5" />
          Export
        </Button>
      </div>

      {/* Metric selector */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setMetric('head')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            metric === 'head' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Head (m)
        </button>
        <button
          onClick={() => setMetric('velocity')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            metric === 'velocity' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Velocity (m/s)
        </button>
      </div>

      {/* Node selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Select Nodes to Plot</Label>
        <div className="max-h-32 overflow-y-auto rounded-lg border p-2 space-y-0.5">
          {nodeNames.slice(0, 30).map((name) => (
            <label key={name} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent p-1.5 rounded-md transition-colors">
              <input
                type="checkbox"
                checked={selectedNodes.includes(name)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedNodes([...selectedNodes, name]);
                  } else {
                    setSelectedNodes(selectedNodes.filter((n) => n !== name));
                  }
                }}
                className="rounded border-input"
              />
              {name}
            </label>
          ))}
        </div>
      </div>

      {/* Chart */}
      {selectedNodes.length > 0 && chartData.length > 0 && (
        <Card className="py-3 gap-0">
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fontSize: 10 }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  label={{ value: metric === 'head' ? 'Head (m)' : 'Velocity (m/s)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: '0.5rem', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => [value.toFixed(2), metric]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {selectedNodes.map((node, i) => (
                  <Line
                    key={node}
                    type="monotone"
                    dataKey={node}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={1.5}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="py-3 gap-0 bg-muted/50">
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Time steps: {results.time.length} •
            Duration: {results.time[results.time.length - 1]?.toFixed(2)}s •
            Nodes recorded: {Object.keys(results.nodes).length}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
