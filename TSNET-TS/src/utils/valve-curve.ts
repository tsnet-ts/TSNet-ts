/**
 * The tsnet.utils.valve_curve contains function to define
 * valve characteristics curve, gate valve by default.
 */
import * as np from 'numpy-ts';

/**
 * Define valve curve
 *
 * @param s - open percentage
 * @param coeff - [percent_open, kl] arrays, optional
 * @returns k - Friction coefficient with given open percentage
 */
export function valve_curve(s: number, coeff: [number[], number[]] | null = null): number {
    const [percent_open, kl] = coeff == null
        ? [
            np.linspace(100, 0, 11).tolist() as number[],
            // loss coefficients for a gate valve
            [1 / 0.2, 2.50, 1.25, 0.625, 0.333, 0.17,
                0.100, 0.0556, 0.0313, 0.0167, 0.0]
          ]
        : coeff;

    const k = np.interp(
        np.array([s]),
        np.array([...percent_open].reverse()),
        np.array([...kl].reverse())
    );
    return (k.tolist() as number[])[0];
}