import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';
import { random } from 'numpy-ts';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet3.inp';
let tm = await TransientModel.create(inp_file);

// Set wavespeed (random, but use fixed seed for reproducibility)
random.seed(42);
const wavespeed = Array.from(random.normal(1200., 100., [tm.num_pipes]) as any) as number[];
tm.set_wavespeed(wavespeed);

// Set time step
const tf = 20; // simulation period [s]
tm.set_time(tf);

// Add burst
const ts = 1;  // burst start time
const tc = 1;  // time for burst to fully develop
const final_burst_coeff = 0.01; // final burst coeff [m^3/s/(m H20)^(1/2)]
tm.add_burst('JUNCTION-20', ts, tc, final_burst_coeff);

// Initialize steady state simulation
const t0 = 0.; // initialize the simulation at 0s
const engine = 'PDD'; // pressure dependent demand
tm = Initializer(tm, t0, engine);

// Transient simulation
const result_obj = 'Tnet3'; // name of the object for saving simulation results
tm = MOCSimulator(tm, result_obj);

// Output results as JSON
const node22 = tm.get_node('JUNCTION-22');
const node20 = tm.get_node('JUNCTION-20');
const pipe40 = tm.get_link('LINK-40');
const node8 = tm.get_node('JUNCTION-8');
const node16 = tm.get_node('JUNCTION-16');
const node45 = tm.get_node('JUNCTION-45');
const node90 = tm.get_node('JUNCTION-90');

const results = {
  meta: { example: 'Tnet3-burst-leak', network: 'Tnet3.inp' },
  time: tm.simulation_timestamps,
  nodes: {
    'JUNCTION-22': {
      head: node22._head,
      emitter_discharge: node22.emitter_discharge
    },
    'JUNCTION-20': {
      head: node20._head,
      emitter_discharge: node20.emitter_discharge
    },
    'JUNCTION-8': { head: node8._head },
    'JUNCTION-16': { head: node16._head },
    'JUNCTION-45': { head: node45._head },
    'JUNCTION-90': { head: node90._head }
  },
  pipes: {
    'LINK-40': {
      start_node_velocity: pipe40.start_node_velocity,
      end_node_velocity: pipe40.end_node_velocity
    }
  }
};

writeFileSync('results/Tnet3-burst-leak.json', JSON.stringify(results));
console.log('Results written to results/Tnet3-burst-leak.json');
