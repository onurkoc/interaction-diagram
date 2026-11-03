// @ts-check
/*
Sources of the inputs (R1 to R4): every value of the section and every
load point has to say where it comes from. Missing or invalid sources
are rejected; assumed values and values read from a figure are passed
on to the assessment (rules.js).

Two conversions are done here, so that the agent does not calculate:
    cover_i  ->  d_i = c_nom + transverse diameter + bar diameter / 2
    bars_i   ->  a_s_i = b * sum of the areas per metre of the items
The answer shows both with their inputs.
*/
import { reason } from './rules.js';

/**
 * Where a value comes from.
 * @typedef {Object} Source
 * @property {string} document  e.g. number and title of the report
 * @property {string} location  chapter, page, table or plan
 * @property {string} kind  one of KINDS
 */

/**
 * Where a load point comes from: also the load combination.
 * @typedef {Source & {combination: string}} LoadSource
 */

/**
 * One line of the echo of the input.
 * @typedef {Object} RecordRow
 * @property {string} name
 * @property {number | string} value
 * @property {string} unit
 * @property {string} document
 * @property {string} location
 * @property {string} kind
 * @property {string} [derived]  how the value was calculated from the inputs
 */

// how a value was obtained; there is no kind for a value derived from a
// result of the documents (R1)
export const KINDS = ['text', 'table', 'plan', 'figure_reading', 'assumed'];

// roles of a load point within its load combination, in the sign
// convention of the call
export const ROLES = ['max_N', 'min_N', 'max_M', 'min_M', 'other'];
export const ENVELOPE_ROLES = ['max_N', 'min_N', 'max_M', 'min_M'];

// section inputs that need a source if they are given
const DIRECT_INPUTS = ['h', 'b', 'f_ck', 'f_yk', 'eta_t', 'gamma_c',
                       'gamma_s', 'alpha_cc', 'alpha_cc_pl'];

const UNITS = /** @type {Object<string, string>} */ ({
    h: 'm', b: 'm', d_1: 'm', d_2: 'm', a_s1: 'cm2', a_s2: 'cm2',
    f_ck: 'N/mm2', f_yk: 'N/mm2', eta_t: '-', gamma_c: '-', gamma_s: '-',
    alpha_cc: '-', alpha_cc_pl: '-',
});

/**
 * Round a converted value, so that the echo shows 0.044 and not
 * 0.044000000000000004 (well below any precision of the input).
 * @param {number} value
 * @returns {number}
 */
function rounded(value) {
    return Math.round(value * 1e9) / 1e9;
}

/**
 * Is it a text with content?
 * @param {unknown} value
 * @returns {value is string}
 */
function is_text(value) {
    return typeof value === 'string' && value.trim() !== '';
}

/**
 * Is it a finite number, at least `min`?
 * @param {unknown} value
 * @param {number} min
 * @returns {value is number}
 */
function is_number(value, min) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min;
}

/**
 * Check a source; its problems are added to errors.
 * @param {string} name  for the message
 * @param {unknown} source
 * @param {string[]} errors
 * @param {boolean} [with_combination]  a load point: also the combination
 * @returns {Source | null}
 */
export function check_source(name, source, errors, with_combination = false) {
    const fields = with_combination ? 'document, location, combination, kind'
                                    : 'document, location, kind';
    if (source === undefined || source === null || typeof source !== 'object') {
        errors.push(`${name}: the source is required (${fields}).`);
        return null;
    }
    const s = /** @type {Object<string, unknown>} */ (source);
    const before = errors.length;
    const required = with_combination ? ['document', 'location', 'combination']
                                      : ['document', 'location'];
    for (const field of required) {
        if (!is_text(s[field])) {
            errors.push(`${name}.${field}: a text is required.`);
        }
    }
    if (typeof s.kind !== 'string' || !KINDS.includes(s.kind)) {
        errors.push(`${name}.kind: ${JSON.stringify(s.kind)} is not known, ` +
                    `use one of ${KINDS.join(' | ')}. A value derived from a ` +
                    'result of the documents is not allowed (R1).');
    }
    if (errors.length > before) {
        return null;
    }
    return /** @type {Source} */ (s);
}

/**
 * Reasons for the assessment, collected while the sources are checked.
 * @typedef {Object} Notes
 * @property {string[]} missing  assumed values
 * @property {string[]} attention  values read from a figure, ...
 * @property {string} language  of the texts
 */

/**
 * Collect assumed values and values read from a figure.
 * @param {string} name
 * @param {Source} source
 * @param {Notes} notes
 */
export function note_kind(name, source, notes) {
    if (source.kind === 'assumed') {
        notes.missing.push(reason('assumed', { name: name }, notes.language));
    } else if (source.kind === 'figure_reading') {
        notes.attention.push(reason('figure', { name: name }, notes.language));
    }
}

/**
 * The section of the call with sources, as the inputs of the tool.
 * @typedef {Object} SectionSources
 * @property {Object<string, any>} values  h, b, d_1, ... as numbers,
 *     d_i and a_s_i converted from cover_i and bars_i if given so
 * @property {RecordRow[]} record  echo of the inputs with their sources
 * @property {string[]} missing  assumed values
 * @property {string[]} attention  values read from a figure
 */

/**
 * Check the sources of the section and convert cover and bars.
 * Problems are added to errors; the caller throws.
 * @param {Object<string, any>} args  input of the tool
 * @param {Object<string, number>} presets  presets of the app
 *     (norm.defaults), used for the inputs that are not given
 * @param {string} language  of the reasons
 * @param {string[]} errors
 * @returns {SectionSources}
 */
export function section_sources(args, presets, language, errors) {
    /** @type {Object<string, any>} */
    const values = {};
    /** @type {RecordRow[]} */
    const record = [];
    /** @type {Notes} */
    const notes = { missing: [], attention: [], language: language };
    const { missing, attention } = notes;

    const sources = args.sources;
    if (sources === undefined || sources === null || typeof sources !== 'object') {
        errors.push('sources is required: for every value of the section ' +
                    'its document, location and kind (R1).');
        return { values, record, missing, attention };
    }
    /** @type {Set<string>} */
    const needed = new Set(['norm']);

    /**
     * Source of a value given in the call.
     * @param {string} name  key in sources
     * @returns {Source | null}
     */
    const source_of = (name) => {
        needed.add(name);
        const source = check_source(`sources.${name}`, sources[name], errors);
        if (source !== null) {
            note_kind(name, source, notes);
        }
        return source;
    };

    /**
     * @param {string} name
     * @param {number | string} value
     * @param {Source | null} source
     * @param {string} [derived]
     */
    const add_row = (name, value, source, derived) => {
        if (source === null) {
            return;
        }
        /** @type {RecordRow} */
        const row = { name: name, value: value, unit: UNITS[name] ?? '-',
                      document: source.document, location: source.location,
                      kind: source.kind };
        if (derived !== undefined) {
            row.derived = derived;
        }
        record.push(row);
    };

    add_row('norm', args.norm, source_of('norm'));
    for (const name of DIRECT_INPUTS) {
        if (args[name] !== undefined && args[name] !== null) {
            values[name] = args[name];
            add_row(name, args[name], source_of(name));
        } else if (name in presets) {
            record.push({ name: name, value: presets[name],
                          unit: UNITS[name] ?? '-', document: 'preset of the app',
                          location: '-', kind: 'preset' });
        }
    }

    for (const layer of ['1', '2']) {
        // axis distance: given, or from the cover
        const d = `d_${layer}`;
        const cover = `cover_${layer}`;
        if (args[d] !== undefined && args[cover] !== undefined) {
            errors.push(`${d} and ${cover}: give only one of them.`);
        } else if (args[cover] !== undefined) {
            const source = source_of(cover);
            const c = args[cover];
            if (c === null || typeof c !== 'object' || !is_number(c.c_nom, 0) ||
                !is_number(c.bar_diameter, 0) || c.bar_diameter === 0 ||
                !is_number(c.transverse_diameter, 0)) {
                errors.push(`${cover}: c_nom [m], bar_diameter [mm] > 0 and ` +
                            'transverse_diameter [mm] (0 if none) are ' +
                            'required, as finite numbers >= 0.');
            } else {
                values[d] = rounded(c.c_nom + c.transverse_diameter / 1000 +
                                    c.bar_diameter / 2000);
                add_row(d, values[d], source,
                        `c_nom + transverse diameter + bar diameter / 2 = ` +
                        `${c.c_nom} m + ${c.transverse_diameter} mm + ` +
                        `${c.bar_diameter} mm / 2`);
            }
        } else if (args[d] !== undefined) {
            values[d] = args[d];
            add_row(d, args[d], source_of(d));
        }

        // reinforcement: given, or from bars and meshes
        const a_s = `a_s${layer}`;
        const bars = `bars_${layer}`;
        if (args[a_s] !== undefined && args[bars] !== undefined) {
            errors.push(`${a_s} and ${bars}: give only one of them.`);
        } else if (args[bars] !== undefined) {
            bar_area(args, layer, values, record, notes, errors);
        } else if (args[a_s] !== undefined) {
            values[a_s] = args[a_s];
            add_row(a_s, args[a_s], source_of(a_s));
        }
    }

    // a source that belongs to no input is rejected, not ignored
    for (const name of Object.keys(sources)) {
        if (!needed.has(name)) {
            errors.push(`sources.${name}: not an input of this call.`);
        }
    }
    return { values, record, missing, attention };
}

/**
 * a_s of a layer from its bars and meshes: each item is
 * {diameter_mm, spacing_m} or {area_cm2_per_m}, with its own source.
 * a_s = b * sum of the areas per metre.
 * @param {Object<string, any>} args
 * @param {string} layer  '1' | '2'
 * @param {Object<string, any>} values
 * @param {RecordRow[]} record
 * @param {Notes} notes
 * @param {string[]} errors
 */
function bar_area(args, layer, values, record, notes, errors) {
    const name = `bars_${layer}`;
    const items = args[name];
    if (!Array.isArray(items) || items.length === 0) {
        errors.push(`${name}: a list with at least one item is required ` +
                    '({diameter_mm, spacing_m} or {area_cm2_per_m}, each ' +
                    'with its source); for no reinforcement give ' +
                    `a_s${layer} = 0.`);
        return;
    }
    if (!is_number(args.b, 0) || args.b === 0) {
        // the check of the app reports the width
        return;
    }
    let per_metre = 0;
    /** @type {string[]} */
    const parts = [];
    items.forEach((item, i) => {
        const item_name = `${name}[${i}]`;
        if (item === null || typeof item !== 'object') {
            errors.push(`${item_name}: an object is required.`);
            return;
        }
        const source = check_source(`${item_name}.source`, item.source, errors);
        const by_bars = item.diameter_mm !== undefined || item.spacing_m !== undefined;
        const by_area = item.area_cm2_per_m !== undefined;
        /** @type {number | null} */
        let area = null;
        let text = '';
        if (by_bars === by_area) {
            errors.push(`${item_name}: give either diameter_mm and spacing_m ` +
                        'or area_cm2_per_m.');
        } else if (by_bars) {
            if (!is_number(item.diameter_mm, 0) || item.diameter_mm === 0 ||
                !is_number(item.spacing_m, 0) || item.spacing_m === 0) {
                errors.push(`${item_name}: diameter_mm and spacing_m have to ` +
                            'be finite numbers > 0.');
            } else {
                // mm2 per bar / spacing [m] = mm2/m; / 100 = cm2/m
                area = Math.PI * item.diameter_mm ** 2 / 4 / item.spacing_m / 100;
                text = `Ø ${item.diameter_mm} mm / ${item.spacing_m} m`;
            }
        } else if (!is_number(item.area_cm2_per_m, 0)) {
            errors.push(`${item_name}: area_cm2_per_m has to be a finite ` +
                        'number >= 0.');
        } else {
            area = item.area_cm2_per_m;
            text = `${item.area_cm2_per_m} cm2/m`;
        }
        if (source === null || area === null) {
            return;
        }
        note_kind(item_name, source, notes);
        per_metre += area;
        parts.push(text);
        record.push({ name: item_name, value: rounded(area), unit: 'cm2/m',
                      document: source.document, location: source.location,
                      kind: source.kind,
                      derived: by_bars ? `π · Ø² / 4 / spacing = ${text}`
                                       : undefined });
    });
    if (parts.length !== items.length) {
        return;
    }
    const a_s = `a_s${layer}`;
    values[a_s] = rounded(args.b * per_metre);
    record.push({ name: a_s, value: values[a_s], unit: 'cm2',
                  document: `see ${name}`, location: '-', kind: 'derived',
                  derived: `b · sum of ${name} = ${args.b} m · ` +
                           `(${parts.join(' + ')})` });
}

/**
 * A load point of the call with its source.
 * @typedef {Object} LoadInput
 * @property {number} N
 * @property {number} M
 * @property {LoadSource} source
 * @property {string} [role]  one of ROLES
 * @property {{M_Rd?: number, utilization?: number, source: Source}}
 *     [document_values]  capacity or utilization stated in the documents
 */

/**
 * Check the sources, roles and document values of the load points, and
 * whether every load combination has its four envelope roles.
 * @param {unknown[]} loads
 * @param {string} language  of the reasons
 * @param {string[]} errors
 * @returns {Notes}
 */
export function load_sources(loads, language, errors) {
    /** @type {Notes} */
    const notes = { missing: [], attention: [], language: language };
    /** @type {Map<string, Set<string>>} */
    const roles = new Map();
    loads.forEach((point, i) => {
        const p = /** @type {Object<string, any>} */ (point ?? {});
        const name = `loads[${i}]`;
        const source = check_source(`${name}.source`, p.source, errors, true);
        if (source !== null) {
            note_kind(reason('load_point', { index: i + 1 }, language),
                      source, notes);
            const combination = /** @type {LoadSource} */ (source).combination.trim();
            if (!roles.has(combination)) {
                roles.set(combination, new Set());
            }
            if (p.role !== undefined) {
                /** @type {Set<string>} */ (roles.get(combination)).add(p.role);
            }
        }
        if (p.role !== undefined && !ROLES.includes(p.role)) {
            errors.push(`${name}.role: ${JSON.stringify(p.role)} is not known, ` +
                        `use one of ${ROLES.join(' | ')}.`);
        }
        if (p.document_values !== undefined) {
            const d = p.document_values;
            const has_m = d?.M_Rd !== undefined;
            const has_u = d?.utilization !== undefined;
            if (!has_m && !has_u) {
                errors.push(`${name}.document_values: give M_Rd or utilization.`);
            }
            if (has_m && !is_number(d.M_Rd, -Infinity)) {
                errors.push(`${name}.document_values.M_Rd: a finite number is required.`);
            }
            if (has_u && !is_number(d.utilization, 0)) {
                errors.push(`${name}.document_values.utilization: a finite ` +
                            'number >= 0 is required.');
            }
            check_source(`${name}.document_values.source`, d?.source, errors);
        }
    });
    for (const [combination, given] of roles) {
        const lacking = ENVELOPE_ROLES.filter(role => !given.has(role));
        if (lacking.length > 0) {
            notes.attention.push(reason('roles', { combination: combination,
                                                   roles: lacking.join(', ') },
                                        language));
        }
    }
    return notes;
}
