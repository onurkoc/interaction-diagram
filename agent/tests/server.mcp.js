// @ts-check
/*
The MCP server end to end: a client lists and calls the tools over an
in-memory transport. Needs the packages of agent/ (npm install there),
so the file name does not match the pattern of node --test: it runs only
with npm test in agent/.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { create_server } from '../mcp_server.js';
import { check_loads } from '../tools.js';

const ARGS = { norm: 'en1992', h: 0.30, b: 1.0, d_1: 0.05, d_2: 0.05,
               a_s1: 5.24, a_s2: 5.24, f_ck: 30, f_yk: 500,
               force_unit: 'kN', moment_unit: 'kNm', compression: 'negative' };

async function connected() {
    const [client_side, server_side] = InMemoryTransport.createLinkedPair();
    const server = create_server();
    await server.connect(server_side);
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(client_side);
    return client;
}

/**
 * @param {any} result
 * @returns {string}
 */
function text_of(result) {
    return result.content[0].text;
}

test('the server lists both tools, convention without default', async () => {
    const client = await connected();
    const { tools } = await client.listTools();
    const names = tools.map(tool => tool.name).sort();
    assert.deepEqual(names, ['check_loads', 'interaction_diagram']);
    for (const tool of tools) {
        const required = tool.inputSchema.required ?? [];
        for (const name of ['norm', 'force_unit', 'moment_unit', 'compression']) {
            assert.ok(required.includes(name), `${tool.name}: ${name}`);
        }
    }
    await client.close();
});

test('check_loads over MCP gives the answer of the tool', async () => {
    const client = await connected();
    const args = { ...ARGS, loads: [{ N: -1000, M: 100 }], gamma_d: 1.35 };
    const result = await client.callTool({ name: 'check_loads', arguments: args });
    assert.ok(!result.isError);
    const answer = JSON.parse(text_of(result));
    const direct = check_loads(args);
    assert.deepEqual(answer.points, direct.points);
    assert.equal(answer.disclaimer, direct.disclaimer);
    await client.close();
});

test('invalid input over MCP is an error with the message of the app', async () => {
    const client = await connected();
    const result = await client.callTool({
        name: 'interaction_diagram', arguments: { ...ARGS, f_ck: 55 } });
    assert.equal(result.isError, true);
    assert.match(text_of(result), /f_ck = 55/);

    // a missing convention is rejected by the schema
    const { compression, ...without } = ARGS;
    const missing = await client.callTool({
        name: 'interaction_diagram', arguments: without });
    assert.equal(missing.isError, true);
    assert.match(text_of(missing), /compression/);
    await client.close();
});
