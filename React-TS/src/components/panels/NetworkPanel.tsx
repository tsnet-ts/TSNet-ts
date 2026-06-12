import { useNetworkStore } from '@/store';
import { useUIStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getNetworkIcon } from '@/components/icons/network-elements';

export function NetworkPanel() {
  const network = useNetworkStore((s) => s.network);
  const fileName = useNetworkStore((s) => s.fileName);
  const selectedElementId = useUIStore((s) => s.selectedElementId);

  if (!network) return null;

  // Unit labels based on unit system
  const isUS = network.unitSystem === 'US';
  const units = {
    elevation: isUS ? 'ft' : 'm',
    length: isUS ? 'ft' : 'm',
    diameter: isUS ? 'in' : 'mm',
    demand: network.flowUnitsLabel,
    volume: isUS ? 'ft³' : 'm³',
    power: isUS ? 'hp' : 'kW',
    head: isUS ? 'ft' : 'm',
    level: isUS ? 'ft' : 'm',
  };

  const junctions = [...network.nodes.values()].filter((n) => n.type === 'junction');
  const reservoirs = [...network.nodes.values()].filter((n) => n.type === 'reservoir');
  const tanks = [...network.nodes.values()].filter((n) => n.type === 'tank');
  const pipes = [...network.links.values()].filter((l) => l.type === 'pipe');
  const valves = [...network.links.values()].filter((l) => l.type === 'valve');
  const pumps = [...network.links.values()].filter((l) => l.type === 'pump');

  const selectedNode = selectedElementId ? network.nodes.get(selectedElementId) : null;
  const selectedLink = selectedElementId ? network.links.get(selectedElementId) : null;

  return (
    <div className="p-4 space-y-4">
      {/* File info */}
      <Card className="py-3 gap-2">
        <CardContent className="text-sm">
          <p className="text-xs text-muted-foreground mb-1">Loaded file</p>
          <p className="font-medium truncate">{fileName}</p>
          {network.title && (
            <p className="text-xs text-muted-foreground mt-1">{network.title}</p>
          )}
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Network Summary
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Junctions" value={junctions.length} icon="junction" />
          <StatCard label="Reservoirs" value={reservoirs.length} icon="reservoir" />
          <StatCard label="Tanks" value={tanks.length} icon="tank" />
          <StatCard label="Pipes" value={pipes.length} icon="pipe" />
          <StatCard label="Valves" value={valves.length} icon="valve" />
          <StatCard label="Pumps" value={pumps.length} icon="pump" />
        </div>
      </div>

      {/* Selected element details */}
      {(selectedNode || selectedLink) && (
        <div>
          <Separator className="mb-4" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Selected Element
          </h3>
          <Card className="border-primary/20 bg-primary/5 py-3 gap-2">
            <CardContent className="space-y-3">
              {selectedNode && (
                <>
                  <div className="flex items-center gap-2">
                    {(() => { const Icon = getNetworkIcon(selectedNode.type); return <Icon size={16} />; })()}
                    <span className="font-medium text-sm">{selectedNode.name}</span>
                    <Badge variant="secondary">{selectedNode.type}</Badge>
                  </div>
                  <div className="text-xs space-y-2">
                    <AttrRow label="Elevation" value={selectedNode.elevation} unit={units.elevation} />
                    {selectedNode.baseDemand !== undefined && (
                      <AttrRow label="Base demand" value={selectedNode.baseDemand} unit={units.demand} />
                    )}
                    {selectedNode.type === 'reservoir' && (
                      <>
                        <AttrRow label="Total head" value={selectedNode.totalHead} unit={units.head} />
                      </>
                    )}
                    {selectedNode.type === 'tank' && (
                      <>
                        <AttrRow label="Initial level" value={selectedNode.initLevel} unit={units.level} />
                        <AttrRow label="Min level" value={selectedNode.minLevel} unit={units.level} />
                        <AttrRow label="Max level" value={selectedNode.maxLevel} unit={units.level} />
                        <AttrRow label="Diameter" value={selectedNode.tankDiameter} unit={units.diameter} />
                        <AttrRow label="Min volume" value={selectedNode.minVolume} unit={units.volume} />
                      </>
                    )}
                  </div>
                </>
              )}
              {selectedLink && (
                <>
                  <div className="flex items-center gap-2">
                    {(() => { const Icon = getNetworkIcon(selectedLink.type); return <Icon size={16} />; })()}
                    <span className="font-medium text-sm">{selectedLink.name}</span>
                    <Badge variant="secondary">{selectedLink.type}</Badge>
                  </div>
                  <div className="text-xs space-y-2">
                    <AttrRow label="From node" value={selectedLink.startNodeId} />
                    <AttrRow label="To node" value={selectedLink.endNodeId} />
                    {selectedLink.type === 'pipe' && (
                      <>
                        <AttrRow label="Length" value={selectedLink.length} unit={units.length} />
                        <AttrRow label="Diameter" value={selectedLink.diameter} unit={units.diameter} />
                        <AttrRow label="Roughness" value={selectedLink.roughness} />
                        <AttrRow label="Minor loss" value={selectedLink.minorLoss} />
                        <AttrRow label="Status" value={selectedLink.status} />
                      </>
                    )}
                    {selectedLink.type === 'valve' && (
                      <>
                        <AttrRow label="Valve type" value={selectedLink.valveType} />
                        <AttrRow label={`Setting (${units.head})`} value={selectedLink.setting} />
                        <AttrRow label="Initial status" value={selectedLink.status} />
                        <AttrRow label="Diameter" value={selectedLink.diameter} unit={units.diameter} />
                        <AttrRow label="Minor loss" value={selectedLink.minorLoss} />
                      </>
                    )}
                    {selectedLink.type === 'pump' && (
                      <>
                        <AttrRow label="Pump type" value={selectedLink.pumpType} />
                        {selectedLink.power !== undefined && (
                          <AttrRow label="Power" value={selectedLink.power} unit={units.power} />
                        )}
                        <AttrRow label="Speed" value={selectedLink.speed} />
                        <AttrRow label="Initial status" value={selectedLink.status} />
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function AttrRow({ label, value, unit }: { label: string; value?: string | number | null; unit?: string }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">
        {typeof value === 'number' ? Number.isInteger(value) ? value : value.toFixed(2) : value}
        {unit && <span className="text-muted-foreground ml-1">{unit}</span>}
      </span>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  const Icon = getNetworkIcon(icon as any);
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2.5 bg-card">
      <Icon size={14} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="ml-auto text-sm font-semibold">{value}</span>
    </div>
  );
}
