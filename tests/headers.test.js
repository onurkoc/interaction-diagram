// @ts-check
/*
Cache rules of Cloudflare Pages (app/_headers), see DEPLOY.md.

The tests check the rules against the files of app/: the app itself is
never used from the cache without asking, the libraries are kept, and no
file is matched by two rules (Cloudflare would join the two values).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const APP = new URL('../app/', import.meta.url);

/**
 * The rules of the file: path pattern and value of Cache-Control.
 * @returns {{pattern: string, cache: string}[]}
 */
function rules() {
    /** @type {{pattern: string, cache: string}[]} */
    const list = [];
    for (const line of readFileSync(new URL('_headers', APP), 'utf8').split(/\r?\n/)) {
        if (line.trim() === '' || line.startsWith('#')) {
            continue;
        }
        if (!/^\s/.test(line)) {
            list.push({ pattern: line.trim(), cache: '' });
        } else {
            const header = line.trim().match(/^Cache-Control:\s*(.*)$/);
            assert.ok(header, `only Cache-Control is expected: ${line}`);
            list[list.length - 1].cache = header[1];
        }
    }
    return list;
}

/**
 * Does the pattern match the path? A splat (*) matches everything, a
 * placeholder (:name) everything but "/".
 * @param {string} pattern
 * @param {string} path
 * @returns {boolean}
 */
function matches(pattern, path) {
    const source = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/:[A-Za-z]\w*/g, '[^/]+');
    return new RegExp(`^${source}$`).test(path);
}

/**
 * All files below app/, as paths of the web site.
 * @param {string} [folder]
 * @returns {string[]}
 */
function files(folder = '') {
    /** @type {string[]} */
    let list = [];
    for (const entry of readdirSync(new URL(folder, APP), { withFileTypes: true })) {
        if (entry.isDirectory()) {
            list = list.concat(files(`${folder}${entry.name}/`));
        } else if (entry.name !== '_headers') {
            list.push(`/${folder}${entry.name}`);
        }
    }
    return list;
}

test('_headers: at most one splat in a rule, every rule sets Cache-Control', () => {
    for (const rule of rules()) {
        assert.ok((rule.pattern.match(/\*/g) || []).length <= 1, rule.pattern);
        assert.notEqual(rule.cache, '', rule.pattern);
    }
});

test('_headers: every file of the app has exactly one rule', () => {
    const list = rules();
    // the page is also requested as "/"
    for (const path of files().concat(['/'])) {
        const found = list.filter(rule => matches(rule.pattern, path));
        assert.equal(found.length, 1,
                     `${path}: ${found.map(rule => rule.pattern).join(', ')}`);
        if (path.startsWith('/vendor/')) {
            // libraries are kept for a long time
            assert.match(found[0].cache, /max-age=31536000/, path);
        } else {
            // the app itself: the browser asks before it uses a copy
            assert.equal(found[0].cache, 'no-cache', path);
        }
    }
});
