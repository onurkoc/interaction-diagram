// @ts-check
/*
The tools of the MCP server against direct calls of the app modules:
the tools may only convert units and signs, the numbers come from
int_diagram and radial_utilization. No calculated reference values;
the tests of the rules (sources, assessment, conversions) check only
what follows from the rule itself.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { interaction_diagram, check_loads, check_loads_file, ToolInputError,
         DISCLAIMER } from '../tools.js';
import { RULES, INSTRUCTIONS } from '../rules.js';
import { int_diagram, min_eccentricity_moments } from '../../app/core.js';
import { radial_utilization } from '../../app/utilization.js';
import { intersection } from '../../app/intersection.js';
import { cult_I_details } from '../../app/cult_i.js';
import { en1992 } from '../../app/norms/en1992.js';
import { sia262 } from '../../app/norms/sia262.js';
import { translator } from '../../app/i18n.js';

// SheetJS of the app; the path is a variable, so that the type check
// does not read the library (as in ../tools.js)
const XLSX_PATH = '../../app/vendor/xlsx-0.20.3.mjs';
const XLSX = await import(XLSX_PATH);

/** @typedef {import('../../app/core.js').InputValues} InputValues */
/** @typedef {import('../../app/core.js').Values} Values */

const CONVENTION = { force_unit: 'kN', moment_unit: 'kNm',
                     compression: 'negative' };

/**
 * A source of the documents.
 * @param {string} [kind]
 * @returns {{document: string, location: string, kind: string}}
 */
function from(kind = 'text') {
    return { document: 'report 1', location: 'chapter 2', kind: kind };
}

/**
 * Sources for every given value of a section of SECTIONS.
 * @param {Object<string, any>} section
 * @returns {Object<string, any>}
 */
function sources_of(section) {
    /** @type {Object<string, any>} */
    const sources = { norm: from() };
    for (const name of ['h', 'b', 'd_1', 'd_2', 'a_s1', 'a_s2', 'f_ck', 'f_yk',
                        'eta_t', 'gamma_c', 'gamma_s', 'alpha_cc', 'alpha_cc_pl']) {
        if (section[name] !== undefined) {
            sources[name] = from();
        }
    }
    return sources;
}

/**
 * @param {Object<string, any>} section
 * @returns {Object<string, any>}
 */
function with_sources(section) {
    return { ...section, sources: sources_of(section) };
}

// three sections: symmetric, one layer only, asymmetric (SIA)
const SECTIONS = [
    { tool: with_sources({ norm: 'en1992', h: 0.30, b: 1.0, d_1: 0.05, d_2: 0.05,
                           a_s1: 5.24, a_s2: 5.24, f_ck: 30, f_yk: 500 }),
      app: { h_: 0.30, b_: 1.0, d_1: 0.05, d_2: 0.05, a_s1: 5.24,
             a_s2: 5.24, f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15,
             alpha_cc: 1.0, alpha_cc_pl: 0.8 },
      norm: en1992 },
    { tool: with_sources({ norm: 'en1992', h: 0.25, b: 1.0, d_1: 0.04, d_2: 0.04,
                           a_s1: 7.85, a_s2: 0, f_ck: 25, f_yk: 500,
                           alpha_cc: 0.85 }),
      app: { h_: 0.25, b_: 1.0, d_1: 0.04, d_2: 0.04, a_s1: 7.85, a_s2: 0,
             f_ck: 25, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15,
             alpha_cc: 0.85, alpha_cc_pl: 0.8 },
      norm: en1992 },
    { tool: with_sources({ norm: 'sia262', h: 0.40, b: 0.8, d_1: 0.05, d_2: 0.06,
                           a_s1: 10.05, a_s2: 5.65, f_ck: 40, f_yk: 500,
                           eta_t: 0.85, gamma_c: 1.2, gamma_s: 1.0 }),
      app: { h_: 0.40, b_: 0.8, d_1: 0.05, d_2: 0.06, a_s1: 10.05,
             a_s2: 5.65, f_ck: 40, f_yk: 500, gamma_c: 1.2, gamma_s: 1.0,
             eta_t: 0.85 },
      norm: sia262 },
];

/**
 * Source of a load point.
 * @param {string} [kind]
 * @param {string} [combination]
 */
function load_from(kind = 'table', combination = 'LC 1') {
    return { ...from(kind), combination: combination };
}

// load points [kN, kNm], compression negative
const POINTS = [{ N: -1000, M: 100 }, { N: -1500, M: -80 }, { N: 0, M: 30 },
                { N: 200, M: -10 }, { N: -4000, M: 0 }, { N: -3000, M: 400 }];
const LOADS = POINTS.map(p => ({ ...p, source: load_from() }));

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
        loads: LOADS.map(p => ({ N: -p.N / 1000, M: p.M / 1000,
                                 source: p.source })) });
    assert.equal(turned.convention.compression, 'positive');
    assert.equal(turned.convention.force_unit, 'MN');
    // the echo keeps the input of the call
    assert.deepEqual(turned.input.loads[0], { N: 1, M: 0.1, source: load_from() });
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
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, alpha_cc: 0.75,
                                        sources: { ...s.sources, alpha_cc: from() } }),
            'alpha_cc = 0.75');
});

test('SIA: eta_t is required, the minimum eccentricity is rejected', () => {
    const s = SECTIONS[2].tool;
    const { eta_t, ...sources } = s.sources;
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, eta_t: undefined,
                                        sources: sources }),
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
                                loads: [{ N: -100, M: NaN, source: load_from() }] }),
            'loads[0].M');
});

test('plain concrete: no radial utilization, no governing point', () => {
    const s = { ...SECTIONS[0].tool, a_s1: 0, a_s2: 0 };
    const answer = check_loads({ ...s, ...CONVENTION, gamma_d: 1,
                                 loads: [{ N: -500, M: 10, source: load_from() }] });
    assert.equal(answer.radial_utilization_defined, false);
    assert.equal(answer.points[0].utilization, null);
    assert.equal(answer.governing, null);
});

// ---- rules for agents: sources, assessment, conversions, comparison ----

// all four roles of the combination: the completeness is shown
const ENVELOPE = [
    { N: -1000, M: 100, role: 'max_M', source: load_from() },
    { N: -1500, M: -80, role: 'min_M', source: load_from() },
    { N: -200, M: 30, role: 'max_N', source: load_from() },
    { N: -2500, M: 50, role: 'min_N', source: load_from() },
];

test('the sources are required, unknown or misplaced sources are rejected', () => {
    const s = SECTIONS[0].tool;
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, sources: undefined }),
            'sources is required');
    const { a_s1, ...without } = s.sources;
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, sources: without }),
            'sources.a_s1: the source is required');
    rejects(() => interaction_diagram({ ...s, ...CONVENTION,
                                        sources: { ...s.sources, eta_t: from() } }),
            'sources.eta_t: not an input of this call');
    // there is no kind for a value derived from a result of the documents
    rejects(() => interaction_diagram({
        ...s, ...CONVENTION,
        sources: { ...s.sources, a_s1: from('back_calculated') } }),
        'sources.a_s1.kind');
    rejects(() => interaction_diagram({
        ...s, ...CONVENTION,
        sources: { ...s.sources, h: { document: 'report 1', location: ' ',
                                      kind: 'text' } } }),
        'sources.h.location');
    // a load point needs its source with the load combination
    rejects(() => check_loads({ ...s, ...CONVENTION, gamma_d: 1,
                                loads: [/** @type {any} */ ({ N: -100, M: 10, source: from() })] }),
            'loads[0].source.combination');
    rejects(() => check_loads({ ...s, ...CONVENTION, gamma_d: 1,
                                loads: [/** @type {any} */ ({ N: -100, M: 10 })] }),
            'loads[0].source: the source is required');
});

test('assessment: an assumed value makes it not assessable, the result ' +
     'is still calculated', () => {
    const s = SECTIONS[0].tool;
    const assumed = { ...s, sources: { ...s.sources, a_s1: from('assumed') } };
    const answer = check_loads({ ...assumed, ...CONVENTION, gamma_d: 1,
                                 loads: ENVELOPE });
    const plain = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: ENVELOPE });
    assert.equal(answer.assessment.status, 'not_assessable');
    assert.ok(answer.assessment.text.startsWith(
        'not assessable – information missing: a_s1 (assumed)'));
    assert.deepEqual(answer.points.map((/** @type {any} */ p) => p.utilization),
                     plain.points.map((/** @type {any} */ p) => p.utilization));
    // the curve only: the same rule
    const curve = interaction_diagram({ ...assumed, ...CONVENTION });
    assert.equal(curve.assessment.status, 'not_assessable');
    // an assumed load point too
    const load = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: [
        ...ENVELOPE, { N: -100, M: 5, source: load_from('assumed') }] });
    assert.equal(load.assessment.status, 'not_assessable');
    assert.deepEqual(load.assessment.missing, ['load point 5 (assumed)']);
});

test('assessment: a value read from a figure needs attention', () => {
    const s = SECTIONS[0].tool;
    const answer = interaction_diagram({
        ...s, ...CONVENTION, sources: { ...s.sources, h: from('figure_reading') } });
    assert.equal(answer.assessment.status, 'needs_attention');
    assert.deepEqual(answer.assessment.attention, ['h read from a figure']);
    const load = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: [
        ...ENVELOPE, { N: -100, M: 5, source: load_from('figure_reading') }] });
    assert.equal(load.assessment.status, 'needs_attention');
    assert.deepEqual(load.assessment.attention, ['load point 5 read from a figure']);
});

test('assessment: all documented, all inside, all roles: no finding; ' +
     'never "in order"', () => {
    const s = SECTIONS[0].tool;
    const answer = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: ENVELOPE });
    assert.ok(answer.points.every((/** @type {any} */ p) => p.inside));
    assert.equal(answer.assessment.status, 'no_finding');
    assert.equal(answer.assessment.text, 'no finding (pre-check)');
    const curve = interaction_diagram({ ...s, ...CONVENTION });
    assert.equal(curve.assessment.status, 'inputs_documented');
    for (const text of [answer.assessment.text, curve.assessment.text]) {
        assert.ok(!/in order|in Ordnung|\bOK\b|verified/i.test(text));
    }
});

test('assessment: a combination without all four roles needs attention', () => {
    const s = SECTIONS[0].tool;
    const answer = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: [
        ...ENVELOPE, { N: -100, M: 5, source: load_from('table', 'LC 2'),
                       role: 'max_N' }] });
    assert.equal(answer.assessment.status, 'needs_attention');
    assert.equal(answer.assessment.attention.length, 1);
    assert.match(answer.assessment.attention[0],
                 /«LC 2».*min_N, max_M, min_M/);
    // without any role
    const none = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: LOADS });
    assert.match(none.assessment.text, /«LC 1».*max_N, min_N, max_M, min_M/);
    rejects(() => check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: [
        { ...ENVELOPE[0], role: 'largest' }] }), 'loads[0].role');
});

test('assessment: a point outside of the curve needs attention', () => {
    const s = SECTIONS[0].tool;
    const answer = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: [
        ...ENVELOPE, { N: -1000, M: 5000, source: load_from(), role: 'other' }] });
    assert.equal(answer.points[4].inside, false);
    assert.equal(answer.assessment.status, 'needs_attention');
    assert.match(answer.assessment.attention[0], /^load point 5 outside/);
});

test('assessment and rules in German', () => {
    const s = SECTIONS[2].tool;
    const answer = check_loads({
        ...s, ...CONVENTION, gamma_d: 1, language: 'de', loads: ENVELOPE,
        sources: { ...s.sources, a_s2: from('assumed') } });
    assert.equal(answer.assessment.text,
                 'nicht beurteilbar – Angabe fehlt: a_s2 (angenommen)');
    assert.deepEqual(answer.rules, RULES.de);
    const english = interaction_diagram({ ...s, ...CONVENTION });
    assert.deepEqual(english.rules, RULES.en);
    assert.equal(RULES.en.length, 5);
    for (let i = 1; i <= 5; i++) {
        assert.ok(INSTRUCTIONS.includes(`R${i} `), `R${i} in the instructions`);
    }
});

test('cover: d = c_nom + transverse diameter + bar diameter / 2, the ' +
     'same result as d given directly', () => {
    const s = SECTIONS[0].tool;
    const { d_1, ...sources } = s.sources;
    const cover = {
        ...s, d_1: undefined, cover_1: { c_nom: 0.03, bar_diameter: 12,
                                          transverse_diameter: 8 },
        sources: { ...sources, cover_1: from('plan') } };
    const by_cover = interaction_diagram({ ...cover, ...CONVENTION });
    const d = 0.03 + 0.008 + 0.006;
    const direct_d = interaction_diagram({ ...s, ...CONVENTION, d_1: d });
    assert.deepEqual(by_cover.curve, direct_d.curve);
    const row = by_cover.input_record.find((/** @type {any} */ r) => r.name === 'd_1');
    assert.equal(row.value, 0.044);
    assert.equal(row.kind, 'plan');
    assert.match(row.derived, /c_nom \+ transverse diameter \+ bar diameter \/ 2/);
    rejects(() => interaction_diagram({ ...cover, ...CONVENTION, d_1: 0.05 }),
            'd_1 and cover_1: give only one of them');
});

test('bars: a_s = b * sum of the areas per metre, the same result as a_s ' +
     'given directly', () => {
    const s = SECTIONS[2].tool;  // b = 0.8
    const { a_s1, ...sources } = s.sources;
    const bars = [{ diameter_mm: 10, spacing_m: 0.15, source: from('plan') },
                  { area_cm2_per_m: 5.24, source: from('table') }];
    const by_bars = interaction_diagram({ ...s, ...CONVENTION, a_s1: undefined,
                                          bars_1: bars, sources: sources });
    const a_s = 0.8 * (Math.PI * 10 ** 2 / 4 / 0.15 / 100 + 5.24);
    const row = by_bars.input_record.find((/** @type {any} */ r) => r.name === 'a_s1');
    assert.ok(Math.abs(row.value - a_s) < 1e-8);
    const direct_a = interaction_diagram({ ...s, ...CONVENTION, a_s1: row.value });
    assert.deepEqual(by_bars.curve, direct_a.curve);
    // the kind of an item counts for the assessment
    const assumed = interaction_diagram({
        ...s, ...CONVENTION, a_s1: undefined, sources: sources,
        bars_1: [bars[0], { ...bars[1], source: from('assumed') }] });
    assert.deepEqual(assumed.assessment.missing, ['bars_1[1] (assumed)']);
    rejects(() => interaction_diagram({ ...s, ...CONVENTION, bars_1: bars }),
            'a_s1 and bars_1: give only one of them');
    rejects(() => interaction_diagram({
        ...s, ...CONVENTION, a_s1: undefined, sources: sources,
        bars_1: [{ diameter_mm: 10, area_cm2_per_m: 5, source: from() }] }),
        'bars_1[0]: give either');
});

test('M_Rd at N_Ed: the moment of the curve at N_Ed, read as in the ' +
     'structuralcodes test; at that point the utilization is 1', () => {
    const s = SECTIONS[0];
    const answer = check_loads({ ...s.tool, ...CONVENTION, gamma_d: 1,
                                 min_eccentricity: false, loads: ENVELOPE });
    const [, values] = direct(s.norm, s.app);
    const n = -1.0;  // MN, the first point
    const [x] = intersection([-1e3, 1e3], [n, n], values['Moment Reinf'],
                             values['Normal Force Reinf']);
    const at = answer.points[0].M_Rd_at_N_Ed;
    assert.equal(at.positive, Math.max(...x) * 1000);
    const on_curve = check_loads({ ...s.tool, ...CONVENTION, gamma_d: 1,
                                   min_eccentricity: false,
                                   loads: [{ N: -1000, M: at.positive,
                                             source: load_from() }] });
    assert.ok(Math.abs(on_curve.points[0].utilization - 1) < 1e-9);
    // beyond the compression end of the curve: no value
    const beyond = check_loads({ ...s.tool, ...CONVENTION, gamma_d: 1,
                                 min_eccentricity: false,
                                 loads: [{ N: -1e5, M: 0, source: load_from() }] });
    assert.deepEqual(beyond.points[0].M_Rd_at_N_Ed,
                     { positive: null, negative: null });
});

test('comparison with the documents: deviation in % of the tool, no ' +
     'limit, no influence on the assessment', () => {
    const s = SECTIONS[0].tool;
    const first = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: ENVELOPE });
    const tool_negative = first.points[1].M_Rd_at_N_Ed.negative;
    const loads = ENVELOPE.map((p, i) => (i !== 1) ? p : {
        ...p, document_values: { M_Rd: 1.1 * tool_negative,
                                 utilization: first.points[1].utilization / 2,
                                 source: from('table') } });
    const answer = check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: loads });
    const comparison = answer.points[1].comparison_with_documents;
    assert.equal(comparison.M_Rd.tool, tool_negative);
    assert.equal(comparison.M_Rd.deviation_percent, 10);
    assert.equal(comparison.M_Rd.relation, 'document_higher');
    assert.equal(comparison.utilization.deviation_percent, -50);
    assert.equal(comparison.utilization.relation, 'document_lower');
    assert.deepEqual(comparison.source, from('table'));
    assert.equal(answer.assessment.status, 'no_finding');
    rejects(() => check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: [
        { ...ENVELOPE[0], document_values: { source: from() } }] }),
        'give M_Rd or utilization');
    rejects(() => check_loads({ ...s, ...CONVENTION, gamma_d: 1, loads: [
        { ...ENVELOPE[0], document_values: /** @type {any} */ ({ M_Rd: 100 }) }] }),
        'document_values.source: the source is required');
});

/**
 * An .xlsx file with these rows in a new temporary folder.
 * @param {any[][]} rows
 * @returns {string}  absolute path
 */
function xlsx_file(rows) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows));
    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const path = join(mkdtempSync(join(tmpdir(), 'agent-test-')), 'loads.xlsx');
    writeFileSync(path, new Uint8Array(data));
    return path;
}

test('check_loads_file = check_loads with the rows of the table, the ' +
     'roles are set by the tool', () => {
    const s = SECTIONS[2].tool;
    const file = xlsx_file([['N [kN]', 'M [kNm]'],
                            ...POINTS.map(p => [p.N, p.M])]);
    const answer = check_loads_file({ ...s, ...CONVENTION, gamma_d: 1.35,
                                      file: file, file_source: load_from() });
    const loads = check_loads({ ...s, ...CONVENTION, gamma_d: 1.35, loads: LOADS });
    assert.equal(answer.file.rows_read, POINTS.length);
    assert.equal(answer.file.per_metre, false);
    answer.points.forEach((/** @type {any} */ p, /** @type {number} */ i) => {
        assert.equal(p.utilization, loads.points[i].utilization);
        assert.equal(p.N_Ed, loads.points[i].N_Ed);
        assert.equal(p.M_Ed, loads.points[i].M_Ed);
    });
    /** @param {string} role */
    const with_role = (role) => answer.points
        .filter((/** @type {any} */ p) => p.roles.includes(role))
        .map((/** @type {any} */ p) => p.index);
    // compression negative: max_N is the largest tension, min_N the
    // largest compression
    assert.deepEqual(with_role('max_N'), [4]);
    assert.deepEqual(with_role('min_N'), [5]);
    assert.deepEqual(with_role('max_M'), [6]);
    assert.deepEqual(with_role('min_M'), [2]);
    // all roles are there: no attention for the completeness
    assert.ok(answer.assessment.attention.every(
        (/** @type {string} */ text) => !text.includes('role')));
});

test('check_loads_file: per metre values times b; sign of the call', () => {
    const s = SECTIONS[2].tool;  // b = 0.8
    const file = xlsx_file([['N [kN/m]', 'M [kN m/m]'], [-1000, 100]]);
    const answer = check_loads_file({ ...s, ...CONVENTION, compression: 'positive',
                                      gamma_d: 1, file: file,
                                      file_source: load_from() });
    assert.equal(answer.file.per_metre, true);
    assert.equal(answer.points[0].N_Ed, 800);
    assert.equal(answer.points[0].M_Ed, 80);
    // with compression positive, the one point is both max_N and min_N
    assert.deepEqual(answer.points[0].roles, ['max_N', 'min_N', 'max_M', 'min_M']);
});

test('check_loads_file: path, source and table are checked', () => {
    const s = SECTIONS[0].tool;
    rejects(() => check_loads_file({ ...s, ...CONVENTION, gamma_d: 1,
                                     file: 'loads.xlsx', file_source: load_from() }),
            'the absolute path of an .xlsx file');
    const file = xlsx_file([['N [kN]', 'M [kNm]'], [-100, 10]]);
    rejects(() => check_loads_file({ ...s, ...CONVENTION, gamma_d: 1, file: file }),
            'file_source: the source is required');
    const wrong = xlsx_file([['N [kN]', 'Moment'], [-100, 10]]);
    rejects(() => check_loads_file({ ...s, ...CONVENTION, gamma_d: 1, file: wrong,
                                     file_source: load_from() }),
            '«N [kN]»');
    const assumed = check_loads_file({ ...s, ...CONVENTION, gamma_d: 1, file: file,
                                       file_source: load_from('assumed') });
    assert.deepEqual(assumed.assessment.missing, ['load points (assumed)']);
});
