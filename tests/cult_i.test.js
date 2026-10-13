// @ts-check
/*
CULT-I with its intermediate values (cult_I_details).
The rules of CULT-I itself are tested in corrections.test.js.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
import { cult_I, cult_I_details, cult_I_min_eccentricity } from '../app/cult_i.js';

// simple curve (rhombus): M_max = 1 at N = -1, ends at N = -2 and N = 0
const RHOMBUS = /** @type {any} */ ({
    'Moment': [], 'Moment Neg': [],
    'Normal Force': [], 'Normal Force Neg': [],
    'Moment Reinf': [0, 1, 0],
    'Normal Force Reinf': [-2, -1, 0],
    'Moment Reinf Neg': [0, -1, 0],
    'Normal Force Reinf Neg': [-2, -1, 0],
});
const INPUT_VALUES = /** @type {any} */ ({ a_s1: 5, a_s2: 5 });

test('cult_I_details: intermediate values of a point', () => {
    // point (0.5, -1): the curve is at M = 1 for this N; for M = 0.5 it
    // is at N = -1.5 and N = -0.5
    assert.deepEqual(cult_I_details(0.5, -1, RHOMBUS), {
        cult_I: 0.5,
        m_rel_i: 0.5,
        n_rel_i: 0.5,
        m_rel_max: 1,
        n_rel_max: 1,
    });
    // the distances are positive on the negative side, too
    assert.deepEqual(cult_I_details(-0.5, -1, RHOMBUS),
                     cult_I_details(0.5, -1, RHOMBUS));
    assert.equal(cult_I_details(2, -1, RHOMBUS), 'outside');
});

test('cult_I_details: CULT-I follows from the intermediate values', () => {
    const result = int_diagram({ a_s1: 3, a_s2: 9, d_1: 0.03, d_2: 0.06 });
    assert.notEqual(result, null);
    const [input_values, values] = /** @type {any} */ (result);
    for (const [m, n] of [[0.1, -2], [-0.1, -2], [0, -4], [0.3, -4],
                          [-0.3, -5], [0.05, -8]]) {
        const d = cult_I_details(m, n, values);
        assert.notEqual(d, 'outside', `m = ${m}, n = ${n}`);
        if (d === 'outside') {
            continue;
        }
        // equation (4) of the paper, rounded to three decimals
        const index = Math.sqrt((d.m_rel_i ** 2 + d.n_rel_i ** 2) /
                                (d.m_rel_max ** 2 + d.n_rel_max ** 2));
        assert.ok(Math.abs(d.cult_I - index) <= 0.0005);
        assert.ok(d.m_rel_i >= 0 && d.n_rel_i >= 0);
        // the same number as cult_I
        assert.equal(cult_I(m, n, input_values, values), d.cult_I);
    }
});

test('cult_I_min_eccentricity: the governing moment and its details', () => {
    const e0 = 0.25;
    // m = 0, n = -1: both signs, m = +0.25 and m = -0.25; the curve is
    // symmetric, the first one governs
    const zero = cult_I_min_eccentricity(0, -1, e0, INPUT_VALUES, RHOMBUS);
    assert.deepEqual(zero.moments, [0.25, -0.25]);
    assert.equal(zero.m_governing, 0.25);
    assert.deepEqual(zero.details, cult_I_details(0.25, -1, RHOMBUS));
    assert.equal(zero.cult_I, cult_I(0.25, -1, INPUT_VALUES, RHOMBUS));

    // modified point outside of the curve
    const outside = cult_I_min_eccentricity(0.1, -1.9, e0, INPUT_VALUES, RHOMBUS);
    assert.equal(outside.cult_I, 'outside');
    assert.equal(outside.details, 'outside');
    assert.equal(outside.m_governing, 0.25 * 1.9);
});

test('int_diagram: input_values name what was really used', () => {
    const reinforced = int_diagram({ f_ck: 30, alpha_cc: 0.9 });
    const plain = int_diagram({ f_ck: 30, alpha_cc: 0.9, a_s1: 0, a_s2: 0 });
    assert.notEqual(reinforced, null);
    assert.notEqual(plain, null);
    const [i_reinforced] = /** @type {any} */ (reinforced);
    const [i_plain] = /** @type {any} */ (plain);
    assert.equal(i_reinforced.norm, 'EN 1992-1-1');
    assert.equal(i_reinforced.plain, false);
    assert.equal(i_reinforced.f_cd, 30 / 1.5 * 0.9);
    assert.equal(i_reinforced.f_yd, 500 / 1.15);
    // plain concrete: alpha_cc,pl (0.8) instead of alpha_cc (D7)
    assert.equal(i_plain.plain, true);
    assert.equal(i_plain.f_cd, 30 / 1.5 * 0.8);
});
