import { useCallback, useRef, useState } from 'react';
import {
  Upload, FileText, Play, Globe, Grid3x3, ArrowLeft, FolderUp, AlertCircle,
} from 'lucide-react';
import { parseInpFile } from '@/services/inp-parser';
import { useNetworkStore } from '@/store';
import { useUIStore } from '@/store';
import { useSimulationStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DemoVideo } from '@/components/landing/DemoVideo';
import { AppLogo } from '@/components/icons/AppLogo';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { cn } from '@/lib/utils';
import { EXAMPLE_PRESETS } from '@/lib/example-presets';
import type { TransientEvent } from '@/types';

type Step = 'choice' | 'examples' | 'projection' | 'upload';

function getUploadErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return 'The file could not be parsed. Please check that it is a valid EPANET 2.x .inp file.';
}

function isInpFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.inp');
}

function StepBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-6 inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back
    </button>
  );
}

export function FileUpload() {
  const setNetwork = useNetworkStore((s) => s.setNetwork);
  const setShowUpload = useUIStore((s) => s.setShowUpload);
  const setSidebarMode = useUIStore((s) => s.setSidebarMode);
  const resetSimulation = useSimulationStore((s) => s.reset);
  const addEvent = useSimulationStore((s) => s.addEvent);
  const updateSettings = useSimulationStore((s) => s.updateSettings);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadError, setUploadError] = useState<{ title: string; message: string } | null>(null);
  const [step, setStep] = useState<Step>('choice');
  const [projectionMode, setProjectionMode] = useState<'gis' | 'schematic'>('gis');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showUploadError = useCallback((title: string, message: string) => {
    setUploadError({ title, message });
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!isInpFile(file)) {
        showUploadError('Invalid file type', 'Please upload an EPANET network file with a .inp extension.');
        return;
      }

      setParsing(true);
      const reader = new FileReader();
      reader.onerror = () => {
        setParsing(false);
        showUploadError('Could not read file', 'The file could not be read from disk. Please try again.');
      };
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        try {
          const { network, projection } = await parseInpFile(content, projectionMode);
          setNetwork(network, content, file.name, projection);
          setShowUpload(false);
          resetSimulation();
        } catch (err) {
          console.error('Failed to parse INP file:', err);
          showUploadError('Failed to load network', getUploadErrorMessage(err));
        } finally {
          setParsing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    },
    [setNetwork, setShowUpload, resetSimulation, projectionMode, showUploadError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!isInpFile(file)) {
        showUploadError('Invalid file type', 'Please drop an EPANET .inp file.');
        return;
      }
      handleFile(file);
    },
    [handleFile, showUploadError]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleExampleLoad = async (presetId: string) => {
    const preset = EXAMPLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setLoading(true);
    try {
      const res = await fetch(preset.file);
      const content = await res.text();
      const { network, projection } = await parseInpFile(content, preset.mode);
      setNetwork(network, content, preset.network, projection);
      resetSimulation();
      updateSettings(preset.settings);
      for (const evt of preset.events) {
        addEvent({ ...evt, id: crypto.randomUUID() } as TransientEvent);
      }
      setShowUpload(false);
      setSidebarMode('transient');
    } catch (err) {
      console.error('Failed to load example:', err);
      showUploadError('Failed to load example', getUploadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={uploadError !== null} onOpenChange={(open) => !open && setUploadError(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-5 text-destructive" />
              </div>
              <div className="space-y-1.5">
                <DialogTitle>{uploadError?.title ?? 'Upload failed'}</DialogTitle>
                <DialogDescription>{uploadError?.message}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUploadError(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-full w-full overflow-y-auto bg-[#f6f7f9]">
        {step === 'choice' ? (
          /* ── Landing: GIF left · copy right (epanet-js style) ── */
          <main className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col px-5 py-6 sm:px-8 lg:px-12 lg:py-8">
            <div className="mb-6 flex items-center justify-between lg:mb-8">
              <div className="flex items-center gap-2.5">
                <AppLogo className="size-8" />
                <span className="text-lg font-bold tracking-tight">TSNet-TS</span>
              </div>
              <a
                href="https://github.com/tsnet-ts/TSNet-ts"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground shadow-sm transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <GitHubIcon className="size-5" />
              </a>
            </div>

            <div className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10 xl:gap-12">
              {/* Left — demo GIF */}
              <div className="order-1 w-full lg:order-1">
                <DemoVideo />
              </div>

              {/* Right — copy & CTAs */}
              <div className="order-2 flex max-w-xl flex-col justify-center lg:order-2 lg:max-w-none">
                <p className="mb-3 text-sm font-semibold tracking-tight text-foreground">
                  TSNet-TS · tsnet-ts
                </p>
                <h1 className="text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.65rem]">
                  Water hammer &amp; hydraulic transient simulation —{' '}
                  <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                    from EPANET model to results in your browser.
                  </span>
                </h1>
                <p className="mt-5 text-base leading-relaxed text-muted-foreground lg:text-[1.05rem]">
                  TSNet-TS is a free online transient simulation tool for water hammer and pressure
                  surge analysis — using the Method of Characteristics (MOC), a TypeScript port of{' '}
                  <a
                    href="https://github.com/glorialulu/TSNet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-indigo-600"
                  >
                    TSNet
                  </a>{' '}
                  (Python). Run pipeline transient simulation for valve closures, pump trips, pipe
                  bursts, and surge tanks on EPANET{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 text-sm shadow-sm">.inp</code>{' '}
                  networks — no install, no backend.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={() => setStep('projection')}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:from-violet-700 hover:to-indigo-700"
                  >
                    Upload your model
                    <FolderUp className="size-4" />
                  </button>
                  <button
                    onClick={() => setStep('examples')}
                    disabled={loading}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-6 py-2.5 text-sm font-medium shadow-sm transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Try an example
                    <Play className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <footer className="mt-10 border-t border-border/60 pt-6 text-sm leading-relaxed text-muted-foreground lg:mt-12">
              <p>
                TSNet-TS helps engineers and researchers study water hammer, pressure surges,
                pipeline transients, and unsteady flow in drinking-water distribution networks.
                Use it as an online water hammer calculator for quick what-if analysis. Built on{' '}
                <a
                  href="https://www.npmjs.com/package/@tsnet-ts/ts-net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2 hover:text-indigo-600"
                >
                  @tsnet-ts/ts-net
                </a>
                , the open-source TypeScript library for MOC-based transient simulation compatible
                with EPANET input files.
              </p>
            </footer>
          </main>
        ) : (
          /* ── Wizard steps ── */
          <div className="mx-auto max-w-3xl px-6 py-10 lg:px-8">
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="mb-8 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <AppLogo className="size-6" />
              <span className="font-semibold text-foreground">TSNet-TS</span>
            </button>

            <div className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
              {step === 'examples' && (
                <div>
                  <StepBack onClick={() => setStep('choice')} />
                  <h2 className="text-xl font-semibold">Example scenarios</h2>
                  <p className="mt-1 mb-6 text-sm text-muted-foreground">Runs locally in your browser.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {EXAMPLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleExampleLoad(preset.id)}
                        disabled={loading}
                        className={cn(
                          'cursor-pointer rounded-xl border p-4 text-left transition-all hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
                          preset.mode === 'gis'
                            ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400 ring-1 ring-emerald-200/60'
                            : 'hover:border-indigo-300',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Play className={cn('size-4 shrink-0', preset.mode === 'gis' ? 'text-emerald-600' : 'text-indigo-600')} />
                          {preset.mode === 'gis' && (
                            <Badge variant="secondary" className="shrink-0 gap-1 border-emerald-200 bg-emerald-100 text-[10px] font-medium text-emerald-800">
                              <Globe className="size-3" />
                              GIS
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-semibold">{preset.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'projection' && (
                <div>
                  <StepBack onClick={() => setStep('choice')} />
                  <h2 className="text-xl font-semibold">Choose projection</h2>
                  <p className="mt-1 mb-6 text-sm text-muted-foreground">How are coordinates stored in your .inp?</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => { setProjectionMode('gis'); setStep('upload'); }}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-left transition-all hover:border-indigo-400"
                    >
                      <Globe className="size-6 text-indigo-600" />
                      <div>
                        <p className="font-semibold">Map-based</p>
                        <p className="text-xs text-muted-foreground">WGS84 lat/lon</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setProjectionMode('schematic'); setStep('upload'); }}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-left transition-all hover:border-indigo-400"
                    >
                      <Grid3x3 className="size-6 text-indigo-600" />
                      <div>
                        <p className="font-semibold">X–Y grid</p>
                        <p className="text-xs text-muted-foreground">Schematic coordinates</p>
                      </div>
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Map mode requires WGS84.{' '}
                    <a href="https://utils.epanetjs.com/projection-converter" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                      EPANET Projection Converter
                    </a>
                  </p>
                </div>
              )}

              {step === 'upload' && (
                <div>
                  <StepBack onClick={() => setStep('projection')} />
                  <h2 className="text-xl font-semibold">Upload your model</h2>
                  <p className="mt-1 mb-5 text-sm text-muted-foreground">EPANET 2.x .inp · processed locally</p>

                  {projectionMode === 'gis' && (
                    <p className="mb-4 rounded-lg border bg-indigo-50/50 px-3 py-2 text-xs text-muted-foreground">
                      WGS84 required.{' '}
                      <a href="https://utils.epanetjs.com/projection-converter" target="_blank" rel="noopener noreferrer" className="underline">Projection Converter</a>
                    </p>
                  )}

                  <Card
                    onClick={() => !parsing && fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed',
                      parsing ? 'cursor-wait opacity-70' : 'cursor-pointer',
                      isDragOver ? 'border-indigo-400 bg-indigo-50/30' : 'hover:border-indigo-300'
                    )}
                  >
                    <CardContent
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className="flex flex-col items-center gap-4 py-10 sm:flex-row sm:px-8"
                    >
                      <Upload className={cn('size-10', isDragOver ? 'text-indigo-600' : 'text-muted-foreground')} />
                      <div className="flex-1 text-center sm:text-left">
                        <p className="font-medium">
                          {parsing ? 'Loading…' : isDragOver ? 'Drop here' : 'Drag & drop your .inp file'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">Never uploaded to a server</p>
                      </div>
                      <Button asChild disabled={parsing} variant="outline" onClick={(e) => e.stopPropagation()}>
                        <label className="cursor-pointer">
                          <FileText className="size-4" />
                          Browse
                          <input ref={fileInputRef} type="file" accept=".inp" onChange={handleFileInput} className="hidden" />
                        </label>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
