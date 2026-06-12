import type { SimulationResults } from '@/types';

export function downloadSimulationResults(
  results: SimulationResults,
  baseName = 'tsnet-results'
): void {
  const safeName = baseName.replace(/\.inp$/i, '').replace(/[^\w.-]+/g, '_') || 'tsnet-results';
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}-transient-results.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
