// @ts-check
/*
Interface of the interaction diagram
Replaces legacy App.py (Dash). Runs in the browser only, no server.

The functions in the first part do not touch the page, so they can be
tested with node. start() connects them to index.html.

All texts come from the table of the chosen language (i18n.js): the
functions get a translator t, messages are keys with parameters.
*/
import { int_diagram, min_eccentricity_moments } from './core.js';
import { cult_I_details, cult_I_min_eccentricity } from './cult_i.js';
import { radial_utilization, origin_inside } from './utilization.js';
import { read } from './xls_read.js';
import { load_points } from './loads.js';
import { figure, draw, cult_text, min_cult_I, max_utilization } from './draw.js';
import { en1992 } from './norms/en1992.js';
import { sia262, eta_fc, ETA_T_CHOICE } from './norms/sia262.js';
import { TextError } from './errors.js';
import { translator, default_language, LANGUAGES } from './i18n.js';

/** @typedef {import('./core.js').InputParams} InputParams */
/** @typedef {import('./core.js').InputValues} InputValues */
/** @typedef {import('./core.js').Values} Values */
/** @typedef {import('./norms/en1992.js').Norm} Norm */
/** @typedef {import('./draw.js').LoadPoint} LoadPoint */
/** @typedef {import('./draw.js').PlotlyLibrary} PlotlyLibrary */
/** @typedef {import('./xls_read.js').XlsxLibrary} XlsxLibrary */
/** @typedef {import('./i18n.js').Translator} Translator */
/** @typedef {import('./errors.js').TextMessage} TextMessage */

/** The norms of the landing page, by the name in the address (#sia262). */
export const NORMS = /** @type {Object<string, Norm>} */ ({
    sia262: sia262,
    en1992: en1992,
});

/**
 * Input as typed by the user. Numbers are still text.
 * @typedef {Object} RawInputs
 * @property {string} h_
 * @property {string} b_
 * @property {string} d_1
 * @property {string} d_2
 * @property {string} a_s1
 * @property {string} a_s2
 * @property {string} f_ck
 * @property {string} f_yk
 * @property {string} gamma_c
 * @property {string} gamma_s
 * @property {string} gamma_d  no preset, has to be entered
 * @property {string} alpha_cc  EN only
 * @property {string} alpha_cc_pl  EN only
 * @property {string} eta_t  SIA only, '' as long as nothing is chosen
 * @property {boolean} eccentricity  EN only
 * @property {boolean} cult  show CULT-I (optional)
 * @property {boolean} radial  show the radial utilization
 */

/**
 * A message of the check of the inputs: a key of the texts in i18n.js
 * with its parameters, not a finished text.
 * @typedef {Object} Message
 * @property {string} field  name of the input, '' if it is not a single one
 * @property {string} key  key of the text
 * @property {Object<string, any>} [params]
 * @property {boolean} [missing]  true: the input is empty (not wrong)
 */

/**
 * Load values as read from a file.
 * @typedef {Object} Loads
 * @property {number[]} x  moments, [kNm] or [kNm/m]
 * @property {number[]} y  normal forces, [kN] or [kN/m]
 * @property {boolean} per_metre  true: values per metre (Plaxis 2D)
 * @property {string} name  name of the file
 */

/**
 * What is shown for the load points besides inside / outside.
 * @typedef {Object} Shown
 * @property {boolean} [cult]  CULT-I with its intermediate values
 * @property {boolean} [radial]  the radial utilization
 * @property {boolean} [eccentricity]  the moment with the minimum eccentricity
 */

// all inputs that are typed as text
const TEXT_FIELDS = ['h_', 'b_', 'd_1', 'd_2', 'a_s1', 'a_s2', 'f_ck', 'f_yk',
                     'gamma_c', 'gamma_s', 'gamma_d', 'alpha_cc', 'alpha_cc_pl'];
// the inputs of the cross-section and of the materials (the first two
// groups of the form); a change of one of them ends the example
export const SECTION_FIELDS = ['h_', 'b_', 'a_s1', 'd_1', 'a_s2', 'd_2',
                               'f_ck', 'f_yk', 'gamma_c', 'gamma_s',
                               'alpha_cc', 'alpha_cc_pl', 'eta_t'];

// numbers inside the fixed texts of the page: [number, digits]
const TEXT_PARAMS = /** @type {Object<string, Object<string, any>>} */ ({
    'label.alpha_cc': { low: [0.8, 1], high: [1.0, 1] },
    'label.gamma_d': { one: [1.0, 1] },
    'eta_t.help': { suggestion: [0.85, 2], impact: [1.2, 1] },
});

/**
 * Number from the text of an input. Decimal point or decimal comma,
 * as in legacy App.py (type_casting), in every language of the
 * interface. Anything else is not a number.
 * @param {string} text
 * @returns {number} NaN if the text is not a number
 */
export function parse_number(text) {
    const trimmed = text.trim();
    if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(trimmed)) {
        return NaN;
    }
    return Number(trimmed.replace(',', '.'));
}

/**
 * The text of an input written again with the decimal sign of the
 * interface, when the user leaves the field. Only the sign changes: the
 * value and the number of digits stay as typed. Text that is not a
 * number is not touched.
 * @param {string} text
 * @param {string} decimal  ',' or '.'
 * @returns {string}
 */
export function rewrite_number(text, decimal) {
    if (Number.isNaN(parse_number(text))) {
        return text;
    }
    return text.trim().replace(/[.,]/, decimal);
}

/**
 * Values of the button «Beispiel laden» / «Load example»: the
 * placeholders of the inputs as real values. They are written into the
 * fields, so the user sees what is calculated; nothing is calculated
 * with placeholders.
 */
export const EXAMPLE = /** @type {Object<string, string>} */ ({
    h_: '0.35', b_: '1.0', a_s1: '2.58', d_1: '0.03', a_s2: '2.58', d_2: '0.03',
    f_ck: '30', f_yk: '500', eta_t: '0.85', gamma_d: '1.0',
});

/**
 * Where the input comes from. The result is marked as an example only
 * if the button «Beispiel laden» wrote the values; the values themselves
 * are never compared. Typed values are never marked, whatever they are.
 * @typedef {Object} ExampleState
 * @property {boolean} marked  the values were written by the button
 * @property {RawInputs | null} before  the input before the button was
 *     used, null: nothing to undo
 */

/** State at the start: nothing loaded, nothing to undo. */
export const NO_EXAMPLE = /** @type {ExampleState} */ (
    Object.freeze({ marked: false, before: null }));

/**
 * The button «Beispiel laden» was used: the result is marked.
 * @param {ExampleState} state
 * @param {RawInputs} raw  the input before the example is written
 * @returns {ExampleState}
 */
export function example_loaded(state, raw) {
    if (state.marked) {
        // loaded a second time: undo still leads to the input of the user
        return { marked: true, before: state.before };
    }
    return { marked: true, before: has_inputs(raw) ? raw : null };
}

/**
 * The user changed an input. A change of the cross-section or of the
 * materials ends the mark; any change ends the offer to undo.
 * @param {ExampleState} state
 * @param {string} field  name of the input
 * @returns {ExampleState}
 */
export function example_edited(state, field) {
    return { marked: state.marked && !SECTION_FIELDS.includes(field),
             before: null };
}

/**
 * «Rückgängig» was used: the input before the example is back (the page
 * writes state.before into the fields), without the mark.
 * @param {ExampleState} state
 * @returns {ExampleState}
 */
export function example_undone(state) {
    return NO_EXAMPLE;
}

/**
 * Was anything entered in the fields that the example overwrites?
 * Only then the example button offers to undo it.
 * @param {RawInputs} raw
 * @returns {boolean}
 */
export function has_inputs(raw) {
    const fields = /** @type {Object<string, any>} */ (raw);
    return Object.keys(EXAMPLE).some(field => fields[field].trim() !== '');
}

/**
 * The messages that are shown. An empty input is not an error as long as
 * the user has not been in the field: it is shown only after the field
 * was left, or when a file is loaded and the value is needed.
 * @param {Message[]} messages  from check_inputs
 * @param {Set<string>} touched  names of the inputs the user has left
 * @param {boolean} has_file  load points are loaded
 * @returns {Message[]}
 */
export function shown_messages(messages, touched, has_file) {
    return messages.filter(message =>
        !message.missing || has_file || touched.has(message.field));
}

/**
 * Text of a message in the chosen language.
 * @param {Message | TextMessage} message
 * @param {Translator} t
 * @returns {string}
 */
export function message_text(message, t) {
    const params = { ...message.params };
    if ('field' in message && message.field !== '' && message.field !== 'eta_t') {
        // name of the input, e.g. «Höhe h» / «Height h»
        params['name'] = t('name.' + message.field);
    }
    if (params['message'] !== undefined) {
        // a message of the norm inside the message
        params['text'] = message_text(params['message'], t);
    }
    return t(message.key, params);
}

/**
 * Text of an error in the chosen language.
 * @param {unknown} error
 * @param {Translator} t
 * @returns {string}
 */
export function error_text(error, t) {
    if (error instanceof TextError) {
        return t(error.key, error.params);
    }
    return (error instanceof Error) ? error.message : String(error);
}

/**
 * Check the input before every calculation (N5 in NOTES.md).
 * Invalid input is rejected with a message, nothing is corrected.
 * @param {RawInputs} raw
 * @param {Norm} norm
 * @returns {{params: InputParams, messages: Message[]}}
 *     params is complete only if there are no messages
 */
export function check_inputs(raw, norm) {
    /** @type {Message[]} */
    const messages = [];
    /** @type {Object<string, number>} */
    const numbers = {};

    const fields = ['h_', 'b_', 'd_1', 'd_2', 'a_s1', 'a_s2',
                    'f_ck', 'f_yk', 'gamma_c', 'gamma_s', 'gamma_d'];
    if (norm.inputs.includes('alpha_cc')) {
        fields.push('alpha_cc', 'alpha_cc_pl');
    }
    for (const field of fields) {
        const text = /** @type {Object<string, any>} */ (raw)[field];
        if (text.trim() === '') {
            if (field === 'gamma_d') {
                // required, no preset
                messages.push({ field: field, missing: true,
                                key: 'check.gamma_d_missing',
                                params: { one: [1.0, 1] } });
            } else {
                messages.push({ field: field, missing: true,
                                key: 'check.missing' });
            }
            continue;
        }
        const value = parse_number(text);
        if (Number.isNaN(value)) {
            messages.push({ field: field, key: 'check.not_a_number',
                            params: { text: text.trim() } });
            continue;
        }
        numbers[field] = value;
    }

    // limits that do not depend on the norm
    for (const field of ['h_', 'b_', 'f_ck', 'f_yk', 'gamma_c', 'gamma_s',
                         'gamma_d', 'alpha_cc_pl']) {
        if (field in numbers && numbers[field] <= 0) {
            messages.push({ field: field, key: 'check.positive',
                            params: { value: numbers[field] } });
        }
    }
    for (const field of ['d_1', 'd_2', 'a_s1', 'a_s2']) {
        if (field in numbers && numbers[field] < 0) {
            messages.push({ field: field, key: 'check.not_negative',
                            params: { value: numbers[field] } });
        }
    }
    for (const field of ['d_1', 'd_2']) {
        if (field in numbers && 'h_' in numbers &&
            numbers[field] >= numbers['h_']) {
            messages.push({ field: field, key: 'check.below_height',
                            params: { value: numbers[field],
                                      h: numbers['h_'] } });
        }
    }

    /** @type {number | undefined} */
    let eta_t = undefined;
    let norm_inputs_complete = true;
    if (norm.inputs.includes('eta_t')) {
        if (raw.eta_t === '') {
            // no silent preset (SIA 262 4.2.1.3)
            messages.push({ field: 'eta_t', missing: true,
                            key: 'check.eta_t_missing', params: ETA_T_CHOICE });
            norm_inputs_complete = false;
        } else {
            eta_t = parse_number(raw.eta_t);
        }
    }
    if (norm.inputs.includes('alpha_cc') && !('alpha_cc' in numbers)) {
        norm_inputs_complete = false;
    }

    // limits of the norm
    if (norm_inputs_complete && 'f_ck' in numbers && 'f_yk' in numbers &&
        'gamma_c' in numbers && 'gamma_s' in numbers) {
        const norm_messages = norm.check({
            f_ck: numbers['f_ck'], f_yk: numbers['f_yk'],
            gamma_c: numbers['gamma_c'], gamma_s: numbers['gamma_s'],
            alpha_cc: numbers['alpha_cc'], alpha_cc_pl: numbers['alpha_cc_pl'],
            eta_t: eta_t,
        });
        for (const message of norm_messages) {
            messages.push({ field: '', key: 'check.norm',
                            params: { norm: norm.name, message: message } });
        }
    }

    /** @type {InputParams} */
    const params = {
        h_: numbers['h_'], b_: numbers['b_'],
        d_1: numbers['d_1'], d_2: numbers['d_2'],
        a_s1: numbers['a_s1'], a_s2: numbers['a_s2'],
        f_ck: numbers['f_ck'], f_yk: numbers['f_yk'],
        gamma_c: numbers['gamma_c'], gamma_s: numbers['gamma_s'],
        gamma_d: numbers['gamma_d'],
        // the minimum eccentricity exists in the EN mode only
        eccentricity: norm.min_eccentricity !== null && raw.eccentricity,
    };
    if (norm.inputs.includes('alpha_cc')) {
        params.alpha_cc = numbers['alpha_cc'];
        params.alpha_cc_pl = numbers['alpha_cc_pl'];
    }
    if (norm.inputs.includes('eta_t')) {
        params.eta_t = eta_t;
    }
    return { params: params, messages: messages };
}

/**
 * @typedef {Object} Result
 * @property {InputValues} input_values
 * @property {Values} values
 * @property {LoadPoint[]} points  empty without a file
 * @property {number | null} e0  minimum eccentricity [m], null: not applied
 * @property {boolean} radial_defined  the radial utilization exists for
 *     this curve (the origin is inside of it)
 */

/**
 * The whole calculation: capacity curves, load points, radial
 * utilization, CULT-I. Whether a point is inside of the curve is always
 * determined.
 * @param {InputParams} params  checked input (check_inputs)
 * @param {Norm} norm
 * @param {Loads | null} loads  null: no file
 * @param {Shown} [shown]  calculate CULT-I, the radial utilization
 * @returns {Result}
 */
export function calculate(params, norm, loads, { cult = false, radial = false } = {}) {
    const result = int_diagram(params, norm);
    if (result === null) {
        // check_inputs rejects these cases before
        throw new TextError('app.inputs_invalid');
    }
    const [input_values, values] = result;
    const radial_defined = origin_inside(values);
    /**
     * Radial utilization of a load point; with the minimum eccentricity
     * at the modified moment(s), the larger value governs.
     * @param {number[]} moments
     * @param {number} n
     * @returns {number | null}
     */
    const utilization = (moments, n) => {
        if (!radial || !radial_defined) {
            return null;
        }
        /** @type {number | null} */
        let largest = null;
        for (const m of moments) {
            const value = radial_utilization(m, n, values);
            if (value !== null && (largest === null || value > largest)) {
                largest = value;
            }
        }
        return largest;
    };

    /** @type {number | null} */
    let e0 = null;
    if (norm.min_eccentricity !== null && params.eccentricity) {
        e0 = norm.min_eccentricity(/** @type {number} */ (params.h_));
    }

    /** @type {LoadPoint[]} */
    const points = [];
    if (loads !== null) {
        const [m, n] = load_points(loads.x, loads.y, loads.per_metre,
                                   /** @type {number} */ (params.b_),
                                   /** @type {number} */ (params.gamma_d));
        for (let i = 0; i < m.length; i++) {
            if (e0 !== null) {
                // EN 1992-1-1 6.1 (4), D1: the check uses the modified moment
                const moments = min_eccentricity_moments(m[i], n[i], e0);
                const modified = !(moments.length === 1 && moments[0] === m[i]);
                const check = cult_I_min_eccentricity(m[i], n[i], e0,
                                                      input_values, values);
                points.push({
                    m: m[i], n: n[i],
                    m_mod: check.m_governing,
                    modified: modified,
                    inside: check.details !== 'outside',
                    cult: cult ? check.details : null,
                    utilization: utilization(moments, n[i]),
                });
            } else {
                // also without CULT-I: is the point inside of the curve?
                const details = cult_I_details(m[i], n[i], values);
                points.push({
                    m: m[i], n: n[i],
                    m_mod: m[i],
                    modified: false,
                    inside: details !== 'outside',
                    cult: cult ? details : null,
                    utilization: utilization([m[i]], n[i]),
                });
            }
        }
    }
    return { input_values: input_values, values: values,
             points: points, e0: e0, radial_defined: radial_defined };
}

/**
 * Value of a cell for sorting: a number, a text, or null for an empty
 * cell (e.g. CULT-I of a point outside of the curve).
 * @typedef {number | string | null} SortKey
 */

/**
 * Head and rows of the table of the load points, in kN and kNm.
 * The intermediate values of CULT-I are shown so that the index can be
 * checked by hand.
 * @param {LoadPoint[]} points
 * @param {Translator} t
 * @param {Shown} [shown]  which columns are shown
 * @returns {{head: string[], head_keys: string[], rows: string[][],
 *            marks: string[], keys: SortKey[][]}}
 *     head_keys: keys of the texts of the head (the same in all languages);
 *     marks: '' / 'outside' / 'above' (CULT-I > 1) for each row;
 *     keys: the value behind each cell, for sorting (sort_order)
 */
export function table(points, t,
                      { eccentricity = false, cult = false, radial = false } = {}) {
    const head_keys = ['table.nr', 'table.n', 'table.m'];
    if (eccentricity) {
        head_keys.push('table.m_mod');
    }
    if (radial) {
        head_keys.push('table.utilization');
    }
    if (cult) {
        head_keys.push('table.m_rel_i', 'table.n_rel_i',
                       'table.m_rel_max', 'table.n_rel_max',
                       'table.m_ratio', 'table.n_ratio', 'table.cult');
    }
    head_keys.push('table.hint');
    /** @type {string[][]} */
    const rows = [];
    /** @type {SortKey[][]} */
    const keys = [];
    /** @type {string[]} */
    const marks = [];
    points.forEach((p, i) => {
        // the number of the point is the row of the file, it stays with
        // the point when the table is sorted
        const row = [String(i + 1), t.fmt(p.n * 1000, 1), t.fmt(p.m * 1000, 2)];
        /** @type {SortKey[]} */
        const key = [i + 1, p.n * 1000, p.m * 1000];
        if (eccentricity) {
            row.push(t.fmt(p.m_mod * 1000, 2));
            key.push(p.m_mod * 1000);
        }
        // inside or outside of the curve is always shown
        let mark = '';
        let hint = '';
        if (!p.inside) {
            hint = t('table.outside');
            mark = 'outside';
        }
        if (radial) {
            // above 1 outside of the curve, not capped
            row.push((p.utilization === null) ? '' : t.fmt(p.utilization, 3));
            key.push(p.utilization);
        }
        if (cult) {
            if (p.cult === null || p.cult === 'outside') {
                row.push('', '', '', '', '', '',
                         (p.cult === null) ? '' : cult_text(p.cult, t));
                // no values: null is sorted to the end
                key.push(null, null, null, null, null, null, null);
            } else {
                if (p.cult.cult_I > 1) {
                    // the value is shown as it is, not capped
                    hint = t('table.above');
                    mark = 'above';
                }
                const m_ratio = p.cult.m_rel_i / p.cult.m_rel_max;
                const n_ratio = p.cult.n_rel_i / p.cult.n_rel_max;
                row.push(t.fmt(p.cult.m_rel_i * 1000, 2),
                         t.fmt(p.cult.n_rel_i * 1000, 1),
                         t.fmt(p.cult.m_rel_max * 1000, 2),
                         t.fmt(p.cult.n_rel_max * 1000, 1),
                         t.fmt(m_ratio, 3), t.fmt(n_ratio, 3),
                         cult_text(p.cult, t));
                key.push(p.cult.m_rel_i * 1000, p.cult.n_rel_i * 1000,
                         p.cult.m_rel_max * 1000, p.cult.n_rel_max * 1000,
                         m_ratio, n_ratio, p.cult.cult_I);
            }
        }
        row.push(hint);
        key.push((hint === '') ? null : hint);
        rows.push(row);
        keys.push(key);
        marks.push(mark);
    });
    return { head: head_keys.map(head_key => t(head_key)), head_keys: head_keys,
             rows: rows, marks: marks, keys: keys };
}

/**
 * Order of the rows of the table when it is sorted by one column.
 * Numbers are compared as numbers, not as text. Empty cells (null) are
 * always at the end, ascending and descending. Rows with the same value
 * keep the order of the file.
 * @param {SortKey[][]} keys  from table()
 * @param {number} column
 * @param {boolean} descending
 * @returns {number[]} indices of the rows in the new order
 */
export function sort_order(keys, column, descending) {
    const order = keys.map((_, i) => i);
    order.sort((a, b) => {
        const key_a = keys[a][column];
        const key_b = keys[b][column];
        if (key_a === null || key_b === null) {
            if (key_a === null && key_b === null) {
                return a - b;
            }
            return (key_a === null) ? 1 : -1;
        }
        let difference;
        if (typeof key_a === 'number' && typeof key_b === 'number') {
            difference = key_a - key_b;
        } else {
            difference = String(key_a).localeCompare(String(key_b));
        }
        if (difference === 0) {
            return a - b;
        }
        return descending ? -difference : difference;
    });
    return order;
}

/**
 * One line above the table: how many points are inside and outside of
 * the curve, the largest radial utilization and the smallest CULT-I of
 * the points inside.
 * @param {LoadPoint[]} points
 * @param {Translator} t
 * @param {Shown} [shown]
 * @returns {string}
 */
export function summary_text(points, t, { cult = false, radial = false } = {}) {
    if (points.length === 0) {
        return '';
    }
    const inside = points.filter(p => p.inside);
    const outside = points.length - inside.length;
    const parts = [t('summary.points', { total: points.length,
                                         inside: inside.length,
                                         outside: outside })];
    if (radial) {
        const largest_inside = max_utilization(inside);
        if (largest_inside !== null) {
            parts.push(t('summary.max_inside',
                         { value: t.fmt(largest_inside, 3) }));
        }
        const largest = max_utilization(points);
        if (outside > 0 && largest !== null) {
            parts.push(t('summary.max_all', { value: t.fmt(largest, 3) }));
        }
    }
    const smallest = min_cult_I(inside);
    if (cult && typeof smallest === 'number') {
        parts.push(t('summary.min_cult', { value: t.fmt(smallest, 3) }));
    }
    return parts.join(' ');
}

/**
 * Hints below the diagram: what was assumed and used.
 * @param {Norm} norm
 * @param {Result} result
 * @param {Loads | null} loads
 * @param {Translator} t
 * @param {Shown} [shown]
 * @returns {string[]}
 */
export function hints(norm, result, loads, t, { cult = false, radial = false } = {}) {
    const i_val = result.input_values;
    /** @type {string[]} */
    const list = [];
    const f_cd = t.fmt(i_val['f_cd'], 2);

    if (norm === sia262) {
        list.push(t(i_val['plain'] ? 'hint.f_cd_sia_plain' : 'hint.f_cd_sia', {
            eta_fc: t.fmt(eta_fc(i_val['f_ck']), 3), eta_t: i_val['eta_t'],
            f_ck: i_val['f_ck'], gamma_c: i_val['gamma_c'],
            factor: [0.8, 1], f_cd: f_cd }));
    } else {
        list.push(t(i_val['plain'] ? 'hint.f_cd_en_plain' : 'hint.f_cd_en', {
            alpha: i_val['plain'] ? i_val['alpha_cc_pl'] : i_val['alpha_cc'],
            f_ck: i_val['f_ck'], gamma_c: i_val['gamma_c'], f_cd: f_cd }));
    }
    if (i_val['plain']) {
        // decision D7
        list.push(t((norm === sia262) ? 'hint.plain_sia' : 'hint.plain_en'));
    }
    for (const note of norm.notes) {
        list.push(t(note));
    }
    if (norm === sia262) {
        // decision D5
        list.push(t('hint.pivot_c'));
    } else {
        list.push(t('norm.note.second_order'));
    }
    // decision D3: what the code allows, and the limit of this app
    list.push(t((norm === sia262) ? 'hint.steel.sia262' : 'hint.steel.en1992',
                { limit: t.fmt(norm.eps_s_max * 1000, 0) }));
    if (result.e0 !== null) {
        list.push(t('hint.min_eccentricity',
                    { e0: t.fmt(result.e0 * 1000, 1) }));
    }

    if (loads !== null) {
        list.push(t('hint.loads', { name: loads.name, count: loads.x.length,
                                    gamma_d: i_val['gamma_d'] }));
        if (loads.per_metre) {
            list.push(t('hint.per_metre', { b: i_val['b'] }));
        }
        list.push(t('hint.sign'));
        if (radial && !result.radial_defined) {
            // the origin is not inside of the curve, it ends there
            list.push(t('hint.radial_undefined'));
        } else if (radial) {
            list.push(t('hint.radial'));
            if (result.e0 !== null) {
                list.push(t('hint.radial_min_eccentricity'));
            }
            list.push(t('hint.radial_assumption'));
        }
        if (cult) {
            list.push(t('hint.cult'));
            const above = result.points.some(
                p => p.cult !== null && p.cult !== 'outside' && p.cult.cult_I > 1);
            if (above) {
                list.push(t('hint.cult_above'));
            }
        }
    }
    return list;
}

/**
 * Connect the functions above to the page (index.html).
 * @param {Object} libraries
 * @param {XlsxLibrary} libraries.XLSX  the SheetJS library
 * @param {PlotlyLibrary} libraries.Plotly  the Plotly library
 */
export function start({ XLSX, Plotly }) {
    /**
     * @param {string} id
     * @returns {HTMLElement}
     */
    const element = (id) => {
        const found = document.getElementById(id);
        if (found === null) {
            throw new Error(`index.html: element #${id} is missing`);
        }
        return found;
    };
    /**
     * @param {string} id
     * @returns {HTMLInputElement}
     */
    const input = (id) => /** @type {HTMLInputElement} */ (element(id));

    const landing = element('landing');
    const calculator = element('calculator');
    const form = /** @type {HTMLFormElement} */ (element('inputs'));
    const drop_zone = element('drop-zone');
    const file_input = input('file');
    const file_message = element('file-message');
    const messages_box = element('messages');
    const diagram = element('diagram');
    const hints_list = element('hints');
    const table_box = element('table');
    const summary = element('summary');
    const example_undo = element('example-undo');
    const example_note = element('example-note');

    // the language is kept for the next visit
    const STORAGE_KEY = 'interaction-diagram.language';
    /**
     * @returns {string}
     */
    function first_language() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored !== null && LANGUAGES.includes(stored)) {
                return stored;
            }
        } catch (error) {
            // no storage (e.g. private mode): the language of the browser
        }
        return default_language(window.navigator.language);
    }
    let t = translator(first_language());

    // were the values written by «Beispiel laden», and what was there before
    /** @type {ExampleState} */
    let example_state = NO_EXAMPLE;
    // names of the inputs the user has left
    /** @type {Set<string>} */
    const touched = new Set();
    // sorting of the table: key of the head of the column and direction
    let sort = { head_key: 'table.nr', descending: false };
    /** @type {Loads | null} */
    let loads = null;
    // what the line below the file input says: a message or an error
    /** @type {{message: TextMessage | null, error: unknown} | null} */
    let file_state = null;
    /** @type {Norm | null} */
    let norm = null;

    /**
     * @returns {RawInputs}
     */
    function raw_inputs() {
        const chosen = /** @type {HTMLInputElement | null} */ (
            form.querySelector('input[name="eta_t"]:checked'));
        return {
            h_: input('h_').value,
            b_: input('b_').value,
            d_1: input('d_1').value,
            d_2: input('d_2').value,
            a_s1: input('a_s1').value,
            a_s2: input('a_s2').value,
            f_ck: input('f_ck').value,
            f_yk: input('f_yk').value,
            gamma_c: input('gamma_c').value,
            gamma_s: input('gamma_s').value,
            gamma_d: input('gamma_d').value,
            alpha_cc: input('alpha_cc').value,
            alpha_cc_pl: input('alpha_cc_pl').value,
            eta_t: (chosen === null) ? '' : chosen.value,
            eccentricity: input('eccentricity').checked,
            cult: input('cult').checked,
            radial: input('radial').checked,
        };
    }

    /**
     * Fill a list or a box with one line of text per entry.
     * @param {HTMLElement} box
     * @param {string[]} lines
     * @param {string} tag
     */
    function fill(box, lines, tag) {
        box.replaceChildren(...lines.map(line => {
            const item = document.createElement(tag);
            item.textContent = line;
            return item;
        }));
    }

    /** The line below the file input, in the chosen language. */
    function show_file_state() {
        if (file_state === null) {
            file_message.textContent = '';
            file_message.className = '';
        } else if (file_state.message !== null) {
            file_message.textContent = message_text(file_state.message, t);
            file_message.className = '';
        } else {
            file_message.textContent = error_text(file_state.error, t);
            file_message.className = 'error';
        }
    }

    /**
     * @param {LoadPoint[]} points
     * @param {Shown} shown
     */
    function show_table(points, shown) {
        summary.textContent = summary_text(points, t, shown);
        if (points.length === 0) {
            table_box.replaceChildren();
            return;
        }
        const { head, head_keys, rows, marks, keys } = table(points, t, shown);
        // the column of the last click, if the table still has it
        let column = head_keys.indexOf(sort.head_key);
        if (column === -1) {
            sort = { head_key: 'table.nr', descending: false };
            column = 0;
        }
        const table_element = document.createElement('table');
        const head_row = table_element.createTHead().insertRow();
        head.forEach((text, i) => {
            const cell = document.createElement('th');
            // a button, so that the head can be used with the keyboard
            const button = document.createElement('button');
            button.type = 'button';
            button.title = t('table.sort');
            let arrow = '';
            if (i === column) {
                arrow = sort.descending ? ' ▼' : ' ▲';
                cell.setAttribute('aria-sort',
                                  sort.descending ? 'descending' : 'ascending');
            }
            button.textContent = text + arrow;
            button.addEventListener('click', () => {
                // first click ascending, second click descending
                sort = { head_key: head_keys[i],
                         descending: sort.head_key === head_keys[i] &&
                                     !sort.descending };
                show_table(points, shown);
            });
            cell.append(button);
            head_row.append(cell);
        });
        const body = table_element.createTBody();
        for (const i of sort_order(keys, column, sort.descending)) {
            const table_row = body.insertRow();
            if (marks[i] !== '') {
                table_row.className = marks[i];
            }
            for (const text of rows[i]) {
                table_row.insertCell().textContent = text;
            }
        }
        table_box.replaceChildren(table_element);
    }

    /**
     * Small screen: the legend is text below the diagram.
     * @returns {boolean}
     */
    function is_narrow() {
        return window.innerWidth < 700;
    }
    // the kind of legend of the diagram that is shown
    let drawn_narrow = is_narrow();

    /** Check the input, calculate and show everything. */
    function update() {
        if (norm === null) {
            return;
        }
        const raw = raw_inputs();
        const { params, messages } = check_inputs(raw, norm);

        // Mark the inputs with a message. An empty field is not marked
        // before the user has been in it (or a file needs the value).
        const shown = shown_messages(messages, touched, loads !== null);
        for (const field of form.querySelectorAll('.invalid')) {
            field.classList.remove('invalid');
        }
        for (const message of shown) {
            if (message.field === '') {
                continue;
            }
            const marked = (message.field === 'eta_t') ?
                element('eta_t') : input(message.field);
            marked.classList.add('invalid');
        }

        let texts = shown.map(message => message_text(message, t));
        let is_error = true;
        /** @type {Result | null} */
        let result = null;
        if (messages.length === 0) {
            try {
                result = calculate(params, norm, loads, raw);
            } catch (error) {
                texts = [error_text(error, t)];
            }
        } else if (shown.length === 0) {
            // values are still missing, nothing is wrong: a neutral hint
            texts = [t('messages.enter_values')];
            is_error = false;
        }
        fill(messages_box, texts, 'p');
        messages_box.className = is_error ? 'error' : 'info';
        messages_box.hidden = texts.length === 0;

        if (result === null) {
            // no result is shown for input that was rejected
            example_note.hidden = true;
            Plotly.purge(diagram);
            diagram.replaceChildren();
            diagram.hidden = true;
            hints_list.replaceChildren();
            show_table([], {});
            return;
        }
        const narrow = is_narrow();
        drawn_narrow = narrow;
        // The box has to have its size before Plotly draws: Plotly reads
        // the size of the box once, and takes 450 px for a height of 0.
        diagram.hidden = false;
        // example values are marked above the diagram and in the legend
        const example = example_state.marked;
        example_note.hidden = !example;
        const fig = figure(result.input_values, result.values, norm,
                           result.points, t,
                           { e0: result.e0, narrow: narrow, example: example });
        draw(Plotly, diagram, fig);
        let lines = hints(norm, result, loads, t, raw);
        if (narrow) {
            // small screen: the legend is shown as text
            lines = fig.legend_lines.concat(lines);
        }
        fill(hints_list, lines, 'li');
        show_table(result.points, {
            eccentricity: result.e0 !== null,
            cult: raw.cult,
            // no column for a value that is not defined for this curve
            radial: raw.radial && result.radial_defined,
        });
    }

    /**
     * Read the file with the load values.
     * @param {File} file
     */
    async function read_file(file) {
        try {
            if (!/\.xlsx$/i.test(file.name)) {
                throw new TextError('file.only_xlsx', { name: file.name });
            }
            const data = await file.arrayBuffer();
            const [x, y, per_metre] = read(data, XLSX);
            loads = { x: x, y: y, per_metre: per_metre, name: file.name };
            file_state = { error: null, message: {
                key: per_metre ? 'file.read_plaxis' : 'file.read',
                params: { name: file.name, count: x.length } } };
        } catch (error) {
            // a file that cannot be read replaces the old load points:
            // otherwise the diagram would show points of another file
            loads = null;
            file_state = { error: error, message: null };
        }
        show_file_state();
        update();
    }

    /**
     * All texts of the page in the chosen language. The values of the
     * inputs stay; only their decimal sign follows the language.
     */
    function apply_language() {
        document.documentElement.lang = t.lang;
        document.title = t('title');
        for (const node of document.querySelectorAll('[data-i18n]')) {
            const key = /** @type {HTMLElement} */ (node).dataset.i18n || '';
            node.textContent = t(key, TEXT_PARAMS[key]);
        }
        // placeholders: the example values
        for (const node of document.querySelectorAll('[data-example]')) {
            const field = /** @type {HTMLInputElement} */ (node);
            field.placeholder = t('placeholder', { value: rewrite_number(
                field.dataset.example || '', t.decimal) });
        }
        // numbers in fixed places, e.g. the options of eta_t
        for (const node of document.querySelectorAll('[data-number]')) {
            node.textContent = rewrite_number(
                /** @type {HTMLElement} */ (node).dataset.number || '', t.decimal);
        }
        for (const node of document.querySelectorAll('[data-language]')) {
            const button = /** @type {HTMLButtonElement} */ (node);
            const active = button.dataset.language === t.lang;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        }
        for (const field of TEXT_FIELDS) {
            input(field).value = rewrite_number(input(field).value, t.decimal);
        }
        if (norm !== null) {
            element('norm-name').textContent = t(norm.label);
        }
        show_file_state();
        update();
    }

    /** Show the landing page or the calculator of the norm in the address. */
    function route() {
        const key = window.location.hash.replace('#', '');
        norm = (key in NORMS) ? NORMS[key] : null;
        landing.hidden = norm !== null;
        calculator.hidden = norm === null;
        if (norm === null) {
            return;
        }
        element('norm-name').textContent = t(norm.label);
        // inputs of the other norm are hidden, their values are kept
        for (const group of form.querySelectorAll('[data-norm]')) {
            /** @type {HTMLElement} */ (group).hidden =
                /** @type {HTMLElement} */ (group).dataset.norm !== key;
        }
        // presets of the norm, only where nothing is entered yet
        for (const [field, value] of Object.entries(norm.defaults)) {
            if (input(field).value.trim() === '') {
                input(field).value = t.num(value);
            }
        }
        update();
    }

    for (const node of document.querySelectorAll('[data-language]')) {
        node.addEventListener('click', () => {
            const lang = /** @type {HTMLElement} */ (node).dataset.language || '';
            if (!LANGUAGES.includes(lang)) {
                return;
            }
            t = translator(lang);
            try {
                window.localStorage.setItem(STORAGE_KEY, lang);
            } catch (error) {
                // no storage: the choice holds for this visit only
            }
            apply_language();
        });
    }

    form.addEventListener('input', event => {
        // a change by the user: the values are no longer (only) the
        // example, and the offer to undo it ends
        const target = /** @type {HTMLInputElement} */ (event.target);
        example_state = example_edited(
            example_state, (target.type === 'radio') ? target.name : target.id);
        example_undo.hidden = true;
        update();
    });
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('focusout', event => {
        const target = /** @type {HTMLInputElement} */ (event.target);
        if (target.tagName !== 'INPUT') {
            return;
        }
        // from now on an empty field is an error
        touched.add((target.type === 'radio') ? target.name : target.id);
        if (target.type === 'text') {
            // decimal sign of the language; the value does not change
            target.value = rewrite_number(target.value, t.decimal);
        }
        update();
    });
    element('undo').addEventListener('click', () => {
        if (example_state.before === null) {
            return;
        }
        // all fields as they were, also eta_t and gamma_d
        const fields = /** @type {Object<string, any>} */ (example_state.before);
        for (const field of TEXT_FIELDS) {
            input(field).value = fields[field];
        }
        for (const radio of form.querySelectorAll('input[name="eta_t"]')) {
            /** @type {HTMLInputElement} */ (radio).checked =
                /** @type {HTMLInputElement} */ (radio).value === fields['eta_t'];
        }
        example_state = example_undone(example_state);
        example_undo.hidden = true;
        update();
    });
    element('example').addEventListener('click', () => {
        // filled in at once, without a question; if there was input
        // before, it can be brought back
        example_state = example_loaded(example_state, raw_inputs());
        example_undo.hidden = example_state.before === null;
        // the values are written into the fields, visible to the user
        for (const [field, value] of Object.entries(EXAMPLE)) {
            if (field === 'eta_t') {
                const radio = /** @type {HTMLInputElement | null} */ (
                    form.querySelector(`input[name="eta_t"][value="${value}"]`));
                if (radio !== null) {
                    radio.checked = true;
                }
            } else {
                input(field).value = rewrite_number(value, t.decimal);
            }
        }
        update();
    });

    // the button stands for the hidden file input of the browser
    element('choose-file').addEventListener('click', () => file_input.click());
    file_input.addEventListener('change', () => {
        if (file_input.files !== null && file_input.files.length > 0) {
            read_file(file_input.files[0]);
        }
        // the same file can be chosen again after a correction
        file_input.value = '';
    });
    for (const type of ['dragenter', 'dragover']) {
        drop_zone.addEventListener(type, event => {
            event.preventDefault();
            drop_zone.classList.add('over');
        });
    }
    for (const type of ['dragleave', 'drop']) {
        drop_zone.addEventListener(type, event => {
            event.preventDefault();
            drop_zone.classList.remove('over');
        });
    }
    drop_zone.addEventListener('drop', event => {
        const files = event.dataTransfer ? event.dataTransfer.files : null;
        if (files !== null && files.length > 0) {
            read_file(files[0]);
        }
    });
    element('remove-file').addEventListener('click', () => {
        loads = null;
        file_state = null;
        show_file_state();
        update();
    });

    // Plotly follows the size of the box itself (responsive); the kind of
    // legend is chosen here, so it is drawn again when the limit is passed
    window.addEventListener('resize', () => {
        if (is_narrow() !== drawn_narrow) {
            update();
        }
    });
    window.addEventListener('hashchange', route);
    route();
    apply_language();
}
