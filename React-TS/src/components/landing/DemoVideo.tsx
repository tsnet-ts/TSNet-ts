import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { publicUrl } from '@/lib/public-url';

const HLS_SRC = publicUrl('demo/stream/demo.m3u8');
const POSTER_SRC = publicUrl('demo/demo-poster.jpg');

function canPlayNativeHls(video: HTMLVideoElement): boolean {
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

export function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (canPlayNativeHls(video)) {
      video.src = HLS_SRC;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 12 });
      hls.loadSource(HLS_SRC);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
  }, []);

  return (
    <div className="relative w-full max-w-none">
      <div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-slate-200/60 to-slate-100/40 blur-xl dark:from-slate-800/40 dark:to-slate-900/20" />
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-background shadow-2xl shadow-black/10 lg:rounded-2xl">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2.5 lg:px-4 lg:py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400/90 lg:size-3" />
            <span className="size-2.5 rounded-full bg-amber-400/90 lg:size-3" />
            <span className="size-2.5 rounded-full bg-emerald-400/90 lg:size-3" />
          </div>
          <span className="ml-1 truncate text-[10px] text-muted-foreground lg:text-xs">TSNet-TS — demo</span>
        </div>

        <video
          ref={videoRef}
          poster={POSTER_SRC}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          width={2400}
          height={1386}
          className="block w-full bg-muted/30"
          aria-label="TSNet-TS transient simulation demo"
        />
      </div>
    </div>
  );
}
