/**
 * Print MOC timings. Not used in CI.
 * Usage: bun run bench
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TransientModel, Initializer, MOCSimulator } from '../src/index.ts';
import { inner_node_steady_into } from '../src/simulation/solver.ts';
import { fillSteadyInteriors, setSteadyInteriorEngine } from '../src/simulation/steady-interior.ts';
import type { Pipe } from '../src/epanet-bridge.ts';

const print = console.log.bind(console);
console.log = () => {};
console.warn = () => {};

function ms(fn: () => void, reps: number): number {
    fn();
    const t0 = performance.now();
    for (let i = 0; i < reps; i++) fn();
    return performance.now() - t0;
}

function legacyInner(link: Pipe, H0: number[], V0: number[], dt: number, g: number): [number[], number[]] {
    const HP = new Array(H0.length).fill(0);
    const VP = new Array(V0.length).fill(0);
    const f = link.roughness;
    const D = link.diameter;
    const a = link.wavev;
    const theta = link.theta;
    const ga = g / a;
    for (let i = 1; i < H0.length - 1; i++) {
        const V1 = V0[i - 1]; const H1 = H0[i - 1];
        const V2 = V0[i + 1]; const H2 = H0[i + 1];
        const C = [[0, 0], [0, 0]];
        const J1 = f * dt / 2. / D * V1 * Math.abs(V1);
        C[0][0] = V1 + ga * H1 - J1 + ga * dt * V1 * theta;
        C[0][1] = ga;
        const J2 = f * dt / 2. / D * V2 * Math.abs(V2);
        C[1][0] = -V2 + ga * H2 + J2 + ga * dt * V2 * theta;
        C[1][1] = ga;
        HP[i] = (C[0][0] + C[1][0]) / (C[0][1] + C[1][1]);
        VP[i] = -C[1][0] + C[1][1] * HP[i];
    }
    return [HP.slice(1, -1), VP.slice(1, -1)];
}

function legacyTriple(link: Pipe, H0: number[], V0: number[], dt: number, g: number, H: number[], V: number[]): void {
    const n = H0.length - 1;
    const first = legacyInner(link, H0, V0, dt, g);
    const second = legacyInner(link, H0, V0, dt, g);
    H.splice(1, n - 1, ...first[0]);
    V.splice(1, n - 1, ...second[1]);
    const [HP, VP] = legacyInner(link, H0, V0, dt, g);
    for (let i = 0; i < HP.length; i++) {
        H[i + 1] = HP[i];
        V[i + 1] = VP[i];
    }
}

const POINTS = 2002;
const REPS = 200;
const pipe = {
    id: 1,
    roughness: 0.02,
    diameter: 0.3,
    wavev: 1000,
    theta: 0,
} as Pipe;
const H0 = Array.from({ length: POINTS }, (_, i) => 100 - i * 0.01);
const V0 = new Array(POINTS).fill(1.2);
const dt = 0.01;
const g = 9.8;
const H = new Array(POINTS).fill(0);
const V = new Array(POINTS).fill(0);
const HN = [new Array(POINTS).fill(0)];
const VN = [new Array(POINTS).fill(0)];

const legacyMs = ms(() => legacyTriple(pipe, H0, V0, dt, g, H, V), REPS);
const jsMs = ms(() => inner_node_steady_into(pipe, H0, V0, dt, g, H, V), REPS);
setSteadyInteriorEngine('wasm');
const wasmMs = ms(() => {
    fillSteadyInteriors([pipe], [H0], [V0], HN, VN, dt);
}, REPS);

print('Steady interior, 2000 segments, 200 repeats');
print(`  previous JS (3 calls + allocations)  ${legacyMs.toFixed(1)} ms`);
print(`  new JS writer                         ${jsMs.toFixed(1)} ms   ${ (legacyMs / jsMs).toFixed(2) }x`);
print(`  WASM kernel                           ${wasmMs.toFixed(1)} ms   ${ (legacyMs / wasmMs).toFixed(2) }x vs previous, ${ (jsMs / wasmMs).toFixed(2) }x vs new JS`);

const inp = path.join(path.dirname(fileURLToPath(import.meta.url)), '../examples/networks/Tnet0.inp');

async function runTnet0(engine: 'js' | 'wasm', outputEvery = 1): Promise<number> {
    setSteadyInteriorEngine(engine);
    const once = async () => {
        let tm = await TransientModel.create(inp);
        tm.set_wavespeed(1200);
        tm.set_time(2, 0.01);
        tm.valve_closure('3', [0, 0, 0, 1]);
        tm = Initializer(tm, 0, 'PDD');
        MOCSimulator(tm, 'no', 'steady', undefined, outputEvery);
    };
    await once();
    const t0 = performance.now();
    const reps = 5;
    for (let i = 0; i < reps; i++) await once();
    return (performance.now() - t0) / reps;
}

const e2eJs = await runTnet0('js');
const e2eWasm = await runTnet0('wasm');
const e2eThin = await runTnet0('js', 10);
print('Tnet0 steady, tf=2 s, dt=0.01 s, mean of 5 runs');
print(`  JS interior     ${e2eJs.toFixed(1)} ms`);
print(`  WASM interior   ${e2eWasm.toFixed(1)} ms`);
print(`  JS, outputEvery=10  ${e2eThin.toFixed(1)} ms`);
setSteadyInteriorEngine('auto');
