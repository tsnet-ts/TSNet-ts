import { Project, Workspace, CountType, NodeType, LinkType, NodeProperty, LinkProperty, FlowUnits, PumpType } from 'epanet-js';
import type { NetworkData, NetworkNode, NetworkLink, Coordinates, UnitSystem, ValveType } from '@/types';
import { computeCentroid, createProjectionMapper, transformNetworkCoordinates, type Projection } from '@/lib/projection';

/**
 * Map epanet-js NodeType enum to our type string
 */
function mapNodeType(type: NodeType): NetworkNode['type'] {
  switch (type) {
    case NodeType.Junction: return 'junction';
    case NodeType.Reservoir: return 'reservoir';
    case NodeType.Tank: return 'tank';
    default: return 'junction';
  }
}

/**
 * Map epanet-js LinkType enum to our type string
 */
function mapLinkType(type: LinkType): NetworkLink['type'] {
  switch (type) {
    case LinkType.Pipe:
    case LinkType.CVPipe:
      return 'pipe';
    case LinkType.Pump:
      return 'pump';
    default:
      return 'valve';
  }
}

/**
 * Map epanet-js LinkType to valve subtype
 */
function mapValveType(type: LinkType): ValveType {
  switch (type) {
    case LinkType.PRV: return 'PRV';
    case LinkType.PSV: return 'PSV';
    case LinkType.PBV: return 'PBV';
    case LinkType.FCV: return 'FCV';
    case LinkType.TCV: return 'TCV';
    case LinkType.GPV: return 'GPV';
    default: return 'TCV';
  }
}

/**
 * Parse an EPANET .inp file string into NetworkData using the epanet-js toolkit.
 * Transforms all coordinates to WGS84 based on the specified projection mode.
 */
export async function parseInpFile(content: string, mode: 'gis' | 'schematic' = 'schematic'): Promise<{ network: NetworkData; projection: Projection }> {
  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile('network.inp', content);
  model.open('network.inp', 'report.rpt', 'out.bin');

  const nodes = new Map<string, NetworkNode>();
  const links = new Map<string, NetworkLink>();

  // Get title
  const { line1, line2, line3 } = model.getTitle();
  const title = [line1, line2, line3].filter(Boolean).join(' ').trim();

  // Parse nodes
  const nodeCount = model.getCount(CountType.NodeCount);
  for (let i = 1; i <= nodeCount; i++) {
    const id = model.getNodeId(i);
    const nodeType = model.getNodeType(i);
    const elevation = model.getNodeValue(i, NodeProperty.Elevation);
    const coords = model.getCoordinates(i);
    const baseDemand = model.getNodeValue(i, NodeProperty.BaseDemand);
    const type = mapNodeType(nodeType);

    const node: NetworkNode = {
      id,
      name: id,
      type,
      elevation,
      coordinates: { x: coords.x, y: coords.y },
      baseDemand: baseDemand || undefined,
    };

    // Reservoir: total head = elevation (head property)
    if (type === 'reservoir') {
      node.totalHead = model.getNodeValue(i, NodeProperty.Head) || elevation;
    }

    // Tank-specific properties
    if (type === 'tank') {
      node.initLevel = model.getNodeValue(i, NodeProperty.TankLevel) || undefined;
      node.minLevel = model.getNodeValue(i, NodeProperty.MinLevel) || undefined;
      node.maxLevel = model.getNodeValue(i, NodeProperty.MaxLevel) || undefined;
      node.tankDiameter = model.getNodeValue(i, NodeProperty.TankDiam) || undefined;
      node.minVolume = model.getNodeValue(i, NodeProperty.MinVolume) || undefined;
    }

    nodes.set(id, node);
  }

  // Parse links
  const linkCount = model.getCount(CountType.LinkCount);
  for (let i = 1; i <= linkCount; i++) {
    const id = model.getLinkId(i);
    const linkType = model.getLinkType(i);
    const { node1, node2 } = model.getLinkNodes(i);
    const startNodeId = model.getNodeId(node1);
    const endNodeId = model.getNodeId(node2);
    const length = model.getLinkValue(i, LinkProperty.Length);
    const diameter = model.getLinkValue(i, LinkProperty.Diameter);
    const roughness = model.getLinkValue(i, LinkProperty.Roughness);
    const type = mapLinkType(linkType);

    // Get vertices
    const vertexCount = model.getVertexCount(i);
    let vertices: Coordinates[] | undefined;
    if (vertexCount > 0) {
      vertices = [];
      for (let v = 1; v <= vertexCount; v++) {
        const vertex = model.getVertex(i, v);
        vertices.push({ x: vertex.x, y: vertex.y });
      }
    }

    const link: NetworkLink = {
      id,
      name: id,
      type,
      startNodeId,
      endNodeId,
      length: length || undefined,
      diameter: diameter || undefined,
      roughness: roughness || undefined,
      vertices,
    };

    // Initial status
    const initStatus = model.getLinkValue(i, LinkProperty.InitStatus);
    link.status = initStatus === 0 ? 'Closed' : 'Open';

    // Pipe minor loss
    if (type === 'pipe') {
      const minorLoss = model.getLinkValue(i, LinkProperty.MinorLoss);
      link.minorLoss = minorLoss || undefined;
      // Check valve pipe
      if (linkType === LinkType.CVPipe) {
        link.status = 'CV';
      }
    }

    // Valve properties
    if (type === 'valve') {
      const minorLoss = model.getLinkValue(i, LinkProperty.MinorLoss);
      const setting = model.getLinkValue(i, LinkProperty.InitSetting);
      link.minorLoss = minorLoss ?? undefined;
      link.setting = (setting != null && setting >= 0) ? setting : undefined;
      link.valveType = mapValveType(linkType);
    }

    // Pump properties
    if (type === 'pump') {
      const pumpType = model.getPumpType(i);
      const speed = model.getLinkValue(i, LinkProperty.InitSetting);
      link.speed = speed || 1;

      switch (pumpType) {
        case PumpType.ConstHP:
          link.pumpType = 'Constant HP';
          link.power = model.getLinkValue(i, LinkProperty.PumpPower) || undefined;
          break;
        case PumpType.PowerFunc:
          link.pumpType = 'Power Function';
          break;
        case PumpType.Custom:
          link.pumpType = 'Head Curve';
          break;
        default:
          link.pumpType = 'Power';
          break;
      }
    }

    links.set(id, link);
  }

  // Detect unit system from flow units
  const flowUnits = model.getFlowUnits();
  const isUS = flowUnits <= FlowUnits.AFD; // CFS, GPM, MGD, IMGD, AFD = US customary
  const unitSystem: UnitSystem = isUS ? 'US' : 'SI';

  const flowUnitsLabels: Record<number, string> = {
    [FlowUnits.CFS]: 'CFS',
    [FlowUnits.GPM]: 'GPM',
    [FlowUnits.MGD]: 'MGD',
    [FlowUnits.IMGD]: 'IMGD',
    [FlowUnits.AFD]: 'AFD',
    [FlowUnits.LPS]: 'LPS',
    [FlowUnits.LPM]: 'LPM',
    [FlowUnits.MLD]: 'MLD',
    [FlowUnits.CMH]: 'CMH',
    [FlowUnits.CMD]: 'CMD',
  };
  const flowUnitsLabel = flowUnitsLabels[flowUnits] || 'LPS';

  model.close();

  const network: NetworkData = { nodes, links, title, unitSystem, flowUnitsLabel };

  // Build projection and transform all coordinates to WGS84
  let projection: Projection;
  if (mode === 'gis') {
    projection = { type: 'wgs84' };
  } else {
    const centroid = computeCentroid(network);
    projection = { type: 'xy-grid', centroid, scale: 1 };
  }
  const mapper = createProjectionMapper(projection);
  transformNetworkCoordinates(network, mapper);

  return { network, projection };
}

/**
 * Get the bounding box of network coordinates (post-transform: x=lng, y=lat)
 */
export function getNetworkBounds(network: NetworkData): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const node of network.nodes.values()) {
    minX = Math.min(minX, node.coordinates.x);
    maxX = Math.max(maxX, node.coordinates.x);
    minY = Math.min(minY, node.coordinates.y);
    maxY = Math.max(maxY, node.coordinates.y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Get Leaflet-compatible bounds [[south, west], [north, east]]
 */
export function getNetworkLeafletBounds(network: NetworkData): [[number, number], [number, number]] {
  const b = getNetworkBounds(network);
  return [[b.minY, b.minX], [b.maxY, b.maxX]];
}
