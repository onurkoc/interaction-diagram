// @ts-check
/*
Comparison with the open-source library structuralcodes (fib), EN 1992-1-1.

The values in reference/structuralcodes.json were calculated with
structuralcodes 0.7.3 by reference/structuralcodes_compare.py (model and
choice of the sections are described there): 40 sections, 9 normal
forces on each side, 720 points.

At every point the moment of the app must not be more than 0.1 % of
M_max above structuralcodes (side +), or below it (side -). Deviations
to the safe side are allowed (V1, V2 in NOTES.md). M_max is the largest
|M| of the curve of the app on that side.

A normal force that the curve of the app does not reach (e.g. the
compression end of structuralcodes beyond the one of the app) counts as
"app safer": the app does not carry this normal force at all. Such a
point is neither extrapolated nor skipped.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { int_diagram } from '../app/core.js';
import { intersection } from '../app/intersection.js';
import { en1992 } from '../app/norms/en1992.js';

const TOLERANCE = 0.001;  // 0.1 % of M_max

const url = new URL('./reference/structuralcodes.json', import.meta.url);
const reference = JSON.parse(readFileSync(url, 'utf-8'));

/**
 * Result of the check of one point.
 * @typedef {{kind: 'beyond'} | {kind: 'compared', m_app: number,
 *            excess: number}} PointCheck
 *     beyond: the normal force is outside of the range of the curve of
 *     the app, the app is safer; compared: excess is how far the app
 *     lies on the unsafe side of structuralcodes [kNm], negative = safe
 */

/**
 * Compare one point of structuralcodes with the curve of the app.
 * @param {{N: number, M: number}} point  [kN, kNm]
 * @param {string} side  '+' or '-'
 * @param {number[]} curve_m  curve of the app on this side [MNm]
 * @param {number[]} curve_n  [MN]
 * @returns {PointCheck}
 */
function check_point(point, side, curve_m, curve_n) {
    const n = point.N / 1000;
    if (n < Math.min(...curve_n) || n > Math.max(...curve_n)) {
        return { kind: 'beyond' };
    }
    const [x] = intersection([-1e3, 1e3], [n, n], curve_m, curve_n);
    // inside of the range the curve has to be met
    assert.ok(x.length > 0, `no point of the app curve at N = ${point.N}`);
    const m_app = 1000 * (side === '+' ? Math.max(...x) : Math.min(...x));
    const excess = (side === '+') ? m_app - point.M : point.M - m_app;
    return { kind: 'compared', m_app: m_app, excess: excess };
}

/**
 * The curve of the app on one side of a section of the JSON.
 * @param {Object} params
 * @param {string} side
 * @returns {{curve_m: number[], curve_n: number[], m_max: number}}
 */
function app_side(params, side) {
    const result = int_diagram(params, en1992);
    assert.ok(result !== null);
    const values = result[1];
    const curve_m = (side === '+') ? values['Moment Reinf']
                                   : values['Moment Reinf Neg'];
    const curve_n = (side === '+') ? values['Normal Force Reinf']
                                   : values['Normal Force Reinf Neg'];
    const m_max = 1000 * Math.max(...curve_m.map(Math.abs));
    return { curve_m, curve_n, m_max };
}

test('structuralcodes: 40 sections, 720 points', () => {
    assert.equal(reference.structuralcodes, '0.7.3');
    assert.equal(reference.sections.length, 40);
    const count = reference.sections.reduce(
        (/** @type {number} */ sum, /** @type {any} */ s) => sum + s.points.length, 0);
    assert.equal(count, 720);
});

test('structuralcodes: the app is not above structuralcodes ' +
     '(at most 0.1 % of M_max)', () => {
    reference.sections.forEach((/** @type {any} */ section,
                                /** @type {number} */ k) => {
        for (const side of ['+', '-']) {
            const { curve_m, curve_n, m_max } = app_side(section.params, side);
            for (const point of section.points) {
                if (point.side !== side) {
                    continue;
                }
                const check = check_point(point, side, curve_m, curve_n);
                if (check.kind === 'beyond') {
                    // the app does not carry this normal force: safer
                    continue;
                }
                assert.ok(check.excess <= TOLERANCE * m_max,
                          `section ${k}, side ${side}, N = ${point.N}: ` +
                          `app ${check.m_app}, structuralcodes ${point.M}`);
            }
        }
    });
});

test('structuralcodes: a normal force beyond the end of the app curve ' +
     'counts as app safer', () => {
    const section = reference.sections[0];
    for (const side of ['+', '-']) {
        const { curve_m, curve_n } = app_side(section.params, side);
        const n_compression = 1000 * Math.min(...curve_n);  // kN
        const n_tension = 1000 * Math.max(...curve_n);
        // beyond the compression end and beyond the tension end, with a
        // moment of either sign: always app safer, never compared
        for (const n of [1.01 * n_compression, 1.01 * n_tension]) {
            for (const m of [-50, 0, 50]) {
                assert.deepEqual(
                    check_point({ N: n, M: m }, side, curve_m, curve_n),
                    { kind: 'beyond' });
            }
        }
        // just inside of the compression end: compared, not skipped
        const inside = check_point({ N: 0.99 * n_compression, M: 0 },
                                   side, curve_m, curve_n);
        assert.equal(inside.kind, 'compared');
    }
});
