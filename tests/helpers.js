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
