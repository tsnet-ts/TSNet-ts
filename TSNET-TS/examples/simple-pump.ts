import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/simple_pump.inp';
const tm = await TransientModel.create(inp_file);

// Set wavespeed
tm.set_wavespeed(1200.); // m/s

// Set time options
const tf = 60; // simulation period [s]
tm.set_time(tf);

// Set pump shut off
const tc = 1; // pump closure period
const ts = 0; // pump closure start time
const se = 0; // end open percentage
const m = 1;  // closure constant
const pump_op = [tc, ts, se, m];
tm.pump_shut_off('pump', pump_op);

// Initialize steady state simulation
const t0 = 0.; // initialize the simulation at 0 [s]
const engine = 'DD'; // demand driven simulator
let tmInit = Initializer(tm, t0, engine);

// Transient simulation
const results_obj = 'simple_pump'; // name of the object for saving simulation results
tmInit = MOCSimulator(tmInit, results_obj);

// Output results as JSON
const node = tmInit.get_node('2');
const pipe = tmInit.get_link('p2');

const results = {
  meta: { example: 'simple-pump', network: 'simple_pump.inp' },
  time: tmInit.simulation_timestamps,
  nodes: {
    '2': { head: node._head }
  },
  pipes: {
    'p2': {
      start_node_flowrate: pipe.start_node_flowrate,
      end_node_flowrate: pipe.end_node_flowrate
    }
  }
};

writeFileSync('results/simple-pump.json', JSON.stringify(results));
console.log('Results written to results/simple-pump.json');
