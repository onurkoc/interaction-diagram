// @ts-check
/*
The tools of the MCP server against direct calls of the app modules:
the tools may only convert units and signs, the numbers come from
int_diagram and radial_utilization. No calculated reference values.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interaction_diagram, check_loads, ToolInputError, DISCLAIMER }
    from '../tools.js';
import { int_diagram, min_eccentricity_moments } from '../../app/core.js';
import { radial_utilization } from '../../app/utilization.js';
import { cult_I_details } from '../../app/cult_i.js';
import { en1992 } from '../../app/norms/en1992.js';
import { sia262 } from '../../app/norms/sia262.js';
import { translator } from '../../app/i18n.js';

/** @typedef {import('../../app/core.js').InputValues} InputValues */
/** @typedef {import('../../app/core.js').Values} Values */

const CONVENTION = { force_unit: 'kN', moment_unit: 'kNm',
                     compression: 'negative' };

// three sections: symmetric, one layer only, asymmetric (SIA)
const SECTIONS = [
    { tool: { norm: 'en1992', h: 0.30, b: 1.0, d_1: 0.05, d_2: 0.05,
              a_s1: 5.24, a_s2: 5.24, f_ck: 30, f_yk: 500 },
      app: { h_: 0.30, b_: 1.0, d_1: 0.05, d_2: 0.05, a_s1: 5.24,
             a_s2: 5.24, f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15,
             alpha_cc: 1.0, alpha_cc_pl: 0.8 },
      norm: en1992 },
    { tool: { norm: 'en1992', h: 0.25, b: 1.0, d_1: 0.04, d_2: 0.04,
              a_s1: 7.85, a_s2: 0, f_ck: 25, f_yk: 500, alpha_cc: 0.85 },
      app: { h_: 0.25, b_: 1.0, d_1: 0.04, d_2: 0.04, a_s1: 7.85, a_s2: 0,
             f_ck: 25, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15,
             alpha_cc: 0.85, alpha_cc_pl: 0.8 },
      norm: en1992 },
    { tool: { norm: 'sia262', h: 0.40, b: 0.8, d_1: 0.05, d_2: 0.06,
              a_s1: 10.05, a_s2: 5.65, f_ck: 40, f_yk: 500, eta_t: 0.85,
              gamma_c: 1.2, gamma_s: 1.0 },
      app: { h_: 0.40, b_: 0.8, d_1: 0.05, d_2: 0.06, a_s1: 10.05,
             a_s2: 5.65, f_ck: 40, f_yk: 500, gamma_c: 1.2, gamma_s: 1.0,
             eta_t: 0.85 },
      norm: sia262 },
];

// load points [kN, kNm], compression negative
const LOADS = [{ N: -1000, M: 100 }, { N: -1500, M: -80 }, { N: 0, M: 30 },
               { N: 200, M: -10 }, { N: -4000, M: 0 }, { N: -3000, M: 400 }];

/**
 * @param {import('../../app/norms/en1992.js').Norm} norm
 * @param {Object} params
 * @returns {[InputValues, Values]}
 */
function direct(norm, params) {
    const result = int_diagram(params, norm);
    assert.ok(result !== null);
    return result;
}

/**
 * The tool has to throw a ToolInputError with this text in a message.
 * @param {() => unknown} run
 * @param {string} part
 */
function rejects(run, part) {
    assert.throws(run, (/** @type {unknown} */ error) => {
        assert.ok(error instanceof ToolInputError);
        assert.ok(error.messages.some(m => m.includes(part)),
                  `«${part}» not in ${JSON.stringify(error.messages)}`);
        return true;
    });
}

test('interaction_diagram = int_diagram, three sections', () => {
    for (const s of SECTIONS) {
        const answer = interaction_diagram({ ...s.tool, ...CONVENTION });
        const [input_values, values] = direct(s.norm, s.app);
        assert.equal(answer.f_cd, input_values.f_cd);
        assert.equal(answer.f_yd, input_values.f_yd);
        for (const [side, m, n] of [
            ['positive_moment', 'Moment Reinf', 'Normal Force Reinf'],
            ['negative_moment', 'Moment Reinf Neg', 'Normal Force Reinf Neg']]) {
            const points = answer.curve[side];
            const m_app = /** @type {Object<string, number[]>} */ (values)[m];
            const n_app = /** @type {Object<string, number[]>} */ (values)[n];
            assert.equal(points.length, m_app.length);
            points.forEach((/** @type {{N: number, M: number}} */ p,
                            /** @type {number} */ i) => {
                assert.equal(p.M, m_app[i] * 1000);
                assert.equal(p.N, n_app[i] * 1000);
            });
        }
    }
});

test('check_loads = radial_utilization, three sections', () => {
    for (const s of SECTIONS) {
        const gamma_d = 1.35;
        const answer = check_loads({ ...s.tool, ...CONVENTION, loads: LOADS,
                                     gamma_d: gamma_d,
                                     min_eccentricity: false });
        const [, values] = direct(s.norm, s.app);
        assert.equal(answer.min_eccentricity.applied, false);
        assert.equal(answer.points.length, LOADS.length);
        /** @type {number | null} */
        let largest = null;
        LOADS.forEach((load, i) => {
            const m = gamma_d * load.M / 1000;
            const n = gamma_d * load.N / 1000;
            const expected = radial_utilization(m, n, values);
            const point = answer.points[i];
            assert.equal(point.utilization, expected);
            assert.equal(point.inside, cult_I_details(m, n, values) !== 'outside');
            assert.equal(point.N_Ed, n * 1000);
            assert.equal(point.M_Ed, m * 1000);
            if (expected !== null && (largest === null || expected > largest)) {
                largest = expected;
            }
        });
        assert.equal(answer.summary.max_utilization, largest);
        assert.equal(answer.governing.utilization, largest);
    }
});

test('check_loads with the minimum eccentricity = the largest value of ' +
     'radial_utilization at the modified moments', () => {
    const s = SECTIONS[0];
    // EN: on by default, as in the app (D8)
    const answer = check_loads({ ...s.tool, ...CONVENTION, loads: LOADS,
                                 gamma_d: 1.0 });
    const [, values] = direct(s.norm, s.app);
    const e0 = /** @type {(h: number) => number} */ (en1992.min_eccentricity)(0.30);
    assert.equal(answer.min_eccentricity.applied, true);
    assert.equal(answer.min_eccentricity.e0_m, e0);
    LOADS.forEach((load, i) => {
        const moments = min_eccentricity_moments(load.M / 1000, load.N / 1000, e0);
        const expected = Math.max(...moments.map(
            m => /** @type {number} */ (radial_utilization(m, load.N / 1000, values))));
        assert.equal(answer.points[i].utilization, expected);
    });
});

test('sign and units: compression positive, MN and MNm', () => {
    const s = SECTIONS[2];
    const base = check_loads({ ...s.tool, ...CONVENTION, loads: LOADS,
                               gamma_d: 1.0 });
    const turned = check_loads({
        ...s.tool, force_unit: 'MN', moment_unit: 'MNm',
        compression: 'positive', gamma_d: 1.0,
        loads: LOADS.map(p => ({ N: -p.N / 1000, M: p.M / 1000 })) });
    assert.equal(turned.convention.compression, 'positive');
    assert.equal(turned.convention.force_unit, 'MN');
    // the echo keeps the input of the call
    assert.deepEqual(turned.input.loads[0], { N: 1, M: 0.1 });
    turned.points.forEach((/** @type {any} */ p, /** @type {number} */ i) => {
        const q = base.points[i];
        assert.equal(p.utilization, q.utilization);
        assert.equal(p.inside, q.inside);
        assert.ok(Math.abs(p.N_Ed - (-q.N_Ed / 1000)) <= 1e-12);
        assert.ok(Math.abs(p.M_Ed - q.M_Ed / 1000) <= 1e-12);
    });

    const curve = interaction_diagram({ ...s.tool, ...CONVENTION });
    const curve_turned = interaction_diagram({
        ...s.tool, force_unit: 'MN', moment_unit: 'kNm',
        compression: 'positive' });
    curve_turned.curve.positive_moment.forEach(
        (/** @type {any} */ p, /** @type {number} */ i) => {
            const q = curve.curve.positive_moment[i];
            assert.ok(Math.abs(p.N - (-q.N / 1000)) <= 1e-12);
            assert.equal(p.M, q.M);
        });
    // centric compression is the largest compression in both conventions
    assert.ok(curve_turned.curve.positive_moment[0].N > 0);
});

test('every answer has the disclaimer, the version, the norm and the ' +
     'validation note', () => {
    const s = SECTIONS[2];
    for (const language of ['en', 'de']) {
        const answer = interaction_diagram({ ...s.tool, ...CONVENTION,
                                             language: language });
        assert.equal(answer.disclaimer, DISCLAIMER);
        assert.equal(answer.disclaimer,
                     'Vorprüfung – kein Nachweis mit einem anerkannten Programm');
        assert.equal(typeof answer.app_version, 'string');
        assert.ok(answer.app_version.length > 0);
        assert.equal(answer.norm.name, sia262.name);
        assert.equal(answer.validation, translator(language)('validation.note'));
        assert.deepEqual(answer.input.eta_t, 0.85);
    }
});

test('missing convention is rejected, there is no default', () => {
    const s = SECTIONS[0].tool;
    rejects(() => interaction_diagram({ ...s, ...CONVENTION,
                                        compression: undefined }),
            'compression is required');
    rejects(() => interaction_diagram({ ...s, ...CONVENTION,
                                        force_unit: undefined }),
            'force_unit is required');
    rejects(() => check_loads({ ...s, ...CONVENTION, moment_unit: 'kN',
                                loads: LOADS, gamma_d: 1 }),
            'moment_unit is required');
    rejects(() => interaction_diagram({ ...s, ...CONVENTION,
                                        compression: 'tension' }),
            'compression is required');
});

test('input outside of the limits of the app is rejected with its ' +
     'messages', () => {
    const s = SECTIONS[0].tool;
    const t = translator('en');
    // f_ck > 50: the message of norm.check
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, f_ck: 55 }),
            t('norm.f_ck_max', { f_ck: 55, f_ck_max: 50 }));
    // d_1 >= h
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, d_1: 0.30 }),
            t('check.below_height', { name: t('name.d_1'), value: 0.3, h: 0.3 }));
    rejects(() => check_loads({ ...s, ...CONVENTION, d_2: 0.35,
                                loads: LOADS, gamma_d: 1 }),
            t('check.below_height', { name: t('name.d_2'), value: 0.35, h: 0.3 }));
    // alpha_cc outside of 0.8 to 1.0, not corrected
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, alpha_cc: 0.75 }),
            'alpha_cc = 0.75');
});

test('SIA: eta_t is required, the minimum eccentricity is rejected', () => {
    const s = SECTIONS[2].tool;
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, eta_t: undefined }),
            'η_t is missing');
    rejects(() => check_loads({ ...s, ...CONVENTION, loads: LOADS, gamma_d: 1,
                                min_eccentricity: true }),
            'no minimum eccentricity');
    // an input of the other norm is not ignored
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, alpha_cc: 1.0 }),
            'alpha_cc: not an input of SIA 262');
});

test('check_loads: load factor and load points are required', () => {
    const s = SECTIONS[0].tool;
    rejects(() => check_loads({ ...s, ...CONVENTION, loads: LOADS }),
            'Load factor γ_d is missing');
    rejects(() => check_loads({ ...s, ...CONVENTION, loads: [], gamma_d: 1 }),
            'at least one load point');
    rejects(() => check_loads({ ...s, ...CONVENTION, gamma_d: 1,
                                loads: [{ N: -100, M: NaN }] }),
            'loads[0].M');
});

test('plain concrete: no radial utilization, no governing point', () => {
    const s = { ...SECTIONS[0].tool, a_s1: 0, a_s2: 0 };
    const answer = check_loads({ ...s, ...CONVENTION, gamma_d: 1,
                                 loads: [{ N: -500, M: 10 }] });
    assert.equal(answer.radial_utilization_defined, false);
    assert.equal(answer.points[0].utilization, null);
    assert.equal(answer.governing, null);
});
