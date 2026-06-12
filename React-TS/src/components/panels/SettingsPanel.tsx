import { useMemo } from 'react';
import { useSimulationStore } from '@/store';
import { useNetworkStore } from '@/store';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FrictionModel } from '@/types';

export function SettingsPanel() {
  const settings = useSimulationStore((s) => s.settings);
  const updateSettings = useSimulationStore((s) => s.updateSettings);
  const status = useSimulationStore((s) => s.status);
  const progress = useSimulationStore((s) => s.progress);
  const events = useSimulationStore((s) => s.events);
  const network = useNetworkStore((s) => s.network);
  const setStatus = useSimulationStore((s) => s.setStatus);
  const setProgress = useSimulationStore((s) => s.setProgress);
  const setResults = useSimulationStore((s) => s.setResults);
  const setError = useSimulationStore((s) => s.setError);
  const rawInpContent = useNetworkStore((s) => s.rawInpContent);

  const progressStage = useSimulationStore((s) => s.progressStage);

  // Compute max allowed dt from pipe lengths and wavespeed (CFL condition)
  const maxDt = useMemo(() => {
    if (!network) return null;
    let minDt = Infinity;
    for (const link of network.links.values()) {
      if (link.type === 'pipe' && link.length && link.length > 0) {
        const dt = link.length / (2 * settings.wavespeed);
        if (dt < minDt) minDt = dt;
      }
    }
    return minDt === Infinity ? null : minDt;
  }, [network, settings.wavespeed]);

  const canRun = network && events.length > 0 && status !== 'running';

  const handleRun = async () => {
    if (!rawInpContent || !network) return;

    setStatus('running');
    setProgress(0);

    try {
      const { runSimulation } = await import('@/services/simulation');
      const results = await runSimulation(rawInpContent, events, settings, (p, stage) => {
        setProgress(p, stage);
      });
      setResults(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    }
  };

  return (
    <div className="p-4 space-y-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Simulation Settings
      </h3>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Wave Speed (m/s)</Label>
          <Input
            type="number"
            value={settings.wavespeed}
            onChange={(e) => updateSettings({ wavespeed: parseFloat(e.target.value) || 1200 })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Simulation Period (s)</Label>
          <Input
            type="number"
            value={settings.simulationPeriod}
            onChange={(e) => updateSettings({ simulationPeriod: parseFloat(e.target.value) || 20 })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Time Step, dt (s)</Label>
          <Input
            type="number"
            step="any"
            placeholder={maxDt ? `Auto: ${maxDt.toFixed(5)}` : 'Auto'}
            value={settings.dt ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              updateSettings({ dt: val === '' ? null : parseFloat(val) || null });
            }}
          />
          {maxDt && (
            <p className="text-xs text-muted-foreground">
              Max allowed: {maxDt.toFixed(5)} s
              {settings.dt !== null && settings.dt > maxDt && (
                <span className="text-destructive font-medium ml-1">
                  (exceeds max — will fail)
                </span>
              )}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Friction Model</Label>
          <Select value={settings.frictionModel} onValueChange={(v) => updateSettings({ frictionModel: v as FrictionModel })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="steady">Steady</SelectItem>
              <SelectItem value="quasi-steady">Quasi-Steady</SelectItem>
              <SelectItem value="unsteady">Unsteady</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {settings.frictionModel === 'steady' && 'Standard Darcy-Weisbach friction'}
            {settings.frictionModel === 'quasi-steady' && 'Accounts for velocity-dependent friction'}
            {settings.frictionModel === 'unsteady' && 'Includes instantaneous acceleration-based friction (most accurate)'}
          </p>
        </div>
      </div>

      {/* Run button */}
      <div className="pt-2">
        <Button
          onClick={handleRun}
          disabled={!canRun}
          className="w-full"
          size="lg"
        >
          <Play className="size-4" />
          {status === 'running' ? 'Running...' : 'Run Transient Simulation'}
        </Button>
        {!canRun && events.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Add at least one transient event to run
          </p>
        )}
      </div>

      {/* Progress */}
      {status === 'running' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progressStage || 'Starting...'}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}
    </div>
  );
}
