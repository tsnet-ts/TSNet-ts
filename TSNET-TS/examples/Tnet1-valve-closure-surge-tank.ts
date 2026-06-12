import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet1.inp';

// Valve closure parameters
const tc = 0.6; // valve closure period [s]
const ts = 0;   // valve closure start time [s]
const se = 0;   // end open percentage [s]
const m = 1;    // closure constant [dimensionless]
const valve_op = [tc, ts, se, m];

const tf = 60;  // simulation period [s]
const n = 6;    // number of segments in the critical pipe
const t0 = 0.;  // initialize the simulation at 0 [s]
const engine = 'DD'; // demand driven simulator
const results_obj = 'Tnet1'; // name of the object for saving simulation results

// --- Closed surge tank A=10 ---
let tm1 = await TransientModel.create(inp_file);
tm1.set_wavespeed(1200.); // m/s
tm1.set_time_N(tf, n);
tm1.valve_closure('VALVE', valve_op);
tm1 = Initializer(tm1, t0, engine);

const tank_height = 10;   // tank height [m]
const water_height = 5;   // initial water level [m]
const tank_node = 'N5';
tm1.add_surge_tank(tank_node, [10, tank_height, water_height], 'closed');

tm1 = MOCSimulator(tm1, results_obj, 'steady');

// --- Closed surge tank A=100 ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(1200.); // m/s
tm2.set_time_N(tf, n);
tm2.valve_closure('VALVE', valve_op);
tm2 = Initializer(tm2, t0, engine);

tm2.add_surge_tank(tank_node, [100, tank_height, water_height], 'closed');

tm2 = MOCSimulator(tm2, results_obj, 'steady');

// --- No surge tank ---
let tm3 = await TransientModel.create(inp_file);
tm3.set_wavespeed(1200.); // m/s
tm3.set_time_N(tf, n);
tm3.valve_closure('VALVE', valve_op);
tm3 = Initializer(tm3, t0, engine);

tm3 = MOCSimulator(tm3, results_obj, 'steady');

// Output results as JSON
const node = 'N2';
const head1 = tm1.get_node(node)._head;
const head2 = tm2.get_node(node)._head;
const head3 = tm3.get_node(node)._head;

const results = {
  meta: { example: 'Tnet1-valve-closure-surge-tank', network: 'Tnet1.inp' },
  time: tm1.simulation_timestamps,
  nodes: {
    'N2': {
      head_closed_tank_A10: head1,
      head_closed_tank_A100: head2,
      head_no_tank: head3
    }
  }
};

writeFileSync('results/Tnet1-valve-closure-surge-tank.json', JSON.stringify(results));
console.log('Results written to results/Tnet1-valve-closure-surge-tank.json');
