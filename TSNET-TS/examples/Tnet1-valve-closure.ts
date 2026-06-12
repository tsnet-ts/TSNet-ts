import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
let tm = await TransientModel.create('networks/Tnet1.inp');

// Set wavespeed
tm.set_wavespeed(1200.); // m/s

// Set time options
const tf = 20; // simulation period [s]
tm.set_time(tf);

// Set valve closure
const ts = 5;  // valve closure start time [s]
const tc = 1;  // valve closure period [s]
const se = 0;  // end open percentage [s]
const m = 2;   // closure constant [dimensionless]
tm.valve_closure('VALVE', [tc, ts, se, m]);

// Initialize steady state simulation
const t0 = 0;
tm = Initializer(tm, t0);

// Transient simulation
tm = MOCSimulator(tm);

// Output results as JSON
const nodes = ['N2', 'N3'];
const results = {
  meta: { example: 'Tnet1-valve-closure', network: 'Tnet1.inp' },
  time: tm.simulation_timestamps,
  nodes: Object.fromEntries(nodes.map(n => [n, { head: tm.get_node(n)._head }]))
};

writeFileSync('results/Tnet1-valve-closure.json', JSON.stringify(results));
console.log('Results written to results/Tnet1-valve-closure.json');
