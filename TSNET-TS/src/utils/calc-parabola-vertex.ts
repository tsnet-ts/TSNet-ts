/**
 * The tsnet.utils.calc_parabola_vertex contains function to
 * calculate the parameters of a parabola based on the
 * coordinated of three points on the curve.
 */

/**
 * Adapted and modified to get the unknowns for defining a parabola
 *
 * @param points - Three points on the pump characteristics curve.
 * @returns [A, B, C] coefficients of the parabola
 */
export function calc_parabola_vertex(
    points: [[number, number], [number, number], [number, number]]
): [number, number, number] {
    const [[x1, y1], [x2, y2], [x3, y3]] = points;
    const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
    const A = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
    const B = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / denom;
    const C = (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 * (x1 - x2) * y3) / denom;
    return [A, B, C];
}