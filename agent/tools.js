// @ts-check
/*
The two tools of the MCP server, as plain functions without the MCP
library, so that they can be tested directly.

All calculation is done by the modules of the app (../app). This file
only converts units and signs, passes the input to the check of the app
and writes the answer. Invalid input is rejected with the messages of
the app, nothing is corrected.

It is a pre-check, not a verification with a recognised program.
*/
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NORMS, check_inputs, calculate, hints, message_text, error_text }
    from '../app/app.js';
import { max_utilization } from '../app/draw.js';
import { translator, LANGUAGES } from '../app/i18n.js';

/** @typedef {import('../app/app.js').RawInputs} RawInputs */
/** @typedef {import('../app/app.js').Result} Result */
/** @typedef {import('../app/norms/en1992.js').Norm} Norm */
/** @typedef {import('../app/i18n.js').Translator} Translator */

export const DISCLAIMER =
    'Vorprüfung – kein Nachweis mit einem anerkannten Programm';

// units the caller may use, factor to the units of the app (kN, kNm)
const FORCE_UNITS = /** @type {Object<string, number>} */ ({ kN: 1, MN: 1000 });
const MOMENT_UNITS = /** @type {Object<string, number>} */ ({ kNm: 1, MNm: 1000 });
const COMPRESSION = ['negative', 'positive'];

// units of the section and of the materials, fixed as in the app
export const INPUT_UNITS = {
    h: 'm', b: 'm', d_1: 'm', d_2: 'm', a_s1: 'cm2', a_s2: 'cm2',
    f_ck: 'N/mm2', f_yk: 'N/mm2', gamma_c: '-', gamma_s: '-',
    alpha_cc: '-', alpha_cc_pl: '-', eta_t: '-', gamma_d: '-',
};

// inputs of the tool and the name of the same input in the app
const SECTION_INPUTS = /** @type {Object<string, string>} */ ({
    h: 'h_', b: 'b_', d_1: 'd_1', d_2: 'd_2', a_s1: 'a_s1', a_s2: 'a_s2',
    f_ck: 'f_ck', f_yk: 'f_yk', gamma_c: 'gamma_c', gamma_s: 'gamma_s',
    alpha_cc: 'alpha_cc', alpha_cc_pl: 'alpha_cc_pl', eta_t: 'eta_t',
});

/**
 * Input of the tool interaction_diagram, as sent by the agent.
 * @typedef {Object} SectionArgs
 * @property {string} [norm]  'en1992' | 'sia262'
 * @property {number} [h]  [m]
 * @property {number} [b]  [m]
 * @property {number} [d_1]  [m]
 * @property {number} [d_2]  [m]
 * @property {number} [a_s1]  [cm2]
 * @property {number} [a_s2]  [cm2]
 * @property {number} [f_ck]  [N/mm2]
 * @property {number} [f_yk]  [N/mm2]
 * @property {number} [gamma_c]  preset of the app if not given
 * @property {number} [gamma_s]  preset of the app if not given
 * @property {number} [alpha_cc]  EN only, preset of the app if not given
 * @property {number} [alpha_cc_pl]  EN only, preset of the app if not given
 * @property {number} [eta_t]  SIA only, required
 * @property {string} [force_unit]  'kN' | 'MN', required
 * @property {string} [moment_unit]  'kNm' | 'MNm', required
 * @property {string} [compression]  'negative' | 'positive', required
 * @property {string} [language]  'en' (default) | 'de', texts of the answer
 */

/**
 * Input of the tool check_loads.
 * @typedef {SectionArgs & {
 *     loads?: {N: number, M: number}[],
 *     gamma_d?: number,
 *     min_eccentricity?: boolean,
 * }} LoadArgs
 */

/** Invalid input of a tool; the message is meant for the agent. */
export class ToolInputError extends Error {
    /**
     * @param {string[]} messages
     */
    constructor(messages) {
        super(messages.join('\n'));
        this.name = 'ToolInputError';
        this.messages = messages;
    }
}

/** @type {string | null} */
let version_cache = null;

/**
 * Version of the app: the git commit of the repository, '-dirty' if
 * there are changes that are not committed.
 * @returns {string}
 */
export function app_version() {
    if (version_cache === null) {
        const root = fileURLToPath(new URL('..', import.meta.url));
        try {
            version_cache = execFileSync(
                'git', ['describe', '--always', '--dirty', '--abbrev=12'],
                { cwd: root, encoding: 'utf-8',
                  stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        } catch {
            version_cache = 'unknown (git not available)';
        }
    }
    return version_cache;
}

/**
 * Number as text for the check of the app. The app reads only plain
 * decimal numbers; a number that JavaScript would write with an
 * exponent is rejected, not rounded.
 * @param {string} name  name of the input of the tool
 * @param {unknown} value
 * @param {string[]} errors
 * @returns {string}  '' if the value is not given
 */
function as_text(name, value, errors) {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${name}: ${JSON.stringify(value)} is not a finite number.`);
        return '';
    }
    const text = String(value);
    if (/e/i.test(text)) {
        errors.push(`${name} = ${text}: write the number without an exponent.`);
        return '';
    }
    return text;
}

/**
 * Check what the tool needs besides the app: norm, units, sign
 * convention, language, and inputs that do not belong to the norm.
 * @param {SectionArgs} args
 * @returns {{norm: Norm, t: Translator, sign: number,
 *            force: number, moment: number, language: string}}
 */
function check_convention(args) {
    /** @type {string[]} */
    const errors = [];
    const norm = (args.norm !== undefined) ? NORMS[args.norm] : undefined;
    if (norm === undefined) {
        errors.push(`norm: ${JSON.stringify(args.norm)} is not known, ` +
                    `use one of ${Object.keys(NORMS).join(', ')}.`);
    }
    if (args.force_unit === undefined || !(args.force_unit in FORCE_UNITS)) {
        errors.push('force_unit is required, no default: ' +
                    `${Object.keys(FORCE_UNITS).join(' | ')} ` +
                    `(given: ${JSON.stringify(args.force_unit)}).`);
    }
    if (args.moment_unit === undefined || !(args.moment_unit in MOMENT_UNITS)) {
        errors.push('moment_unit is required, no default: ' +
                    `${Object.keys(MOMENT_UNITS).join(' | ')} ` +
                    `(given: ${JSON.stringify(args.moment_unit)}).`);
    }
    if (args.compression === undefined || !COMPRESSION.includes(args.compression)) {
        errors.push('compression is required, no default: ' +
                    `${COMPRESSION.join(' | ')} (sign of a compressive ` +
                    `normal force; given: ${JSON.stringify(args.compression)}).`);
    }
    const language = args.language ?? 'en';
    if (!LANGUAGES.includes(language)) {
        errors.push(`language: ${JSON.stringify(language)} is not known, ` +
                    `use one of ${LANGUAGES.join(', ')}.`);
    }
    if (norm !== undefined) {
        // inputs of the other norm are rejected, not ignored
        for (const name of ['alpha_cc', 'alpha_cc_pl', 'eta_t']) {
            const value = /** @type {Object<string, any>} */ (args)[name];
            if (value !== undefined && !norm.inputs.includes(name)) {
                errors.push(`${name}: not an input of ${norm.name}.`);
            }
        }
    }
    if (errors.length > 0) {
        throw new ToolInputError(errors);
    }
    return {
        norm: /** @type {Norm} */ (norm),
        t: translator(language),
        // the app uses compression negative
        sign: (args.compression === 'negative') ? 1 : -1,
        force: FORCE_UNITS[/** @type {string} */ (args.force_unit)],
        moment: MOMENT_UNITS[/** @type {string} */ (args.moment_unit)],
        language: language,
    };
}

/**
 * The input as the app would get it from its form. Inputs that the app
 * presets (gamma_c, gamma_s, alpha_cc, alpha_cc_pl) take the preset of
 * the app if they are not given; they are listed in the answer.
 * @param {SectionArgs} args
 * @param {Norm} norm
 * @param {string} gamma_d  text of the load factor
 * @param {boolean} eccentricity
 * @returns {{raw: RawInputs, presets: Object<string, number>}}
 */
function raw_inputs(args, norm, gamma_d, eccentricity) {
    /** @type {string[]} */
    const errors = [];
    /** @type {Object<string, any>} */
    const raw = {
        gamma_d: gamma_d, eccentricity: eccentricity,
        cult: false, radial: true,
        alpha_cc: '', alpha_cc_pl: '', eta_t: '',
    };
    /** @type {Object<string, number>} */
    const presets = {};
    for (const [name, field] of Object.entries(SECTION_INPUTS)) {
        let value = /** @type {Object<string, any>} */ (args)[name];
        if ((value === undefined || value === null) && name in norm.defaults) {
            // the field of the app is preset with this value
            value = norm.defaults[name];
            presets[name] = value;
        }
        raw[field] = as_text(name, value, errors);
    }
    if (errors.length > 0) {
        throw new ToolInputError(errors);
    }
    return { raw: /** @type {RawInputs} */ (raw), presets: presets };
}

/**
 * Check the input with the check of the app; its messages, in the
 * language of the answer, if anything is wrong or missing.
 * @param {RawInputs} raw
 * @param {Norm} norm
 * @param {Translator} t
 * @returns {import('../app/core.js').InputParams}
 */
function checked_params(raw, norm, t) {
    const { params, messages } = check_inputs(raw, norm);
    if (messages.length > 0) {
        throw new ToolInputError(messages.map(m => message_text(m, t)));
    }
    return params;
}

/**
 * calculate() of the app; its errors as a ToolInputError.
 * @param {Parameters<typeof calculate>} call
 * @param {Translator} t
 * @returns {Result}
 */
function calculated(call, t) {
    try {
        return calculate(...call);
    } catch (error) {
        throw new ToolInputError([error_text(error, t)]);
    }
}

/**
 * What every answer contains besides the result.
 * @param {SectionArgs} args
 * @param {Norm} norm
 * @param {Translator} t
 * @param {Object<string, number>} presets
 * @returns {Object<string, any>}
 */
function frame(args, norm, t, presets) {
    return {
        disclaimer: DISCLAIMER,
        app_version: app_version(),
        norm: { id: args.norm, name: norm.name, label: t(norm.label) },
        validation: t('validation.note'),
        input: {
            ...args,
            input_units: INPUT_UNITS,
            presets_of_the_app_used: presets,
        },
        convention: {
            force_unit: args.force_unit,
            moment_unit: args.moment_unit,
            compression: args.compression,
            normal_force: (args.compression === 'negative')
                ? 'N < 0 is compression' : 'N > 0 is compression',
            moment: 'M > 0: tension on the side of a_s1 (axis distance ' +
                    'd_1); M < 0: tension on the side of a_s2. All output ' +
                    'uses the units and the sign convention of the call.',
        },
    };
}

/**
 * Hints of the app below the diagram, without the hint on the sign
 * convention of the file (the answer has its own convention).
 * @param {Norm} norm
 * @param {Result} result
 * @param {import('../app/app.js').Loads | null} loads
 * @param {Translator} t
 * @returns {string[]}
 */
function app_hints(norm, result, loads, t) {
    const sign_hint = t('hint.sign');
    return hints(norm, result, loads, t, { radial: true })
        .filter(text => text !== sign_hint);
}

/**
 * Tool interaction_diagram: the capacity curve with reinforcement,
 * both sides, and the design strengths.
 * @param {SectionArgs} args
 * @returns {Object<string, any>}
 */
export function interaction_diagram(args) {
    const c = check_convention(args);
    // the load factor does not change the curve, the check of the app
    // needs a value
    const { raw, presets } = raw_inputs(args, c.norm, '1', false);
    const params = checked_params(raw, c.norm, c.t);
    const result = calculated([params, c.norm, null, { radial: true }], c.t);
    const values = result.values;

    /**
     * Points of one side in the units and the sign of the call.
     * @param {number[]} m  [MNm]
     * @param {number[]} n  [MN], compression negative
     * @returns {{N: number, M: number}[]}
     */
    const side = (m, n) => m.map((m_i, i) => ({
        N: c.sign * n[i] * 1000 / c.force,
        M: m_i * 1000 / c.moment,
    }));

    return {
        ...frame(args, c.norm, c.t, presets),
        f_cd: result.input_values.f_cd,
        f_yd: result.input_values.f_yd,
        strength_unit: 'N/mm2',
        plain_concrete: result.input_values.plain,
        curve: {
            description: 'Capacity curve with reinforcement. ' +
                'positive_moment: from centric compression to pure ' +
                'tension with a_s1 in tension; negative_moment: the same ' +
                'with a_s2 in tension.',
            positive_moment: side(values['Moment Reinf'],
                                  values['Normal Force Reinf']),
            negative_moment: side(values['Moment Reinf Neg'],
                                  values['Normal Force Reinf Neg']),
        },
        hints: app_hints(c.norm, result, null, c.t),
    };
}

/**
 * Tool check_loads: for every load point inside / outside and the radial
 * utilization, as in the app, and the governing point.
 * @param {LoadArgs} args
 * @returns {Object<string, any>}
 */
export function check_loads(args) {
    const c = check_convention(args);

    /** @type {string[]} */
    const errors = [];
    if (!Array.isArray(args.loads) || args.loads.length === 0) {
        errors.push('loads: at least one load point {N, M} is required.');
    }
    const loads = Array.isArray(args.loads) ? args.loads : [];
    loads.forEach((point, i) => {
        for (const name of ['N', 'M']) {
            const value = /** @type {Object<string, any>} */ (point ?? {})[name];
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                errors.push(`loads[${i}].${name}: ${JSON.stringify(value)} ` +
                            'is not a finite number.');
            }
        }
    });
    // the option exists in the EN mode only; there it is on by default,
    // as in the app (D8)
    const has_rule = c.norm.min_eccentricity !== null;
    const eccentricity = args.min_eccentricity ?? has_rule;
    if (eccentricity && !has_rule) {
        errors.push(c.t('core.no_min_eccentricity', { norm: c.norm.name }));
    }
    const gamma_d = as_text('gamma_d', args.gamma_d, errors);
    if (errors.length > 0) {
        throw new ToolInputError(errors);
    }

    const { raw, presets } = raw_inputs(args, c.norm, gamma_d, eccentricity);
    const params = checked_params(raw, c.norm, c.t);

    // to the units and the sign of the app: kN, kNm, compression negative
    const app_loads = {
        x: loads.map(p => p.M * c.moment),
        y: loads.map(p => c.sign * p.N * c.force),
        per_metre: false,
        name: 'check_loads',
    };
    const result = calculated([params, c.norm, app_loads, { radial: true }], c.t);

    const points = result.points.map((p, i) => ({
        index: i + 1,
        N_Ed: c.sign * p.n * 1000 / c.force,
        M_Ed: p.m * 1000 / c.moment,
        M_Ed_checked: p.m_mod * 1000 / c.moment,
        modified_by_min_eccentricity: p.modified,
        inside: p.inside,
        utilization: p.utilization,
    }));

    // governing: the largest radial utilization, as in the summary of
    // the app
    const largest = max_utilization(result.points);
    /** @type {Object<string, any> | null} */
    let governing = null;
    if (largest !== null) {
        const i = result.points.findIndex(p => p.utilization === largest);
        governing = points[i];
    }

    return {
        ...frame(args, c.norm, c.t, presets),
        min_eccentricity: {
            applied: result.e0 !== null,
            e0_m: result.e0,
        },
        f_cd: result.input_values.f_cd,
        f_yd: result.input_values.f_yd,
        strength_unit: 'N/mm2',
        plain_concrete: result.input_values.plain,
        load_factor_gamma_d: params.gamma_d,
        description: 'N_Ed, M_Ed: load point times gamma_d. M_Ed_checked: ' +
            'the moment of the check (with the minimum eccentricity, ' +
            'if applied; for M_Ed = 0 the less favourable sign). ' +
            'utilization = |S_d| / |R_d| on the ray from the origin ' +
            'through the checked point (1 = on the curve, > 1 = outside, ' +
            'not capped); null if not defined (origin not inside of the ' +
            'curve, e.g. plain concrete).',
        radial_utilization_defined: result.radial_defined,
        summary: {
            total: points.length,
            inside: points.filter(p => p.inside).length,
            outside: points.filter(p => !p.inside).length,
            max_utilization: largest,
        },
        governing: governing,
        points: points,
        hints: app_hints(c.norm, result, app_loads, c.t),
    };
}
