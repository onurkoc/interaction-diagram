// @ts-check
/*
Radial utilization of a load point

    utilization = |S_d| / |R_d|

S_d is the load point (M, N), R_d the point of the capacity curve on the
ray from the origin through the load point. On the curve the
utilization is 1, outside of it above 1 (not capped), at the origin 0.

It assumes that N and M grow in proportion. It is defined only if the
origin (M = 0, N = 0) lies inside of the curve. The curve of a plain
concrete section ends at the origin, so there is no value for it.
*/

/** @typedef {import('./core.js').Values} Values */

/**
 * z component of the cross product of two vectors in the M-N plane
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
function cross(ax, ay, bx, by) {
    return ax * by - ay * bx;
}

/**
 * The closed capacity curve with reinforcement: the right side, then
 * the left side backwards (as it is drawn).
 * @param {Values} values
 * @returns {[number[], number[]]} moments, normal forces
 */
function closed_curve(values) {
    const curve_x = values['Moment Reinf'].concat(
        values['Moment Reinf Neg'].slice().reverse());
    const curve_y = values['Normal Force Reinf'].concat(
        values['Normal Force Reinf Neg'].slice().reverse());
    return [curve_x, curve_y];
}

/**
 * Where does the ray from the origin in the direction (dx, dy) leave the
 * curve? Returns the factor k of the farthest point k * (dx, dy) of the
 * curve on the ray, or null if the ray does not meet the curve.
 * @param {number} dx  direction, moment
 * @param {number} dy  direction, normal force
 * @param {number[]} curve_x
 * @param {number[]} curve_y
 * @returns {number | null}
 */
function ray_factor(dx, dy, curve_x, curve_y) {
    // a point of the curve exactly on the ray (a corner) has to count
    const tolerance = 1e-9;
    /** @type {number | null} */
    let k_max = null;
    for (let i = 0; i < curve_x.length - 1; i++) {
        // segment A + u * (B - A), 0 <= u <= 1
        const ax = curve_x[i];
        const ay = curve_y[i];
        const ex = curve_x[i + 1] - ax;
        const ey = curve_y[i + 1] - ay;
        const denominator = cross(dx, dy, ex, ey);
        if (denominator === 0) {
            // parallel to the ray (or a segment without length)
            continue;
        }
        const k = cross(ax, ay, ex, ey) / denominator;
        const u = cross(ax, ay, dx, dy) / denominator;
        if (u < -tolerance || u > 1 + tolerance || k <= tolerance) {
            continue;
        }
        if (k_max === null || k > k_max) {
            k_max = k;
        }
    }
    return k_max;
}

/**
 * Is the origin (M = 0, N = 0) inside of the curve, not on it?
 * Checked with the four rays along the axes: each of them has to meet
 * the curve at a distance from the origin.
 * @param {Values} values  resulting values from int_diagram
 * @returns {boolean}
 */
export function origin_inside(values) {
    const [curve_x, curve_y] = closed_curve(values);
    // directions with the size of the curve, so that the tolerance of
    // ray_factor does not depend on the units
    const size_x = Math.max(...curve_x.map(Math.abs));
    const size_y = Math.max(...curve_y.map(Math.abs));
    if (size_x === 0 || size_y === 0) {
        return false;
    }
    for (const [dx, dy] of [[size_x, 0], [-size_x, 0], [0, size_y], [0, -size_y]]) {
        if (ray_factor(dx, dy, curve_x, curve_y) === null) {
            return false;
        }
    }
    return true;
}

/**
 * Radial utilization |S_d| / |R_d| of a load point.
 * @param {number} m  moment of the load point
 * @param {number} n  normal force of the load point
 * @param {Values} values  resulting values from int_diagram
 * @returns {number | null} null: not defined, the origin is not inside
 *     of the curve (e.g. plain concrete section)
 */
export function radial_utilization(m, n, values) {
    if (!origin_inside(values)) {
        return null;
    }
    if (m === 0 && n === 0) {
        return 0;
    }
    const [curve_x, curve_y] = closed_curve(values);
    // R_d = k * S_d, so |S_d| / |R_d| = 1 / k
    const k = ray_factor(m, n, curve_x, curve_y);
    if (k === null) {
        // cannot happen for a closed curve around the origin
        return null;
    }
    return 1 / k;
}
