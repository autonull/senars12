import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NAR } from '@senars/nar';
import type { Tool } from '@senars/nar/tools';
import { ToolManager } from '@senars/nar/tools';
import { describe, expect, it } from 'vitest';
import {
  registerNARRegistryTools,
  toolAnnotations,
  zodFromSchema,
} from '../../src/bin/lib/mcp/mcp-bridge.js';
import { registerNARTools } from '../../src/bin/lib/mcp/mcp-tools.js';

const makeTool = (overrides: Partial<Tool> = {}): Tool =>
  ({
    name: 'echo',
    description: 'Echo tool',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'text to echo' } },
      required: ['text'],
    },
    capabilities: { readOnly: true, idempotent: true, pure: false },
    execute: async (args: Record<string, unknown>) => ({ success: true, content: args }),
    ...overrides,
  }) as Tool;

/** Minimal NAR stub: enough surface for registerNARTools. */
const makeFakeNAR = (toolManager: ToolManager): NAR =>
  ({
    tools: toolManager,
    getBeliefs: () => [{ term: { toString: () => '<a --> b>.', truth: 0.9 } }],
    attentionReport: () => ({ concepts: 1 }),
    run: async (steps: number) => steps,
    believe: async (s: string) => s,
  }) as unknown as NAR;

const connect = async (server: McpServer): Promise<Client> => {
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
};

describe('zodFromSchema', () => {
  it('converts schema properties to zod validators', () => {
    const shape = zodFromSchema({
      type: 'object',
      properties: {
        s: { type: 'string', description: 'a string' },
        n: { type: 'number', minimum: 1, maximum: 10 },
        b: { type: 'boolean' },
        a: { type: 'array', items: { type: 'string' } },
        e: { type: 'string', enum: ['x', 'y'] },
        o: { type: 'object', properties: { inner: { type: 'string' } } },
      },
    });
    expect(shape.s!.safeParse('v').success).toBe(true);
    expect(shape.s!.safeParse(1).success).toBe(false);
    expect(shape.n!.safeParse(5).success).toBe(true);
    expect(shape.n!.safeParse(11).success).toBe(false);
    expect(shape.b!.safeParse(true).success).toBe(true);
    expect(shape.a!.safeParse(['x']).success).toBe(true);
    expect(shape.e!.safeParse('x').success).toBe(true);
    expect(shape.e!.safeParse('z').success).toBe(false);
    expect(shape.o!.safeParse({ inner: 'v' }).success).toBe(true);
  });
});

describe('toolAnnotations', () => {
  it('maps capabilities to MCP annotations', () => {
    expect(
      toolAnnotations({ capabilities: { readOnly: true, idempotent: true, pure: true } } as Tool)
    ).toEqual({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(toolAnnotations({} as Tool)).toEqual({
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
  });
});

describe('registerNARRegistryTools', () => {
  it('bridges registry tools without prefix and executes them', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const manager = new ToolManager();
    manager.register(makeTool({ name: 'echo' }));
    manager.register(
      makeTool({
        name: 'boom',
        execute: async () => {
          throw new Error('boom');
        },
      })
    );
    registerNARRegistryTools(server, { tools: manager } as unknown as NAR);
    const client = await connect(server);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('echo');
    expect(names.filter((n) => n === 'echo')).toHaveLength(1);
    expect(names).toContain('boom');

    const ok = await client.callTool({ name: 'echo', arguments: { text: 'hi' } });
    expect(ok.isError).toBeFalsy();
    expect((ok.structuredContent as { text: string }).text).toBe('hi');

    const failed = await client.callTool({ name: 'boom', arguments: {} });
    expect(failed.isError).toBe(true);
    await client.close();
  });
});

describe('registerNARTools (agent-specific MCP surface)', () => {
  it('lists and enables/disables LM rules', async () => {
    const rule = {
      enable: () => undefined,
      disable: () => undefined,
    };
    const nar = {
      getProcessor: () => ({
        getLMRule: (id: string) => (id === 'r1' ? rule : undefined),
        getLmRuleStats: () => [{ id: 'r1', enabled: true }],
      }),
      tools: new ToolManager(),
    };
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerNARTools(server, nar as unknown as NAR, {} as never);
    const client = await connect(server);

    const listed = await client.callTool({ name: 'list_lm_rules', arguments: {} });
    expect((listed.structuredContent as { rules: unknown[] }).rules).toHaveLength(1);

    const enabled = await client.callTool({
      name: 'agent_lm_rule_enable',
      arguments: { id: 'r1' },
    });
    expect((enabled.structuredContent as { enabled: boolean }).enabled).toBe(true);

    const missing = await client.callTool({
      name: 'agent_lm_rule_enable',
      arguments: { id: 'nope' },
    });
    expect((missing.structuredContent as { enabled: boolean }).enabled).toBe(false);
    await client.close();
  });

  it('agent_goal_progress estimates progress from matching beliefs and routing_reset clears demotions', async () => {
    const goalTerm = '(cat --> animal)';
    const nar = {
      getGoals: () => [{ term: { toString: () => goalTerm }, truth: { f: 0.9, c: 0.9 } }],
      getBeliefs: () => [{ term: { toString: () => goalTerm }, truth: { f: 0.8, c: 0.5 } }],
      getProcessor: () => ({ getLMRule: () => undefined, getLmRuleStats: () => [] }),
      tools: new ToolManager(),
    };
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerNARTools(server, nar as unknown as NAR, {} as never);
    const client = await connect(server);

    const list = await client.callTool({ name: 'agent_goal_progress', arguments: {} });
    const goals = (list.structuredContent as { goals: Array<{ goalId: string; progress: number }> })
      .goals;
    expect(goals[0]?.goalId).toBe(goalTerm);
    expect(goals[0]?.progress).toBeCloseTo(0.4);

    const single = await client.callTool({
      name: 'agent_goal_progress',
      arguments: { goalId: goalTerm },
    });
    expect(
      (single.structuredContent as { goals: Array<{ progress: number }> }).goals[0]?.progress
    ).toBe(0.4);

    const reset = await client.callTool({ name: 'routing_reset', arguments: {} });
    expect((reset.structuredContent as { reset: boolean }).reset).toBe(true);
    await client.close();
  });

  it('delegates explain_belief to the registry explain tool', async () => {
    const manager = new ToolManager();
    manager.register(
      makeTool({
        name: 'explain',
        parameters: {
          type: 'object',
          properties: { term: { type: 'string' } },
          required: ['term'],
        },
        execute: async () => ({
          success: true,
          content: { term: '<a --> b>.', summary: 'derived' },
        }),
      })
    );
    const nar = { ...makeFakeNAR(manager) } as unknown as NAR;
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerNARTools(server, nar, {} as never);
    const client = await connect(server);
    const res = await client.callTool({
      name: 'explain_belief',
      arguments: { term: '<a --> b>.' },
    });
    expect((res.structuredContent as { derivation: string }).derivation).toContain('derived');
    await client.close();
  });

  it('sandboxes read_file to the workspace root', async () => {
    const manager = new ToolManager();
    // Register read_file tool with workspace sandboxing (like core motor does)
    manager.register({
      name: 'read_file',
      description: 'Read a file from the filesystem',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      capabilities: { readOnly: true },
      execute: async (args: Record<string, unknown>) => {
        const path = args.path as string;
        const { withinWorkspace } = await import('@senars/core');
        if (!withinWorkspace(path)) {
          return { success: false, content: null, error: `Path outside workspace rejected: ${path}` };
        }
        // In test, just return success for valid paths
        return { success: true, content: { path, content: 'test content' } };
      },
    } as any);
    const nar = makeFakeNAR(manager);
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerNARTools(server, nar as unknown as NAR, {} as never);
    const client = await connect(server);
    const res = await client.callTool({ name: 'read_file', arguments: { path: '/etc/passwd' } });
    expect((res.structuredContent as { error?: string }).error).toContain('outside workspace');
    await client.close();
  });
});
