// @ts-check
/*
CULT-I, capacity utilization of linings in tunnels
1:1 port of legacy/cult_i.py. The calculation is NOT corrected here,
known problems are listed in NOTES.md.
*/
import { intersection } from './intersection.js';

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
    let limit_x_pos, limit_y, n_rel_max, m_rel_max;
    if (input_values['a_s1'] === 0) {
        limit_x_pos = values['Moment'];
        limit_y = values['Normal Force'];
        n_rel_max = Math.abs(min(limit_y) - max(limit_y));
        m_rel_max = Math.abs(max(limit_x_pos));
    } else {
        limit_x_pos = values['Moment Reinf'];
        limit_y = values['Normal Force Reinf'];
        n_rel_max = Math.abs(min(limit_y) - max(limit_y)) / 2;  // take the half
        m_rel_max = Math.abs(max(limit_x_pos));
    }
    let limit_x_neg;
    if (input_values['a_s2'] === 0) {
        limit_x_neg = values['Moment Neg'];
    } else {
        limit_x_neg = values['Moment Reinf Neg'];
    }

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
        if (max(limit_y) < n && n < min(limit_y)) {
            return 'outside';
        }
    } else {
        const [x1] = intersection(horizontal_cut_x,
                                  horizontal_cut_y,
                                  limit_x_neg,
                                  limit_y);
        const [, y2] = intersection(vertical_cut_x,
                                    vertical_cut_y,
                                    limit_x_neg,
                                    limit_y);
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
