import { useEffect, useRef, useCallback } from 'react';
import { useAnimationStore, useSimulationStore } from '@/store';
import type { AnimationMetric } from '@/store';

const SPEEDS = [0.25, 0.5, 1, 2, 4];

export function AnimationControls() {
  const animationActive = useAnimationStore((s) => s.animationActive);
  const playing = useAnimationStore((s) => s.playing);
  const currentIndex = useAnimationStore((s) => s.currentIndex);
  const speed = useAnimationStore((s) => s.speed);
  const animationMetric = useAnimationStore((s) => s.animationMetric);
  const togglePlay = useAnimationStore((s) => s.togglePlay);
  const setCurrentIndex = useAnimationStore((s) => s.setCurrentIndex);
  const setSpeed = useAnimationStore((s) => s.setSpeed);
  const setAnimationMetric = useAnimationStore((s) => s.setAnimationMetric);
  const stopAnimation = useAnimationStore((s) => s.stopAnimation);
  const results = useSimulationStore((s) => s.results);

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);

  const numSteps = results?.time.length ?? 0;
  const currentTime = results ? results.time[currentIndex] ?? 0 : 0;
  // Make 1x play the full simulation in ~5 seconds of real time
  const TARGET_DURATION = 5;
  const stepsPerSecond = numSteps > 1 ? (numSteps - 1) / TARGET_DURATION : 1;

  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }
    const elapsed = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Accumulate fractional steps based on elapsed real time
    accumulatorRef.current += elapsed * 0.001 * speed * stepsPerSecond;

    if (accumulatorRef.current >= 1) {
      const steps = Math.floor(accumulatorRef.current);
      accumulatorRef.current -= steps;
      const nextIndex = currentIndex + steps;
      if (nextIndex >= numSteps) {
        setCurrentIndex(numSteps - 1);
        useAnimationStore.getState().togglePlay(); // auto-pause at end
        return;
      }
      setCurrentIndex(nextIndex);
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [currentIndex, speed, stepsPerSecond, numSteps, setCurrentIndex]);

  useEffect(() => {
    if (playing && animationActive) {
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, animationActive, animate]);

  if (!animationActive || !results) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2 flex items-center gap-3 select-none">
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Scrub slider */}
      <input
        type="range"
        min={0}
        max={Math.max(numSteps - 1, 1)}
        value={currentIndex}
        onChange={(e) => setCurrentIndex(Number(e.target.value))}
        className="w-40 h-1.5 accent-blue-600"
      />

      {/* Time display */}
      <span className="text-xs font-mono text-gray-600 w-16 text-center">
        {currentTime.toFixed(3)}s
      </span>

      {/* Speed selector */}
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="text-xs border rounded px-1 py-0.5"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>{s}x</option>
        ))}
      </select>

      {/* Metric toggle */}
      <select
        value={animationMetric}
        onChange={(e) => setAnimationMetric(e.target.value as AnimationMetric)}
        className="text-xs border rounded px-1 py-0.5"
      >
        <option value="headChange">Head</option>
        <option value="velocity">Velocity</option>
      </select>

      {/* Stop button */}
      <button
        onClick={stopAnimation}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-red-500"
        title="Stop animation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
