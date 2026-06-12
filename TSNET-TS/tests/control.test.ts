import { describe, it, expect } from 'vitest';
import { valveclosing, valveopening, pumpclosing, pumpopening, burstsetting, demandpulse } from '../src/network/control.ts';

describe('valveclosing', () => {
  const dt = 0.1;
  const tf = 10;

  it('should return all ones before closure starts (gradual)', () => {
    // tc=2, ts=5, se=0, m=1
    const s = valveclosing(dt, tf, [2, 5, 0, 1]);
    const values = s.tolist() as number[];
    // Before ts=5: all should be 1
    for (let i = 0; i < 50; i++) {
      expect(values[i]).toBeCloseTo(1, 5);
    }
  });

  it('should reach final percentage after closure (gradual)', () => {
    // tc=2, ts=2, se=0.2, m=1
    const s = valveclosing(dt, tf, [2, 2, 0.2, 1]);
    const values = s.tolist() as number[];
    const tn = Math.floor(tf / dt);
    // After ts+tc = 4s (index 40+), should be at se=0.2
    expect(values[tn - 1]).toBeCloseTo(0.2, 5);
  });

  it('should handle abrupt closure (tc=0)', () => {
    // tc=0, ts=5, se=0, m=1
    const s = valveclosing(dt, tf, [0, 5, 0, 1]);
    const values = s.tolist() as number[];
    // Before ts: 1.0, at/after ts: se=0
    expect(values[0]).toBeCloseTo(1, 5);
    expect(values[49]).toBeCloseTo(1, 5);
    // After ts=5 (index 51+)
    expect(values[51]).toBeCloseTo(0, 5);
  });

  it('should produce monotonically decreasing values during closure', () => {
    const s = valveclosing(dt, tf, [3, 2, 0, 1]);
    const values = s.tolist() as number[];
    // During closure from index 20 to 50
    for (let i = 21; i <= 50; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1] + 1e-10);
    }
  });

  it('should handle nonlinear closure (m=2)', () => {
    const s = valveclosing(dt, tf, [4, 1, 0, 2]);
    const values = s.tolist() as number[];
    // Midpoint of closure: t=(midpoint-ts)/tc = 0.5, s = 1-(1-0)*0.5^2 = 0.75
    const midIdx = Math.floor((1 + 2) / dt); // ts=1, tc=4, midpoint at ts+tc/2=3
    expect(values[midIdx]).toBeCloseTo(0.75, 1);
  });
});

describe('valveopening', () => {
  const dt = 0.1;
  const tf = 10;

  it('should return all zeros before opening starts (gradual)', () => {
    const s = valveopening(dt, tf, [2, 5, 1, 1]);
    const values = s.tolist() as number[];
    for (let i = 0; i < 50; i++) {
      expect(values[i]).toBeCloseTo(0, 5);
    }
  });

  it('should reach final percentage after opening (gradual)', () => {
    const s = valveopening(dt, tf, [2, 2, 0.8, 1]);
    const values = s.tolist() as number[];
    const tn = Math.floor(tf / dt);
    // After ts+tc=4s, should reach se=0.8
    expect(values[tn - 1]).toBeCloseTo(0.8, 5);
  });

  it('should handle abrupt opening (tc=0)', () => {
    const s = valveopening(dt, tf, [0, 5, 1, 1]);
    const values = s.tolist() as number[];
    // Before ts: 0, after ts: se=1
    expect(values[0]).toBeCloseTo(0, 5);
    expect(values[49]).toBeCloseTo(0, 5);
    expect(values[51]).toBeCloseTo(1, 5);
  });
});

describe('pumpclosing', () => {
  const dt = 0.1;
  const tf = 10;

  it('should return all ones before closure starts', () => {
    const s = pumpclosing(dt, tf, [2, 5, 0, 1]);
    const values = s.tolist() as number[];
    for (let i = 0; i < 50; i++) {
      expect(values[i]).toBeCloseTo(1, 5);
    }
  });

  it('should not fully close (se=0 becomes 0.0001)', () => {
    const s = pumpclosing(dt, tf, [2, 2, 0, 1]);
    const values = s.tolist() as number[];
    const tn = Math.floor(tf / dt);
    // Should reach 0.0001 (not 0) due to numerical protection
    expect(values[tn - 1]).toBeCloseTo(0.0001, 5);
  });

  it('should handle nonlinear closure', () => {
    const s = pumpclosing(dt, tf, [4, 1, 0.1, 2]);
    const values = s.tolist() as number[];
    // All values should be between se and 1
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0.1 - 1e-10);
      expect(v).toBeLessThanOrEqual(1 + 1e-10);
    }
  });
});

describe('pumpopening', () => {
  const dt = 0.1;
  const tf = 10;

  it('should return all zeros before opening starts', () => {
    const s = pumpopening(dt, tf, [2, 5, 1, 1]);
    const values = s.tolist() as number[];
    for (let i = 0; i < 50; i++) {
      expect(values[i]).toBeCloseTo(0, 5);
    }
  });

  it('should reach final percentage after opening', () => {
    const s = pumpopening(dt, tf, [2, 2, 0.9, 1]);
    const values = s.tolist() as number[];
    const tn = Math.floor(tf / dt);
    expect(values[tn - 1]).toBeCloseTo(0.9, 5);
  });

  it('should handle abrupt opening (tc=0)', () => {
    const s = pumpopening(dt, tf, [0, 3, 1, 1]);
    const values = s.tolist() as number[];
    expect(values[0]).toBeCloseTo(0, 5);
    expect(values[29]).toBeCloseTo(0, 5);
    expect(values[31]).toBeCloseTo(1, 5);
  });
});

describe('burstsetting', () => {
  const dt = 0.1;
  const tf = 10;

  it('should return all zeros before burst starts (gradual)', () => {
    const s = burstsetting(dt, tf, 5, 2, 0.01);
    const values = s.tolist() as number[];
    for (let i = 0; i < 50; i++) {
      expect(values[i]).toBeCloseTo(0, 5);
    }
  });

  it('should reach final burst coeff after tc (gradual)', () => {
    const s = burstsetting(dt, tf, 2, 3, 0.05);
    const values = s.tolist() as number[];
    const tn = Math.floor(tf / dt);
    // After ts+tc=5s, should be final_burst_coeff=0.05
    expect(values[tn - 1]).toBeCloseTo(0.05, 5);
  });

  it('should handle instantaneous burst (tc=0)', () => {
    const s = burstsetting(dt, tf, 3, 0, 0.02);
    const values = s.tolist() as number[];
    // Before ts=3: 0, after: 0.02
    expect(values[0]).toBeCloseTo(0, 5);
    expect(values[29]).toBeCloseTo(0, 5);
    expect(values[31]).toBeCloseTo(0.02, 5);
  });
});

describe('demandpulse', () => {
  const dt = 0.1;
  const tf = 10;

  it('should return zeros before and after pulse', () => {
    // tc=4, ts=3, tp=1, dp=2
    const s = demandpulse(dt, tf, 4, 3, 1, 2);
    const values = s.tolist() as number[];
    // Before ts=3: 0
    expect(values[0]).toBeCloseTo(0, 3);
    // After ts+tc=7: 0
    expect(values[values.length - 1]).toBeCloseTo(0, 3);
  });

  it('should reach peak during steady phase', () => {
    // tc=4, ts=2, tp=1, dp=3
    const s = demandpulse(dt, tf, 4, 2, 1, 3);
    const values = s.tolist() as number[];
    // Steady phase: ts+tp=3 to ts+tp+stay=5, dp=3
    const midIdx = Math.floor(4 / dt); // midpoint of steady phase
    expect(values[midIdx]).toBeCloseTo(3, 1);
  });

  it('should handle square pulse (tp=0)', () => {
    // tc=4, ts=2, tp=0, dp=5
    const s = demandpulse(dt, tf, 4, 2, 0, 5);
    const values = s.tolist() as number[];
    // During steady portion: should be dp=5
    const midIdx = Math.floor(4 / dt);
    expect(values[midIdx]).toBeCloseTo(5, 1);
  });
});
