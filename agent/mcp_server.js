// @ts-check
/*
MCP server (stdio) for agents: interaction diagram and radial
utilization with the modules of the app (../app).

It is a pre-check, not a verification with a recognised program.
The rules for the agent (R1 to R5) are sent as the instructions of the
server and in every answer (rules.js). The program is server.js.
*/
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { interaction_diagram, check_loads, check_loads_file, ToolInputError,
         DISCLAIMER } from './tools.js';
import { KINDS, ROLES } from './sources.js';
import { INSTRUCTIONS } from './rules.js';

const NOTE = `${DISCLAIMER}. Uses the calculation of the web app ` +
    'https://interaction-diagram.onurkoc.net/ (rectangular reinforced ' +
    'concrete section, two layers, no second order effects, no shear). ' +
    'Every input needs its source (R1); the answer has an assessment set ' +
    'by the tool, quote assessment.text as it is (R2, R5). Invalid input ' +
    'is rejected with the messages of the app, nothing is corrected.';

const KIND = z.enum(/** @type {[string, ...string[]]} */ (KINDS)).describe(
    'how the value was obtained: text | table | plan (read from the ' +
    'documents), figure_reading (read from a figure: at most "needs ' +
    'attention"), assumed (not in the documents: "not assessable"). A ' +
    'value derived from a result of the documents is not allowed (R1).');

const SOURCE = z.object({
    document: z.string().describe('document, e.g. number and title of the report'),
    location: z.string().describe('chapter, page, table or plan'),
    kind: KIND,
});

const LOAD_SOURCE = z.object({
    document: z.string().describe('document, e.g. number and title of the report'),
    location: z.string().describe(
        'page, table and row; N and M of the point from this same place (R3)'),
    combination: z.string().describe('load combination, e.g. "LK2 ULS"'),
    kind: KIND,
});

const COVER = z.object({
    c_nom: z.number().describe('concrete cover [m]'),
    bar_diameter: z.number().describe('diameter of the bars of the layer [mm]'),
    transverse_diameter: z.number().describe(
        'diameter of transverse bars between cover and layer [mm], 0 if none'),
});

const BARS = z.array(z.union([
    z.object({
        diameter_mm: z.number(),
        spacing_m: z.number(),
        source: SOURCE,
    }),
    z.object({
        area_cm2_per_m: z.number().describe('e.g. of a mesh, from its list'),
        source: SOURCE,
    }),
]));

// inputs of all tools
const SECTION = {
    norm: z.enum(['en1992', 'sia262']).describe(
        'en1992: EN 1992-1-1 without National Annex; sia262: SIA 262:2025; ' +
        'as in the project basis (sources.norm)'),
    h: z.number().describe('height [m]'),
    b: z.number().describe('width [m]'),
    d_1: z.number().optional().describe(
        'axis distance of a_s1 from its edge [m]; or give cover_1'),
    d_2: z.number().optional().describe(
        'axis distance of a_s2 from its edge [m]; or give cover_2'),
    cover_1: COVER.optional().describe(
        'instead of d_1: the tool calculates d_1 = c_nom + transverse ' +
        'diameter + bar diameter / 2'),
    cover_2: COVER.optional().describe('instead of d_2, as cover_1'),
    a_s1: z.number().optional().describe(
        'reinforcement, layer 1 [cm2] in the width b; or give bars_1'),
    a_s2: z.number().optional().describe(
        'reinforcement, layer 2 [cm2] in the width b; or give bars_2'),
    bars_1: BARS.optional().describe(
        'instead of a_s1: bars {diameter_mm, spacing_m} and meshes ' +
        '{area_cm2_per_m}, each with its source; a_s1 = b * sum'),
    bars_2: BARS.optional().describe('instead of a_s2, as bars_1'),
    f_ck: z.number().describe('[N/mm2], at most 50'),
    f_yk: z.number().describe('[N/mm2]'),
    gamma_c: z.number().optional().describe(
        'partial factor concrete; preset of the app if not given (1.5)'),
    gamma_s: z.number().optional().describe(
        'partial factor steel; preset of the app if not given (1.15)'),
    alpha_cc: z.number().optional().describe(
        'EN only, 0.8 to 1.0; preset of the app if not given (1.0)'),
    alpha_cc_pl: z.number().optional().describe(
        'EN only, plain concrete; preset of the app if not given (0.8)'),
    eta_t: z.number().optional().describe(
        'SIA only and required there: 1.0, 0.85 or 1.2 (SIA 262 4.2.1.3)'),
    sources: z.object({
        norm: SOURCE,
        h: SOURCE,
        b: SOURCE,
        d_1: SOURCE.optional(),
        d_2: SOURCE.optional(),
        cover_1: SOURCE.optional(),
        cover_2: SOURCE.optional(),
        a_s1: SOURCE.optional(),
        a_s2: SOURCE.optional(),
        f_ck: SOURCE,
        f_yk: SOURCE,
        gamma_c: SOURCE.optional(),
        gamma_s: SOURCE.optional(),
        alpha_cc: SOURCE.optional(),
        alpha_cc_pl: SOURCE.optional(),
        eta_t: SOURCE.optional(),
    }).describe('required: the source of every value given above, under ' +
                'its name (bars_1 / bars_2 carry their own sources)'),
    force_unit: z.enum(['kN', 'MN']).describe(
        'required: unit of N in the input and in the answer'),
    moment_unit: z.enum(['kNm', 'MNm']).describe(
        'required: unit of M in the input and in the answer'),
    compression: z.enum(['negative', 'positive']).describe(
        'required: sign of a compressive normal force, in the input and ' +
        'in the answer. M > 0 always means tension on the side of a_s1.'),
    language: z.enum(['en', 'de']).optional().describe(
        'language of the texts of the answer, default en'),
};

const FACTORS = {
    gamma_d: z.number().describe(
        'required load factor, all loads are multiplied by it; 1.0 if ' +
        'the loads are design values'),
    min_eccentricity: z.boolean().optional().describe(
        'EN only: minimum eccentricity e0 = max(h/30; 20 mm) on the load ' +
        'points (EN 1992-1-1 6.1 (4)); default true in EN, as in the app. ' +
        'true with SIA is rejected.'),
};

const LOADS = {
    loads: z.array(z.object({
        N: z.number(),
        M: z.number(),
        source: LOAD_SOURCE,
        role: z.enum(/** @type {[string, ...string[]]} */ (ROLES)).optional()
            .describe('role within its combination, sign convention of the ' +
                      'call; every combination needs max_N, min_N, max_M, ' +
                      'min_M, else "needs attention"'),
        document_values: z.object({
            M_Rd: z.number().optional().describe(
                'capacity at N_Ed stated in the documents, in moment_unit ' +
                'and with its sign'),
            utilization: z.number().optional().describe(
                'utilization stated in the documents'),
            source: SOURCE,
        }).optional().describe('values of the documents for this point, ' +
                               'the answer compares them (R5: no limit)'),
    })).describe(
        'load points, in force_unit / moment_unit and the sign convention ' +
        'of compression'),
    ...FACTORS,
};

const FILE = {
    file: z.string().describe(
        'absolute path of an .xlsx file: first sheet, columns n and m with ' +
        'units in the head as in the app ("N [kN]", "M [kNm]", or per ' +
        'metre "N [kN/m]", "M [kN m/m]" of Plaxis 2D), compression ' +
        'negative, M as in the file'),
    file_source: LOAD_SOURCE.describe(
        'where the table comes from (document, phase / table, combination)'),
    ...FACTORS,
};

/**
 * Answer of a tool as JSON text, an invalid input as an error.
 * @param {() => Object<string, any>} run
 * @returns {{content: {type: 'text', text: string}[], isError?: boolean}}
 */
function answer(run) {
    try {
        return { content: [{ type: 'text', text: JSON.stringify(run(), null, 1) }] };
    } catch (error) {
        const text = (error instanceof ToolInputError)
            ? 'Input rejected:\n' + error.message
            : 'Error: ' + String(error);
        return { content: [{ type: 'text', text: text }], isError: true };
    }
}

/**
 * The server with its tools, not yet connected.
 * @returns {McpServer}
 */
export function create_server() {
    const server = new McpServer({ name: 'interaction-diagram', version: '2.0.0' },
                                 { instructions: INSTRUCTIONS });

    server.registerTool('interaction_diagram', {
        title: 'M-N interaction diagram',
        description: 'Capacity curve N-M (with reinforcement, both sides) ' +
            'and f_cd, f_yd of a rectangular reinforced concrete section. ' +
            NOTE,
        inputSchema: SECTION,
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (args) => answer(() => interaction_diagram(args)));

    server.registerTool('check_loads', {
        title: 'Check load points (radial utilization)',
        description: 'For each load point (N, M) with its source: inside / ' +
            'outside of the capacity curve, the radial utilization ' +
            '|S_d| / |R_d| as in the app, M_Rd at N_Ed, the comparison with ' +
            'the values of the documents, and the governing point. Prefer ' +
            'check_loads_file if the table of the documents is available. ' +
            NOTE,
        inputSchema: { ...SECTION, ...LOADS },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (args) => answer(() => check_loads(args)));

    server.registerTool('check_loads_file', {
        title: 'Check all load points of a table (.xlsx)',
        description: 'As check_loads for every row of an .xlsx table (e.g. ' +
            'exported from Plaxis 2D), read with the import of the app; the ' +
            'agent does not copy any value. The tool marks the points with ' +
            'max_N, min_N, max_M and min_M. ' + NOTE,
        inputSchema: { ...SECTION, ...FILE },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (args) => answer(() => check_loads_file(args)));

    return server;
}
