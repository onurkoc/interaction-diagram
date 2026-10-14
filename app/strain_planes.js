// @ts-check
/*
Strain planes for the interaction diagram.

A strain plane is given by two values:
    eps_c   strain at the compressed edge (top), compression negative
    eps_s1  strain of the reinforcement a_s1 at the depth d

legacy:    the hand-typed arrays of legacy/core.py
generated: planes turning around the pivot points A, B, C
           (EN 1992-1-1 6.1 (5), 6.1 (6), Bild 6.1)
*/

/** @typedef {import('./norms/en1992.js').Norm} Norm */

/**
 * The arrays of legacy/core.py, unchanged.
 * @returns {[number[], number[]]} epsilon_c, epsilon_s1
 */
export function legacy_strain_planes() {
    // a. steel strains tension side
    const epsilon_s1 = [
        -0.003499, -0.0032, -0.0029, -0.0026, -0.0023, -0.002, -0.0017,
        -0.0014, -0.0011, -0.0008, -0.0005, -0.0002, 0.0, 0.0004, 0.0007,
        0.001, 0.0013, 0.0016, 0.0019, 0.0022, 0.0025, 0.0028, 0.0031,
        0.0034, 0.0037, 0.004, 0.0043, 0.0049, 0.0052, 0.0055, 0.006,
        0.0065, 0.007, 0.0075, 0.008, 0.009, 0.0095, 0.01, 0.011, 0.012,
        0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012,
        0.012, 0.012, 0.012];

    // b. concrete strains compression side
    const epsilon_c = [
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0032, -0.0029,
        -0.0026, -0.0023, -0.002, -0.0017, -0.0014, -0.0011, -0.0008,
        -0.0005, -0.0002, 0.0];

    return [epsilon_c, epsilon_s1];
}

/**
 * Position t (0..1) between two planes where a strain reaches a target
 * value. The curve has a kink there (reinforcement starts to yield or
 * changes its sign), so the point is added to the grid.
 * @param {number[]} t_values  is extended
 * @param {number} q0  strain at t = 0
 * @param {number} q1  strain at t = 1
 * @param {number} target
 */
function add_kink(t_values, q0, q1, target) {
    if (q1 === q0) {
        return;
    }
    const t = (target - q0) / (q1 - q0);
    if (t <= 0 || t >= 1) {
        return;
    }
    for (const existing of t_values) {
        if (Math.abs(existing - t) < 1e-9) {
            // already a grid point
            return;
        }
    }
    t_values.push(t);
}

/**
 * Planes between plane0 and plane1: uniform grid with n_steps steps
 * plus the points where the curve has a kink.
 * A plane is [eps_c, eps_s1].
 * @param {[number, number]} plane0
 * @param {[number, number]} plane1
 * @param {number} n_steps
 * @param {number} d  depth of a_s1 [m]
 * @param {number} d_2  depth of a_s2 [m]
 * @param {number} eps_yd  yield strain of the reinforcement
 * @returns {[number, number][]}
 */
function region(plane0, plane1, n_steps, d, d_2, eps_yd) {
    const [y0, x0] = plane0;
    const [y1, x1] = plane1;

    const t_values = [];
    for (let i = 0; i <= n_steps; i++) {
        t_values.push(i / n_steps);
    }

    // strain of a_s2 (same formula as in core.js)
    const eps_s2_0 = y0 - (y0 - x0) / d * d_2;
    const eps_s2_1 = y1 - (y1 - x1) / d * d_2;
    for (const target of [-eps_yd, 0, eps_yd]) {
        add_kink(t_values, x0, x1, target);
        add_kink(t_values, eps_s2_0, eps_s2_1, target);
    }
    t_values.sort((a, b) => a - b);

    /** @type {[number, number][]} */
    const planes = [];
    for (const t of t_values) {
        if (t === 1) {
            planes.push([y1, x1]);
        } else {
            planes.push([y0 + t * (y1 - y0), x0 + t * (x1 - x0)]);
        }
    }
    return planes;
}

/**
 * Number of grid steps for a strain range.
 * @param {number} range
 * @param {number} step
 * @returns {number}
 */
function number_of_steps(range, step) {
    return Math.max(1, Math.ceil(Math.abs(range) / step - 1e-9));
}

/**
 * Strain planes from (almost) centric compression to tension.
 *
 * Region C (only with pivot_c): the planes turn around the point C at
 *     the depth (1 - eps_c1 / eps_cu) * h, where the strain is -eps_c1.
 *     From uniform compression -eps_c1 to eps_c = -eps_cu with zero
 *     strain at the bottom edge.
 *     Without pivot_c the planes turn around B down to uniform -eps_cu,
 *     like legacy/core.py.
 * Region B: eps_c = -eps_cu, eps_s1 rises to eps_s_max.
 * Region A: eps_s1 = eps_s_max, eps_c rises from -eps_cu to 0.
 * Tension end (only with tension_end): eps_s1 = eps_s_max, eps_c rises
 *     from 0 to eps_s_max (uniform tension).
 *
 * @param {Object} o
 * @param {number} o.eps_c1  positive, e.g. 0.002
 * @param {number} o.eps_cu  positive, e.g. 0.0035
 * @param {number} o.eps_s_max  e.g. 0.012
 * @param {number} o.eps_yd  yield strain of the reinforcement
 * @param {number} o.h_  height [m]
 * @param {number} o.d  depth of a_s1 [m]
 * @param {number} o.d_2  depth of a_s2 [m]
 * @param {boolean} o.pivot_c
 * @param {boolean} o.tension_end
 * @param {number} o.step  strain step of the grid in B, A and tension end
 * @param {number} o.steps_c  number of steps in region C
 * @returns {[number[], number[]]} epsilon_c, epsilon_s1
 */
export function generate_strain_planes({
    eps_c1, eps_cu, eps_s_max, eps_yd, h_, d, d_2,
    pivot_c, tension_end, step, steps_c,
}) {
    /** @type {[number, number][]} */
    let planes;
    /** @type {[number, number]} */
    let plane_b_start;

    if (pivot_c) {
        /** @type {[number, number]} */
        const plane_uniform = [-eps_c1, -eps_c1];
        // eps_c = -eps_cu and zero strain at the bottom edge
        plane_b_start = [-eps_cu, -eps_cu * (h_ - d) / h_];
        planes = region(plane_uniform, plane_b_start, steps_c, d, d_2, eps_yd);
    } else {
        plane_b_start = [-eps_cu, -eps_cu];
        planes = [plane_b_start];
    }

    /** @type {[number, number]} */
    const plane_a_start = [-eps_cu, eps_s_max];
    /** @type {[number, number]} */
    const plane_a_end = [0, eps_s_max];

    const region_b = region(
        plane_b_start, plane_a_start,
        number_of_steps(eps_s_max - plane_b_start[1], step), d, d_2, eps_yd);
    const region_a = region(
        plane_a_start, plane_a_end,
        number_of_steps(eps_cu, step), d, d_2, eps_yd);
    // the first plane of a region is the last one of the region before
    planes = planes.concat(region_b.slice(1), region_a.slice(1));

    if (tension_end) {
        /** @type {[number, number]} */
        const plane_tension = [eps_s_max, eps_s_max];
        const region_t = region(
            plane_a_end, plane_tension,
            number_of_steps(eps_s_max, step), d, d_2, eps_yd);
        planes = planes.concat(region_t.slice(1));
    }

    const epsilon_c = planes.map(plane => plane[0]);
    const epsilon_s1 = planes.map(plane => plane[1]);
    return [epsilon_c, epsilon_s1];
}

/**
 * Strain planes as the norm configuration asks for.
 * @param {Norm} norm
 * @param {Object} section
 * @param {number} section.h_  height [m]
 * @param {number} section.d  depth of a_s1 [m]
 * @param {number} section.d_2  depth of a_s2 [m]
 * @param {number} section.f_yd  [N/mm2]
 * @returns {[number[], number[]]} epsilon_c, epsilon_s1
 */
export function strain_planes(norm, { h_, d, d_2, f_yd }) {
    const options = norm.strain_planes;
    if (options.type === 'legacy') {
        return legacy_strain_planes();
    }
    return generate_strain_planes({
        eps_c1: norm.eps_c1,
        eps_cu: norm.eps_cu,
        eps_s_max: norm.eps_s_max,
        eps_yd: f_yd / norm.e_steel,
        h_: h_,
        d: d,
        d_2: d_2,
        pivot_c: options.pivot_c,
        tension_end: options.tension_end,
        step: options.step,
        steps_c: options.steps_c,
    });
}
