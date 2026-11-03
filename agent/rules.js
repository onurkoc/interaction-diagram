// @ts-check
/*
Rules for agents that use the tools (R1 to R5), the instructions of the
server and the fixed words of the assessment.

The assessment is set by the server, not by the agent: an assumed value
makes the answer "not assessable", a value read from a figure or a
point outside of the curve makes it "needs attention". There is no
"in order": the tool is a pre-check, not a verification.
*/

/** @typedef {'not_assessable' | 'needs_attention' | 'no_finding' |
 *            'inputs_documented'} Status */

// R1 to R5, in every answer
export const RULES = {
    en: [
        'R1 Inputs only from the documents under review, each with its ' +
            'location (document, chapter / page / table / plan). Never ' +
            'derive an input from a result of the documents (capacity ' +
            'curve, utilization, required reinforcement).',
        'R2 If an essential value is missing or assumed, the result is ' +
            '"not assessable – information missing: …", never "in order".',
        'R3 N and M of a load point from the same place and the same load ' +
            'combination. Values read from a figure are marked as such; ' +
            'then the conclusion is at most "needs attention".',
        'R4 Units and sign convention stated explicitly. Compare the echo ' +
            'of the input (input_record) with the documents.',
        'R5 Pre-check, not a verification. Do not calculate yourself; the ' +
            'numbers of the tool are a hint to the reviewer, not a result ' +
            'for the review report.',
    ],
    de: [
        'R1 Eingaben nur aus den geprüften Unterlagen, jede mit Fundstelle ' +
            '(Dokument, Kapitel / Seite / Tabelle / Plan). Nie eine ' +
            'Eingabe aus einem Ergebnis der Unterlagen ableiten ' +
            '(Interaktionskurve, Ausnutzung, erforderliche Bewehrung).',
        'R2 Fehlt ein wesentlicher Wert oder ist er angenommen, lautet das ' +
            'Ergebnis «nicht beurteilbar – Angabe fehlt: …», nie «in Ordnung».',
        'R3 N und M eines Lastpunkts aus derselben Stelle und derselben ' +
            'Lastkombination. Aus Grafiken abgelesene Werte sind ' +
            'gekennzeichnet; der Schluss lautet dann höchstens «braucht ' +
            'Attention».',
        'R4 Einheiten und Vorzeichen ausdrücklich angeben. Das Echo der ' +
            'Eingabe (input_record) mit den Unterlagen vergleichen.',
        'R5 Vorprüfung, kein Nachweis. Nicht selbst rechnen; die Zahlen des ' +
            'Werkzeugs sind ein Hinweis an den Prüfer, kein Ergebnis für ' +
            'den Prüfbericht.',
    ],
};

// fixed words of the assessment, the reasons follow after the colon
const STATUS_TEXTS = {
    en: {
        not_assessable: 'not assessable – information missing',
        needs_attention: 'needs attention',
        no_finding: 'no finding (pre-check)',
        inputs_documented: 'inputs documented with their location (pre-check)',
    },
    de: {
        not_assessable: 'nicht beurteilbar – Angabe fehlt',
        needs_attention: 'braucht Attention',
        no_finding: 'keine Auffälligkeit (Vorprüfung)',
        inputs_documented: 'Eingaben mit Fundstelle belegt (Vorprüfung)',
    },
};

// reasons of the assessment, {name} etc. are replaced
const REASONS = {
    en: {
        assumed: '{name} (assumed)',
        figure: '{name} read from a figure',
        roles: 'combination «{combination}»: no load point with role ' +
            '{roles} (completeness of the governing pairs not shown)',
        outside: 'load point {index} outside of the capacity curve ' +
            '(utilization {utilization})',
        load_point: 'load point {index}',
        load_points: 'load points',
    },
    de: {
        assumed: '{name} (angenommen)',
        figure: '{name} aus Grafik abgelesen',
        roles: 'Kombination «{combination}»: kein Lastpunkt mit Rolle ' +
            '{roles} (Vollständigkeit der massgebenden Paare nicht belegt)',
        outside: 'Lastpunkt {index} ausserhalb der Interaktionskurve ' +
            '(Ausnutzung {utilization})',
        load_point: 'Lastpunkt {index}',
        load_points: 'Lastpunkte',
    },
};

/**
 * Text of a reason of the assessment.
 * @param {keyof typeof REASONS.en} key
 * @param {Object<string, string | number | null>} values
 * @param {string} language  'en' | 'de'
 * @returns {string}
 */
export function reason(key, values, language) {
    const texts = (language === 'de') ? REASONS.de : REASONS.en;
    return texts[key].replace(/\{(\w+)\}/g,
                              (_, name) => String(values[name]));
}

/**
 * Assessment of an answer.
 * @typedef {Object} Assessment
 * @property {Status} status
 * @property {string} text  the fixed words and the reasons; to be used
 *     as it is
 * @property {string[]} missing  assumed values (R2)
 * @property {string[]} attention  reasons for "needs attention"
 */

/**
 * The assessment: assumed values make it "not assessable", any other
 * reason "needs attention".
 * @param {string[]} missing  names of assumed values
 * @param {string[]} attention  reasons for attention
 * @param {Status} fine  status if there is nothing: 'no_finding' (loads
 *     checked) or 'inputs_documented' (curve only)
 * @param {string} language  'en' | 'de'
 * @returns {Assessment}
 */
export function assessment(missing, attention, fine, language) {
    const texts = (language === 'de') ? STATUS_TEXTS.de : STATUS_TEXTS.en;
    /** @type {Status} */
    let status = fine;
    let text = texts[fine];
    if (missing.length > 0) {
        status = 'not_assessable';
        text = `${texts.not_assessable}: ${missing.join('; ')}`;
    } else if (attention.length > 0) {
        status = 'needs_attention';
        text = `${texts.needs_attention}: ${attention.join('; ')}`;
    }
    return { status: status, text: text, missing: missing, attention: attention };
}

// instructions of the server, read by the agent when it connects
export const INSTRUCTIONS = [
    'Pre-check of rectangular reinforced concrete sections under normal ' +
        'force and bending (M-N interaction diagram), with the calculation ' +
        'of the web app https://interaction-diagram.onurkoc.net/. Not a ' +
        'verification with a recognised program.',
    '',
    'Scope: rectangle, two layers of reinforcement, N and M only, no ' +
        'second order effects, no shear, f_ck at most 50 N/mm2; norms ' +
        'EN 1992-1-1 without National Annex or SIA 262:2025. Shear is ' +
        'checked with the shear-check tool (not available here). Outside ' +
        'of this scope do not use the tools; report "not assessable with ' +
        'this tool".',
    '',
    'Rules, binding for every call:',
    ...RULES.en.map(rule => '- ' + rule),
    '',
    'Procedure:',
    '1. Norm: from the project basis of the documents; give its location ' +
        'in sources.norm.',
    '2. Section (h, b, cover, reinforcement, f_ck, f_yk, eta_t): read each ' +
        'value from the documents and give it in sources with document, ' +
        'location and kind (text | table | plan | figure_reading | ' +
        'assumed). Do not convert yourself: give the cover as cover_1 / ' +
        'cover_2 and the bars or meshes as bars_1 / bars_2, the tool ' +
        'calculates d and a_s and shows how. A value that is not in the ' +
        'documents is given with kind "assumed"; the answer is then "not ' +
        'assessable".',
    '3. Load points: prefer check_loads_file with the table exported by ' +
        'the program of the documents (all rows are checked). Otherwise ' +
        'check_loads: each point with N and M from the same row / place ' +
        'and load combination (source.combination), and for every ' +
        'combination the points with role max_N, min_N, max_M and min_M, ' +
        'each with the force that belongs to it. Values read from a ' +
        'figure: kind figure_reading.',
    '4. Comparison: if the documents state a capacity (M_Rd at N_Ed) or a ' +
        'utilization for a point, give it in document_values with its ' +
        'source; the answer lists both values and the deviation.',
    '5. Report: quote assessment.text as it is. Never write "in order", ' +
        '"OK" or "verified". List input_record next to the documents and ' +
        'the comparisons; the numbers of the tool are a hint to the ' +
        'reviewer.',
].join('\n');
