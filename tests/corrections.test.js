// @ts-check
/*
Tests for the corrected behaviour (NOTES.md, section 5).
They check properties that follow directly from the rule, they do not
contain reference values calculated with this app.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
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
    // First strain plane of the legacy arrays: almost uniform -3.5 per
    // mille, a_s2 yields in compression. Its force is a_s2 * f_yd.
    const f_yd = 500 / 1.15;
    for (const a_s1 of [0, 5, 10]) {
        // a_s2 = 2 and not 0, so the section is never plain concrete (D7)
        const small = curves({ a_s1: a_s1, a_s2: 2 });
        const large = curves({ a_s1: a_s1, a_s2: 8 });
        const difference = large['Normal Force Reinf'][0] -
                           small['Normal Force Reinf'][0];
        // a_s in cm2, forces in MN
        assertClose(difference, -6 * f_yd / 10000, `a_s1 = ${a_s1}`);
    }
});
