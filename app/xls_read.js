// @ts-check
/*
Read load values from an Excel file (.xlsx)
Port of legacy/xls_read.py.

Expected table (first sheet, first row = column heads):
    n   normal force [kN], compression negative
    m   moment [kNm]
Characteristic values; the load factor is applied in loads.js.

Column heads are recognised exactly (N8 in NOTES.md): the name has to
be n or m (upper or lower case), optionally followed by a unit in square
brackets, e.g. "n", "N [kN]", "m [kNm]". Other columns are ignored.
legacy/xls_read.py looked for the letter in the name, so a head like
"Moment" matched both columns.
*/

/**
 * The part of the SheetJS library (vendor/xlsx.mjs) that is used here.
 * The library is passed as an argument, so this file can be type
 * checked without the library.
 * @typedef {Object} XlsxLibrary
 * @property {(data: ArrayBuffer | Uint8Array, opts?: Object) =>
 *     {SheetNames: string[], Sheets: Object<string, Object>}} read
 * @property {{sheet_to_json: (sheet: Object, opts?: Object) => any[][]}} utils
 */

/**
 * Which column is it? Exact recognition of the column head.
 * @param {any} head  content of a cell of the first row
 * @returns {'n' | 'm' | null} null: not one of the two columns
 */
export function column_name(head) {
    if (typeof head !== 'string') {
        return null;
    }
    // name, optionally followed by a unit in square brackets
    const match = /^([a-z]+)\s*(\[[^\]]*\])?$/.exec(head.trim().toLowerCase());
    if (match === null) {
        return null;
    }
    if (match[1] === 'n' || match[1] === 'm') {
        return match[1];
    }
    return null;
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
        throw new Error(`Zeile ${row}: «${cell}» ist keine Zahl. ` +
                        'Zelle als Zahl formatieren.');
    }
    return value;
}

/**
 * Read the columns m and n from the rows of a table.
 * @param {any[][]} rows  rows[0]: column heads, then one row per load point
 * @returns {[number[], number[]]} x: moments [kNm], y: normal forces [kN]
 */
export function read_rows(rows) {
    if (rows.length === 0) {
        throw new Error('Die Tabelle ist leer.');
    }
    const heads = rows[0];
    let column_m = -1;
    let column_n = -1;
    for (let i = 0; i < heads.length; i++) {
        const name = column_name(heads[i]);
        if (name === 'm') {
            if (column_m !== -1) {
                throw new Error('Die Spalte «m» kommt mehrfach vor.');
            }
            column_m = i;
        }
        if (name === 'n') {
            if (column_n !== -1) {
                throw new Error('Die Spalte «n» kommt mehrfach vor.');
            }
            column_n = i;
        }
    }
    if (column_m === -1 || column_n === -1) {
        const missing = (column_n === -1) ? 'n' : 'm';
        const found = heads.filter(head => !is_empty(head))
            .map(head => `«${head}»`).join(', ');
        throw new Error(`Die Spalte «${missing}» fehlt. ` +
                        'Erwartet werden die Spaltenköpfe «n» und «m». ' +
                        `Gefunden: ${found}.`);
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
            throw new Error(`Zeile ${row}: Ein Wert fehlt ` +
                            '(n und m müssen beide angegeben sein).');
        }
        x.push(to_number(cell_m, row));
        y.push(to_number(cell_n, row));
    }
    if (x.length === 0) {
        throw new Error('Die Tabelle enthält keine Werte.');
    }
    return [x, y];
}

/**
 * Read the load values from the content of an .xlsx file.
 * @param {ArrayBuffer | Uint8Array} data  content of the file
 * @param {XlsxLibrary} XLSX  the SheetJS library
 * @returns {[number[], number[]]} x: moments [kNm], y: normal forces [kN]
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
