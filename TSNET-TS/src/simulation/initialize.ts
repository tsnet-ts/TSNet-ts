/**
 * The tsnet.simulation.initialize contains functions to
 * 1. Initialize the list containing numpy arrays for velocity and head.
 * 2. Calculate initial conditions using Epanet engine.
 * 3. Calculate D-W coefficients based on initial conditions.
 * 4. Calculate demand coefficients based on initial conditions.
 */

import * as np from 'numpy-ts';
import type { Pipe } from '../epanet-bridge.ts';
import type { TransientModel } from '../network/model.ts';
import { calc_parabola_vertex } from '../utils/calc-parabola-vertex.ts';

export function Initializer(tm: TransientModel, t0: number, engine: string = 'DD'): TransientModel {
    /**
     * Initial Condition Calculation.
     *
     * Initialize the list containing numpy arrays for velocity and head.
     * Calculate initial conditions using Epanet engine.
     * Calculate D-W coefficients based on initial conditions.
     * Calculate demand coefficients based on initial conditions.
     *
     * Parameters
     * ----------
     * tm : TransientModel
     *     Simulated network
     * t0 : float
     *     time to calculate initial condition
     * engine : string
     *     steady state calculation engine:
     *     DD: demand driven;
     *     PDD: pressure dependent demand,
     *     by default DD
     *
     * Returns
     * -------
     * tm : TransientModel
     *     Network with updated parameters
     */
    // adjust the time step and discretize each pipe

    const tn = Math.floor(tm.simulation_period / tm.time_step); // Total time steps
    console.log('Total Time Step in this simulation %s', tn);

    // create new attributes for each pipe to store head and velocity results
    // at its start and end node.
    for (const [, pipe] of tm.pipes()) {
        pipe.start_node_head = new Array(tn).fill(0);
        pipe.start_node_velocity = new Array(tn).fill(0);
        pipe.start_node_flowrate = new Array(tn).fill(0);
        pipe.end_node_head = new Array(tn).fill(0);
        pipe.end_node_velocity = new Array(tn).fill(0);
        pipe.end_node_flowrate = new Array(tn).fill(0);
    }

    // create new attributes for each node to store head and discharge results
    for (const [, node] of tm.nodes()) {
        node.demand_discharge = new Array(tn).fill(0);
        node.emitter_discharge = new Array(tn).fill(0);
    }

    // calculate initial conditions using EPAnet engine
    for (const [, node] of tm.nodes()) {
        if (node._leak_status === true) {
            node.add_leak(tm, {
                area: node.emitter_coeff / Math.sqrt(2 * 9.81),
                discharge_coeff: 1,
                start_time: t0
            });
        }
    }

    let sim;
    let results;
    if (engine.toLowerCase() === 'dd') {
        tm.options.hydraulic.demand_model = 'DD';
        sim = new tm.EpanetSimulator(tm);
        results = sim.run_sim();
    } else if (engine.toLowerCase() === 'pdd') {
        tm.options.hydraulic.demand_model = 'PDD';
        sim = new tm.EpanetSimulator(tm);
        results = sim.run_sim();
    } else {
        throw new Error("Unknown initial calculation engine. \
            The engine can only be 'DD' or 'PDD'.");
    }

    for (const [, node] of tm.nodes()) {
        node.initial_head = results.node['head'].loc(t0, node.name);
    }

    for (const [, link] of tm.links()) {
        link.initial_flow = results.link['flowrate'].loc(t0, link.name);
    }

    const nu = 1.004e-6;
    let H: number[] = [];
    let V: number[] = [];

    for (const [, pipe] of tm.pipes()) {
        // assign the initial conditions to the latest result arrays

        const flowSign = Math.sign(results.link['flowrate'].loc(t0, pipe.name));
        const velocity = results.link['velocity'].loc(t0, pipe.name);
        V = Array(pipe.number_of_segments + 1).fill(flowSign * velocity);

        H = Array.from({ length: pipe.number_of_segments + 1 }, (_, i) =>
            results.node['head'].loc(t0, pipe.start_node.name) +
            i * ((results.node['head'].loc(t0, pipe.end_node.name) -
                results.node['head'].loc(t0, pipe.start_node.name)) /
                (pipe.number_of_segments))
        );

        pipe.initial_head = H;
        pipe.initial_velocity = V;
        pipe.initial_Re = Math.abs(V[0] * pipe.diameter / nu);

        // assign the initial conditions to the results attributes
        pipe.start_node_velocity[0] = V[0];
        pipe.end_node_velocity[0] = V[V.length - 1];
        pipe.start_node_head[0] = H[0];
        pipe.end_node_head[0] = H[H.length - 1];
        pipe.start_node_flowrate[0] = V[0] * pipe.area;
        pipe.end_node_flowrate[0] = V[V.length - 1] * pipe.area;

        // calculate demand coefficient
        const Hs = H[0];
        const He = H[H.length - 1];
        const demand: [number, number] = [0, 0]; // demand at start and end node
        try {
            demand[0] = results.node['demand'].loc(t0, pipe.start_node.name);
        } catch {
            demand[0] = 0.;
        }
        try {
            demand[1] = results.node['demand'].loc(t0, pipe.end_node.name);
        } catch {
            demand[1] = 0.;
        }
        let Hsa: number;
        try {
            Hsa = H[0] - pipe.start_node.elevation;
        } catch {
            Hsa = 1.;
        }
        let Hea: number;
        try {
            Hea = H[H.length - 1] - pipe.end_node.elevation;
        } catch {
            Hea = 1.;
        }
        cal_demand_coef(demand, pipe, Hsa, Hea, t0);

        // calculate demand discharge and emitter discharge
        if (pipe.start_node.node_type === 'Junction') {
            pipe.start_node.emitter_discharge[0] = pipe.start_node.emitter_coeff * Math.sqrt(Hsa);
            pipe.start_node.demand_discharge[0] = pipe.start_node.demand_coeff * Math.sqrt(Hsa);
        }
        if (pipe.end_node.node_type === 'Junction') {
            pipe.end_node.emitter_discharge[0] = pipe.end_node.emitter_coeff * Math.sqrt(Hea);
            pipe.end_node.demand_discharge[0] = pipe.end_node.demand_coeff * Math.sqrt(Hea);
        }

        // calculate roughness coefficient
        const Vp = V[0];
        const hl = Math.abs(Hs - He);
        cal_roughness_coef(pipe, Vp, hl);
    }

    // set initial conditions as a new attribute to TransientModel
    tm.initial_head = H;
    tm.initial_velocity = V;

    // add pump operation points
    pump_operation_points(tm);

    return tm;
}

function cal_demand_coef(demand: [number, number], pipe: Pipe, Hs: number, He: number, _t0: number = 0.): void {
    /**
     * Calculate the demand coefficient for the start and end node of the pipe.
     *
     * Parameters
     * ----------
     * demand : list
     *     Demand at the start (demand[0]) and end demand[1] node
     * pipe : object
     *     Pipe object
     * Hs : float
     *     Head at the start node
     * He : float
     *     Head at the end node
     * t0 : float, optional
     *     Time to start initial condition calculation, by default 0
     *
     * Returns
     * -------
     * pipe : object
     *     Pipe object with calculated demand coefficient
     */

    let start_demand_coeff: number;
    try {
        start_demand_coeff = demand[0] / Math.sqrt(Hs);
    } catch {
        start_demand_coeff = 0.;
    }

    let end_demand_coeff: number;
    try {
        end_demand_coeff = demand[1] / Math.sqrt(He);
    } catch {
        end_demand_coeff = 0.;
    }
    pipe.start_node.demand_coeff = start_demand_coeff; // [m^3/s/(m H20)^(1/2)]
    pipe.end_node.demand_coeff = end_demand_coeff;   // [m^3/s/(m H20)^(1/2)]
}

function cal_roughness_coef(pipe: Pipe, V: number, hl: number): void {
    /**
     * Calculate the D-W roughness coefficient based on initial conditions.
     *
     * Parameters
     * ----------
     * pipe : object
     *     Pipe object
     * V : float
     *     Initial flow velocity in the pipe
     * hl : float
     *     Initial head loss in the pipe
     *
     * Returns
     * -------
     * pipe : object
     *     Pipe object with calculated D-W roughness coefficient.
     */

    const g = 9.8;
    const H_tol = 1e-3;
    const V_tol = 1e-5;

    if (Math.abs(V) >= V_tol && hl >= H_tol) {
        pipe.roughness = hl / (pipe.length / pipe.diameter) / (V ** 2 / 2 / g);
    } else {
        pipe.roughness = 0;
    }

    if (pipe.roughness > 0.08) {
        console.warn(`${pipe.name} :the friction coefficient ${pipe.roughness.toFixed(4)} is too large. \
                        The D-W coeff has been set to 0.03 `);
        pipe.roughness = 0.03;
    }
    if (pipe.roughness !== 0) {
        pipe.roughness_height = Math.max(
            10 ** (-1 / 1.8 / Math.sqrt(pipe.roughness)) - 6.9 / pipe.initial_Re, 0);
    } else {
        pipe.roughness_height = 0;
    }
}

function pump_operation_points(tm: TransientModel): void {
    // add operation points to the pump
    for (const [, pump] of tm.pumps()) {
        const opt_point: [number, number] = [
            pump.initial_flow,
            Math.abs(pump.end_node.initial_head - pump.start_node.initial_head)
        ];
        const def_points = pump.get_pump_curve().points;
        // single-point pump curve
        if (def_points.length === 1) {
            const [flow, head] = def_points[0];
            def_points.push([0., 1.33 * head]);
            def_points.push([2 * flow, 0.]);
        } else if (def_points.length !== 3) {
            throw new Error("TSNet only support one-point or three-point pump curve.");
        }

        const dist: number[] = [];
        for (const [i, j] of def_points) {
            dist.push(Math.sqrt((i - opt_point[0]) ** 2 + (j - opt_point[1]) ** 2));
        }

        const minIdx = dist.indexOf(Math.min(...dist));
        def_points.splice(minIdx, 1);
        def_points.push(opt_point);

        pump.curve_coef = calc_parabola_vertex(
            def_points as [[number, number], [number, number], [number, number]]
        );
    }
}
