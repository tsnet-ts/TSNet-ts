import { useMemo } from 'react';
import { Polyline, CircleMarker, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useNetworkStore } from '@/store';
import { useUIStore } from '@/store';
import { useAnimationStore } from '@/store';
import { useSimulationStore } from '@/store';
import { ELEMENT_COLORS, getIconSvgString } from '@/components/icons/network-elements';
import { buildColorMap, computeColorRange } from '@/lib/color-scale';
import type { NetworkNode, NetworkLink } from '@/types';
import type { AnimationMetric } from '@/store';

function createElementIcon(type: NetworkNode['type'] | NetworkLink['type'], isSelected: boolean, greyed = false) {
  const size = isSelected ? 20 : 16;
  const html = greyed
    ? `<div style="filter:grayscale(1) opacity(0.4)">${getIconSvgString(type, size, isSelected)}</div>`
    : getIconSvgString(type, size, isSelected);
  const h = type === 'tank' ? Math.round(size * 0.6) : size;
  return L.divIcon({
    className: '',
    iconSize: [size, h],
    iconAnchor: [size / 2, h / 2],
    html,
  });
}

function createEventLabelIcon(label: string) {
  const html = `<div style="white-space:nowrap;font-size:10px;font-weight:500;color:#c2410c;text-shadow:0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff;">${label}</div>`;
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    iconAnchor: [-14, -4],
    html,
  });
}

/**
 * Compute the geometric midpoint along a polyline.
 */
function computeMidpoint(positions: [number, number][]): [number, number] {
  if (positions.length === 1) return positions[0];
  if (positions.length === 2) {
    return [
      (positions[0][0] + positions[1][0]) / 2,
      (positions[0][1] + positions[1][1]) / 2,
    ];
  }
  // Walk segments and find the point at half the total length
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    const dx = positions[i][1] - positions[i - 1][1];
    const dy = positions[i][0] - positions[i - 1][0];
    const len = Math.hypot(dx, dy);
    segLens.push(len);
    totalLen += len;
  }
  const halfLen = totalLen / 2;
  let accum = 0;
  for (let i = 0; i < segLens.length; i++) {
    if (accum + segLens[i] >= halfLen) {
      const t = (halfLen - accum) / segLens[i];
      return [
        positions[i][0] + t * (positions[i + 1][0] - positions[i][0]),
        positions[i][1] + t * (positions[i + 1][1] - positions[i][1]),
      ];
    }
    accum += segLens[i];
  }
  return positions[positions.length - 1];
}

export function NetworkLayer() {
  const network = useNetworkStore((s) => s.network);
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectElement = useUIStore((s) => s.selectElement);
  const animationActive = useAnimationStore((s) => s.animationActive);
  const currentIndex = useAnimationStore((s) => s.currentIndex);
  const animationMetric = useAnimationStore((s) => s.animationMetric);
  const results = useSimulationStore((s) => s.results);
  const events = useSimulationStore((s) => s.events);

  // Build maps of element IDs that have transient events, split by node vs link
  const { nodeEventLabels, linkEventLabels } = useMemo(() => {
    const nodeMap = new Map<string, string>();
    const linkMap = new Map<string, string>();
    for (const evt of events) {
      const label = evt.type.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      if (evt.type === 'valve-closure' || evt.type === 'valve-opening' || evt.type === 'pump-shutdown' || evt.type === 'pump-startup') {
        linkMap.set(evt.elementId, label);
      } else {
        nodeMap.set(evt.elementId, label);
      }
    }
    return { nodeEventLabels: nodeMap, linkEventLabels: linkMap };
  }, [events]);

  // Pre-compute color map when animation is active
  const colorMap = useMemo(() => {
    if (!animationActive || !results) return null;
    const range = computeColorRange(results, animationMetric);
    return buildColorMap(results, animationMetric, range);
  }, [animationActive, results, animationMetric]);

  const links = useMemo(() => {
    if (!network) return [];
    return [...network.links.values()].map((link) => {
      const startNode = network.nodes.get(link.startNodeId);
      const endNode = network.nodes.get(link.endNodeId);
      if (!startNode || !endNode) return null;

      // Build polyline: [lat, lng] positions (y=lat, x=lng after transform)
      const positions: [number, number][] = [
        [startNode.coordinates.y, startNode.coordinates.x],
      ];
      if (link.vertices) {
        for (const v of link.vertices) {
          positions.push([v.y, v.x]);
        }
      }
      positions.push([endNode.coordinates.y, endNode.coordinates.x]);

      return { ...link, positions };
    }).filter(Boolean) as (NetworkLink & { positions: [number, number][] })[];
  }, [network]);

  const nodes = useMemo(() => {
    if (!network) return [];
    return [...network.nodes.values()];
  }, [network]);

  if (!network) return null;

  return (
    <>
      {/* Links */}
      {links.map((link) => {
        const isSelected = !animationActive && link.id === selectedElementId;
        const animColor = animationActive && colorMap ? colorMap.get(link.id)?.[currentIndex] : null;
        // Grey out valve/pump lines during animation (no sim data for them)
        const greyedLine = animationActive && link.type !== 'pipe' && !animColor;
        return (
          <Polyline
            key={link.id}
            positions={link.positions}
            pathOptions={{
              color: greyedLine ? '#9ca3af' : (animColor ?? (isSelected ? '#2563eb' : ELEMENT_COLORS[link.type].fill)),
              weight: isSelected ? 4 : (link.type === 'pipe' ? 2 : 3),
              opacity: greyedLine ? 0.4 : 0.8,
            }}
            eventHandlers={{
              click: () => selectElement(link.id, link.type),
            }}
            interactive={true}
          />
        );
      })}

      {/* Link midpoint icons for valves and pumps */}
      {links.filter((l) => l.type !== 'pipe').map((link) => {
        const midPos = computeMidpoint(link.positions);
        const isSelected = !animationActive && link.id === selectedElementId;
        const icon = createElementIcon(link.type, isSelected, animationActive);
        return (
          <Marker
            key={`icon-${link.id}-${animationActive ? 'anim' : 'normal'}-${isSelected ? 's' : 'u'}`}
            position={midPos}
            icon={icon}
            eventHandlers={{ click: () => selectElement(link.id, link.type) }}
          />
        );
      })}

      {/* Event labels for links (valves/pumps) */}
      {!animationActive && links.filter((l) => l.type !== 'pipe' && linkEventLabels.has(l.id)).map((link) => {
        const midPos = computeMidpoint(link.positions);
        const label = linkEventLabels.get(link.id)!;
        return (
          <Marker
            key={`evt-label-${link.id}`}
            position={midPos}
            icon={createEventLabelIcon(label)}
            interactive={false}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const isSelected = !animationActive && node.id === selectedElementId;

        if (node.type === 'reservoir') {
          return (
            <Marker
              key={node.id}
              position={[node.coordinates.y, node.coordinates.x]}
              icon={createElementIcon('reservoir', isSelected)}
              eventHandlers={{ click: () => selectElement(node.id, node.type) }}
            >
              <Tooltip permanent direction="top" offset={[0, -12]}>
                <span className="text-xs font-medium">{node.name}</span>
              </Tooltip>
            </Marker>
          );
        }

        if (node.type === 'tank') {
          return (
            <Marker
              key={node.id}
              position={[node.coordinates.y, node.coordinates.x]}
              icon={createElementIcon('tank', isSelected)}
              eventHandlers={{ click: () => selectElement(node.id, node.type) }}
            >
              <Tooltip permanent direction="top" offset={[0, -8]}>
                <span className="text-xs font-medium">{node.name}</span>
              </Tooltip>
            </Marker>
          );
        }

        // Junctions
        const radius = isSelected ? 7 : 4;
        const animColor = animationActive && colorMap ? colorMap.get(node.id)?.[currentIndex] : null;
        const eventLabel = nodeEventLabels.get(node.id);
        return (
          <CircleMarker
            key={`${node.id}-${eventLabel ?? ''}`}
            center={[node.coordinates.y, node.coordinates.x]}
            radius={eventLabel ? 6 : radius}
            pathOptions={{
              fillColor: animColor ?? (isSelected ? '#2563eb' : (eventLabel ? '#ea580c' : ELEMENT_COLORS[node.type].fill)),
              fillOpacity: 0.9,
              color: animColor ?? (isSelected ? '#1d4ed8' : (eventLabel ? '#c2410c' : ELEMENT_COLORS[node.type].fill)),
              weight: isSelected ? 3 : (eventLabel ? 2 : 1),
              opacity: 1,
            }}
            eventHandlers={{
              click: () => selectElement(node.id, node.type),
            }}
            interactive={true}
          >
            {isSelected && (
              <Tooltip permanent direction="top" offset={[0, -8]}>
                <span className="text-xs font-medium">{node.name}</span>
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}

      {/* Event labels for junction nodes */}
      {!animationActive && nodes.filter((n) => n.type === 'junction' && nodeEventLabels.has(n.id)).map((node) => {
        const label = nodeEventLabels.get(node.id)!;
        return (
          <Marker
            key={`evt-label-${node.id}`}
            position={[node.coordinates.y, node.coordinates.x]}
            icon={createEventLabelIcon(label)}
            interactive={false}
          />
        );
      })}
    </>
  );
}
