import { writeFileSync } from 'fs';
import { TransientModel, Initializer, MOCSimulator } from '@tsnet-ts/ts-net';

// Open an example network and create a transient model
const inp_file = 'networks/Tnet0.inp';

// Valve closure parameters
const tc = 0;  // valve closure period [s]
const ts = 2;  // valve closure start time [s]
const se = 0;  // end open percentage [s]
const m = 1;   // closure constant [dimensionless]
const valve_op = [tc, ts, se, m];

const dt = 0.1;
const tf = 60; // simulation period [s]
const t0 = 0.; // initialize the simulation at 0 [s]
const engine = 'DD'; // demand driven simulator
const results_obj = 'Tnet0'; // name of the object for saving simulation results

// --- With open surge tank ---
let tm1 = await TransientModel.create(inp_file);
tm1.set_wavespeed(1200.); // m/s
tm1.set_time(tf, dt);
tm1.valve_closure('3', valve_op);
tm1 = Initializer(tm1, t0, engine);

const tank_node = '2';
const tank_area = 100; // tank cross sectional area [m^2]
tm1.add_surge_tank(tank_node, [tank_area], 'open');

tm1 = MOCSimulator(tm1, results_obj);

// --- With closed surge tank (air chamber) ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(1200.); // m/s
tm2.set_time(tf, dt);
tm2.valve_closure('3', valve_op);
tm2 = Initializer(tm2, t0, engine);

const tank_height = 100; // tank height [m]
const water_height = 40; // initial water level [m]
tm2.add_surge_tank(tank_node, [10, tank_height, water_height], 'closed');

tm2 = MOCSimulator(tm2, results_obj);

// --- Without surge tank ---
let tm3 = await TransientModel.create(inp_file);
tm3.set_wavespeed(1200.); // m/s
tm3.set_time(tf, dt);
tm3.valve_closure('3', valve_op);
tm3 = Initializer(tm3, t0, engine);

tm3 = MOCSimulator(tm3, results_obj);

// Output results as JSON
const node = '3';
const head1 = tm1.get_node(node)._head;
const head2 = tm2.get_node(node)._head;
const head3 = tm3.get_node(node)._head;

const results = {
  meta: { example: 'Tnet0-valve-closure-surge-tank', network: 'Tnet0.inp' },
  time: tm1.simulation_timestamps,
  nodes: {
    [node]: {
      head_open_tank: head1,
      head_closed_tank: head2,
      head_no_tank: head3
    }
  },
  tank_flow: {
    open_tank: tm1.get_node(tank_node).tank_flow_timeseries,
    closed_tank: tm2.get_node(tank_node).tank_flow_timeseries
  }
};

writeFileSync('results/Tnet0-valve-closure-surge-tank.json', JSON.stringify(results));
console.log('Results written to results/Tnet0-valve-closure-surge-tank.json');
