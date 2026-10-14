// @ts-check
/*
Read load values from an Excel file (.xlsx)
Port of legacy/xls_read.py.

Expected table (first sheet, first row = column heads):
    n   normal force, compression negative
    m   moment, sign as in the file
Characteristic or design values, depending on the load factor that the
user enters; it is applied in loads.js.

Two kinds of tables are read, told apart by the unit in the column head:
    simple list     "n", "m" or "N [kN]", "M [kNm]"
                    forces of the cross-section
    Plaxis 2D       "N [kN/m]", "M [kN m/m]" (table of a plate)
                    forces per metre, to be multiplied by the width
                    (loads.js); the columns N_min, N_max, M_min, M_max
                    (envelopes) are not read

Column heads are recognised exactly (N8 in NOTES.md): the name has to
be n or m (upper or lower case), optionally followed by a unit in square
brackets. Other columns are ignored. An unknown unit is rejected.
legacy/xls_read.py looked for the letter in the name, so a head like
"Moment" matched both columns.
*/

import { TextError } from './errors.js';

/**
 * The part of the SheetJS library (vendor/xlsx-0.20.3.mjs) that is used here.
 * The library is passed as an argument, so this file can be type
 * checked without the library.
 * @typedef {Object} XlsxLibrary
 * @property {(data: ArrayBuffer | Uint8Array, opts?: Object) =>
 *     {SheetNames: string[], Sheets: Object<string, Object>}} read
 * @property {{sheet_to_json: (sheet: Object, opts?: Object) => any[][]}} utils
 */

/**
 * A recognised column head.
 * @typedef {Object} ColumnHead
 * @property {'n' | 'm'} name
 * @property {boolean} per_metre  true: unit per metre (Plaxis)
 */

// units of the columns, written without blanks and dots
const UNITS = {
    n: { total: 'kn', per_metre: 'kn/m' },
    m: { total: 'knm', per_metre: 'knm/m' },
};

/**
 * Which column is it? Exact recognition of the column head.
 * @param {any} head  content of a cell of the first row
 * @returns {ColumnHead | null} null: not one of the two columns
 */
export function column_head(head) {
    if (typeof head !== 'string') {
        return null;
    }
    // name, optionally followed by a unit in square brackets
    const match = /^([a-z]+)\s*(\[([^\]]*)\])?$/.exec(head.trim().toLowerCase());
    if (match === null) {
        return null;
    }
    const name = match[1];
    if (name !== 'n' && name !== 'm') {
        return null;
    }
    if (match[2] === undefined) {
        // no unit: forces of the cross-section
        return { name: name, per_metre: false };
    }
    // "kN m/m", "kN.m/m" and "kNm/m" are the same unit
    const unit = match[3].replace(/[\s.·*]/g, '');
    if (unit === UNITS[name].total) {
        return { name: name, per_metre: false };
    }
    if (unit === UNITS[name].per_metre) {
        return { name: name, per_metre: true };
    }
    throw new TextError((name === 'n') ? 'xls.unit_unknown_n' :
                                         'xls.unit_unknown_m',
                        { head: head.trim() });
}

/**
 * Is the cell empty?
 * @param {any} cell
 * @returns {boolean}
 */
function is_empty(cell) {
    return cell === undefined || cell === null ||
        (typeof cell === 'string' && cell.trim() === '');
}

/**
 * Value of a cell as a number. Text is accepted only if it is a plain
 * number with a decimal point; nothing is corrected silently.
 * @param {any} cell
 * @param {number} row  row number as in Excel, for the message
 * @returns {number}
 */
function to_number(cell, row) {
    let value = NaN;
    if (typeof cell === 'number') {
        value = cell;
    } else if (typeof cell === 'string') {
        value = Number(cell.trim());
    }
    if (!Number.isFinite(value)) {
        throw new TextError('xls.not_a_number', { row: row, cell: String(cell) });
    }
    return value;
}

/**
 * Read the columns m and n from the rows of a table.
 * @param {any[][]} rows  rows[0]: column heads, then one row per load point
 * @returns {[number[], number[], boolean]} x: moments, y: normal forces,
 *     per_metre: false: [kNm] and [kN], true: [kNm/m] and [kN/m]
 */
export function read_rows(rows) {
    if (rows.length === 0) {
        throw new TextError('xls.empty_table');
    }
    const heads = rows[0];
    let column_m = -1;
    let column_n = -1;
    let per_metre_m = false;
    let per_metre_n = false;
    for (let i = 0; i < heads.length; i++) {
        const head = column_head(heads[i]);
        if (head === null) {
            continue;
        }
        if (head.name === 'm') {
            if (column_m !== -1) {
                throw new TextError('xls.column_twice', { name: 'm' });
            }
            column_m = i;
            per_metre_m = head.per_metre;
        }
        if (head.name === 'n') {
            if (column_n !== -1) {
                throw new TextError('xls.column_twice', { name: 'n' });
            }
            column_n = i;
            per_metre_n = head.per_metre;
        }
    }
    if (column_m === -1 || column_n === -1) {
        const missing = (column_n === -1) ? 'n' : 'm';
        const found = heads.filter(head => !is_empty(head))
            .map(head => `«${head}»`).join(', ');
        throw new TextError('xls.column_missing',
                            { missing: missing, found: found });
    }
    if (per_metre_m !== per_metre_n) {
        throw new TextError('xls.units_mixed',
                            { n: String(heads[column_n]).trim(),
                              m: String(heads[column_m]).trim() });
    }

    /** @type {number[]} */
    const x = [];
    /** @type {number[]} */
    const y = [];
    for (let i = 1; i < rows.length; i++) {
        const row = i + 1;  // row number as in Excel
        const cell_m = rows[i][column_m];
        const cell_n = rows[i][column_n];
        if (is_empty(cell_m) && is_empty(cell_n)) {
            // empty row
            continue;
        }
        if (is_empty(cell_m) || is_empty(cell_n)) {
            throw new TextError('xls.value_missing', { row: row });
        }
        x.push(to_number(cell_m, row));
        y.push(to_number(cell_n, row));
    }
    if (x.length === 0) {
        throw new TextError('xls.no_values');
    }
    return [x, y, per_metre_n];
}

/**
 * Read the load values from the content of an .xlsx file.
 * @param {ArrayBuffer | Uint8Array} data  content of the file
 * @param {XlsxLibrary} XLSX  the SheetJS library
 * @returns {[number[], number[], boolean]} x: moments, y: normal forces,
 *     per_metre: false: [kNm] and [kN], true: [kNm/m] and [kN/m]
 */
export function read(data, XLSX) {
    const workbook = XLSX.read(data, { type: 'array' });
    // first sheet, like pandas.read_excel
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // rows as arrays, empty rows kept so that the row numbers are right
    const rows = XLSX.utils.sheet_to_json(
        sheet, { header: 1, raw: true, defval: null, blankrows: true });
    return read_rows(rows);
}
