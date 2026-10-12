// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '../app/vendor/xlsx.mjs';
import { column_name, read_rows, read } from '../app/xls_read.js';
import { design_values } from '../app/loads.js';

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
    const [x, y] = read(data, XLSX);
    assert.deepEqual(x, [100, -100]);
    assert.deepEqual(y, [-1000, -1500]);
});

test('xls_read: column heads are recognised exactly (N8)', () => {
    assert.equal(column_name('n'), 'n');
    assert.equal(column_name('N'), 'n');
    assert.equal(column_name(' m '), 'm');
    assert.equal(column_name('N [kN]'), 'n');
    assert.equal(column_name('m [kNm]'), 'm');
    assert.equal(column_name('m [kN.m]'), 'm');
    assert.equal(column_name('M[kNm/m]'), 'm');
    // not by a letter inside the name
    assert.equal(column_name('Moment'), null);
    assert.equal(column_name('Normalkraft'), null);
    assert.equal(column_name('Element'), null);
    assert.equal(column_name('Name'), null);
    assert.equal(column_name('mx'), null);
    assert.equal(column_name(''), null);
    assert.equal(column_name(null), null);
    assert.equal(column_name(5), null);
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

test('loads: design values are gamma_d * value / 1000', () => {
    const [m, n] = design_values([100, -100], [-1000, -1500], 1.35);
    assert.deepEqual(m, [1.35 * 100 / 1000, 1.35 * -100 / 1000]);
    assert.deepEqual(n, [1.35 * -1000 / 1000, 1.35 * -1500 / 1000]);
});
