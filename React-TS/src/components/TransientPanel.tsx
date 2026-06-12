import { useState, useMemo, useEffect, useRef } from 'react';
import { useNetworkStore } from '@/store';
import { useUIStore } from '@/store';
import { useSimulationStore } from '@/store';
import { Zap, ChevronRight, ChevronLeft, Plus, Trash2, MousePointerClick, Play, ArrowLeft, Settings, List, Pencil, Check, Download } from 'lucide-react';
import { downloadSimulationResults } from '@/lib/download-results';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { runSimulation } from '@/services/simulation';
import type { TransientEvent, ValveEvent, PumpEvent, BurstEvent, LeakEvent, DemandPulseEvent, SurgeTankEvent, NetworkData } from '@/types';

type Tab = 'add-event' | 'events' | 'settings';
type AddStep = 'element' | 'event-config';

export function TransientPanel() {
  const network = useNetworkStore((s) => s.network);
  const rawInpContent = useNetworkStore((s) => s.rawInpContent);
  const events = useSimulationStore((s) => s.events);
  const addEvent = useSimulationStore((s) => s.addEvent);
  const removeEvent = useSimulationStore((s) => s.removeEvent);
  const updateEvent = useSimulationStore((s) => s.updateEvent);
  const settings = useSimulationStore((s) => s.settings);
  const updateSettings = useSimulationStore((s) => s.updateSettings);
  const setStatus = useSimulationStore((s) => s.setStatus);
  const setProgress = useSimulationStore((s) => s.setProgress);
  const setResults = useSimulationStore((s) => s.setResults);
  const setError = useSimulationStore((s) => s.setError);
  const error = useSimulationStore((s) => s.error);
  const status = useSimulationStore((s) => s.status);
  const results = useSimulationStore((s) => s.results);
  const fileName = useNetworkStore((s) => s.fileName);
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectedElementType = useUIStore((s) => s.selectedElementType);
  const selectElement = useUIStore((s) => s.selectElement);
  const setSidebarMode = useUIStore((s) => s.setSidebarMode);
  const zoomToElement = useUIStore((s) => s.zoomToElement);

  const [tab, setTab] = useState<Tab>(() => events.length > 0 ? 'settings' : 'add-event');
  const [addStep, setAddStep] = useState<AddStep>('element');
  const [pickedElementId, setPickedElementId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<string>('valve-closure');
  const [isRunning, setIsRunning] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // When events are added externally (e.g. example presets), jump to run tab
  const prevEventsLenRef = useRef(events.length);
  useEffect(() => {
    if (events.length > 0 && prevEventsLenRef.current === 0) {
      setTab('settings');
    }
    prevEventsLenRef.current = events.length;
  }, [events.length]);

  // Event parameters
  const [tc, setTc] = useState(1);
  const [ts, setTs] = useState(1);
  const [se, setSe] = useState(0);
  const [m, setM] = useState(1);
  const [finalBurstCoeff, setFinalBurstCoeff] = useState(0.01);
  const [leakCoeff, setLeakCoeff] = useState(0.01);
  const [tp, setTp] = useState(0.2);
  const [dp, setDp] = useState(1);
  const [tankType, setTankType] = useState<'open' | 'closed'>('open');
  const [area, setArea] = useState(10);
  const [height, setHeight] = useState(10);
  const [waterLevel, setWaterLevel] = useState(5);

  const eventElements = useMemo(() => {
    if (!network) return [];
    const valves = [...network.links.values()].filter((l) => l.type === 'valve');
    const pumps = [...network.links.values()].filter((l) => l.type === 'pump');
    const junctions = [...network.nodes.values()].filter((n) => n.type === 'junction');
    return [
      ...valves.map((v) => ({ id: v.id, name: v.name, type: 'valve' as const })),
      ...pumps.map((p) => ({ id: p.id, name: p.name, type: 'pump' as const })),
      ...junctions.map((j) => ({ id: j.id, name: j.name, type: 'junction' as const })),
    ];
  }, [network]);

  // Sync with map selection
  useEffect(() => {
    if (tab === 'add-event' && addStep === 'element' && selectedElementId && selectedElementType) {
      const isValid = selectedElementType === 'valve' || selectedElementType === 'pump' || selectedElementType === 'junction';
      if (isValid) {
        setPickedElementId(selectedElementId);
        const el = eventElements.find((e) => e.id === selectedElementId);
        if (el) {
          if (el.type === 'valve') setEventType('valve-closure');
          else if (el.type === 'pump') setEventType('pump-shutdown');
          else setEventType('burst');
        }
      }
    }
  }, [selectedElementId, selectedElementType, tab, addStep, eventElements]);

  const pickedElement = eventElements.find((e) => e.id === pickedElementId);

  const availableTypes = useMemo(() => {
    if (!pickedElement) return [];
    if (pickedElement.type === 'valve') return ['valve-closure', 'valve-opening'];
    if (pickedElement.type === 'pump') return ['pump-shutdown', 'pump-startup'];
    return ['burst', 'leak', 'demand-pulse', 'surge-tank'];
  }, [pickedElement]);

  const handleElementSelect = (id: string) => {
    setPickedElementId(id);
    const el = eventElements.find((e) => e.id === id);
    if (el) {
      selectElement(id, el.type);
      if (el.type === 'valve') setEventType('valve-closure');
      else if (el.type === 'pump') setEventType('pump-shutdown');
      else setEventType('burst');
    }
    zoomToElement(id);
  };

  const handleAddEvent = () => {
    if (!pickedElement) return;
    // Only one event per boundary element
    const existing = events.find((e) => e.elementId === pickedElement.id);
    if (existing) return;
    const base = {
      id: crypto.randomUUID(),
      elementId: pickedElement.id,
      elementName: pickedElement.name,
    };

    let event: TransientEvent;

    switch (eventType) {
      case 'valve-closure':
      case 'valve-opening':
        event = { ...base, type: eventType, tc, ts, se, m } as ValveEvent;
        break;
      case 'pump-shutdown':
      case 'pump-startup':
        event = { ...base, type: eventType, tc, ts, se, m } as PumpEvent;
        break;
      case 'burst':
        event = { ...base, type: 'burst', ts, tc, finalBurstCoeff } as BurstEvent;
        break;
      case 'leak':
        event = { ...base, type: 'leak', coeff: leakCoeff } as LeakEvent;
        break;
      case 'demand-pulse':
        event = { ...base, type: 'demand-pulse', tc, ts, tp, dp } as DemandPulseEvent;
        break;
      case 'surge-tank':
        event = {
          ...base,
          type: 'surge-tank',
          tankType,
          area,
          height: tankType === 'closed' ? height : undefined,
          waterLevel: tankType === 'closed' ? waterLevel : undefined,
        } as SurgeTankEvent;
        break;
      default:
        return;
    }
    addEvent(event);
    setPickedElementId(null);
    setAddStep('element');
    setTab('events');
  };

  const handleRunSimulation = async () => {
    if (!rawInpContent || events.length === 0) return;
    setIsRunning(true);
    setStatus('running');
    setProgress(0, 'Starting...');
    console.log('[TSNet Debug] Run Simulation clicked', { events, settings });
    try {
      const results = await runSimulation(rawInpContent, events, settings, (p, stage) => setProgress(p, stage));
      setResults(results);
      setSidebarMode('network');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      console.error('[TSNet Debug] Simulation failed:', err);
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  const tabs: { id: Tab; label: string; number?: number }[] = [
    { id: 'add-event', label: '1. Add Transient Event' },
    { id: 'events', label: '2. View Events', number: events.length },
    { id: 'settings', label: '3. Run' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <button
          onClick={() => setSidebarMode('network')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3" />
          Back to Network
        </button>
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Transient Analysis</h2>
        </div>

        {/* Tab navigation */}
        <div className="flex rounded-lg border bg-muted/50 p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-[11px] font-medium py-1.5 px-2 rounded-md transition-colors ${
                tab === t.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.number !== undefined && t.number > 0 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded">
                  {t.number}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Tab 1: Add Event */}
        {tab === 'add-event' && addStep === 'element' && (
          <>
            <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <MousePointerClick className="size-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                Click a valve, pump, or junction on the map to select it.
              </p>
            </div>

            {pickedElement && (
              <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 p-2.5">
                <span className="text-xs text-muted-foreground">Selected:</span>
                <span className="text-sm font-semibold text-primary">{pickedElement.name}</span>
                <span className="text-[11px] text-muted-foreground">({pickedElement.type})</span>
              </div>
            )}

            {pickedElement && events.some((e) => e.elementId === pickedElementId) && (
              <p className="text-xs text-destructive">This element already has an event assigned.</p>
            )}

            {/* Element list */}
            <div className="space-y-3">
              {(['valve', 'pump', 'junction'] as const).map((type) => {
                const items = eventElements.filter((e) => e.type === type);
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      {type === 'valve' ? 'Valves' : type === 'pump' ? 'Pumps' : 'Junctions'}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {items.slice(0, type === 'junction' ? 8 : undefined).map((el) => (
                        <button
                          key={el.id}
                          onClick={() => handleElementSelect(el.id)}
                          className={`text-left text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                            pickedElementId === el.id
                              ? 'border-primary bg-primary/5 font-medium'
                              : events.some((e) => e.elementId === el.id)
                                ? 'border-border bg-muted/50 text-muted-foreground'
                                : 'border-border hover:border-primary/40'
                          }`}
                        >
                          {el.name}
                          {events.some((e) => e.elementId === el.id) && (
                            <span className="ml-1 text-[9px] text-muted-foreground">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                    {type === 'junction' && items.length > 8 && (
                      <Select onValueChange={handleElementSelect}>
                        <SelectTrigger className="mt-1.5 h-8 text-xs">
                          <SelectValue placeholder={`All junctions (${items.length})`} />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((el) => (
                            <SelectItem key={el.id} value={el.id}>{el.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'add-event' && addStep === 'event-config' && pickedElement && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Element:</span>
              <span className="font-medium">{pickedElement.name}</span>
              <span className="text-[11px] text-muted-foreground">({pickedElement.type})</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((t) => (
                    <SelectItem key={t} value={t}>{formatEventType(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(eventType === 'valve-closure' || eventType === 'valve-opening' ||
              eventType === 'pump-shutdown' || eventType === 'pump-startup') && (
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Start Time (s)" value={ts} onChange={setTs} />
                <NumberField label="Duration (s)" value={tc} onChange={setTc} />
                <NumberField label="End Open %" value={se} onChange={setSe} step={0.1} />
                <NumberField label="Constant (m)" value={m} onChange={setM} step={0.5} />
              </div>
            )}

            {eventType === 'burst' && (
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Start Time (s)" value={ts} onChange={setTs} />
                <NumberField label="Dev. Time (s)" value={tc} onChange={setTc} />
                <NumberField label="Burst Coeff" value={finalBurstCoeff} onChange={setFinalBurstCoeff} step={0.001} />
              </div>
            )}

            {eventType === 'leak' && (
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Leak Coeff" value={leakCoeff} onChange={setLeakCoeff} step={0.001} />
              </div>
            )}

            {eventType === 'demand-pulse' && (
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Start Time (s)" value={ts} onChange={setTs} />
                <NumberField label="Duration (s)" value={tc} onChange={setTc} />
                <NumberField label="Trans. Time (s)" value={tp} onChange={setTp} step={0.1} />
                <NumberField label="Peak Amplitude" value={dp} onChange={setDp} step={0.1} />
              </div>
            )}

            {eventType === 'surge-tank' && (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tank Type</Label>
                  <Select value={tankType} onValueChange={(v) => setTankType(v as 'open' | 'closed')}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed (Air Chamber)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="Area (m²)" value={area} onChange={setArea} />
                  {tankType === 'closed' && (
                    <>
                      <NumberField label="Height (m)" value={height} onChange={setHeight} />
                      <NumberField label="Water Level (m)" value={waterLevel} onChange={setWaterLevel} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Existing Events */}
        {tab === 'events' && (
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <List className="size-8 text-muted-foreground/50 mx-auto" />
                <p className="text-xs text-muted-foreground">No events configured yet.</p>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setTab('add-event')}>
                  <Plus className="size-3" />
                  Add Event
                </Button>
              </div>
            ) : (
              <>
                {events.map((event) => (
                  <Card key={event.id} className="py-2 gap-0">
                    <CardContent className="px-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium">{formatEventType(event.type)}</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {event.elementName} • {event.type !== 'surge-tank' ? `t=${(event as any).ts ?? 0}s` : 'surge tank'}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-primary"
                            onClick={() => setEditingEventId(editingEventId === event.id ? null : event.id)}
                          >
                            {editingEventId === event.id ? <Check className="size-3" /> : <Pencil className="size-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            onClick={() => { removeEvent(event.id); if (editingEventId === event.id) setEditingEventId(null); }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>

                      {editingEventId === event.id && (
                        <EventEditForm event={event} updateEvent={updateEvent} />
                      )}
                    </CardContent>
                  </Card>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => { setTab('add-event'); setAddStep('element'); setPickedElementId(null); }}
                >
                  <Plus className="size-3" />
                  Add Another Event
                </Button>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Settings & Run */}
        {tab === 'settings' && (
          <div className="space-y-4">
            {/* Quick summary of configured events */}
            {events.length > 0 && (
              <div className="rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 p-3 space-y-1.5">
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Ready to simulate</p>
                <div className="flex flex-wrap gap-1.5">
                  {events.map((evt) => (
                    <span key={evt.id} className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      {formatEventType(evt.type)} @ {evt.elementName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-medium">Simulation Settings</p>
              </div>

              <NumberField
                label="Wave Speed (m/s)"
                value={settings.wavespeed}
                onChange={(v) => updateSettings({ wavespeed: v })}
              />
              <NumberField
                label="Simulation Period (s)"
                value={settings.simulationPeriod}
                onChange={(v) => updateSettings({ simulationPeriod: v })}
              />

              <DtField
                network={network}
                wavespeed={settings.wavespeed}
                dt={settings.dt}
                onChange={(v) => updateSettings({ dt: v })}
              />

              <div className="space-y-1.5">
                <Label className="text-[11px]">Friction Model</Label>
                <Select
                  value={settings.frictionModel}
                  onValueChange={(v) => updateSettings({ frictionModel: v as any })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steady">Steady</SelectItem>
                    <SelectItem value="quasi-steady">Quasi-Steady</SelectItem>
                    <SelectItem value="unsteady">Unsteady</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {events.length === 0 && (
              <p className="text-xs text-muted-foreground border border-dashed rounded-md p-2.5 text-center">
                Add at least one event before running.
              </p>
            )}

            {status === 'error' && error && (
              <Card className="border-destructive/30 bg-destructive/5 py-0 gap-0">
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-destructive">Simulation failed</p>
                  <pre className="text-[10px] text-destructive/90 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-40 overflow-y-auto">
                    {error}
                  </pre>
                  <p className="text-[10px] text-muted-foreground">
                    Open the browser console (F12) and filter by <code className="font-mono">TSNet Debug</code> for the full stage log.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t space-y-2">
        {tab === 'add-event' && addStep === 'element' && (
          <div className="flex gap-2">
            <div className="flex-1" />
            <Button
              size="sm"
              disabled={!pickedElementId || events.some((e) => e.elementId === pickedElementId)}
              onClick={() => setAddStep('event-config')}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}

        {tab === 'add-event' && addStep === 'event-config' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddStep('element')}>
              <ChevronLeft className="size-3.5" />
              Back
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={handleAddEvent}>
              Add Event
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}

        {tab === 'events' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTab('add-event')}>
              <ChevronLeft className="size-3.5" />
              Add Event
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={() => setTab('settings')} disabled={events.length === 0}>
              Settings & Run
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-2">
            {status === 'success' && results && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => downloadSimulationResults(results, fileName ?? undefined)}
              >
                <Download className="size-3.5" />
                Download Results (JSON)
              </Button>
            )}
            <Button
              className="w-full gap-1.5"
              onClick={handleRunSimulation}
              disabled={events.length === 0 || isRunning}
            >
              <Play className="size-3.5" />
              {isRunning ? 'Running...' : 'Run Simulation'}
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setTab('events')}>
              <ChevronLeft className="size-3.5" />
              Back to Events
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatEventType(type: string): string {
  return type.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function NumberField({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const num = parseFloat(draft);
    if (!isNaN(num)) {
      onChange(num);
      setDraft(String(num));
    } else {
      setDraft(String(value));
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        className="h-7 text-xs"
      />
    </div>
  );
}

function DtField({
  network,
  wavespeed,
  dt,
  onChange,
}: {
  network: NetworkData | null;
  wavespeed: number;
  dt: number | null;
  onChange: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(dt !== null ? String(dt) : '');

  useEffect(() => {
    setDraft(dt !== null ? String(dt) : '');
  }, [dt]);

  const maxDt = useMemo(() => {
    if (!network) return null;
    let minDt = Infinity;
    for (const link of network.links.values()) {
      if (link.type === 'pipe' && link.length && link.length > 0) {
        const pipeDt = link.length / (2 * wavespeed);
        if (pipeDt < minDt) minDt = pipeDt;
      }
    }
    return minDt === Infinity ? null : minDt;
  }, [network, wavespeed]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      onChange(null);
    } else {
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num > 0) {
        onChange(num);
      } else {
        // Reset to previous valid value
        setDraft(dt !== null ? String(dt) : '');
      }
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-[11px]">Time Step, dt (s)</Label>
      <Input
        type="text"
        inputMode="decimal"
        placeholder={maxDt ? `Auto: ${maxDt.toFixed(5)}` : 'Auto'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        className="h-7 text-xs"
      />
      {maxDt && (
        <p className="text-[10px] text-muted-foreground">
          Max: {maxDt.toFixed(5)} s
          {dt !== null && dt > maxDt && (
            <span className="text-destructive font-medium ml-1">(exceeds limit)</span>
          )}
        </p>
      )}
    </div>
  );
}

function EventEditForm({
  event,
  updateEvent,
}: {
  event: TransientEvent;
  updateEvent: (id: string, updates: Partial<TransientEvent>) => void;
}) {
  const type = event.type;

  if (type === 'valve-closure' || type === 'valve-opening' || type === 'pump-shutdown' || type === 'pump-startup') {
    const e = event as ValveEvent | PumpEvent;
    return (
      <div className="grid grid-cols-2 gap-2 pt-1 border-t">
        <NumberField label="Start Time (s)" value={e.ts} onChange={(v) => updateEvent(event.id, { ts: v } as any)} />
        <NumberField label="Duration (s)" value={e.tc} onChange={(v) => updateEvent(event.id, { tc: v } as any)} />
        <NumberField label="End Open %" value={e.se} onChange={(v) => updateEvent(event.id, { se: v } as any)} step={0.1} />
        <NumberField label="Constant (m)" value={e.m} onChange={(v) => updateEvent(event.id, { m: v } as any)} step={0.5} />
      </div>
    );
  }

  if (type === 'burst') {
    const e = event as BurstEvent;
    return (
      <div className="grid grid-cols-2 gap-2 pt-1 border-t">
        <NumberField label="Start Time (s)" value={e.ts} onChange={(v) => updateEvent(event.id, { ts: v } as any)} />
        <NumberField label="Dev. Time (s)" value={e.tc} onChange={(v) => updateEvent(event.id, { tc: v } as any)} />
        <NumberField label="Burst Coeff" value={e.finalBurstCoeff} onChange={(v) => updateEvent(event.id, { finalBurstCoeff: v } as any)} step={0.001} />
      </div>
    );
  }

  if (type === 'leak') {
    const e = event as LeakEvent;
    return (
      <div className="grid grid-cols-2 gap-2 pt-1 border-t">
        <NumberField label="Leak Coeff" value={e.coeff} onChange={(v) => updateEvent(event.id, { coeff: v } as any)} step={0.001} />
      </div>
    );
  }

  if (type === 'demand-pulse') {
    const e = event as DemandPulseEvent;
    return (
      <div className="grid grid-cols-2 gap-2 pt-1 border-t">
        <NumberField label="Start Time (s)" value={e.ts} onChange={(v) => updateEvent(event.id, { ts: v } as any)} />
        <NumberField label="Duration (s)" value={e.tc} onChange={(v) => updateEvent(event.id, { tc: v } as any)} />
        <NumberField label="Trans. Time (s)" value={e.tp} onChange={(v) => updateEvent(event.id, { tp: v } as any)} step={0.1} />
        <NumberField label="Peak Amplitude" value={e.dp} onChange={(v) => updateEvent(event.id, { dp: v } as any)} step={0.1} />
      </div>
    );
  }

  if (type === 'surge-tank') {
    const e = event as SurgeTankEvent;
    return (
      <div className="grid grid-cols-2 gap-2 pt-1 border-t">
        <NumberField label="Area (m²)" value={e.area} onChange={(v) => updateEvent(event.id, { area: v } as any)} />
        {e.tankType === 'closed' && (
          <>
            <NumberField label="Height (m)" value={e.height ?? 0} onChange={(v) => updateEvent(event.id, { height: v } as any)} />
            <NumberField label="Water Level (m)" value={e.waterLevel ?? 0} onChange={(v) => updateEvent(event.id, { waterLevel: v } as any)} />
          </>
        )}
      </div>
    );
  }

  return null;
}
