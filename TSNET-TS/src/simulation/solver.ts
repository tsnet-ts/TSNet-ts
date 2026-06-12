/**
 * The tsnet.simulation.solver module contains methods to solver MOC
 * for different grid configurations, including:
 * 1. inner_node
 * 2. valve_node
 * 3. pump_node
 * 4. source_pump
 * 5. valve_end
 * 6. dead_end
 * 7. rev_end
 * 8. add_leakage
 */

import type { Pipe } from '../epanet-bridge.ts';

function ensureArray<T>(val: T | T[]): T[] {
    return Array.isArray(val) ? val : [val];
}

export function Reynold(V: number, D: number): number {
    /**
     * Calculate Reynold number
     *
     * Parameters
     * ----------
     * V : float
     *     velocity
     * D : float
     *     diameter
     *
     * Returns
     * -------
     * Re : float
     *     Reynold number
     */
    const nu = 1.004e-6;  // kinematic viscosity [m^2/s]
    const Re = Math.abs(V * D / nu);
    return Re;
}

export function quasi_steady_friction_factor(Re: number, KD: number): number {
    /**
     * Update friction factor based on Reynold number
     *
     * Parameters
     * ----------
     * Re : float
     *     velocity
     * KD : float
     *     relative roughness height (K/D)
     *
     * Returns
     * -------
     * f : float
     *     quasi-steady friction factor
     */

    const a = -1.8 * Math.log10(6.9 / Re + KD);
    const f = (1. / a) ** 2.;
    return f;
}

export function unsteady_friction(Re: number, dVdt: number, dVdx: number, V: number, a: number, g: number): number {
    /**
     * Calculate unsteady friction
     *
     * Parameters
     * ----------
     * Re : float
     *     velocity
     * dVdt : float
     *     local instantaneous acceleration
     * dVdx : float
     *     instantaneous convective acceleration
     * V : float
     *     velocity
     * a : float
     *     wave speed
     * g: float
     *     gravitational acceleration
     *
     * Returns
     * -------
     * Ju : float
     *     unsteady friction factor
     */

    // calculate Vardy's shear decay coefficient (C)
    let C: number;
    if (Re < 2000) { // laminar flow
        C = 4.76e-3;
    } else {
        C = 7.41 / Re ** (Math.log10(14.3 / Re ** 0.05));
    }

    // calculate Brunone's friction coefficient
    const k = Math.sqrt(C) / 2.;
    // TO DO: check the sign of unsteady friction
    const Ju = k / g / 2. * (dVdt + a * Math.sign(V) * Math.abs(dVdx));
    return Ju;
}

export function cal_friction(friction: string, f: number, D: number, V: number, KD: number,
    dt: number, dVdt: number, dVdx: number, a: number, g: number): number {
    /**
     * Calculate friction term
     *
     * Parameters
     * ----------
     * friction : str
     *     friction model, e.g., 'steady', 'quasi-steady', 'unsteady',
     *     by default 'steady'
     * f : float
     *     steady friction factor
     * D : float
     *     pipe diameter
     * V : float
     *     pipe flow velocity
     * KD : float
     *     relative roughness height
     * dt : float
     *     time step
     * dVdt : float
     *     local instantaneous acceleration
     * dVdx : float
     *     convective instantaneous acceleration
     * a : float
     *     wave speed
     * g : float
     *     gravitational accelerations
     *
     * Returns
     * -------
     * float
     *     total friction, including steady and unsteady
     */
    const tol = 1;
    let Ju = 0;
    let Js: number;

    if (friction === 'steady') {
        Ju = 0;
        Js = f * dt / 2. / D * V * Math.abs(V); // steady friction
    } else {
        const Re = Reynold(V, D);
        if (Re < tol) {
            Js = 0;
        } else {
            f = quasi_steady_friction_factor(Re, KD);
            Js = f * dt / 2. / D * V * Math.abs(V);
        }
        if (friction === 'quasi-steady') {
            Ju = 0;
        } else if (friction === 'unsteady') {
            Ju = unsteady_friction(Re, dVdt, dVdx, V, a, g);
        }
    }
    return Ju + Js!;
}

export function cal_Cs(
    link1: Pipe[], link2: Pipe[],
    H1: number[], V1: number[], H2: number[], V2: number[],
    s1: number[], s2: number[], g: number, dt: number,
    friction: string,
    dVdx1: number[], dVdx2: number[],
    dVdt1: number[], dVdt2: number[]
): [number[], number[], number[][], number[][]] {
    /**
     * Calculate coefficients for MOC characteristic lines
     */

    // property of left adjacent pipe
    const f1 = link1.map(l => l.roughness);       // unitless
    const D1 = link1.map(l => l.diameter);        // m
    const a1 = link1.map(l => l.wavev);           // m/s
    const A1 = D1.map(d => Math.PI * d ** 2. / 4.);   // m^2
    const C1: number[][] = Array.from({ length: link1.length }, () => [0, 0]);
    const theta1 = link1.map(l => l.theta);
    const KD1 = link1.map(l => l.roughness_height);

    for (let i = 0; i < link1.length; i++) {
        const J = cal_friction(friction, f1[i], D1[i], V1[i], KD1[i],
            dt, dVdt1[i], dVdx1[i], a1[i], g);
        C1[i][0] = s1[i] * V1[i] + g / a1[i] * H1[i] - s1[i] * J + g / a1[i] * dt * V1[i] * theta1[i];
        C1[i][1] = g / a1[i];
    }

    // property of right adjacent pipe
    const f2 = link2.map(l => l.roughness);      // unitless
    const D2 = link2.map(l => l.diameter);       // m
    const a2 = link2.map(l => l.wavev);          // m/s
    const A2 = D2.map(d => Math.PI * d ** 2. / 4.);  // m^2
    const C2: number[][] = Array.from({ length: link2.length }, () => [0, 0]);
    const theta2 = link2.map(l => l.theta);
    const KD2 = link2.map(l => l.roughness_height);

    for (let i = 0; i < link2.length; i++) {
        const J = cal_friction(friction, f2[i], D2[i], V2[i], KD2[i],
            dt, dVdt2[i], dVdx2[i], a2[i], g);
        C2[i][0] = s2[i] * V2[i] + g / a2[i] * H2[i] - s2[i] * J + g / a2[i] * dt * V2[i] * theta2[i];
        C2[i][1] = g / a2[i];
    }

    return [A1, A2, C1, C2];
}

export function inner_node_unsteady(link: Pipe, H0: number[], V0: number[], dt: number, g: number,
    dVdx: number[], dVdt: number[]): [number[], number[]] {
    /**
     * Inner boundary MOC using C+ and C- characteristic curve with unsteady friction
     */
    const HP = new Array(H0.length).fill(0);
    const VP = new Array(V0.length).fill(0);
    // property of current pipe
    let f = link.roughness;     // unitless
    const D = link.diameter;      // m
    const a = link.wavev;        // m/s
    const theta = link.theta;
    const KD = link.roughness_height;
    const ga = g / a;
    const tol = 1e-1;

    for (let i = 1; i < H0.length - 1; i++) {
        const V1 = V0[i - 1]; const H1 = H0[i - 1];
        const V2 = V0[i + 1]; const H2 = H0[i + 1];
        const dVdx1 = dVdx[i - 1]; const dVdx2 = dVdx[i];
        const dVdt1 = dVdt[i - 1]; const dVdt2 = dVdt[i + 1];
        const C = [[0], [0]];

        let Re = Reynold(V1, D);
        let Js: number;
        if (Re < tol) {
            Js = 0;
        } else {
            f = quasi_steady_friction_factor(Re, KD);
            Js = f * dt / 2. / D * V1 * Math.abs(V1);
        }
        let Ju = unsteady_friction(Re, dVdt1, dVdx1, V1, a, g);
        const J1 = Js + Ju;
        C[0][0] = V1 + ga * H1 - J1 + ga * dt * V1 * theta;

        Re = Reynold(V2, D);
        if (Re < tol) {
            Js = 0;
        } else {
            f = quasi_steady_friction_factor(Re, KD);
            Js = f * dt / 2. / D * V2 * Math.abs(V2);
        }
        Ju = unsteady_friction(Re, dVdt2, dVdx2, V2, a, g);
        const J2 = Js + Ju;
        C[1][0] = -V2 + ga * H2 + J2 + ga * dt * V2 * theta;

        HP[i] = (C[0][0] + C[1][0]) / 2. / ga;
        VP[i] = -C[1][0] + ga * HP[i];
    }

    return [HP.slice(1, -1), VP.slice(1, -1)];
}

export function inner_node_quasisteady(link: Pipe, H0: number[], V0: number[], dt: number, g: number): [number[], number[]] {
    /**
     * Inner boundary MOC using C+ and C- characteristic curve with quasi-steady friction
     */
    const HP = new Array(H0.length).fill(0);
    const VP = new Array(V0.length).fill(0);
    // property of current pipe
    const D = link.diameter;      // m
    const a = link.wavev;        // m/s
    const theta = link.theta;
    const KD = link.roughness_height;
    const ga = g / a;
    const tol = 1e-1;

    for (let i = 1; i < H0.length - 1; i++) {
        const V1 = V0[i - 1]; const H1 = H0[i - 1];
        const V2 = V0[i + 1]; const H2 = H0[i + 1];
        const C = [[0], [0]];

        let Re = Reynold(V1, D);
        let J1: number;
        if (Re < tol) {
            J1 = 0;
        } else {
            const f = quasi_steady_friction_factor(Re, KD);
            J1 = f * dt / 2. / D * V1 * Math.abs(V1);
        }

        Re = Reynold(V2, D);
        let J2: number;
        if (Re < tol) {
            J2 = 0;
        } else {
            const f = quasi_steady_friction_factor(Re, KD);
            J2 = f * dt / 2. / D * V2 * Math.abs(V2);
        }

        C[0][0] = V1 + ga * H1 - J1 + ga * dt * V1 * theta;
        C[1][0] = -V2 + ga * H2 + J2 + ga * dt * V2 * theta;

        HP[i] = (C[0][0] + C[1][0]) / 2. / ga;
        VP[i] = -C[1][0] + ga * HP[i];
    }

    return [HP.slice(1, -1), VP.slice(1, -1)];
}

export function inner_node_steady(link: Pipe, H0: number[], V0: number[], dt: number, g: number): [number[], number[]] {
    /**
     * Inner boundary MOC using C+ and C- characteristic curve with steady friction
     */
    const HP = new Array(H0.length).fill(0);
    const VP = new Array(V0.length).fill(0);
    // property of current pipe
    const f = link.roughness;     // unitless
    const D = link.diameter;      // m
    const a = link.wavev;        // m/s
    const theta = link.theta;
    const ga = g / a;

    for (let i = 1; i < H0.length - 1; i++) {
        const V1 = V0[i - 1]; const H1 = H0[i - 1];
        const V2 = V0[i + 1]; const H2 = H0[i + 1];
        const C = [[0, 0], [0, 0]];

        const J1 = f * dt / 2. / D * V1 * Math.abs(V1);
        C[0][0] = V1 + ga * H1 - J1 + ga * dt * V1 * theta;
        C[0][1] = ga;

        const J2 = f * dt / 2. / D * V2 * Math.abs(V2);
        C[1][0] = -V2 + ga * H2 + J2 + ga * dt * V2 * theta;
        C[1][1] = ga;

        HP[i] = (C[0][0] + C[1][0]) / (C[0][1] + C[1][1]);
        VP[i] = -C[1][0] + C[1][1] * HP[i];
    }

    return [HP.slice(1, -1), VP.slice(1, -1)];
}

export function valve_node(
    KL_inv: number,
    link1: Pipe | Pipe[], link2: Pipe | Pipe[],
    H1: number | number[], V1: number | number[],
    H2: number | number[], V2: number | number[],
    dt: number, g: number, nn: number, s1: number[], s2: number[],
    friction: string,
    dVdx1: number | number[], dVdx2: number | number[],
    dVdt1: number | number[], dVdt2: number | number[]
): [number, number] {
    /**
     * Inline valve node MOC calculation
     */

    const link1Arr = ensureArray(link1);
    const V1Arr = ensureArray(V1);
    const H1Arr = ensureArray(H1);
    const dVdx1Arr = ensureArray(dVdx1);
    const dVdt1Arr = ensureArray(dVdt1);

    const link2Arr = ensureArray(link2);
    const V2Arr = ensureArray(V2);
    const H2Arr = ensureArray(H2);
    const dVdx2Arr = ensureArray(dVdx2);
    const dVdt2Arr = ensureArray(dVdt2);

    const [A1, A2, C1, C2] = cal_Cs(link1Arr, link2Arr, H1Arr, V1Arr, H2Arr, V2Arr, s1, s2, g, dt,
        friction, dVdx1Arr, dVdx2Arr, dVdt1Arr, dVdt2Arr);

    // parameters of the quadratic polynomial
    let aq = 1;
    let bq = 2 * g * KL_inv * (A2[0] / A1[0] / C1[0][1] + 1 / C2[0][1]);
    let cq = 2 * g * KL_inv * (C2[0][0] / C2[0][1] - C1[0][0] / C1[0][1]);

    // solve the quadratic equation
    let delta = bq ** 2 - 4 * aq * cq;
    let VP: number;
    let HP: number;

    if (delta >= 0) {
        VP = (-bq + Math.sqrt(delta)) / (2 * aq);
    } else if (delta > -1.0e-7 && delta < 0) {
        VP = (-bq) / (2 * aq);
    } else {
        VP = (-bq) / (2 * aq);
        console.warn('Error: The quadratic equation has no real solution (valve)');
    }

    if (VP >= 0) { // positive flow
        if (nn === 0) {  // pipe start
            VP = VP;
            HP = (C2[0][0] + VP) / C2[0][1];
        } else {        // pipe end
            VP = VP * A2[0] / A1[0];
            HP = (C1[0][0] - VP) / C1[0][1];
        }
    } else { // reverse flow
        // reconstruct the quadratic equation
        aq = 1;
        bq = 2 * g * KL_inv * (-A1[0] / A2[0] / C2[0][1] - 1 / C1[0][1]);
        cq = 2 * g * KL_inv * (-C2[0][0] / C2[0][1] + C1[0][0] / C1[0][1]);

        // solve the quadratic equation
        delta = bq ** 2 - 4 * aq * cq;

        if (delta >= 0) {
            VP = (-bq - Math.sqrt(delta)) / (2 * aq);
        } else if (delta > -1.0e-7 && delta < 0) {
            VP = (-bq) / (2 * aq);
        } else {
            VP = (-bq) / (2 * aq);
            console.warn('Error: The quadratic equation has no real solution (valve)');
        }

        if (nn === 0) {  // pipe start
            VP = VP * A1[0] / A2[0];
            HP = (C2[0][0] + VP) / C2[0][1];
        } else {        // pipe end
            VP = VP;
            HP = (C1[0][0] - VP) / C1[0][1];
        }
    }
    return [HP!, VP];
}

export function pump_node(
    pumpc: [[number, number, number], string],
    link1: Pipe | Pipe[], link2: Pipe | Pipe[],
    H1: number | number[], V1: number | number[],
    H2: number | number[], V2: number | number[],
    dt: number, g: number, nn: number, s1: number[], s2: number[],
    friction: string,
    dVdx1: number | number[], dVdx2: number | number[],
    dVdt1: number | number[], dVdt2: number | number[]
): [number, number] {
    /**
     * Inline pump node MOC calculation
     */

    const link1Arr = ensureArray(link1);
    const V1Arr = ensureArray(V1);
    const H1Arr = ensureArray(H1);
    const dVdx1Arr = ensureArray(dVdx1);
    const dVdt1Arr = ensureArray(dVdt1);

    const link2Arr = ensureArray(link2);
    const V2Arr = ensureArray(V2);
    const H2Arr = ensureArray(H2);
    const dVdx2Arr = ensureArray(dVdx2);
    const dVdt2Arr = ensureArray(dVdt2);

    const [A1, A2, C1, C2] = cal_Cs(link1Arr, link2Arr, H1Arr, V1Arr, H2Arr, V2Arr, s1, s2, g, dt,
        friction, dVdx1Arr, dVdx2Arr, dVdt1Arr, dVdt2Arr);

    // pump power function
    let [ap, bp, cp] = pumpc[0];
    ap = ap * A1[0] ** 2.;
    bp = bp * A1[0];

    // parameters of the quadratic polynomial
    const aq = 1;
    const bq = 1 / ap * (bp - 1 / C1[0][1] - A1[0] / C2[0][1] / A2[0]);
    const cq = 1 / ap * (-C2[0][0] / C2[0][1] + C1[0][0] / C1[0][1] + cp);

    // solve the quadratic equation
    const delta = bq ** 2. - 4. * aq * cq;
    let VP: number;
    let HP: number;

    if (delta >= 0) {
        VP = (-bq + Math.sqrt(delta)) / (2 * aq);
    } else if (delta > -1.0e-7 && delta < 0) {
        VP = (-bq) / (2 * aq);
    } else {
        VP = (-bq) / (2 * aq);
        console.warn('Error: The quadratic equation has no real solution (pump)');
    }

    const hp = ap * VP ** 2. + bp * VP + cp; // head gain

    if (VP > 0 && hp >= 0) { // positive flow & positive head gain
        if (nn === 0) {  // pipe start
            VP = VP * A1[0] / A2[0];
            HP = (C2[0][0] + VP) / C2[0][1];
        } else {        // pipe end
            VP = VP;
            HP = (C1[0][0] - VP) / C1[0][1];
        }
    } else if (VP < 0) {
        console.warn("Reverse flow stopped by check valve!");
        VP = 0;
        if (nn === 0) {  // pipe start
            HP = (C2[0][0] + VP) / C2[0][1];
        } else {
            HP = (C1[0][0] - VP) / C1[0][1];
        }
    } else { // positive flow and negative head gain
        console.warn("Negative head gain activates by-pass!");
        const hp_bypass = 0;
        // suction or discharge side?
        if (pumpc[1] === "s") { // suction side
            if (nn === 0) {  // pipe start
                HP = (C2[0][0] + VP) / C2[0][1];
            } else {
                HP = (C1[0][0] - VP) / C1[0][1];
            }
        } else {
            if (nn === 0) {  // pipe start
                HP = (C1[0][0] - VP) / C1[0][1] + hp_bypass;
            } else {
                HP = (C2[0][0] + VP) / C2[0][1] + hp_bypass;
            }
        }
    }

    return [HP!, VP];
}

export function source_pump(
    pump: [number, [number, number, number]],
    link2: Pipe | Pipe[],
    H2: number | number[], V2: number | number[],
    dt: number, g: number, s2: number[],
    friction: string,
    dVdx2: number | number[], dVdt2: number | number[]
): [number, number] {
    /**
     * Source Pump boundary MOC calculation
     */
    const pumpc = pump[1];
    const Hsump = pump[0];

    const link2Arr = ensureArray(link2);
    const V2Arr = ensureArray(V2);
    const H2Arr = ensureArray(H2);
    const dVdx2Arr = ensureArray(dVdx2);
    const dVdt2Arr = ensureArray(dVdt2);

    const [, A2, , C2] = cal_Cs(link2Arr, link2Arr, H2Arr, V2Arr, H2Arr, V2Arr, s2, s2, g, dt,
        friction, dVdx2Arr, dVdx2Arr, dVdt2Arr, dVdt2Arr);

    // pump power function
    let [ap, bp, cp] = pumpc;
    ap = ap * A2[0] ** 2.;
    bp = bp * A2[0];

    // parameters of the quadratic polynomial
    const aq = ap * C2[0][1] ** 2.;
    const bq = bp * C2[0][1] - 2. * ap * C2[0][0] * C2[0][1] - 1;
    const cq = ap * C2[0][0] ** 2. - bp * C2[0][0] + Hsump + cp;

    // solve the quadratic equation
    const delta = bq ** 2. - 4. * aq * cq;
    let HP: number;
    let VP: number;

    if (delta >= 0) {
        HP = (-bq - Math.sqrt(delta)) / (2 * aq);
    } else if (delta > -1.0e-7 && delta < 0) {
        HP = (-bq) / (2 * aq);
    } else {
        HP = (-bq) / (2 * aq);
        console.warn('The quadratic equation has no real solution (pump)');
    }

    if (HP! > Hsump) {
        VP = -C2[0][0] + C2[0][1] * HP!;
    } else {
        HP = Hsump;
        VP = -C2[0][0] + C2[0][1] * HP;
    }

    if (VP <= 0) { // positive flow
        console.warn("Reverse flow stopped by check valve!");
        VP = 0;
        HP = (C2[0][0] + VP) / C2[0][1];
    }

    return [HP!, VP!];
}

export function valve_end(H1: number, V1: number, V: number, nn: number, a: number, g: number,
    f: number, D: number, dt: number,
    KD: number, friction: string, dVdx2: number, dVdt2: number): [number, number] {
    /**
     * End Valve boundary MOC calculation
     */
    const J = cal_friction(friction, f, D, V, KD, dt, dVdt2, dVdx2, a, g);
    let HP: number;
    let VP: number;
    if (nn === 0) {
        HP = H1 + a / g * (V - V1) + a / g * J;
        VP = V;
    } else {
        HP = H1 - a / g * (V - V1) - a / g * J;
        VP = V;
    }
    return [HP, VP];
}

export function dead_end(linkp: Pipe, H1: number, V1: number, elev: number, nn: number,
    a: number, g: number, f: number, D: number, dt: number,
    KD: number, friction: string, dVdx1: number, dVdt1: number): [number, number] {
    /**
     * Dead end boundary MOC calculation with pressure dependant demand
     */

    const A = Math.PI / 4. * linkp.diameter ** 2.;
    const J = cal_friction(friction, f, D, V1, KD, dt, dVdt1, dVdx1, a, g);
    let HP: number;
    let VP: number;

    if (nn === 0) { // dead end is the start node of a pipe
        const k = linkp.start_node.demand_coeff + linkp.start_node.emitter_coeff;
        const aq = 1;
        const bq = -a / g * k / A;
        const cq = a / g * V1 - a / g * J - H1 - g / a * dt * V1 * linkp.theta + elev;
        // solve the quadratic equation
        const delta = bq ** 2. - 4. * aq * cq;
        if (delta >= 0) {
            HP = ((-bq - Math.sqrt(delta)) / (2 * aq)) ** 2. + elev;
        } else if (delta > -1.0e-7 && delta < 0) {
            HP = ((-bq) / (2 * aq)) ** 2. + elev;
        } else {
            HP = ((-bq) / (2 * aq)) ** 2. + elev;
            console.warn(`The quadratic equation has no real solution (dead end).\
                            The results might not be accurate.`);
        }
        VP = V1 - g / a * H1 - f * dt / (2. * D) * V1 * Math.abs(V1) + g / a * HP - g / a * dt * V1 * linkp.theta;
    } else { // dead end is the end node of a pipe
        const k = linkp.end_node.demand_coeff + linkp.end_node.emitter_coeff;
        const aq = 1;
        const bq = a / g * k / A;
        const cq = -a / g * V1 + a / g * J - H1 - g / a * dt * V1 * linkp.theta + elev;
        // solve the quadratic equation
        const delta = bq ** 2. - 4. * aq * cq;
        if (delta >= 0) {
            HP = ((-bq + Math.sqrt(delta)) / (2 * aq)) ** 2. + elev;
        } else if (delta > -1.0e-7 && delta < 0) {
            HP = ((-bq) / (2 * aq)) ** 2. + elev;
        } else {
            HP = ((-bq) / (2 * aq)) ** 2. + elev;
            console.warn("The quadratic equation has no real solution (dead end).\
The results might not be accurate.");
        }
        VP = V1 + g / a * H1 - f * dt / (2. * D) * V1 * Math.abs(V1) - g / a * HP + g / a * dt * V1 * linkp.theta;
    }
    return [HP!, VP!];
}

export function rev_end(H2: number, V2: number, H: number, nn: number, a: number, g: number,
    f: number, D: number, dt: number,
    KD: number, friction: string, dVdx2: number, dVdt2: number): [number, number] {
    /**
     * Reservoir/ Tank boundary MOC calculation
     */
    const J = cal_friction(friction, f, D, V2, KD, dt, dVdt2, dVdx2, a, g);
    let HP: number;
    let VP: number;
    if (nn === 0) {
        VP = V2 + g / a * (H - H2) - J;
        HP = H;
    } else {
        VP = V2 - g / a * (H - H2) - J;
        HP = H;
    }
    return [HP, VP];
}

export function add_leakage(
    emitter_coef: number, block_per: number,
    link1: Pipe | Pipe[], link2: Pipe | Pipe[], elev: number,
    H1: number | number[], V1: number | number[],
    H2: number | number[], V2: number | number[],
    dt: number, g: number, nn: number, s1: number[], s2: number[],
    friction: string,
    dVdx1: number | number[] = 0, dVdx2: number | number[] = 0,
    dVdt1: number | number[] = 0, dVdt2: number | number[] = 0
): [number, number | number[]] {
    /**
     * Leakage Node MOC calculation
     */

    const link1Arr = ensureArray(link1);
    const V1Arr = ensureArray(V1);
    const H1Arr = ensureArray(H1);
    const dVdx1Arr = ensureArray(dVdx1);
    const dVdt1Arr = ensureArray(dVdt1);

    const link2Arr = ensureArray(link2);
    const V2Arr = ensureArray(V2);
    const H2Arr = ensureArray(H2);
    const dVdx2Arr = ensureArray(dVdx2);
    const dVdt2Arr = ensureArray(dVdt2);

    const [A1, A2, C1, C2] = cal_Cs(link1Arr, link2Arr, H1Arr, V1Arr, H2Arr, V2Arr, s1, s2, g, dt,
        friction, dVdx1Arr, dVdx2Arr, dVdt1Arr, dVdt2Arr);

    const a_val = dot(C1.map(c => c[0]), A1) + dot(C2.map(c => c[0]), A2);
    const b_val = dot(C1.map(c => c[1]), A1) + (1 - block_per) * dot(C2.map(c => c[1]), A2);
    // parameters of the quadratic polynomial
    const a1 = b_val ** 2;
    const b1 = -2 * a_val * b_val - emitter_coef ** 2.;
    const c1 = a_val ** 2 + emitter_coef ** 2. * elev;

    // solve the quadratic equation
    const delta = b1 ** 2 - 4 * a1 * c1;
    let HP: number;
    if (delta >= 0) {
        HP = (-b1 - Math.sqrt(delta)) / (2 * a1);
    } else if (delta > -1.0e-7 && delta < 0) {
        HP = (-b1) / (2 * a1);
    } else {
        HP = (-b1) / (2 * a1);
        console.warn('Error: The quadratic equation has no real solution (leakage)');
    }

    let VP: number | number[];
    if (nn === 0) {  // pipe start
        VP = C2.map((c, i) => -c[0] + c[1] * HP!);
        if (VP.length === 1) VP = VP[0];
    } else {        // pipe end
        VP = C1.map((c, i) => c[0] - c[1] * HP!);
        if (VP.length === 1) VP = VP[0];
    }
    return [HP!, VP];
}

export function surge_tank(
    tank: number[],
    link1: Pipe | Pipe[], link2: Pipe | Pipe[],
    H1: number | number[], V1: number | number[],
    H2: number | number[], V2: number | number[],
    dt: number, g: number, nn: number, s1: number[], s2: number[],
    friction: string,
    dVdx1: number | number[], dVdx2: number | number[],
    dVdt1: number | number[], dVdt2: number | number[]
): [number, number | number[], number] {
    /**
     * Surge tank node MOC calculation
     */

    const link1Arr = ensureArray(link1);
    const V1Arr = ensureArray(V1);
    const H1Arr = ensureArray(H1);
    const dVdx1Arr = ensureArray(dVdx1);
    const dVdt1Arr = ensureArray(dVdt1);

    const link2Arr = ensureArray(link2);
    const V2Arr = ensureArray(V2);
    const H2Arr = ensureArray(H2);
    const dVdx2Arr = ensureArray(dVdx2);
    const dVdt2Arr = ensureArray(dVdt2);

    const [A1, A2, C1, C2] = cal_Cs(link1Arr, link2Arr, H1Arr, V1Arr, H2Arr, V2Arr, s1, s2, g, dt,
        friction, dVdx1Arr, dVdx2Arr, dVdt1Arr, dVdt2Arr);

    const [As, z, Qs] = tank;
    const at = 2. * As / dt;

    const HP = (dot(C1.map(c => c[0]), A1) + dot(C2.map(c => c[0]), A2) + at * z + Qs) /
        (dot(C1.map(c => c[1]), A1) + dot(C2.map(c => c[1]), A2) + at);

    const VP2 = C2.map((c) => -c[0] + c[1] * HP);
    const VP1 = C1.map((c) => c[0] - c[1] * HP);
    const QPs = dot(VP1, A1) - dot(VP2, A2);

    let VP: number | number[];
    if (nn === 0) {  // pipe start
        VP = VP2.length === 1 ? VP2[0] : VP2;
    } else {        // pipe end
        VP = VP1.length === 1 ? VP1[0] : VP1;
    }
    return [HP, VP, QPs];
}

export function air_chamber(
    tank: number[],
    link1: Pipe | Pipe[], link2: Pipe | Pipe[],
    H1: number | number[], V1: number | number[],
    H2: number | number[], V2: number | number[],
    dt: number, g: number, nn: number, s1: number[], s2: number[],
    friction: string,
    dVdx1: number | number[], dVdx2: number | number[],
    dVdt1: number | number[], dVdt2: number | number[]
): [number, number | number[], number, number] {
    /**
     * Air chamber node MOC calculation
     */

    const link1Arr = ensureArray(link1);
    const V1Arr = ensureArray(V1);
    const H1Arr = ensureArray(H1);
    const dVdx1Arr = ensureArray(dVdx1);
    const dVdt1Arr = ensureArray(dVdt1);

    const link2Arr = ensureArray(link2);
    const V2Arr = ensureArray(V2);
    const H2Arr = ensureArray(H2);
    const dVdx2Arr = ensureArray(dVdx2);
    const dVdt2Arr = ensureArray(dVdt2);

    const [A1, A2, C1, C2] = cal_Cs(link1Arr, link2Arr, H1Arr, V1Arr, H2Arr, V2Arr, s1, s2, g, dt,
        friction, dVdx1Arr, dVdx2Arr, dVdt1Arr, dVdt2Arr);

    // parameters
    const Hb = 10.3; // barometric pressure head
    const m = 1.2;
    const [As, ht, C_const, z, Qs] = tank;  // tank properties and results at last time step
    const at = 2. * As / dt;
    const Va = (ht - z) * As;  // air volume at last time step
    const Cor = 0;
    const a_val = dot(C1.map(c => c[0]), A1) + dot(C2.map(c => c[0]), A2);
    const b_val = dot(C1.map(c => c[1]), A1) + dot(C2.map(c => c[1]), A2);

    function tank_flow(QPs: number): number {
        return (((a_val - QPs) / b_val + Hb - z - (Qs + QPs) / at - Cor * QPs * Math.abs(QPs))
            * (Va - (Qs + QPs) * As / at) ** m - C_const);
    }

    function tank_flow_prime(QPs: number): number {
        const p1 = (-m * As / at * (Va - (Qs + QPs) * As / at) ** (m - 1) *
            ((a_val - QPs) / b_val + Hb - z - (Qs + QPs) / at - Cor * QPs * Math.abs(QPs)));
        const p2 = (-1 / b_val - 1 / at - Cor * 2. * QPs * Math.sign(QPs)) * (Va - (Qs + QPs) * As / at) ** m;
        return p1 + p2;
    }

    // solve nonlinear equation for tank flow at this time step using Newton's method
    let QPs = Qs;
    for (let iter = 0; iter < 100; iter++) {
        const fval = tank_flow(QPs);
        const fpval = tank_flow_prime(QPs);
        const step = fval / fpval;
        QPs = QPs - step;
        if (Math.abs(step) < 1e-10) break;
    }

    const zp = z + (Qs + QPs) / at;
    const HP = (a_val - QPs) / b_val;
    const VP2 = C2.map(c => -c[0] + c[1] * HP);
    const VP1 = C1.map(c => c[0] - c[1] * HP);

    let VP: number | number[];
    if (nn === 0) {  // pipe start
        VP = VP2.length === 1 ? VP2[0] : VP2;
    } else {        // pipe end
        VP = VP1.length === 1 ? VP1[0] : VP1;
    }
    return [HP, VP, QPs, zp];
}

// Helper: dot product of two arrays
function dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}
