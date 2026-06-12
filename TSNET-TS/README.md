# @tsnet-ts/ts-net

TypeScript library for **transient hydraulic simulation** of water distribution networks using the Method of Characteristics (MOC).

This project is a TypeScript port of [TSNet](https://github.com/glorialulu/TSNet), maintaining structural parity with the original Python implementation.

## Features

- Load EPANET `.inp` network files via [epanet-js](https://www.npmjs.com/package/epanet-js)
- Steady-state initialization (demand-driven or pressure-dependent demand)
- Transient simulation with MOC (Method of Characteristics)
- Support for valves, pumps, bursts, leaks, demand pulses, and surge tanks
- Friction models: steady, quasi-steady, and unsteady
- Post-processing utilities for time-history analysis

## Installation

```bash
npm install @tsnet-ts/ts-net
```

## Quick start

```typescript
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

const tm = await TransientModel.create('networks/Tnet0.inp');

tm.set_wavespeed(1200); // m/s
tm.set_time(25, 0.01);  // duration [s], time step [s]

// Valve closure: [closure period, start time, end open %, closure constant]
tm.valve_closure('3', [0, 0, 0, 1]);

let model = Initializer(tm, 0, 'PDD');
model = MOCSimulator(model, 'Tnet0', 'steady');

const node = model.get_node('2');
console.log(node._head);
```

See the [`examples/`](./examples/) directory for more scenarios (pump shutdown, burst, surge tank, demand pulse, etc.).

## API overview

| Module | Exports |
|--------|---------|
| `network` | `TransientModel`, topology, discretization, control events |
| `simulation` | `Initializer`, `MOCSimulator`, boundary/node solvers |
| `postprocessing` | Time-history and change-point detection |
| `utils` | Valve curves, memoization, numeric helpers |
| `epanet-bridge` | WNTR-like wrapper around epanet-js |

## Development

### Prerequisites

- Node.js 20+
- npm or Bun

### Setup

From the monorepo root:

```bash
bun install
bun run --cwd TSNET-TS build
```

Or from this directory:

```bash
bun install
bun run build
```

### Scripts

```bash
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type-check without emitting
npm test           # Run Vitest tests
npm run dev        # Watch mode build
```

### Run an example

```bash
npm run build
npx tsx examples/Tnet0-valve-closure.ts
```

## Package mapping

This library mirrors the Python TSNet stack with these TypeScript equivalents:

| Python | TypeScript |
|--------|------------|
| WNTR | epanet-js |
| numpy | numpy-ts |
| networkx | ndgraph |

## Related projects

- [TSNet (Python)](https://github.com/glorialulu/TSNet) — original implementation

## License

[MIT](./LICENSE)
