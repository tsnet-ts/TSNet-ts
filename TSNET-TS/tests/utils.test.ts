import { describe, it, expect } from 'vitest';
import { calc_parabola_vertex } from '../src/utils/calc-parabola-vertex.ts';
import { valve_curve } from '../src/utils/valve-curve.ts';
import { memo } from '../src/utils/memo.ts';
import { print_time_delta } from '../src/utils/print-time-delta.ts';
import { piecewise } from '../src/utils/numpy-helpers.ts';
import * as np from 'numpy-ts';

describe('calc_parabola_vertex', () => {
  it('should calculate parabola coefficients for known points', () => {
    // y = x^2: (1,1), (2,4), (3,9)
    const points: [[number, number], [number, number], [number, number]] = [[1, 1], [2, 4], [3, 9]];
    const [A, B, C] = calc_parabola_vertex(points);
    expect(A).toBeCloseTo(1, 10);
    expect(B).toBeCloseTo(0, 10);
    expect(C).toBeCloseTo(0, 10);
  });

  it('should calculate coefficients for a linear function (A=0)', () => {
    // y = 2x + 1: (0,1), (1,3), (2,5)
    const points: [[number, number], [number, number], [number, number]] = [[0, 1], [1, 3], [2, 5]];
    const [A, B, C] = calc_parabola_vertex(points);
    expect(A).toBeCloseTo(0, 10);
    expect(B).toBeCloseTo(2, 10);
    expect(C).toBeCloseTo(1, 10);
  });

  it('should calculate coefficients for pump curve points', () => {
    // Typical pump curve: (0, 100), (5, 80), (10, 40)
    const points: [[number, number], [number, number], [number, number]] = [[0, 100], [5, 80], [10, 40]];
    const [A, B, C] = calc_parabola_vertex(points);
    // Verify that points lie on the parabola
    expect(A * 0 + B * 0 + C).toBeCloseTo(100, 5);
    expect(A * 25 + B * 5 + C).toBeCloseTo(80, 5);
    expect(A * 100 + B * 10 + C).toBeCloseTo(40, 5);
  });

  it('should handle negative values', () => {
    const points: [[number, number], [number, number], [number, number]] = [[-1, 1], [0, 0], [1, 1]];
    const [A, B, C] = calc_parabola_vertex(points);
    expect(A).toBeCloseTo(1, 10);
    expect(B).toBeCloseTo(0, 10);
    expect(C).toBeCloseTo(0, 10);
  });
});

describe('valve_curve', () => {
  it('should return max flow coefficient for fully open valve (100%)', () => {
    const k = valve_curve(100);
    expect(k).toBeCloseTo(1 / 0.2, 4);
  });

  it('should return 0 for fully closed valve (0%)', () => {
    const k = valve_curve(0);
    expect(k).toBeCloseTo(0.0, 4);
  });

  it('should interpolate for intermediate opening', () => {
    const k = valve_curve(50);
    expect(k).toBeCloseTo(0.17, 4);
  });

  it('should use custom coefficients when provided', () => {
    const percent_open = [100, 50, 0];
    const kl = [1.0, 0.5, 0.0];
    const k = valve_curve(50, [percent_open, kl]);
    expect(k).toBeCloseTo(0.5, 5);
  });

  it('should interpolate with custom coefficients', () => {
    const percent_open = [100, 50, 0];
    const kl = [1.0, 0.5, 0.0];
    const k = valve_curve(25, [percent_open, kl]);
    expect(k).toBeCloseTo(0.25, 5);
  });
});

describe('memo', () => {
  it('should cache results for same arguments', () => {
    let callCount = 0;
    const fn = (x: number, y: number) => {
      callCount++;
      return x + y;
    };
    const memoized = memo(fn);
    expect(memoized(1, 2)).toBe(3);
    expect(memoized(1, 2)).toBe(3);
    expect(callCount).toBe(1);
  });

  it('should compute different results for different arguments', () => {
    let callCount = 0;
    const fn = (x: number) => {
      callCount++;
      return x * 2;
    };
    const memoized = memo(fn);
    expect(memoized(3)).toBe(6);
    expect(memoized(4)).toBe(8);
    expect(callCount).toBe(2);
  });

  it('should handle string arguments', () => {
    const fn = (s: string) => s.toUpperCase();
    const memoized = memo(fn as (...args: unknown[]) => unknown);
    expect(memoized('hello')).toBe('HELLO');
    expect(memoized('hello')).toBe('HELLO');
  });

  it('should handle no arguments', () => {
    let callCount = 0;
    const fn = () => {
      callCount++;
      return 42;
    };
    const memoized = memo(fn);
    expect(memoized()).toBe(42);
    expect(memoized()).toBe(42);
    expect(callCount).toBe(1);
  });
});

describe('print_time_delta', () => {
  it('should format seconds only', () => {
    expect(print_time_delta(45)).toBe('45s');
  });

  it('should format minutes and seconds', () => {
    expect(print_time_delta(125)).toBe('2m5s');
  });

  it('should format hours, minutes, seconds', () => {
    expect(print_time_delta(3661)).toBe('1h1m1s');
  });

  it('should format days', () => {
    expect(print_time_delta(90061)).toBe('1d1h1m1s');
  });

  it('should handle zero', () => {
    expect(print_time_delta(0)).toBe('0s');
  });

  it('should floor fractional seconds', () => {
    expect(print_time_delta(2.7)).toBe('2s');
  });
});

describe('piecewise', () => {
  it('should apply constant values based on conditions', () => {
    const x = np.array([1, 2, 3, 4, 5]);
    const result = piecewise(x,
      [np.less_equal(x, 2), np.greater(x, 2)],
      [10, 20]
    );
    const values = result.tolist() as number[];
    expect(values[0]).toBe(10);
    expect(values[1]).toBe(10);
    expect(values[2]).toBe(20);
    expect(values[3]).toBe(20);
    expect(values[4]).toBe(20);
  });

  it('should apply functions based on conditions', () => {
    const x = np.array([1, 2, 3, 4]);
    const result = piecewise(x,
      [np.less_equal(x, 2), np.greater(x, 2)],
      [(xi: number) => xi * 2, (xi: number) => xi * 3]
    );
    const values = result.tolist() as number[];
    expect(values[0]).toBe(2);
    expect(values[1]).toBe(4);
    expect(values[2]).toBe(9);
    expect(values[3]).toBe(12);
  });

  it('should default to zero where no condition matches', () => {
    const x = np.array([1, 2, 3]);
    const result = piecewise(x,
      [np.greater(x, 5)],
      [100]
    );
    const values = result.tolist() as number[];
    expect(values[0]).toBe(0);
    expect(values[1]).toBe(0);
    expect(values[2]).toBe(0);
  });
});
