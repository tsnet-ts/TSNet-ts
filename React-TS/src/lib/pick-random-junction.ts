import type { NetworkData, NetworkNode, SimulationResults } from '@/types';

export function pickRandomJunctionWithResults(
  network: NetworkData,
  results: SimulationResults
): NetworkNode | null {
  const junctions = [...network.nodes.values()].filter(
    (node) => node.type === 'junction' && results.nodes[node.id]
  );
  if (junctions.length === 0) return null;
  return junctions[Math.floor(Math.random() * junctions.length)];
}
