import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet2.inp';
let tm = await TransientModel.create(inp_file);

// Set wavespeed
tm.set_wavespeed(1200.); // m/s

// Set time step
const tf = 20; // simulation period [s]
tm.set_time(tf);

// Set pump shut off
const tc = 1; // pump closure period
const ts = 1; // pump closure start time
const se = 0; // end open percentage
const m = 1;  // closure constant
const pump_op = [tc, ts, se, m];
tm.pump_shut_off('PUMP2', pump_op);

// Initialize steady state simulation
const t0 = 0.; // initialize the simulation at 0s
const engine = 'DD'; // demand driven
tm = Initializer(tm, t0, engine);

// Transient simulation
const results_obj = 'Tnet2'; // name of the object for saving simulation results
tm = MOCSimulator(tm, results_obj);

// Output results as JSON
const node = tm.get_node('JUNCTION-105');
const pipe = tm.get_link('PIPE-109');

const results = {
  meta: { example: 'Tnet2-pump-shutdown', network: 'Tnet2.inp' },
  time: tm.simulation_timestamps,
  nodes: {
    'JUNCTION-105': { head: node._head }
  },
  pipes: {
    'PIPE-109': {
      start_node_velocity: pipe.start_node_velocity,
      end_node_velocity: pipe.end_node_velocity
    }
  }
};

writeFileSync('results/Tnet2-pump-shutdown.json', JSON.stringify(results));
console.log('Results written to results/Tnet2-pump-shutdown.json');
