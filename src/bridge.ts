import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  InitializeRequestSchema,
  LATEST_PROTOCOL_VERSION,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  PromptListChangedNotificationSchema,
  ReadResourceRequestSchema,
  ResourceListChangedNotificationSchema,
  ResultSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  ToolListChangedNotificationSchema,
  type ClientCapabilities,
  type Implementation,
  type InitializeResult,
  type ServerNotification,
  type ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { defaultServerCardUrl, loadCatalog, type Catalog } from './catalog.js';

export const DEFAULT_URL = 'https://qrx.codes/mcp';
export const KEYS_URL = 'https://qrx.codes/developers/keys';

export interface BridgeOptions {
  /** The remote QRX MCP endpoint. */
  url: URL;
  /** QRX API key, sent as a bearer token. Without one, or if the remote refuses it, the bridge lists from the public server card. */
  apiKey?: string;
  /** The public server card. Defaults to /.well-known/mcp/server-card.json at the remote's origin. */
  serverCardUrl?: URL;
  /** This package's version, reported to the remote server. */
  version: string;
  /** Diagnostics go here (stderr in the CLI; stdout belongs to the protocol). */
  log?: (message: string) => void;
  /** Per-request timeout for calls to the remote server. */
  timeoutMs?: number;
}

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;
type AnyRequest = { method: string; params?: Record<string, unknown> };
type AnyResult = Record<string, unknown>;

/**
 * A stdio-facing MCP server that forwards every request to the remote QRX server.
 * Results are passed through untouched, so tool schemas, annotations, _meta,
 * structuredContent and MCP Apps resources reach the client exactly as the remote sent them.
 */
export function createBridge(options: BridgeOptions): Server {
  const log = options.log ?? (() => {});
  const timeout = options.timeoutMs ?? 120_000;

  // The capabilities and client info the local client sent, forwarded to the remote on (re)connect.
  let clientCapabilities: ClientCapabilities = {};
  let clientInfo: Implementation = { name: 'qrx-mcp', version: options.version };

  let upstream: Promise<Client> | undefined;
  // Set when the remote refuses to connect us: lists come from the public catalog and everything else needs a key.
  let catalog: Catalog | undefined;
  // Tools the remote marks read-only; only these are retried after a dropped connection.
  const readOnlyTools = new Set<string>();

  // The local server registers every forwarding handler, so it allows every capability.
  // What it advertises at initialize comes from the remote.
  const server = new Server(
    { name: 'qrx', version: options.version },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
        completions: {},
      },
    },
  );

  function connect(): Promise<Client> {
    if (upstream) return upstream;
    const pending = (async () => {
      const headers: Record<string, string> = {};
      if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
      const client = new Client(
        { ...clientInfo, name: `${clientInfo.name} via qrx-mcp/${options.version}` },
        { capabilities: clientCapabilities },
      );
      const forward = (method: ServerNotification['method']) => () => {
        server.notification({ method } as ServerNotification).catch(() => {});
      };
      client.setNotificationHandler(ToolListChangedNotificationSchema, forward('notifications/tools/list_changed'));
      client.setNotificationHandler(ResourceListChangedNotificationSchema, forward('notifications/resources/list_changed'));
      client.setNotificationHandler(PromptListChangedNotificationSchema, forward('notifications/prompts/list_changed'));
      client.onerror = (error) => {
        if (!isUnauthorized(error)) log(`remote transport error: ${error.message}`);
      };
      await client.connect(new StreamableHTTPClientTransport(options.url, { requestInit: { headers } }));
      return client;
    })();
    upstream = pending;
    pending.catch(() => {
      if (upstream === pending) upstream = undefined;
    });
    return pending;
  }

  function reset(): void {
    const stale = upstream;
    upstream = undefined;
    stale?.then((client) => client.close()).catch(() => {});
  }

  async function send(request: AnyRequest, extra: Extra): Promise<AnyResult> {
    // The SDK gives the remote request its own progress token; progress comes back here under the client's.
    const { progressToken } = (request.params?._meta ?? {}) as { progressToken?: string | number };
    const call = async () => {
      const client = await connect();
      return client.request(request as never, ResultSchema, {
        signal: extra.signal,
        timeout,
        resetTimeoutOnProgress: true,
        onprogress:
          progressToken === undefined
            ? undefined
            : (progress) => {
                extra
                  .sendNotification({ method: 'notifications/progress', params: { ...progress, progressToken } })
                  .catch(() => {});
              },
      }) as Promise<AnyResult>;
    };

    try {
      return await call();
    } catch (error) {
      if (!isConnectionError(error) || extra.signal.aborted) throw error;
      log(`lost the connection to ${options.url.href}; reconnecting`);
      reset();
      if (!isSafeToRetry(request)) throw error;
      return call();
    }
  }

  function isSafeToRetry(request: AnyRequest): boolean {
    if (request.method !== 'tools/call') return true;
    return readOnlyTools.has(String(request.params?.name));
  }

  async function forward(request: AnyRequest, extra: Extra): Promise<AnyResult> {
    if (catalog) throw rpcError(-32001, authMessage(options.apiKey));
    try {
      return await send(request, extra);
    } catch (error) {
      throw toRpcError(error, options.apiKey);
    }
  }

  server.setRequestHandler(InitializeRequestSchema, async (request): Promise<InitializeResult> => {
    clientCapabilities = request.params.capabilities;
    clientInfo = request.params.clientInfo;
    reset();
    catalog = undefined;
    const requested = request.params.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
    try {
      const client = await connect();
      const instructions = client.getInstructions();
      return {
        protocolVersion,
        capabilities: client.getServerCapabilities() ?? {},
        serverInfo: client.getServerVersion() ?? { name: 'qrx', version: options.version },
        ...(instructions ? { instructions } : {}),
      };
    } catch (error) {
      const refused = isUnauthorized(error);
      if (refused) log(`${options.url.href} refused ${options.apiKey ? 'the API key' : 'a connection without an API key'}`);
      else log(`could not reach ${options.url.href}: ${errorMessage(error)}`);
      if (refused || !options.apiKey) {
        // Answer discovery from the public server card, so clients and directories can still list the tools.
        catalog = await loadCatalog(options.serverCardUrl ?? defaultServerCardUrl(options.url), log);
        const { serverInfo, capabilities, instructions } = catalog;
        return { protocolVersion, capabilities, serverInfo, ...(instructions ? { instructions } : {}) };
      }
      // Start anyway so the client can show a useful error on first use; requests retry the connection.
      return {
        protocolVersion,
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'qrx', version: options.version },
      };
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    if (catalog) return { tools: catalog.tools };
    const result = await forward(request, extra);
    for (const tool of (result.tools ?? []) as { name: string; annotations?: { readOnlyHint?: boolean } }[]) {
      if (tool.annotations?.readOnlyHint) readOnlyTools.add(tool.name);
      else readOnlyTools.delete(tool.name);
    }
    return result as never;
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    if (catalog) return { isError: true, content: [{ type: 'text', text: authMessage(options.apiKey) }] };
    try {
      return (await send(request, extra)) as never;
    } catch (error) {
      if (isUnauthorized(error)) {
        return { isError: true, content: [{ type: 'text', text: authMessage(options.apiKey) }] };
      }
      throw toRpcError(error, options.apiKey);
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, (r, e) => (catalog ? { resources: catalog.resources } : (forward(r, e) as never)));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, (r, e) => (catalog ? { resourceTemplates: [] } : (forward(r, e) as never)));
  server.setRequestHandler(ReadResourceRequestSchema, (r, e) => forward(r, e) as never);
  server.setRequestHandler(ListPromptsRequestSchema, (r, e) => (catalog ? { prompts: catalog.prompts } : (forward(r, e) as never)));
  server.setRequestHandler(GetPromptRequestSchema, (r, e) => forward(r, e) as never);
  server.setRequestHandler(CompleteRequestSchema, (r, e) => forward(r, e) as never);

  server.onclose = () => reset();
  return server;
}

export function authMessage(apiKey: string | undefined): string {
  return apiKey
    ? `QRX rejected the API key in QRX_API_KEY. Check it is current at ${KEYS_URL}, then restart the MCP server.`
    : `Set QRX_API_KEY (create one at ${KEYS_URL}) in your MCP client's config for this server, then restart it.`;
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof StreamableHTTPError && (error.code === 401 || error.code === 403);
}

/** Network failures and HTTP errors from the transport, as opposed to JSON-RPC errors the remote returned. */
function isConnectionError(error: unknown): boolean {
  if (error instanceof McpError) return error.code === ErrorCode.ConnectionClosed;
  if (error instanceof StreamableHTTPError) return error.code === undefined || error.code === 404 || error.code >= 500;
  return error instanceof TypeError;
}

/**
 * The error to send to the local client. The SDK sends a thrown error's code, message and data as-is,
 * so this strips the "MCP error N:" prefix McpError adds rather than letting it double up.
 */
function toRpcError(error: unknown, apiKey: string | undefined): Error {
  if (isUnauthorized(error)) return rpcError(-32001, authMessage(apiKey));
  if (error instanceof McpError) return rpcError(error.code, error.message.replace(/^MCP error -?\d+: /, ''), error.data);
  return rpcError(ErrorCode.InternalError, `Could not reach the QRX MCP server: ${errorMessage(error)}`);
}

function rpcError(code: number, message: string, data?: unknown): Error {
  return Object.assign(new Error(message), { code, data });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
