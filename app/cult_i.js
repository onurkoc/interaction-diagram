// @ts-check
/*
CULT-I, capacity utilization of linings in tunnels
Port of legacy/cult_i.py. The problems found in cult_i.py are
corrected step by step, see NOTES.md (sections 4 and 5).
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
 * Distance of the normal force n to the nearer end of the curve:
 * to centric compression (smallest N) or to pure tension (largest N).
 * @param {number} n
 * @param {number[]} limit_y  normal forces of the curve
 * @returns {number}
 */
function distance_to_ends(n, limit_y) {
    return Math.min(n - min(limit_y), max(limit_y) - n);
}

/**
 * M_rel,max and N_rel,max of one side of the curve: the largest moment
 * of the side and the distance from its normal force to the end of the
 * curve on the compression side.
 * @param {number[]} limit_x  moments of the side
 * @param {number[]} limit_y  normal forces of the side
 * @param {number} m_extreme  largest moment of the side: the maximum on
 *     the positive side, the minimum on the negative side
 * @returns {[number, number]} M_rel,max, N_rel,max
 */
function rel_max(limit_x, limit_y, m_extreme) {
    // normal force of the largest moment (first point, if there are several)
    const n_at_m_extreme = limit_y[limit_x.indexOf(m_extreme)];
    // compression is negative: the end on the compression side is the minimum
    return [Math.abs(m_extreme), n_at_m_extreme - min(limit_y)];
}

/**
 * The index from the four distances, in the normalised form (N13 in
 * NOTES.md, decision of Onur Koc):
 *     sqrt( (N_rel,i / N_rel,max)^2 + (M_rel,i / M_rel,max)^2 ) / sqrt(2)
 * This deviates from equation (4) of the paper,
 *     sqrt( (N_rel,i^2 + M_rel,i^2) / (N_rel,max^2 + M_rel,max^2) ),
 * which adds forces and moments (e.g. kN^2 and kNm^2) and so depends on
 * the units. Each distance is divided by its own reference value first;
 * the centre of the curve still gives 1, a point on the curve 0.
 * @param {number} m_rel_i
 * @param {number} n_rel_i
 * @param {number} m_rel_max
 * @param {number} n_rel_max
 * @returns {number}
 */
function index(m_rel_i, n_rel_i, m_rel_max, n_rel_max) {
    const m_ratio = m_rel_i / m_rel_max;
    const n_ratio = n_rel_i / n_rel_max;
    return Math.sqrt(n_ratio * n_ratio + m_ratio * m_ratio) / Math.SQRT2;
}

/**
 * capacity utilization of linings in tunnels (CULT-I)
 * according to the paper:
 * Performance indicator of tunnel linings under geotechnical uncertainty;
 * Spyridis, Panagiotis; Konstantis, Spyridon; Gakis, Angelos;
 * Geomechanics and Tunnelling 9 (2016), No. 2, section 4, Fig. 2, eq. (4)
 * The four distances are those of the paper; the index is calculated in
 * the normalised form, see index() above:
 * cult_I = sqrt( (N_rel,i/N_rel,max)^2 + (M_rel,i/M_rel,max)^2 ) / sqrt(2)
 * M_rel,i, N_rel,i: distances of the point to the curve in the direction
 * of M and of N. M_rel,max, N_rel,max: the same distances of the point
 * in the 'centre' of the curve (M = 0, normal force of the largest
 * moment): M_rel,max is the largest moment, N_rel,max the distance from
 * its normal force to the end of the curve on the compression side.
 * Both are taken from the side of the curve with the sign of m.
 * For m = 0 both sides are checked, the smaller result governs.
 * @param {number} m  x coordinate of a point, moment
 * @param {number} n  y coordinate of a point, normal force
 * @param {InputValues} input_values  input values from int_diagram
 *     (not used any more, kept for the callers)
 * @param {Values} values  resulting values from int_diagram
 * @returns {number | 'outside'}
 */
export function cult_I(m, n, input_values, values) {
    const details = cult_I_details(m, n, values);
    if (details === 'outside') {
        return 'outside';
    }
    return details.cult_I;
}

/**
 * CULT-I with the values it is calculated from, so that the result can
 * be checked by hand.
 * @typedef {Object} CultIDetails
 * @property {number} cult_I  rounded to three decimals
 * @property {number} m_rel_i
 * @property {number} n_rel_i
 * @property {number} m_rel_max  of the governing side
 * @property {number} n_rel_max  of the governing side
 */

/**
 * @param {number} m_rel_i
 * @param {number} n_rel_i
 * @param {number} m_rel_max
 * @param {number} n_rel_max
 * @returns {CultIDetails}
 */
function details_of(m_rel_i, n_rel_i, m_rel_max, n_rel_max) {
    return {
        cult_I: round3(index(m_rel_i, n_rel_i, m_rel_max, n_rel_max)),
        m_rel_i: m_rel_i,
        n_rel_i: n_rel_i,
        m_rel_max: m_rel_max,
        n_rel_max: n_rel_max,
    };
}

/**
 * CULT-I of a point, see cult_I.
 * @param {number} m  x coordinate of a point, moment
 * @param {number} n  y coordinate of a point, normal force
 * @param {Values} values  resulting values from int_diagram
 * @returns {CultIDetails | 'outside'}
 */
export function cult_I_details(m, n, values) {
    // The curves with reinforcement are the resistance on both sides.
    // Without reinforcement they are the same as the concrete curves.
    const limit_x_pos = values['Moment Reinf'];
    const limit_y = values['Normal Force Reinf'];
    const limit_x_neg = values['Moment Reinf Neg'];
    const limit_y_neg = values['Normal Force Reinf Neg'];

    // Reference values of the side of the point. The paper shows a
    // symmetric curve; a side of its own for each sign of the moment is
    // an extension for unsymmetric reinforcement (see NOTES.md).
    const [m_rel_max_pos, n_rel_max_pos] = rel_max(limit_x_pos, limit_y,
                                                   max(limit_x_pos));
    const [m_rel_max_neg, n_rel_max_neg] = rel_max(limit_x_neg, limit_y_neg,
                                                   min(limit_x_neg));

    const horizontal_cut_x = [min(limit_x_neg),
                              max(limit_x_pos)];
    const horizontal_cut_y = [n, n];

    const vertical_cut_x = [m, m];
    const vertical_cut_y = [max(limit_y),
                            min(limit_y)];
    // Normal forces of the curve for the moment m. The two sides together
    // are the closed curve. With unsymmetric reinforcement its ends are not
    // at M = 0, so the vertical cut can hit the curve of the other side.
    const [, y2_pos] = intersection(vertical_cut_x,
                                    vertical_cut_y,
                                    limit_x_pos,
                                    limit_y);
    const [, y2_neg] = intersection(vertical_cut_x,
                                    vertical_cut_y,
                                    limit_x_neg,
                                    limit_y_neg);
    const y2 = y2_pos.concat(y2_neg);

    // moments of the curve for the normal force n, for each side
    const [x1_pos] = intersection(horizontal_cut_x,
                                  horizontal_cut_y,
                                  limit_x_pos,
                                  limit_y);
    const [x1_neg] = intersection(horizontal_cut_x,
                                  horizontal_cut_y,
                                  limit_x_neg,
                                  limit_y_neg);

    // Inside: for the normal force n the moment is between the moments of
    // the two sides. Several intersection points (e.g. the cut goes through
    // a point of the curve): the outermost one is the limit.
    // With unsymmetric reinforcement the ends of the curve are not at
    // M = 0, so near the ends a small moment can be outside of the other
    // side (N12 in NOTES.md).
    if (n > max(limit_y) || n < min(limit_y)) {
        // beyond pure tension or beyond centric compression
        return 'outside';
    }
    if (x1_pos.length === 0 || x1_neg.length === 0) {
        return 'outside';
    }
    if (m < min(x1_neg) || m > max(x1_pos)) {
        return 'outside';
    }

    if (m > 0) {
        if (y2.length === 0) {
            return 'outside';
        }
        const m_rel_i = max(x1_pos) - m;
        // The nearest of all intersection points. The paper shows N_rel,i
        // only for a point on the compression side of the centre, towards
        // the compression end (assumption, see NOTES.md).
        const n_rel_i = min(y2.map(y => Math.abs(y - n)));
        return details_of(m_rel_i, n_rel_i, m_rel_max_pos, n_rel_max_pos);
    } else if (m === 0) {
        // M_rel,i is the moment of the curve for the normal force n,
        // towards each side
        const m_rel_i_pos = max(x1_pos);
        const m_rel_i_neg = -min(x1_neg);
        // The nearest point of the curve in the direction of N. For a
        // symmetric section these are the ends of the curve; there the cut
        // only touches the curve, so the ends are added.
        const n_rel_i = min(y2.map(y => Math.abs(y - n)).concat(
            [distance_to_ends(n, limit_y)]));
        // both sides, the smaller result governs
        const pos = details_of(m_rel_i_pos, n_rel_i,
                               m_rel_max_pos, n_rel_max_pos);
        const neg = details_of(m_rel_i_neg, n_rel_i,
                               m_rel_max_neg, n_rel_max_neg);
        return (neg.cult_I < pos.cult_I) ? neg : pos;
    } else {
        if (y2.length === 0) {
            return 'outside';
        }
        // distance as a positive number
        const m_rel_i = m - min(x1_neg);
        // the nearest of all intersection points, as on the positive side
        const n_rel_i = min(y2.map(y => Math.abs(y - n)));
        return details_of(m_rel_i, n_rel_i, m_rel_max_neg, n_rel_max_neg);
    }
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
 * @returns {{moments: number[], cult_I: number | 'outside',
 *            m_governing: number, details: CultIDetails | 'outside'}}
 *     moments: the modified moment(s) used for the check;
 *     m_governing: the one of them that governs, with its details
 */
export function cult_I_min_eccentricity(m, n, e0, input_values, values) {
    const moments = min_eccentricity_moments(m, n, e0);
    /** @type {CultIDetails | 'outside'} */
    let governing = 'outside';
    let m_governing = moments[0];
    for (let i = 0; i < moments.length; i++) {
        const result = cult_I_details(moments[i], n, values);
        if (result === 'outside') {
            return { moments: moments, cult_I: 'outside',
                     m_governing: moments[i], details: 'outside' };
        }
        if (i === 0 || (governing !== 'outside' &&
                        result.cult_I < governing.cult_I)) {
            governing = result;
            m_governing = moments[i];
        }
    }
    return { moments: moments,
             cult_I: (governing === 'outside') ? 'outside' : governing.cult_I,
             m_governing: m_governing, details: governing };
}
