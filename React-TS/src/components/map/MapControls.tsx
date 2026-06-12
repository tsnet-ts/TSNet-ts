import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { useNetworkStore } from '@/store';
import { createProjectionMapper } from '@/lib/projection';

/**
 * Shows mouse coordinates: raw XY for schematic, lat/lng for GIS.
 */
export function MapControls() {
  const map = useMap();
  const projection = useNetworkStore((s) => s.projection);
  const [coords, setCoords] = useState<string>('');

  useEffect(() => {
    if (!projection) return;

    const mapper = createProjectionMapper(projection);

    function onMouseMove(e: L.LeafletMouseEvent) {
      const { lat, lng } = e.latlng;
      if (projection!.type === 'xy-grid') {
        const { x, y } = mapper.toXY(lat, lng);
        setCoords(`X: ${x.toFixed(1)}  Y: ${y.toFixed(1)}`);
      } else {
        setCoords(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    }

    function onMouseOut() {
      setCoords('');
    }

    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseOut);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseout', onMouseOut);
    };
  }, [map, projection]);

  if (!coords) return null;

  return (
    <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono text-muted-foreground shadow-sm border">
      {coords}
    </div>
  );
}
