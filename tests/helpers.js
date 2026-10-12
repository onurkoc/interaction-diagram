// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Reference values written by tests/reference/make_reference.py
 * @returns {any}
 */
export function loadReference() {
    const url = new URL('./reference/reference.json', import.meta.url);
    return JSON.parse(readFileSync(url, 'utf-8'));
}

/**
 * Reference cases whose Python values are not valid any more after a
 * correction (NOTES.md, section 5). They wait for reference values from
 * a recognised program (D6), the app does not calculate its own
 * reference. Value: the finding whose correction changed the result.
 * @type {Object<string, string>}
 */
export const WAITING_FOR_REFERENCE = {
    'alpha_cc_080_raised_to_085': 'E5',
    'no_reinforcement': 'E10',
    'no_reinforcement_eccentricity': 'E10',
};

/**
 * Test options for a reference case: skipped while it waits for
 * reference values.
 * @param {string} name  name of the reference case
 * @returns {{skip?: string}}
 */
export function waiting(name) {
    if (name in WAITING_FOR_REFERENCE) {
        return { skip: `wartet auf Referenz (${WAITING_FOR_REFERENCE[name]})` };
    }
    return {};
}

/**
 * Compare with the Python reference: |a - b| <= 1e-9 * |ref| + 1e-12
 * Numbers, booleans and nested arrays are supported.
 * @param {any} actual
 * @param {any} ref
 * @param {string} label  where we are, for the error message
 */
export function assertClose(actual, ref, label) {
    if (Array.isArray(ref)) {
        assert.ok(Array.isArray(actual), `${label}: expected an array`);
        assert.equal(actual.length, ref.length, `${label}: length`);
        for (let i = 0; i < ref.length; i++) {
            assertClose(actual[i], ref[i], `${label}[${i}]`);
        }
        return;
    }
    if (typeof ref === 'number') {
        assert.equal(typeof actual, 'number', `${label}: expected a number`);
        const tolerance = 1e-9 * Math.abs(ref) + 1e-12;
        assert.ok(Math.abs(actual - ref) <= tolerance,
                  `${label}: ${actual} != ${ref} (reference)`);
        return;
    }
    assert.equal(actual, ref, label);
}
