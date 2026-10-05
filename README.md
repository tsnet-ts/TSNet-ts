# TSNet-ts

**Water-hammer & hydraulic transient simulation in TypeScript** — Method of Characteristics on EPANET `.inp` networks, in the browser or as an npm library.

[![npm](https://img.shields.io/npm/v/@tsnet-ts/ts-net)](https://www.npmjs.com/package/@tsnet-ts/ts-net)
[![License: MIT (library)](https://img.shields.io/badge/license-MIT%20(library)-blue.svg)](./TSNET-TS/LICENSE)
[![Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://tsnet-ts.github.io/TSNet-ts/)

<!-- Optional: drop a demo screenshot at docs/demo.png, then uncomment:
![TSNet-TS demo](docs/demo.png)
-->

**Try it live:** [tsnet-ts.github.io/TSNet-ts](https://tsnet-ts.github.io/TSNet-ts/) · **Install:** `npm install @tsnet-ts/ts-net`

### Features
- Load EPANET `.inp` networks and run MOC transients (no server required for the demo)
- Events: valve closure, pump trip, pipe burst, leaks, demand pulse, surge tank
- Steady / quasi-steady / unsteady friction
- Steady-state init (demand-driven or pressure-dependent demand)
- Browser UI plus a publishable MIT library (`@tsnet-ts/ts-net`)

| Package | Directory | License |
|---------|-----------|---------|
| **@tsnet-ts/ts-net** | [`TSNET-TS/`](./TSNET-TS/) | [MIT](./TSNET-TS/LICENSE) |
| **react-ts** (web app) | [`React-TS/`](./React-TS/) | [PolyForm Noncommercial 1.0.0](./React-TS/LICENSE) |

TypeScript port of [TSNet](https://github.com/glorialulu/TSNet) (Xing & Sela).

### Cite TSNet
If you use this work, please cite the original TSNet paper:

> Xing, L., & Sela, L. (2020). Transient simulations in water distribution networks: TSNet python package. *Advances in Engineering Software*, 149, 102884. https://doi.org/10.1016/j.advengsoft.2020.102884

## Getting started

```bash
bun install         # install all workspace packages
bun run build       # build library + web app
bun run dev         # start React-TS dev server (port 5173)
bun test            # run ts-net tests
```


## Workspace scripts

| Command | Description |
|---------|-------------|
| `bun run --cwd TSNET-TS build` | Compile TSNET-TS to `dist/` |
| `bun run --cwd React-TS build` | Build React-TS for production |
| `bun run --cwd TSNET-TS test` | Run Vitest tests |
| `bun run --cwd React-TS dev` | Vite dev server |



## License

| Package | License |
|---------|---------|
| **@tsnet-ts/ts-net** ([`TSNET-TS/`](./TSNET-TS/)) | [MIT](./TSNET-TS/LICENSE) |
| **react-ts** ([`React-TS/`](./React-TS/)) | [PolyForm Noncommercial 1.0.0](./React-TS/LICENSE) — commercial use requires [approval](./React-TS/COMMERCIAL.md) |
