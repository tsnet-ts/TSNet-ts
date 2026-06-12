/**
 * Cumulative sum algorithm (CUSUM) to detect abrupt changes in data.
 */

export function detect_cusum(
    time: number[],
    x: number[],
    threshold: number,
    drift: number,
    show: boolean,
    ax: unknown
): [number[], number[], number[]] {
    const ta: number[] = [];
    const tf: number[] = [];
    const amp: number[] = [];

    const n = x.length;
    let s_pos = 0;
    let s_neg = 0;

    for (let i = 1; i < n; i++) {
        const s = x[i] - x[i - 1];
        s_pos = Math.max(0, s_pos + s - drift);
        s_neg = Math.min(0, s_neg + s + drift);

        if (s_pos > threshold) {
            ta.push(i);
            amp.push(s_pos);
            s_pos = 0;
        }
        if (s_neg < -threshold) {
            tf.push(i);
            amp.push(s_neg);
            s_neg = 0;
        }
    }

    return [ta, tf, amp];
}
