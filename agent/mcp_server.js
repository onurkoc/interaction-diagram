// @ts-check
/*
MCP server (stdio) for agents: interaction diagram and radial
utilization with the modules of the app (../app).

It is a pre-check, not a verification with a recognised program.
The program is server.js.
*/
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { interaction_diagram, check_loads, ToolInputError, DISCLAIMER }
    from './tools.js';

const NOTE = `${DISCLAIMER}. Uses the calculation of the web app ` +
    'https://interaction-diagram.onurkoc.net/ (rectangular reinforced ' +
    'concrete section, two layers, no second order effects). Invalid ' +
    'input is rejected with the messages of the app, nothing is corrected.';

// inputs of both tools
const SECTION = {
    norm: z.enum(['en1992', 'sia262']).describe(
        'en1992: EN 1992-1-1 without National Annex; sia262: SIA 262:2025'),
    h: z.number().describe('height [m]'),
    b: z.number().describe('width [m]'),
    d_1: z.number().describe('axis distance of a_s1 from its edge [m]'),
    d_2: z.number().describe('axis distance of a_s2 from its edge [m]'),
    a_s1: z.number().describe('reinforcement, layer 1 [cm2]'),
    a_s2: z.number().describe('reinforcement, layer 2 [cm2]'),
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

const LOADS = {
    loads: z.array(z.object({ N: z.number(), M: z.number() })).describe(
        'load points, in force_unit / moment_unit and the sign convention ' +
        'of compression'),
    gamma_d: z.number().describe(
        'required load factor, all loads are multiplied by it; 1.0 if ' +
        'the loads are design values'),
    min_eccentricity: z.boolean().optional().describe(
        'EN only: minimum eccentricity e0 = max(h/30; 20 mm) on the load ' +
        'points (EN 1992-1-1 6.1 (4)); default true in EN, as in the app. ' +
        'true with SIA is rejected.'),
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
 * The server with both tools, not yet connected.
 * @returns {McpServer}
 */
export function create_server() {
    const server = new McpServer({ name: 'interaction-diagram', version: '1.0.0' });

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
        description: 'For each load point (N, M): inside / outside of the ' +
            'capacity curve and the radial utilization |S_d| / |R_d| as in ' +
            'the app, and the governing point (largest utilization). ' +
            NOTE,
        inputSchema: { ...SECTION, ...LOADS },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (args) => answer(() => check_loads(args)));

    return server;
}
