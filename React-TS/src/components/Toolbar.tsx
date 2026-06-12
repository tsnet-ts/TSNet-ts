import { Upload, FileText, Zap, Download } from 'lucide-react';
import { AppLogo } from '@/components/icons/AppLogo';
import { useNetworkStore } from '@/store';
import { useUIStore } from '@/store';
import { useSimulationStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { downloadSimulationResults } from '@/lib/download-results';

export function Toolbar() {
  const fileName = useNetworkStore((s) => s.fileName);
  const network = useNetworkStore((s) => s.network);
  const clearNetwork = useNetworkStore((s) => s.clearNetwork);
  const setShowUpload = useUIStore((s) => s.setShowUpload);
  const setSidebarMode = useUIStore((s) => s.setSidebarMode);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const status = useSimulationStore((s) => s.status);
  const progress = useSimulationStore((s) => s.progress);
  const progressStage = useSimulationStore((s) => s.progressStage);
  const error = useSimulationStore((s) => s.error);
  const results = useSimulationStore((s) => s.results);

  const handleDownloadResults = () => {
    if (!results) return;
    downloadSimulationResults(results, fileName ?? undefined);
  };

  const handleNewFile = () => {
    clearNetwork();
    setShowUpload(true);
  };

  return (
    <header className="flex h-12 items-center justify-between border-b px-4 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <AppLogo className="size-7" />
          <span className="font-semibold text-sm tracking-tight">TSNet-TS</span>
        </div>
        {fileName && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="size-3.5" />
              <span className="text-xs font-medium">{fileName}</span>
            </div>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 ml-1"
              onClick={() => { setSidebarMode('transient'); setSidebarOpen(true); }}
            >
              <Zap className="size-3.5" />
              Run Transient
            </Button>
          </>
        )}
        {status === 'success' && results && (
          <>
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              Simulation Complete
            </Badge>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadResults}>
              <Download className="size-3.5" />
              Download JSON
            </Button>
          </>
        )}
        {status === 'running' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 min-w-[200px]">
              <div className="h-1.5 flex-1 rounded-full bg-blue-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-medium text-blue-700 tabular-nums whitespace-nowrap">
                {Math.round(progress)}%
              </span>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {progressStage || 'Starting...'}
            </span>
          </div>
        )}
        {status === 'error' && error && (
          <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 max-w-xs truncate" title={error}>
            Simulation failed — see console
          </Badge>
        )}
      </div>
      {network && (
        <Button variant="outline" size="sm" onClick={handleNewFile}>
          <Upload className="size-3.5" />
          New File
        </Button>
      )}
    </header>
  );
}
