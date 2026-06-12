import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useNetworkStore } from '@/store';
import { useUIStore } from '@/store';
import { useSimulationStore, useAnimationStore } from '@/store';
import { getNetworkLeafletBounds } from '@/services/inp-parser';
import { GridLayer } from './GridLayer';
import { NetworkLayer } from './NetworkLayer';
import { MapControls } from './MapControls';
import { ResultChart } from './ResultChart';
import { AnimationControls } from './AnimationControls';
import { ColorLegend } from './ColorLegend';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, bounds]);
  return null;
}

function ZoomToElement() {
  const map = useMap();
  const network = useNetworkStore((s) => s.network);
  const zoomToElementId = useUIStore((s) => s.zoomToElementId);
  const zoomToElement = useUIStore((s) => s.zoomToElement);

  useEffect(() => {
    if (!zoomToElementId || !network) return;

    // Check nodes
    const node = network.nodes.get(zoomToElementId);
    if (node) {
      map.flyTo([node.coordinates.y, node.coordinates.x], 17, { duration: 0.5 });
      zoomToElement(null);
      return;
    }

    // Check links — zoom to midpoint
    const link = network.links.get(zoomToElementId);
    if (link) {
      const start = network.nodes.get(link.startNodeId);
      const end = network.nodes.get(link.endNodeId);
      if (start && end) {
        const midY = (start.coordinates.y + end.coordinates.y) / 2;
        const midX = (start.coordinates.x + end.coordinates.x) / 2;
        map.flyTo([midY, midX], 17, { duration: 0.5 });
      }
      zoomToElement(null);
    }
  }, [zoomToElementId, network, map, zoomToElement]);

  return null;
}

export function UnifiedMap() {
  const network = useNetworkStore((s) => s.network);
  const projection = useNetworkStore((s) => s.projection);
  const results = useSimulationStore((s) => s.results);
  const animationActive = useAnimationStore((s) => s.animationActive);
  const startAnimation = useAnimationStore((s) => s.startAnimation);

  const bounds = useMemo(() => {
    if (!network) return null;
    return getNetworkLeafletBounds(network);
  }, [network]);

  const isXYGrid = projection?.type === 'xy-grid';

  if (!network || !bounds) return null;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        bounds={bounds}
        className="w-full h-full z-0"
        zoomControl={true}
        attributionControl={!isXYGrid}
        style={isXYGrid ? { backgroundColor: '#f9fafb' } : undefined}
      >
        {/* Tile layer only for GIS mode */}
        {!isXYGrid && (
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        )}

        {/* Grid layer for schematic mode */}
        {isXYGrid && <GridLayer />}

        <FitBounds bounds={bounds} />
        <ZoomToElement />
        <NetworkLayer />
        <MapControls />
      </MapContainer>
      <ResultChart />
      <AnimationControls />
      <ColorLegend />
      {/* Play Animation button — visible when results exist and animation is not active */}
      {results && !animationActive && (
        <button
          onClick={startAnimation}
          className="absolute top-3 right-3 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-50 text-sm font-medium text-gray-700"
          title="Play transient animation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-600">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
          </svg>
          Animate
        </button>
      )}
    </div>
  );
}
