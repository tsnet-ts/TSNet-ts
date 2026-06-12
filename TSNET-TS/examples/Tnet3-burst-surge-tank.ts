import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet3.inp';

// Burst parameters
const wavespeed = 1200;
const ts = 1;  // burst start time
const tc = 1;  // time for burst to fully develop
const final_burst_coeff = 0.01; // final burst coeff [m^3/s/(m H20)^(1/2)]

const tf = 20; // simulation period [s]
const t0 = 0.; // initialize the simulation at 0s
const engine = 'DD'; // demand driven
const result_obj = 'Tnet3'; // name of the object for saving simulation results

// --- Case 1: Without surge tank ---
let tm1 = await TransientModel.create(inp_file);
tm1.set_wavespeed(wavespeed);
tm1.set_time(tf);
tm1.add_burst('JUNCTION-73', ts, tc, final_burst_coeff);
tm1 = Initializer(tm1, t0, engine);
tm1 = MOCSimulator(tm1, result_obj);

// --- Case 2: Closed surge tank (air chamber) ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(wavespeed);
tm2.set_time(tf);
tm2.add_burst('JUNCTION-73', ts, tc, final_burst_coeff);
tm2 = Initializer(tm2, t0, engine);
const tank_node = 'JUNCTION-89';
const tank_area = 10;      // tank cross sectional area [m^2]
const tank_height = 10;    // tank height [m]
const water_height = 5;    // initial water level [m]
tm2.add_surge_tank(tank_node, [tank_area, tank_height, water_height], 'closed');
tm2 = MOCSimulator(tm2, result_obj);

// --- Case 3: Open surge tank ---
let tm3 = await TransientModel.create(inp_file);
tm3.set_wavespeed(wavespeed);
tm3.set_time(tf);
tm3.add_burst('JUNCTION-73', ts, tc, final_burst_coeff);
tm3 = Initializer(tm3, t0, engine);
tm3.add_surge_tank('JUNCTION-89', [10], 'open');
tm3 = MOCSimulator(tm3, result_obj);

// Output results as JSON
const nodes_list = ['JUNCTION-16', 'JUNCTION-20', 'JUNCTION-30', 'JUNCTION-45', 'JUNCTION-90'];
const nodesData: Record<string, any> = {};
for (const n of nodes_list) {
  nodesData[n] = {
    head_no_tank: tm1.get_node(n)._head,
    head_closed_tank: tm2.get_node(n)._head,
    head_open_tank: tm3.get_node(n)._head
  };
}

const results = {
  meta: { example: 'Tnet3-burst-surge-tank', network: 'Tnet3.inp' },
  time: tm1.simulation_timestamps,
  nodes: nodesData
};

writeFileSync('results/Tnet3-burst-surge-tank.json', JSON.stringify(results));
console.log('Results written to results/Tnet3-burst-surge-tank.json');
