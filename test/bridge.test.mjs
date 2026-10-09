// Runs the built CLI over stdio against a mock remote server.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { API_KEY, CARD_PATH, INSTRUCTIONS, SERVER_INFO, TOOLS, UI_EXTENSION, VIEW, VIEW_CONTENTS, startMockRemote } from './mock-remote.mjs';

const CLI = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const APP_CAPABILITIES = { extensions: { [UI_EXTENSION]: { mimeTypes: ['text/html;profile=mcp-app'] } } };

let remote;
before(async () => {
  remote = await startMockRemote();
});
after(async () => {
  await remote.close();
});

async function connect({ apiKey, capabilities = {}, url = remote.url, cardUrl } = {}) {
  const env = { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', QRX_MCP_URL: url };
  if (apiKey !== undefined) env.QRX_API_KEY = apiKey;
  if (cardUrl !== undefined) env.QRX_MCP_SERVER_CARD_URL = cardUrl;
  const transport = new StdioClientTransport({ command: process.execPath, args: [CLI], env, stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => (stderr += chunk));
  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities });
  await client.connect(transport);
  return { client, stderr: () => stderr };
}

// Raw requests, so the comparison sees exactly what the bridge sent rather than what the SDK's schemas keep.
const raw = (client, method, params = {}, options) => client.request({ method, params }, ResultSchema, options);
const lastRemoteRequest = (method) => remote.state.requests.filter((r) => r.method === method).at(-1);

describe('with an API key', () => {
  let client;
  before(async () => {
    ({ client } = await connect({ apiKey: API_KEY, capabilities: APP_CAPABILITIES }));
  });
  after(async () => {
    await client.close();
  });

  test('passes the remote server info, instructions and capabilities through', () => {
    const info = client.getServerVersion();
    assert.equal(info.name, SERVER_INFO.name);
    assert.equal(info.title, SERVER_INFO.title);
    assert.equal(info.version, SERVER_INFO.version);
    assert.deepEqual(info.icons, SERVER_INFO.icons);
    assert.equal(client.getInstructions(), INSTRUCTIONS);
    assert.deepEqual(client.getServerCapabilities().extensions, APP_CAPABILITIES.extensions);
  });

  test('forwards the client capabilities and the key to the remote', () => {
    const init = lastRemoteRequest('initialize');
    assert.deepEqual(init.params.capabilities.extensions, APP_CAPABILITIES.extensions);
    assert.match(init.params.clientInfo.name, /^test-client via qrx-mcp\//);
    assert.equal(init.headers.authorization, `Bearer ${API_KEY}`);
  });

  test('lists tools with schemas, annotations and _meta unchanged', async () => {
    const { tools } = await raw(client, 'tools/list');
    assert.deepEqual(tools, TOOLS);
  });

  test('calls a tool and returns structuredContent', async () => {
    const result = await client.callTool({ name: 'get_account', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, { plan: 'Pro', remaining: 42 });
  });

  test('passes tool result _meta and progress notifications through', async () => {
    const progress = [];
    const result = await raw(
      client,
      'tools/call',
      { name: 'generate_qr_code', arguments: { prompt: 'a lighthouse', destination: 'https://qrx.to/x' } },
      { onprogress: (p) => progress.push(p) },
    );
    assert.deepEqual(result.structuredContent, { id: 'abc123', status: 'pending' });
    assert.deepEqual(result._meta, { 'qrx/view': 'pending' });
    assert.deepEqual(progress, [{ progress: 1, total: 2, message: 'Painting' }]);
  });

  test('lists and reads the MCP Apps view resource unchanged', async () => {
    assert.deepEqual((await raw(client, 'resources/list')).resources, [VIEW]);
    assert.deepEqual((await raw(client, 'resources/read', { uri: VIEW.uri })).contents, [VIEW_CONTENTS]);
  });

  test('passes remote JSON-RPC errors through with their code', async () => {
    await assert.rejects(client.listPrompts(), (error) => {
      assert.equal(error.code, -32601);
      assert.doesNotMatch(error.message, /MCP error -32601: MCP error/);
      return true;
    });
  });

  test('reconnects after a dropped connection', async () => {
    remote.state.dropNext = 1;
    const { tools } = await raw(client, 'tools/list');
    assert.equal(tools.length, TOOLS.length);
    assert.equal(remote.state.dropped.at(-1), 'tools/list');
  });

  test('retries a read-only tool after a dropped connection', async () => {
    remote.state.dropNext = 1;
    const result = await client.callTool({ name: 'get_account', arguments: {} });
    assert.deepEqual(result.structuredContent, { plan: 'Pro', remaining: 42 });
    assert.equal(remote.state.dropped.at(-1), 'get_account');
  });

  test('does not retry a tool that changes things, but recovers on the next call', async () => {
    remote.state.dropNext = 1;
    const args = { name: 'generate_qr_code', arguments: { prompt: 'a lighthouse', destination: 'https://qrx.to/x' } };
    const before = remote.state.requests.filter((r) => r.params?.name === 'generate_qr_code').length;
    await assert.rejects(client.callTool(args), /Could not reach the QRX MCP server/);
    const result = await client.callTool(args);
    assert.deepEqual(result.structuredContent, { id: 'abc123', status: 'pending' });
    const after = remote.state.requests.filter((r) => r.params?.name === 'generate_qr_code').length;
    assert.equal(remote.state.dropped.at(-1), 'generate_qr_code');
    assert.equal(after - before, 2, 'one failed attempt and one new call, no automatic retry');
  });
});

describe('without an API key', () => {
  let client;
  let stderr;
  before(async () => {
    ({ client, stderr } = await connect());
  });
  after(async () => {
    await client.close();
  });

  test('says so on stderr at startup', () => {
    assert.match(stderr(), /QRX_API_KEY is not set/);
  });

  test('still lists tools and resources, and sends no key', async () => {
    const { tools } = await raw(client, 'tools/list');
    assert.deepEqual(tools, TOOLS);
    assert.equal((await client.listResources()).resources.length, 1);
    assert.equal(lastRemoteRequest('tools/list').headers.authorization, undefined);
  });

  test('runs tools that need no account', async () => {
    const result = await client.callTool({ name: 'list_styles', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, { styles: [{ id: 'a64c5', name: 'Anime' }] });
  });

  test('returns a clear tool error for tools that need a key', async () => {
    const result = await client.callTool({ name: 'get_account', arguments: {} });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Set QRX_API_KEY/);
  });
});

test('reports a rejected key clearly', async () => {
  const { client } = await connect({ apiKey: 'qrx_wrong' });
  const result = await client.callTool({ name: 'get_account', arguments: {} });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /rejected the API key in QRX_API_KEY/);
  await client.close();
});

test('starts when the remote is unreachable and reports it on use', async () => {
  const { client, stderr } = await connect({ apiKey: API_KEY, url: 'http://127.0.0.1:9/mcp' });
  assert.match(stderr(), /could not reach/);
  await assert.rejects(client.listTools(), /Could not reach the QRX MCP server/);
  await client.close();
});

describe('when the remote needs a key to connect', () => {
  const NEEDS_KEY = /Set QRX_API_KEY \(create one at https:\/\/qrx\.codes\/developers\/keys\)/;
  const BUNDLED = ['generate_qr_code', 'get_qr_code', 'list_qr_codes', 'change_qr_code_destination', 'get_account', 'get_profile', 'list_styles'];
  let locked;
  before(async () => {
    locked = await startMockRemote({ requireAuth: true });
  });
  after(async () => {
    await locked.close();
  });

  async function listWith(card, options = {}) {
    locked.state.card = card;
    const { client } = await connect({ url: locked.url, ...options });
    try {
      return { info: client.getServerVersion(), tools: (await raw(client, 'tools/list')).tools };
    } finally {
      await client.close();
    }
  }

  test('without a key, answers initialize and lists from the server card', async () => {
    locked.state.card = { serverInfo: SERVER_INFO, instructions: INSTRUCTIONS, tools: TOOLS, resources: [VIEW] };
    const { client } = await connect({ url: locked.url });
    after(() => client.close());
    assert.equal(client.getServerVersion().version, SERVER_INFO.version);
    assert.equal(client.getInstructions(), INSTRUCTIONS);
    assert.deepEqual((await raw(client, 'tools/list')).tools, TOOLS);
    assert.deepEqual((await raw(client, 'resources/list')).resources, [VIEW]);
    assert.deepEqual((await raw(client, 'prompts/list')).prompts, []);

    const result = await client.callTool({ name: 'list_styles', arguments: {} });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, NEEDS_KEY);
    await assert.rejects(raw(client, 'resources/read', { uri: VIEW.uri }), (error) => error.code === -32001 && NEEDS_KEY.test(error.message));
  });

  test('finds tools under capabilities in the card', async () => {
    assert.deepEqual((await listWith({ capabilities: { tools: TOOLS } })).tools, TOOLS);
  });

  test('reads the card from QRX_MCP_SERVER_CARD_URL', async () => {
    remote.state.card = { tools: [TOOLS[2]] };
    const { tools } = await listWith(undefined, { cardUrl: new URL(CARD_PATH, remote.url).href });
    assert.deepEqual(tools, [TOOLS[2]]);
  });

  test('falls back to the bundled tool list when there is no card', async () => {
    const { info, tools } = await listWith(undefined);
    assert.equal(info.name, 'qrx');
    assert.deepEqual(tools.map((t) => t.name), BUNDLED);
  });

  test('falls back to the bundled tool list when the card is not valid', async () => {
    const { tools } = await listWith({ tools: [{ name: 'no_schema' }] });
    assert.deepEqual(tools.map((t) => t.name), BUNDLED);
  });

  test('with a rejected key, lists from the card and reports the key on use', async () => {
    locked.state.card = { tools: TOOLS };
    const { client } = await connect({ apiKey: 'qrx_wrong', url: locked.url });
    assert.deepEqual((await raw(client, 'tools/list')).tools, TOOLS);
    const result = await client.callTool({ name: 'get_account', arguments: {} });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /rejected the API key in QRX_API_KEY/);
    await client.close();
  });

  test('with a valid key, forwards everything', async () => {
    locked.state.card = { tools: [TOOLS[2]] };
    const { client } = await connect({ apiKey: API_KEY, url: locked.url });
    assert.equal(client.getInstructions(), INSTRUCTIONS);
    assert.deepEqual((await raw(client, 'tools/list')).tools, TOOLS);
    const result = await client.callTool({ name: 'get_account', arguments: {} });
    assert.deepEqual(result.structuredContent, { plan: 'Pro', remaining: 42 });
    await client.close();
  });
});
