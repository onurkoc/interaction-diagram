// @ts-check
/*
M-N interaction diagram of a rectangular reinforced concrete section
1:1 port of legacy/core.py. The calculation is NOT corrected here,
known problems are listed in NOTES.md.
*/
import { intersection } from './intersection.js';

/**
 * @typedef {Object} InputParams
 * @property {number} [h_]  height [m]
 * @property {number} [b_]  width [m]
 * @property {number} [d_1]  axis distance of a_s1 [m]
 * @property {number} [d_2]  axis distance of a_s2 [m]
 * @property {number} [gamma_c]
 * @property {number} [gamma_s]
 * @property {number} [gamma_d]  load factor
 * @property {number} [a_s1]  reinforcement, tension side [cm2]
 * @property {number} [a_s2]  reinforcement, compression side [cm2]
 * @property {number} [f_ck]  [N/mm2]
 * @property {number} [f_yk]  [N/mm2]
 * @property {number} [alpha_cc]
 * @property {boolean} [eccentricity]
 */

/**
 * @typedef {Object} InputValues
 * @property {number} h
 * @property {number} b
 * @property {number} d_1
 * @property {number} d_2
 * @property {number} gamma_c
 * @property {number} gamma_s
 * @property {number} gamma_d
 * @property {number} a_s1
 * @property {number} a_s2
 * @property {number} f_ck
 * @property {number} f_yk
 * @property {number} alpha_cc
 * @property {boolean} eccentricity
 */

/**
 * Capacity curves, moments in MNm, normal forces in MN.
 * x1_y1 and x2_y2 exist only with eccentricity.
 * @typedef {{
 *     'Moment': number[],
 *     'Moment Neg': number[],
 *     'Normal Force': number[],
 *     'Moment Reinf': number[],
 *     'Moment Reinf Neg': number[],
 *     'Normal Force Reinf': number[],
 *     'x1_y1'?: [number[], number[]],
 *     'x2_y2'?: [number[], number[]],
 * }} Values
 */

/**
 * Like math.copysign(1, x) in Python: -1 for negative x and for -0.
 * @param {number} x
 * @returns {number}
 */
function sign(x) {
    return (x < 0 || Object.is(x, -0)) ? -1 : 1;
}

/**
 * Division that throws for a zero divisor like Python does.
 * (JavaScript would silently return Infinity.)
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function divide(a, b) {
    if (b === 0) {
        throw new RangeError('division by zero');
    }
    return a / b;
}

/**
 * @param {InputParams} [params]
 * @returns {[InputValues, Values] | null} null for invalid parameters
 */
export function int_diagram({
    h_ = 0.35,
    b_ = 1.0,
    d_1 = 0.03,
    d_2 = 0.03,
    gamma_c = 1.50,
    gamma_s = 1.15,
    gamma_d = 1.35,
    a_s1 = 5,
    a_s2 = 5,
    f_ck = 40,
    f_yk = 500,
    alpha_cc = 1.00,
    eccentricity = false,
} = {}) {

    // epsilon values of the steel and the concrete
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

    const e_steel = 200000;  // N/mm2
    let alpha;
    if (a_s2 === 0) {
        // in case a_s2 defined as zero
        alpha = 0;
    } else {
        alpha = a_s1 / a_s2;
    }
    if (alpha_cc < 0.85) {
        // alpha_cc cannot be smaller than 0.85
        alpha_cc = 0.85;
    }
    const f_cd = divide(f_ck, gamma_c) * alpha_cc;
    const f_yd = divide(f_yk, gamma_s);
    const d = h_ - d_1;
    const a_s1_ = 0;  // indicating naked concrete interaction line
    const alpha_ = 1;  // again for naked concrete interaction line

    const min_ecc = Math.min(h_ / 30, 0.02);
    // min eccentricity as defined in EN1992-1 6.1(4)
    const n_max = f_ck * b_ * d;
    const m_min = min_ecc * n_max;

    // iterating for every epsilon value pair
    /** @type {number[]} */
    const moment = [];
    /** @type {number[]} */
    const n_force = [];
    /** @type {number[]} */
    const moment_reinf = [];
    /** @type {number[]} */
    const n_force_reinf = [];
    for (let i = 0; i < epsilon_c.length; i++) {
        // calling eps_c and eps_s1 from now on as y and x
        const x = epsilon_s1[i];
        const y = epsilon_c[i];

        if (d <= 0 || a_s1 < 0 || a_s2 < 0 || b_ <= 0 || gamma_c < 0 ||
            gamma_d < 0 || gamma_s < 0 || d_1 < 0 || d_2 < 0 || alpha_cc <= 0) {
            // parameter problems returns null
            return null;
        }

        // calling for rectangular part
        let xi1;
        if ((-0.002 - y) * d / (x - y) > 0) {
            xi1 = Math.min((-0.002 - y) * d / (x - y), h_);
        } else {
            xi1 = 0;
        }

        // compression zone height
        const xi2 = Math.min((-y * d) / (x - y), h_);

        // factor (Hilfswert)
        const h_w = (y - x) / d;

        // compression force of concrete
        const f_c = f_cd * b_ *
            (-xi1 + (xi2 - xi1) * (1000 * y + 250000 * y ** 2) -
             (xi2 ** 2 - xi1 ** 2) * (500 * h_w + 250000 * h_w * y) +
             (xi2 ** 3 - xi1 ** 3) * 250000 * h_w ** 2 / 3);

        // moment concrete
        const m_c = f_cd * b_ * (-0.5 * xi1 ** 2 + 0.5 *
                                 (1000 * y + 250000 * y ** 2) *
                                 (xi2 ** 2 - xi1 ** 2) -
                                 (1000 + 500000 * y) * h_w / 3 *
                                 (xi2 ** 3 - xi1 ** 3) +
                                 62500 * h_w ** 2 *
                                 (xi2 ** 4 - xi1 ** 4));

        // eccentricity concrete (avoid division by zero)
        let e_ausm;
        if (m_c === 0 || f_c === 0) {
            e_ausm = h_ / 2;
        } else {
            e_ausm = h_ / 2 - m_c / f_c;
        }

        // steel strain on the compression side

        const eps_s2 = y - (y - x) / d * d_2;

        // compression force steel
        const f_s2 = (sign(eps_s2) * Math.min((e_steel * Math.abs(eps_s2)),
                                              f_yd) * alpha_ * a_s1_ / 1000);

        // tension force steel
        const f_s1 = sign(x) * Math.min((e_steel * Math.abs(x)),
                                        f_yd) * a_s1_ / 1000;

        // moment
        const m_r = f_s1 * (h_ / 2 - d_1) - f_s2 * (h_ / 2 - d_2) - f_c * e_ausm;

        // normal force
        const n_r = f_s2 + f_s1 + f_c;

        // m und n for pure concrete
        moment.push(m_r);
        n_force.push(n_r);

        // compression force steel (reinforcement)
        const f_s2_reinf = sign(eps_s2) *
            Math.min((e_steel * Math.abs(eps_s2)), f_yd) * alpha * a_s1 / 10000;

        // tension force steel (reinforcement)
        const f_s1_reinf = sign(x) *
            Math.min((e_steel * Math.abs(x)), f_yd) * a_s1 / 10000;

        // moment (reinforcement)
        const m_r_reinf = (f_s1_reinf * (h_ / 2 - d_1) - f_s2_reinf *
                           (h_ / 2 - d_2) - f_c * e_ausm);

        // normal force (reinforcement)
        const n_r_reinf = f_s2_reinf + f_s1_reinf + f_c;

        // m und n (reinforcement)
        moment_reinf.push(m_r_reinf);
        n_force_reinf.push(n_r_reinf);
    }

    /** @type {number[]} */
    const moment_neg = [];
    // left side of the diagram (concrete)
    for (let i = 0; i < moment.length; i++) {
        moment_neg.push(Math.abs(moment[i]) * -1);
    }

    /** @type {number[]} */
    const moment_reinf_neg = [];
    // left side of the diagram (with reinforcement)
    for (let i = 0; i < moment_reinf.length; i++) {
        moment_reinf_neg.push(Math.abs(moment_reinf[i]) * -1);
    }

    let x1, y1, x2, y2;
    if (eccentricity) {
        // if user wants to visualize the eccentricity line
        const limit_line_pos_m = [m_min, m_min];
        const limit_line_neg_m = [-m_min, -m_min];
        const limit_line_n = [0, -n_max];

        if (a_s1 === 0 && a_s2 === 0) {
            // no reinforcements
            [x1, y1] = intersection(limit_line_neg_m,
                                    limit_line_n,
                                    moment_neg,
                                    n_force);
            [x2, y2] = intersection(limit_line_pos_m,
                                    limit_line_n,
                                    moment,
                                    n_force);
        } else if (a_s1 !== 0) {
            [x1, y1] = intersection(limit_line_neg_m,
                                    limit_line_n,
                                    moment_reinf_neg,
                                    n_force_reinf);
            if (a_s2 === 0) {
                // only a_s1 defined
                [x2, y2] = intersection(limit_line_pos_m,
                                        limit_line_n,
                                        moment,
                                        n_force);
            } else {
                // both of them defined
                [x2, y2] = intersection(limit_line_pos_m,
                                        limit_line_n,
                                        moment_reinf,
                                        n_force_reinf);
            }
        } else if (a_s2 !== 0 && a_s1 === 0) {
            [x1, y1] = intersection(limit_line_pos_m,
                                    limit_line_n,
                                    moment,
                                    n_force);
            [x2, y2] = intersection(limit_line_pos_m,
                                    limit_line_n,
                                    moment_reinf,
                                    n_force_reinf);
        } else {
            throw new Error('Cannot calculate eccentricity');
        }
    }

    /** @type {InputValues} */
    const input_values = {
        'h': h_,
        'b': b_,
        'd_1': d_1,
        'd_2': d_2,
        'gamma_c': gamma_c,
        'gamma_s': gamma_s,
        'gamma_d': gamma_d,
        'a_s1': a_s1,
        'a_s2': a_s2,
        'f_ck': f_ck,
        'f_yk': f_yk,
        'alpha_cc': alpha_cc,
        'eccentricity': eccentricity,
    };
    /** @type {Values} */
    let values;
    if (eccentricity) {
        if (x1 === undefined || y1 === undefined ||
            x2 === undefined || y2 === undefined) {
            // cannot happen, only for the type check
            throw new Error('Cannot calculate eccentricity');
        }
        values = {
            'Moment': moment,
            'Moment Neg': moment_neg,
            'Normal Force': n_force,
            'Moment Reinf': moment_reinf,
            'Moment Reinf Neg': moment_reinf_neg,
            'Normal Force Reinf': n_force_reinf,
            'x1_y1': [x1, y1],
            'x2_y2': [x2, y2],
        };
    } else {
        values = {
            'Moment': moment,
            'Moment Neg': moment_neg,
            'Normal Force': n_force,
            'Moment Reinf': moment_reinf,
            'Moment Reinf Neg': moment_reinf_neg,
            'Normal Force Reinf': n_force_reinf,
        };
    }

    return [input_values, values];
}
