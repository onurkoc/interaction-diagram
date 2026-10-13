// @ts-check
/*
Norm configuration: EN 1992-1-1 without National Annex (recommended values)
Clause numbers refer to EN 1992-1-1:2004 + AC:2010 + A1:2014.
Decisions D1..D7 and findings E1..E10: see NOTES.md.
*/

/**
 * Parameters a norm needs for the design strengths.
 * @typedef {Object} NormParams
 * @property {number} f_ck  [N/mm2]
 * @property {number} f_yk  [N/mm2]
 * @property {number} gamma_c
 * @property {number} gamma_s
 * @property {number} [alpha_cc]  EN only
 * @property {number} [alpha_cc_pl]  EN only, plain concrete
 * @property {number} [eta_t]  SIA only
 */

/**
 * How the strain planes of the interaction diagram are created.
 * legacy: the hand-typed arrays of core.py.
 * generated: pivot points A, B, C (see strain_planes.js).
 * @typedef {{type: 'legacy'} | {
 *     type: 'generated',
 *     pivot_c: boolean,
 *     tension_end: boolean,
 *     step: number,
 *     steps_c: number,
 * }} StrainPlaneOptions
 */

/**
 * @typedef {Object} Norm
 * @property {string} name  name of the norm, the same in all languages
 * @property {string} label  key of the text for the title of the diagram
 * @property {number} eps_c1  strain at the end of the parabola (positive)
 * @property {number} eps_cu  ultimate concrete strain (positive)
 * @property {number} eps_s_max  limit of the steel strain
 * @property {number} e_steel  [N/mm2]
 * @property {number} f_ck_max  largest f_ck the app accepts [N/mm2]
 * @property {Object<string, number>} defaults  preset input values
 * @property {string[]} inputs  norm specific inputs shown in the interface
 * @property {(p: NormParams) => number} f_cd
 * @property {(p: NormParams) => number} f_cd_plain  for a_s1 = a_s2 = 0 (D7)
 * @property {(p: NormParams) => number} f_yd
 * @property {((h: number) => number) | null} min_eccentricity  null: no rule
 * @property {StrainPlaneOptions} strain_planes
 * @property {(p: NormParams) => TextMessage[]} check  messages for invalid
 *     input, as keys of the texts in i18n.js with their parameters
 * @property {string[]} notes  hints shown in the interface, keys of the texts
 */

/** @typedef {import('../errors.js').TextMessage} TextMessage */

/** @type {Norm} */
export const en1992 = {
    name: 'EN 1992-1-1',
    label: 'norm.en1992.label',

    // parabola-rectangle diagram, 3.1.7 (1), n = 2
    eps_c1: 0.002,    // eps_c2, Tabelle 3.1 (up to C50/60)
    eps_cu: 0.0035,   // eps_cu2, Tabelle 3.1 (up to C50/60)

    // horizontal top branch, 3.2.7 (2) b: no strain limit required.
    // 0.012 is kept from core.py, permitted but not from the norm (D3)
    eps_s_max: 0.012,
    e_steel: 200000,  // 3.2.7 (4)

    // Tabelle 3.1: the strains above are valid up to f_ck = 50 (D4)
    f_ck_max: 50,

    defaults: {
        gamma_c: 1.5,      // 2.4.2.4, Tabelle 2.1N (persistent & transient)
        gamma_s: 1.15,     // 2.4.2.4, Tabelle 2.1N (persistent & transient)
        alpha_cc: 1.0,     // 3.1.6 (1), recommended value
        alpha_cc_pl: 0.8,  // 12.3.1 (1), recommended value
    },
    inputs: ['gamma_c', 'gamma_s', 'alpha_cc', 'alpha_cc_pl', 'eccentricity'],

    // 3.1.6 (1), Gl. (3.15)
    f_cd(p) {
        return p.f_ck / p.gamma_c * /** @type {number} */ (p.alpha_cc);
    },

    // plain concrete, 12.3.1 (1): alpha_cc,pl instead of alpha_cc
    f_cd_plain(p) {
        return p.f_ck / p.gamma_c * /** @type {number} */ (p.alpha_cc_pl);
    },

    // 3.2.7 (2), Bild 3.8
    f_yd(p) {
        return p.f_yk / p.gamma_s;
    },

    // 6.1 (4): e0 = h/30 >= 20 mm, h in m
    min_eccentricity(h) {
        return Math.max(h / 30, 0.02);
    },

    // 6.1 (5), 6.1 (6), Bild 6.1: pivot points A, B, C (D2),
    // C at (1 - eps_c2 / eps_cu2) * h, up to uniform tension
    strain_planes: { type: 'generated', pivot_c: true, tension_end: true,
                     step: 0.0003, steps_c: 10 },

    check(p) {
        /** @type {TextMessage[]} */
        const messages = [];
        if (p.f_ck > this.f_ck_max) {
            // Tabelle 3.1 (D4)
            messages.push({ key: 'norm.f_ck_max',
                            params: { f_ck: p.f_ck, f_ck_max: this.f_ck_max } });
        }
        if (p.alpha_cc === undefined || p.alpha_cc < 0.8 || p.alpha_cc > 1.0) {
            // 3.1.6 (1)
            messages.push({ key: 'norm.alpha_cc',
                            params: { alpha_cc: p.alpha_cc,
                                      low: [0.8, 1], high: [1.0, 1] } });
        }
        return messages;
    },

    notes: [],
};
