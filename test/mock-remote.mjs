// A stand-in for the hosted QRX MCP server: stateless Streamable HTTP, bearer-key auth on account tools,
// an MCP Apps view resource, and switches for dropping connections.
import { webcrypto } from 'node:crypto';
import { createServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Node 18 has no global crypto, which the SDK's HTTP server transport uses.
globalThis.crypto ??= webcrypto;

export const API_KEY = 'qrx_test_key';
export const UI_EXTENSION = 'io.modelcontextprotocol/ui';
export const VIEW_URI = 'ui://qrx/code-v1.html';
export const INSTRUCTIONS = 'QRX makes artistic QR codes.';
export const SERVER_INFO = {
  name: 'qrx',
  title: 'QRX',
  version: '9.9.9',
  icons: [{ src: 'https://qrx.codes/images/brand/qrx-code-512.png', mimeType: 'image/png', sizes: ['512x512'] }],
};

const ui = { ui: { resourceUri: VIEW_URI, visibility: ['model', 'app'] }, 'openai/outputTemplate': VIEW_URI };
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOLS = [
  {
    name: 'generate_qr_code',
    title: 'Generate a QR code',
    description: 'Start painting a QR code.',
    inputSchema: {
      type: 'object',
      properties: { prompt: { type: 'string' }, destination: { type: 'string', format: 'uri' } },
      required: ['prompt', 'destination'],
    },
    outputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' } }, required: ['id'] },
    annotations: { title: 'Generate a QR code', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    _meta: ui,
  },
  {
    name: 'get_account',
    title: 'Get plan and usage',
    description: 'Plan and remaining codes.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { plan: { type: 'string' }, remaining: { type: 'number' } } },
    annotations: readOnly,
  },
  {
    name: 'list_styles',
    title: 'List QR code styles',
    description: 'Styles you can pass to generate_qr_code.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { styles: { type: 'array', items: { type: 'object' } } } },
    annotations: readOnly,
  },
];

export const VIEW = {
  uri: VIEW_URI,
  name: 'QRX code',
  title: 'QR code',
  description: 'Shows a QR code while it is painted.',
  mimeType: 'text/html;profile=mcp-app',
};
export const VIEW_CONTENTS = {
  uri: VIEW_URI,
  mimeType: 'text/html;profile=mcp-app',
  text: '<!doctype html><title>QR code</title><div id="app"></div>',
  _meta: { ui: { csp: { resourceDomains: ['https://cdn.qrx.codes'] }, prefersBorder: false } },
};

const PUBLIC_TOOLS = new Set(['list_styles']);

function buildServer(initParams) {
  const offered = initParams?.capabilities?.extensions?.[UI_EXTENSION]?.mimeTypes ?? [];
  const extensions = offered.includes('text/html;profile=mcp-app')
    ? { extensions: { [UI_EXTENSION]: { mimeTypes: ['text/html;profile=mcp-app'] } } }
    : {};
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, ...extensions },
    instructions: INSTRUCTIONS,
  });
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));
  server.setRequestHandler(ListResourcesRequestSchema, () => ({ resources: [VIEW] }));
  server.setRequestHandler(ReadResourceRequestSchema, () => ({ contents: [VIEW_CONTENTS] }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args = {} } = request.params;
    if (name === 'list_styles') {
      const styles = [{ id: 'a64c5', name: 'Anime' }];
      return { content: [{ type: 'text', text: '- a64c5: Anime' }], structuredContent: { styles } };
    }
    if (name === 'get_account') {
      return { content: [{ type: 'text', text: 'Plan: Pro' }], structuredContent: { plan: 'Pro', remaining: 42 } };
    }
    if (name === 'generate_qr_code') {
      const token = request.params._meta?.progressToken;
      if (token !== undefined) {
        await extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: 1, total: 2, message: 'Painting' } });
      }
      return {
        content: [{ type: 'text', text: `Started a code for ${args.destination}` }],
        structuredContent: { id: 'abc123', status: 'pending' },
        _meta: { 'qrx/view': 'pending' },
      };
    }
    throw new Error(`Unknown tool ${name}`);
  });
  return server;
}

export async function startMockRemote() {
  const state = { requests: [], dropNext: 0, dropped: [] };

  const http = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
    state.requests.push({ method: body?.method, params: body?.params, headers: req.headers });

    // Drop JSON-RPC requests only, not the background GET stream the client opens.
    if (state.dropNext > 0 && body?.id !== undefined) {
      state.dropNext--;
      state.dropped.push(body?.params?.name ?? body?.method);
      req.socket.destroy();
      return;
    }

    const auth = req.headers.authorization;
    const needsKey = body?.method === 'tools/call' && !PUBLIC_TOOLS.has(body.params?.name);
    if (needsKey && auth !== `Bearer ${API_KEY}`) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32001, message: 'Connect a QRX account to use this tool.' } }));
      return;
    }

    const server = buildServer(body?.method === 'initialize' ? body.params : undefined);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });

  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  const { port } = http.address();
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    state,
    close: () =>
      new Promise((resolve) => {
        http.closeAllConnections?.();
        http.close(() => resolve());
      }),
  };
}
