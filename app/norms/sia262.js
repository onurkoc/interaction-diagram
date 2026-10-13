// @ts-check
/*
Norm configuration: SIA 262:2025
Clause numbers refer to SIA 262:2025 unless stated otherwise.
Decisions D1..D7 and findings: see NOTES.md.
*/

import { TextError } from '../errors.js';

/** @typedef {import('./en1992.js').Norm} Norm */
/** @typedef {import('./en1992.js').NormParams} NormParams */
/** @typedef {import('../errors.js').TextMessage} TextMessage */

/**
 * eta_fc, 4.2.1.2, Gl. (26)
 * @param {number} f_ck  [N/mm2]
 * @returns {number}
 */
export function eta_fc(f_ck) {
    return Math.min(Math.cbrt(40 / f_ck), 1.0);
}

// eta_t, 4.2.1.3: 1.0 / 0.85 / 1.2 (impact)
export const eta_t_values = [1.0, 0.85, 1.2];

// the three values as parameters of the messages, in the order of the
// interface; [number, digits] so that 1.0 keeps its decimal
export const ETA_T_CHOICE = { a: [0.85, 2], b: [1.0, 1], c: [1.2, 1] };

// The user has to choose eta_t, there is no silent preset.
// Suggestion for shotcrete, which is usually loaded early.
export const eta_t_suggestion = 0.85;

/** @type {Norm} */
export const sia262 = {
    name: 'SIA 262:2025',
    label: 'norm.sia262.label',

    // 4.2.1.5, Figur 12 and 4.2.1.6, Gl. (27).
    // The app uses k_sigma = 2 (parabola), a deliberate simplification
    // of Gl. (27), so the closed formulas of core.js stay valid.
    eps_c1: 0.002,    // eps_c1d, Tabelle 8
    eps_cu: 0.0035,   // eps_c2d, Tabelle 8

    // ideal plastic, k_s = 1.0: 4.2.2.5, Figur 16.
    // 0.012 is kept from core.py, permitted but not from the norm (D3)
    eps_s_max: 0.012,
    e_steel: 200000,  // 3.2.2.4, Figur 16

    // decision D4, same limit as in the EN mode
    f_ck_max: 50,

    defaults: {
        gamma_c: 1.5,   // 2.4.2.6
        gamma_s: 1.15,  // 2.4.2.6
    },
    inputs: ['gamma_c', 'gamma_s', 'eta_t'],

    // 2.4.2.3, Gl. (2)
    f_cd(p) {
        if (p.eta_t === undefined) {
            // 4.2.1.3
            throw new TextError('norm.eta_t_missing', ETA_T_CHOICE);
        }
        return eta_fc(p.f_ck) * p.eta_t * p.f_ck / p.gamma_c;
    },

    // plain concrete in underground structures:
    // SIA 197:2023 7.6.2.2, f_cd reduced by 20 % (SIA 262 0.1.8, 5.5.1.2)
    f_cd_plain(p) {
        return 0.8 * this.f_cd(p);
    },

    // 2.4.2.5, Gl. (4)
    f_yd(p) {
        return p.f_yk / p.gamma_s;
    },

    // SIA 262 has no general minimum eccentricity for sections.
    // 4.3.7.5, Gl. (75) is for compression members with second order
    // effects only, they are not covered by this app.
    min_eccentricity: null,

    // SIA 262 does not regulate the pivot point C. The app uses it
    // by analogy to EN 1992-1-1 6.1 (5) as a conservative assumption (D5).
    strain_planes: { type: 'generated', pivot_c: true, tension_end: true,
                     step: 0.0003, steps_c: 10 },

    check(p) {
        /** @type {TextMessage[]} */
        const messages = [];
        if (p.f_ck > this.f_ck_max) {
            // decision D4
            messages.push({ key: 'norm.f_ck_max',
                            params: { f_ck: p.f_ck, f_ck_max: this.f_ck_max } });
        }
        if (p.eta_t === undefined || !eta_t_values.includes(p.eta_t)) {
            // 4.2.1.3
            messages.push({ key: 'norm.eta_t',
                            params: { eta_t: p.eta_t, ...ETA_T_CHOICE } });
        }
        return messages;
    },

    notes: ['norm.note.second_order', 'norm.note.k_sigma'],
};
