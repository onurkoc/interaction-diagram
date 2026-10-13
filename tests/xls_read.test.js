// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '../app/vendor/xlsx.mjs';
import { column_head, read_rows, read } from '../app/xls_read.js';
import { design_values, section_forces, load_points } from '../app/loads.js';

/**
 * Content of an .xlsx file with one sheet.
 * @param {any[][]} rows
 * @returns {ArrayBuffer}
 */
function xlsx_file(rows) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows));
    return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

test('xls_read: file as in the README (heads n and m)', () => {
    const data = xlsx_file([
        ['n', 'm'],
        [-1000, 100],
        [-1500, -100],
    ]);
    const [x, y, per_metre] = read(data, XLSX);
    assert.deepEqual(x, [100, -100]);
    assert.deepEqual(y, [-1000, -1500]);
    assert.equal(per_metre, false);
});

test('xls_read: column heads are recognised exactly (N8)', () => {
    const n = { name: 'n', per_metre: false };
    const m = { name: 'm', per_metre: false };
    assert.deepEqual(column_head('n'), n);
    assert.deepEqual(column_head('N'), n);
    assert.deepEqual(column_head(' m '), m);
    assert.deepEqual(column_head('N [kN]'), n);
    assert.deepEqual(column_head('m [kNm]'), m);
    assert.deepEqual(column_head('m [kN.m]'), m);
    // not by a letter inside the name
    assert.equal(column_head('Moment'), null);
    assert.equal(column_head('Normalkraft'), null);
    assert.equal(column_head('Element'), null);
    assert.equal(column_head('Name'), null);
    assert.equal(column_head('mx'), null);
    assert.equal(column_head(''), null);
    assert.equal(column_head(null), null);
    assert.equal(column_head(5), null);
});

test('xls_read: the unit in the column head tells the kind of table', () => {
    const n = { name: 'n', per_metre: true };
    const m = { name: 'm', per_metre: true };
    // as written by Plaxis 2D
    assert.deepEqual(column_head('              N [kN/m]'), n);
    assert.deepEqual(column_head('            M [kN m/m]'), m);
    assert.deepEqual(column_head('M[kNm/m]'), m);
    // the envelopes of Plaxis are not the columns n and m
    assert.equal(column_head('          N_min [kN/m]'), null);
    assert.equal(column_head('       M_max [kN m/m]'), null);
    assert.equal(column_head('              Q [kN/m]'), null);
    // an unknown unit is rejected, not read as kN
    assert.throws(() => column_head('N [MN]'),
                  /Spalte «N \[MN\]»: Die Einheit ist nicht bekannt/);
    assert.throws(() => column_head('M [kN/m]'), /Einheit ist nicht bekannt/);
    assert.throws(() => column_head('N [kNm]'), /Einheit ist nicht bekannt/);
    assert.throws(() => column_head('n []'), /Einheit ist nicht bekannt/);
});

test('xls_read: table of a plate from Plaxis 2D', () => {
    // column heads as written by Plaxis 2D, values made up
    const data = xlsx_file([
        ['     Structural element', ' Node', 'Local number',
         '                 X [m]', '                 Y [m]',
         '              N [kN/m]', '          N_min [kN/m]',
         '         N_max [kN/m]', '              Q [kN/m]',
         '          Q_min [kN/m]', '         Q_max [kN/m]',
         '            M [kN m/m]', '        M_min [kN m/m]',
         '       M_max [kN m/m]'],
        ['           Plate\\_1\\_1', 101, 1, 0, -2, -400, -410, 0,
         40, 0, 45, -20, -25, 0],
        ['    Element 1-1 (Plate)', 102, 2, 0.1, -2, -390.5, -410, 0,
         30, 0, 45, -10.25, -25, 1],
        // the end node of an element is also the first of the next one
        ['           Plate\\_2\\_1', 102, 1, 0.1, -2, -380, -410, 0,
         35, 0, 45, -10.25, -25, 1],
        ['    Element 2-2 (Plate)', 103, 2, 0.2, -2, -370, -410, 0,
         -5, -6, 45, 15, -25, 16],
    ]);
    const [x, y, per_metre] = read(data, XLSX);
    // N and M of the phase; all rows, also the node that comes twice
    assert.deepEqual(x, [-20, -10.25, -10.25, 15]);
    assert.deepEqual(y, [-400, -390.5, -380, -370]);
    assert.equal(per_metre, true);
});

test('xls_read: units per metre and not per metre are not mixed', () => {
    assert.throws(() => read_rows([['N [kN]', 'M [kNm/m]'], [-100, 10]]),
                  /Einheiten passen nicht zusammen: «N \[kN\]» und «M \[kNm\/m\]»/);
    assert.throws(() => read_rows([['N [kN/m]', 'm'], [-100, 10]]),
                  /Einheiten passen nicht zusammen/);
});

test('xls_read: order of the columns and other columns do not matter', () => {
    const [x, y] = read_rows([
        ['Element', 'M [kNm]', 'Name', 'N [kN]'],
        [1, 10, 'a', -100],
        [2, 20, 'b', -200],
    ]);
    assert.deepEqual(x, [10, 20]);
    assert.deepEqual(y, [-100, -200]);
});

test('xls_read: a head like "Moment" is not taken for a column', () => {
    // legacy/xls_read.py took "Moment" for n and for m
    assert.throws(() => read_rows([['Moment', 'N'], [10, -100]]),
                  /Spalte «m» fehlt/);
    assert.throws(() => read_rows([['M', 'Normal'], [10, -100]]),
                  /Spalte «n» fehlt/);
});

test('xls_read: a column that exists twice is rejected', () => {
    assert.throws(() => read_rows([['n', 'm', 'N [kN]'], [-1, 2, -3]]),
                  /«n» kommt mehrfach vor/);
    assert.throws(() => read_rows([['n', 'm', 'M'], [-1, 2, 3]]),
                  /«m» kommt mehrfach vor/);
});

test('xls_read: empty rows are skipped, the row number is as in Excel', () => {
    const data = xlsx_file([
        ['n', 'm'],
        [-1000, 100],
        [null, null],
        [-1500, 'abc'],
    ]);
    assert.throws(() => read(data, XLSX), /Zeile 4: «abc» ist keine Zahl/);

    const [x, y] = read(xlsx_file([['n', 'm'], [-1000, 100], [null, null],
                                   [-1500, -100]]), XLSX);
    assert.deepEqual(x, [100, -100]);
    assert.deepEqual(y, [-1000, -1500]);
});

test('xls_read: values are not corrected silently', () => {
    // a missing value
    assert.throws(() => read_rows([['n', 'm'], [-1000, null]]),
                  /Zeile 2: Ein Wert fehlt/);
    // decimal comma in a text cell: rejected with the row number and a hint
    assert.throws(
        () => read_rows([['n', 'm'], [-1, 2], ['-1000,5', 100]]),
        /Zeile 3: «-1000,5» ist keine Zahl\. Zelle als Zahl formatieren\./);
    // a number stored as text is accepted
    const [x, y] = read_rows([['n', 'm'], ['-1000.5', ' 100 ']]);
    assert.deepEqual(x, [100]);
    assert.deepEqual(y, [-1000.5]);
});

test('xls_read: empty tables are rejected', () => {
    assert.throws(() => read_rows([]), /leer/);
    assert.throws(() => read_rows([['n', 'm']]), /keine Werte/);
    assert.throws(() => read_rows([['n', 'm'], [null, null]]), /keine Werte/);
});

test('loads: forces per metre are multiplied by the width', () => {
    const [m, n] = section_forces([10, -20], [-100, -400], 0.5);
    assert.deepEqual(m, [10 * 0.5, -20 * 0.5]);
    assert.deepEqual(n, [-100 * 0.5, -400 * 0.5]);
    // width 1 m: same numbers
    assert.deepEqual(section_forces([10], [-100], 1), [[10], [-100]]);
    assert.throws(() => section_forces([10], [-100], 0), /Breite/);
    assert.throws(() => section_forces([10], [-100], -1), /Breite/);
    assert.throws(() => section_forces([10], [-100], NaN), /Breite/);
});

test('loads: whole chain from the file to the load points, width not 1 m', () => {
    const b_ = 0.5;
    const gamma_d = 1.35;

    // Plaxis 2D, per metre: gamma_d * (value * b) / 1000
    const plaxis = xlsx_file([
        ['              N [kN/m]', '            M [kN m/m]'],
        [-400, -20],
        [-390.5, 15],
    ]);
    let [x, y, per_metre] = read(plaxis, XLSX);
    let [m, n] = load_points(x, y, per_metre, b_, gamma_d);
    assert.deepEqual(m, [gamma_d * (-20 * b_) / 1000,
                         gamma_d * (15 * b_) / 1000]);
    assert.deepEqual(n, [gamma_d * (-400 * b_) / 1000,
                         gamma_d * (-390.5 * b_) / 1000]);

    // simple list, forces of the cross-section: the width is not applied
    const list = xlsx_file([
        ['N [kN]', 'M [kNm]'],
        [-400, -20],
        [-390.5, 15],
    ]);
    [x, y, per_metre] = read(list, XLSX);
    [m, n] = load_points(x, y, per_metre, b_, gamma_d);
    assert.deepEqual(m, [gamma_d * -20 / 1000, gamma_d * 15 / 1000]);
    assert.deepEqual(n, [gamma_d * -400 / 1000, gamma_d * -390.5 / 1000]);

    // the width is checked only where it is used
    assert.throws(() => load_points([10], [-100], true, 0, gamma_d), /Breite/);
});

test('loads: design values are gamma_d * value / 1000', () => {
    const [m, n] = design_values([100, -100], [-1000, -1500], 1.35);
    assert.deepEqual(m, [1.35 * 100 / 1000, 1.35 * -100 / 1000]);
    assert.deepEqual(n, [1.35 * -1000 / 1000, 1.35 * -1500 / 1000]);
});
