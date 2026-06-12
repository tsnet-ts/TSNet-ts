import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet0.inp';

// Set valve closure parameters
const tc = 0;  // valve closure period [s]
const ts = 0;  // valve closure start time [s]
const se = 0;  // end open percentage [s]
const m = 1;   // closure constant [dimensionless]
const valve_op = [tc, ts, se, m];

const dt = 0.01;
const tf = 25; // simulation period [s]
const t0 = 0.; // initialize the simulation at 0 [s]
const engine = 'PDD'; // pressure dependent demand simulator
const results_obj = 'Tnet0'; // name of the object for saving simulation results

// --- Steady friction ---
let tm1 = await TransientModel.create(inp_file);
tm1.set_wavespeed(1200.); // m/s
tm1.set_time(tf, dt);
tm1.valve_closure('3', valve_op);
tm1 = Initializer(tm1, t0, engine);
tm1 = MOCSimulator(tm1, results_obj, 'steady');

// --- Quasi-steady friction ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(1200.); // m/s
tm2.set_time(tf, dt);
tm2.valve_closure('3', valve_op);
tm2 = Initializer(tm2, t0, engine);
tm2 = MOCSimulator(tm2, results_obj, 'quasi-steady');

// --- Unsteady friction ---
let tm3 = await TransientModel.create(inp_file);
tm3.set_wavespeed(1200.); // m/s
tm3.set_time(tf, dt);
tm3.valve_closure('3', valve_op);
tm3 = Initializer(tm3, t0, engine);
tm3 = MOCSimulator(tm3, results_obj, 'unsteady');

// Output results as JSON
const node = '2';
const head1 = tm1.get_node(node)._head;
const head2 = tm2.get_node(node)._head;
const head3 = tm3.get_node(node)._head;

const results = {
  meta: { example: 'Tnet0-valve-closure', network: 'Tnet0.inp' },
  time: tm1.simulation_timestamps,
  nodes: {
    '2': {
      head_steady: head1,
      head_quasi_steady: head2,
      head_unsteady: head3
    }
  }
};

writeFileSync('results/Tnet0-valve-closure.json', JSON.stringify(results));
console.log('Results written to results/Tnet0-valve-closure.json');
