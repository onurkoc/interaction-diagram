// @ts-check
/*
Tests for the corrected behaviour (NOTES.md, section 5).
They check properties that follow directly from the rule, they do not
contain reference values calculated with this app.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram, min_eccentricity_moments } from '../app/core.js';
import { cult_I, cult_I_min_eccentricity } from '../app/cult_i.js';
import { en1992 } from '../app/norms/en1992.js';
import { sia262 } from '../app/norms/sia262.js';
import { assertClose } from './helpers.js';

/**
 * @param {import('../app/core.js').InputParams} params
 * @param {import('../app/core.js').Norm} [norm]
 * @returns {any} values
 */
function curves(params, norm) {
    const result = int_diagram(params, norm);
    assert.notEqual(result, null);
    return /** @type {any} */ (result)[1];
}

test('E5: alpha_cc = 0.8 is used as given, not raised to 0.85', () => {
    // the concrete curve is proportional to f_cd
    const values_10 = curves({ alpha_cc: 1.0 });
    const values_08 = curves({ alpha_cc: 0.8 });
    const expected = values_10['Normal Force'].map(
        (/** @type {number} */ n) => 0.8 * n);
    assertClose(values_08['Normal Force'], expected, 'Normal Force');
});

test('E1: minimum eccentricity is the larger of h/30 and 20 mm', () => {
    const e0 = /** @type {(h: number) => number} */ (en1992.min_eccentricity);
    // thin sections: 20 mm governs
    assert.equal(e0(0.30), 0.02);
    assert.equal(e0(0.60), 0.02);
    // h/30 governs above h = 0.60 m
    assert.equal(e0(0.90), 0.90 / 30);
});

test('E6: f_ck above 50 is rejected in both norms (D4)', () => {
    assert.notEqual(int_diagram({ f_ck: 50 }), null);
    assert.throws(() => int_diagram({ f_ck: 55 }), /f_ck/);
    assert.notEqual(int_diagram({ f_ck: 50, eta_t: 0.85 }, sia262), null);
    assert.throws(() => int_diagram({ f_ck: 55, eta_t: 0.85 }, sia262),
                  /f_ck/);
});

test('E5/E6: alpha_cc outside 0.8 to 1.0 is rejected, not corrected', () => {
    assert.throws(() => int_diagram({ alpha_cc: 0.7 }), /alpha_cc/);
    assert.throws(() => int_diagram({ alpha_cc: 1.1 }), /alpha_cc/);
});

test('E6: eta_t other than 1.0 / 0.85 / 1.2 is rejected (SIA)', () => {
    assert.throws(() => int_diagram({ f_ck: 30, eta_t: 0.9 }, sia262),
                  /eta_t/);
    assert.throws(() => int_diagram({ f_ck: 30 }, sia262), /eta_t/);
});

test('E10/D7: plain concrete section uses the reduced f_cd', () => {
    // with reinforcement: concrete curve with the normal f_cd
    const reinforced = { f_ck: 30, a_s1: 5, a_s2: 5 };
    const plain = { f_ck: 30, a_s1: 0, a_s2: 0 };

    // EN: alpha_cc_pl / alpha_cc = 0.8 / 1.0, SIA: factor 0.8
    const cases = [
        { norm: en1992, extra: { alpha_cc: 1.0, alpha_cc_pl: 0.8 } },
        { norm: sia262, extra: { eta_t: 0.85 } },
    ];
    for (const { norm, extra } of cases) {
        const normal = curves({ ...reinforced, ...extra }, norm);
        const reduced = curves({ ...plain, ...extra }, norm);
        const expected = normal['Normal Force'].map(
            (/** @type {number} */ n) => 0.8 * n);
        assertClose(reduced['Normal Force'], expected, norm.name);
        // without reinforcement both curves are the same
        assertClose(reduced['Normal Force Reinf'], reduced['Normal Force'],
                    norm.name);
    }
});

test('E10/D7: alpha_cc_pl is editable (EN)', () => {
    const plain = { f_ck: 30, a_s1: 0, a_s2: 0 };
    const values_08 = curves({ ...plain, alpha_cc_pl: 0.8 });
    const values_06 = curves({ ...plain, alpha_cc_pl: 0.6 });
    const expected = values_08['Normal Force'].map(
        (/** @type {number} */ n) => 0.6 / 0.8 * n);
    assertClose(values_06['Normal Force'], expected, 'Normal Force');
});

test('N1: the compression reinforcement is a_s2', () => {
    // First strain plane: uniform compression -eps_c1, the stress of
    // a_s2 is E_s * eps_c1 (below f_yd for B500).
    const sigma_s = Math.min(en1992.e_steel * en1992.eps_c1, 500 / 1.15);
    for (const a_s1 of [0, 5, 10]) {
        // a_s2 = 2 and not 0, so the section is never plain concrete (D7)
        const small = curves({ a_s1: a_s1, a_s2: 2 });
        const large = curves({ a_s1: a_s1, a_s2: 8 });
        const difference = large['Normal Force Reinf'][0] -
                           small['Normal Force Reinf'][0];
        // a_s in cm2, forces in MN
        assertClose(difference, -6 * sigma_s / 10000, `a_s1 = ${a_s1}`);
    }
});

test('E2/D1: minimum eccentricity is applied to the load points', () => {
    const e0 = 0.02;
    // compression (n < 0): |m| is at least e0 * |n|, the sign is kept
    assert.deepEqual(min_eccentricity_moments(0.01, -2, e0), [0.04]);
    assert.deepEqual(min_eccentricity_moments(-0.01, -2, e0), [-0.04]);
    // larger moments are not changed
    assert.deepEqual(min_eccentricity_moments(0.1, -2, e0), [0.1]);
    assert.deepEqual(min_eccentricity_moments(-0.1, -2, e0), [-0.1]);
    // m = 0: both signs
    assert.deepEqual(min_eccentricity_moments(0, -2, e0), [0.04, -0.04]);
    // tension or no normal force: not changed
    assert.deepEqual(min_eccentricity_moments(0.01, 0.5, e0), [0.01]);
    assert.deepEqual(min_eccentricity_moments(0, 0, e0), [0]);
});

test('E2/D1: the resistance curve is not capped any more', () => {
    const without = curves({ eccentricity: false });
    const with_ecc = curves({ eccentricity: true });
    assert.deepEqual(with_ecc, without);
    assert.equal('x1_y1' in with_ecc, false);
});

test('E2/D1, C1: CULT-I uses the modified load point', () => {
    const result = int_diagram({ h_: 0.30, d_1: 0.05, d_2: 0.05,
                                 a_s1: 5.24, a_s2: 5.24, f_ck: 30 });
    assert.notEqual(result, null);
    const [input_values, values] = /** @type {any} */ (result);
    const e0 = 0.02;

    // small moment: same result as CULT-I of the modified point
    const small = cult_I_min_eccentricity(0.01, -2, e0, input_values, values);
    assert.deepEqual(small.moments, [0.04]);
    assert.equal(small.cult_I, cult_I(0.04, -2, input_values, values));

    // large moment: point and result unchanged
    const large = cult_I_min_eccentricity(0.1, -2, e0, input_values, values);
    assert.deepEqual(large.moments, [0.1]);
    assert.equal(large.cult_I, cult_I(0.1, -2, input_values, values));

    // m = 0: the less favourable of both sides governs
    const zero = cult_I_min_eccentricity(0, -2, e0, input_values, values);
    assert.deepEqual(zero.moments, [0.04, -0.04]);
    const both = [cult_I(0.04, -2, input_values, values),
                  cult_I(-0.04, -2, input_values, values)];
    assert.equal(zero.cult_I, Math.min(.../** @type {number[]} */ (both)));

    // modified point outside the curve
    const outside = cult_I_min_eccentricity(0, -6.4, e0, input_values, values);
    assert.equal(outside.cult_I, 'outside');
});

test('E3: the curve starts at uniform compression -eps_c1 (pivot C)', () => {
    const params = { h_: 0.30, b_: 1.0, d_1: 0.05, d_2: 0.05,
                     a_s1: 5.24, a_s2: 5.24, f_ck: 30, f_yk: 500 };
    const f_cd = 30 / 1.5;
    const f_yd = 500 / 1.15;
    // steel stress at -eps_c1, limited by f_yd
    const sigma_s = Math.min(en1992.e_steel * en1992.eps_c1, f_yd);
    const n_concrete = -f_cd * 1.0 * 0.30;

    const values = curves(params);
    assertClose(values['Normal Force'][0], n_concrete, 'concrete');
    assertClose(values['Normal Force Reinf'][0],
                n_concrete - 2 * 5.24 * sigma_s / 10000, 'reinforced');
    assert.ok(Math.abs(values['Moment Reinf'][0]) < 1e-12);

    // and ends at uniform tension, both layers yield
    const last = values['Normal Force Reinf'].length - 1;
    assertClose(values['Normal Force Reinf'][last],
                2 * 5.24 * f_yd / 10000, 'tension');
    assert.ok(Math.abs(values['Normal Force'][last]) < 1e-12);
    assert.ok(Math.abs(values['Moment Reinf'][last]) < 1e-12);
});

test('N2: symmetric section, the left side mirrors the right side', () => {
    const values = curves({ a_s1: 5, a_s2: 5, d_1: 0.04, d_2: 0.04 });
    for (const reinf of ['', ' Reinf']) {
        const mirrored = values['Moment' + reinf].map(
            (/** @type {number} */ m) => -m);
        assertClose(values['Moment' + reinf + ' Neg'], mirrored, 'Moment');
        assertClose(values['Normal Force' + reinf + ' Neg'],
                    values['Normal Force' + reinf], 'Normal Force');
    }
});

test('N2: swapping the two layers swaps the sides of the diagram', () => {
    const values = curves({ a_s1: 3, a_s2: 9, d_1: 0.03, d_2: 0.06 });
    const swapped = curves({ a_s1: 9, a_s2: 3, d_1: 0.06, d_2: 0.03 });
    for (const reinf of ['', ' Reinf']) {
        const mirrored = swapped['Moment' + reinf].map(
            (/** @type {number} */ m) => -m);
        assertClose(values['Moment' + reinf + ' Neg'], mirrored, 'Moment');
        assertClose(values['Normal Force' + reinf + ' Neg'],
                    swapped['Normal Force' + reinf], 'Normal Force');
    }
});

test('N2: unsymmetric section, both sides meet at the end points', () => {
    // Uniform compression and uniform tension are the same state for
    // both sides, so the curve is closed there.
    const values = curves({ a_s1: 3, a_s2: 9, d_1: 0.03, d_2: 0.06 });
    const last = values['Moment Reinf'].length - 1;
    const last_neg = values['Moment Reinf Neg'].length - 1;
    assertClose(values['Moment Reinf Neg'][0], values['Moment Reinf'][0],
                'M compression');
    assertClose(values['Normal Force Reinf Neg'][0],
                values['Normal Force Reinf'][0], 'N compression');
    assertClose(values['Moment Reinf Neg'][last_neg],
                values['Moment Reinf'][last], 'M tension');
    assertClose(values['Normal Force Reinf Neg'][last_neg],
                values['Normal Force Reinf'][last], 'N tension');
    // more reinforcement on the a_s2 side: the end points are not at M = 0
    assert.ok(Math.abs(values['Moment Reinf'][last]) > 1e-3);
});

test('C3: a point with m = 0 beyond the curve is outside', () => {
    const result = int_diagram({});
    assert.notEqual(result, null);
    const [input_values, values] = /** @type {any} */ (result);
    const n_compression = Math.min(...values['Normal Force Reinf']);
    const n_tension = Math.max(...values['Normal Force Reinf']);

    assert.equal(cult_I(0, n_compression - 0.1, input_values, values),
                 'outside');
    assert.equal(cult_I(0, n_tension + 0.1, input_values, values),
                 'outside');
    assert.equal(cult_I(0, -20, input_values, values), 'outside');
    // inside: a number
    assert.equal(typeof cult_I(0, n_compression / 2, input_values, values),
                 'number');
});

test('N3: CULT-I uses the curves with reinforcement on both sides', () => {
    // One layer only: the old code took the concrete curve for one
    // side and paired it with the normal forces of the other curve.
    for (const params of [{ a_s1: 5, a_s2: 0 }, { a_s1: 0, a_s2: 5 }]) {
        const result = int_diagram(params);
        assert.notEqual(result, null);
        const [input_values, values] = /** @type {any} */ (result);
        // the result must not depend on the plain concrete curves
        const without_concrete = { ...values, 'Moment': [], 'Moment Neg': [],
                                   'Normal Force': [], 'Normal Force Neg': [] };
        for (const [m, n] of [[0.05, -1], [-0.05, -1], [0.1, -3], [-0.1, -3]]) {
            assert.equal(cult_I(m, n, input_values, without_concrete),
                         cult_I(m, n, input_values, values),
                         `m = ${m}, n = ${n}`);
        }
    }
});

test('N4: several intersection points do not raise an error', () => {
    // Simple curve (rhombus) with corners at N = -1. A cut at n = -1
    // goes exactly through a corner and hits two segments.
    const values = {
        'Moment': [], 'Moment Neg': [],
        'Normal Force': [], 'Normal Force Neg': [],
        'Moment Reinf': [0, 1, 0],
        'Normal Force Reinf': [-2, -1, 0],
        'Moment Reinf Neg': [0, -1, 0],
        'Normal Force Reinf Neg': [-2, -1, 0],
    };
    const input_values = /** @type {any} */ ({ a_s1: 5, a_s2: 5 });

    // M_rel,max = 1, N_rel,max = 2 / 2 = 1
    // point (0.5, -1): M_rel,i = 1 - 0.5, N_rel,i = 0.5 (curve at m = 0.5
    // is at N = -1.5 and N = -0.5)
    const expected = Math.sqrt((0.5 ** 2 + 0.5 ** 2) / (1 ** 2 + 1 ** 2));
    assert.equal(cult_I(0.5, -1, input_values, values), expected);
    assert.equal(cult_I(-0.5, -1, input_values, values), expected);
    // the corner itself is on the curve: M_rel,i = 0, N_rel,i = 0
    assert.equal(cult_I(1, -1, input_values, values), 0);
});
