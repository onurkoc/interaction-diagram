#!/usr/bin/env node
// @ts-check
/*
Start of the MCP server, transport stdio:
    node agent/server.js   (after npm install in agent/)
Pre-check, not a verification with a recognised program.
*/
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { create_server } from './mcp_server.js';

const server = create_server();
await server.connect(new StdioServerTransport());
