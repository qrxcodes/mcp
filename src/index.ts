#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBridge, DEFAULT_URL, KEYS_URL } from './bridge.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

// stdout carries the protocol, so everything else goes to stderr.
const log = (message: string) => console.error(`[qrx-mcp] ${message}`);

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(version);
  process.exit(0);
}

function urlFromEnv(name: string, fallback?: string): URL | undefined {
  const value = process.env[name]?.trim() || fallback;
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    log(`${name} is not a valid URL: ${value}`);
    process.exit(1);
  }
}

const url = urlFromEnv('QRX_MCP_URL', DEFAULT_URL)!;
const serverCardUrl = urlFromEnv('QRX_MCP_SERVER_CARD_URL');

const apiKey = process.env.QRX_API_KEY?.trim() || undefined;
if (!apiKey) {
  log(`QRX_API_KEY is not set. Clients can list the tools; using them needs a key from ${KEYS_URL}`);
}

const server = createBridge({ url, apiKey, serverCardUrl, version, log });
const transport = new StdioServerTransport();

const shutdown = () => {
  server.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.stdin.on('close', shutdown);

await server.connect(transport);
log(`ready, forwarding to ${url.href}`);
