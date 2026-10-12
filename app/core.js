// @ts-check
/*
M-N interaction diagram of a rectangular reinforced concrete section
Port of legacy/core.py, parametrized with a norm configuration (norms/).
With the default norm (EN 1992-1-1, legacy strain planes) the results
are the same as in Python. The calculation is NOT corrected here,
known problems are listed in NOTES.md.
*/
import { intersection } from './intersection.js';
import { en1992 } from './norms/en1992.js';
import { strain_planes } from './strain_planes.js';

/** @typedef {import('./norms/en1992.js').Norm} Norm */

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
 * @property {number} [alpha_cc]  EN only
 * @property {number} [alpha_cc_pl]  EN only, plain concrete
 * @property {number} [eta_t]  SIA only, no preset
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
 * Concrete force and its moment about the compressed edge for one
 * strain plane (closed formulas of legacy/core.py).
 * Stress-strain line: parabola up to -eps_c1, constant beyond,
 * no tensile strength.
 * @param {number} y  eps_c, strain at the compressed edge
 * @param {number} x  eps_s1, strain at the depth d
 * @param {number} d  depth of a_s1 [m]
 * @param {number} h_  height [m]
 * @param {number} b_  width [m]
 * @param {number} f_cd  [N/mm2]
 * @param {number} eps_c1  strain at the end of the parabola (positive)
 * @returns {[number, number]} f_c [MN], m_c [MNm]
 */
export function concrete_force(y, x, d, h_, b_, f_cd, eps_c1) {
    // parabola: sigma / f_cd = k1 * eps + k2 * eps ** 2
    const k1 = 2 / eps_c1;         // 1000 for eps_c1 = 0.002
    const k2 = 1 / eps_c1 ** 2;    // 250000 for eps_c1 = 0.002

    // xi1: depth of the rectangular part
    // xi2: compression zone height
    let xi1, xi2;
    if (x === y) {
        // uniform strain over the height (not in legacy/core.py,
        // the formulas below would divide by zero)
        xi1 = (y <= -eps_c1) ? h_ : 0;
        xi2 = (y < 0) ? h_ : 0;
    } else if (y > 0) {
        // tension at the top edge, no compression zone
        // (not in legacy/core.py)
        xi1 = 0;
        xi2 = 0;
    } else {
        // calling for rectangular part
        if ((-eps_c1 - y) * d / (x - y) > 0) {
            xi1 = Math.min((-eps_c1 - y) * d / (x - y), h_);
        } else {
            xi1 = 0;
        }

        // compression zone height
        xi2 = Math.min((-y * d) / (x - y), h_);
    }

    // factor (Hilfswert)
    const h_w = (y - x) / d;

    // compression force of concrete
    const f_c = f_cd * b_ *
        (-xi1 + (xi2 - xi1) * (k1 * y + k2 * y ** 2) -
         (xi2 ** 2 - xi1 ** 2) * (k1 / 2 * h_w + k2 * h_w * y) +
         (xi2 ** 3 - xi1 ** 3) * k2 * h_w ** 2 / 3);

    // moment concrete
    const m_c = f_cd * b_ * (-0.5 * xi1 ** 2 + 0.5 *
                             (k1 * y + k2 * y ** 2) *
                             (xi2 ** 2 - xi1 ** 2) -
                             (k1 + 2 * k2 * y) * h_w / 3 *
                             (xi2 ** 3 - xi1 ** 3) +
                             k2 / 4 * h_w ** 2 *
                             (xi2 ** 4 - xi1 ** 4));

    return [f_c, m_c];
}

/**
 * Capacity curve for one side of the diagram (a_s1 in tension).
 * Returns the curve of the plain concrete and the curve with
 * reinforcement.
 * @param {number[]} epsilon_c  strains at the compressed edge
 * @param {number[]} epsilon_s1  strains of a_s1
 * @param {Object} s  section
 * @param {number} s.h_
 * @param {number} s.b_
 * @param {number} s.d_1
 * @param {number} s.d_2
 * @param {number} s.a_s1
 * @param {number} s.alpha  a_s1 / a_s2 as in legacy/core.py
 * @param {number} s.f_cd
 * @param {number} s.f_yd
 * @param {number} s.e_steel
 * @param {number} s.eps_c1
 * @returns {{moment: number[], n_force: number[],
 *            moment_reinf: number[], n_force_reinf: number[]}}
 */
function one_side(epsilon_c, epsilon_s1,
                  { h_, b_, d_1, d_2, a_s1, alpha, f_cd, f_yd, e_steel, eps_c1 }) {
    const d = h_ - d_1;
    const a_s1_ = 0;  // indicating naked concrete interaction line
    const alpha_ = 1;  // again for naked concrete interaction line

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

        const [f_c, m_c] = concrete_force(y, x, d, h_, b_, f_cd, eps_c1);

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
    return { moment, n_force, moment_reinf, n_force_reinf };
}

/**
 * @param {InputParams} [params]
 * @param {Norm} [norm]  norm configuration, default: EN 1992-1-1
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
    alpha_cc_pl = 0.8,
    eta_t = undefined,
    eccentricity = false,
} = {}, norm = en1992) {

    let alpha;
    if (a_s2 === 0) {
        // in case a_s2 defined as zero
        alpha = 0;
    } else {
        alpha = a_s1 / a_s2;
    }
    if (gamma_c === 0 || gamma_s === 0) {
        // Python raises a ZeroDivisionError here,
        // JavaScript would silently continue with Infinity
        throw new RangeError('division by zero');
    }
    const norm_params = { f_ck, f_yk, gamma_c, gamma_s,
                          alpha_cc, alpha_cc_pl, eta_t };
    // input outside the limits of the norm is rejected, not corrected
    const messages = norm.check(norm_params);
    if (messages.length > 0) {
        throw new Error(`${norm.name}: ${messages.join(' ')}`);
    }
    const f_cd = norm.f_cd(norm_params);
    const f_yd = norm.f_yd(norm_params);
    const d = h_ - d_1;

    let n_max = 0;
    let m_min = 0;
    if (norm.min_eccentricity === null) {
        if (eccentricity) {
            // no silent correction of the input
            throw new Error(`${norm.name}: keine Mindestausmitte, ` +
                            'die Option ist in diesem Modus nicht zulässig.');
        }
    } else {
        const min_ecc = norm.min_eccentricity(h_);
        // min eccentricity as defined in EN1992-1 6.1(4)
        n_max = f_ck * b_ * d;
        m_min = min_ecc * n_max;
    }

    if (d <= 0 || a_s1 < 0 || a_s2 < 0 || b_ <= 0 || gamma_c < 0 ||
        gamma_d < 0 || gamma_s < 0 || d_1 < 0 || d_2 < 0 || alpha_cc <= 0) {
        // parameter problems returns null
        return null;
    }

    // epsilon values of the steel and the concrete
    const [epsilon_c, epsilon_s1] = strain_planes(norm, { h_, d, d_2, f_yd });

    const { moment, n_force, moment_reinf, n_force_reinf } = one_side(
        epsilon_c, epsilon_s1,
        { h_, b_, d_1, d_2, a_s1, alpha, f_cd, f_yd,
          e_steel: norm.e_steel, eps_c1: norm.eps_c1 });

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
