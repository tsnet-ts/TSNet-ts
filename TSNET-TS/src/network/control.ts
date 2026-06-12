/**
 * The tsnet.network.control module includes method to define
 * network controls of the pump and valve. These control modify
 * parameters in the network during transient simulation.
 */
import * as np from 'numpy-ts';
import { piecewise } from '../utils/numpy-helpers.ts';

export function valveclosing(dt: number, tf: number, valve_op: number[]): np.NDArray {
    /**
     * Define valve operation curve (percentage open v.s. time)
     *
     * Parameters
     * ----------
     * dt : float
     *     Time step
     * tf : float
     *     Simulation Time
     * valve_op : list
     *     Contains parameters to define valve operation rule
     *     valve_op = [tc,ts,se,m]
     *     tc : the duration takes to close the valve [s]
     *     ts : closure start time [s]
     *     se : final open percentage [s]
     *     m  : closure constant [unitless]
     *
     * Returns
     * -------
     * s : list
     *     valve operation curve
     */

    const [tc, ts, se, m] = valve_op;
    const tn = Math.floor(tf / dt);
    let s: np.NDArray;

    // abrupt closure
    if (tc === 0) {
        s = np.array(Array.from({ length: tn }, (_, i) => (1 - (i * dt - ts)) ** 1));
        s = np.where(np.greater(s, 1), np.full_like(s, 1), s) as np.NDArray;
        s = np.where(np.less(s, 1), np.full_like(s, se), s) as np.NDArray;
    }
    // gradual closure
    else {
        let t = np.array(Array.from({ length: tn }, (_, i) => (i * dt - ts) / tc));
        t = np.where(np.greater(t, 1), np.full_like(t, 1), t) as np.NDArray;
        t = np.where(np.less(t, 0), np.full_like(t, 0), t) as np.NDArray;
        s = np.array(Array.from({ length: tn }, (_, i) => 1 - (1 - se) * (t.get([i]) as number) ** m));
        s = np.where(np.greater(s, 1), np.full_like(s, 1), s) as np.NDArray;
        s = np.where(np.less(s, se), np.full_like(s, se), s) as np.NDArray;
    }

    return s;
}

export function valveopening(dt: number, tf: number, valve_op: number[]): np.NDArray {
    /**
     * Define valve operation curve (percentage open v.s. time)
     *
     * Parameters
     * ----------
     * dt : float
     *     Time step
     * tf : float
     *     Simulation Time
     * valve_op : list
     *     Contains parameters to define valve operation rule
     *     valve_op = [tc,ts,se,m]
     *     tc : the duration takes to close the valve [s]
     *     ts : closure start time [s]
     *     se : final open percentage [s]
     *     m  : closure constant [unitless]
     *
     * Returns
     * -------
     * s : list
     *     valve operation curve
     */

    const [tc, ts, se, m] = valve_op;
    const tn = Math.floor(tf / dt);
    let s: np.NDArray;

    // abrupt opening
    if (tc === 0) {
        s = np.array(Array.from({ length: tn }, (_, i) => ((i * dt - ts)) ** 1));
        s = np.where(np.greater(s, 0), np.full_like(s, se), s) as np.NDArray;
        s = np.where(np.less(s, 0), np.full_like(s, 0), s) as np.NDArray;
    }
    // gradual opening
    else {
        let t = np.array(Array.from({ length: tn }, (_, i) => (i * dt - ts) / tc));
        t = np.where(np.greater(t, 1), np.full_like(t, 1), t) as np.NDArray;
        t = np.where(np.less(t, 0), np.full_like(t, 0), t) as np.NDArray;
        s = np.array(Array.from({ length: tn }, (_, i) => se * (t.get([i]) as number) ** m));
        s = np.where(np.less(s, 0), np.full_like(s, 0), s) as np.NDArray;
        s = np.where(np.greater(s, se), np.full_like(s, se), s) as np.NDArray;
    }
    return s;
}

export function pumpclosing(dt: number, tf: number, pump_op: number[]): np.NDArray {
    /**
     * Define pump operation curve (percentage open v.s. time)
     *
     * Parameters
     * ----------
     * dt : float
     *     Time step
     * tf : float
     *     Simulation Time
     * pump_op : list
     *     Contains parameters to define valve operation rule
     *     pump_op = [tc,ts,se,m]
     *     tc : the duration takes to close the valve [s]
     *     ts : closure start time [s]
     *     se : final open percentage [s]
     *     m  : closure constant [unitless]
     *
     * Returns
     * -------
     * s : list
     *     valve operation curve
     */

    let [tc, ts, se, m] = pump_op;
    // do not allow the pump to be fully closed due to numerical issues
    if (se === 0) {
        se = 0.0001;
    }

    const tn = Math.floor(tf / dt);
    let s: np.NDArray;

    // gradual closure
    if (tc !== 0) {
        s = np.array(Array.from({ length: tn }, (_, i) => (1 - (i * dt - ts) / tc) ** m));
        s = np.where(np.greater(s, 1), np.full_like(s, 1), s) as np.NDArray;
        s = np.where(np.less(s, se), np.full_like(s, se), s) as np.NDArray;
    }

    // abrupt closure
    if (tc === 0) {
        let t = np.array(Array.from({ length: tn }, (_, i) => (i * dt - ts) / tc));
        t = np.where(np.greater(t, 1), np.full_like(t, 1), t) as np.NDArray;
        t = np.where(np.less(t, 0), np.full_like(t, 0), t) as np.NDArray;
        s = np.array(Array.from({ length: tn }, (_, i) => 1 - (1 - se) * (t.get([i]) as number) ** m));
        s = np.where(np.greater(s, 1), np.full_like(s, 1), s) as np.NDArray;
        s = np.where(np.less(s, se), np.full_like(s, se), s) as np.NDArray;
    }
    return s!;
}

export function pumpopening(dt: number, tf: number, pump_op: number[]): np.NDArray {
    /**
     * Define pump operation curve (percentage open v.s. time)
     *
     * Parameters
     * ----------
     * dt : float
     *     Time step
     * tf : float
     *     Simulation Time
     * pump_op : list
     *     Contains parameters to define pump operation rule
     *     pump_op = [tc,ts,se,m]
     *     tc : the duration takes to start up the pump [s]
     *     ts : open start time [s]
     *     se : final open percentage [s]
     *     m  : closure constant [unitless]
     *
     * Returns
     * -------
     * s : list
     *     valve operation curve
     */

    const [tc, ts, se, m] = pump_op;
    const tn = Math.floor(tf / dt);
    let s: np.NDArray;

    // abrupt opening
    if (tc === 0) {
        s = np.array(Array.from({ length: tn }, (_, i) => ((i * dt - ts)) ** 1));
        s = np.where(np.greater(s, 0), np.full_like(s, se), s) as np.NDArray;
        s = np.where(np.less(s, 0), np.full_like(s, 0), s) as np.NDArray;
    }
    // gradual opening
    else {
        let t = np.array(Array.from({ length: tn }, (_, i) => (i * dt - ts) / tc));
        t = np.where(np.greater(t, 1), np.full_like(t, 1), t) as np.NDArray;
        t = np.where(np.less(t, 0), np.full_like(t, 0), t) as np.NDArray;
        s = np.array(Array.from({ length: tn }, (_, i) => se * (t.get([i]) as number) ** m));
        s = np.where(np.less(s, 0), np.full_like(s, 0), s) as np.NDArray;
        s = np.where(np.greater(s, se), np.full_like(s, se), s) as np.NDArray;
    }
    return s!;
}

export function burstsetting(dt: number, tf: number, ts: number, tc: number, final_burst_coeff: number): np.NDArray {
    /**
     * Calculate the burst area as a function of simulation time
     *
     * Parameters
     * ----------
     * dt : float
     *     Time step
     * tf : float
     *     Simulation Time
     * ts : float
     *     Burst start time
     * tc : float
     *     Time for burst to fully develop
     * final_burst_coeff : list or float
     *     Final emitter coefficient at the burst nodes
     */

    const tn = Math.floor(tf / dt);
    let burst_A: np.NDArray;

    if (tc !== 0) {
        let s = np.array(Array.from({ length: tn }, (_, i) => (i * dt - ts) / tc));
        s = np.where(np.greater(s, 1), np.full_like(s, 1), s) as np.NDArray;
        s = np.where(np.less(s, 0), np.full_like(s, 0), s) as np.NDArray;
        burst_A = np.multiply(s, final_burst_coeff) as np.NDArray;
    } else {
        let s = np.array(Array.from({ length: tn }, (_, i) => (i * dt - ts)));
        s = np.where(np.greater(s, 0), np.full_like(s, 1), s) as np.NDArray;
        s = np.where(np.less(s, 0), np.full_like(s, 0), s) as np.NDArray;
        burst_A = np.multiply(s, final_burst_coeff) as np.NDArray;
    }

    return burst_A;
}

export function demandpulse(dt: number, tf: number, tc: number, ts: number, tp: number, dp: number): np.NDArray {
    /**
     * Calculate demand pulse multiplier
     *
     * Parameters
     * dt : float
     *     Time step
     * tf : float
     *     Simulation Time
     * tc : float
     *     Total pulse duration
     * ts : float
     *     Pulse start time
     * tp : float
     *     Pulse increase time
     * dp : float
     *     Pulse multiplier
     */

    const tn = Math.floor(tf / dt);
    const x = np.linspace(0, tf, tn);
    const t_change = tp;
    const stay = tc - 2 * tp;
    let pulse_mul: np.NDArray;

    if (t_change !== 0) {
        const s = piecewise(x,
            [
                np.less_equal(x, ts),
                np.logical_and(np.greater(x, ts), np.less_equal(x, ts + t_change)),
                np.logical_and(np.greater(x, ts + t_change), np.less_equal(x, ts + t_change + stay)),
                np.logical_and(np.greater(x, ts + t_change + stay), np.less_equal(x, ts + tc)),
                np.greater(x, ts + tc)
            ],
            [
                0,
                (xi: number) => (xi - ts) / t_change,
                1,
                (xi: number) => 1 - (xi - ts - t_change - stay) / t_change,
                0
            ]
        );
        pulse_mul = np.multiply(s, dp) as np.NDArray;
    } else {
        const s = piecewise(x,
            [
                np.less_equal(x, ts),
                np.logical_and(np.greater(x, ts), np.less_equal(x, ts + stay)),
                np.greater(x, ts + tc)
            ],
            [0, 1, 0]
        );
        pulse_mul = np.multiply(s, dp) as np.NDArray;
    }

    return pulse_mul;
}
