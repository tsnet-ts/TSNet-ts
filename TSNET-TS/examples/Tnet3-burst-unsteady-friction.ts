import { readFileSync, writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

function loadWavespeed(expectedPipeCount: number): number[] {
  const wavespeed = JSON.parse(
    readFileSync(new URL('wavespeeds_tnet3_seed42.json', import.meta.url), 'utf-8')
  ) as number[];

  if (wavespeed.length !== expectedPipeCount) {
    throw new Error(
      `Expected ${expectedPipeCount} wavespeeds, found ${wavespeed.length} in wavespeeds_tnet3_seed42.json`
    );
  }

  return wavespeed;
}

// Open an example network and create a transient model
const inp_file = 'networks/Tnet3.inp';

// Burst parameters
const ts = 1;  // burst start time
const tc = 1;  // time for burst to fully develop
const final_burst_coeff = 0.01; // final burst coeff [m^3/s/(m H20)^(1/2)]

const tf = 20; // simulation period [s]
const t0 = 0.; // initialize the simulation at 0s
const engine = 'DD'; // demand driven
const result_obj = 'Tnet3'; // name of the object for saving simulation results

// --- Steady friction ---
let tm1 = await TransientModel.create(inp_file);
const wavespeed = loadWavespeed(tm1.num_pipes);
tm1.set_wavespeed(wavespeed);
tm1.set_time(tf);
tm1.add_burst('JUNCTION-73', ts, tc, final_burst_coeff);
tm1 = Initializer(tm1, t0, engine);
tm1 = MOCSimulator(tm1, result_obj, 'steady');

// --- Quasi-steady friction ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(wavespeed);
tm2.set_time(tf);
tm2.add_burst('JUNCTION-73', ts, tc, final_burst_coeff);
tm2 = Initializer(tm2, t0, engine);
tm2 = MOCSimulator(tm2, result_obj, 'quasi-steady');

// --- Unsteady friction ---
let tm3 = await TransientModel.create(inp_file);
tm3.set_wavespeed(wavespeed);
tm3.set_time(tf);
tm3.add_burst('JUNCTION-73', ts, tc, final_burst_coeff);
tm3 = Initializer(tm3, t0, engine);
tm3 = MOCSimulator(tm3, result_obj, 'unsteady');

// Output results as JSON
const nodes_list = ['JUNCTION-16', 'JUNCTION-20', 'JUNCTION-30', 'JUNCTION-45', 'JUNCTION-90'];
const nodesData: Record<string, any> = {};
for (const n of nodes_list) {
  nodesData[n] = {
    head_steady: tm1.get_node(n)._head,
    head_quasi_steady: tm2.get_node(n)._head,
    head_unsteady: tm3.get_node(n)._head
  };
}

const results = {
  meta: {
    example: 'Tnet3-burst-unsteady-friction',
    network: 'Tnet3.inp',
    wavespeedSource: 'wavespeeds_tnet3_seed42.json'
  },
  time: tm1.simulation_timestamps,
  nodes: nodesData
};

writeFileSync('results/Tnet3-burst-unsteady-friction.json', JSON.stringify(results));
console.log('Results written to results/Tnet3-burst-unsteady-friction.json');
