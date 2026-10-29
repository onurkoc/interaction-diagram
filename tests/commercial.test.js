// @ts-check
/*
Fixed reference: comparison with a commercial program, done by Onur Koc.

Section: h = 0.30 m, b = 1.0 m, C30/37, B500, a_s1 = a_s2 = 5.24 cm2,
d_1 = d_2 = 0.05 m, SIA 262 with eta_t = 1.0, gamma_c = 1.5,
gamma_s = 1.15.

The four points below were calculated with this app and checked in
the commercial program: the utilization of each point is 1.00, so they
lie on its resistance curve. It prints two decimals, therefore the
tolerance is 1 %. Its settings are listed in NOTES.md.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
import { intersection } from '../app/intersection.js';
import { sia262 } from '../app/norms/sia262.js';

const SECTION = { h_: 0.30, b_: 1.0, d_1: 0.05, d_2: 0.05,
                  a_s1: 5.24, a_s2: 5.24, f_ck: 30, f_yk: 500, eta_t: 1.0 };

// points on the resistance curve of the commercial program, N [kN], M [kNm]
const N_COMPRESSION = -6419.2;   // centric compression, M = 0
const N_TENSION = 455.7;         // pure tension, M = 0
const N_AT_M_MAX = -2496.8;
const M_MAX = 259.9;
const M_AT_N_ZERO = 59.1;

const TOLERANCE = 0.01;

/**
 * @param {number} actual
 * @param {number} expected
 * @param {string} label
 */
function assertWithin1Percent(actual, expected, label) {
    assert.ok(Math.abs(actual - expected) <= TOLERANCE * Math.abs(expected),
              `${label}: ${actual} != ${expected} (commercial program)`);
}

/**
 * Moment of the curve at the normal force n [kNm], n in kN.
 * @param {number} n
 * @param {number[]} curve_m  [MNm]
 * @param {number[]} curve_n  [MN]
 * @returns {number}
 */
function moment_at(n, curve_m, curve_n) {
    const [x] = intersection([-10, 10], [n / 1000, n / 1000],
                             curve_m, curve_n);
    assert.ok(x.length >= 1, `no point of the curve at N = ${n}`);
    return x[0] * 1000;
}

const result = int_diagram(SECTION, sia262);
assert.notEqual(result, null);
const values = /** @type {any} */ (result)[1];

test('Commercial program: centric compression and pure tension', () => {
    for (const side of ['', ' Neg']) {
        const n = values['Normal Force Reinf' + side];
        const m = values['Moment Reinf' + side];
        const last = n.length - 1;
        assertWithin1Percent(n[0] * 1000, N_COMPRESSION, 'N compression');
        assertWithin1Percent(n[last] * 1000, N_TENSION, 'N tension');
        // M = 0 at both end points (1 % of M_max)
        assert.ok(Math.abs(m[0] * 1000) <= TOLERANCE * M_MAX);
        assert.ok(Math.abs(m[last] * 1000) <= TOLERANCE * M_MAX);
    }
});

test('Commercial program: largest moment with its normal force', () => {
    const m_right = values['Moment Reinf'];
    const m_left = values['Moment Reinf Neg'];
    assertWithin1Percent(Math.max(...m_right) * 1000, M_MAX, 'M_max');
    assertWithin1Percent(Math.min(...m_left) * 1000, -M_MAX, '-M_max');
    assertWithin1Percent(
        moment_at(N_AT_M_MAX, m_right, values['Normal Force Reinf']),
        M_MAX, 'M at N of M_max');
    assertWithin1Percent(
        moment_at(N_AT_M_MAX, m_left, values['Normal Force Reinf Neg']),
        -M_MAX, '-M at N of M_max');
});

test('Commercial program: moment at N = 0', () => {
    assertWithin1Percent(
        moment_at(0, values['Moment Reinf'], values['Normal Force Reinf']),
        M_AT_N_ZERO, 'M at N = 0');
    assertWithin1Percent(
        moment_at(0, values['Moment Reinf Neg'],
                  values['Normal Force Reinf Neg']),
        -M_AT_N_ZERO, '-M at N = 0');
});
