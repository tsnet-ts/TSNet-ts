import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TransientModel, Initializer, MOCSimulator } from '../src/index.ts';
import { setSteadyInteriorEngine, steadyKernelLoaded } from '../src/simulation/steady-interior.ts';

const inp = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../examples/networks/Tnet0.inp',
);

/** Samples of node 2 head from the unmodified simulator (tf=2, dt=0.01). */
const SAMPLE_AT = [0, 50, 100, 150, 199];

const GOLDEN: Record<string, number[]> = {
    steady: [
        749.9428100585938,
        749.9427869398061,
        749.9427638416412,
        749.9427864190803,
        749.9427990946973,
    ],
    'quasi-steady': [
        749.9428100585938,
        749.9427869390258,
        749.9427638380022,
        749.9427864237576,
        749.9428089912367,
    ],
    unsteady: [
        749.9428100585938,
        749.9427872459157,
        749.9427657979251,
        749.9427857101264,
        749.9428098771318,
    ],
};

async function node2Head(friction: string): Promise<number[]> {
    let tm = await TransientModel.create(inp);
    tm.set_wavespeed(1200);
    tm.set_time(2, 0.01);
    tm.valve_closure('3', [0, 0, 0, 1]);
    tm = Initializer(tm, 0, 'PDD');
    tm = MOCSimulator(tm, 'no', friction);
    return tm.get_node('2')._head as number[];
}

describe('Tnet0 MOC parity', () => {
    for (const friction of ['steady', 'quasi-steady', 'unsteady'] as const) {
        it(`matches the locked ${friction} head samples`, async () => {
            const head = await node2Head(friction);
            expect(head).toHaveLength(200);
            SAMPLE_AT.forEach((index, i) => {
                expect(head[index]).toBeCloseTo(GOLDEN[friction][i], 6);
            });
        });
    }

    it('keeps full resolution when outputEvery is 1 and thins when it is 10', async () => {
        let tm = await TransientModel.create(inp);
        tm.set_wavespeed(1200);
        tm.set_time(2, 0.01);
        tm.valve_closure('3', [0, 0, 0, 1]);
        tm = Initializer(tm, 0, 'PDD');
        tm = MOCSimulator(tm, 'no', 'steady', undefined, 10);
        const head = tm.get_node('2')._head as number[];
        expect(head).toHaveLength(20);
        expect(tm.simulation_timestamps).toHaveLength(20);
        expect(tm.simulation_timestamps[5]).toBeCloseTo(0.5, 6);
        expect(head[0]).toBeCloseTo(GOLDEN.steady[0], 6);
        expect(head[5]).toBeCloseTo(GOLDEN.steady[1], 6);
        expect(head[10]).toBeCloseTo(GOLDEN.steady[2], 6);
        expect(head[15]).toBeCloseTo(GOLDEN.steady[3], 6);
    });

    it('matches steady heads with the JS interior and the WASM interior', async () => {
        expect(steadyKernelLoaded()).toBe(true);
        setSteadyInteriorEngine('js');
        const jsHead = await node2Head('steady');
        setSteadyInteriorEngine('wasm');
        const wasmHead = await node2Head('steady');
        setSteadyInteriorEngine('auto');
        SAMPLE_AT.forEach((index, i) => {
            expect(jsHead[index]).toBeCloseTo(GOLDEN.steady[i], 6);
            expect(wasmHead[index]).toBeCloseTo(GOLDEN.steady[i], 6);
        });
    });
});
