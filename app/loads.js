// @ts-check
/*
Load points for the interaction diagram.
*/

/**
 * Forces of the cross-section from forces per metre (Plaxis 2D):
 * value * width.
 * @param {number[]} x  moments [kNm/m]
 * @param {number[]} y  normal forces [kN/m]
 * @param {number} b_  width of the cross-section [m]
 * @returns {[number[], number[]]} moments [kNm], normal forces [kN]
 */
export function section_forces(x, y, b_) {
    if (!Number.isFinite(b_) || b_ <= 0) {
        throw new Error(`Die Breite b = ${b_} ist unzulässig (b > 0).`);
    }
    const m = x.map(value => value * b_);
    const n = y.map(value => value * b_);
    return [m, n];
}

/**
 * Design values of the load points for the diagram
 * (as in legacy/App.py: gamma_d * x / 1000).
 * @param {number[]} x  moments [kNm], characteristic
 * @param {number[]} y  normal forces [kN], characteristic
 * @param {number} gamma_d  load factor
 * @returns {[number[], number[]]} moments [MNm], normal forces [MN]
 */
export function design_values(x, y, gamma_d) {
    const m = x.map(value => gamma_d * value / 1000);
    const n = y.map(value => gamma_d * value / 1000);
    return [m, n];
}

/**
 * The whole chain from the values of the table (xls_read.js) to the
 * load points of the diagram: forces per metre are multiplied by the
 * width first, then the load factor is applied.
 * @param {number[]} x  moments as read, [kNm] or [kNm/m]
 * @param {number[]} y  normal forces as read, [kN] or [kN/m]
 * @param {boolean} per_metre  true: values per metre (Plaxis 2D)
 * @param {number} b_  width of the cross-section [m]
 * @param {number} gamma_d  load factor
 * @returns {[number[], number[]]} moments [MNm], normal forces [MN]
 */
export function load_points(x, y, per_metre, b_, gamma_d) {
    if (per_metre) {
        [x, y] = section_forces(x, y, b_);
    }
    return design_values(x, y, gamma_d);
}
