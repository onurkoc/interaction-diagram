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
