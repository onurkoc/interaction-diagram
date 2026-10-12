// @ts-check
/*
Load points for the interaction diagram.
*/

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
