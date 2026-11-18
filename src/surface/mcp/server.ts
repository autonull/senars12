/**
 * MCP Server — generated Model Context Protocol server.
 *
 * One generated MCP surface over the same schemas as CLI/HTTP/WS.
 * MCP 2026-07-28 and 2025-era on one endpoint.
 */

import type {
  MCPServerConfig,
  MCPServer,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPTask,
} from './types.js';
import type { HabitatConfig, HabitatPack } from '../../worlds/index.js';

/** Create MCP server. */
export function createMCPServer(config: MCPServerConfig): MCPServer {
  return {
    config,
    tools: new Map(),
    resources: new Map(),
    prompts: new Map(),
    tasks: new Map(),
  };
}

/** Register a tool. */
export function registerTool(server: MCPServer, tool: MCPTool): void {
  server.tools.set(tool.name, tool);
}

/** Register a resource on server. */
export function registerMCPResource(server: MCPServer, resource: MCPResource): void {
  server.resources.set(resource.uri, resource);
}

/** Register a prompt. */
export function registerPrompt(server: MCPServer, prompt: MCPPrompt): void {
  server.prompts.set(prompt.name, prompt);
}

/** Create task handle for long-running operation. */
export function createTask(
  server: MCPServer,
  tool: string,
  arguments_: Record<string, unknown>,
  ttlMs = 300000
): MCPTask {
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const task: MCPTask = {
    id,
    tool,
    arguments: arguments_,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ttlMs,
  };
  server.tasks.set(id, task);
  return task;
}

/** Get task. */
export function getTask(server: MCPServer, id: string): MCPTask | undefined {
  return server.tasks.get(id);
}

/** Update task status. */
export function updateTask(
  server: MCPServer,
  id: string,
  updates: Partial<Pick<MCPTask, 'status' | 'result' | 'error'>>
): MCPTask | undefined {
  const task = server.tasks.get(id);
  if (!task) return undefined;

  const updated = { ...task, ...updates, updatedAt: Date.now() };
  server.tasks.set(id, updated);
  return updated;
}

/** Clean expired tasks. */
export function cleanTasks(server: MCPServer): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, task] of server.tasks) {
    if (now - task.createdAt > task.ttlMs) {
      server.tasks.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}

/** Generate MCP tools from habitat/pack schemas. */
export function generateToolsFromWorlds(
  habitats: HabitatConfig[],
  packs: HabitatPack[]
): MCPTool[] {
  const tools: MCPTool[] = [];

  // Habitat tools
  tools.push({
    name: 'habitat.list',
    description: 'List available habitats',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: async () => ({
      content: [{ type: 'text', text: JSON.stringify(habitats.map(h => ({ id: h.id, name: h.name, kind: h.kind }))) }],
    }),
  });

  tools.push({
    name: 'habitat.run',
    description: 'Run a habitat episode',
    inputSchema: {
      type: 'object',
      properties: {
        habitatId: { type: 'string' },
        seed: { type: 'number' },
        maxSteps: { type: 'number' },
      },
      required: ['habitatId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const habitatId = args.habitatId as string;
      const seed = args.seed as number | undefined;
      const maxSteps = args.maxSteps as number | undefined;
      const habitat = habitats.find(h => h.id === habitatId);
      if (!habitat) {
        return { content: [{ type: 'text', text: `Habitat not found: ${habitatId}` }], isError: true };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ habitatId, seed: seed ?? habitat.seed }) }],
      };
    },
  });

  // Pack tools
  tools.push({
    name: 'pack.list',
    description: 'List available habitat packs',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: async () => ({
      content: [{ type: 'text', text: JSON.stringify(packs.map(p => ({ id: p.id, habitats: p.order }))) }],
    }),
  });

  tools.push({
    name: 'pack.run',
    description: 'Run a habitat pack curriculum',
    inputSchema: {
      type: 'object',
      properties: {
        packId: { type: 'string' },
        seeds: { type: 'array', items: { type: 'number' } },
      },
      required: ['packId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const packId = args.packId as string;
      const seeds = args.seeds as number[] | undefined;
      const pack = packs.find(p => p.id === packId);
      if (!pack) {
        return { content: [{ type: 'text', text: `Pack not found: ${packId}` }], isError: true };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ packId, seeds: seeds ?? [42] }) }],
      };
    },
  });

  // Scorecard tools
  tools.push({
    name: 'scorecard.get',
    description: 'Get scorecard for habitat or pack',
    inputSchema: {
      type: 'object',
      properties: {
        targetId: { type: 'string' },
        targetKind: { type: 'string', enum: ['habitat', 'pack'] },
      },
      required: ['targetId', 'targetKind'],
    },
    handler: async (args: Record<string, unknown>) => {
      const targetId = args.targetId as string;
      const targetKind = args.targetKind as 'habitat' | 'pack';
      return {
        content: [{ type: 'text', text: JSON.stringify({ targetId, targetKind, metrics: {} }) }],
      };
    },
  });

  return tools;
}

/** Generate MCP resources from worlds. */
export function generateResourcesFromWorlds(
  habitats: HabitatConfig[],
  packs: HabitatPack[]
): MCPResource[] {
  const resources: MCPResource[] = [];

  // Habitat resources
  for (const habitat of habitats) {
    resources.push({
      uri: `habitat://${habitat.id}`,
      name: habitat.name,
      description: `Habitat: ${habitat.name} (${habitat.kind})`,
      mimeType: 'application/json',
    });
  }

  // Pack resources
  for (const pack of packs) {
    resources.push({
      uri: `pack://${pack.id}`,
      name: pack.id,
      description: `Pack: ${pack.id} (${pack.habitats.length} habitats)`,
      mimeType: 'application/json',
    });
  }

  return resources;
}