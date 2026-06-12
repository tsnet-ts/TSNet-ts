import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet2.inp';

// Pump shut off parameters
const tc = 1; // pump closure period
const ts = 0; // pump closure start time
const se = 0; // end open percentage
const m = 1;  // closure constant
const pump_op = [tc, ts, se, m];

const tf = 10; // simulation period [s]
const t0 = 0.; // initialize the simulation at 0s
const engine = 'DD'; // demand driven
const results_obj = 'Tnet2'; // name of the object for saving simulation results

// --- Steady friction ---
let tm1 = await TransientModel.create(inp_file);
tm1.set_wavespeed(1200.);
tm1.set_time(tf);
tm1.pump_shut_off('PUMP2', pump_op);
tm1 = Initializer(tm1, t0, engine);
tm1 = MOCSimulator(tm1, results_obj, 'steady');

// --- Quasi-steady friction ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(1200.);
tm2.set_time(tf);
tm2.pump_shut_off('PUMP2', pump_op);
tm2 = Initializer(tm2, t0, engine);
tm2 = MOCSimulator(tm2, results_obj, 'quasi-steady');

// --- Unsteady friction ---
let tm3 = await TransientModel.create(inp_file);
tm3.set_wavespeed(1200.);
tm3.set_time(tf);
tm3.pump_shut_off('PUMP2', pump_op);
tm3 = Initializer(tm3, t0, engine);
tm3 = MOCSimulator(tm3, results_obj, 'unsteady');

// Output results as JSON
const node = 'JUNCTION-105';
const head1 = tm1.get_node(node)._head;
const head2 = tm2.get_node(node)._head;
const head3 = tm3.get_node(node)._head;

const results = {
  meta: { example: 'Tnet2-pump-shutdown-unsteady-friction', network: 'Tnet2.inp' },
  time: tm1.simulation_timestamps,
  nodes: {
    'JUNCTION-105': {
      head_steady: head1,
      head_quasi_steady: head2,
      head_unsteady: head3
    }
  }
};

writeFileSync('results/Tnet2-pump-shutdown-unsteady-friction.json', JSON.stringify(results));
console.log('Results written to results/Tnet2-pump-shutdown-unsteady-friction.json');
