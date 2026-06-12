# TSNet-ts

Monorepo for transient hydraulic network simulation in TypeScript.

**Live web demo:** [tsnet-ts.github.io/TSNet-ts](https://tsnet-ts.github.io/TSNet-ts/)

**Repository:** [github.com/tsnet-ts/TSNet-ts](https://github.com/tsnet-ts/TSNet-ts)

| Package | Directory | Description |
|---------|-----------|-------------|
| **@tsnet-ts/ts-net** | [`TSNET-TS/`](./TSNET-TS/) | TypeScript library — MOC transient simulation (publishable to npm) |
| **react-ts** | [`React-TS/`](./React-TS/) | Browser UI for visualizing simulation results (private web app) |

TypeScript port of [TSNet](https://github.com/glorialulu/TSNet).

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
