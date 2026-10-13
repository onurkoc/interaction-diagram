// @ts-check
/*
Regression against the Python reference (legacy/core.py).
The norm configuration with the legacy strain planes is used, because
the default planes (pivot points A, B, C) differ from Python.
The reference contains only sections for which core.py is correct
(a_s1 = a_s2, d_1 = d_2); the corrections are tested in
corrections.test.js and commercial program.test.js.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
import { loadReference, assertClose, EN_LEGACY_PLANES } from './helpers.js';

const reference = loadReference();

for (const c of reference.cases) {
    test(`int_diagram, legacy strain planes: ${c.name}`, () => {
        if (c.error) {
            // Python raised an exception, the port throws at the same place
            assert.throws(() => int_diagram(c.params, EN_LEGACY_PLANES),
                          { message: c.error.message });
            return;
        }
        const result = int_diagram(c.params, EN_LEGACY_PLANES);
        if (c.result === null) {
            assert.equal(result, null);
            return;
        }
        assert.notEqual(result, null);
        const [input_values, values] = /** @type {any} */ (result);

        // all keys of legacy/core.py, in the same order; core.js adds
        // more keys behind them (norm, f_cd, f_yd, ...)
        const keys = Object.keys(c.result.input_values);
        assert.deepEqual(Object.keys(input_values).slice(0, keys.length), keys);
        for (const key of keys) {
            assertClose(input_values[key], c.result.input_values[key],
                        `input_values.${key}`);
        }

        // right side of the diagram.
        // x1_y1 and x2_y2 of the reference (old capping of the curve with
        // the minimum eccentricity) do not exist any more (E2, D1)
        for (const key of ['Moment', 'Normal Force',
                           'Moment Reinf', 'Normal Force Reinf']) {
            assertClose(values[key], c.result.values[key], `values.${key}`);
        }
    });

    if (!c.result) {
        continue;
    }
    test(`int_diagram, legacy strain planes, left side: ${c.name}`, () => {
        const result = int_diagram(c.params, EN_LEGACY_PLANES);
        assert.notEqual(result, null);
        const values = /** @type {any} */ (result)[1];
        const ref = c.result.values;

        // Python mirrored the right side. That is correct for
        // a_s1 = a_s2 and d_1 = d_2.
        assertClose(values['Moment Neg'], ref['Moment Neg'], 'Moment Neg');
        assertClose(values['Normal Force Neg'], ref['Normal Force'],
                    'Normal Force Neg');
        assertClose(values['Moment Reinf Neg'], ref['Moment Reinf Neg'],
                    'Moment Reinf Neg');
        assertClose(values['Normal Force Reinf Neg'],
                    ref['Normal Force Reinf'], 'Normal Force Reinf Neg');
    });
}
