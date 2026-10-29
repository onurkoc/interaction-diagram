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
 * Moment of the app at the normal force n [kNm]: the outermost point of
 * the curve of one side. 0 if the curve does not reach n.
 * @param {number} n  [kN]
 * @param {string} side  '+' or '-'
 * @param {number[]} curve_m  [MNm]
 * @param {number[]} curve_n  [MN]
 * @returns {number}
 */
function moment_at(n, side, curve_m, curve_n) {
    const [x] = intersection([-1e3, 1e3], [n / 1000, n / 1000],
                             curve_m, curve_n);
    if (x.length === 0) {
        return 0;
    }
    return 1000 * (side === '+' ? Math.max(...x) : Math.min(...x));
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
        const result = int_diagram(section.params, en1992);
        assert.ok(result !== null);
        const values = result[1];
        for (const side of ['+', '-']) {
            const curve_m = (side === '+') ? values['Moment Reinf']
                                           : values['Moment Reinf Neg'];
            const curve_n = (side === '+') ? values['Normal Force Reinf']
                                           : values['Normal Force Reinf Neg'];
            const m_max = 1000 * Math.max(...curve_m.map(Math.abs));
            for (const point of section.points) {
                if (point.side !== side) {
                    continue;
                }
                const m_app = moment_at(point.N, side, curve_m, curve_n);
                const label = `section ${k}, side ${side}, N = ${point.N}: ` +
                    `app ${m_app}, structuralcodes ${point.M}`;
                if (side === '+') {
                    assert.ok(m_app <= point.M + TOLERANCE * m_max, label);
                } else {
                    assert.ok(m_app >= point.M - TOLERANCE * m_max, label);
                }
            }
        }
    });
});
