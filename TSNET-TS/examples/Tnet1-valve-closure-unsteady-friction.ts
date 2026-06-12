import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';
import { linspace } from 'numpy-ts';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet1.inp';

// Valve closure parameters
const tc = 0.6; // valve closure period [s]
const ts = 0;   // valve closure start time [s]
const se = 0;   // end open percentage [s]
const m = 1;    // closure constant [dimensionless]
const valve_op = [tc, ts, se, m];

// Valve curve
const percent_open_arr = linspace(100, 0, 11);
const percent_open = Array.from({ length: 11 }, (_, i) => percent_open_arr.item(i) as number);
const kl = [1 / 0.2, 2.50, 1.25, 0.625, 0.333, 0.17, 0.100, 0.0556, 0.0313, 0.0167, 0.0];
const curve: [number, number][] = percent_open.map((p, i) => [p, kl[i]]);

const tf = 60;  // simulation period [s]
const n = 100;  // number of segments in the critical pipe
const t0 = 0.;  // initialize the simulation at 0 [s]
const engine = 'DD'; // demand driven simulator
const results_obj = 'Tnet1'; // name of the object for saving simulation results

// --- Steady friction ---
let tm1 = await TransientModel.create(inp_file);
tm1.set_wavespeed(1200.); // m/s
tm1.set_time_N(tf, n);
tm1.valve_closure('VALVE', valve_op, curve);
tm1 = Initializer(tm1, t0, engine);
tm1 = MOCSimulator(tm1, results_obj, 'steady');

// --- Quasi-steady friction ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(1200.); // m/s
tm2.set_time_N(tf, n);
tm2.valve_closure('VALVE', valve_op);
tm2 = Initializer(tm2, t0, engine);
tm2 = MOCSimulator(tm2, results_obj, 'quasi-steady');

// --- Unsteady friction ---
let tm3 = await TransientModel.create(inp_file);
tm3.set_wavespeed(1200.); // m/s
tm3.set_time_N(tf, n);
tm3.valve_closure('VALVE', valve_op);
tm3 = Initializer(tm3, t0, engine);
tm3 = MOCSimulator(tm3, results_obj, 'unsteady');

// Output results as JSON
const node = 'N2';
const head1 = tm1.get_node(node)._head;
const head2 = tm2.get_node(node)._head;
const head3 = tm3.get_node(node)._head;

const results = {
  meta: { example: 'Tnet1-valve-closure-unsteady-friction', network: 'Tnet1.inp' },
  time: tm1.simulation_timestamps,
  nodes: {
    'N2': {
      head_steady: head1,
      head_quasi_steady: head2,
      head_unsteady: head3
    }
  }
};

writeFileSync('results/Tnet1-valve-closure-unsteady-friction.json', JSON.stringify(results));
console.log('Results written to results/Tnet1-valve-closure-unsteady-friction.json');
