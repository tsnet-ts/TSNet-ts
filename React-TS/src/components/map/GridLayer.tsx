import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNetworkStore } from '@/store';
import { inverseTransformPoint, type XYGridProjection } from '@/lib/projection';

const DENSITY_TARGET = 30;
const TRANSITION_OFFSET = 0.65;

/**
 * Adaptive grid layer for XY-grid (schematic) mode.
 * Generates grid lines in lat/lng space that represent raw XY coordinate axes.
 * Grid spacing snaps to powers of 10 and adapts to zoom level.
 */
export function GridLayer() {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const projection = useNetworkStore((s) => s.projection) as XYGridProjection;

  useEffect(() => {
    if (!projection || projection.type !== 'xy-grid') return;

    const layer = L.geoJSON(undefined, {
      style: (feature) => {
        const rank = feature?.properties?.rank;
        if (rank === 'major') {
          return { color: '#d4d4d8', weight: 1, opacity: 0.7 };
        }
        return { color: '#e4e4e7', weight: 0.5, opacity: 0.4 };
      },
      interactive: false,
    }).addTo(map);
    layerRef.current = layer;

    function updateGrid() {
      if (!layerRef.current) return;
      const bounds = map.getBounds();
      const { centroid, scale } = projection;

      // Calculate view width in raw XY units
      const west = bounds.getWest();
      const east = bounds.getEast();
      const lngSpan = east - west;
      const viewWidthUnits = (lngSpan * 111_320) / scale;

      // Snap grid step to power of 10
      const idealStep = viewWidthUnits / DENSITY_TARGET;
      const exponent = Math.log10(idealStep);
      const snappedExp = Math.floor(exponent + TRANSITION_OFFSET);
      const stepUnits = Math.pow(10, snappedExp);

      // Convert step to degrees
      const stepDeg = (stepUnits * scale) / 111_320;

      const south = bounds.getSouth();
      const north = bounds.getNorth();

      // Determine grid line range with buffer
      const startLng = Math.floor(west / stepDeg) - 1;
      const endLng = Math.ceil(east / stepDeg) + 1;
      const startLat = Math.floor(south / stepDeg) - 1;
      const endLat = Math.ceil(north / stepDeg) + 1;

      // Limit total lines
      const totalLines = (endLng - startLng) + (endLat - startLat);
      if (totalLines > 600) return;

      const features: GeoJSON.Feature[] = [];

      // Vertical lines (constant lng)
      for (let i = startLng; i <= endLng; i++) {
        const lng = i * stepDeg;
        const rawXY = inverseTransformPoint(0, lng, centroid, scale);
        const isMajor = Math.round(rawXY.x / stepUnits) % 10 === 0;
        features.push({
          type: 'Feature',
          properties: { rank: isMajor ? 'major' : 'minor' },
          geometry: {
            type: 'LineString',
            coordinates: [[lng, south], [lng, north]],
          },
        });
      }

      // Horizontal lines (constant lat)
      for (let i = startLat; i <= endLat; i++) {
        const lat = i * stepDeg;
        if (lat < -85 || lat > 85) continue;
        const rawXY = inverseTransformPoint(lat, 0, centroid, scale);
        const isMajor = Math.round(rawXY.y / stepUnits) % 10 === 0;
        features.push({
          type: 'Feature',
          properties: { rank: isMajor ? 'major' : 'minor' },
          geometry: {
            type: 'LineString',
            coordinates: [[west, lat], [east, lat]],
          },
        });
      }

      layerRef.current.clearLayers();
      layerRef.current.addData({
        type: 'FeatureCollection',
        features,
      });
    }

    updateGrid();
    map.on('moveend zoomend', updateGrid);

    return () => {
      map.off('moveend zoomend', updateGrid);
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, projection]);

  return null;
}
