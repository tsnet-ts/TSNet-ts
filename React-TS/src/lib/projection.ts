/**
 * Coordinate projection utilities — mirrors epanet-js's approach.
 *
 * For XY-grid networks, raw coordinates are transformed to fake WGS84
 * centered at [0,0] by dividing by METERS_PER_DEGREE. The centroid is
 * stored in projection metadata so we can reverse the transform for display.
 */

import type { Coordinates, NetworkData } from '@/types';

export const METERS_PER_DEGREE = 111_320;

// --- Projection Types ---

export type WGS84Projection = { type: 'wgs84' };
export type XYGridProjection = { type: 'xy-grid'; centroid: [number, number]; scale: number };
export type Projection = WGS84Projection | XYGridProjection;

export interface ProjectionMapper {
  projection: Projection;
  /** Convert raw source coordinates to [lat, lng] for Leaflet */
  toLatLng: (x: number, y: number) => [number, number];
  /** Convert [lat, lng] back to raw source coordinates */
  toXY: (lat: number, lng: number) => { x: number; y: number };
  /** Whether to show tile layers ("DEGREES") or grid ("NONE") */
  backdropUnits: 'DEGREES' | 'NONE';
}

// --- Core Functions ---

/**
 * Compute the centroid (average) of all node coordinates.
 */
export function computeCentroid(network: NetworkData): [number, number] {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (const node of network.nodes.values()) {
    sumX += node.coordinates.x;
    sumY += node.coordinates.y;
    count++;
  }
  if (count === 0) return [0, 0];
  return [sumX / count, sumY / count];
}

/**
 * Transform a raw XY point to fake WGS84 [lat, lng].
 * Subtracts centroid, multiplies by scale, divides by METERS_PER_DEGREE.
 * Clamps to valid WGS84 bounds.
 */
export function transformPoint(
  x: number,
  y: number,
  centroid: [number, number],
  scale: number = 1,
): [number, number] {
  const lng = Math.max(-180, Math.min(180, ((x - centroid[0]) * scale) / METERS_PER_DEGREE));
  const lat = Math.max(-90, Math.min(90, ((y - centroid[1]) * scale) / METERS_PER_DEGREE));
  return [lat, lng]; // Leaflet order: [lat, lng]
}

/**
 * Reverse transform: fake WGS84 [lat, lng] back to raw XY coordinates.
 */
export function inverseTransformPoint(
  lat: number,
  lng: number,
  centroid: [number, number],
  scale: number = 1,
): { x: number; y: number } {
  const x = (lng * METERS_PER_DEGREE) / scale + centroid[0];
  const y = (lat * METERS_PER_DEGREE) / scale + centroid[1];
  return { x, y };
}

/**
 * Create a ProjectionMapper for the given projection.
 */
export function createProjectionMapper(projection: Projection): ProjectionMapper {
  if (projection.type === 'wgs84') {
    return {
      projection,
      // For GIS networks, x=longitude, y=latitude (standard INP convention)
      toLatLng: (x, y) => [y, x],
      toXY: (lat, lng) => ({ x: lng, y: lat }),
      backdropUnits: 'DEGREES',
    };
  }

  // xy-grid
  const { centroid, scale } = projection;
  return {
    projection,
    toLatLng: (x, y) => transformPoint(x, y, centroid, scale),
    toXY: (lat, lng) => inverseTransformPoint(lat, lng, centroid, scale),
    backdropUnits: 'NONE',
  };
}

/**
 * Transform all coordinates in a network from raw XY to WGS84 [lat, lng] stored as {x: lng, y: lat}.
 * After this, node.coordinates.x = longitude, node.coordinates.y = latitude.
 */
export function transformNetworkCoordinates(
  network: NetworkData,
  mapper: ProjectionMapper,
): void {
  for (const node of network.nodes.values()) {
    const [lat, lng] = mapper.toLatLng(node.coordinates.x, node.coordinates.y);
    node.coordinates = { x: lng, y: lat };
  }
  for (const link of network.links.values()) {
    if (link.vertices) {
      link.vertices = link.vertices.map((v) => {
        const [lat, lng] = mapper.toLatLng(v.x, v.y);
        return { x: lng, y: lat };
      });
    }
  }
}
