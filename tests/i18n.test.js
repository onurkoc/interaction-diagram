// @ts-check
/*
Texts of the interface (app/i18n.js): every language has the same keys,
and every key that the app uses exists.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TEXTS, LANGUAGES, translator, default_language } from '../app/i18n.js';
import { en1992 } from '../app/norms/en1992.js';
import { sia262 } from '../app/norms/sia262.js';

/**
 * Names of the parameters in a text, e.g. ['name', 'value'].
 * @param {string} text
 * @returns {string[]}
 */
function parameters(text) {
    return Array.from(text.matchAll(/\{(\w+)\}/g), match => match[1]).sort();
}

/**
 * Content of a file of the app.
 * @param {string} name  path below app/
 * @returns {string}
 */
function source(name) {
    return readFileSync(new URL('../app/' + name, import.meta.url), 'utf-8');
}

test('i18n: the languages German and English', () => {
    assert.deepEqual(LANGUAGES, ['de', 'en']);
    assert.equal(TEXTS['de']['decimal'], ',');
    assert.equal(TEXTS['en']['decimal'], '.');
});

test('i18n: every key exists in every language, with the same parameters', () => {
    const reference = Object.keys(TEXTS[LANGUAGES[0]]).sort();
    assert.ok(reference.length > 100);
    for (const lang of LANGUAGES) {
        assert.deepEqual(Object.keys(TEXTS[lang]).sort(), reference, lang);
        for (const key of reference) {
            const text = TEXTS[lang][key];
            assert.equal(typeof text, 'string', `${lang}: ${key}`);
            assert.notEqual(text.trim(), '', `${lang}: ${key}`);
            // the same {names} as in the first language
            assert.deepEqual(parameters(text),
                             parameters(TEXTS[LANGUAGES[0]][key]),
                             `${lang}: parameters of ${key}`);
        }
    }
});

test('i18n: every key used in the page and in the code exists', () => {
    const keys = new Set(Object.keys(TEXTS['de']));
    // index.html: data-i18n="key"
    const html = source('index.html');
    const in_page = Array.from(html.matchAll(/data-i18n="([^"]+)"/g), m => m[1]);
    assert.ok(in_page.length > 30);
    for (const key of in_page) {
        assert.ok(keys.has(key), `index.html: ${key}`);
    }
    // code: t('key'), TextError('key'), key: 'key'
    const files = readdirSync(new URL('../app/', import.meta.url))
        .filter(name => name.endsWith('.js') && name !== 'i18n.js')
        .concat(['norms/en1992.js', 'norms/sia262.js']);
    // keys have the form group.name; the two keys without a group are
    // checked below
    const pattern = /(?:\bt\(|TextError\(|key: |label: |\? |: )'((?:check|norm|core|xls|loads|file|app|draw|table|summary|hint|axis|colour|cult|example|messages|name|label)\.[\w.]*)'/g;
    let found = 0;
    for (const name of files) {
        for (const match of source(name).matchAll(pattern)) {
            // 'name.' is completed with the name of an input
            const key = match[1];
            if (key.endsWith('.')) {
                continue;
            }
            found++;
            assert.ok(keys.has(key), `${name}: ${key}`);
        }
    }
    assert.ok(found > 80, `only ${found} keys found in the code`);
    assert.ok(keys.has('title') && keys.has('placeholder'));
    // names of the inputs and the texts of the norms
    for (const field of ['h_', 'b_', 'd_1', 'd_2', 'a_s1', 'a_s2', 'f_ck', 'f_yk',
                         'gamma_c', 'gamma_s', 'gamma_d', 'alpha_cc',
                         'alpha_cc_pl']) {
        assert.ok(keys.has('name.' + field), field);
        if (field === 'gamma_c' || field === 'gamma_s') {
            // these two have the term of each norm
            assert.ok(keys.has('label.' + field + '.sia262'), field);
            assert.ok(keys.has('label.' + field + '.en1992'), field);
        } else {
            assert.ok(keys.has('label.' + field), field);
        }
    }
    for (const norm of [en1992, sia262]) {
        assert.ok(keys.has(norm.label), norm.label);
        for (const note of norm.notes) {
            assert.ok(keys.has(note), note);
        }
    }
});

test('i18n: no German text is left in the code of the app', () => {
    // texts belong into i18n.js; the calculation uses keys
    const files = readdirSync(new URL('../app/', import.meta.url))
        .filter(name => name.endsWith('.js') && name !== 'i18n.js')
        .concat(['norms/en1992.js', 'norms/sia262.js']);
    for (const name of files) {
        const code = source(name)
            // comments may name German words of the norms and of the page
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        assert.doesNotMatch(code, /[äöüÄÖÜß]/, name);
    }
});

test('translator: parameters and numbers in the decimal sign of the language', () => {
    const de = translator('de');
    const en = translator('en');
    assert.equal(de.lang, 'de');
    assert.equal(de.decimal, ',');
    assert.equal(en.decimal, '.');
    // numbers as they are, with the decimal sign
    assert.equal(de.num(1.35), '1,35');
    assert.equal(en.num(1.35), '1.35');
    assert.equal(de.num(30), '30');
    // fixed number of decimals
    assert.equal(de.fmt(0.5, 3), '0,500');
    assert.equal(en.fmt(0.5, 3), '0.500');
    assert.equal(de.fmt(-1500, 1), '-1500,0');
    // parameters: text as it is, numbers with the decimal sign,
    // [number, digits] with a fixed number of decimals
    assert.equal(de('check.positive', { name: 'x', value: 0.5 }),
                 TEXTS['de']['check.positive'].replace('{name}', 'x')
                     .replace('{value}', '0,5'));
    assert.match(en('check.positive', { name: 'x', value: 0.5 }), /^x = 0\.5:/);
    assert.match(de('label.gamma_d', { one: [1.0, 1] }), /\(1,0, /);
    assert.match(en('label.gamma_d', { one: [1.0, 1] }), /\(1\.0 /);
    assert.match(de('check.eta_t_missing', { a: [0.85, 2], b: [1.0, 1],
                                             c: [1.2, 1] }), /0,85 \/ 1,0 \/ 1,2/);
    // an unknown key or language is an error of the program, not a silent
    // empty text
    assert.throws(() => de('no.such.key'), /no\.such\.key/);
    assert.throws(() => translator('fr'), /fr/);
});

test('default_language: German for de, English otherwise', () => {
    for (const language of ['de', 'de-CH', 'de-AT', 'DE-de']) {
        assert.equal(default_language(language), 'de', language);
    }
    for (const language of ['en', 'en-GB', 'fr-CH', 'it', 'tr', 'del', '',
                            undefined, null]) {
        assert.equal(default_language(language), 'en', String(language));
    }
});
