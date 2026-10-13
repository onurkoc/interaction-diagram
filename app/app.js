// @ts-check
/*
Interface of the interaction diagram
Replaces legacy App.py (Dash). Runs in the browser only, no server.

The functions in the first part do not touch the page, so they can be
tested with node. start() connects them to index.html.
*/
import { int_diagram, min_eccentricity_moments } from './core.js';
import { cult_I_details, cult_I_min_eccentricity } from './cult_i.js';
import { radial_utilization, origin_inside } from './utilization.js';
import { read } from './xls_read.js';
import { load_points } from './loads.js';
import { figure, draw, fmt, num, cult_text, min_cult_I, max_utilization }
    from './draw.js';
import { en1992 } from './norms/en1992.js';
import { sia262, eta_fc } from './norms/sia262.js';

/** @typedef {import('./core.js').InputParams} InputParams */
/** @typedef {import('./core.js').InputValues} InputValues */
/** @typedef {import('./core.js').Values} Values */
/** @typedef {import('./norms/en1992.js').Norm} Norm */
/** @typedef {import('./draw.js').LoadPoint} LoadPoint */
/** @typedef {import('./draw.js').PlotlyLibrary} PlotlyLibrary */
/** @typedef {import('./xls_read.js').XlsxLibrary} XlsxLibrary */

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
 * @typedef {Object} Message
 * @property {string} field  name of the input, '' if it is not a single one
 * @property {string} text
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

// names of the inputs for the messages
const LABELS = /** @type {Object<string, string>} */ ({
    h_: 'Höhe h',
    b_: 'Breite b',
    d_1: 'Achsabstand d_1',
    d_2: 'Achsabstand d_2',
    a_s1: 'Bewehrung a_s1',
    a_s2: 'Bewehrung a_s2',
    f_ck: 'f_ck',
    f_yk: 'f_yk',
    gamma_c: 'γ_c',
    gamma_s: 'γ_s',
    gamma_d: 'Lastfaktor γ_d',
    alpha_cc: 'α_cc',
    alpha_cc_pl: 'α_cc,pl',
});

/**
 * Number from the text of an input. Decimal point or decimal comma,
 * as in legacy App.py (type_casting). Anything else is not a number.
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
 * Values of the button «Beispiel laden»: the placeholders of the inputs
 * as real values. They are written into the fields, so the user sees
 * what is calculated; nothing is calculated with placeholders.
 */
export const EXAMPLE = /** @type {Object<string, string>} */ ({
    h_: '0.35', b_: '1.0', a_s1: '2.58', d_1: '0.03', a_s2: '2.58', d_2: '0.03',
    f_ck: '30', f_yk: '500', eta_t: '0.85', gamma_d: '1.0',
});

// all inputs that are typed as text
const TEXT_FIELDS = ['h_', 'b_', 'd_1', 'd_2', 'a_s1', 'a_s2', 'f_ck', 'f_yk',
                     'gamma_c', 'gamma_s', 'gamma_d', 'alpha_cc', 'alpha_cc_pl'];
// the inputs of the cross-section and of the materials
const SECTION_FIELDS = ['h_', 'b_', 'a_s1', 'd_1', 'a_s2', 'd_2', 'f_ck', 'f_yk'];

/**
 * Are the cross-section and the materials exactly the example values?
 * Then the result is marked as an example, not as values of a project.
 * The numbers are compared, not the text ("0,35" is "0.35").
 * @param {RawInputs} raw
 * @returns {boolean}
 */
export function is_example(raw) {
    const fields = /** @type {Object<string, any>} */ (raw);
    return SECTION_FIELDS.every(
        field => parse_number(fields[field]) === parse_number(EXAMPLE[field]));
}

/**
 * Was anything entered in the fields that the example overwrites?
 * Only then «Beispiel laden» offers to undo it.
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
                messages.push({ field: field, missing: true, text:
                    'Lastfaktor γ_d fehlt (Pflichtfeld ohne Vorgabe; ' +
                    '1,0, wenn Bemessungswerte importiert werden).' });
            } else {
                messages.push({ field: field, missing: true,
                                text: `${LABELS[field]} fehlt.` });
            }
            continue;
        }
        const value = parse_number(text);
        if (Number.isNaN(value)) {
            messages.push({ field: field, text:
                `${LABELS[field]}: «${text.trim()}» ist keine Zahl.` });
            continue;
        }
        numbers[field] = value;
    }

    // limits that do not depend on the norm
    for (const field of ['h_', 'b_', 'f_ck', 'f_yk', 'gamma_c', 'gamma_s',
                         'gamma_d', 'alpha_cc_pl']) {
        if (field in numbers && numbers[field] <= 0) {
            messages.push({ field: field, text:
                `${LABELS[field]} = ${num(numbers[field])}: muss grösser als 0 sein.` });
        }
    }
    for (const field of ['d_1', 'd_2', 'a_s1', 'a_s2']) {
        if (field in numbers && numbers[field] < 0) {
            messages.push({ field: field, text:
                `${LABELS[field]} = ${num(numbers[field])}: darf nicht negativ sein.` });
        }
    }
    for (const field of ['d_1', 'd_2']) {
        if (field in numbers && 'h_' in numbers &&
            numbers[field] >= numbers['h_']) {
            messages.push({ field: field, text:
                `${LABELS[field]} = ${num(numbers[field])} m: muss kleiner ` +
                `als die Höhe h = ${num(numbers['h_'])} m sein.` });
        }
    }

    /** @type {number | undefined} */
    let eta_t = undefined;
    let norm_inputs_complete = true;
    if (norm.inputs.includes('eta_t')) {
        if (raw.eta_t === '') {
            // no silent preset (SIA 262 4.2.1.3)
            messages.push({ field: 'eta_t', missing: true, text:
                'η_t fehlt: bitte 1,0 / 0,85 / 1,2 wählen (SIA 262 4.2.1.3).' });
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
        for (const text of norm_messages) {
            messages.push({ field: '', text: `${norm.name}: ${text}` });
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
 * @param {boolean} with_cult  calculate CULT-I
 * @param {boolean} [with_radial]  calculate the radial utilization
 * @returns {Result}
 */
export function calculate(params, norm, loads, with_cult, with_radial = false) {
    const result = int_diagram(params, norm);
    if (result === null) {
        // check_inputs rejects these cases before
        throw new Error('Die Eingaben sind unzulässig.');
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
        if (!with_radial || !radial_defined) {
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
                    cult: with_cult ? check.details : null,
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
                    cult: with_cult ? details : null,
                    utilization: utilization([m[i]], n[i]),
                });
            }
        }
    }
    return { input_values: input_values, values: values,
             points: points, e0: e0, radial_defined: radial_defined };
}

/**
 * Head and rows of the table of the load points, in kN and kNm.
 * The intermediate values of CULT-I are shown so that the index can be
 * checked by hand.
 * @param {LoadPoint[]} points
 * @param {boolean} with_eccentricity  show the modified moment
 * @param {boolean} with_cult  show CULT-I with its intermediate values
 * @param {boolean} [with_radial]  show the radial utilization
 * @returns {{head: string[], rows: string[][], marks: string[],
 *            keys: SortKey[][]}}
 *     marks: '' / 'outside' / 'above' (CULT-I > 1) for each row;
 *     keys: the value behind each cell, for sorting (sort_order)
 */
export function table(points, with_eccentricity, with_cult, with_radial = false) {
    const head = ['Nr.', 'N_Ed [kN]', 'M_Ed [kNm]'];
    if (with_eccentricity) {
        head.push('M_Ed,mod [kNm]');
    }
    if (with_radial) {
        head.push('Ausnutzung radial');
    }
    if (with_cult) {
        head.push('M_rel,i [kNm]', 'N_rel,i [kN]',
                  'M_rel,max [kNm]', 'N_rel,max [kN]',
                  'M_rel,i / M_rel,max', 'N_rel,i / N_rel,max',
                  'CULT-I');
    }
    head.push('Hinweis');
    /** @type {string[][]} */
    const rows = [];
    /** @type {SortKey[][]} */
    const keys = [];
    /** @type {string[]} */
    const marks = [];
    points.forEach((p, i) => {
        // the number of the point is the row of the file, it stays with
        // the point when the table is sorted
        const row = [String(i + 1), fmt(p.n * 1000, 1), fmt(p.m * 1000, 2)];
        /** @type {SortKey[]} */
        const key = [i + 1, p.n * 1000, p.m * 1000];
        if (with_eccentricity) {
            row.push(fmt(p.m_mod * 1000, 2));
            key.push(p.m_mod * 1000);
        }
        // inside or outside of the curve is always shown
        let mark = '';
        let hint = '';
        if (!p.inside) {
            hint = 'Punkt ausserhalb der Kurve';
            mark = 'outside';
        }
        if (with_radial) {
            // above 1 outside of the curve, not capped
            row.push((p.utilization === null) ? '' : fmt(p.utilization, 3));
            key.push(p.utilization);
        }
        if (with_cult) {
            if (p.cult === null || p.cult === 'outside') {
                row.push('', '', '', '', '', '',
                         (p.cult === null) ? '' : cult_text(p.cult));
                // no values: null is sorted to the end
                key.push(null, null, null, null, null, null, null);
            } else {
                if (p.cult.cult_I > 1) {
                    // the value is shown as it is, not capped
                    hint = 'CULT-I > 1, siehe Hinweis';
                    mark = 'above';
                }
                const m_ratio = p.cult.m_rel_i / p.cult.m_rel_max;
                const n_ratio = p.cult.n_rel_i / p.cult.n_rel_max;
                row.push(fmt(p.cult.m_rel_i * 1000, 2),
                         fmt(p.cult.n_rel_i * 1000, 1),
                         fmt(p.cult.m_rel_max * 1000, 2),
                         fmt(p.cult.n_rel_max * 1000, 1),
                         fmt(m_ratio, 3), fmt(n_ratio, 3),
                         cult_text(p.cult));
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
    return { head: head, rows: rows, marks: marks, keys: keys };
}

/**
 * Value of a cell for sorting: a number, a text, or null for an empty
 * cell (e.g. CULT-I of a point outside of the curve).
 * @typedef {number | string | null} SortKey
 */

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
            difference = String(key_a).localeCompare(String(key_b), 'de');
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
 * @param {boolean} with_cult
 * @param {boolean} [with_radial]
 * @returns {string}
 */
export function summary_text(points, with_cult, with_radial = false) {
    if (points.length === 0) {
        return '';
    }
    const inside = points.filter(p => p.inside);
    const outside = points.length - inside.length;
    let text = `${points.length} Lastpunkte (Bemessungswerte): ` +
        `${inside.length} innerhalb, ${outside} ausserhalb der Kurve.`;
    if (with_radial) {
        const largest_inside = max_utilization(inside);
        if (largest_inside !== null) {
            text += ' Grösste Ausnutzung radial der Punkte innerhalb: ' +
                `${fmt(largest_inside, 3)}.`;
        }
        const largest = max_utilization(points);
        if (outside > 0 && largest !== null) {
            text += ` Grösste Ausnutzung radial aller Punkte: ${fmt(largest, 3)}.`;
        }
    }
    const smallest = min_cult_I(inside);
    if (with_cult && typeof smallest === 'number') {
        text += ` Kleinstes CULT-I der Punkte innerhalb: ${fmt(smallest, 3)}.`;
    }
    return text;
}

/**
 * Hints below the diagram: what was assumed and used.
 * @param {Norm} norm
 * @param {Result} result
 * @param {Loads | null} loads
 * @param {boolean} with_cult
 * @param {boolean} [with_radial]
 * @returns {string[]}
 */
export function hints(norm, result, loads, with_cult, with_radial = false) {
    const i_val = result.input_values;
    /** @type {string[]} */
    const list = [];

    if (norm === sia262) {
        list.push(`f_cd = η_fc · η_t · f_ck / γ_c = ` +
                  `${fmt(eta_fc(i_val['f_ck']), 3)} · ${num(i_val['eta_t'])} · ` +
                  `${num(i_val['f_ck'])} / ${num(i_val['gamma_c'])}` +
                  (i_val['plain'] ? ' · 0,8' : '') +
                  ` = ${fmt(i_val['f_cd'], 2)} N/mm²`);
    } else {
        const alpha = i_val['plain'] ? i_val['alpha_cc_pl'] : i_val['alpha_cc'];
        list.push(`f_cd = ${i_val['plain'] ? 'α_cc,pl' : 'α_cc'} · f_ck / γ_c = ` +
                  `${num(alpha)} · ${num(i_val['f_ck'])} / ${num(i_val['gamma_c'])}` +
                  ` = ${fmt(i_val['f_cd'], 2)} N/mm²`);
    }
    if (i_val['plain']) {
        // decision D7
        if (norm === sia262) {
            list.push('Unbewehrter Querschnitt: f_cd abgemindert ' +
                      '(SIA 197 7.6.2.2).');
        } else {
            list.push('Unbewehrter Querschnitt: f_cd abgemindert; ' +
                      'Begrenzung der Lastausmitte (EN 12.6.2) wird ' +
                      'nicht geprüft.');
        }
    }
    for (const note of norm.notes) {
        list.push(note + '.');
    }
    if (norm === sia262) {
        // decision D5
        list.push('Drehpunkt C der Dehnungsebenen: konservative Annahme ' +
                  'analog EN 1992-1-1 6.1 (5), nicht aus SIA 262.');
    } else {
        list.push('Querschnittswiderstand ohne Effekte 2. Ordnung.');
    }
    // decision D3
    list.push(`Betonstahl ideal plastisch, Stahldehnung auf ` +
              `${fmt(norm.eps_s_max * 1000, 0)} ‰ begrenzt ` +
              '(zulässig, nicht normbegründet).');
    if (result.e0 !== null) {
        list.push(`Mindestausmitte e0 = max(h/30; 20 mm) = ` +
                  `${fmt(result.e0 * 1000, 1)} mm (EN 1992-1-1 6.1 (4)): ` +
                  'Lastpunkte mit Druck werden mit M_Ed,mod = ' +
                  'max(|M_Ed|; e0·|N_Ed|) geprüft, bei M_Ed = 0 beide ' +
                  'Vorzeichen. Die Widerstandskurve bleibt unverändert.');
    }

    if (loads !== null) {
        list.push(`Lastpunkte aus «${loads.name}»: ${loads.x.length} Punkte, ` +
                  `mit γ_d = ${num(i_val['gamma_d'])} multipliziert.`);
        if (loads.per_metre) {
            list.push('Plaxis-Tabelle mit Werten pro Meter [kN/m, kNm/m]: ' +
                      `mit der Breite b = ${num(i_val['b'])} m multipliziert.`);
        }
        list.push('Vorzeichen: N negativ = Druck. Das Vorzeichen von M wird ' +
                  'wie in der Datei übernommen, nichts wird umgekehrt. ' +
                  'Positives M: Zug auf der Seite von a_s1 (Achsabstand d_1); ' +
                  'negatives M: Zug auf der Seite von a_s2. Bei Plaxis hängt ' +
                  'das Vorzeichen von M von der lokalen Achse der Platte ab; ' +
                  'bei a_s1 ≠ a_s2 oder d_1 ≠ d_2 die Zuordnung prüfen.');
        if (with_radial && !result.radial_defined) {
            // the origin is not inside of the curve, it ends there
            list.push('Ausnutzung radial bei unbewehrtem Querschnitt ' +
                      'nicht definiert.');
        } else if (with_radial) {
            list.push('Ausnutzung radial = |S_d| / |R_d| auf dem Strahl vom ' +
                      'Ursprung durch den Lastpunkt: 1 = Punkt auf der Kurve, ' +
                      'über 1 = ausserhalb (nicht gekappt).' +
                      ((result.e0 !== null) ?
                          ' Mit Mindestausmitte am geprüften Punkt (M_Ed,mod).' :
                          ''));
            list.push('Ausnutzung radial setzt proportionale Laststeigerung ' +
                      'von N und M voraus.');
        }
        if (with_cult) {
            list.push('CULT-I ist ein Reserve-Index, keine Ausnutzung: ' +
                      '0 = Punkt auf der Kurve (Grenzzustand), grosse Werte = ' +
                      'grosse Reserve; 1 entspricht dem Zentrum der Kurve ' +
                      '(M = 0, Normalkraft des grössten Moments).');
            const above = result.points.some(
                p => p.cult !== null && p.cult !== 'outside' && p.cult.cult_I > 1);
            if (above) {
                list.push('CULT-I > 1 bei mindestens einem Punkt: N_rel,i ist ' +
                          'grösser als N_rel,max. Der Wert wird nicht gekappt.');
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
    // the input before «Beispiel laden», null: nothing to undo
    /** @type {RawInputs | null} */
    let before_example = null;
    // names of the inputs the user has left
    /** @type {Set<string>} */
    const touched = new Set();
    // sorting of the table: head of the column and direction
    let sort = { head: 'Nr.', descending: false };
    /** @type {Loads | null} */
    let loads = null;
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

    /**
     * @param {LoadPoint[]} points
     * @param {boolean} with_eccentricity
     * @param {boolean} with_cult
     * @param {boolean} with_radial
     */
    function show_table(points, with_eccentricity, with_cult, with_radial) {
        summary.textContent = summary_text(points, with_cult, with_radial);
        if (points.length === 0) {
            table_box.replaceChildren();
            return;
        }
        const { head, rows, marks, keys } = table(points, with_eccentricity,
                                                  with_cult, with_radial);
        // the column of the last click, if the table still has it
        let column = head.indexOf(sort.head);
        if (column === -1) {
            sort = { head: 'Nr.', descending: false };
            column = 0;
        }
        const table_element = document.createElement('table');
        const head_row = table_element.createTHead().insertRow();
        head.forEach((text, i) => {
            const cell = document.createElement('th');
            // a button, so that the head can be used with the keyboard
            const button = document.createElement('button');
            button.type = 'button';
            button.title = 'Sortieren';
            let arrow = '';
            if (i === column) {
                arrow = sort.descending ? ' ▼' : ' ▲';
                cell.setAttribute('aria-sort',
                                  sort.descending ? 'descending' : 'ascending');
            }
            button.textContent = text + arrow;
            button.addEventListener('click', () => {
                // first click ascending, second click descending
                sort = { head: text,
                         descending: sort.head === text && !sort.descending };
                show_table(points, with_eccentricity, with_cult, with_radial);
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

        let texts = shown.map(message => message.text);
        let is_error = true;
        /** @type {Result | null} */
        let result = null;
        if (messages.length === 0) {
            try {
                result = calculate(params, norm, loads, raw.cult, raw.radial);
            } catch (error) {
                texts = [(error instanceof Error) ? error.message : String(error)];
            }
        } else if (shown.length === 0) {
            // values are still missing, nothing is wrong: a neutral hint
            texts = ['Querschnitt und Baustoffe eingeben, dann erscheint ' +
                     'das Diagramm.'];
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
            hints_list.replaceChildren();
            show_table([], false, false, false);
            return;
        }
        const narrow = window.innerWidth < 700;
        // example values are marked above the diagram and in the legend
        const example = is_example(raw);
        example_note.hidden = !example;
        const fig = figure(result.input_values, result.values, norm,
                           result.points,
                           { e0: result.e0, narrow: narrow, example: example });
        draw(Plotly, diagram, fig);
        let lines = hints(norm, result, loads, raw.cult, raw.radial);
        if (narrow) {
            // small screen: the legend is shown as text
            lines = fig.legend_lines.concat(lines);
        }
        fill(hints_list, lines, 'li');
        // no column for a value that is not defined for this curve
        show_table(result.points, result.e0 !== null, raw.cult,
                   raw.radial && result.radial_defined);
    }

    /**
     * Read the file with the load values.
     * @param {File} file
     */
    async function read_file(file) {
        try {
            if (!/\.xlsx$/i.test(file.name)) {
                throw new Error(`«${file.name}»: Es werden nur Excel-Dateien ` +
                                '(.xlsx) gelesen.');
            }
            const data = await file.arrayBuffer();
            const [x, y, per_metre] = read(data, XLSX);
            loads = { x: x, y: y, per_metre: per_metre, name: file.name };
            file_message.textContent = `«${file.name}» gelesen: ` +
                `${x.length} Lastpunkte` +
                (per_metre ? ' (Plaxis, Werte pro Meter).' : '.');
            file_message.className = '';
        } catch (error) {
            // a file that cannot be read replaces the old load points:
            // otherwise the diagram would show points of another file
            loads = null;
            file_message.textContent = (error instanceof Error) ?
                error.message : String(error);
            file_message.className = 'error';
        }
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
        element('norm-name').textContent = norm.label;
        // inputs of the other norm are hidden, their values are kept
        for (const group of form.querySelectorAll('[data-norm]')) {
            /** @type {HTMLElement} */ (group).hidden =
                /** @type {HTMLElement} */ (group).dataset.norm !== key;
        }
        // presets of the norm, only where nothing is entered yet
        for (const [field, value] of Object.entries(norm.defaults)) {
            if (input(field).value.trim() === '') {
                input(field).value = num(value);
            }
        }
        update();
    }

    form.addEventListener('input', update);
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('focusout', event => {
        const target = /** @type {HTMLInputElement} */ (event.target);
        if (target.tagName !== 'INPUT') {
            return;
        }
        // from now on an empty field is an error
        touched.add((target.type === 'radio') ? target.name : target.id);
        if (target.type === 'text') {
            // decimal sign of the interface; the value does not change
            target.value = rewrite_number(target.value, ',');
        }
        update();
    });
    // a change by the user ends the offer to undo the example
    form.addEventListener('input', () => {
        before_example = null;
        example_undo.hidden = true;
    });
    element('undo').addEventListener('click', () => {
        if (before_example === null) {
            return;
        }
        // all fields as they were, also eta_t and gamma_d
        const fields = /** @type {Object<string, any>} */ (before_example);
        for (const field of TEXT_FIELDS) {
            input(field).value = fields[field];
        }
        for (const radio of form.querySelectorAll('input[name="eta_t"]')) {
            /** @type {HTMLInputElement} */ (radio).checked =
                /** @type {HTMLInputElement} */ (radio).value === fields['eta_t'];
        }
        before_example = null;
        example_undo.hidden = true;
        update();
    });
    element('example').addEventListener('click', () => {
        // filled in at once, without a question; if there was input
        // before, it can be brought back
        const before = raw_inputs();
        before_example = has_inputs(before) ? before : null;
        example_undo.hidden = before_example === null;
        // the values are written into the fields, visible to the user
        for (const [field, value] of Object.entries(EXAMPLE)) {
            if (field === 'eta_t') {
                const radio = /** @type {HTMLInputElement | null} */ (
                    form.querySelector(`input[name="eta_t"][value="${value}"]`));
                if (radio !== null) {
                    radio.checked = true;
                }
            } else {
                input(field).value = rewrite_number(value, ',');
            }
        }
        update();
    });

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
        file_message.textContent = '';
        update();
    });

    window.addEventListener('hashchange', route);
    route();
}
