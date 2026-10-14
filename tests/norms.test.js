// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { int_diagram } from '../app/core.js';
import { en1992 } from '../app/norms/en1992.js';
import { sia262, eta_fc, eta_t_values } from '../app/norms/sia262.js';
import { assertClose, throwsKey } from './helpers.js';

test('SIA 262: f_cd of Tabelle 8 (eta_t = 1.0)', () => {
    // [f_ck, f_cd of Tabelle 8, tolerance]
    // The table is rounded to 0.5 N/mm2 up to C25/30 and to 0.1 N/mm2
    // from C30/37 (see NOTES.md). The formula is authoritative.
    const table_8 = [
        [12, 8.0, 0.25],
        [16, 10.5, 0.25],
        [20, 13.5, 0.25],
        [25, 16.5, 0.25],
        [30, 20.0, 0.05],
        [35, 23.3, 0.05],
        [40, 26.7, 0.05],
        [45, 28.8, 0.05],
        [50, 30.9, 0.05],
    ];
    for (const [f_ck, f_cd_table, tolerance] of table_8) {
        const f_cd = sia262.f_cd({ f_ck: f_ck, f_yk: 500, gamma_c: 1.5,
                                   gamma_s: 1.15, eta_t: 1.0 });
        assert.ok(Math.abs(f_cd - f_cd_table) <= tolerance,
                  `f_ck = ${f_ck}: f_cd = ${f_cd}, Tabelle 8: ${f_cd_table}`);
    }
});

test('SIA 262: eta_fc is 1.0 up to f_ck = 40 and smaller above', () => {
    assert.equal(eta_fc(25), 1.0);
    assert.equal(eta_fc(40), 1.0);
    assert.ok(eta_fc(50) < 1.0);
    assertClose(eta_fc(50), (40 / 50) ** (1 / 3), 'eta_fc(50)');
});

test('SIA 262: eta_t has no silent preset', () => {
    const p = { f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15 };
    throwsKey(() => sia262.f_cd(p), 'norm.eta_t_missing');
    throwsKey(() => int_diagram({ f_ck: 30 }, sia262), 'norm.eta_t');
    assert.equal(sia262.defaults.eta_t, undefined);
});

test('SIA 262: f_cd is proportional to eta_t', () => {
    const p = { f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15 };
    const f_cd_1 = sia262.f_cd({ ...p, eta_t: 1.0 });
    for (const eta_t of eta_t_values) {
        assertClose(sia262.f_cd({ ...p, eta_t: eta_t }), eta_t * f_cd_1,
                    `eta_t = ${eta_t}`);
    }
});

test('plain concrete: reduced f_cd (D7)', () => {
    const p = { f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15 };
    // SIA 197 7.6.2.2: 0.8 * f_cd
    const sia = { ...p, eta_t: 0.85 };
    assertClose(sia262.f_cd_plain(sia), 0.8 * sia262.f_cd(sia), 'SIA');
    // EN 12.3.1 (1): alpha_cc_pl instead of alpha_cc
    const en = { ...p, alpha_cc: 1.0, alpha_cc_pl: 0.8 };
    assertClose(en1992.f_cd_plain(en), 0.8 * en1992.f_cd(en), 'EN');
    assert.equal(en1992.defaults.alpha_cc_pl, 0.8);
});

test('f_yd = f_yk / gamma_s in both norms', () => {
    const p = { f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15 };
    assertClose(en1992.f_yd(p), 500 / 1.15, 'EN');
    assertClose(sia262.f_yd(p), 500 / 1.15, 'SIA');
});

test('check: f_ck above 50 is reported in both norms (D4)', () => {
    const p = { f_yk: 500, gamma_c: 1.5, gamma_s: 1.15,
                alpha_cc: 1.0, eta_t: 0.85 };
    assert.deepEqual(en1992.check({ ...p, f_ck: 50 }), []);
    assert.deepEqual(sia262.check({ ...p, f_ck: 50 }), []);
    assert.equal(en1992.check({ ...p, f_ck: 55 }).length, 1);
    assert.equal(sia262.check({ ...p, f_ck: 55 }).length, 1);
});

test('check: alpha_cc (EN) and eta_t (SIA) outside the permitted values', () => {
    const p = { f_ck: 30, f_yk: 500, gamma_c: 1.5, gamma_s: 1.15 };
    assert.equal(en1992.check({ ...p, alpha_cc: 0.8 }).length, 0);
    assert.equal(en1992.check({ ...p, alpha_cc: 0.7 }).length, 1);
    assert.equal(en1992.check({ ...p, alpha_cc: 1.1 }).length, 1);
    assert.equal(sia262.check({ ...p, eta_t: 1.2 }).length, 0);
    assert.equal(sia262.check({ ...p, eta_t: 0.9 }).length, 1);
    assert.equal(sia262.check(p).length, 1);
});

test('minimum eccentricity: EN has a rule, SIA has none', () => {
    assert.equal(sia262.min_eccentricity, null);
    assert.notEqual(en1992.min_eccentricity, null);

    // SIA mode rejects the eccentricity option, no silent correction
    throwsKey(
        () => int_diagram({ f_ck: 30, eta_t: 0.85, eccentricity: true },
                          sia262),
        'core.no_min_eccentricity', { norm: 'SIA 262:2025' });
});

test('SIA and EN give the same curves for the same f_cd', () => {
    // up to f_ck = 40 eta_fc is 1.0, so eta_t takes the role of alpha_cc
    for (const factor of [1.0, 0.85]) {
        const section = { h_: 0.30, d_1: 0.05, d_2: 0.05, a_s1: 5.24,
                          a_s2: 5.24, f_ck: 30 };
        const en = int_diagram({ ...section, alpha_cc: factor }, en1992);
        const sia = int_diagram({ ...section, eta_t: factor }, sia262);
        assert.notEqual(en, null);
        assert.notEqual(sia, null);
        const values_en = /** @type {any} */ (en)[1];
        const values_sia = /** @type {any} */ (sia)[1];
        for (const key of Object.keys(values_en)) {
            assertClose(values_sia[key], values_en[key], `${factor} ${key}`);
        }
    }
});
