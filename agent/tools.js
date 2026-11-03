// @ts-check
/*
The tools of the MCP server, as plain functions without the MCP
library, so that they can be tested directly.

All calculation is done by the modules of the app (../app). This file
only converts units and signs, passes the input to the check of the app
and writes the answer. Invalid input is rejected with the messages of
the app, nothing is corrected. The sources of the inputs and the
conversion of cover and bars are in sources.js, the rules and the
assessment in rules.js.

It is a pre-check, not a verification with a recognised program.
*/
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NORMS, check_inputs, calculate, hints, message_text, error_text }
    from '../app/app.js';
import { max_utilization } from '../app/draw.js';
import { translator, LANGUAGES } from '../app/i18n.js';
import { intersection } from '../app/intersection.js';
import { read } from '../app/xls_read.js';
import { section_sources, load_sources, check_source, note_kind,
         ENVELOPE_ROLES } from './sources.js';
import { RULES, assessment, reason } from './rules.js';

/** @typedef {import('../app/app.js').RawInputs} RawInputs */
/** @typedef {import('../app/app.js').Result} Result */
/** @typedef {import('../app/norms/en1992.js').Norm} Norm */
/** @typedef {import('../app/i18n.js').Translator} Translator */

// SheetJS of the app (app/vendor), as in the tests of xls_read.js; the
// path is a variable, so that the type check does not read the library
const XLSX_PATH = '../app/vendor/xlsx-0.20.3.mjs';
const XLSX = await import(XLSX_PATH);

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
 * @property {Object<string, any>} [sources]  source of every value of the
 *     section (sources.js), required
 * @property {Object<string, number>} [cover_1]  instead of d_1: c_nom [m],
 *     bar_diameter [mm], transverse_diameter [mm]
 * @property {Object<string, number>} [cover_2]  instead of d_2
 * @property {Object<string, any>[]} [bars_1]  instead of a_s1: bars and
 *     meshes, each with its source
 * @property {Object<string, any>[]} [bars_2]  instead of a_s2
 */

/**
 * Input of the tool check_loads.
 * @typedef {SectionArgs & {
 *     loads?: import('./sources.js').LoadInput[],
 *     gamma_d?: number,
 *     min_eccentricity?: boolean,
 * }} LoadArgs
 */

/**
 * Input of the tool check_loads_file.
 * @typedef {SectionArgs & {
 *     file?: string,
 *     file_source?: import('./sources.js').LoadSource,
 *     gamma_d?: number,
 *     min_eccentricity?: boolean,
 * }} FileArgs
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
 * The section of a call, checked: convention, sources, converted cover
 * and bars, and the input checked by the app.
 * @typedef {Object} Section
 * @property {ReturnType<typeof check_convention>} c
 * @property {import('./sources.js').SectionSources} sources
 * @property {Object<string, any>} args  the call with d_i and a_s_i as
 *     the app gets them
 */

/**
 * Check the convention and the sources of the section; convert cover and
 * bars. Every problem of the sources is reported at once.
 * @param {SectionArgs} args
 * @returns {Section}
 */
function section_of(args) {
    const c = check_convention(args);
    /** @type {string[]} */
    const errors = [];
    const sources = section_sources(args, c.norm.defaults, c.language, errors);
    if (errors.length > 0) {
        throw new ToolInputError(errors);
    }
    return { c: c, sources: sources, args: { ...args, ...sources.values } };
}

/**
 * What every answer contains besides the result.
 * @param {Section} section
 * @param {Object<string, number>} presets
 * @returns {Object<string, any>}
 */
function frame(section, presets) {
    const { c, args } = section;
    const norm = c.norm;
    const t = c.t;
    return {
        disclaimer: DISCLAIMER,
        rules: (c.language === 'de') ? RULES.de : RULES.en,
        app_version: app_version(),
        norm: { id: args.norm, name: norm.name, label: t(norm.label) },
        validation: t('validation.note'),
        input_record: section.sources.record,
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
 * The moment of the curve at a normal force, on both sides: the
 * intersection of the curve with the horizontal line N = n, read as in
 * tests/structuralcodes.test.js (largest moment on the positive side,
 * smallest on the negative side).
 * @param {number} n  normal force [MN], compression negative
 * @param {import('../app/core.js').Values} values
 * @returns {{positive: number | null, negative: number | null}}  [MNm];
 *     null if n is outside of the range of the curve on that side
 */
function moments_at(n, values) {
    /**
     * @param {number[]} curve_m
     * @param {number[]} curve_n
     * @param {(x: number[]) => number} pick
     * @returns {number | null}
     */
    const at = (curve_m, curve_n, pick) => {
        if (n < Math.min(...curve_n) || n > Math.max(...curve_n)) {
            return null;
        }
        const [x] = intersection([-1e3, 1e3], [n, n], curve_m, curve_n);
        return (x.length > 0) ? pick(x) : null;
    };
    return {
        positive: at(values['Moment Reinf'], values['Normal Force Reinf'],
                     x => Math.max(...x)),
        negative: at(values['Moment Reinf Neg'], values['Normal Force Reinf Neg'],
                     x => Math.min(...x)),
    };
}

/**
 * Deviation of a value of the documents from the value of the tool,
 * in % of the value of the tool. No limit: the reviewer decides.
 * @param {number} document_value
 * @param {number | null} tool_value
 * @returns {Object<string, any>}
 */
function deviation(document_value, tool_value) {
    if (tool_value === null) {
        return { document: document_value, tool: null,
                 note: 'no value of the tool at this point' };
    }
    if (tool_value === 0) {
        return { document: document_value, tool: 0,
                 note: 'the value of the tool is 0, no deviation in %' };
    }
    const percent = (Math.abs(document_value) - Math.abs(tool_value)) /
                    Math.abs(tool_value) * 100;
    return {
        document: document_value,
        tool: tool_value,
        deviation_percent: Math.round(percent * 100) / 100,
        relation: (percent > 0) ? 'document_higher'
            : (percent < 0) ? 'document_lower' : 'equal',
    };
}

/**
 * Tool interaction_diagram: the capacity curve with reinforcement,
 * both sides, and the design strengths.
 * @param {SectionArgs} args
 * @returns {Object<string, any>}
 */
export function interaction_diagram(args) {
    const section = section_of(args);
    const c = section.c;
    // the load factor does not change the curve, the check of the app
    // needs a value
    const { raw, presets } = raw_inputs(section.args, c.norm, '1', false);
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
        assessment: assessment(section.sources.missing,
                               section.sources.attention,
                               'inputs_documented', c.language),
        ...frame(section, presets),
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
 * What belongs to a load point besides N and M.
 * @typedef {Object} PointMeta
 * @property {import('./sources.js').LoadSource} source
 * @property {string[]} roles
 * @property {{M_Rd?: number, utilization?: number,
 *             source: import('./sources.js').Source}} [document_values]
 */

/**
 * The common part of check_loads and check_loads_file: the calculation
 * of the app, the points with their sources, the comparison with the
 * documents and the assessment.
 * @param {Section} section
 * @param {{min_eccentricity?: boolean, gamma_d?: number}} options
 * @param {{x: number[], y: number[], per_metre: boolean}} loads
 *     as the app reads a file: [kNm], [kN] or per metre, compression
 *     negative
 * @param {PointMeta[]} meta  one per load point
 * @param {{missing: string[], attention: string[]}} of_loads
 * @returns {Object<string, any>}
 */
function evaluated(section, options, loads, meta, of_loads) {
    const c = section.c;
    /** @type {string[]} */
    const errors = [];
    // the option exists in the EN mode only; there it is on by default,
    // as in the app (D8)
    const has_rule = c.norm.min_eccentricity !== null;
    const eccentricity = options.min_eccentricity ?? has_rule;
    if (eccentricity && !has_rule) {
        errors.push(c.t('core.no_min_eccentricity', { norm: c.norm.name }));
    }
    const gamma_d = as_text('gamma_d', options.gamma_d, errors);
    if (errors.length > 0) {
        throw new ToolInputError(errors);
    }

    const { raw, presets } = raw_inputs(section.args, c.norm, gamma_d, eccentricity);
    const params = checked_params(raw, c.norm, c.t);
    const app_loads = { ...loads, name: 'check_loads' };
    const result = calculated([params, c.norm, app_loads, { radial: true }], c.t);

    const missing = [...section.sources.missing, ...of_loads.missing];
    const attention = [...section.sources.attention, ...of_loads.attention];

    /** @param {number | null} m  [MNm] */
    const moment = (m) => (m === null) ? null : m * 1000 / c.moment;

    const points = result.points.map((p, i) => {
        const at_n = moments_at(p.n, result.values);
        const M_Rd = { positive: moment(at_n.positive),
                       negative: moment(at_n.negative) };
        /** @type {Object<string, any>} */
        const point = {
            index: i + 1,
            N_Ed: c.sign * p.n * 1000 / c.force,
            M_Ed: p.m * 1000 / c.moment,
            M_Ed_checked: p.m_mod * 1000 / c.moment,
            modified_by_min_eccentricity: p.modified,
            inside: p.inside,
            utilization: p.utilization,
            M_Rd_at_N_Ed: M_Rd,
            roles: meta[i].roles,
            source: meta[i].source,
        };
        if (!p.inside || (p.utilization !== null && p.utilization > 1)) {
            attention.push(reason('outside', { index: i + 1,
                                               utilization: p.utilization },
                                  c.language));
        }
        const d = meta[i].document_values;
        if (d !== undefined) {
            /** @type {Object<string, any>} */
            const comparison = { source: d.source };
            if (d.M_Rd !== undefined) {
                // the side of the moment stated in the documents
                const positive = (d.M_Rd !== 0) ? d.M_Rd > 0
                                                : point.M_Ed_checked >= 0;
                comparison.M_Rd = deviation(d.M_Rd, positive ? M_Rd.positive
                                                             : M_Rd.negative);
            }
            if (d.utilization !== undefined) {
                comparison.utilization = deviation(d.utilization, p.utilization);
            }
            point.comparison_with_documents = comparison;
        }
        return point;
    });

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
        assessment: assessment(missing, attention, 'no_finding', c.language),
        ...frame(section, presets),
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
            'curve, e.g. plain concrete). M_Rd_at_N_Ed: moment of the ' +
            'curve at N_Ed on both sides, null if N_Ed is beyond the curve. ' +
            'comparison_with_documents: value of the documents, value of ' +
            'the tool and the deviation in % of the tool (no limit, the ' +
            'reviewer decides).',
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

/**
 * Tool check_loads: for every load point inside / outside and the radial
 * utilization, as in the app, the governing point, and the comparison
 * with the values of the documents.
 * @param {LoadArgs} args
 * @returns {Object<string, any>}
 */
export function check_loads(args) {
    const section = section_of(args);
    const c = section.c;

    /** @type {string[]} */
    const errors = [];
    if (!Array.isArray(args.loads) || args.loads.length === 0) {
        errors.push('loads: at least one load point {N, M, source} is required.');
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
    const of_loads = load_sources(loads, c.language, errors);
    if (errors.length > 0) {
        throw new ToolInputError(errors);
    }

    // to the units and the sign of the app: kN, kNm, compression negative
    const app_loads = {
        x: loads.map(p => p.M * c.moment),
        y: loads.map(p => c.sign * p.N * c.force),
        per_metre: false,
    };
    const meta = loads.map(p => ({
        source: p.source,
        roles: (p.role !== undefined) ? [p.role] : [],
        document_values: p.document_values,
    }));
    return evaluated(section, args, app_loads, meta, of_loads);
}

/**
 * Tool check_loads_file: the load points of a table (.xlsx) read with
 * the import of the app, all rows. The envelope roles are set by the
 * tool: the points with the largest and smallest N and M (sign
 * convention of the call).
 * @param {FileArgs} args
 * @returns {Object<string, any>}
 */
export function check_loads_file(args) {
    const section = section_of(args);
    const c = section.c;

    /** @type {string[]} */
    const errors = [];
    const file = args.file;
    if (typeof file !== 'string' || !isAbsolute(file) ||
        !file.toLowerCase().endsWith('.xlsx')) {
        errors.push('file: the absolute path of an .xlsx file is required.');
    }
    const source = check_source('file_source', args.file_source, errors, true);
    if (errors.length > 0) {
        throw new ToolInputError(errors);
    }

    /** @type {Uint8Array} */
    let data;
    try {
        data = readFileSync(/** @type {string} */ (file));
    } catch (error) {
        throw new ToolInputError([`file: cannot be read (${String(error)}).`]);
    }
    /** @type {[number[], number[], boolean]} */
    let table;
    try {
        table = read(data, XLSX);
    } catch (error) {
        throw new ToolInputError([error_text(error, c.t)]);
    }
    const [x, y, per_metre] = table;

    /** @type {import('./sources.js').Notes} */
    const of_loads = { missing: [], attention: [], language: c.language };
    const file_source = /** @type {import('./sources.js').LoadSource} */ (source);
    note_kind(reason('load_points', {}, c.language), file_source, of_loads);

    // roles: largest and smallest N and M in the convention of the call;
    // gamma_d and the width do not change the order
    const n_call = y.map(value => c.sign * value);
    /**
     * Index of the best value of a list.
     * @param {number[]} list
     * @param {(a: number, b: number) => boolean} better
     * @returns {number}
     */
    const pick = (list, better) => list.reduce(
        (best, value, i) => better(value, list[best]) ? i : best, 0);
    /** @type {Object<string, number>} */
    const chosen = {
        max_N: pick(n_call, (a, b) => a > b),
        min_N: pick(n_call, (a, b) => a < b),
        max_M: pick(x, (a, b) => a > b),
        min_M: pick(x, (a, b) => a < b),
    };
    const meta = x.map((_, i) => ({
        source: file_source,
        roles: ENVELOPE_ROLES.filter(role => chosen[role] === i),
    }));

    const answer = evaluated(section, args, { x: x, y: y, per_metre: per_metre },
                             meta, of_loads);
    return {
        ...answer,
        file: {
            path: file,
            rows_read: x.length,
            per_metre: per_metre,
            note: 'First sheet, columns n and m as in the app (compression ' +
                'negative, M as in the file); per metre values are ' +
                'multiplied by b. index = n-th row with values, empty rows ' +
                'are skipped.',
        },
    };
}
