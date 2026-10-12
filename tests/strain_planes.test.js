// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram, concrete_force } from '../app/core.js';
import { en1992 } from '../app/norms/en1992.js';
import { generate_strain_planes } from '../app/strain_planes.js';
import { loadReference } from './helpers.js';

const reference = loadReference();

const EPS_C1 = en1992.eps_c1;
const EPS_CU = en1992.eps_cu;
const EPS_S_MAX = en1992.eps_s_max;

// generator with pivot point C and tension end
const FULL = { type: /** @type {'generated'} */ ('generated'),
               pivot_c: true, tension_end: true, step: 0.0003, steps_c: 10 };
// generator covering the same range as the legacy arrays
const LIKE_LEGACY = { ...FULL, pivot_c: false, tension_end: false };

const SECTIONS = [
    { name: 'default', h_: 0.35, d_1: 0.03, d_2: 0.03, f_yk: 500 },
    { name: 'shotcrete', h_: 0.30, d_1: 0.05, d_2: 0.05, f_yk: 500 },
    { name: 'd1_not_equal_d2', h_: 0.35, d_1: 0.03, d_2: 0.06, f_yk: 550 },
];

/**
 * @param {{h_: number, d_1: number, d_2: number, f_yk: number}} section
 * @returns {[number[], number[]]}
 */
function full_planes(section) {
    return generate_strain_planes({
        eps_c1: EPS_C1, eps_cu: EPS_CU, eps_s_max: EPS_S_MAX,
        eps_yd: section.f_yk / 1.15 / en1992.e_steel,
        h_: section.h_, d: section.h_ - section.d_1, d_2: section.d_2,
        pivot_c: true, tension_end: true, step: 0.0003, steps_c: 10,
    });
}

/**
 * Distance of the point (m, n) to a polyline, moments divided by
 * scale_m and normal forces by scale_n.
 * @param {number} m
 * @param {number} n
 * @param {number[]} line_m
 * @param {number[]} line_n
 * @param {number} scale_m
 * @param {number} scale_n
 * @returns {number}
 */
function distance_to_polyline(m, n, line_m, line_n, scale_m, scale_n) {
    const px = m / scale_m;
    const py = n / scale_n;
    let smallest = Infinity;
    for (let i = 0; i < line_m.length - 1; i++) {
        const ax = line_m[i] / scale_m;
        const ay = line_n[i] / scale_n;
        const bx = line_m[i + 1] / scale_m;
        const by = line_n[i + 1] / scale_n;
        const length2 = (bx - ax) ** 2 + (by - ay) ** 2;
        let t = 0;
        if (length2 > 0) {
            t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / length2;
            t = Math.max(0, Math.min(1, t));
        }
        const distance = Math.hypot(px - (ax + t * (bx - ax)),
                                    py - (ay + t * (by - ay)));
        smallest = Math.min(smallest, distance);
    }
    return smallest;
}

/**
 * Largest distance between two curves, measured in both directions.
 * @param {number[]} m1
 * @param {number[]} n1
 * @param {number[]} m2
 * @param {number[]} n2
 * @param {number} scale_m
 * @param {number} scale_n
 * @returns {number}
 */
function curve_distance(m1, n1, m2, n2, scale_m, scale_n) {
    let largest = 0;
    for (let i = 0; i < m1.length; i++) {
        largest = Math.max(largest, distance_to_polyline(
            m1[i], n1[i], m2, n2, scale_m, scale_n));
    }
    for (let i = 0; i < m2.length; i++) {
        largest = Math.max(largest, distance_to_polyline(
            m2[i], n2[i], m1, n1, scale_m, scale_n));
    }
    return largest;
}

for (const c of reference.cases) {
    if (c.error || c.result === null) {
        continue;
    }
    test(`generated planes (no pivot C, no tension end) vs legacy: ${c.name}`,
         () => {
        const norm = { ...en1992, strain_planes: LIKE_LEGACY };
        const result = int_diagram(c.params, norm);
        assert.notEqual(result, null);
        const values = /** @type {any} */ (result)[1];
        const ref = c.result.values;

        // tolerance: 0.5 % of M_Rd,max and of |N_Rd,min|
        const scale_m = Math.max(...ref['Moment Reinf']);
        const scale_n = Math.abs(Math.min(...ref['Normal Force Reinf']));
        for (const [key_m, key_n] of [['Moment', 'Normal Force'],
                                      ['Moment Reinf', 'Normal Force Reinf']]) {
            const distance = curve_distance(values[key_m], values[key_n],
                                            ref[key_m], ref[key_n],
                                            scale_m, scale_n);
            assert.ok(distance <= 0.005, `${key_m}: distance ${distance}`);
        }
    });
}

for (const section of SECTIONS) {
    test(`generated planes, pivot points A, B, C: ${section.name}`, () => {
        const [epsilon_c, epsilon_s1] = full_planes(section);
        const count = epsilon_c.length;
        const d = section.h_ - section.d_1;

        // from uniform compression -eps_c1 to uniform tension eps_s_max
        assert.deepEqual([epsilon_c[0], epsilon_s1[0]], [-EPS_C1, -EPS_C1]);
        assert.deepEqual([epsilon_c[count - 1], epsilon_s1[count - 1]],
                         [EPS_S_MAX, EPS_S_MAX]);

        const z_c = (1 - EPS_C1 / EPS_CU) * section.h_;
        let region_c = true;
        for (let i = 0; i < count; i++) {
            const y = epsilon_c[i];
            const x = epsilon_s1[i];
            // limits of the strains
            assert.ok(y >= -EPS_CU - 1e-15, `plane ${i}: eps_c = ${y}`);
            assert.ok(x <= EPS_S_MAX + 1e-15, `plane ${i}: eps_s1 = ${x}`);
            assert.ok(x >= y, `plane ${i}: top edge is the compressed edge`);
            if (region_c) {
                // region C: the strain at the pivot point C is -eps_c1
                const eps_at_c = y + (x - y) / d * z_c;
                assert.ok(Math.abs(eps_at_c + EPS_C1) < 1e-12,
                          `plane ${i}: strain at C = ${eps_at_c}`);
                // region C ends with zero strain at the bottom edge
                const eps_bottom = y + (x - y) / d * section.h_;
                if (y === -EPS_CU) {
                    assert.ok(Math.abs(eps_bottom) < 1e-12);
                    region_c = false;
                }
            } else if (x < EPS_S_MAX) {
                // region B
                assert.equal(y, -EPS_CU);
            }
        }
        assert.equal(region_c, false);
    });

    test(`generated planes contain the kink points: ${section.name}`, () => {
        const [epsilon_c, epsilon_s1] = full_planes(section);
        const d = section.h_ - section.d_1;
        const eps_yd = section.f_yk / 1.15 / en1992.e_steel;
        const epsilon_s2 = epsilon_c.map(
            (y, i) => y - (y - epsilon_s1[i]) / d * section.d_2);

        /**
         * @param {number[]} strains
         * @param {number} target
         */
        const contains = (strains, target) =>
            strains.some(eps => Math.abs(eps - target) < 1e-12);

        assert.ok(contains(epsilon_s1, 0), 'eps_s1 = 0');
        assert.ok(contains(epsilon_s1, eps_yd), 'eps_s1 = eps_yd');
        assert.ok(contains(epsilon_s2, -eps_yd), 'eps_s2 = -eps_yd');
        assert.ok(contains(epsilon_s2, 0), 'eps_s2 = 0');
        assert.ok(contains(epsilon_s2, eps_yd), 'eps_s2 = eps_yd');
    });

    test(`closed formulas vs strip integration: ${section.name}`, () => {
        // Checks concrete_force for all generated planes, including those
        // legacy/core.py never creates (around C, uniform compression,
        // tension at the top edge).
        const [epsilon_c, epsilon_s1] = full_planes(section);
        const h_ = section.h_;
        const b_ = 1.0;
        const d = h_ - section.d_1;
        const f_cd = 20;
        // 20000 strips: with 2000 the planes with a very small compression
        // zone (2 % of h, about 40 strips) miss the tolerance 1e-4 slightly
        const strips = 20000;
        const dz = h_ / strips;

        for (let i = 0; i < epsilon_c.length; i++) {
            const y = epsilon_c[i];
            const x = epsilon_s1[i];

            let f_c_strips = 0;
            let m_c_strips = 0;
            for (let k = 0; k < strips; k++) {
                const z = (k + 0.5) * dz;
                const eps = y + (x - y) * z / d;
                // stress-strain line, compression negative
                let sigma;
                if (eps >= 0) {
                    sigma = 0;
                } else if (eps <= -EPS_C1) {
                    sigma = -f_cd;
                } else {
                    const zeta = eps / -EPS_C1;
                    sigma = -f_cd * (2 * zeta - zeta * zeta);
                }
                f_c_strips += sigma * b_ * dz;
                m_c_strips += sigma * b_ * dz * z;
            }

            const [f_c, m_c] = concrete_force(y, x, d, h_, b_, f_cd, EPS_C1);
            const label = `plane ${i} (eps_c = ${y}, eps_s1 = ${x})`;
            assert.ok(Math.abs(f_c - f_c_strips) <=
                      1e-4 * Math.abs(f_c_strips) + 1e-12,
                      `${label}: f_c ${f_c} != ${f_c_strips}`);
            assert.ok(Math.abs(m_c - m_c_strips) <=
                      1e-4 * Math.abs(m_c_strips) + 1e-12,
                      `${label}: m_c ${m_c} != ${m_c_strips}`);
        }
    });

    test(`end points of the full curve: ${section.name}`, () => {
        // symmetric reinforcement, so a_s2 = a_s1 is used correctly
        const a_s = 5.24;
        const params = { h_: section.h_, d_1: section.d_1, d_2: section.d_2,
                         a_s1: a_s, a_s2: a_s, f_ck: 30, f_yk: section.f_yk };
        const norm = { ...en1992, strain_planes: FULL };
        const result = int_diagram(params, norm);
        assert.notEqual(result, null);
        const values = /** @type {any} */ (result)[1];
        const last = values['Normal Force'].length - 1;

        const f_cd = 30 / 1.5;
        const f_yd = section.f_yk / 1.15;
        const n_concrete = -f_cd * 1.0 * section.h_;

        // uniform compression -eps_c1: full concrete, steel at E * eps_c1
        const sigma_s = Math.min(en1992.e_steel * EPS_C1, f_yd);
        const tolerance = 1e-9;
        assert.ok(Math.abs(values['Normal Force'][0] - n_concrete) < tolerance);
        assert.ok(Math.abs(values['Normal Force Reinf'][0] -
                           (n_concrete - 2 * a_s * sigma_s / 10000)) < tolerance);

        // uniform tension: no concrete, both layers yield
        assert.ok(Math.abs(values['Normal Force'][last]) < tolerance);
        assert.ok(Math.abs(values['Normal Force Reinf'][last] -
                           2 * a_s * f_yd / 10000) < tolerance);
        assert.ok(Math.abs(values['Moment'][0]) < tolerance);
        assert.ok(Math.abs(values['Moment'][last]) < tolerance);
    });
}
