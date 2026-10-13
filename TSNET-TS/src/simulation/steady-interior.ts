import type { Pipe } from '../epanet-bridge.ts';

interface WasmMemory {
    buffer: ArrayBuffer;
    grow(pages: number): number;
}

declare const WebAssembly: {
    Module: new (bytes: Uint8Array) => object;
    Instance: new (module: object) => { exports: Record<string, unknown> };
};

const G = 9.8;

export type SteadyInteriorEngine = 'auto' | 'js' | 'wasm';

let engine: SteadyInteriorEngine = 'auto';
let kernel: SteadyKernel | null | undefined;
let lastUsedWasm = false;

interface SteadyKernel {
    compute(
        pipes: Pipe[],
        H: number[][],
        V: number[][],
        HN: number[][],
        VN: number[][],
        dt: number,
    ): void;
}

/**
 * Choose the steady-friction interior.
 * `auto` and `js` use the JS writer. `wasm` uses the kernel and throws if it cannot load.
 * The bench shows the JS writer is faster than copying every pipe into WASM, so auto stays on JS.
 */
export function setSteadyInteriorEngine(next: SteadyInteriorEngine): void {
    engine = next;
    lastUsedWasm = false;
}

export function steadyKernelLoaded(): boolean {
    return loadKernel() !== null;
}

export function steadyInteriorUsedWasm(): boolean {
    return lastUsedWasm;
}

/**
 * Fill steady-friction interior nodes for every pipe.
 * Returns true when the WASM kernel did the write (callers should skip the JS interior).
 */
export function fillSteadyInteriors(
    pipes: Pipe[],
    H: number[][],
    V: number[][],
    HN: number[][],
    VN: number[][],
    dt: number,
): boolean {
    lastUsedWasm = false;
    if (engine !== 'wasm') return false;
    const active = loadKernel();
    if (!active) {
        throw new Error('Steady interior WASM kernel failed to load');
    }
    active.compute(pipes, H, V, HN, VN, dt);
    lastUsedWasm = true;
    return true;
}

function loadKernel(): SteadyKernel | null {
    if (kernel !== undefined) return kernel;
    try {
        kernel = instantiate();
    } catch {
        kernel = null;
    }
    return kernel;
}

function instantiate(): SteadyKernel {
    const bytes = Uint8Array.from(atob(WASM_BASE64), (c) => c.charCodeAt(0));
    const mod = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(mod);
    const memory = instance.exports.memory as WasmMemory;
    const steady = instance.exports.steady_interiors as (
        nPipes: number,
        offs: number,
        props: number,
        dt: number,
        g: number,
        hIn: number,
        vIn: number,
        hOut: number,
        vOut: number,
    ) => void;

    return {
        compute(pipes, H, V, HN, VN, dt) {
            const n = pipes.length;
            let points = 0;
            for (let i = 0; i < n; i++) points += H[pipes[i].id - 1].length;
            const offsBytes = (n + 1) * 4;
            const propsBytes = n * 4 * 8;
            const seriesBytes = points * 8;
            const base = 0;
            const offsPtr = align8(base + offsBytes);
            const propsPtr = offsPtr;
            const hInPtr = propsPtr + propsBytes;
            const vInPtr = hInPtr + seriesBytes;
            const hOutPtr = vInPtr + seriesBytes;
            const vOutPtr = hOutPtr + seriesBytes;
            const need = vOutPtr + seriesBytes;
            const page = 65536;
            const have = memory.buffer.byteLength;
            if (have < need) {
                memory.grow(Math.ceil((need - have) / page));
            }
            const view = new DataView(memory.buffer);
            const f64 = new Float64Array(memory.buffer);
            let cursor = 0;
            view.setUint32(base, 0, true);
            for (let p = 0; p < n; p++) {
                const pn = pipes[p].id - 1;
                const len = H[pn].length;
                const hIn = f64.subarray((hInPtr / 8) + cursor, (hInPtr / 8) + cursor + len);
                const vIn = f64.subarray((vInPtr / 8) + cursor, (vInPtr / 8) + cursor + len);
                hIn.set(H[pn]);
                vIn.set(V[pn]);
                view.setFloat64(propsPtr + p * 32, pipes[p].roughness, true);
                view.setFloat64(propsPtr + p * 32 + 8, pipes[p].diameter, true);
                view.setFloat64(propsPtr + p * 32 + 16, pipes[p].theta, true);
                view.setFloat64(propsPtr + p * 32 + 24, pipes[p].wavev, true);
                cursor += len;
                view.setUint32(base + (p + 1) * 4, cursor, true);
            }
            steady(n, base, propsPtr, dt, G, hInPtr, vInPtr, hOutPtr, vOutPtr);
            cursor = 0;
            const out = new Float64Array(memory.buffer);
            for (let p = 0; p < n; p++) {
                const pn = pipes[p].id - 1;
                const len = H[pn].length;
                const hSrc = out.subarray((hOutPtr / 8) + cursor, (hOutPtr / 8) + cursor + len);
                const vSrc = out.subarray((vOutPtr / 8) + cursor, (vOutPtr / 8) + cursor + len);
                for (let i = 1; i < len - 1; i++) {
                    HN[pn][i] = hSrc[i];
                    VN[pn][i] = vSrc[i];
                }
                cursor += len;
            }
        },
    };
}

function align8(n: number): number {
    return (n + 7) & ~7;
}

// Built from native/moc-steady (`rustc --target wasm32-unknown-unknown`).
const WASM_BASE64 = 'AGFzbQEAAAABDQFgCX9/f3x8f39/fwADAgEABQMBABAGGQN/AUGAgMAAC38AQYCAwAALfwBBgIDAAAsHOAQGbWVtb3J5AgAQc3RlYWR5X2ludGVyaW9ycwAACl9fZGF0YV9lbmQDAQtfX2hlYXBfYmFzZQMCCuYCAeMCBgR/BXwEfwF8AX8BfAJAIABFDQAgCEEIaiEJIAdBCGohCkEAIQsDQAJAIAEgCyIIQQJ0aigCACIHQQJqIAEgCEEBaiILQQJ0aigCACIMTw0AIAMgAiAIQQV0aiIIKwMAokQAAAAAAADgP6IgCEEIaisDAKMhDSADIAQgCEEYaisDAKMiDqIhDyAIQRBqKwMAIRAgDiAOoCERIAdBA3QhCCAMIAdrQX5qIRIgBSEHIAYhDCAJIRMgCiEUA0AgFCAIaiAQIA8gDCAIaiIVKwMAIhaioiAWIA4gByAIaiIXKwMAoqAgDSAWoiAWmaKhoCAQIA8gFUEQaisDACIWoqIgDSAWoiAWmaIgDiAXQRBqKwMAoiAWoaCgIhagIBGjIhg5AwAgEyAIaiAOIBiiIBahOQMAIAdBCGohByAMQQhqIQwgE0EIaiETIBRBCGohFCASQX9qIhINAAsLIAsgAEcNAAsLCwBABG5hbWUAEA9tb2Nfc3RlYWR5Lndhc20BEwEAEHN0ZWFkeV9pbnRlcmlvcnMHEgEAD19fc3RhY2tfcG9pbnRlcgBNCXByb2R1Y2VycwIIbGFuZ3VhZ2UBBFJ1c3QADHByb2Nlc3NlZC1ieQEFcnVzdGMdMS45MC4wICgxMTU5ZTc4YzQgMjAyNS0wOS0xNCkAlAEPdGFyZ2V0X2ZlYXR1cmVzCCsLYnVsay1tZW1vcnkrD2J1bGstbWVtb3J5LW9wdCsWY2FsbC1pbmRpcmVjdC1vdmVybG9uZysKbXVsdGl2YWx1ZSsPbXV0YWJsZS1nbG9iYWxzKxNub250cmFwcGluZy1mcHRvaW50Kw9yZWZlcmVuY2UtdHlwZXMrCHNpZ24tZXh0';
