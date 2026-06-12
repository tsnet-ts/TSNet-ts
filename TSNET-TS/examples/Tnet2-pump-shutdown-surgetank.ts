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

const tf = 20; // simulation period [s]
const t0 = 0.; // initialize the simulation at 0s
const engine = 'DD'; // demand driven
const results_obj = 'Tnet2'; // name of the object for saving simulation results

// --- Without surge tank ---
let tm1 = await TransientModel.create(inp_file);
tm1.set_wavespeed(1200.);
tm1.set_time(tf);
tm1.pump_shut_off('PUMP2', pump_op);
tm1 = Initializer(tm1, t0, engine);
tm1 = MOCSimulator(tm1, results_obj);

// --- With closed surge tank ---
let tm2 = await TransientModel.create(inp_file);
tm2.set_wavespeed(1200.);
tm2.set_time(tf);
tm2.pump_shut_off('PUMP2', pump_op);
tm2 = Initializer(tm2, t0, engine);

const tank_node = 'JUNCTION-105';
const tank_area = 10; // tank cross sectional area [m^2]
const tank_height = 10; // tank height [m]
const water_height = 5; // initial water level [m]
tm2.add_surge_tank(tank_node, [tank_area, tank_height, water_height], 'closed');

tm2 = MOCSimulator(tm2, results_obj);

// Output results as JSON
const node = '169';
const head1 = tm1.get_node(node)._head;
const head2 = tm2.get_node(node)._head;

const results = {
  meta: { example: 'Tnet2-pump-shutdown-surgetank', network: 'Tnet2.inp' },
  time: tm1.simulation_timestamps,
  nodes: {
    '169': {
      head_no_tank: head1,
      head_closed_tank: head2
    }
  }
};

writeFileSync('results/Tnet2-pump-shutdown-surgetank.json', JSON.stringify(results));
console.log('Results written to results/Tnet2-pump-shutdown-surgetank.json');
