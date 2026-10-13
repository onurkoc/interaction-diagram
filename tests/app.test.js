// @ts-check
/*
Interface: the functions of app.js and draw.js that do not touch the page.
The tests check what follows from the rules of the interface
(NOTES.md, decisions), not calculated reference values.

Messages are checked by their key, not by their text. Where a text is
needed, it is taken from the table of the language (i18n.js), and the
test runs for every language.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NORMS, parse_number, check_inputs, calculate, table, hints,
         summary_text, sort_order, rewrite_number, shown_messages, EXAMPLE,
         is_example, has_inputs, message_text, error_text }
    from '../app/app.js';
import { figure, min_cult_I, max_utilization } from '../app/draw.js';
import { cult_I_details } from '../app/cult_i.js';
import { en1992 } from '../app/norms/en1992.js';
import { sia262 } from '../app/norms/sia262.js';
import { translator, LANGUAGES } from '../app/i18n.js';
import { TextError } from '../app/errors.js';

const de = translator('de');
const en = translator('en');

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

/**
 * @param {import('../app/app.js').Message[]} messages
 * @returns {string[]}
 */
function keys_of(messages) {
    return messages.map(message => message.key);
}

/**
 * Load points for the tests.
 * @param {number[]} x  moments [kNm]
 * @param {number[]} y  normal forces [kN]
 * @param {boolean} [per_metre]
 * @returns {import('../app/app.js').Loads}
 */
function loads_of(x, y, per_metre = false) {
    return { x: x, y: y, per_metre: per_metre, name: 'test.xlsx' };
}

// three points for the tests of the table: inside, outside, CULT-I > 1
/** @type {import('../app/draw.js').LoadPoint[]} */
const POINTS = [
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

test('rewrite_number: only the decimal sign changes, the value stays', () => {
    assert.equal(rewrite_number('1.35', ','), '1,35');
    assert.equal(rewrite_number('1,35', '.'), '1.35');
    assert.equal(rewrite_number('1,35', ','), '1,35');
    // the digits stay as typed, nothing is rounded or shortened
    assert.equal(rewrite_number('0.350', ','), '0,350');
    assert.equal(rewrite_number('1.0', ','), '1,0');
    assert.equal(rewrite_number(' 2.58 ', ','), '2,58');
    assert.equal(rewrite_number('-0.5', ','), '-0,5');
    assert.equal(rewrite_number('30', ','), '30');
    // reading and rewriting give the same number, in every language
    for (const text of ['1.35', '1,35', '0.03', '0,030', '2,58', '500', '-1.5',
                        '.25', '7.', '0.1', '123456.789']) {
        for (const lang of LANGUAGES) {
            const decimal = translator(lang).decimal;
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

test('check_inputs: complete input gives the parameters', () => {
    const result_en = check_inputs(raw(), en1992);
    assert.deepEqual(result_en.messages, []);
    assert.deepEqual(result_en.params, {
        h_: 0.30, b_: 1.0, d_1: 0.05, d_2: 0.05, a_s1: 5.24, a_s2: 5.24,
        f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15, gamma_d: 1.35,
        eccentricity: false, alpha_cc: 1.0, alpha_cc_pl: 0.8,
    });

    const result_sia = check_inputs(raw(), sia262);
    assert.deepEqual(result_sia.messages, []);
    assert.equal(result_sia.params.eta_t, 0.85);
    // inputs of the other norm are not passed on
    assert.equal('alpha_cc' in result_sia.params, false);
    assert.equal('eta_t' in result_en.params, false);
});

test('check_inputs: no presets, an empty field is a missing value', () => {
    for (const field of ['h_', 'b_', 'a_s1', 'a_s2', 'd_1', 'd_2',
                         'f_ck', 'f_yk']) {
        const { messages } = check_inputs(raw({ [field]: '' }), en1992);
        assert.deepEqual(fields(messages), [field]);
        assert.equal(messages[0].key, 'check.missing');
        assert.equal(messages[0].missing, true);
    }
    // the load factor has no preset either
    const gamma_d = check_inputs(raw({ gamma_d: '' }), en1992).messages;
    assert.deepEqual(keys_of(gamma_d), ['check.gamma_d_missing']);
    assert.equal(gamma_d[0].field, 'gamma_d');
    // eta_t has to be chosen (SIA), it is not needed in the EN mode
    const eta_t = check_inputs(raw({ eta_t: '' }), sia262).messages;
    assert.deepEqual(keys_of(eta_t), ['check.eta_t_missing']);
    assert.equal(eta_t[0].field, 'eta_t');
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
    /**
     * @param {Object} changes
     * @param {import('../app/norms/en1992.js').Norm} [norm]
     * @returns {import('../app/app.js').Message}
     */
    const only = (changes, norm = en1992) => {
        const { messages } = check_inputs(raw(changes), norm);
        assert.equal(messages.length, 1);
        return messages[0];
    };
    assert.deepEqual(only({ h_: 'abc' }),
                     { field: 'h_', key: 'check.not_a_number',
                       params: { text: 'abc' } });
    assert.deepEqual(only({ b_: '0' }),
                     { field: 'b_', key: 'check.positive', params: { value: 0 } });
    assert.deepEqual(only({ a_s1: '-1' }),
                     { field: 'a_s1', key: 'check.not_negative',
                       params: { value: -1 } });
    assert.equal(only({ gamma_c: '0' }).key, 'check.positive');
    // axis distance not smaller than the height
    assert.deepEqual(only({ d_2: '0.4' }),
                     { field: 'd_2', key: 'check.below_height',
                       params: { value: 0.4, h: 0.3 } });

    // limits of the norm: f_ck above 50 (D4), alpha_cc outside 0.8 to 1.0
    for (const norm of [en1992, sia262]) {
        const message = only({ f_ck: '55' }, norm);
        assert.equal(message.key, 'check.norm');
        assert.equal(/** @type {any} */ (message.params).norm, norm.name);
        assert.equal(/** @type {any} */ (message.params).message.key,
                     'norm.f_ck_max');
    }
    for (const alpha_cc of ['0.79', '1.01']) {
        const inner = /** @type {any} */ (only({ alpha_cc: alpha_cc }).params)
            .message;
        assert.equal(inner.key, 'norm.alpha_cc');
        assert.equal(inner.params.alpha_cc, Number(alpha_cc));
    }
    assert.deepEqual(check_inputs(raw({ alpha_cc: '0,8' }), en1992).messages, []);
    // alpha_cc is not checked in the SIA mode
    assert.deepEqual(check_inputs(raw({ alpha_cc: '5' }), sia262).messages, []);
});

test('message_text: every message has a text in every language', () => {
    const cases = [
        check_inputs(raw({ h_: '', gamma_d: '', eta_t: '' }), sia262).messages,
        check_inputs(raw({ h_: 'abc', b_: '0', a_s1: '-1', d_2: '0.4' }),
                     en1992).messages,
        check_inputs(raw({ f_ck: '55', alpha_cc: '0.7' }), en1992).messages,
        check_inputs(raw({ f_ck: '55', eta_t: '0.9' }), sia262).messages,
    ];
    for (const lang of LANGUAGES) {
        const t = translator(lang);
        for (const messages of cases) {
            assert.ok(messages.length > 0);
            for (const message of messages) {
                const text = message_text(message, t);
                // all parameters are filled in
                assert.doesNotMatch(text, /[{}]|undefined|\[object/, text);
            }
        }
    }
    // numbers follow the decimal sign of the language
    const [message] = check_inputs(raw({ d_2: '0.4' }), en1992).messages;
    assert.match(message_text(message, de), /= 0,4 m.* h = 0,3 m/);
    assert.match(message_text(message, en), /= 0\.4 m.* h = 0\.3 m/);
    // the name of the input is the one of the language
    assert.ok(message_text(message, de).startsWith(de('name.d_2')));
    assert.ok(message_text(message, en).startsWith(en('name.d_2')));
    // a message of the norm names the norm
    const [norm_message] = check_inputs(raw({ f_ck: '55' }), en1992).messages;
    assert.ok(message_text(norm_message, en).startsWith('EN 1992-1-1: f_ck = 55'));

    // errors of the calculation
    assert.equal(error_text(new TextError('xls.not_a_number',
                                          { row: 4, cell: 'abc' }), en),
                 en('xls.not_a_number', { row: 4, cell: 'abc' }));
    assert.equal(error_text(new Error('other'), de), 'other');
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
        assert.notEqual(calculate(params, norm, null, { radial: true }), null);
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
    const result = calculate(params, en1992, null, { radial: true });
    for (const lang of LANGUAGES) {
        const t = translator(lang);
        const marked = figure(result.input_values, result.values, en1992, [], t,
                              { example: true, narrow: true });
        assert.equal(/** @type {any} */ (marked.layout).legend.title.text,
                     t('example.note'));
        assert.equal(marked.legend_lines[0], t('example.note'));
        const plain_figure = figure(result.input_values, result.values, en1992,
                                    [], t);
        assert.equal(/** @type {any} */ (plain_figure.layout).legend.title,
                     undefined);
        assert.equal(plain_figure.legend_lines.includes(t('example.note')), false);
    }
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

test('calculate: load points are gamma_d * value / 1000', () => {
    const { params } = check_inputs(raw(), en1992);
    const loads = loads_of([100, -50], [-1000, -2000]);
    const result = calculate(params, en1992, loads, { cult: true });
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
    assert.deepEqual(calculate(params, en1992, null, { cult: true }).points, []);
    // CULT-I switched off
    assert.equal(calculate(params, en1992, loads).points[0].cult, null);
});

test('calculate: values per metre are multiplied by the width', () => {
    const { params } = check_inputs(raw({ b_: '0.5' }), en1992);
    const [point] = calculate(params, en1992,
                              loads_of([100], [-1000], true)).points;
    assert.equal(point.m, 1.35 * (100 * 0.5) / 1000);
    assert.equal(point.n, 1.35 * (-1000 * 0.5) / 1000);
});

test('calculate: minimum eccentricity moves the load points (EN, D1)', () => {
    const { params } = check_inputs(raw({ eccentricity: true, gamma_d: '1' }),
                                    en1992);
    // e0 = max(h / 30; 20 mm) = 0.02 m for h = 0.30 m
    const loads = loads_of([10, 100, 0], [-1000, -1000, -1000]);
    const result = calculate(params, en1992, loads, { cult: true });
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
    const full = table(POINTS, de, { eccentricity: true, cult: true });
    assert.deepEqual(full.head_keys, ['table.nr', 'table.n', 'table.m',
        'table.m_mod', 'table.m_rel_i', 'table.n_rel_i', 'table.m_rel_max',
        'table.n_rel_max', 'table.m_ratio', 'table.n_ratio', 'table.cult',
        'table.hint']);
    assert.deepEqual(full.head, full.head_keys.map(key => de(key)));
    // German: decimal comma in all output
    assert.deepEqual(full.rows[0], ['1', '-1500,0', '100,00', '100,00',
        '200,00', '1250,0', '400,00', '2500,0',
        // the two ratios with three decimals: 0.2 / 0.4 and 1.25 / 2.5
        '0,500', '0,500', '0,500', '']);
    assert.deepEqual(full.rows[1], ['2', '-1000,0', '900,00', '900,00',
        '', '', '', '', '', '', de('cult.outside'), de('table.outside')]);
    assert.equal(full.rows[2][3], '60,00');
    assert.deepEqual(full.rows[2].slice(8, 12),
                     ['0,750', '1,200', '1,200', de('table.above')]);
    assert.deepEqual(full.marks, ['', 'outside', 'above']);
    // the values behind the cells, for sorting: numbers, not text
    assert.deepEqual(full.keys[0], [1, -1500, 100, 100, 200, 1250, 400, 2500,
                                    0.5, 0.5, 0.5, null]);
    assert.deepEqual(full.keys[1].slice(4), [null, null, null, null, null,
        null, null, de('table.outside')]);
    for (let i = 0; i < full.rows.length; i++) {
        assert.equal(full.rows[i].length, full.head.length);
        assert.equal(full.keys[i].length, full.head.length);
    }

    // English: decimal point, the same numbers behind the cells
    const english = table(POINTS, en, { eccentricity: true, cult: true });
    assert.deepEqual(english.head, english.head_keys.map(key => en(key)));
    assert.deepEqual(english.rows[0], ['1', '-1500.0', '100.00', '100.00',
        '200.00', '1250.0', '400.00', '2500.0', '0.500', '0.500', '0.500', '']);
    assert.deepEqual(english.keys[0], full.keys[0]);
    assert.deepEqual(english.marks, full.marks);

    // nothing switched on: inside / outside is still shown
    const short = table(POINTS, de);
    assert.deepEqual(short.head_keys, ['table.nr', 'table.n', 'table.m',
                                       'table.hint']);
    assert.deepEqual(short.rows[0], ['1', '-1500,0', '100,00', '']);
    assert.deepEqual(short.rows[1], ['2', '-1000,0', '900,00',
                                     de('table.outside')]);
    assert.deepEqual(short.marks, ['', 'outside', '']);

    // radial utilization only: one column, above 1 outside, not capped
    const radial = table(POINTS, de, { radial: true });
    assert.deepEqual(radial.head_keys, ['table.nr', 'table.n', 'table.m',
                                        'table.utilization', 'table.hint']);
    assert.deepEqual(radial.rows.map(row => row[3]), ['0,400', '2,500', '0,750']);
    assert.deepEqual(radial.keys.map(key => key[3]), [0.4, 2.5, 0.75]);
    // sorted by the utilization, descending: the point outside first
    assert.deepEqual(sort_order(radial.keys, 3, true), [1, 2, 0]);
    // both: the utilization stands before the columns of CULT-I
    const both = table(POINTS, de, { eccentricity: true, cult: true,
                                     radial: true });
    assert.equal(both.head_keys.indexOf('table.utilization'), 4);
    assert.equal(both.head_keys.indexOf('table.m_rel_i'), 5);
    assert.equal(both.head.length, full.head.length + 1);

    assert.equal(min_cult_I(POINTS), 'outside');
    assert.equal(min_cult_I([POINTS[0], POINTS[2]]), 0.5);
    assert.equal(min_cult_I([]), null);
    assert.equal(max_utilization(POINTS), 2.5);
    assert.equal(max_utilization([]), null);
});

test('summary_text: points inside and outside, largest and smallest value', () => {
    for (const lang of LANGUAGES) {
        const t = translator(lang);
        const counts = t('summary.points', { total: 3, inside: 2, outside: 1 });
        // nothing switched on: only the numbers of points
        assert.equal(summary_text(POINTS, t), counts);
        // CULT-I: the smallest value of the points inside
        assert.equal(summary_text(POINTS, t, { cult: true }), counts + ' ' +
                     t('summary.min_cult', { value: t.fmt(0.5, 3) }));
        // radial utilization: the largest value inside, and of all points
        // if there are points outside
        assert.equal(summary_text(POINTS, t, { radial: true }), counts + ' ' +
                     t('summary.max_inside', { value: t.fmt(0.75, 3) }) + ' ' +
                     t('summary.max_all', { value: t.fmt(2.5, 3) }));
        assert.equal(summary_text([POINTS[0], POINTS[2]], t,
                                  { cult: true, radial: true }),
                     t('summary.points', { total: 2, inside: 2, outside: 0 }) +
                     ' ' + t('summary.max_inside', { value: t.fmt(0.75, 3) }) +
                     ' ' + t('summary.min_cult', { value: t.fmt(0.5, 3) }));
        // only a point outside: no value of the points inside
        assert.equal(summary_text([POINTS[1]], t, { cult: true }),
                     t('summary.points', { total: 1, inside: 0, outside: 1 }));
        assert.equal(summary_text([], t, { cult: true, radial: true }), '');
    }
    assert.match(summary_text(POINTS, de, { radial: true }), /0,750.*2,500/);
    assert.match(summary_text(POINTS, en, { radial: true }), /0\.750.*2\.500/);
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
    const loads = loads_of([10, 900, 50, -900, 30],
                           [-1000, -1000, -2000, -1000, -3000]);
    const result = calculate(params, en1992, loads, { cult: true });
    const tab = table(result.points, en, { cult: true });
    const column = tab.head_keys.indexOf('table.cult');
    for (const descending of [false, true]) {
        const order = sort_order(tab.keys, column, descending);
        // every row once
        assert.deepEqual(order.slice().sort(), [0, 1, 2, 3, 4]);
        // the two points outside (2 and 4) are the last ones
        assert.deepEqual(order.slice(3), [1, 3]);
        const values = order.slice(0, 3).map(
            i => /** @type {number} */ (tab.keys[i][column]));
        for (let i = 1; i < values.length; i++) {
            assert.ok(descending ? values[i - 1] >= values[i] :
                                   values[i - 1] <= values[i]);
        }
        // the number of the point stays with its row
        for (const i of order) {
            assert.equal(tab.rows[i][0], String(i + 1));
        }
    }
});

test('figure: curves, the legend shows the f_cd that was used (N6)', () => {
    const { params } = check_inputs(raw({ alpha_cc: '0.85' }), en1992);
    const result = calculate(params, en1992, null);
    for (const lang of LANGUAGES) {
        const t = translator(lang);
        const fig = figure(result.input_values, result.values, en1992, [], t);
        const [comparison, governing] = /** @type {any[]} */ (fig.data);
        assert.equal(fig.data.length, 2);
        // f_cd = 0.85 * 30 / 1.5 = 17
        assert.ok(comparison.name.startsWith(
            `${t('draw.concrete_comparison')}<br>` +
            `${t('draw.f_cd', { f_cd: t.fmt(17, 2) })}<br>` +
            `h = ${t.num(0.3)} m<br>b = 1 m<br>d_1 = ${t.num(0.05)} m`));
        assert.ok(governing.name.startsWith(`${t('draw.reinforced')}<br>`));
        // the curve with reinforcement governs: solid and stronger than the
        // comparison line
        assert.equal(governing.line.dash, 'solid');
        assert.equal(comparison.line.dash, 'dash');
        assert.ok(governing.line.width > comparison.line.width);
        assert.notEqual(governing.line.color, comparison.line.color);
        const layout = /** @type {any} */ (fig.layout);
        assert.equal(layout.title.text, t('norm.en1992.label'));
        assert.equal(layout.xaxis.title.text, t('axis.m'));
        assert.equal(layout.yaxis.title.text, t('axis.n'));
        // decimal sign of the language on the axes, too
        assert.equal(layout.separators[0], t.decimal);
        // closed curve: both sides, in kN and kNm
        assert.equal(governing.x.length, result.values['Moment Reinf'].length +
                     result.values['Moment Reinf Neg'].length);
        assert.equal(governing.y[0],
                     result.values['Normal Force Reinf'][0] * 1000);
        assert.match(governing.text[0], /^M: .* kNm<br>N: .* kN$/);
    }
    assert.match(/** @type {any} */ (
        figure(result.input_values, result.values, en1992, [], de).data[0]).name,
        /f_cd = 17,00 N\/mm²/);
    assert.match(/** @type {any} */ (
        figure(result.input_values, result.values, en1992, [], en).data[0]).name,
        /f_cd = 17\.00 N\/mm²/);
});

test('figure: plain concrete section, one curve with the reduced f_cd (D7)', () => {
    const { params } = check_inputs(raw({ a_s1: '0', a_s2: '0' }), en1992);
    const result = calculate(params, en1992, null);
    for (const lang of LANGUAGES) {
        const t = translator(lang);
        const fig = figure(result.input_values, result.values, en1992, [], t);
        assert.equal(fig.data.length, 1);
        const [curve] = /** @type {any[]} */ (fig.data);
        // f_cd = alpha_cc,pl * 30 / 1.5 = 16
        assert.ok(curve.name.startsWith(`${t('draw.concrete_plain')}<br>` +
            `${t('draw.f_cd_reduced', { f_cd: t.fmt(16, 2) })}<br>`));
        // the only curve governs: solid
        assert.equal(curve.line.dash, 'solid');
        assert.ok(hints(en1992, result, null, t).includes(t('hint.plain_en')));
    }
});

test('figure: load points inside and outside are two traces with their numbers', () => {
    const { params } = check_inputs(raw({ gamma_d: '1' }), en1992);
    // the second and the fourth point are far outside of the curve
    const loads = loads_of([10, 900, 50, -900], [-1000, -1000, -2000, -1000]);
    for (const cult of [true, false]) {
        const result = calculate(params, en1992, loads, { cult: cult });
        assert.deepEqual(result.points.map(p => p.inside),
                         [true, false, true, false]);
        const fig = figure(result.input_values, result.values, en1992,
                           result.points, en);
        const [inside, outside] = /** @type {any[]} */ (fig.data.slice(2));
        assert.equal(fig.data.length, 4);
        assert.ok(inside.name.startsWith(
            en('draw.points_inside', { count: 2, total: 4 }) + '<br>' +
            en('draw.design_values', { gamma_d: 1 })));
        assert.ok(outside.name.startsWith(
            en('draw.points_outside', { count: 2, total: 4 }) + '<br>'));
        // in kNm
        assert.deepEqual(inside.x, [10, 50]);
        assert.deepEqual(outside.x, [900, -900]);
        assert.notEqual(inside.marker.color, outside.marker.color);
        // the smallest CULT-I is the one of the points inside
        assert.equal(inside.name.includes('CULT-I'), cult);
        assert.equal(outside.name.includes('CULT-I'), false);
        // the numbers of the points are the ones of the table
        assert.ok(outside.text[1].startsWith(
            en('draw.point', { number: 4 }) + '<br>'));
        assert.ok(outside.text[1].endsWith(en('draw.outside')));
    }

    // all points inside: no trace for points outside
    const all_inside = calculate(params, en1992, loads_of([10], [-1000]));
    const names = figure(all_inside.input_values, all_inside.values, en1992,
                         all_inside.points, de).data.map(
        trace => /** @type {any} */ (trace).name);
    assert.equal(names.length, 3);
    assert.ok(names[2].startsWith(
        de('draw.points_inside', { count: 1, total: 1 })));
});

test('figure: load points, ray of the minimum eccentricity (D1)', () => {
    const { params } = check_inputs(raw({ eccentricity: true, gamma_d: '1' }),
                                    en1992);
    const loads = loads_of([10, 100], [-1000, -1000]);
    const result = calculate(params, en1992, loads, { cult: true });
    for (const lang of LANGUAGES) {
        const t = translator(lang);
        const fig = figure(result.input_values, result.values, en1992,
                           result.points, t, { e0: result.e0 });
        const names = fig.data.map(trace => /** @type {any} */ (trace).name);
        assert.equal(names.length, 5);
        assert.equal(names[2], `${t('draw.min_eccentricity')}<br>` +
                               `e0 = ${t.fmt(0.02, 3)} m<br>`);
        assert.ok(names[3].startsWith(
            t('draw.points_inside', { count: 2, total: 2 })));
        assert.ok(names[3].includes(t('draw.min_cult', { value: '' }).trim()));
        assert.equal(names[4], t('draw.points_moved'));
        // the original points stay, only the moved point is drawn again
        const [, , ray, original, moved] = /** @type {any[]} */ (fig.data);
        assert.deepEqual(original.x, [10, 100]);
        assert.deepEqual(original.y, [-1000, -1000]);
        assert.deepEqual(moved.x, [20]);
        // the ray: M = e0 * N at the largest compression force
        assert.ok(Math.abs(ray.x[0] - -0.02 * ray.y[0]) < 1e-9);
        assert.deepEqual([ray.x[1], ray.y[1]], [0, 0]);
        // hover text of the moved point
        assert.ok(original.text[0].startsWith(
            `${t('draw.point', { number: 1 })}<br>M: ${t.fmt(10, 2)} kNm<br>` +
            `N: ${t.fmt(-1000, 1)} kN<br>` +
            t('draw.m_mod', { value: t.fmt(20, 2) })));

        // small screen: the legend is given as text, one line for each trace
        const narrow = figure(result.input_values, result.values, en1992,
                              result.points, t, { e0: result.e0, narrow: true });
        assert.equal(/** @type {any} */ (fig.layout).showlegend, undefined);
        assert.equal(/** @type {any} */ (narrow.layout).showlegend, false);
        assert.equal(/** @type {any} */ (narrow.layout).title.text, 'EN 1992-1-1');
        assert.equal(narrow.legend_lines.length, narrow.data.length);
        const colours = ['colour.comparison', 'colour.governing', 'colour.ray',
                         'colour.inside', 'colour.moved'];
        narrow.legend_lines.forEach((line, i) => {
            assert.ok(line.startsWith(t(colours[i]) + ': '), line);
            assert.equal(line.includes('<br>'), false);
        });
    }
});

test('radial utilization and CULT-I can be switched on and off', () => {
    const { params } = check_inputs(raw({ gamma_d: '1' }), en1992);
    // the second point is far outside of the curve
    const loads = loads_of([10, 900, 50], [-1000, -1000, -2000]);
    for (const lang of LANGUAGES) {
        const t = translator(lang);
        for (const [cult, radial] of [[true, true], [true, false],
                                      [false, true], [false, false]]) {
            const shown = { cult: cult, radial: radial };
            const result = calculate(params, en1992, loads, shown);
            assert.equal(result.radial_defined, true);
            // inside / outside is always determined
            assert.deepEqual(result.points.map(p => p.inside),
                             [true, false, true]);
            for (const p of result.points) {
                assert.equal(p.cult !== null, cult);
                assert.equal(p.utilization !== null, radial);
                if (p.utilization !== null) {
                    // below 1 inside, above 1 outside
                    assert.equal(p.utilization < 1, p.inside);
                }
            }
            const fig = figure(result.input_values, result.values, en1992,
                               result.points, t);
            const [inside, outside] = /** @type {any[]} */ (fig.data.slice(2));
            // legend and hover text name only what is switched on
            const utilization_label = t('draw.max_utilization', { value: '' });
            const cult_label = t('draw.min_cult', { value: '' });
            assert.equal(inside.name.includes(utilization_label), radial);
            assert.equal(outside.name.includes(utilization_label), radial);
            assert.equal(inside.name.includes(cult_label), cult);
            assert.equal(inside.text[0].includes(
                t('draw.utilization', { value: '' })), radial);
            assert.equal(inside.text[0].includes(
                t('draw.cult', { value: '' })), cult);
            assert.ok(outside.text[0].endsWith(t('draw.outside')));

            const tab = table(result.points, t, shown);
            assert.equal(tab.head_keys.includes('table.utilization'), radial);
            assert.equal(tab.head_keys.includes('table.cult'), cult);
            assert.equal(tab.head_keys.includes('table.m_ratio'), cult);
            assert.deepEqual(tab.marks, ['', 'outside', '']);

            const lines = hints(en1992, result, loads, t, shown);
            assert.equal(lines.includes(t('hint.radial')), radial);
            assert.equal(lines.includes(t('hint.radial_assumption')), radial);
            assert.equal(lines.includes(t('hint.cult')), cult);
            const summary = summary_text(result.points, t, shown);
            assert.ok(summary.startsWith(
                t('summary.points', { total: 3, inside: 2, outside: 1 })));
            assert.equal(summary.includes(
                t('summary.max_inside', { value: '' }).slice(0, -1)), radial);
            assert.equal(summary.includes(
                t('summary.min_cult', { value: '' }).slice(0, -1)), cult);
        }
    }
});

test('radial utilization: a load point of the calculation', () => {
    const { params } = check_inputs(raw({ gamma_d: '1' }), en1992);
    const curves_only = calculate(params, en1992, null, { radial: true });
    // a point of the curve as the load: utilization 1, half of it 0.5
    const m = curves_only.values['Moment Reinf'][20] * 1000;
    const n = curves_only.values['Normal Force Reinf'][20] * 1000;
    const result = calculate(params, en1992, loads_of([m, m / 2, 0], [n, n / 2, 0]),
                             { radial: true });
    const values = result.points.map(p => /** @type {number} */ (p.utilization));
    assert.ok(Math.abs(values[0] - 1) < 1e-9);
    assert.ok(Math.abs(values[1] - 0.5) < 1e-9);
    assert.equal(values[2], 0);
});

test('radial utilization: with the minimum eccentricity at the modified moment', () => {
    const { params } = check_inputs(raw({ eccentricity: true, gamma_d: '1' }),
                                    en1992);
    // e0 = 0.02 m: the first point is moved to M = 20 kNm, the second not
    const loads = loads_of([5, 100], [-1000, -1000]);
    const result = calculate(params, en1992, loads, { radial: true });
    const plain_points = calculate({ ...params, eccentricity: false }, en1992,
                                   loads_of([20, 100], [-1000, -1000]),
                                   { radial: true }).points;
    assert.equal(result.points[0].m_mod, 0.02);
    assert.equal(result.points[0].utilization, plain_points[0].utilization);
    assert.equal(result.points[1].utilization, plain_points[1].utilization);
    assert.ok(hints(en1992, result, loads, en, { radial: true }).includes(
        en('hint.radial_min_eccentricity')));
});

test('radial utilization: not defined for a plain concrete section', () => {
    for (const norm of [en1992, sia262]) {
        const { params } = check_inputs(raw({ a_s1: '0', a_s2: '0' }), norm);
        const loads = loads_of([10], [-1000]);
        const result = calculate(params, norm, loads, { radial: true });
        assert.equal(result.radial_defined, false);
        // no number, and a hint instead
        assert.equal(result.points[0].utilization, null);
        const lines = hints(norm, result, loads, de, { radial: true });
        assert.ok(lines.includes(de('hint.radial_undefined')));
        assert.equal(lines.includes(de('hint.radial_assumption')), false);
        // inside / outside is still determined
        assert.equal(result.points[0].inside, true);
        assert.equal(summary_text(result.points, de, { radial: true }),
                     de('summary.points', { total: 1, inside: 1, outside: 0 }));
    }
});

test('hints: norm, simplifications and the handling of the file', () => {
    const { params } = check_inputs(raw({ b_: '0.5' }), sia262);
    const loads = loads_of([100], [-1000], true);
    const result = calculate(params, sia262, loads, { cult: true });
    for (const lang of LANGUAGES) {
        const t = translator(lang);
        const lines = hints(sia262, result, loads, t, { cult: true });
        for (const key of ['norm.note.second_order', 'norm.note.k_sigma',
                           'hint.pivot_c', 'hint.sign', 'hint.cult']) {
            assert.ok(lines.includes(t(key)), key);
        }
        assert.ok(lines.includes(t('hint.steel', { limit: '12' })));
        assert.ok(lines.includes(t('hint.per_metre', { b: 0.5 })));
        assert.ok(lines.includes(t('hint.loads', { name: 'test.xlsx', count: 1,
                                                    gamma_d: 1.35 })));
        // f_cd with the numbers that were used
        assert.equal(lines[0], t('hint.f_cd_sia', {
            eta_fc: t.fmt(1, 3), eta_t: 0.85, f_ck: 30, gamma_c: 1.5,
            f_cd: t.fmt(17, 2) }));
        // every parameter is filled in
        for (const line of lines) {
            assert.doesNotMatch(line, /[{}]|undefined/, line);
        }
        // the title of the diagram names the norm
        const fig = figure(result.input_values, result.values, sia262,
                           result.points, t);
        assert.equal(/** @type {any} */ (fig.layout).title.text, 'SIA 262:2025');

        // EN mode: no hint of the SIA mode, none about the load points
        // without a file
        const checked = check_inputs(raw(), en1992);
        const en_lines = hints(en1992, calculate(checked.params, en1992, null),
                               null, t, { cult: true });
        assert.ok(en_lines.includes(t('norm.note.second_order')));
        assert.equal(en_lines.includes(t('norm.note.k_sigma')), false);
        assert.equal(en_lines.includes(t('hint.pivot_c')), false);
        assert.equal(en_lines.includes(t('hint.cult')), false);
    }
    // decimal sign of the language in the hints
    assert.match(hints(sia262, result, loads, de).join('\n'),
                 /= 1,000 · 0,85 · 30 \/ 1,5 = 17,00 N\/mm²/);
    assert.match(hints(sia262, result, loads, en).join('\n'),
                 /= 1\.000 · 0\.85 · 30 \/ 1\.5 = 17\.00 N\/mm²/);
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
    const loads = loads_of(x, y);
    for (const eccentricity of [false, true]) {
        const { params } = check_inputs(raw({ eccentricity: eccentricity }),
                                        en1992);
        const result = calculate(params, en1992, loads, { cult: true });
        const fig = figure(result.input_values, result.values, en1992,
                           result.points, en, { e0: result.e0 });
        const tab = table(result.points, en,
                          { eccentricity: eccentricity, cult: true });
        const column = tab.head_keys.indexOf('table.cult');
        /** @type {Map<number, string>} */
        const hover = new Map();
        for (const trace of /** @type {any[]} */ (fig.data)) {
            if (trace.mode !== 'markers' || trace.name === en('draw.points_moved')) {
                continue;
            }
            for (const text of trace.text) {
                const number = Number(/ (\d+)<br>/.exec(text)?.[1]);
                const cult = /CULT-I: ([\d.]+)/.exec(text);
                hover.set(number, cult ? cult[1] : en('cult.outside'));
            }
        }
        assert.equal(hover.size, result.points.length);
        result.points.forEach((p, i) => {
            const details = cult_I_details(p.m_mod, p.n, result.values);
            const core = (details === 'outside') ? en('cult.outside') :
                details.cult_I.toFixed(3);
            assert.equal(tab.rows[i][column], core, `point ${i + 1}, table`);
            assert.equal(hover.get(i + 1), core, `point ${i + 1}, hover`);
        });
        assert.ok(result.points.some(p => p.inside));
        assert.ok(result.points.some(p => !p.inside));
    }
});
