// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
import { cult_I } from '../app/cult_i.js';
import { loadReference, assertClose, waiting } from './helpers.js';

const reference = loadReference();

for (const c of reference.cases) {
    if (!c.cult_I) {
        // int_diagram returned None or raised, no CULT-I values
        continue;
    }
    // c.known_wrong: the Python values are wrong (see NOTES.md),
    // the 1:1 port has to reproduce them anyway
    test(`cult_I: ${c.name}`, () => {
        // curves from the Python reference, so only cult_i.js is tested here
        const { input_values, values } = c.result;
        for (const p of c.cult_I) {
            const label = `m = ${p.m}, n = ${p.n}`;
            if (p.error) {
                assert.throws(() => cult_I(p.m, p.n, input_values, values),
                              undefined, label);
                continue;
            }
            assertClose(cult_I(p.m, p.n, input_values, values),
                        p.cult_I, label);
        }
    });

    test(`cult_I with curves from core.js: ${c.name}`, waiting(c.name), () => {
        const result = int_diagram(c.params);
        assert.notEqual(result, null);
        const [input_values, values] = /** @type {any} */ (result);
        for (const p of c.cult_I) {
            if (p.error) {
                continue;
            }
            assertClose(cult_I(p.m, p.n, input_values, values),
                        p.cult_I, `m = ${p.m}, n = ${p.n}`);
        }
    });
}
