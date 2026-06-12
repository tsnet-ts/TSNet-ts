import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet1.inp';

const dt = 0.1; // time step [s]
const tf = 20;  // simulation period [s]
const t0 = 0.;  // initialize the simulation at 0 [s]
const engine = 'DD'; // demand driven simulator
const results_obj = 'Tnet1'; // name of the object for saving simulation results

// --- First demand pulse ---
let tm1 = await TransientModel.create(inp_file);
tm1.set_wavespeed(1200.); // m/s
tm1.set_time(tf, dt);
tm1 = Initializer(tm1, t0, engine);

// Add demand pulse
const tc1 = 1;   // total demand period [s]
const ts1 = 1;   // demand pulse start time [s]
const tp1 = 0.2; // demand pulse increase time [s]
const dp1 = 1;   // demand pulse increase multiples
const demand_pulse1 = [tc1, ts1, tp1, dp1];
tm1.add_demand_pulse('N2', demand_pulse1);

tm1 = MOCSimulator(tm1, results_obj);

// --- Second demand pulse (two pulses) ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(1200.); // m/s
tm2.set_time(tf, dt);
tm2 = Initializer(tm2, t0, engine);

// Add first demand pulse
tm2.add_demand_pulse('N2', [1, 1, 0.2, 1]);
// Add second demand pulse
tm2.add_demand_pulse('N4', [1, 2, 0.2, 1]);

tm2 = MOCSimulator(tm2, results_obj);

// Output results as JSON
const node = 'N2';
const head1 = tm1.get_node(node)._head;
const head2 = tm2.get_node(node)._head;

const results = {
  meta: { example: 'Tnet1-demand-pulse', network: 'Tnet1.inp' },
  time: tm1.simulation_timestamps,
  nodes: {
    'N2': {
      head_single_pulse: head1,
      head_double_pulse: head2
    }
  }
};

writeFileSync('results/Tnet1-demand-pulse.json', JSON.stringify(results));
console.log('Results written to results/Tnet1-demand-pulse.json');
