import { useState } from 'react';
import { useNetworkStore } from '@/store';
import { useUIStore } from '@/store';
import { useSimulationStore } from '@/store';
import { Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TransientEvent, ValveEvent, PumpEvent, BurstEvent, DemandPulseEvent, SurgeTankEvent } from '@/types';

export function EventsPanel() {
  const events = useSimulationStore((s) => s.events);
  const addEvent = useSimulationStore((s) => s.addEvent);
  const removeEvent = useSimulationStore((s) => s.removeEvent);
  const network = useNetworkStore((s) => s.network);
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectedElementType = useUIStore((s) => s.selectedElementType);
  const [showForm, setShowForm] = useState(false);

  const canAddEvent =
    selectedElementId &&
    (selectedElementType === 'valve' ||
      selectedElementType === 'pump' ||
      selectedElementType === 'junction');

  const getElementName = (id: string) => {
    if (!network) return id;
    return network.nodes.get(id)?.name ?? network.links.get(id)?.name ?? id;
  };

  const handleAddEvent = (event: TransientEvent) => {
    addEvent(event);
    setShowForm(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Transient Events ({events.length})
        </h3>
        {canAddEvent && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5" />
            Add Event
          </Button>
        )}
      </div>

      {events.length === 0 && !showForm && (
        <div className="text-center py-8">
          <Zap className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No events configured</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Select a valve, pump, or junction on the map to add a transient event
          </p>
        </div>
      )}

      {showForm && selectedElementId && selectedElementType && (
        <EventForm
          elementId={selectedElementId}
          elementName={getElementName(selectedElementId)}
          elementType={selectedElementType}
          onSubmit={handleAddEvent}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Event list */}
      <div className="space-y-2">
        {events.map((event) => (
          <Card key={event.id} className="py-3 gap-0">
            <CardContent className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">
                  {formatEventType(event.type)}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.elementName} • starts at {event.ts ?? 0}s
                </p>
              </div>
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => removeEvent(event.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatEventType(type: string): string {
  return type.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

interface EventFormProps {
  elementId: string;
  elementName: string;
  elementType: string;
  onSubmit: (event: TransientEvent) => void;
  onCancel: () => void;
}

function EventForm({ elementId, elementName, elementType, onSubmit, onCancel }: EventFormProps) {
  const [eventType, setEventType] = useState<string>(() => {
    if (elementType === 'valve') return 'valve-closure';
    if (elementType === 'pump') return 'pump-shutdown';
    return 'burst';
  });

  const [tc, setTc] = useState(1);
  const [ts, setTs] = useState(1);
  const [se, setSe] = useState(0);
  const [m, setM] = useState(1);
  const [finalBurstCoeff, setFinalBurstCoeff] = useState(0.01);
  const [tp, setTp] = useState(0.2);
  const [dp, setDp] = useState(1);
  const [tankType, setTankType] = useState<'open' | 'closed'>('open');
  const [area, setArea] = useState(10);
  const [height, setHeight] = useState(10);
  const [waterLevel, setWaterLevel] = useState(5);

  const handleSubmit = () => {
    const base = {
      id: crypto.randomUUID(),
      elementId,
      elementName,
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
    onSubmit(event);
  };

  const availableTypes = (() => {
    if (elementType === 'valve') return ['valve-closure', 'valve-opening'];
    if (elementType === 'pump') return ['pump-shutdown', 'pump-startup'];
    return ['burst', 'demand-pulse', 'surge-tank'];
  })();

  return (
    <Card className="py-3 gap-3">
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Add event to <span className="text-primary font-semibold">{elementName}</span>
        </p>

        {/* Event type selector */}
        <div className="space-y-1.5">
          <Label className="text-xs">Event Type</Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map((t) => (
                <SelectItem key={t} value={t}>{formatEventType(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fields based on event type */}
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
                <SelectTrigger>
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

        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={handleSubmit}>
            Add Event
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  label, value, onChange, step = 1,
}: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-sm"
      />
    </div>
  );
}
