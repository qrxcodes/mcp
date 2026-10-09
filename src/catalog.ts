import {
  ImplementationSchema,
  PromptSchema,
  ResourceSchema,
  ToolSchema,
  type Implementation,
  type Prompt,
  type Resource,
  type ServerCapabilities,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SNAPSHOT } from './snapshot.js';

/** What the bridge can say about QRX without an account: enough to initialize and list. */
export interface Catalog {
  serverInfo: Implementation;
  instructions?: string;
  capabilities: ServerCapabilities;
  tools: Tool[];
  resources: Resource[];
  prompts: Prompt[];
}

/** The public server card lives at the remote's origin unless QRX_MCP_SERVER_CARD_URL says otherwise. */
export function defaultServerCardUrl(url: URL): URL {
  return new URL('/.well-known/mcp/server-card.json', url.origin);
}

/** Reads the public server card, falling back to the bundled snapshot for anything it lacks. */
export async function loadCatalog(cardUrl: URL, log: (message: string) => void): Promise<Catalog> {
  const card = await fetchCard(cardUrl).catch((error: unknown) => {
    log(`could not read the server card at ${cardUrl.href}: ${error instanceof Error ? error.message : error}`);
    return undefined;
  });
  const tools = listOf<Tool>(ToolSchema, card?.tools, card?.capabilities?.tools, card?.capabilities?.tools?.tools);
  if (card && !tools) log(`the server card at ${cardUrl.href} has no usable tool list; using the bundled one`);
  const resources = listOf<Resource>(ResourceSchema, card?.resources, card?.capabilities?.resources, card?.capabilities?.resources?.resources) ?? [];
  const prompts = listOf<Prompt>(PromptSchema, card?.prompts, card?.capabilities?.prompts, card?.capabilities?.prompts?.prompts) ?? [];
  const serverInfo = ImplementationSchema.safeParse(card?.serverInfo).success ? (card.serverInfo as Implementation) : SNAPSHOT.serverInfo;
  const instructions = typeof card?.instructions === 'string' ? card.instructions : SNAPSHOT.instructions;
  return {
    serverInfo,
    instructions,
    capabilities: {
      tools: { listChanged: false },
      ...(resources.length ? { resources: { listChanged: false } } : {}),
      ...(prompts.length ? { prompts: { listChanged: false } } : {}),
    },
    tools: tools ?? SNAPSHOT.tools,
    resources,
    prompts,
  };
}

async function fetchCard(url: URL): Promise<any> {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const card = await response.json();
  if (!card || typeof card !== 'object') throw new Error('not a JSON object');
  return card;
}

/** The first candidate that is a non-empty array whose every item matches the schema. */
function listOf<T>(schema: { safeParse(value: unknown): { success: boolean } }, ...candidates: unknown[]): T[] | undefined {
  return candidates.find(
    (value): value is T[] => Array.isArray(value) && value.length > 0 && value.every((item) => schema.safeParse(item).success),
  );
}
