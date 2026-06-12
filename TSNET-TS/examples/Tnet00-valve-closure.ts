import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet00.inp';
let tm = await TransientModel.create(inp_file);

// Set wavespeed
tm.set_wavespeed(1200.); // m/s

// Set time options
const dt = 0.1;
const tf = 60; // simulation period [s]
tm.set_time(tf, dt);

// Set valve closure
const tc = 0;  // valve closure period [s]
const ts = 2;  // valve closure start time [s]
const se = 0;  // end open percentage [s]
const m = 1;   // closure constant [dimensionless]
const valve_op = [tc, ts, se, m];
tm.valve_closure('3', valve_op);

// Initialize steady state simulation
const t0 = 0.; // initialize the simulation at 0 [s]
const engine = 'DD'; // demand driven simulator
tm = Initializer(tm, t0, engine);

// Transient simulation
const results_obj = 'Tnet0'; // name of the object for saving simulation results
tm = MOCSimulator(tm, results_obj);

// Output results as JSON
const node = tm.get_node('3');

const results = {
  meta: { example: 'Tnet00-valve-closure', network: 'Tnet00.inp' },
  time: tm.simulation_timestamps,
  nodes: {
    '3': { head: node._head }
  }
};

writeFileSync('results/Tnet00-valve-closure.json', JSON.stringify(results));
console.log('Results written to results/Tnet00-valve-closure.json');
