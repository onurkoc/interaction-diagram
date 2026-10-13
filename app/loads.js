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
