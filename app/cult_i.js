// @ts-check
/*
CULT-I, capacity utilization of linings in tunnels
1:1 port of legacy/cult_i.py. The calculation is NOT corrected here,
known problems are listed in NOTES.md.
*/
import { intersection } from './intersection.js';
import { min_eccentricity_moments } from './core.js';

/** @typedef {import('./core.js').InputValues} InputValues */
/** @typedef {import('./core.js').Values} Values */

/**
 * Smallest value of an array, like min(list) in Python.
 * @param {number[]} values
 * @returns {number}
 */
function min(values) {
    return Math.min(...values);
}

/**
 * Largest value of an array, like max(list) in Python.
 * @param {number[]} values
 * @returns {number}
 */
function max(values) {
    return Math.max(...values);
}

/**
 * Like round(x, 3) of a numpy float: x * 1000, round half to even, / 1000.
 * (Math.round would round a half always up.)
 * @param {number} x
 * @returns {number}
 */
function round3(x) {
    const scaled = x * 1000;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded;
    if (diff < 0.5) {
        rounded = floor;
    } else if (diff > 0.5) {
        rounded = floor + 1;
    } else {
        rounded = (floor % 2 === 0) ? floor : floor + 1;
    }
    return rounded / 1000;
}

/**
 * capacity utilization of linings in tunnels (CULT-I)
 * according to the paper:
 * Performance indicator of tunnel linings under geotechnical uncertainty;
 * Spyridis, Panagiotis; Konstantis, Spyridon; Gakis, Angelos
 * cult_I = sqrt( (N_rel,i^2 + M_rel,i^2) / (N_rel,max^2 + M_rel,max^2) )
 * @param {number} m  x coordinate of a point, moment
 * @param {number} n  y coordinate of a point, normal force
 * @param {InputValues} input_values  input values from int_diagram
 * @param {Values} values  resulting values from int_diagram
 * @returns {number | 'outside'}
 */
export function cult_I(m, n, input_values, values) {
    // The curves with reinforcement are the resistance on both sides.
    // Without reinforcement they are the same as the concrete curves.
    const limit_x_pos = values['Moment Reinf'];
    const limit_y = values['Normal Force Reinf'];
    const limit_x_neg = values['Moment Reinf Neg'];
    const limit_y_neg = values['Normal Force Reinf Neg'];

    let n_rel_max;
    if (input_values['a_s1'] === 0) {
        n_rel_max = Math.abs(min(limit_y) - max(limit_y));
    } else {
        n_rel_max = Math.abs(min(limit_y) - max(limit_y)) / 2;  // take the half
    }
    const m_rel_max = Math.abs(max(limit_x_pos));

    const horizontal_cut_x = [min(limit_x_neg),
                              max(limit_x_pos)];
    const horizontal_cut_y = [n, n];

    const vertical_cut_x = [m, m];
    const vertical_cut_y = [max(limit_y),
                            min(limit_y)];
    let m_rel_i, n_rel_i;
    if (m > 0) {
        const [x1] = intersection(horizontal_cut_x,
                                  horizontal_cut_y,
                                  limit_x_pos,
                                  limit_y);
        const [, y2] = intersection(vertical_cut_x,
                                    vertical_cut_y,
                                    limit_x_pos,
                                    limit_y);
        if (x1.length === 0 || y2.length === 0) {
            return 'outside';
        }
        if (x1.length > 1) {
            // Python: "if m_rel_i < 0" with an array of several values
            // raises a ValueError (NOTES.md, N4)
            throw new Error('The truth value of an array with more than ' +
                            'one element is ambiguous.');
        }
        m_rel_i = x1[0] - m;
        if (y2.length > 1) {
            n_rel_i = Math.min(Math.abs(y2[0] - n), Math.abs(y2[1] - n));
        } else {
            n_rel_i = Math.abs(y2[0] - n);
            if (n_rel_i > n_rel_max) {
                n_rel_i = Math.min(Math.abs(min(limit_y)) - Math.abs(n),
                                   max(limit_y) - Math.abs(n));
            }
        }
        if (m_rel_i < 0) {
            return 'outside';
        }
    } else if (m === 0) {
        m_rel_i = m_rel_max;
        n_rel_i = Math.min(Math.abs(min(limit_y)) - Math.abs(n),
                           max(limit_y) - Math.abs(n));
        if (n > max(limit_y) || n < min(limit_y)) {
            // beyond pure tension or beyond centric compression
            return 'outside';
        }
    } else {
        const [x1] = intersection(horizontal_cut_x,
                                  horizontal_cut_y,
                                  limit_x_neg,
                                  limit_y_neg);
        const [, y2] = intersection(vertical_cut_x,
                                    vertical_cut_y,
                                    limit_x_neg,
                                    limit_y_neg);
        if (x1.length === 0 || y2.length === 0) {
            return 'outside';
        }
        if (x1.length > 1) {
            // Python: "if m_rel_i > 0" with an array of several values
            // raises a ValueError (NOTES.md, N4)
            throw new Error('The truth value of an array with more than ' +
                            'one element is ambiguous.');
        }
        m_rel_i = x1[0] - m;
        if (y2.length > 1) {
            n_rel_i = Math.min(Math.abs(y2[0] - n), Math.abs(y2[1] - n));
        } else {
            n_rel_i = Math.abs(y2[0] - n);
            if (n_rel_i > n_rel_max) {
                n_rel_i = Math.min(Math.abs(min(limit_y)) - Math.abs(n),
                                   max(limit_y) - Math.abs(n));
            }
        }
        if (m_rel_i > 0) {
            return 'outside';
        }
    }
    const cult_I = Math.sqrt((m_rel_i * m_rel_i + n_rel_i * n_rel_i) / (
        m_rel_max * m_rel_max + n_rel_max * n_rel_max));
    return round3(cult_I);
}

/**
 * CULT-I of a load point with the minimum eccentricity
 * (EN 1992-1-1 6.1 (4), decision D1).
 * The moment is modified with min_eccentricity_moments. For m = 0 both
 * signs are checked and the less favourable result governs
 * ('outside', otherwise the smaller CULT-I).
 * @param {number} m  moment of the load point
 * @param {number} n  normal force of the load point
 * @param {number} e0  minimum eccentricity [m]
 * @param {InputValues} input_values
 * @param {Values} values
 * @returns {{moments: number[], cult_I: number | 'outside'}}
 *     moments: the modified moment(s) used for the check
 */
export function cult_I_min_eccentricity(m, n, e0, input_values, values) {
    const moments = min_eccentricity_moments(m, n, e0);
    /** @type {number | 'outside'} */
    let governing = 'outside';
    for (let i = 0; i < moments.length; i++) {
        const result = cult_I(moments[i], n, input_values, values);
        if (result === 'outside') {
            return { moments: moments, cult_I: 'outside' };
        }
        if (i === 0 || (governing !== 'outside' && result < governing)) {
            governing = result;
        }
    }
    return { moments: moments, cult_I: governing };
}
