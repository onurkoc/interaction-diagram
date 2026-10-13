// @ts-check
/*
Interface of the interaction diagram
Replaces legacy App.py (Dash). Runs in the browser only, no server.

The functions in the first part do not touch the page, so they can be
tested with node. start() connects them to index.html.
*/
import { int_diagram, min_eccentricity_moments } from './core.js';
import { cult_I_details, cult_I_min_eccentricity } from './cult_i.js';
import { read } from './xls_read.js';
import { load_points } from './loads.js';
import { figure, draw, fmt, num, cult_text, min_cult_I } from './draw.js';
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
 * @property {boolean} cult  calculate CULT-I
 */

/**
 * @typedef {Object} Message
 * @property {string} field  name of the input, '' if it is not a single one
 * @property {string} text
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
                messages.push({ field: field, text:
                    'Lastfaktor γ_d fehlt (Pflichtfeld ohne Vorgabe; ' +
                    '1,0, wenn Bemessungswerte importiert werden).' });
            } else {
                messages.push({ field: field,
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
            messages.push({ field: 'eta_t', text:
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
 */

/**
 * The whole calculation: capacity curves, load points, CULT-I.
 * @param {InputParams} params  checked input (check_inputs)
 * @param {Norm} norm
 * @param {Loads | null} loads  null: no file
 * @param {boolean} with_cult  calculate CULT-I
 * @returns {Result}
 */
export function calculate(params, norm, loads, with_cult) {
    const result = int_diagram(params, norm);
    if (result === null) {
        // check_inputs rejects these cases before
        throw new Error('Die Eingaben sind unzulässig.');
    }
    const [input_values, values] = result;

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
                });
            }
        }
    }
    return { input_values: input_values, values: values,
             points: points, e0: e0 };
}

/**
 * Head and rows of the table of the load points, in kN and kNm.
 * The intermediate values of CULT-I are shown so that the index can be
 * checked by hand.
 * @param {LoadPoint[]} points
 * @param {boolean} with_eccentricity  show the modified moment
 * @param {boolean} with_cult
 * @returns {{head: string[], rows: string[][], marks: string[]}}
 *     marks: '' / 'outside' / 'above' (CULT-I > 1) for each row
 */
export function table(points, with_eccentricity, with_cult) {
    const head = ['Nr.', 'N_Ed [kN]', 'M_Ed [kNm]'];
    if (with_eccentricity) {
        head.push('M_Ed,mod [kNm]');
    }
    if (with_cult) {
        head.push('M_rel,i [kNm]', 'N_rel,i [kN]',
                  'M_rel,max [kNm]', 'N_rel,max [kN]', 'CULT-I', 'Hinweis');
    }
    /** @type {string[][]} */
    const rows = [];
    /** @type {string[]} */
    const marks = [];
    points.forEach((p, i) => {
        const row = [String(i + 1), fmt(p.n * 1000, 1), fmt(p.m * 1000, 2)];
        if (with_eccentricity) {
            row.push(fmt(p.m_mod * 1000, 2));
        }
        let mark = '';
        if (with_cult && p.cult !== null) {
            if (p.cult === 'outside') {
                row.push('', '', '', '', cult_text(p.cult),
                         'Punkt ausserhalb der Kurve');
                mark = 'outside';
            } else {
                let hint = '';
                if (p.cult.cult_I > 1) {
                    // the value is shown as it is, not capped
                    hint = 'CULT-I > 1, siehe Hinweis';
                    mark = 'above';
                }
                row.push(fmt(p.cult.m_rel_i * 1000, 2),
                         fmt(p.cult.n_rel_i * 1000, 1),
                         fmt(p.cult.m_rel_max * 1000, 2),
                         fmt(p.cult.n_rel_max * 1000, 1),
                         cult_text(p.cult), hint);
            }
        }
        rows.push(row);
        marks.push(mark);
    });
    return { head: head, rows: rows, marks: marks };
}

/**
 * One line above the table: how many points are inside and outside of
 * the curve, and the smallest CULT-I of the points inside.
 * @param {LoadPoint[]} points
 * @param {boolean} with_cult
 * @returns {string}
 */
export function summary_text(points, with_cult) {
    if (points.length === 0) {
        return '';
    }
    const inside = points.filter(p => p.inside);
    const outside = points.length - inside.length;
    let text = `${points.length} Lastpunkte (Bemessungswerte): ` +
        `${inside.length} innerhalb, ${outside} ausserhalb der Kurve.`;
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
 * @returns {string[]}
 */
export function hints(norm, result, loads, with_cult) {
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
     */
    function show_table(points, with_eccentricity, with_cult) {
        summary.textContent = summary_text(points, with_cult);
        if (points.length === 0) {
            table_box.replaceChildren();
            return;
        }
        const { head, rows, marks } = table(points, with_eccentricity, with_cult);
        const table_element = document.createElement('table');
        const head_row = table_element.createTHead().insertRow();
        for (const text of head) {
            const cell = document.createElement('th');
            cell.textContent = text;
            head_row.append(cell);
        }
        const body = table_element.createTBody();
        rows.forEach((row, i) => {
            const table_row = body.insertRow();
            if (marks[i] !== '') {
                table_row.className = marks[i];
            }
            for (const text of row) {
                table_row.insertCell().textContent = text;
            }
        });
        table_box.replaceChildren(table_element);
    }

    /** Check the input, calculate and show everything. */
    function update() {
        if (norm === null) {
            return;
        }
        const raw = raw_inputs();
        const { params, messages } = check_inputs(raw, norm);

        // mark the inputs with a message
        for (const field of form.querySelectorAll('.invalid')) {
            field.classList.remove('invalid');
        }
        for (const message of messages) {
            if (message.field === '') {
                continue;
            }
            const marked = (message.field === 'eta_t') ?
                element('eta_t') : input(message.field);
            marked.classList.add('invalid');
        }

        let texts = messages.map(message => message.text);
        /** @type {Result | null} */
        let result = null;
        if (texts.length === 0) {
            try {
                result = calculate(params, norm, loads, raw.cult);
            } catch (error) {
                texts = [(error instanceof Error) ? error.message : String(error)];
            }
        }
        fill(messages_box, texts, 'p');
        messages_box.hidden = texts.length === 0;

        if (result === null) {
            // no result is shown for input that was rejected
            Plotly.purge(diagram);
            diagram.replaceChildren();
            hints_list.replaceChildren();
            show_table([], false, false);
            return;
        }
        const narrow = window.innerWidth < 700;
        const fig = figure(result.input_values, result.values, norm,
                           result.points, { e0: result.e0, narrow: narrow });
        draw(Plotly, diagram, fig);
        let lines = hints(norm, result, loads, raw.cult);
        if (narrow) {
            // small screen: the legend is shown as text
            lines = fig.legend_lines.concat(lines);
        }
        fill(hints_list, lines, 'li');
        show_table(result.points, result.e0 !== null, raw.cult);
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
