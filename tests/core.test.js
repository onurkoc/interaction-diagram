// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
import { loadReference, assertClose, waiting } from './helpers.js';

const reference = loadReference();

for (const c of reference.cases) {
    // c.known_wrong: the Python values are wrong (see NOTES.md),
    // the 1:1 port has to reproduce them anyway
    test(`int_diagram: ${c.name}`, waiting(c.name), () => {
        if (c.error) {
            // Python raised an exception, the port throws at the same place
            assert.throws(() => int_diagram(c.params),
                          { message: c.error.message });
            return;
        }
        const result = int_diagram(c.params);
        if (c.result === null) {
            assert.equal(result, null);
            return;
        }
        assert.notEqual(result, null);
        const [input_values, values] = /** @type {any} */ (result);

        assert.deepEqual(Object.keys(input_values),
                         Object.keys(c.result.input_values));
        for (const key of Object.keys(c.result.input_values)) {
            assertClose(input_values[key], c.result.input_values[key],
                        `input_values.${key}`);
        }

        assert.deepEqual(Object.keys(values), Object.keys(c.result.values));
        for (const key of Object.keys(c.result.values)) {
            if (key === 'x1_y1' || key === 'x2_y2') {
                // eccentricity line, see the skipped test below
                continue;
            }
            assertClose(values[key], c.result.values[key], `values.${key}`);
        }
    });

    if (c.result && 'x1_y1' in c.result.values) {
        // the position of the eccentricity line changed with E1
        test(`int_diagram, eccentricity line: ${c.name}`,
             { skip: 'wartet auf Referenz (E1)' }, () => {});
    }
}
