// @ts-check
/*
Interface: the functions of app.js and draw.js that do not touch the page.
The tests check what follows from the rules of the interface
(NOTES.md, decisions), not calculated reference values.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NORMS, parse_number, check_inputs, calculate, table, hints,
         summary_text, sort_order, rewrite_number, shown_messages, EXAMPLE,
         is_example, has_inputs }
    from '../app/app.js';
import { figure, min_cult_I, EXAMPLE_TEXT } from '../app/draw.js';
import { cult_I_details } from '../app/cult_i.js';
import { en1992 } from '../app/norms/en1992.js';
import { sia262 } from '../app/norms/sia262.js';

/**
 * Complete input as typed by the user.
 * @param {Object} [changes]
 * @returns {import('../app/app.js').RawInputs}
 */
function raw(changes = {}) {
    return {
        h_: '0.30', b_: '1.0', d_1: '0.05', d_2: '0.05',
        a_s1: '5.24', a_s2: '5.24', f_ck: '30', f_yk: '500',
        gamma_c: '1.5', gamma_s: '1.15', gamma_d: '1.35',
        alpha_cc: '1.0', alpha_cc_pl: '0.8', eta_t: '0.85',
        eccentricity: false, cult: true, radial: true,
        ...changes,
    };
}

/**
 * @param {import('../app/app.js').Message[]} messages
 * @returns {string[]}
 */
function fields(messages) {
    return messages.map(message => message.field);
}

test('app: the norms of the landing page', () => {
    assert.deepEqual(Object.keys(NORMS), ['sia262', 'en1992']);
    assert.equal(NORMS['sia262'], sia262);
    assert.equal(NORMS['en1992'], en1992);
});

test('parse_number: decimal point or decimal comma, nothing else', () => {
    assert.equal(parse_number('0.35'), 0.35);
    assert.equal(parse_number('0,35'), 0.35);
    assert.equal(parse_number(' 1 '), 1);
    assert.equal(parse_number('-2,5'), -2.5);
    assert.equal(parse_number('.5'), 0.5);
    assert.equal(parse_number('5.'), 5);
    for (const text of ['', ' ', 'abc', '1.2.3', '1,2,3', '1e3', '0x10',
                        '1 000', '5 m', '--1', 'Infinity']) {
        assert.ok(Number.isNaN(parse_number(text)), `«${text}»`);
    }
});

test('check_inputs: complete input gives the parameters', () => {
    const en = check_inputs(raw(), en1992);
    assert.deepEqual(en.messages, []);
    assert.deepEqual(en.params, {
        h_: 0.30, b_: 1.0, d_1: 0.05, d_2: 0.05, a_s1: 5.24, a_s2: 5.24,
        f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15, gamma_d: 1.35,
        eccentricity: false, alpha_cc: 1.0, alpha_cc_pl: 0.8,
    });

    const sia = check_inputs(raw(), sia262);
    assert.deepEqual(sia.messages, []);
    assert.equal(sia.params.eta_t, 0.85);
    // inputs of the other norm are not passed on
    assert.equal('alpha_cc' in sia.params, false);
    assert.equal('eta_t' in en.params, false);
});

test('check_inputs: the cross-section has no presets, an empty field is rejected', () => {
    // the same for the materials f_ck and f_yk
    for (const field of ['h_', 'b_', 'a_s1', 'a_s2', 'd_1', 'd_2',
                         'f_ck', 'f_yk']) {
        const { messages } = check_inputs(raw({ [field]: '' }), en1992);
        assert.deepEqual(fields(messages), [field]);
        assert.match(messages[0].text, / fehlt\.$/);
    }
    // nothing entered at all: one message for each of them
    const empty = check_inputs(raw({ h_: '', b_: ' ', a_s1: '', a_s2: '',
                                     d_1: '', d_2: '' }), sia262);
    assert.deepEqual(fields(empty.messages),
                     ['h_', 'b_', 'd_1', 'd_2', 'a_s1', 'a_s2']);
});

test('check_inputs: the load factor has no preset', () => {
    const { messages } = check_inputs(raw({ gamma_d: '' }), en1992);
    assert.deepEqual(fields(messages), ['gamma_d']);
    assert.match(messages[0].text, /Lastfaktor γ_d fehlt/);
});

test('check_inputs: eta_t has to be chosen (SIA)', () => {
    const { messages } = check_inputs(raw({ eta_t: '' }), sia262);
    assert.deepEqual(fields(messages), ['eta_t']);
    assert.match(messages[0].text, /η_t fehlt/);
    // not needed in the EN mode
    assert.deepEqual(check_inputs(raw({ eta_t: '' }), en1992).messages, []);
});

test('check_inputs: the minimum eccentricity exists in the EN mode only', () => {
    assert.equal(check_inputs(raw({ eccentricity: true }), en1992)
        .params.eccentricity, true);
    // the box of the EN mode is hidden in the SIA mode, its value is ignored
    assert.equal(check_inputs(raw({ eccentricity: true }), sia262)
        .params.eccentricity, false);
});

test('check_inputs: invalid input is rejected, not corrected', () => {
    assert.deepEqual(fields(check_inputs(raw({ h_: 'abc' }), en1992).messages),
                     ['h_']);
    assert.deepEqual(fields(check_inputs(raw({ b_: '0' }), en1992).messages),
                     ['b_']);
    assert.deepEqual(fields(check_inputs(raw({ a_s1: '-1' }), en1992).messages),
                     ['a_s1']);
    assert.deepEqual(fields(check_inputs(raw({ gamma_c: '0' }), en1992).messages),
                     ['gamma_c']);
    // axis distance not smaller than the height
    assert.deepEqual(fields(check_inputs(raw({ d_2: '0.30' }), en1992).messages),
                     ['d_2']);

    // limits of the norm: f_ck above 50 (D4), alpha_cc outside 0.8 to 1.0
    for (const norm of [en1992, sia262]) {
        const { messages } = check_inputs(raw({ f_ck: '55' }), norm);
        assert.equal(messages.length, 1);
        assert.match(messages[0].text, /f_ck = 55/);
    }
    for (const alpha_cc of ['0.79', '1.01']) {
        const { messages } = check_inputs(raw({ alpha_cc: alpha_cc }), en1992);
        assert.equal(messages.length, 1);
        // the message shows the number with a decimal comma
        assert.match(messages[0].text,
                     new RegExp(`alpha_cc = ${alpha_cc.replace('.', ',')}:`));
    }
    assert.match(check_inputs(raw({ d_1: '0.4' }), en1992).messages[0].text,
                 /Achsabstand d_1 = 0,4 m: muss kleiner als die Höhe h = 0,3 m sein/);
    assert.deepEqual(check_inputs(raw({ alpha_cc: '0,8' }), en1992).messages, []);
    // alpha_cc is not checked in the SIA mode
    assert.deepEqual(check_inputs(raw({ alpha_cc: '5' }), sia262).messages, []);
});

test('calculate: load points are gamma_d * value / 1000', () => {
    const { params } = check_inputs(raw(), en1992);
    const loads = { x: [100, -50], y: [-1000, -2000], per_metre: false,
                    name: 'test.xlsx' };
    const result = calculate(params, en1992, loads, true);
    assert.equal(result.e0, null);
    assert.equal(result.points.length, 2);
    assert.equal(result.points[0].m, 1.35 * 100 / 1000);
    assert.equal(result.points[0].n, 1.35 * -1000 / 1000);
    for (const p of result.points) {
        assert.equal(p.m_mod, p.m);
        assert.equal(p.modified, false);
        assert.equal(p.inside, true);
        assert.deepEqual(p.cult, cult_I_details(p.m, p.n, result.values));
    }
    // without a file: only the curves
    assert.deepEqual(calculate(params, en1992, null, true).points, []);
    // CULT-I switched off
    assert.equal(calculate(params, en1992, loads, false).points[0].cult, null);
});

test('calculate: values per metre are multiplied by the width', () => {
    const { params } = check_inputs(raw({ b_: '0.5' }), en1992);
    const loads = { x: [100], y: [-1000], per_metre: true, name: 'plaxis.xlsx' };
    const [point] = calculate(params, en1992, loads, false).points;
    assert.equal(point.m, 1.35 * (100 * 0.5) / 1000);
    assert.equal(point.n, 1.35 * (-1000 * 0.5) / 1000);
});

test('calculate: minimum eccentricity moves the load points (EN, D1)', () => {
    const { params } = check_inputs(raw({ eccentricity: true, gamma_d: '1' }),
                                    en1992);
    // e0 = max(h / 30; 20 mm) = 0.02 m for h = 0.30 m
    const loads = { x: [10, 100, 0], y: [-1000, -1000, -1000],
                    per_metre: false, name: 'test.xlsx' };
    const result = calculate(params, en1992, loads, true);
    assert.equal(result.e0, 0.02);
    const [small, large, zero] = result.points;
    // |M| < e0 * |N| = 0.02: moved
    assert.equal(small.modified, true);
    assert.equal(small.m_mod, 0.02 * 1);
    assert.equal(small.m, 0.01);
    // |M| > e0 * |N|: unchanged
    assert.equal(large.modified, false);
    assert.equal(large.m_mod, 0.1);
    // M = 0: one of the two signs governs
    assert.equal(zero.modified, true);
    assert.equal(Math.abs(zero.m_mod), 0.02);
    // CULT-I belongs to the modified point
    assert.deepEqual(small.cult, cult_I_details(0.02, -1, result.values));
});

test('table: values in kN and kNm with the intermediate values of CULT-I', () => {
    /** @type {import('../app/draw.js').LoadPoint[]} */
    const points = [
        { m: 0.1, n: -1.5, m_mod: 0.1, modified: false, inside: true,
          utilization: 0.4,
          cult: { cult_I: 0.5, m_rel_i: 0.2, n_rel_i: 1.25,
                  m_rel_max: 0.4, n_rel_max: 2.5 } },
        { m: 0.9, n: -1, m_mod: 0.9, modified: false, inside: false,
          utilization: 2.5, cult: 'outside' },
        // not capped: a value above 1 is shown and marked
        { m: 0, n: -3, m_mod: 0.06, modified: true, inside: true,
          utilization: 0.75,
          cult: { cult_I: 1.2, m_rel_i: 0.3, n_rel_i: 3,
                  m_rel_max: 0.4, n_rel_max: 2.5 } },
    ];
    const full = table(points, true, true);
    assert.deepEqual(full.head, ['Nr.', 'N_Ed [kN]', 'M_Ed [kNm]',
        'M_Ed,mod [kNm]', 'M_rel,i [kNm]', 'N_rel,i [kN]',
        'M_rel,max [kNm]', 'N_rel,max [kN]',
        'M_rel,i / M_rel,max', 'N_rel,i / N_rel,max', 'CULT-I', 'Hinweis']);
    // decimal comma in all output
    assert.deepEqual(full.rows[0], ['1', '-1500,0', '100,00', '100,00',
        '200,00', '1250,0', '400,00', '2500,0',
        // the two ratios with three decimals: 0.2 / 0.4 and 1.25 / 2.5
        '0,500', '0,500', '0,500', '']);
    assert.deepEqual(full.rows[1], ['2', '-1000,0', '900,00', '900,00',
        '', '', '', '', '', '', 'ausserhalb', 'Punkt ausserhalb der Kurve']);
    assert.equal(full.rows[2][3], '60,00');
    assert.deepEqual(full.rows[2].slice(8, 11), ['0,750', '1,200', '1,200']);
    // the values behind the cells, for sorting: numbers, not text
    assert.deepEqual(full.keys[0], [1, -1500, 100, 100, 200, 1250, 400, 2500,
                                    0.5, 0.5, 0.5, null]);
    assert.deepEqual(full.keys[1].slice(4), [null, null, null, null, null,
        null, null, 'Punkt ausserhalb der Kurve']);
    for (const key of full.keys) {
        assert.equal(key.length, full.head.length);
    }
    assert.deepEqual(full.marks, ['', 'outside', 'above']);
    for (const row of full.rows) {
        assert.equal(row.length, full.head.length);
    }

    const short = table(points, false, false);
    // nothing switched on: inside / outside is still shown
    assert.deepEqual(short.head, ['Nr.', 'N_Ed [kN]', 'M_Ed [kNm]', 'Hinweis']);
    assert.deepEqual(short.rows[0], ['1', '-1500,0', '100,00', '']);
    assert.deepEqual(short.rows[1], ['2', '-1000,0', '900,00',
                                     'Punkt ausserhalb der Kurve']);
    assert.deepEqual(short.marks, ['', 'outside', '']);

    // radial utilization only: one column, above 1 outside, not capped
    const radial = table(points, false, false, true);
    assert.deepEqual(radial.head, ['Nr.', 'N_Ed [kN]', 'M_Ed [kNm]',
                                   'Ausnutzung radial', 'Hinweis']);
    assert.deepEqual(radial.rows.map(row => row[3]), ['0,400', '2,500', '0,750']);
    assert.deepEqual(radial.keys.map(key => key[3]), [0.4, 2.5, 0.75]);
    // sorted by the utilization, descending: the point outside first
    assert.deepEqual(sort_order(radial.keys, 3, true), [1, 2, 0]);
    // both: the utilization stands before the columns of CULT-I
    const both = table(points, true, true, true);
    assert.equal(both.head.indexOf('Ausnutzung radial'), 4);
    assert.equal(both.head.indexOf('M_rel,i [kNm]'), 5);
    assert.equal(both.head.length, full.head.length + 1);
    for (const row of both.rows) {
        assert.equal(row.length, both.head.length);
    }

    // summary: number of points outside and the smallest CULT-I inside
    assert.equal(summary_text(points, true),
        '3 Lastpunkte (Bemessungswerte): 2 innerhalb, 1 ausserhalb der ' +
        'Kurve. Kleinstes CULT-I der Punkte innerhalb: 0,500.');
    assert.equal(summary_text(points, false),
        '3 Lastpunkte (Bemessungswerte): 2 innerhalb, 1 ausserhalb der Kurve.');
    assert.equal(summary_text([points[1]], true),
        '1 Lastpunkte (Bemessungswerte): 0 innerhalb, 1 ausserhalb der Kurve.');
    assert.equal(summary_text([], true), '');
    // with the radial utilization: the largest value inside, and of all
    // points if there are points outside
    assert.equal(summary_text(points, false, true),
        '3 Lastpunkte (Bemessungswerte): 2 innerhalb, 1 ausserhalb der ' +
        'Kurve. Grösste Ausnutzung radial der Punkte innerhalb: 0,750. ' +
        'Grösste Ausnutzung radial aller Punkte: 2,500.');
    assert.equal(summary_text([points[0], points[2]], true, true),
        '2 Lastpunkte (Bemessungswerte): 2 innerhalb, 0 ausserhalb der ' +
        'Kurve. Grösste Ausnutzung radial der Punkte innerhalb: 0,750. ' +
        'Kleinstes CULT-I der Punkte innerhalb: 0,500.');

    assert.equal(min_cult_I(points), 'outside');
    assert.equal(min_cult_I([points[0], points[2]]), 0.5);
    assert.equal(min_cult_I([]), null);
});

test('figure: the legend shows the f_cd that was used (N6)', () => {
    const { params } = check_inputs(raw({ alpha_cc: '0.85' }), en1992);
    const result = calculate(params, en1992, null, true);
    const fig = figure(result.input_values, result.values, en1992, []);
    // f_cd = 0.85 * 30 / 1.5 = 17
    assert.equal(fig.data.length, 2);
    assert.match(/** @type {any} */ (fig.data[0]).name, /f_cd = 17,00 N\/mm²/);
    assert.match(/** @type {any} */ (fig.data[0]).name,
                 /Beton ohne Bewehrung \(Vergleich\)/);
    assert.match(/** @type {any} */ (fig.data[1]).name, /Mit Bewehrung/);
    // the curve with reinforcement governs: solid and stronger than the
    // comparison line
    const [comparison, governing] = /** @type {any[]} */ (fig.data);
    assert.equal(governing.line.dash, 'solid');
    assert.equal(comparison.line.dash, 'dash');
    assert.ok(governing.line.width > comparison.line.width);
    assert.notEqual(governing.line.color, comparison.line.color);
    assert.equal(/** @type {any} */ (fig.layout).title.text, en1992.label);
    // decimal comma on the axes, too
    assert.equal(/** @type {any} */ (fig.layout).separators[0], ',');
    assert.match(/** @type {any} */ (fig.data[0]).name, /h = 0,3 m<br>b = 1 m<br>d_1 = 0,05 m/);
    // closed curve: both sides
    assert.equal(/** @type {any} */ (fig.data[1]).x.length,
                 result.values['Moment Reinf'].length +
                 result.values['Moment Reinf Neg'].length);
});

test('figure: plain concrete section, one curve with the reduced f_cd (D7)', () => {
    const { params } = check_inputs(raw({ a_s1: '0', a_s2: '0' }), en1992);
    const result = calculate(params, en1992, null, true);
    const fig = figure(result.input_values, result.values, en1992, []);
    assert.equal(fig.data.length, 1);
    // f_cd = alpha_cc,pl * 30 / 1.5 = 16
    assert.match(/** @type {any} */ (fig.data[0]).name,
                 /Beton unbewehrt<br>f_cd = 16,00 N\/mm² \(abgemindert\)/);
    // the only curve governs: solid
    assert.equal(/** @type {any} */ (fig.data[0]).line.dash, 'solid');
    assert.ok(hints(en1992, result, null, true).some(
        hint => hint.includes('EN 12.6.2')));
});

test('figure: load points, ray of the minimum eccentricity (D1)', () => {
    const { params } = check_inputs(raw({ eccentricity: true, gamma_d: '1' }),
                                    en1992);
    const loads = { x: [10, 100], y: [-1000, -1000], per_metre: false,
                    name: 'test.xlsx' };
    const result = calculate(params, en1992, loads, true);
    const fig = figure(result.input_values, result.values, en1992,
                       result.points, { e0: result.e0 });
    const names = fig.data.map(trace => /** @type {any} */ (trace).name);
    assert.equal(names.length, 5);
    assert.match(names[2], /Mindestausmitte M = ±e0·N<br>e0 = 0,020 m/);
    assert.match(names[3],
        /^Lastpunkte innerhalb: 2 von 2<br>Bemessungswerte, γ_d = 1<br>min\. CULT-I: \d,\d{3}$/);
    assert.equal(names[4], 'Lastpunkte mit Mindestausmitte');
    // the original points stay, only the moved point is drawn again
    // the diagram is in kNm and kN
    assert.deepEqual(/** @type {any} */ (fig.data[3]).x, [10, 100]);
    assert.deepEqual(/** @type {any} */ (fig.data[3]).y, [-1000, -1000]);
    assert.deepEqual(/** @type {any} */ (fig.data[4]).x, [20]);
    // the ray: M = e0 * N at the largest compression force
    const ray = /** @type {any} */ (fig.data[2]);
    assert.ok(Math.abs(ray.x[0] - -0.02 * ray.y[0]) < 1e-9);
    assert.deepEqual([ray.x[1], ray.y[1]], [0, 0]);
    // units of the axes and of the hover texts
    const layout = /** @type {any} */ (fig.layout);
    assert.match(layout.xaxis.title.text, /\[kNm\]/);
    assert.match(layout.yaxis.title.text, /\[kN\]/);
    assert.match(/** @type {any} */ (fig.data[3]).text[0],
                 /^Punkt 1<br>M: 10,00 kNm<br>N: -1000,0 kN<br>M mit Mindestausmitte: 20,00 kNm/);
    assert.match(/** @type {any} */ (fig.data[1]).text[0], /^M: .* kNm<br>N: .* kN$/);
    // the curve itself: 1000 times the values of the calculation
    assert.equal(/** @type {any} */ (fig.data[1]).y[0],
                 result.values['Normal Force Reinf'][0] * 1000);
});

test('hints: norm, simplifications and the handling of the file', () => {
    const { params } = check_inputs(raw({ b_: '0.5' }), sia262);
    const loads = { x: [100], y: [-1000], per_metre: true, name: 'plaxis.xlsx' };
    const result = calculate(params, sia262, loads, true);
    const text = hints(sia262, result, loads, true).join('\n');
    assert.match(text, /k_σ = 2/);
    assert.match(text, /ohne Effekte 2\. Ordnung/);
    assert.match(text, /nicht aus SIA 262/);
    assert.match(text, /12 ‰/);
    assert.match(text, /= 1,000 · 0,85 · 30 \/ 1,5 = 17,00 N\/mm²/);
    assert.match(text, /mit γ_d = 1,35 multipliziert/);
    // no number with a decimal point in the hints
    assert.doesNotMatch(text.replace(/[\d)] \. |2\. Ordnung|6\.1 \(5\)|z\. B\./g, ''),
                        /\d\.\d/);
    assert.match(text, /mit der Breite b = 0,5 m multipliziert/);
    assert.match(text, /Positives M: Zug auf der Seite von a_s1/);
    assert.match(text, /Reserve-Index, keine Ausnutzung/);
    // the legend of the SIA mode names the norm
    const fig = figure(result.input_values, result.values, sia262, result.points);
    assert.equal(/** @type {any} */ (fig.layout).title.text, 'SIA 262:2025');

    // EN mode: no hint of the SIA mode
    const en = check_inputs(raw(), en1992);
    const en_text = hints(en1992, calculate(en.params, en1992, null, true),
                          null, true).join('\n');
    assert.match(en_text, /ohne Effekte 2\. Ordnung/);
    assert.doesNotMatch(en_text, /k_σ/);
    assert.doesNotMatch(en_text, /CULT-I/);
});

test('figure: small screen, the legend is given as text', () => {
    const { params } = check_inputs(raw({ eccentricity: true, gamma_d: '1' }),
                                    en1992);
    const loads = { x: [10, 100], y: [-1000, -1000], per_metre: false,
                    name: 'test.xlsx' };
    const result = calculate(params, en1992, loads, true);
    const wide = figure(result.input_values, result.values, en1992,
                        result.points, { e0: result.e0 });
    const narrow = figure(result.input_values, result.values, en1992,
                          result.points, { e0: result.e0, narrow: true });
    assert.equal(/** @type {any} */ (wide.layout).showlegend, undefined);
    assert.equal(/** @type {any} */ (narrow.layout).showlegend, false);
    assert.equal(/** @type {any} */ (narrow.layout).title.text, 'EN 1992-1-1');
    // one line for each trace, with its colour
    assert.equal(narrow.legend_lines.length, narrow.data.length);
    assert.match(narrow.legend_lines[0],
                 /^grau gestrichelt, dünn: Beton ohne Bewehrung \(Vergleich\), f_cd = 20,00 N\/mm²/);
    assert.match(narrow.legend_lines[1], /^blau durchgezogen: Mit Bewehrung, a_s1 = 5,24 cm²/);
    assert.match(narrow.legend_lines[2], /^orange strichpunktiert: Mindestausmitte/);
    assert.match(narrow.legend_lines[3], /^grüne Punkte: Lastpunkte innerhalb: 2 von 2, /);
    assert.match(narrow.legend_lines[4], /^hohle Punkte: Lastpunkte mit Mindestausmitte$/);
});

test('figure: load points inside and outside are two traces with their numbers', () => {
    const { params } = check_inputs(raw({ gamma_d: '1' }), en1992);
    // the second and the fourth point are far outside of the curve
    const loads = { x: [10, 900, 50, -900], y: [-1000, -1000, -2000, -1000],
                    per_metre: false, name: 'test.xlsx' };
    for (const with_cult of [true, false]) {
        const result = calculate(params, en1992, loads, with_cult);
        assert.deepEqual(result.points.map(p => p.inside),
                         [true, false, true, false]);
        const fig = figure(result.input_values, result.values, en1992,
                           result.points);
        const [inside, outside] = /** @type {any[]} */ (fig.data.slice(2));
        assert.equal(fig.data.length, 4);
        assert.match(inside.name, /^Lastpunkte innerhalb: 2 von 4<br>/);
        assert.match(outside.name, /^Lastpunkte ausserhalb der Kurve: 2 von 4<br>/);
        assert.deepEqual(inside.x, [10, 50]);
        assert.deepEqual(outside.x, [900, -900]);
        assert.notEqual(inside.marker.color, outside.marker.color);
        // the smallest CULT-I is the one of the points inside
        assert.equal(/min\. CULT-I/.test(inside.name), with_cult);
        assert.doesNotMatch(outside.name, /CULT-I/);
        // the numbers of the points are the ones of the table
        assert.match(outside.text[1], /^Punkt 4<br>/);
        assert.match(outside.text[1], /ausserhalb der Kurve/);
    }

    // all points inside: no trace for points outside
    const all_inside = calculate(params, en1992,
        { x: [10], y: [-1000], per_metre: false, name: 'test.xlsx' }, true);
    const names = figure(all_inside.input_values, all_inside.values, en1992,
                         all_inside.points).data.map(
        trace => /** @type {any} */ (trace).name);
    assert.equal(names.length, 3);
    assert.match(names[2], /^Lastpunkte innerhalb: 1 von 1<br>/);
});
test('sort_order: numbers are sorted as numbers, both directions', () => {
    // as text, "-1000" < "-200" < "-30" < "5" < "50" would not be this order
    const keys = [[1, -30], [2, 50], [3, -1000], [4, 5], [5, -200]];
    assert.deepEqual(sort_order(keys, 1, false), [2, 4, 0, 3, 1]);
    assert.deepEqual(sort_order(keys, 1, true), [1, 3, 0, 4, 2]);
    // by the number of the point: the order of the file
    assert.deepEqual(sort_order(keys, 0, false), [0, 1, 2, 3, 4]);
    assert.deepEqual(sort_order(keys, 0, true), [4, 3, 2, 1, 0]);
    // the keys are not changed
    assert.deepEqual(keys[0], [1, -30]);
});

test('sort_order: empty cells are at the end, ascending and descending', () => {
    // CULT-I of points outside of the curve is empty (null)
    const keys = [[1, 0.3], [2, null], [3, 0.1], [4, null], [5, 0.9]];
    assert.deepEqual(sort_order(keys, 1, false), [2, 0, 4, 1, 3]);
    assert.deepEqual(sort_order(keys, 1, true), [4, 0, 2, 1, 3]);
});

test('sort_order: rows with the same value keep the order of the file', () => {
    const keys = [[1, 2], [2, 1], [3, 2], [4, 1], [5, 2]];
    assert.deepEqual(sort_order(keys, 1, false), [1, 3, 0, 2, 4]);
    assert.deepEqual(sort_order(keys, 1, true), [0, 2, 4, 1, 3]);
    // text (column of the hints): empty at the end
    const hints_column = [['b'], [null], ['a'], ['b']];
    assert.deepEqual(sort_order(hints_column, 0, false), [2, 0, 3, 1]);
});

test('sort_order: table of load points sorted by CULT-I', () => {
    const { params } = check_inputs(raw({ gamma_d: '1' }), en1992);
    const loads = { x: [10, 900, 50, -900, 30], y: [-1000, -1000, -2000, -1000, -3000],
                    per_metre: false, name: 'test.xlsx' };
    const result = calculate(params, en1992, loads, true);
    const t = table(result.points, false, true);
    const column = t.head.indexOf('CULT-I');
    for (const descending of [false, true]) {
        const order = sort_order(t.keys, column, descending);
        // every row once
        assert.deepEqual(order.slice().sort(), [0, 1, 2, 3, 4]);
        // the two points outside (2 and 4) are the last ones
        assert.deepEqual(order.slice(3), [1, 3]);
        const values = order.slice(0, 3).map(
            i => /** @type {number} */ (t.keys[i][column]));
        for (let i = 1; i < values.length; i++) {
            assert.ok(descending ? values[i - 1] >= values[i] :
                                   values[i - 1] <= values[i]);
        }
        // the number of the point stays with its row
        for (const i of order) {
            assert.equal(t.rows[i][0], String(i + 1));
        }
    }
});

test('hover text, table and core give the same CULT-I for every point', () => {
    // points on a grid, inside and outside, with and without the minimum
    // eccentricity
    /** @type {number[]} */
    const x = [];
    /** @type {number[]} */
    const y = [];
    for (let i = -6; i <= 6; i++) {
        for (let j = 0; j <= 8; j++) {
            x.push(i * 40);
            y.push(-j * 700 + 100);
        }
    }
    const loads = { x: x, y: y, per_metre: false, name: 'grid.xlsx' };
    for (const eccentricity of [false, true]) {
        const { params } = check_inputs(raw({ eccentricity: eccentricity }),
                                        en1992);
        const result = calculate(params, en1992, loads, true);
        const fig = figure(result.input_values, result.values, en1992,
                           result.points, { e0: result.e0 });
        const t = table(result.points, eccentricity, true);
        const column = t.head.indexOf('CULT-I');
        /** @type {Map<number, string>} */
        const hover = new Map();
        for (const trace of /** @type {any[]} */ (fig.data)) {
            if (!/^Lastpunkte (innerhalb|ausserhalb)/.test(trace.name)) {
                continue;
            }
            for (const text of trace.text) {
                const number = Number(/^Punkt (\d+)</.exec(text)?.[1]);
                const cult = /CULT-I: ([\d,]+)/.exec(text);
                hover.set(number, cult ? cult[1] : 'ausserhalb');
            }
        }
        assert.equal(hover.size, result.points.length);
        result.points.forEach((p, i) => {
            const details = cult_I_details(p.m_mod, p.n, result.values);
            const core = (details === 'outside') ? 'ausserhalb' :
                details.cult_I.toFixed(3).replace('.', ',');
            assert.equal(t.rows[i][column], core, `point ${i + 1}, table`);
            assert.equal(hover.get(i + 1), core, `point ${i + 1}, hover`);
        });
        assert.ok(result.points.some(p => p.inside));
        assert.ok(result.points.some(p => !p.inside));
    }
});
test('radial utilization and CULT-I can be switched on and off', () => {
    const { params } = check_inputs(raw({ gamma_d: '1' }), en1992);
    // the second point is far outside of the curve
    const loads = { x: [10, 900, 50], y: [-1000, -1000, -2000],
                    per_metre: false, name: 'test.xlsx' };
    for (const [with_cult, with_radial] of [[true, true], [true, false],
                                            [false, true], [false, false]]) {
        const result = calculate(params, en1992, loads, with_cult, with_radial);
        assert.equal(result.radial_defined, true);
        // inside / outside is always determined
        assert.deepEqual(result.points.map(p => p.inside), [true, false, true]);
        for (const p of result.points) {
            assert.equal(p.cult !== null, with_cult);
            assert.equal(p.utilization !== null, with_radial);
            if (p.utilization !== null) {
                // below 1 inside, above 1 outside
                assert.equal(p.utilization < 1, p.inside);
            }
        }
        const fig = figure(result.input_values, result.values, en1992,
                           result.points);
        const [inside, outside] = /** @type {any[]} */ (fig.data.slice(2));
        assert.match(inside.name, /^Lastpunkte innerhalb: 2 von 3<br>/);
        assert.match(outside.name, /^Lastpunkte ausserhalb der Kurve: 1 von 3<br>/);
        // legend and hover text name only what is switched on
        assert.equal(/max\. Ausnutzung radial: \d,\d{3}/.test(inside.name), with_radial);
        assert.equal(/max\. Ausnutzung radial: \d+,\d{3}/.test(outside.name), with_radial);
        assert.equal(/min\. CULT-I/.test(inside.name), with_cult);
        assert.equal(/Ausnutzung radial: 0,\d{3}/.test(inside.text[0]), with_radial);
        assert.equal(/CULT-I: /.test(inside.text[0]), with_cult);
        assert.match(outside.text[0], /ausserhalb der Kurve/);

        const t = table(result.points, false, with_cult,
                        with_radial && result.radial_defined);
        assert.equal(t.head.includes('Ausnutzung radial'), with_radial);
        assert.equal(t.head.includes('CULT-I'), with_cult);
        assert.equal(t.head.includes('M_rel,i / M_rel,max'), with_cult);
        assert.deepEqual(t.marks, ['', 'outside', '']);

        const text = hints(en1992, result, loads, with_cult, with_radial).join('\n');
        assert.equal(/Ausnutzung radial setzt proportionale Laststeigerung von N und M voraus\./
            .test(text), with_radial);
        assert.equal(/Reserve-Index/.test(text), with_cult);
        const summary = summary_text(result.points, with_cult, with_radial);
        assert.equal(/Grösste Ausnutzung radial der Punkte innerhalb/.test(summary),
                     with_radial);
        assert.equal(/Kleinstes CULT-I/.test(summary), with_cult);
        assert.match(summary, /2 innerhalb, 1 ausserhalb/);
    }
});

test('radial utilization: a load point of the calculation', () => {
    const { params } = check_inputs(raw({ gamma_d: '1' }), en1992);
    const curves_only = calculate(params, en1992, null, false, true);
    // a point of the curve as the load: utilization 1, half of it 0.5
    const m = curves_only.values['Moment Reinf'][20] * 1000;
    const n = curves_only.values['Normal Force Reinf'][20] * 1000;
    const loads = { x: [m, m / 2, 0], y: [n, n / 2, 0], per_metre: false,
                    name: 'test.xlsx' };
    const result = calculate(params, en1992, loads, false, true);
    const values = result.points.map(p => /** @type {number} */ (p.utilization));
    assert.ok(Math.abs(values[0] - 1) < 1e-9);
    assert.ok(Math.abs(values[1] - 0.5) < 1e-9);
    assert.equal(values[2], 0);
});

test('radial utilization: with the minimum eccentricity at the modified moment', () => {
    const { params } = check_inputs(raw({ eccentricity: true, gamma_d: '1' }),
                                    en1992);
    // e0 = 0.02 m: the first point is moved to M = 20 kNm, the second not
    const loads = { x: [5, 100], y: [-1000, -1000], per_metre: false,
                    name: 'test.xlsx' };
    const result = calculate(params, en1992, loads, false, true);
    const plain_points = calculate(
        { ...params, eccentricity: false }, en1992,
        { x: [20, 100], y: [-1000, -1000], per_metre: false, name: 't' },
        false, true).points;
    assert.equal(result.points[0].m_mod, 0.02);
    assert.equal(result.points[0].utilization, plain_points[0].utilization);
    assert.equal(result.points[1].utilization, plain_points[1].utilization);
    assert.match(hints(en1992, result, loads, false, true).join('\n'),
                 /Mit Mindestausmitte am geprüften Punkt \(M_Ed,mod\)\./);
});

test('radial utilization: not defined for a plain concrete section', () => {
    for (const norm of [en1992, sia262]) {
        const { params } = check_inputs(raw({ a_s1: '0', a_s2: '0' }), norm);
        const loads = { x: [10], y: [-1000], per_metre: false, name: 'test.xlsx' };
        const result = calculate(params, norm, loads, false, true);
        assert.equal(result.radial_defined, false);
        // no number, and a hint instead
        assert.equal(result.points[0].utilization, null);
        const text = hints(norm, result, loads, false, true).join('\n');
        assert.match(text, /Ausnutzung radial bei unbewehrtem Querschnitt nicht definiert\./);
        assert.doesNotMatch(text, /proportionale Laststeigerung/);
        // inside / outside is still determined
        assert.equal(result.points[0].inside, true);
        assert.doesNotMatch(summary_text(result.points, false, true),
                            /Ausnutzung/);
    }
});
test('rewrite_number: only the decimal sign changes, the value stays', () => {
    assert.equal(rewrite_number('1.35', ','), '1,35');
    assert.equal(rewrite_number('1,35', '.'), '1.35');
    assert.equal(rewrite_number('1,35', ','), '1,35');
    // the digits stay as typed, nothing is rounded or shortened
    assert.equal(rewrite_number('0.350', ','), '0,350');
    assert.equal(rewrite_number('1.0', ','), '1,0');
    assert.equal(rewrite_number(' 2.58 ', ','), '2,58');
    assert.equal(rewrite_number('-0.5', ','), '-0,5');
    assert.equal(rewrite_number('.5', ','), ',5');
    assert.equal(rewrite_number('30', ','), '30');
    // reading and rewriting give the same number
    for (const text of ['1.35', '1,35', '0.03', '0,030', '2,58', '500', '-1.5',
                        '.25', '7.', '0.1', '123456.789']) {
        for (const decimal of [',', '.']) {
            const written = rewrite_number(text, decimal);
            assert.equal(parse_number(written), parse_number(text),
                         `«${text}» -> «${written}»`);
            assert.equal(written.includes(decimal === ',' ? '.' : ','), false);
        }
    }
    // text that is not a number is not touched
    for (const text of ['', ' ', 'abc', '1.2.3', '1,2,3', '1e3', '5 m']) {
        assert.equal(rewrite_number(text, ','), text);
    }
});

test('shown_messages: an empty input is no error before the field is left', () => {
    const empty = raw({ h_: '', b_: '', a_s1: '', a_s2: '', d_1: '', d_2: '',
                        f_ck: '', f_yk: '', gamma_d: '', eta_t: '' });
    const { messages } = check_inputs(empty, sia262);
    // all of them are missing values, nothing is wrong
    assert.equal(messages.length, 10);
    assert.ok(messages.every(message => message.missing === true));

    // at the start: nothing is shown as an error
    assert.deepEqual(shown_messages(messages, new Set(), false), []);
    // after the user has left two fields: only these two
    assert.deepEqual(
        fields(shown_messages(messages, new Set(['b_', 'eta_t']), false)),
        ['b_', 'eta_t']);
    // with a file the values are needed: all of them
    assert.equal(shown_messages(messages, new Set(), true).length, 10);

    // a wrong value is always shown, touched or not
    const wrong = check_inputs({ ...empty, h_: 'abc', gamma_d: '-1' }, sia262);
    assert.deepEqual(fields(shown_messages(wrong.messages, new Set(), false)),
                     ['h_', 'gamma_d']);
    // messages of the norm, too
    const norm_message = check_inputs(raw({ f_ck: '60' }), en1992);
    assert.equal(shown_messages(norm_message.messages, new Set(), false).length, 1);
});

test('EXAMPLE: the values of the button give a calculation in both norms', () => {
    // the placeholders of the inputs, eta_t = 0.85, gamma_d = 1.0
    assert.deepEqual(EXAMPLE, {
        h_: '0.35', b_: '1.0', a_s1: '2.58', d_1: '0.03', a_s2: '2.58',
        d_2: '0.03', f_ck: '30', f_yk: '500', eta_t: '0.85', gamma_d: '1.0',
    });
    for (const norm of [en1992, sia262]) {
        // as in the page: everything empty, then the example and the
        // presets of the norm
        const inputs = { ...raw(), ...EXAMPLE,
                         gamma_c: String(norm.defaults['gamma_c']),
                         gamma_s: String(norm.defaults['gamma_s']) };
        const { params, messages } = check_inputs(inputs, norm);
        assert.deepEqual(messages, []);
        assert.equal(params.gamma_d, 1);
        assert.equal(params.f_ck, 30);
        assert.notEqual(calculate(params, norm, null, false, true), null);
    }
});
test('is_example: the result is marked as long as the values are the example', () => {
    // case 1: cross-section and materials are exactly the example values
    const example = /** @type {any} */ ({ ...raw(), ...EXAMPLE });
    assert.equal(is_example(example), true);
    // the number counts, not the way it is written
    assert.equal(is_example({ ...example, h_: '0,350', b_: '1' }), true);
    // load factor, eta_t and the partial factors are not part of it
    assert.equal(is_example({ ...example, gamma_d: '1,35', eta_t: '1.0',
                              gamma_c: '1.2' }), true);
    // case 2: one value changed, or a field emptied: not the example
    for (const field of ['h_', 'b_', 'a_s1', 'd_1', 'a_s2', 'd_2', 'f_ck', 'f_yk']) {
        assert.equal(is_example({ ...example, [field]: '9' }), false, field);
        assert.equal(is_example({ ...example, [field]: '' }), false, field);
    }

    // the figure names the example in the legend, and only then
    const { params } = check_inputs(example, en1992);
    const result = calculate(params, en1992, null, false, true);
    const marked = figure(result.input_values, result.values, en1992, [],
                          { example: true, narrow: true });
    assert.equal(/** @type {any} */ (marked.layout).legend.title.text, EXAMPLE_TEXT);
    assert.equal(marked.legend_lines[0], EXAMPLE_TEXT);
    assert.equal(EXAMPLE_TEXT, 'Beispielwerte, nicht projektbezogen');
    const plain_figure = figure(result.input_values, result.values, en1992, []);
    assert.equal(/** @type {any} */ (plain_figure.layout).legend.title, undefined);
    assert.equal(plain_figure.legend_lines.includes(EXAMPLE_TEXT), false);
});

test('has_inputs: undo of the example is offered only if there was input', () => {
    const empty = /** @type {any} */ ({
        ...raw(), h_: '', b_: '', a_s1: '', d_1: '', a_s2: '', d_2: '',
        f_ck: '', f_yk: '', eta_t: '', gamma_d: '' });
    // case 1: empty form (the partial factors come from the norm): no undo
    assert.equal(has_inputs(empty), false);
    assert.equal(has_inputs({ ...empty, h_: '  ' }), false);
    // case 2: any of the fields the example overwrites was filled
    for (const field of Object.keys(EXAMPLE)) {
        assert.equal(has_inputs({ ...empty, [field]: '1' }), true, field);
    }
});