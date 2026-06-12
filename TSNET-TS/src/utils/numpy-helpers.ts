/**
 * Manual implementations of numpy functions not available in numpy-ts.
 */
import * as np from 'numpy-ts';

/**
 * Piecewise function - equivalent to numpy.piecewise
 *
 * Evaluate a piecewise-defined function.
 *
 * @param x - NDArray of input values
 * @param condlist - Array of boolean NDArrays (conditions)
 * @param funclist - Array of scalars or functions to apply for each condition
 * @returns NDArray with piecewise-applied values
 */
export function piecewise(
    x: np.NDArray,
    condlist: np.NDArray[],
    funclist: (number | ((xi: number) => number))[]
): np.NDArray {
    const xData = x.tolist() as number[];
    const n = xData.length;
    const result = new Array<number>(n).fill(0);

    for (let idx = 0; idx < condlist.length; idx++) {
        const cond = condlist[idx].tolist() as (boolean | number)[];
        const func = funclist[idx];
        for (let i = 0; i < n; i++) {
            if (cond[i]) {
                if (typeof func === 'function') {
                    result[i] = func(xData[i]);
                } else {
                    result[i] = func;
                }
            }
        }
    }

    return np.array(result);
}
