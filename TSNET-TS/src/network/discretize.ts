/**
 * The tsnet.network.discretize contains methods to perform
 * spatial and temporal discretization by adjusting wave speed
 * and time step to solve compatibility equations in case of
 * uneven wave travel time.
 */

import * as np from 'numpy-ts';
import type { TransientModel } from './model.ts';

export function discretization(tm: TransientModel, dt: number): TransientModel {
    /**
     * Discretize in temporal and spatial space using wave speed adjustment scheme.
     *
     * Parameters
     * ----------
     * tm : TransientModel
     *     Network
     * dt : float
     *     User defined time step
     *
     * Returns
     * -------
     * tm : TransientModel
     *     Network with updated parameters
     */

    const max_dt = max_time_step(tm);
    if (dt > max_dt) {
        throw new Error(`time step is too large. Please define \
                    a time step that is less than ${max_dt.toFixed(5)} `);
    } else {
        const Ndis = cal_N(tm, dt);

        // add number of segments as a new attribute to each pipe
        let i = 0;
        for (const [, pipe] of tm.pipes()) {
            pipe.number_of_segments = Math.floor(Ndis[i][0]);
            i++;
        }
        // adjust wave speed and calculate time step
        adjust_wavev(tm);
    }
    return tm;
}

export function max_time_step(tm: TransientModel): number {
    /**
     * Determine the maximum time step based on Courant's criteria.
     *
     * Parameters
     * ----------
     * tm : TransientModel
     *     Network
     *
     * Returns
     * -------
     * max_dt : float
     *     Maximum time step allowed for this network
     */
    let max_dt = Infinity;

    for (const [, pipe] of tm.pipes()) {
        const dt = pipe.length / (2. * pipe.wavev);
        if (max_dt > dt) {
            max_dt = dt; //- 0.001  // avoid numerical issue which cause N = 0
        }
    }
    return max_dt;
}

export function discretization_N(tm: TransientModel, dt: number): TransientModel {
    /**
     * Discretize in temporal and spatial space using wave speed adjustment scheme.
     *
     * Parameters
     * ----------
     * tm : TransientModel
     *     Network
     * dt : float
     *     User defined time step
     *
     * Returns
     * -------
     * tm : TransientModel
     *     Network with updated parameters
     */

    const Ndis = cal_N(tm, dt);

    // add number of segments as a new attribute to each pipe
    let i = 0;
    for (const [, pipe] of tm.pipes()) {
        pipe.number_of_segments = Math.floor(Ndis[i][0]);
        i++;
    }
    // adjust wave speed and calculate time step
    adjust_wavev(tm);
    return tm;
}

export function max_time_step_N(tm: TransientModel, N: number): number {
    /**
     * Determine the maximum time step based on Courant's criteria.
     *
     * Parameters
     * ----------
     * tm : TransientModel
     *     Network
     *
     * Returns
     * -------
     * max_dt : float
     *     Maximum time step allowed for this network
     */
    let max_dt = Infinity;
    for (const [, pipe] of tm.pipes()) {
        const dt = pipe.length / (N * pipe.wavev);
        if (max_dt > dt) {
            max_dt = dt; //- 1e-5  // avoid numerical issue which cause N = 0
        }
    }
    return max_dt;
}

function cal_N(tm: TransientModel, dt: number): number[][] {
    /**
     * Determine the number of computation unites ($N_i$) for each pipes.
     *
     * Parameters
     * ----------
     * tm : TransientModel
     *     Network
     * dt : float
     *     Time step for transient simulation
     */
    const N: number[][] = Array.from({ length: tm.num_pipes }, () => [0]);

    for (const [, pipe] of tm.pipes()) {
        // N[int(pipe.id)-1] =  int(2*np.int(pipe.length/ (2. * pipe.wavev *dt)))
        N[pipe.id - 1][0] = Math.round(Math.floor(pipe.length / (pipe.wavev * dt)));
    }
    return N;
}

function adjust_wavev(tm: TransientModel): TransientModel {
    /**
     * Adjust wave speed and time step to solve compatibility equations.
     *
     * Parameters
     * ----------
     * tm : TransientModel
     *     Network
     *
     * Returns
     * -------
     * tm : TransientModel
     *     Network with adjusted wave speed.
     * dt : float
     *     Adjusted time step
     */

    const phi: number[] = [];
    for (const [, pipe] of tm.pipes()) {
        phi.push(pipe.length / pipe.wavev / pipe.number_of_segments);
    }
    const phiSqSum = phi.reduce((sum, v) => sum + v * v, 0);
    tm.wavespeed_adj = phiSqSum;
    const phiSum = phi.reduce((sum, v) => sum + v, 0);
    const theta = phiSum / phiSqSum;

    // adjust time step
    const dt = 1 / theta;

    // adjust the wave speed of each links
    for (const [, pipe] of tm.pipes()) {
        pipe.wavev = pipe.wavev * phi[pipe.id - 1] * theta;
    }

    // set time step as a new attribute to TransientModel
    tm.time_step = dt;
    return tm;
}
