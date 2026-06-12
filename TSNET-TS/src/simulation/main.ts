/**
 * The tsnet.simulation.main module contains function to perform
 * the workflow of read, discretize, initial, and transient
 * simulation for the given .inp file.
 */

import { topology } from '../network/topology.ts';
import { inner_pipe, left_boundary, right_boundary } from './single.ts';
import { valve_curve } from '../utils/valve-curve.ts';
import { calc_parabola_vertex } from '../utils/calc-parabola-vertex.ts';
import { print_time_delta } from '../utils/print-time-delta.ts';
import type { TransientModel } from '../network/model.ts';
import type { Pipe } from '../epanet-bridge.ts';

export function MOCSimulator(tm: TransientModel, results_obj: string = 'results', friction: string = 'steady', onProgress?: (percent: number) => void): TransientModel {
    /**
     * MOC Main Function
     *
     * Parameters
     * ----------
     * tm : TransientModel
     *     Network
     * results_obj: string, optional
     *     the name of the results file, by default 'results'
     * friction: string, optional
     *     friction model, e.g., 'steady', 'quasi-steady', 'unsteady',
     *     by default 'steady'
     * onProgress: function, optional
     *     callback with simulation progress percentage (0-100)
     * Returns
     * ------
     * tm : TransientModel
     *         Simulated network
     */
    // determine network topology
    const [links1, links2, utype, dtype] = topology(tm);

    const tt: number[] = [];
    tt.push(0);
    const dt = tm.time_step;
    const tn = Math.floor(tm.simulation_period / tm.time_step);  // Total time steps
    // check whether input is legal
    if (!['steady', 'unsteady', 'quasi-steady'].includes(friction)) {
        console.log("Please specify a friction model from 'steady', 'unsteady', and 'quasi-steady'");
    }

    // determine which node of the adjacent pipe should be call:
    // if the adjacent pipe is entering the junction, then -2
    // if the adjacent pipe is leaving the junction, then 1
    const a: { [key: number]: number } = { 1: -2, [-1]: 1 };
    const b: { [key: number]: number } = { 1: -1, [-1]: 0 };
    // Python-style negative indexing helper
    const pyAt = (arr: number[], idx: number): number => idx >= 0 ? arr[idx] : arr[arr.length + idx];
    // generate a list of pipe
    const p: Pipe[] = [];
    // results from last time step
    const H: number[][] = new Array(tm.num_pipes).fill(null).map(() => []);
    const V: number[][] = new Array(tm.num_pipes).fill(null).map(() => []);
    // results at current time step
    const HN: number[][] = new Array(tm.num_pipes).fill(null).map(() => []);
    const VN: number[][] = new Array(tm.num_pipes).fill(null).map(() => []);
    // results for local and convective
    //  instantaneous acceleration
    const dVdt: number[][] = new Array(tm.num_pipes).fill(null).map(() => []);
    const dVdx: number[][] = new Array(tm.num_pipes).fill(null).map(() => []);
    const Hb = 10.3; // barometric head

    for (const [, pipe] of tm.pipes()) {
        p.push(pipe);
    }

    // initial condition
    for (const [, pipe] of tm.pipes()) {
        const pn = pipe.id - 1;
        H[pn] = [...pipe.initial_head];
        V[pn] = [...pipe.initial_velocity];
        if (friction === 'unsteady') {
            dVdt[pn] = new Array(V[pn].length).fill(0);
            dVdx[pn] = V[pn].slice(1).map((v, i) => (v - V[pn][i]) / (pipe.length / pipe.number_of_segments));
        } else {
            dVdt[pn] = new Array(V[pn].length).fill(0);
            dVdx[pn] = new Array(V[pn].length - 1).fill(0);
        }
    }

    for (const [, node] of tm.nodes()) {
        if (node.pulse_status === true) {
            node.base_demand_coeff = node.demand_coeff;
        }
        if (node.transient_node_type === 'SurgeTank' || node.transient_node_type === 'Chamber') {
            if (node.transient_node_type === 'Chamber') {
                const m = 1.2;
                const Ha = node.initial_head - node.water_level + Hb; // air pressure head
                const Va = node.tank_shape[0] * (node.tank_height - node.water_level); // air volume
                node.air_constant = Ha * Va ** m;
                node.tank_shape.splice(2, 0, node.air_constant);
            } else if (node.transient_node_type === 'SurgeTank') {
                node.water_level = node.initial_head;
                node.tank_shape.splice(1, 0, node.water_level);
            }
            node.water_level_timeseries = new Array(tn).fill(0);
            node.tank_flow_timeseries = new Array(tn).fill(0);
            node.water_level_timeseries[0] = node.water_level;
        }
    }

    const starttime = Date.now();
    // Start Calculation
    for (let ts = 1; ts < tn; ts++) {
        // check the discrepancy between initial condition and the
        // first step in the transient simulation.
        if (ts === 2) {
            for (const [, pipe] of tm.pipes()) {
                const diff1 = pipe.start_node_head[1] - pipe.start_node_head[0];
                const diff2 = pipe.end_node_head[1] - pipe.end_node_head[0];
                if (Math.abs(diff1) > 5e-1) {
                    console.log(`Initial condition discrepancy of pressure (${diff1.toFixed(4)} m) on the ${pipe.start_node.name} node`);
                }
                if (Math.abs(diff2) > 5e-1) {
                    console.log(`Initial condition discrepancy of pressure (${diff2.toFixed(4)} m) on the ${pipe.end_node.name} node`);
                }
            }
        }
        if (ts === 3) {
            const timeperstep = (Date.now() - starttime) / 2.;
            const est = timeperstep * tn;
            console.log('Estimated simulation time %s', print_time_delta(est / 1000));
        }

        const t = ts * dt;
        tt.push(t);
        const tp = ts / tn * 100;
        if (ts % Math.floor(tn / 10) === 0) {
            console.log('Transient simulation completed %i %%...', Math.floor(tp));
            onProgress?.(Math.floor(tp));
        }
        // for burst node: emitter_coeff = burst_coeff[ts]
        for (const [, node] of tm.nodes()) {
            if (node.burst_status === true) {
                node.emitter_coeff = (node.burst_coeff as unknown as number[])[ts];
            }
            if (node.pulse_status === true) {
                node.demand_coeff = node.base_demand_coeff * (1. + (node.pulse_coeff as unknown as number[])[ts]);
            }
        }

        // initialize the results at this time step
        for (const [, pipe] of tm.pipes()) {
            const pn = pipe.id - 1;
            HN[pn] = new Array(H[pn].length).fill(0);
            VN[pn] = new Array(V[pn].length).fill(0);
        }

        for (const [, pipe] of tm.pipes()) {
            const pn = pipe.id - 1;
            // Assumption:
            // when a pipe is connected with a pump or valve,
            // the connection is not branch junction.

            // inner pipes
            if ((links1[pn] as number[]).length && (links2[pn] as number[]).length &&
                (links1[pn] as string[])[0] !== 'End' && (links2[pn] as string[])[0] !== 'End') {
                // list to store information about pump and valve
                // pump[0] and valve[0] for upstream elements
                // pump[1] and valve[1] for downstream elements
                const pump: [unknown[], unknown[]] = [[], []];
                const valve: [number, number] = [0, 0];
                // upstream
                if (utype[pn][0] === 'Pump') {
                    // three points for pump characteristics curve
                    pump[0] = [tm.links_map[utype[pn][1] as string].curve_coef, "d"];
                    if (pipe.start_node.name === tm.links_map[utype[pn][1] as string].start_node.name) {
                        (pump[0] as unknown[])[1] = "s"; // suction side
                    }
                    // calculate the coordinate of the three points
                    // based on the pump speed
                    if (tm.links_map[utype[pn][1] as string].operating === true) {
                        const points = tm.links_map[utype[pn][1] as string].get_pump_curve().points;
                        const po = (tm.links_map[utype[pn][1] as string].operation_rule as unknown as number[])[ts];
                        const scaled: [[number, number], [number, number], [number, number]] = points.map(([i, j]) => [i * po, j * po ** 2] as [number, number]) as [[number, number], [number, number], [number, number]];
                        (pump[0] as unknown[])[0] = calc_parabola_vertex(scaled);
                    }
                } else if (utype[pn][0] === 'Valve') {
                    // determine valve friction coefficients based on
                    // open percentage
                    if (tm.links_map[utype[pn][1] as string].operating === true) {
                        valve[0] = valve_curve(
                            (tm.links_map[utype[pn][1] as string].operation_rule as unknown as number[])[ts] * 100,
                            tm.links_map[utype[pn][1] as string].valve_coeff);
                    } else {
                        if (tm.links_map[utype[pn][1] as string].initial_status.name === 'Open') {
                            valve[0] = valve_curve(100, tm.links_map[utype[pn][1] as string].valve_coeff);
                        } else if (tm.links_map[utype[pn][1] as string].initial_status.name === 'Closed') {
                            valve[0] = valve_curve(0, tm.links_map[utype[pn][1] as string].valve_coeff);
                        }
                    }
                }
                // downstream
                if (dtype[pn][0] === 'Pump') {
                    pump[1] = [tm.links_map[dtype[pn][1] as string].curve_coef, "d"];
                    if (pipe.end_node.name === tm.links_map[dtype[pn][1] as string].start_node.name) {
                        (pump[1] as unknown[])[1] = "s"; // suction side
                    }
                    if (tm.links_map[dtype[pn][1] as string].operating === true) {
                        const points = tm.links_map[dtype[pn][1] as string].get_pump_curve().points;
                        const po = (tm.links_map[dtype[pn][1] as string].operation_rule as unknown as number[])[ts];
                        const scaled: [[number, number], [number, number], [number, number]] = points.map(([i, j]) => [i * po, j * po ** 2] as [number, number]) as [[number, number], [number, number], [number, number]];
                        (pump[1] as unknown[])[0] = calc_parabola_vertex(scaled);
                    }
                } else if (dtype[pn][0] === 'Valve') {
                    if (tm.links_map[dtype[pn][1] as string].operating === true) {
                        valve[1] = valve_curve(
                            (tm.links_map[dtype[pn][1] as string].operation_rule as unknown as number[])[ts] * 100,
                            tm.links_map[dtype[pn][1] as string].valve_coeff);
                    } else {
                        if (tm.links_map[dtype[pn][1] as string].initial_status.name === 'Open') {
                            valve[1] = valve_curve(100, tm.links_map[dtype[pn][1] as string].valve_coeff);
                        } else if (tm.links_map[dtype[pn][1] as string].initial_status.name === 'Closed') {
                            valve[1] = valve_curve(0, tm.links_map[dtype[pn][1] as string].valve_coeff);
                        }
                    }
                }

                const [hn, vn] = inner_pipe(pipe, pn, dt,
                    links1[pn] as number[], links2[pn] as number[], utype[pn] as [string, number | string], dtype[pn] as [string, number | string], p,
                    H[pn], V[pn], HN[pn], VN[pn],
                    (links1[pn] as number[]).map(i => pyAt(H[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links1[pn] as number[]).map(i => pyAt(V[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links2[pn] as number[]).map(i => pyAt(H[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links2[pn] as number[]).map(i => pyAt(V[Math.abs(i) - 1], a[Math.sign(i)])),
                    pump, valve, friction, dVdt[pn], dVdx[pn],
                    (links1[pn] as number[]).map(i => pyAt(dVdt[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links1[pn] as number[]).map(i => pyAt(dVdx[Math.abs(i) - 1], b[Math.sign(i)])),
                    (links2[pn] as number[]).map(i => pyAt(dVdt[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links2[pn] as number[]).map(i => pyAt(dVdx[Math.abs(i) - 1], b[Math.sign(i)])));
                HN[pn] = hn;
                VN[pn] = vn;
                // record results
                pipe.start_node_velocity[ts] = VN[pn][0];
                pipe.end_node_velocity[ts] = VN[pn][VN[pn].length - 1];
                pipe.start_node_flowrate[ts] = VN[pn][0] * pipe.area;
                pipe.end_node_flowrate[ts] = VN[pn][VN[pn].length - 1] * pipe.area;
                pipe.start_node_head[ts] = HN[pn][0];
                pipe.end_node_head[ts] = HN[pn][HN[pn].length - 1];

                if (pipe.start_node.transient_node_type === 'Junction') {
                    if (HN[pn][0] - pipe.start_node.elevation > 0) {
                        const h = HN[pn][0] - pipe.start_node.elevation;
                        pipe.start_node.demand_discharge[ts] = pipe.start_node.demand_coeff * Math.sqrt(h);
                        pipe.start_node.emitter_discharge[ts] = pipe.start_node.emitter_coeff * Math.sqrt(h);
                    } else { // assume reverse flow preventer installed
                        pipe.start_node.emitter_discharge[ts] = 0.;
                        pipe.start_node.demand_discharge[ts] = 0.;
                        console.warn(`Negative pressure on node ${pipe.start_node.name}. Backflow stopped by reverse flow preventer.`);
                    }
                }

                if (pipe.end_node.transient_node_type === 'Junction') {
                    if (HN[pn][HN[pn].length - 1] - pipe.end_node.elevation > 0) {
                        const h = HN[pn][HN[pn].length - 1] - pipe.end_node.elevation;
                        pipe.end_node.emitter_discharge[ts] = pipe.end_node.emitter_coeff * Math.sqrt(h);
                        pipe.end_node.demand_discharge[ts] = pipe.end_node.demand_coeff * Math.sqrt(h);
                    } else { // assume reverse flow preventer installed
                        pipe.end_node.emitter_discharge[ts] = 0.;
                        pipe.end_node.demand_discharge[ts] = 0.;
                        console.warn(`Negative pressure on node ${pipe.start_node.name} Backflow stopped by reverse flow preventer.`);
                    }
                }

            // left boundary pipe
            } else if (!(links1[pn] as number[]).length || (links1[pn] as string[])[0] === 'End') {
                const pump: [unknown[], unknown[]] = [[], []];
                const valve: [number, number] = [0, 0];
                // LEFT BOUNDARY
                if (utype[pn][0] === 'Reservoir' || utype[pn][0] === 'Tank') {
                    // head B.C.
                    HN[pn][0] = pipe.initial_head[0];
                } else if (utype[pn][0] === 'Junction') {
                    VN[pn][0] = pipe.initial_velocity[0];
                } else if (utype[pn][0] === 'Valve') {
                    if (tm.links_map[utype[pn][1] as string].operating === true) {
                        // velocity B.C.
                        VN[pn][0] = pipe.initial_velocity[0] *
                            (tm.links_map[utype[pn][1] as string].operation_rule as unknown as number[])[ts];
                    } else {
                        if (tm.links_map[utype[pn][1] as string].initial_status.name === 'Open') {
                            VN[pn][0] = pipe.initial_velocity[0];
                        } else if (tm.links_map[utype[pn][1] as string].initial_status.name === 'Closed') {
                            valve[0] = 0;
                        }
                    }
                } else if (utype[pn][0] === 'Pump') {
                    // source pump
                    // pump[0][0]: elevation of the reservoir/tank
                    // pump[0][1]: three points for pump characteristic curve
                    pump[0] = [
                        tm.links_map[utype[pn][1] as string].start_node.initial_head,
                        tm.links_map[utype[pn][1] as string].curve_coef
                    ];
                    if (tm.links_map[utype[pn][1] as string].operating === true) {
                        const points = tm.links_map[utype[pn][1] as string].get_pump_curve().points;
                        const po = (tm.links_map[utype[pn][1] as string].operation_rule as unknown as number[])[ts];
                        const scaled: [[number, number], [number, number], [number, number]] = points.map(([i, j]) => [i * po, j * po ** 2] as [number, number]) as [[number, number], [number, number], [number, number]];
                        (pump[0] as unknown[])[1] = calc_parabola_vertex(scaled);
                    }
                } else {
                    console.warn(`Pipe ${pipe.name} miss ${utype[pn][0]} upstream.`);
                }

                // RIGHT BOUNDARY
                if (dtype[pn][0] === 'Pump') {
                    pump[1] = [tm.links_map[dtype[pn][1] as string].curve_coef, "d"];
                    if (pipe.end_node.name === tm.links_map[dtype[pn][1] as string].start_node.name) {
                        (pump[1] as unknown[])[1] = "s"; // suction side
                    }
                    if (tm.links_map[dtype[pn][1] as string].operating === true) {
                        const points = tm.links_map[dtype[pn][1] as string].get_pump_curve().points;
                        const po = (tm.links_map[dtype[pn][1] as string].operation_rule as unknown as number[])[ts];
                        const scaled: [[number, number], [number, number], [number, number]] = points.map(([i, j]) => [i * po, j * po ** 2] as [number, number]) as [[number, number], [number, number], [number, number]];
                        (pump[1] as unknown[])[0] = calc_parabola_vertex(scaled);
                    }
                } else if (dtype[pn][0] === 'Valve') {
                    if (tm.links_map[dtype[pn][1] as string].operating === true) {
                        valve[1] = valve_curve(
                            (tm.links_map[dtype[pn][1] as string].operation_rule as unknown as number[])[ts] * 100,
                            tm.links_map[dtype[pn][1] as string].valve_coeff);
                    } else {
                        if (tm.links_map[dtype[pn][1] as string].initial_status.name === 'Open') {
                            valve[1] = valve_curve(100, tm.links_map[dtype[pn][1] as string].valve_coeff);
                        } else if (tm.links_map[dtype[pn][1] as string].initial_status.name === 'Closed') {
                            valve[1] = valve_curve(0, tm.links_map[dtype[pn][1] as string].valve_coeff);
                        }
                    }
                    // if also the right valve end
                    if ((links2[pn] as string[])[0] === 'End') {
                        links2[pn] = [] as unknown as number[];
                    }
                } else if (dtype[pn][0] === 'Junction') {
                    VN[pn][VN[pn].length - 1] = pipe.initial_velocity[pipe.initial_velocity.length - 1];
                }

                const [hn, vn] = left_boundary(pipe, pn,
                    HN[pn], VN[pn], H[pn], V[pn],
                    links2[pn] as number[], p, pump, valve, dt,
                    (links2[pn] as number[]).map(i => pyAt(H[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links2[pn] as number[]).map(i => pyAt(V[Math.abs(i) - 1], a[Math.sign(i)])),
                    utype[pn] as [string, number | string], dtype[pn] as [string, number | string],
                    friction, dVdt[pn], dVdx[pn],
                    (links2[pn] as number[]).map(i => pyAt(dVdt[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links2[pn] as number[]).map(i => pyAt(dVdx[Math.abs(i) - 1], b[Math.sign(i)])));
                HN[pn] = hn;
                VN[pn] = vn;
                // record results
                pipe.start_node_velocity[ts] = VN[pn][0];
                pipe.end_node_velocity[ts] = VN[pn][VN[pn].length - 1];
                pipe.start_node_head[ts] = HN[pn][0];
                pipe.end_node_head[ts] = HN[pn][HN[pn].length - 1];
                pipe.start_node_flowrate[ts] = VN[pn][0] * pipe.area;
                pipe.end_node_flowrate[ts] = VN[pn][VN[pn].length - 1] * pipe.area;

                try {
                    if (HN[pn][0] - pipe.start_node.elevation > 0) {
                        const h = HN[pn][0] - pipe.start_node.elevation;
                        pipe.start_node.demand_discharge[ts] = pipe.start_node.demand_coeff * Math.sqrt(h);
                        pipe.start_node.emitter_discharge[ts] = pipe.start_node.emitter_coeff * Math.sqrt(h);
                    } else { // assume reverse flow preventer installed
                        pipe.start_node.emitter_discharge[ts] = 0.;
                        pipe.start_node.demand_discharge[ts] = 0.;
                        console.warn(`Negative pressure on node ${pipe.start_node.name}.\
                        Backflow stopped by reverse flow preventer.`);
                    }
                } catch {
                    // pass
                }

                try {
                    if (HN[pn][HN[pn].length - 1] - pipe.end_node.elevation > 0) {
                        const h = HN[pn][HN[pn].length - 1] - pipe.end_node.elevation;
                        pipe.end_node.emitter_discharge[ts] = pipe.end_node.emitter_coeff * Math.sqrt(h);
                        pipe.end_node.demand_discharge[ts] = pipe.end_node.demand_coeff * Math.sqrt(h);
                    } else { // assume reverse flow preventer installed
                        pipe.end_node.emitter_discharge[ts] = 0.;
                        pipe.end_node.demand_discharge[ts] = 0.;
                        console.warn(`Negative pressure on node ${pipe.start_node.name}.\
                            Backflow stopped by reverse flow preventer.`);
                    }
                } catch {
                    // pass
                }

            //  right boundary pipe
            } else if (!(links2[pn] as number[]).length || (links2[pn] as string[])[0] === 'End') {
                const pump: [unknown[], unknown[]] = [[], []];
                const valve: [number, number] = [0, 0];
                // RIGHT boundary
                if (dtype[pn][0] === 'Reservoir' || dtype[pn][0] === 'Tank') {
                    HN[pn][HN[pn].length - 1] = pipe.initial_head[pipe.initial_head.length - 1]; // head of reservoir
                } else if (dtype[pn][0] === 'Junction') {
                    VN[pn][VN[pn].length - 1] = pipe.initial_velocity[pipe.initial_velocity.length - 1];
                } else if (dtype[pn][0] === 'Valve') {
                    if (tm.links_map[dtype[pn][1] as string].operating === true) {
                        // valve velocity condition
                        VN[pn][VN[pn].length - 1] = pipe.initial_velocity[pipe.initial_velocity.length - 1] *
                            (tm.links_map[dtype[pn][1] as string].operation_rule as unknown as number[])[ts];
                    } else {
                        if (tm.links_map[dtype[pn][1] as string].initial_status.name === 'Open') {
                            VN[pn][VN[pn].length - 1] = pipe.initial_velocity[pipe.initial_velocity.length - 1];
                        } else if (tm.links_map[dtype[pn][1] as string].initial_status.name === 'Closed') {
                            VN[pn][VN[pn].length - 1] = 0;
                        }
                    }
                // source pump
                } else if (dtype[pn][0] === 'Pump') {
                    // pump[1][0]: elevation of the reservoir/tank
                    // pump[1][1]: three points for pump characteristic curve
                    pump[1] = [
                        tm.links_map[utype[pn][1] as string]!.end_node.initial_head,
                        tm.links_map[dtype[pn][1] as string]!.curve_coef
                    ];
                    if (tm.links_map[dtype[pn][1] as string].operating === true) {
                        const points = tm.links_map[dtype[pn][1] as string].get_pump_curve().points;
                        const po = (tm.links_map[dtype[pn][1] as string].operation_rule as unknown as number[])[ts];
                        const scaled: [[number, number], [number, number], [number, number]] = points.map(([i, j]) => [i * po, j * po ** 2] as [number, number]) as [[number, number], [number, number], [number, number]];
                        (pump[1] as unknown[])[1] = calc_parabola_vertex(scaled);
                    }
                } else {
                    console.warn(`Pipe ${pipe.name} miss ${dtype[pn][0]} downstream.`);
                }
                // LEFT boundary
                if (utype[pn][0] === 'Pump') {
                    pump[0] = [tm.links_map[utype[pn][1] as string].curve_coef, "d"];
                    if (pipe.start_node.name === tm.links_map[utype[pn][1] as string].start_node.name) {
                        (pump[0] as unknown[])[1] = "s"; // suction side
                    }
                    if (tm.links_map[utype[pn][1] as string].operating === true) {
                        const points = tm.links_map[utype[pn][1] as string].get_pump_curve().points;
                        const po = (tm.links_map[utype[pn][1] as string].operation_rule as unknown as number[])[ts];
                        const scaled: [[number, number], [number, number], [number, number]] = points.map(([i, j]) => [i * po, j * po ** 2] as [number, number]) as [[number, number], [number, number], [number, number]];
                        (pump[0] as unknown[])[0] = calc_parabola_vertex(scaled);
                    }
                } else if (utype[pn][0] === 'Valve') {
                    if (tm.links_map[utype[pn][1] as string].operating === true) {
                        valve[0] = valve_curve(
                            (tm.links_map[utype[pn][1] as string].operation_rule as unknown as number[])[ts] * 100,
                            tm.links_map[utype[pn][1] as string].valve_coeff);
                    } else {
                        if (tm.links_map[utype[pn][1] as string].initial_status.name === 'Open') {
                            valve[0] = valve_curve(100, tm.links_map[utype[pn][1] as string].valve_coeff);
                        } else if (tm.links_map[utype[pn][1] as string].initial_status.name === 'Closed') {
                            valve[0] = valve_curve(0, tm.links_map[utype[pn][1] as string].valve_coeff);
                        }
                    }
                }

                const [hn, vn] = right_boundary(pipe, pn,
                    H[pn], V[pn], HN[pn], VN[pn],
                    links1[pn] as number[], p, pump, valve, dt,
                    (links1[pn] as number[]).map(i => pyAt(H[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links1[pn] as number[]).map(i => pyAt(V[Math.abs(i) - 1], a[Math.sign(i)])),
                    utype[pn] as [string, number | string], dtype[pn] as [string, number | string],
                    friction, dVdt[pn], dVdx[pn],
                    (links1[pn] as number[]).map(i => pyAt(dVdt[Math.abs(i) - 1], a[Math.sign(i)])),
                    (links1[pn] as number[]).map(i => pyAt(dVdx[Math.abs(i) - 1], b[Math.sign(i)])));
                HN[pn] = hn;
                VN[pn] = vn;
                // record results
                pipe.start_node_velocity[ts] = VN[pn][0];
                pipe.end_node_velocity[ts] = VN[pn][VN[pn].length - 1];
                pipe.start_node_head[ts] = HN[pn][0];
                pipe.end_node_head[ts] = HN[pn][HN[pn].length - 1];
                pipe.start_node_flowrate[ts] = VN[pn][0] * pipe.area;
                pipe.end_node_flowrate[ts] = VN[pn][VN[pn].length - 1] * pipe.area;

                try {
                    if (HN[pn][0] - pipe.start_node.elevation > 0) {
                        const h = HN[pn][0] - pipe.start_node.elevation;
                        pipe.start_node.demand_discharge[ts] = pipe.start_node.demand_coeff * Math.sqrt(h);
                        pipe.start_node.emitter_discharge[ts] = pipe.start_node.emitter_coeff * Math.sqrt(h);
                    } else { // assume reverse flow preventer installed
                        pipe.start_node.emitter_discharge[ts] = 0.;
                        pipe.start_node.demand_discharge[ts] = 0.;
                        console.warn(`Negative pressure on node ${pipe.start_node.name}.\
                        Backflow stopped by reverse flow preventer.`);
                    }
                } catch {
                    // pass
                }

                try {
                    if (HN[pn][HN[pn].length - 1] - pipe.end_node.elevation > 0) {
                        const h = HN[pn][HN[pn].length - 1] - pipe.end_node.elevation;
                        pipe.end_node.emitter_discharge[ts] = pipe.end_node.emitter_coeff * Math.sqrt(h);
                        pipe.end_node.demand_discharge[ts] = pipe.end_node.demand_coeff * Math.sqrt(h);
                    } else { // assume reverse flow preventer installed
                        pipe.end_node.emitter_discharge[ts] = 0.;
                        pipe.end_node.demand_discharge[ts] = 0.;
                        console.warn(`Negative pressure on node ${pipe.start_node.name}.\
                            Backflow stopped by reverse flow preventer.`);
                    }
                } catch {
                    // pass
                }
            }
        }

        // march in time
        for (const [, pipe] of tm.pipes()) {
            const pn = pipe.id - 1;
            // calculate instantaneous local acceleration
            // only for unsteady friction factor
            if (friction === 'unsteady') {
                dVdt[pn] = VN[pn].map((v, i) => (v - V[pn][i]) / dt);
                dVdx[pn] = V[pn].slice(1).map((v, i) => (v - V[pn][i]) / (pipe.length / pipe.number_of_segments));
            }
            H[pn] = HN[pn];
            V[pn] = VN[pn];
        }

        for (const [, node] of tm.nodes()) {
            if (node.transient_node_type === 'SurgeTank' || node.transient_node_type === 'Chamber') {
                node.tank_shape[node.tank_shape.length - 2] = Math.max(node.water_level, 0);
                node.tank_shape[node.tank_shape.length - 1] = node.tank_flow;
                node.water_level_timeseries[ts] = Math.max(node.water_level, 0);
                node.tank_flow_timeseries[ts] = node.tank_flow;
            }
        }
    }

    for (const [, pipe] of tm.pipes()) {
        if (!Array.isArray(pipe.start_node._head) || pipe.start_node._head.length === 0) {
            pipe.start_node._head = [...pipe.start_node_head];
        }
        if (!Array.isArray(pipe.end_node._head) || pipe.end_node._head.length === 0) {
            pipe.end_node._head = [...pipe.end_node_head];
        }
    }

    tm.simulation_timestamps = tt;

    // save object to file
    if (results_obj !== 'no') {
        // pickle serialization not available in TypeScript
        // filehandler = open(results_obj +'.obj','wb')
        // pickle.dump(tm, filehandler)
    }

    return tm;
}
