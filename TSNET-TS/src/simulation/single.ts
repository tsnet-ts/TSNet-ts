/**
 * The tsnet.simulation.single contains methods to perform MOC
 * transient simulation on a single pipe, including
 * 1. inner pipe
 * 2. left boundary pipe (without C- charateristic grid)
 * 3. right boundary pipe (without C+ characteristic grid)
 */

import type { Pipe } from '../epanet-bridge.ts';
import {
    inner_node_steady,
    inner_node_quasisteady,
    inner_node_unsteady,
    valve_node,
    pump_node,
    source_pump,
    valve_end,
    dead_end,
    rev_end,
    add_leakage,
    surge_tank,
    air_chamber
} from './solver.ts';

export function inner_pipe(
    linkp: Pipe, pn: number, dt: number,
    links1: number[], links2: number[],
    utype: [string, number | string], dtype: [string, number | string],
    p: Pipe[],
    H0: number[], V0: number[], H: number[], V: number[],
    H10: number[], V10: number[],
    H20: number[], V20: number[],
    pump: [unknown[], unknown[]], valve: [number, number],
    friction: string, dVdt: number[], dVdx: number[],
    dVdt10: number[], dVdx10: number[],
    dVdt20: number[], dVdx20: number[]
): [number[], number[]] {
    /**
     * MOC solution for an individual inner pipe.
     */

    // Properties of current pipe
    const g = 9.8;                          // m/s^2
    const link1 = links1.map(i => p[Math.abs(i) - 1]);
    const link2 = links2.map(i => p[Math.abs(i) - 1]);
    const n = linkp.number_of_segments;    // spatial discretization

    // inner nodes
    if (friction === 'steady') {
        [H.splice(1, n - 1, ...inner_node_steady(linkp, H0, V0, dt, g)[0]),
         V.splice(1, n - 1, ...inner_node_steady(linkp, H0, V0, dt, g)[1])];
        const [HP, VP] = inner_node_steady(linkp, H0, V0, dt, g);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    } else if (friction === 'quasi-steady') {
        const [HP, VP] = inner_node_quasisteady(linkp, H0, V0, dt, g);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    } else {
        const [HP, VP] = inner_node_unsteady(linkp, H0, V0, dt, g, dVdx, dVdt);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    }

    // Pipe start
    let V1: number | number[] = V10;
    let H1: number | number[] = H10;
    let V2: number | number[] = V0[1];
    let H2: number | number[] = H0[1];
    let dVdx1: number | number[] = dVdx10;
    let dVdt1: number | number[] = dVdt10;
    let dVdx2: number | number[] = dVdx[0];
    let dVdt2: number | number[] = dVdt[1];

    if (utype[0] === 'Pipe') {
        if (linkp.start_node.transient_node_type === 'SurgeTank') {
            const shape = linkp.start_node.tank_shape;
            const [hp, vp, Qs] = surge_tank(shape, link1, linkp as Pipe,
                H1, V1, H2 as number, V2 as number, dt, g, 0, links1.map(Math.sign), [-1],
                friction, dVdx1, dVdx2 as number, dVdt1, dVdt2 as number);
            H[0] = hp; V[0] = vp as number;
            linkp.start_node.water_level = hp;
            linkp.start_node.tank_flow = Qs;
        } else if (linkp.start_node.transient_node_type === 'Chamber') {
            const shape = linkp.start_node.tank_shape;
            const [hp, vp, Qs, zp] = air_chamber(shape, link1, linkp as Pipe,
                H1, V1, H2 as number, V2 as number, dt, g, 0, links1.map(Math.sign), [-1],
                friction, dVdx1, dVdx2 as number, dVdt1, dVdt2 as number);
            H[0] = hp; V[0] = vp as number;
            linkp.start_node.water_level = zp;
            linkp.start_node.tank_flow = Qs;
        } else {
            const elev = linkp.start_node.elevation;
            const emitter_coeff = linkp.start_node.emitter_coeff + linkp.start_node.demand_coeff;
            const block_per = linkp.start_node.block_per;
            const [hp, vp] = add_leakage(emitter_coeff, block_per, link1, linkp as Pipe, elev,
                H1, V1, H2 as number, V2 as number, dt, g, 0, links1.map(Math.sign), [-1],
                friction, dVdx1, dVdx2 as number, dVdt1, dVdt2 as number);
            H[0] = hp; V[0] = vp as number;
        }
    } else if (utype[0] === 'Pump') {
        const pumpc = pump[0] as [[number, number, number], string];
        const [hp, vp] = pump_node(pumpc, link1, linkp as Pipe,
            H1, V1, H2 as number, V2 as number, dt, g, 0, links1.map(Math.sign), [-1],
            friction, dVdx1, dVdx2 as number, dVdt1, dVdt2 as number);
        H[0] = hp; V[0] = vp;
    } else if (utype[0] === 'Valve') {
        const valvec = valve[0];
        const [hp, vp] = valve_node(valvec, link1, linkp as Pipe,
            H1, V1, H2 as number, V2 as number, dt, g, 0, links1.map(Math.sign), [-1],
            friction, dVdx1, dVdx2 as number, dVdt1, dVdt2 as number);
        H[0] = hp; V[0] = vp;
    }

    // Pipe end
    V1 = V0[n - 1]; H1 = H0[n - 1];
    V2 = V20; H2 = H20;
    dVdx1 = dVdx[n - 1]; dVdt1 = dVdt[n - 1];
    dVdx2 = dVdx20; dVdt2 = dVdt20;

    if (dtype[0] === 'Pipe') {
        if (linkp.end_node.transient_node_type === 'SurgeTank') {
            const shape = linkp.end_node.tank_shape;
            const [hp, vp, Qs] = surge_tank(shape, linkp as Pipe, link2,
                H1 as number, V1 as number, H2, V2, dt, g, n, [1], links2.map(Math.sign),
                friction, dVdx1 as number, dVdx2, dVdt1 as number, dVdt2);
            H[n] = hp; V[n] = vp as number;
            linkp.end_node.water_level = hp;
            linkp.end_node.tank_flow = Qs;
        } else if (linkp.end_node.transient_node_type === 'Chamber') {
            const shape = linkp.end_node.tank_shape;
            const [hp, vp, Qs, zp] = air_chamber(shape, linkp as Pipe, link2,
                H1 as number, V1 as number, H2, V2, dt, g, n, [1], links2.map(Math.sign),
                friction, dVdx1 as number, dVdx2, dVdt1 as number, dVdt2);
            H[n] = hp; V[n] = vp as number;
            linkp.end_node.water_level = zp;
            linkp.end_node.tank_flow = Qs;
        } else {
            const elev = linkp.end_node.elevation;
            const emitter_coeff = linkp.end_node.emitter_coeff + linkp.end_node.demand_coeff;
            const block_per = linkp.end_node.block_per;
            const [hp, vp] = add_leakage(emitter_coeff, block_per, linkp as Pipe, link2, elev,
                H1 as number, V1 as number, H2, V2, dt, g, n, [1], links2.map(Math.sign),
                friction, dVdx1 as number, dVdx2, dVdt1 as number, dVdt2);
            H[n] = hp; V[n] = vp as number;
        }
    } else if (dtype[0] === 'Pump') {
        const pumpc = pump[1] as [[number, number, number], string];
        const [hp, vp] = pump_node(pumpc, linkp as Pipe, link2,
            H1 as number, V1 as number, H2, V2, dt, g, n, [1], links2.map(Math.sign),
            friction, dVdx1 as number, dVdx2, dVdt1 as number, dVdt2);
        H[n] = hp; V[n] = vp;
    } else if (dtype[0] === 'Valve') {
        const valvec = valve[1];
        const [hp, vp] = valve_node(valvec, linkp as Pipe, link2,
            H1 as number, V1 as number, H2, V2, dt, g, n, [1], links2.map(Math.sign),
            friction, dVdx1 as number, dVdx2, dVdt1 as number, dVdt2);
        H[n] = hp; V[n] = vp;
    }
    return [H, V];
}

export function left_boundary(
    linkp: Pipe, pn: number,
    H: number[], V: number[], H0: number[], V0: number[],
    links2: number[], p: Pipe[],
    pump: [unknown[], unknown[]], valve: [number, number],
    dt: number,
    H20: number[], V20: number[],
    utype: [string, number | string], dtype: [string, number | string],
    friction: string, dVdt: number[], dVdx: number[],
    dVdt20: number[], dVdx20: number[]
): [number[], number[]] {
    /**
     * MOC solution for an individual left boundary pipe.
     */

    const link2 = links2.map(i => p[Math.abs(i) - 1]);
    // Properties of current pipe
    const f = linkp.roughness;              // unitless
    const D = linkp.diameter;               // m
    const g = 9.8;                          // m/s^2
    const a = linkp.wavev;    // m/s
    const n = linkp.number_of_segments;   // spatial discretization
    const KD = linkp.roughness_height;

    // inner nodes
    if (friction === 'steady') {
        const [HP, VP] = inner_node_steady(linkp, H0, V0, dt, g);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    } else if (friction === 'quasi-steady') {
        const [HP, VP] = inner_node_quasisteady(linkp, H0, V0, dt, g);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    } else {
        const [HP, VP] = inner_node_unsteady(linkp, H0, V0, dt, g, dVdx, dVdt);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    }

    // Pipe start (outer boundary conditions)
    const V2_start = V0[1];
    const H2_start = H0[1];
    const dVdx2_start = dVdx[0];
    const dVdt2_start = dVdt[1];
    if (utype[0] === 'Reservoir' || utype[0] === 'Tank') {
        const [hp, vp] = rev_end(H2_start, V2_start, H[0], 0, a, g, f, D, dt,
            KD, friction, dVdx2_start, dVdt2_start);
        H[0] = hp; V[0] = vp;
    } else if (utype[0] === 'Valve') {
        const [hp, vp] = valve_end(H2_start, V2_start, V[0], 0, a, g, f, D, dt,
            KD, friction, dVdx2_start, dVdt2_start);
        H[0] = hp; V[0] = vp;
    } else if (utype[0] === 'Junction') {
        const elev = linkp.start_node.elevation;
        const [hp, vp] = dead_end(linkp, H2_start, V2_start, elev, 0, a, g, f, D, dt,
            KD, friction, dVdx2_start, dVdt2_start);
        H[0] = hp; V[0] = vp;
    } else if (utype[0] === 'Pump') { // source pump
        const [hp, vp] = source_pump(pump[0] as [number, [number, number, number]], linkp, H2_start, V2_start, dt, g, [-1],
            friction, dVdx2_start, dVdt2_start);
        H[0] = hp; V[0] = vp;
    }

    // Pipe end (inner boundary conditions)
    const V1_end = V0[n - 1];
    const H1_end = H0[n - 1];     // upstream node
    const V2_end: number | number[] = V20;
    const H2_end: number | number[] = H20;         // downstream nodes
    const dVdx1_end = dVdx[n - 1];
    const dVdx2_end: number | number[] = dVdx20;
    const dVdt1_end = dVdt[n - 1];
    const dVdt2_end: number | number[] = dVdt20;

    if (dtype[0] === 'Pipe') {
        if (linkp.end_node.transient_node_type === 'SurgeTank') {
            const shape = linkp.end_node.tank_shape;
            const [hp, vp, Qs] = surge_tank(shape, linkp, link2,
                H1_end, V1_end, H2_end, V2_end, dt, g, n, [1], links2.map(Math.sign),
                friction, dVdx1_end, dVdx2_end, dVdt1_end, dVdt2_end);
            H[n] = hp; V[n] = vp as number;
            linkp.end_node.water_level = hp;
            linkp.end_node.tank_flow = Qs;
        } else if (linkp.end_node.transient_node_type === 'Chamber') {
            const shape = linkp.end_node.tank_shape;
            const [hp, vp, Qs, zp] = air_chamber(shape, linkp, link2,
                H1_end, V1_end, H2_end, V2_end, dt, g, n, [1], links2.map(Math.sign),
                friction, dVdx1_end, dVdx2_end, dVdt1_end, dVdt2_end);
            H[n] = hp; V[n] = vp as number;
            linkp.end_node.water_level = zp;
            linkp.end_node.tank_flow = Qs;
        } else {
            const elev = linkp.end_node.elevation;
            const emitter_coeff = linkp.end_node.emitter_coeff + linkp.end_node.demand_coeff;
            const block_per = linkp.end_node.block_per;
            const [hp, vp] = add_leakage(emitter_coeff, block_per, linkp, link2, elev,
                H1_end, V1_end, H2_end, V2_end, dt, g, n, [1], links2.map(Math.sign),
                friction, dVdx1_end, dVdx2_end, dVdt1_end, dVdt2_end);
            H[n] = hp; V[n] = vp as number;
        }
    } else if (dtype[0] === 'Pump') {
        const pumpc = pump[1] as [[number, number, number], string];
        const [hp, vp] = pump_node(pumpc, linkp, link2,
            H1_end, V1_end, H2_end, V2_end, dt, g, n, [1], links2.map(Math.sign),
            friction, dVdx1_end, dVdx2_end, dVdt1_end, dVdt2_end);
        H[n] = hp; V[n] = vp;
    } else if (dtype[0] === 'Valve') {
        const valvec = valve[1];
        if (links2.length === 0) {
            const [hp, vp] = valve_end(H1_end, V1_end, V[n], n, a, g, f, D, dt,
                KD, friction, dVdx1_end, dVdt1_end);
            H[n] = hp; V[n] = vp;
        } else {
            const [hp, vp] = valve_node(valvec, linkp, link2,
                H1_end, V1_end, H2_end, V2_end, dt, g, n, [1], links2.map(Math.sign),
                friction, dVdx1_end, dVdx2_end, dVdt1_end, dVdt2_end);
            H[n] = hp; V[n] = vp;
        }
    } else if (dtype[0] === 'Junction') {
        const elev = linkp.end_node.elevation;
        const [hp, vp] = dead_end(linkp, H1_end, V1_end, elev, n, a, g, f, D, dt,
            KD, friction, dVdx1_end, dVdt1_end);
        H[n] = hp; V[n] = vp;
    }

    return [H, V];
}

export function right_boundary(
    linkp: Pipe, pn: number,
    H0: number[], V0: number[], H: number[], V: number[],
    links1: number[], p: Pipe[],
    pump: [unknown[], unknown[]], valve: [number, number],
    dt: number,
    H10: number[], V10: number[],
    utype: [string, number | string], dtype: [string, number | string],
    friction: string, dVdt: number[], dVdx: number[],
    dVdt10: number[], dVdx10: number[]
): [number[], number[]] {
    /**
     * MOC solution for an individual right boundary pipe.
     */

    // Properties of current pipe
    const link1 = links1.map(i => p[Math.abs(i) - 1]);
    const f = linkp.roughness;              // unitless
    const D = linkp.diameter;               // m
    const g = 9.8;                          // m/s^2
    const a = linkp.wavev;                  // m/s
    const n = linkp.number_of_segments;   // spatial discretization
    const KD = linkp.roughness_height;

    // inner nodes
    if (friction === 'steady') {
        const [HP, VP] = inner_node_steady(linkp, H0, V0, dt, g);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    } else if (friction === 'quasi-steady') {
        const [HP, VP] = inner_node_quasisteady(linkp, H0, V0, dt, g);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    } else {
        const [HP, VP] = inner_node_unsteady(linkp, H0, V0, dt, g, dVdx, dVdt);
        for (let i = 0; i < HP.length; i++) { H[i + 1] = HP[i]; V[i + 1] = VP[i]; }
    }

    // Pipe start (inner boundary conditions)
    const V1_start: number | number[] = V10;
    const H1_start: number | number[] = H10;            // upstream node
    const V2_start = V0[1];
    const H2_start = H0[1];    // downstream node
    const dVdx1_start: number | number[] = dVdx10;
    const dVdx2_start = dVdx[0];
    const dVdt1_start: number | number[] = dVdt10;
    const dVdt2_start = dVdt[1];

    if (utype[0] === 'Pipe') {
        if (linkp.start_node.transient_node_type === 'SurgeTank') {
            const shape = linkp.start_node.tank_shape;
            const [hp, _vp, Qs] = surge_tank(shape, link1, linkp,
                H1_start, V1_start, H2_start, V2_start, dt, g, 0, links1.map(Math.sign), [-1],
                friction, dVdx1_start, dVdx2_start, dVdt1_start, dVdt2_start);
            linkp.start_node.water_level = hp;
            linkp.start_node.tank_flow = Qs;
        }
        if (linkp.start_node.transient_node_type === 'Chamber') {
            const shape = linkp.start_node.tank_shape;
            const [hp, vp, Qs, zp] = air_chamber(shape, link1, linkp,
                H1_start, V1_start, H2_start, V2_start, dt, g, 0, links1.map(Math.sign), [-1],
                friction, dVdx1_start, dVdx2_start, dVdt1_start, dVdt2_start);
            H[0] = hp; V[0] = vp as number;
            linkp.start_node.water_level = zp;
            linkp.start_node.tank_flow = Qs;
        } else {
            const elev = linkp.start_node.elevation;
            const emitter_coeff = linkp.start_node.emitter_coeff + linkp.start_node.demand_coeff;
            const block_per = linkp.start_node.block_per;
            const [hp, vp] = add_leakage(emitter_coeff, block_per, link1, linkp, elev,
                H1_start, V1_start, H2_start, V2_start, dt, g, 0, links1.map(Math.sign), [-1],
                friction, dVdx1_start, dVdx2_start, dVdt1_start, dVdt2_start);
            H[0] = hp; V[0] = vp as number;
        }
    } else if (utype[0] === 'Pump') {
        const pumpc = pump[0] as [[number, number, number], string];
        const [hp, vp] = pump_node(pumpc, link1, linkp,
            H1_start, V1_start, H2_start, V2_start, dt, g, 0, links1.map(Math.sign), [-1],
            friction, dVdx1_start, dVdx2_start, dVdt1_start, dVdt2_start);
        H[0] = hp; V[0] = vp;
    } else if (utype[0] === 'Valve') {
        const valvec = valve[0];
        const [hp, vp] = valve_node(valvec, link1, linkp,
            H1_start, V1_start, H2_start, V2_start, dt, g, 0, links1.map(Math.sign), [-1],
            friction, dVdx1_start, dVdx2_start, dVdt1_start, dVdt2_start);
        H[0] = hp; V[0] = vp;
    }

    // Pipe end (outer boundary conditions)
    const V1_end = V0[n - 1];
    const H1_end = H0[n - 1];
    const dVdx1_end = dVdx[n - 1];
    const dVdt1_end = dVdt[n - 1];

    if (dtype[0] === 'Reservoir' || dtype[0] === 'Tank') {
        const [hp, vp] = rev_end(H1_end, V1_end, H[n], n, a, g, f, D, dt,
            KD, friction, dVdx1_end, dVdt1_end);
        H[n] = hp; V[n] = vp;
    }
    if (dtype[0] === 'Valve') {
        const [hp, vp] = valve_end(H1_end, V1_end, V[n], n, a, g, f, D, dt,
            KD, friction, dVdx1_end, dVdt1_end);
        H[n] = hp; V[n] = vp;
    }
    if (dtype[0] === 'Junction') {
        const elev = linkp.end_node.elevation;
        const [hp, vp] = dead_end(linkp, H1_end, V1_end, elev, n, a, g, f, D, dt,
            KD, friction, dVdx1_end, dVdt1_end);
        H[n] = hp; V[n] = vp;
    }

    return [H, V];
}
