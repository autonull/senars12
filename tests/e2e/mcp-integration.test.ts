import { describe, expect, it } from 'vitest';
import { registerMCPPrompts } from '../../src/api/mcp-prompts.js';
import { registerMCPResources } from '../../src/api/mcp-resources.js';
import { SeNARSMCPServer } from '../../src/api/mcp-server.js';

/**
 * P9#1: an external MCP client can query the agent.
 * Exercises the real resource/prompt registration wiring used by bin/mcp-server.ts
 * and the protocol handlers that answer ListResources / ReadResource / ListPrompts.
 */

interface ResourceListing {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}
interface PromptListing {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}
interface ResourceContent {
  uri: string;
  mimeType?: string;
  text: string;
}
interface HandlerResult {
  resources?: ResourceListing[];
  prompts?: PromptListing[];
  contents?: ResourceContent[];
}
type HandlerFn = (
  request: { method: string; params: Record<string, unknown> },
  extra: unknown
) => Promise<HandlerResult>;

function callHandler(
  server: SeNARSMCPServer,
  method: string,
  params: Record<string, unknown>
): Promise<HandlerResult> {
  const handlers = (server as unknown as { server: { _requestHandlers: Map<string, HandlerFn> } })
    .server._requestHandlers;
  const handler = handlers.get(method);
  if (!handler) throw new Error(`No MCP handler registered for ${method}`);
  return handler({ method, params }, {});
}

const BASE_RESOURCE_URIS = [
  'nar://beliefs',
  'nar://concepts',
  'nar://attention',
  'nar://state',
  'nar://episodes',
  'nar://benchmarks',
  'nar://config',
  'nar://tools',
  'sessions://list',
  'knowledge://list',
  'lm-rules://stats',
  'lm-rules://execution-log',
  'rlfp://state',
  'self-reasoning://quality',
];

describe('MCP integration (P9#1)', () => {
  it('registers the 14 standard resources plus 2 parameterized templates', async () => {
    const server = new SeNARSMCPServer({ name: 'test', version: '0.0.0', transport: 'stdio' });
    registerMCPResources(server.getAdapter(), { nar: {} as never }, server);

    const { resources } = await callHandler(server, 'resources/list', {});

    expect(resources?.length).toBe(16);
    for (const uri of BASE_RESOURCE_URIS) {
      expect(resources?.some((r) => r.uri === uri)).toBe(true);
    }
    expect(resources?.some((r) => r.uri === 'sessions://{key}')).toBe(true);
    expect(resources?.some((r) => r.uri === 'knowledge://{key}')).toBe(true);
  });

  it('serves resource content through the registered resolver', async () => {
    const server = new SeNARSMCPServer({ name: 'test', version: '0.0.0', transport: 'stdio' });
    registerMCPResources(server.getAdapter(), { nar: {} as never }, server);
    server.setResourceContentResolver((uri) => `payload:${uri}`);

    const { contents } = await callHandler(server, 'resources/read', { uri: 'nar://beliefs' });

    expect(contents).toHaveLength(1);
    expect(contents?.[0].uri).toBe('nar://beliefs');
    expect(contents?.[0].text).toBe('payload:nar://beliefs');
  });

  it('registers the 5 reasoning prompts', async () => {
    const server = new SeNARSMCPServer({ name: 'test', version: '0.0.0', transport: 'stdio' });
    registerMCPPrompts(server.getAdapter(), server);

    const { prompts } = await callHandler(server, 'prompts/list', {});

    expect(prompts?.length).toBe(5);
    const names = prompts?.map((p) => p.name) ?? [];
    expect(names).toEqual(
      expect.arrayContaining([
        'reasoning_chain',
        'grounded_fact',
        'multi_cycle_task',
        'experiment_design',
        'benchmark_analysis',
      ])
    );
    expect(prompts?.find((p) => p.name === 'reasoning_chain')?.arguments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'premise', required: true }),
        expect.objectContaining({ name: 'target', required: true }),
      ])
    );
  });
});
