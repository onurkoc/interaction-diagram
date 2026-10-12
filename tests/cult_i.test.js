// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
import { cult_I } from '../app/cult_i.js';
import { loadReference, assertClose, EN_LEGACY_PLANES } from './helpers.js';

const reference = loadReference();

for (const c of reference.cases) {
    if (!c.cult_I) {
        // int_diagram returned None or raised, no CULT-I values
        continue;
    }
    // Here only cult_i.js is tested: with the curves of the Python
    // reference it has to give the Python results.
    test(`cult_I: ${c.name}`, () => {
        const input_values = c.result.input_values;
        // Python mirrored the right side, so the left side has the
        // same normal forces
        const values = {
            ...c.result.values,
            'Normal Force Neg': c.result.values['Normal Force'],
            'Normal Force Reinf Neg': c.result.values['Normal Force Reinf'],
        };
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

    // the whole chain with the legacy strain planes
    test(`cult_I with curves from core.js: ${c.name}`, () => {
        const result = int_diagram(c.params, EN_LEGACY_PLANES);
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
