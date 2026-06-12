import { describe, it, expect } from 'vitest';
import {
  Reynold,
  quasi_steady_friction_factor,
  unsteady_friction,
  cal_friction,
  cal_Cs,
  inner_node_steady,
  inner_node_quasisteady,
  inner_node_unsteady,
  valve_node,
  valve_end,
  dead_end,
  rev_end,
} from '../src/simulation/solver.ts';
import type { Pipe } from '../src/epanet-bridge.ts';

// Helper to create a mock Pipe object
function makePipe(overrides: Partial<Pipe> = {}): Pipe {
  return {
    name: 'P1',
    diameter: 0.3,
    length: 1000,
    roughness: 0.02,
    wavev: 1000,
    theta: 0,
    roughness_height: 0.0001,
    start_node: { name: 'N1', demand_coeff: 0, emitter_coeff: 0 } as any,
    end_node: { name: 'N2', demand_coeff: 0, emitter_coeff: 0 } as any,
    ...overrides,
  } as Pipe;
}

describe('Reynold', () => {
  it('should calculate Reynolds number correctly', () => {
    // Re = |V * D / nu|, nu = 1.004e-6
    const Re = Reynold(1.0, 0.3);
    expect(Re).toBeCloseTo(298804.780876494, 5);
  });

  it('should return 0 for zero velocity', () => {
    expect(Reynold(0, 0.3)).toBe(0);
  });

  it('should handle negative velocity (absolute value)', () => {
    const Re_pos = Reynold(2.0, 0.5);
    const Re_neg = Reynold(-2.0, 0.5);
    expect(Re_pos).toBeCloseTo(Re_neg, 10);
    expect(Re_pos).toBeCloseTo(996015.93625498, 5);
  });

  it('should be proportional to velocity', () => {
    const Re1 = Reynold(1.0, 0.3);
    const Re2 = Reynold(2.0, 0.3);
    expect(Re2 / Re1).toBeCloseTo(2.0, 10);
  });
});

describe('quasi_steady_friction_factor', () => {
  it('should return correct friction factor for turbulent flow', () => {
    const Re = 100000;
    const KD = 0.001;
    const f = quasi_steady_friction_factor(Re, KD);
    expect(f).toBeCloseTo(0.0349657757715822, 10);
  });

  it('should decrease with increasing Reynolds number (for smooth pipes)', () => {
    const KD = 0.0001;
    const f1 = quasi_steady_friction_factor(10000, KD);
    const f2 = quasi_steady_friction_factor(100000, KD);
    expect(f1).toBeCloseTo(0.03206763939068984, 10);
    expect(f2).toBeCloseTo(0.021691297619507048, 10);
    expect(f1).toBeGreaterThan(f2);
  });

  it('should increase with relative roughness', () => {
    const Re = 100000;
    const f1 = quasi_steady_friction_factor(Re, 0.0001);
    const f2 = quasi_steady_friction_factor(Re, 0.01);
    expect(f1).toBeCloseTo(0.021691297619507048, 10);
    expect(f2).toBeCloseTo(0.07739143849320282, 10);
    expect(f2).toBeGreaterThan(f1);
  });
});

describe('unsteady_friction', () => {
  it('should return zero when accelerations are zero', () => {
    const Ju = unsteady_friction(100000, 0, 0, 1.0, 1000, 9.81);
    expect(Ju).toBe(0);
  });

  it('should return correct value for non-zero local acceleration', () => {
    const Ju = unsteady_friction(100000, 5.0, 0, 1.0, 1000, 9.81);
    expect(Ju).toBeCloseTo(0.0018915159855856462, 10);
  });

  it('should return correct value for non-zero convective acceleration', () => {
    const Ju = unsteady_friction(100000, 0, 2.0, 1.0, 1000, 9.81);
    expect(Ju).toBeCloseTo(0.7566063942342585, 10);
  });

  it('should use different shear decay for laminar flow', () => {
    const Ju_lam = unsteady_friction(1000, 1.0, 0, 0.1, 1000, 9.81);
    expect(Ju_lam).toBeCloseTo(0.0017582251081203202, 10);
    const Ju_turb = unsteady_friction(100000, 1.0, 0, 0.1, 1000, 9.81);
    expect(Ju_lam).not.toBeCloseTo(Ju_turb, 5);
  });
});

describe('cal_friction', () => {
  it('should return steady friction only when friction=steady', () => {
    const J = cal_friction('steady', 0.02, 0.3, 1.5, 0.001, 0.01, 0, 0, 1000, 9.81);
    expect(J).toBeCloseTo(0.00075, 10);
  });

  it('should return zero friction for zero velocity with quasi-steady', () => {
    const J = cal_friction('quasi-steady', 0.02, 0.3, 0, 0.001, 0.01, 0, 0, 1000, 9.81);
    expect(J).toBe(0);
  });

  it('should include unsteady term when friction=unsteady', () => {
    const J_unsteady = cal_friction('unsteady', 0.02, 0.3, 1.5, 0.001, 0.01, 5.0, 2.0, 1000, 9.81);
    expect(J_unsteady).toBeCloseTo(0.4767322837418637, 10);
  });
});

describe('cal_Cs', () => {
  it('should return correct array dimensions', () => {
    const pipe = makePipe();
    const [A1, A2, C1, C2] = cal_Cs(
      [pipe], [pipe],
      [100], [1.5], [90], [1.4],
      [1], [1], 9.81, 0.01,
      'steady',
      [0], [0], [0], [0]
    );
    expect(A1).toHaveLength(1);
    expect(A2).toHaveLength(1);
    expect(C1).toHaveLength(1);
    expect(C2).toHaveLength(1);
    expect(C1[0]).toHaveLength(2);
    expect(C2[0]).toHaveLength(2);
  });

  it('should calculate correct pipe area', () => {
    const D = 0.3;
    const pipe = makePipe({ diameter: D });
    const [A1] = cal_Cs(
      [pipe], [pipe],
      [100], [1.0], [90], [1.0],
      [1], [1], 9.81, 0.01,
      'steady',
      [0], [0], [0], [0]
    );
    expect(A1[0]).toBeCloseTo(Math.PI * D ** 2 / 4, 10);
  });

  it('should have C[1] = g/a', () => {
    const a = 1200;
    const g = 9.81;
    const pipe = makePipe({ wavev: a });
    const [, , C1, C2] = cal_Cs(
      [pipe], [pipe],
      [100], [1.0], [90], [1.0],
      [1], [1], g, 0.01,
      'steady',
      [0], [0], [0], [0]
    );
    expect(C1[0][1]).toBeCloseTo(g / a, 10);
    expect(C2[0][1]).toBeCloseTo(g / a, 10);
  });
});

describe('inner_node_steady', () => {
  it('should return correct values for uniform zero flow', () => {
    const pipe = makePipe();
    const H0 = [100, 100, 100, 100, 100];
    const V0 = [0, 0, 0, 0, 0];
    const [HP, VP] = inner_node_steady(pipe, H0, V0, 0.01, 9.81);
    expect(HP).toHaveLength(3);
    expect(VP).toHaveLength(3);
    for (const h of HP) expect(h).toBeCloseTo(100, 8);
    for (const v of VP) expect(v).toBeCloseTo(0, 8);
  });

  it('should return correct values for gradient flow', () => {
    const pipe = makePipe();
    const H0 = [100, 98, 96, 94, 92];
    const V0 = [1.5, 1.5, 1.5, 1.5, 1.5];
    const [HP, VP] = inner_node_steady(pipe, H0, V0, 0.01, 9.81);
    expect(HP).toHaveLength(3);
    // Exact values matching Python output: HP=[98, 96, 94]
    expect(HP[0]).toBeCloseTo(98, 0);
    expect(HP[1]).toBeCloseTo(96, 0);
    expect(HP[2]).toBeCloseTo(94, 0);
    for (const v of VP) expect(v).toBeCloseTo(1.51887, 4);
  });
});

describe('inner_node_quasisteady', () => {
  it('should return arrays with correct length', () => {
    const pipe = makePipe();
    const H0 = [100, 98, 96, 94, 92];
    const V0 = [1.5, 1.5, 1.5, 1.5, 1.5];
    const [HP, VP] = inner_node_quasisteady(pipe, H0, V0, 0.01, 9.81);
    expect(HP).toHaveLength(3);
    expect(VP).toHaveLength(3);
  });

  it('should give same results as steady for zero velocity', () => {
    const pipe = makePipe({ theta: 0 });
    const H0 = [100, 100, 100, 100, 100];
    const V0 = [0, 0, 0, 0, 0];
    const [HP_s] = inner_node_steady(pipe, H0, V0, 0.01, 9.81);
    const [HP_qs] = inner_node_quasisteady(pipe, H0, V0, 0.01, 9.81);
    for (let i = 0; i < HP_s.length; i++) {
      expect(HP_qs[i]).toBeCloseTo(HP_s[i], 5);
    }
  });
});

describe('inner_node_unsteady', () => {
  it('should return arrays with correct length', () => {
    const pipe = makePipe();
    const H0 = [100, 98, 96, 94, 92];
    const V0 = [1.5, 1.5, 1.5, 1.5, 1.5];
    const dVdx = [0, 0, 0, 0, 0];
    const dVdt = [0, 0, 0, 0, 0];
    const [HP, VP] = inner_node_unsteady(pipe, H0, V0, 0.01, 9.81, dVdx, dVdt);
    expect(HP).toHaveLength(3);
    expect(VP).toHaveLength(3);
  });

  it('should give same results as quasi-steady when accelerations are zero and velocity is zero', () => {
    const pipe = makePipe({ theta: 0 });
    const H0 = [100, 100, 100, 100, 100];
    const V0 = [0, 0, 0, 0, 0];
    const dVdx = [0, 0, 0, 0, 0];
    const dVdt = [0, 0, 0, 0, 0];
    const [HP_qs] = inner_node_quasisteady(pipe, H0, V0, 0.01, 9.81);
    const [HP_u] = inner_node_unsteady(pipe, H0, V0, 0.01, 9.81, dVdx, dVdt);
    for (let i = 0; i < HP_qs.length; i++) {
      expect(HP_u[i]).toBeCloseTo(HP_qs[i], 5);
    }
  });
});

describe('valve_end', () => {
  it('should calculate HP correctly for pipe end (nn=1)', () => {
    const [HP, VP] = valve_end(100, 1.5, 0, 1, 1000, 9.81, 0.02, 0.3, 0.01, 0.001, 'steady', 0, 0);
    expect(VP).toBe(0);
    expect(HP).toBeCloseTo(252.9051987767584, 8);
  });

  it('should calculate HP correctly for pipe start (nn=0)', () => {
    const [HP, VP] = valve_end(100, 1.5, 0, 0, 1000, 9.81, 0.02, 0.3, 0.01, 0.001, 'steady', 0, 0);
    expect(VP).toBe(0);
    expect(HP).toBeCloseTo(-52.9051987767584, 8);
  });
});

describe('rev_end', () => {
  it('should maintain reservoir head for pipe end (nn=1)', () => {
    const [HP, VP] = rev_end(100, 1.0, 50, 1, 1000, 9.81, 0.02, 0.3, 0.01, 0.001, 'steady', 0, 0);
    expect(HP).toBe(50);
    expect(VP).toBeCloseTo(1.4901666666666666, 10);
  });

  it('should maintain reservoir head for pipe start (nn=0)', () => {
    const [HP, VP] = rev_end(100, 1.0, 80, 0, 1000, 9.81, 0.02, 0.3, 0.01, 0.001, 'steady', 0, 0);
    expect(HP).toBe(80);
    expect(VP).toBeCloseTo(0.8034666666666667, 10);
  });
});

describe('dead_end', () => {
  it('should return valid head and velocity for pipe end (nn=1)', () => {
    const pipe = makePipe();
    const [HP, VP] = dead_end(pipe, 100, 0.5, 50, 1, 1000, 9.81, 0.02, 0.3, 0.01, 0.001, 'steady', 0, 0);
    expect(HP).toBeDefined();
    expect(typeof HP).toBe('number');
    expect(VP).toBeDefined();
    expect(typeof VP).toBe('number');
  });

  it('should return valid head and velocity for pipe start (nn=0)', () => {
    const pipe = makePipe();
    const [HP, VP] = dead_end(pipe, 100, 0.5, 50, 0, 1000, 9.81, 0.02, 0.3, 0.01, 0.001, 'steady', 0, 0);
    expect(HP).toBeDefined();
    expect(typeof HP).toBe('number');
    expect(VP).toBeDefined();
    expect(typeof VP).toBe('number');
  });
});

describe('valve_node', () => {
  it('should return head and velocity tuple', () => {
    const pipe = makePipe();
    const [HP, VP] = valve_node(
      0.5, pipe, pipe, 100, 1.0, 90, 1.0,
      0.01, 9.81, 0, [1], [1], 'steady', 0, 0, 0, 0
    );
    expect(typeof HP).toBe('number');
    expect(typeof VP).toBe('number');
  });

  it('should handle fully open valve (large KL_inv)', () => {
    const pipe = makePipe();
    const [HP, VP] = valve_node(
      1000, pipe, pipe, 100, 1.0, 100, 1.0,
      0.01, 9.81, 0, [1], [1], 'steady', 0, 0, 0, 0
    );
    expect(HP).toBeDefined();
    expect(VP).toBeDefined();
  });
});
