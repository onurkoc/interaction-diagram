// @ts-check
/*
Radial utilization |S_d| / |R_d| on the ray from the origin through the
load point. The tests check what follows from the definition.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
import { cult_I_details } from '../app/cult_i.js';
import { radial_utilization, origin_inside } from '../app/utilization.js';

/**
 * Simple curve (rhombus): largest moment m_max at the normal force
 * n_at_m_max, ends at n_compression and n_tension. Both sides the same.
 * @param {number} n_compression
 * @param {number} n_at_m_max
 * @param {number} n_tension
 * @param {number} [m_max]
 * @returns {any} values
 */
function rhombus(n_compression, n_at_m_max, n_tension, m_max = 1) {
    const n = [n_compression, n_at_m_max, n_tension];
    return {
        'Moment': [], 'Moment Neg': [],
        'Normal Force': [], 'Normal Force Neg': [],
        'Moment Reinf': [0, m_max, 0],
        'Normal Force Reinf': n,
        'Moment Reinf Neg': [0, -m_max, 0],
        'Normal Force Reinf Neg': n,
    };
}

/**
 * @param {number | null} actual
 * @param {number} expected
 * @param {string} [label]
 */
function close(actual, expected, label) {
    assert.notEqual(actual, null, label);
    assert.ok(Math.abs(/** @type {number} */ (actual) - expected) <= 1e-9,
              `${label || ''}: ${actual} != ${expected}`);
}

test('radial utilization: on the curve 1, at the origin 0, half way 0.5', () => {
    // corners at (0, -2), (1, -1), (0, 1), (-1, -1): the origin is inside
    const values = rhombus(-2, -1, 1);
    assert.equal(origin_inside(values), true);

    // points on the curve: a corner and points on the edges
    close(radial_utilization(1, -1, values), 1, 'corner');
    close(radial_utilization(0.5, -1.5, values), 1, 'edge');
    close(radial_utilization(-0.5, 0, values), 1, 'edge, left side');
    close(radial_utilization(0, -2, values), 1, 'compression end');
    close(radial_utilization(0, 1, values), 1, 'tension end');

    // the origin itself
    assert.equal(radial_utilization(0, 0, values), 0);

    // half way on the ray to a point of the curve
    close(radial_utilization(0.5, -0.5, values), 0.5, 'half of the corner');
    close(radial_utilization(0.25, -0.75, values), 0.5, 'half of the edge');
    close(radial_utilization(0, -1, values), 0.5, 'half, M = 0');
    close(radial_utilization(-0.25, 0, values), 0.5, 'half, N = 0');

    // outside: above 1, not capped
    close(radial_utilization(2, -2, values), 2, 'twice the corner');
    close(radial_utilization(0, 3, values), 3, 'three times the tension end');
});

test('radial utilization: not defined if the origin is not inside', () => {
    // the curve ends at the origin, as for a plain concrete section
    const at_origin = rhombus(-2, -1, 0);
    assert.equal(origin_inside(at_origin), false);
    assert.equal(radial_utilization(0.2, -1, at_origin), null);
    assert.equal(radial_utilization(0, 0, at_origin), null);
    // the origin is outside of the curve
    assert.equal(origin_inside(rhombus(-2, -1.5, -1)), false);
    assert.equal(radial_utilization(0.1, -1.5, rhombus(-2, -1.5, -1)), null);

    // plain concrete sections of both norms end at N = 0
    const plain = int_diagram({ a_s1: 0, a_s2: 0 });
    assert.notEqual(plain, null);
    const [, values] = /** @type {any} */ (plain);
    assert.equal(origin_inside(values), false);
    assert.equal(radial_utilization(0.05, -2, values), null);

    // with reinforcement the origin is inside
    for (const params of [{}, { a_s1: 5, a_s2: 0 }, { a_s1: 0, a_s2: 5 },
                          { a_s1: 3, a_s2: 9, d_1: 0.03, d_2: 0.06 }]) {
        const result = int_diagram(params);
        assert.notEqual(result, null);
        assert.equal(origin_inside(/** @type {any} */ (result)[1]), true);
    }
});

test('radial utilization: points of a real curve', () => {
    for (const params of [{}, { a_s1: 3, a_s2: 9, d_1: 0.03, d_2: 0.06 }]) {
        const result = int_diagram(params);
        assert.notEqual(result, null);
        const [, values] = /** @type {any} */ (result);
        for (const side of ['', ' Neg']) {
            const moments = values['Moment Reinf' + side];
            const forces = values['Normal Force Reinf' + side];
            for (let i = 0; i < moments.length; i += 7) {
                // a point of the curve: 1; half of it: 0.5; twice: 2
                close(radial_utilization(moments[i], forces[i], values), 1,
                      `point ${i} of the curve`);
                close(radial_utilization(moments[i] / 2, forces[i] / 2, values),
                      0.5, `half of point ${i}`);
                close(radial_utilization(moments[i] * 2, forces[i] * 2, values),
                      2, `twice point ${i}`);
            }
        }
    }
});

test('radial utilization: below 1 inside of the curve, above 1 outside', () => {
    // inside / outside is determined by cult_i.js in another way
    for (const params of [{}, { a_s1: 3, a_s2: 9, d_1: 0.03, d_2: 0.06 },
                          { a_s1: 5, a_s2: 0 }]) {
        const result = int_diagram(params);
        assert.notEqual(result, null);
        const [, values] = /** @type {any} */ (result);
        const m_max = Math.max(...values['Moment Reinf']);
        const n_min = Math.min(...values['Normal Force Reinf']);
        let inside = 0;
        let outside = 0;
        for (let i = -12; i <= 12; i++) {
            for (let j = -2; j <= 24; j++) {
                const m = 1.1 * m_max * i / 12;
                const n = 1.1 * n_min * j / 24;
                const utilization = /** @type {number} */ (
                    radial_utilization(m, n, values));
                if (Math.abs(utilization - 1) < 1e-3) {
                    // too close to the curve for a comparison
                    continue;
                }
                const is_inside = cult_I_details(m, n, values) !== 'outside';
                assert.equal(utilization < 1, is_inside,
                             `m = ${m}, n = ${n}: ${utilization}`);
                if (is_inside) {
                    inside++;
                } else {
                    outside++;
                }
            }
        }
        assert.ok(inside > 50 && outside > 50);
    }
});

test('radial utilization: does not depend on the units of M and N', () => {
    const values = rhombus(-2, -1, 1);
    // moments times 1000, normal forces times 7
    const other = rhombus(-14, -7, 7, 1000);
    for (const [m, n] of [[0.3, -0.4], [-0.6, -1.5], [0.1, 0.5], [0, -1.2],
                          [1.5, -0.2]]) {
        close(radial_utilization(m * 1000, n * 7, other),
              /** @type {number} */ (radial_utilization(m, n, values)),
              `m = ${m}, n = ${n}`);
    }
});
