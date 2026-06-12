import { describe, it, expect } from 'vitest';
import { detect_cusum } from '../src/postprocessing/detect-cusum.ts';

/**
 * NOTE: The TypeScript detect_cusum is a simplified CUSUM algorithm that differs from Python:
 * - Python uses gp_real (non-drift-adjusted) for threshold, returns (start_index, end_index, amplitude)
 * - TypeScript uses drift-adjusted sums, returns (positive_alarms, negative_alarms, cumsum_values)
 * - Python returns where change STARTED (tai); TypeScript returns where alarm FIRED (ta)
 *
 * Both implementations are tested with the same input signals to verify consistent detection behavior.
 */

describe('detect_cusum', () => {
  it('should detect no changes in constant signal', () => {
    // Same as Python: constant signal of 5.0, threshold=1.0, drift=0.1
    const time = Array.from({ length: 100 }, (_, i) => i);
    const x = new Array(100).fill(5.0);
    const [ta, tf, amp] = detect_cusum(time, x, 1.0, 0.1, false, null);
    expect(ta).toHaveLength(0);
    expect(tf).toHaveLength(0);
    expect(amp).toHaveLength(0);
  });

  it('should detect step increase at index 50', () => {
    // Same signal as Python: 0 for 50 samples, then 10.0
    // Python returns tai=[49] (start), TypeScript returns ta=[50] (alarm)
    const time = Array.from({ length: 100 }, (_, i) => i);
    const x = [...new Array(50).fill(0), ...new Array(50).fill(10)];
    const [ta, tf, amp] = detect_cusum(time, x, 5, 0.1, false, null);
    expect(ta.length).toBeGreaterThan(0);
    expect(ta[0]).toBe(50); // alarm fires at the step
    expect(tf).toHaveLength(0); // no negative alarm
  });

  it('should detect step decrease at index 50', () => {
    // Same signal as Python: 10 for 50 samples, then 0
    // Python returns tai=[49] (start), TypeScript returns tf=[50] (alarm)
    const time = Array.from({ length: 100 }, (_, i) => i);
    const x = [...new Array(50).fill(10), ...new Array(50).fill(0)];
    const [ta, tf, amp] = detect_cusum(time, x, 5, 0.1, false, null);
    expect(ta).toHaveLength(0); // no positive alarm
    expect(tf.length).toBeGreaterThan(0);
    expect(tf[0]).toBe(50); // alarm fires at the step
  });

  it('should not detect changes below threshold', () => {
    // Small fluctuations that don't exceed threshold
    const x = Array.from({ length: 100 }, (_, i) => Math.sin(i * 0.1) * 0.01);
    const time = Array.from({ length: 100 }, (_, i) => i);
    const [ta, tf, amp] = detect_cusum(time, x, 10, 0.5, false, null);
    expect(ta).toHaveLength(0);
    expect(tf).toHaveLength(0);
  });

  it('should detect multiple changes (step up then step down)', () => {
    // Signal: 0 → 10 at 30, 10 → 0 at 60
    const x = [
      ...new Array(30).fill(0),
      ...new Array(30).fill(10),
      ...new Array(40).fill(0),
    ];
    const time = Array.from({ length: 100 }, (_, i) => i);
    const [ta, tf, amp] = detect_cusum(time, x, 5, 0.1, false, null);
    expect(ta.length).toBeGreaterThan(0); // step up detected
    expect(tf.length).toBeGreaterThan(0); // step down detected
  });

  it('should return amplitude values for detected changes', () => {
    const x = [...new Array(50).fill(0), ...new Array(50).fill(20)];
    const time = Array.from({ length: 100 }, (_, i) => i);
    const [ta, tf, amp] = detect_cusum(time, x, 5, 0.1, false, null);
    expect(amp.length).toBeGreaterThan(0);
    // Amplitude should exceed threshold
    for (const a of amp) {
      expect(Math.abs(a)).toBeGreaterThan(5);
    }
  });
});
