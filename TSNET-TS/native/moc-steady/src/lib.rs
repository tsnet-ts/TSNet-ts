#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

/// Steady-friction interior nodes for every pipe, one call per time step.
///
/// `offs` has `n_pipes + 1` element offsets into the flat head/velocity arrays.
/// `props` is `n_pipes` groups of `[f, D, theta, wave_speed]`.
/// Endpoints of each pipe are not written.
#[no_mangle]
pub unsafe extern "C" fn steady_interiors(
    n_pipes: u32,
    offs: *const u32,
    props: *const f64,
    dt: f64,
    g: f64,
    h_in: *const f64,
    v_in: *const f64,
    h_out: *mut f64,
    v_out: *mut f64,
) {
    let mut p = 0u32;
    while p < n_pipes {
        let start = unsafe { *offs.add(p as usize) } as usize;
        let end = unsafe { *offs.add(p as usize + 1) } as usize;
        let base = (p as usize) * 4;
        let f = unsafe { *props.add(base) };
        let d = unsafe { *props.add(base + 1) };
        let theta = unsafe { *props.add(base + 2) };
        let a = unsafe { *props.add(base + 3) };
        let ga = g / a;
        let coef = f * dt / 2.0 / d;
        let gadt = ga * dt;
        let two_ga = ga + ga;
        let mut i = start + 1;
        while i + 1 < end {
            let v1 = unsafe { *v_in.add(i - 1) };
            let h1 = unsafe { *h_in.add(i - 1) };
            let v2 = unsafe { *v_in.add(i + 1) };
            let h2 = unsafe { *h_in.add(i + 1) };
            let j1 = coef * v1 * v1.abs();
            let cp = v1 + ga * h1 - j1 + gadt * v1 * theta;
            let j2 = coef * v2 * v2.abs();
            let cm = -v2 + ga * h2 + j2 + gadt * v2 * theta;
            let hp = (cp + cm) / two_ga;
            let vp = -cm + ga * hp;
            unsafe {
                *h_out.add(i) = hp;
                *v_out.add(i) = vp;
            }
            i += 1;
        }
        p += 1;
    }
}
