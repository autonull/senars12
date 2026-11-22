/**
 * Generated MCP Server — schema-driven MCP server with dual-era support.
 *
 * Handles are log references; long checks return task handles; forms from schemas.
 * Replaces mock + legacy server (parity-gated).
 */

import type {
  MCPServerConfig,
  MCPServer,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPTask,
  MCPToolResult,
  MCPCapabilities,
  MCPTransportConfig,
  InitializeParams,
  InitializeResult,
  ListToolsParams,
  ListToolsResult,
  CallToolParams,
  ListResourcesParams,
  ListResourcesResult,
  ReadResourceParams,
  ReadResourceResult,
  ListPromptsParams,
  ListPromptsResult,
  GetPromptParams,
  MCPPromptResult,
  JSONSchemaProperty,
} from './types.js';
import { GenomeRegistry, createGenomeRegistry, type GenomeSchema } from '../../genome/index.js';
import { createProfileRegistry, type ProfileConfig, PROFILE_KINDS } from '../../profiles/index.js';

/** Generated MCP server config. */
export interface GeneratedMCPServerConfig extends MCPServerConfig {
  /** Genome registry. */
  genome?: GenomeRegistry;
  /** Profile registry. */
  profiles?: ProfileRegistry;
  /** Enable generated tools. */
  enableGeneratedTools: boolean;
  /** Enable schema elicitation. */
  enableElicitation: boolean;
  /** Log reference prefix. */
  logRefPrefix: string;
}

/** Profile registry interface. */
export interface ProfileRegistry {
  getAll(): ProfileConfig[];
  get(kind: string): ProfileConfig | undefined;
  toJSONSchema(kind: string): object;
}

/** Generated MCP server. */
export class GeneratedMCPServer {
  private config: GeneratedMCPServerConfig;
  private server: MCPServer;
  private genome: GenomeRegistry;
  private profiles: ProfileRegistry;
  private logReferences: Map<string, unknown> = new Map();

  constructor(config: GeneratedMCPServerConfig) {
    this.config = config;
    this.genome = config.genome ?? createGenomeRegistry();
    this.profiles = config.profiles ?? createProfileRegistry();
    this.server = {
      config: config,
      tools: new Map(),
      resources: new Map(),
      prompts: new Map(),
      tasks: new Map(),
    };

    this.initialize();
  }

  /** Initialize server with generated tools. */
  private initialize(): void {
    // Register core tools
    this.registerCoreTools();

    // Register generated tools from genome
    if (this.config.enableGeneratedTools) {
      this.registerGeneratedTools();
    }

    // Register profile tools
    this.registerProfileTools();

    // Register resources
    this.registerResources();

    // Register prompts
    this.registerPrompts();
  }

  /** Register core MCP tools. */
  private registerCoreTools(): void {
    // Initialize tool
    this.registerTool({
      name: 'initialize',
      description: 'Initialize the MCP connection',
      inputSchema: {
        type: 'object',
        properties: {
          protocolVersion: { type: 'string' },
          capabilities: { type: 'object' },
          clientInfo: { type: 'object', properties: { name: { type: 'string' }, version: { type: 'string' } } },
        },
        required: ['protocolVersion', 'capabilities', 'clientInfo'],
      },
      handler: async (args: Record<string, unknown>) => {
        const params = args as unknown as InitializeParams;
        const result: InitializeResult = {
          protocolVersion: this.config.protocolVersion,
          capabilities: this.config.capabilities,
          serverInfo: { name: this.config.name, version: this.config.version },
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });

    // List tools
    this.registerTool({
      name: 'tools/list',
      description: 'List available tools',
      inputSchema: { type: 'object', properties: { cursor: { type: 'string' } }, required: [] },
      handler: async (args: Record<string, unknown>) => {
        const params = args as ListToolsParams;
        const tools = Array.from(this.server.tools.values());
        const cursor = params.cursor ? parseInt(params.cursor, 10) : 0;
        const pageSize = 50;
        const pageTools = tools.slice(cursor, cursor + pageSize);
        const result: ListToolsResult = {
          tools: pageTools,
          nextCursor: cursor + pageSize < tools.length ? String(cursor + pageSize) : undefined,
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });

    // Call tool
    this.registerTool({
      name: 'tools/call',
      description: 'Call a tool',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          arguments: { type: 'object' },
        },
        required: ['name'],
      },
      handler: async (args: Record<string, unknown>) => {
        const params = args as unknown as CallToolParams;
        const tool = this.server.tools.get(params.name);
        if (!tool) {
          return { content: [{ type: 'text', text: `Tool not found: ${params.name}` }], isError: true };
        }

        // Handle long-running tools
        if (this.isLongRunningTool(params.name)) {
          const task = this.createTask(params.name, params.arguments ?? {});
          return { content: [{ type: 'text', text: JSON.stringify({ taskId: task.id, status: 'pending' }) }] };
        }

        try {
          const result = await tool.handler(params.arguments ?? {});
          return result;
        } catch (error) {
          return { content: [{ type: 'text', text: `Tool error: ${error instanceof Error ? error.message : 'Unknown'}` }], isError: true };
        }
      },
    });

    // List resources
    this.registerTool({
      name: 'resources/list',
      description: 'List available resources',
      inputSchema: { type: 'object', properties: { cursor: { type: 'string' } }, required: [] },
      handler: async (args: Record<string, unknown>) => {
        const params = args as ListResourcesParams;
        const resources = Array.from(this.server.resources.values());
        const cursor = params.cursor ? parseInt(params.cursor, 10) : 0;
        const pageSize = 50;
        const pageResources = resources.slice(cursor, cursor + pageSize);
        const result: ListResourcesResult = {
          resources: pageResources,
          nextCursor: cursor + pageSize < resources.length ? String(cursor + pageSize) : undefined,
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });

    // Read resource
    this.registerTool({
      name: 'resources/read',
      description: 'Read a resource',
      inputSchema: { type: 'object', properties: { uri: { type: 'string' } }, required: ['uri'] },
      handler: async (args: Record<string, unknown>) => {
        const params = args as unknown as ReadResourceParams;
        const resource = this.server.resources.get(params.uri);
        if (!resource) {
          return { content: [{ type: 'text', text: `Resource not found: ${params.uri}` }], isError: true };
        }

        const logRef = this.logReferences.get(params.uri);
        const result: ReadResourceResult = {
          contents: [{
            uri: params.uri,
            mimeType: resource.mimeType,
            text: logRef ? JSON.stringify(logRef) : `Resource: ${resource.name}`,
          }],
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });

    // List prompts
    this.registerTool({
      name: 'prompts/list',
      description: 'List available prompts',
      inputSchema: { type: 'object', properties: { cursor: { type: 'string' } }, required: [] },
      handler: async (args: Record<string, unknown>) => {
        const params = args as unknown as ListPromptsParams;
        const prompts = Array.from(this.server.prompts.values());
        const cursor = params.cursor ? parseInt(params.cursor, 10) : 0;
        const pageSize = 50;
        const pagePrompts = prompts.slice(cursor, cursor + pageSize);
        const result: ListPromptsResult = {
          prompts: pagePrompts,
          nextCursor: cursor + pageSize < prompts.length ? String(cursor + pageSize) : undefined,
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });

    // Get prompt
    this.registerTool({
      name: 'prompts/get',
      description: 'Get a prompt',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, arguments: { type: 'object' } }, required: ['name'] },
      handler: async (args: Record<string, unknown>) => {
        const params = args as unknown as GetPromptParams;
        const prompt = this.server.prompts.get(params.name);
        if (!prompt) {
          return { content: [{ type: 'text', text: `Prompt not found: ${params.name}` }], isError: true };
        }
        const result: MCPPromptResult = await prompt.handler(params.arguments ?? {});
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });
  }

  /** Register generated tools from genome. */
  private registerGeneratedTools(): void {
    for (const schema of this.genome.getAll()) {
      if (schema.mcpTool) {
        // The actual tool would be loaded from generated files
        // For now, register a placeholder that validates against schema
        this.registerTool({
          name: schema.mcpTool.name,
          description: schema.mcpTool.description,
          inputSchema: this.zodToJSONSchema(schema.schema),
          handler: async (args: Record<string, unknown>) => {
            const result = schema.schema.safeParse(args);
            if (!result.success) {
              return {
                content: [{ type: 'text', text: `Validation error: ${result.error.message}` }],
                isError: true,
              };
            }

            // Store as log reference
            const logRef = `${this.config.logRefPrefix}:${schema.id}:${Date.now()}`;
            this.logReferences.set(logRef, result.data);

            return {
              content: [{ type: 'text', text: JSON.stringify({ success: true, logRef, data: result.data }) }],
            };
          },
        });
      }
    }
  }

  /** Register profile tools. */
  private registerProfileTools(): void {
    // Profile list
    this.registerTool({
      name: 'profile.list',
      description: 'List available profiles',
      inputSchema: { type: 'object', properties: {}, required: [] },
      handler: async () => {
        const profiles = this.profiles.getAll();
        return { content: [{ type: 'text', text: JSON.stringify(profiles.map(p => ({ kind: p.kind, name: p.name, description: p.description, requiresLM: p.requiresLM }))) }] };
      },
    });

    const PROFILE_KINDS_ARRAY = [...PROFILE_KINDS] as string[];

    // Profile get
    this.registerTool({
      name: 'profile.get',
      description: 'Get profile configuration',
      inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: PROFILE_KINDS_ARRAY } }, required: ['kind'] },
      handler: async (args: Record<string, unknown>) => {
        const kind = args.kind as string;
        const profile = this.profiles.get(kind);
        if (!profile) {
          return { content: [{ type: 'text', text: `Profile not found: ${kind}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(profile) }] };
      },
    });

    // Profile schema
    this.registerTool({
      name: 'profile.schema',
      description: 'Get profile JSON schema',
      inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: PROFILE_KINDS_ARRAY } }, required: ['kind'] },
      handler: async (args: Record<string, unknown>) => {
        const kind = args.kind as string;
        const schema = this.profiles.toJSONSchema(kind);
        return { content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }] };
      },
    });

    // Profile create env
    this.registerTool({
      name: 'profile.create-env',
      description: 'Create Env from profile',
      inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: PROFILE_KINDS_ARRAY }, overrides: { type: 'object' } }, required: ['kind'] },
      handler: async (args: Record<string, unknown>) => {
        const kind = args.kind as string;
        const overrides = args.overrides as Record<string, unknown> | undefined;
        const profile = this.profiles.get(kind);
        if (!profile) {
          return { content: [{ type: 'text', text: `Profile not found: ${kind}` }], isError: true };
        }

        // Return env config as JSON
        return { content: [{ type: 'text', text: JSON.stringify({ kind: profile.kind, ...profile.defaults, ...overrides }) }] };
      },
    });
  }

  /** Register resources. */
  private registerResources(): void {
    // Schema resources
    for (const schema of this.genome.getAll()) {
      this.registerResource({
        uri: `schema://${schema.id}`,
        name: schema.name,
        description: schema.description ?? `Schema: ${schema.name}`,
        mimeType: 'application/json',
      });
    }

    // Profile resources
    for (const profile of this.profiles.getAll()) {
      this.registerResource({
        uri: `profile://${profile.kind}`,
        name: profile.name,
        description: profile.description,
        mimeType: 'application/json',
      });
    }

    // Log reference resources
    this.registerResource({
      uri: 'log://references',
      name: 'Log References',
      description: 'All log references',
      mimeType: 'application/json',
    });
  }

  /** Register prompts. */
  private registerPrompts(): void {
    // Schema elicitation prompt
    if (this.config.enableElicitation) {
      for (const schema of this.genome.getAll()) {
        if (schema.elicitation) {
          this.registerPrompt({
            name: `elicit-${schema.id}`,
            description: `Elicit ${schema.name} data`,
            arguments: this.generatePromptArguments(schema.schema),
            handler: async (args: Record<string, unknown>) => {
              const result = schema.schema.safeParse(args);
              if (!result.success) {
                return {
                  description: `Invalid ${schema.name} data`,
                  messages: [{ role: 'user', content: { type: 'text', text: `Validation error: ${result.error.message}` } }],
                };
              }
              return {
                description: `${schema.name} data elicited`,
                messages: [{ role: 'user', content: { type: 'text', text: JSON.stringify(result.data) } }],
              };
            },
          });
        }
      }
    }

    // Profile selection prompt
    this.registerPrompt({
      name: 'select-profile',
      description: 'Select a profile for the session',
      arguments: [
        { name: 'kind', description: 'Profile kind', required: true },
      ],
      handler: async (args: Record<string, unknown>) => {
        const kind = args.kind as string;
        const profile = this.profiles.get(kind);
        return {
          description: `Selected profile: ${profile?.name ?? kind}`,
          messages: [{ role: 'system', content: { type: 'text', text: `Profile: ${JSON.stringify(profile)}` } }],
        };
      },
    });
  }

  /** Convert Zod schema to JSON Schema. */
  private zodToJSONSchema(zodType: any): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const typeName = zodType._def?.typeName ?? 'unknown';
    if (typeName !== 'ZodObject') {
      return { type: 'object', properties: {}, required: [] };
    }

    const shape = zodType.shape as Record<string, any>;
    const properties: Record<string, any> = {};
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = this.zodTypeToJSONSchemaProperty(value);
    }
    return { type: 'object', properties, required: Object.entries(shape).filter(([, v]) => v._def?.typeName !== 'ZodOptional').map(([k]) => k) };
  }

  /** Convert Zod type to JSON Schema property. */
  private zodTypeToJSONSchemaProperty(zodType: any): any {
    const typeName = zodType._def?.typeName ?? 'unknown';
    switch (typeName) {
      case 'ZodString': return { type: 'string' };
      case 'ZodNumber': return { type: 'number' };
      case 'ZodBoolean': return { type: 'boolean' };
      case 'ZodArray': return { type: 'array', items: this.zodTypeToJSONSchemaProperty(zodType.element) };
      case 'ZodOptional': return this.zodTypeToJSONSchemaProperty(zodType.unwrap());
      case 'ZodNullable': return this.zodTypeToJSONSchemaProperty(zodType.unwrap());
      case 'ZodDefault': return this.zodTypeToJSONSchemaProperty(zodType._def.innerType);
      case 'ZodObject': {
        const shape = zodType.shape as Record<string, any>;
        const properties: Record<string, any> = {};
        for (const [key, value] of Object.entries(shape)) {
          properties[key] = this.zodTypeToJSONSchemaProperty(value);
        }
        return { type: 'object', properties, required: Object.entries(shape).filter(([, v]) => v._def?.typeName !== 'ZodOptional').map(([k]) => k) };
      }
      case 'ZodUnion': {
        return { type: 'object', properties: {}, required: [] }; // anyOf not supported in JSONSchemaProperty
      }
      case 'ZodEnum': {
        return { type: 'string', enum: zodType._def.values };
      }
      case 'ZodLiteral': {
        return { type: 'string', const: zodType._def.value };
      }
      case 'ZodRecord': {
        return { type: 'object', additionalProperties: this.zodTypeToJSONSchemaProperty(zodType._def.valueType) };
      }
      default:
        return { type: 'object' };
    }
  }

  /** Generate prompt arguments from schema. */
  private generatePromptArguments(zodType: any): Array<{ name: string; description: string; required: boolean }> {
    if (zodType._def?.typeName === 'ZodObject') {
      const shape = zodType.shape as Record<string, any>;
      return Object.entries(shape).map(([key, value]) => ({
        name: key,
        description: `Field ${key}`,
        required: value._def?.typeName !== 'ZodOptional',
      }));
    }
    return [];
  }

  /** Check if tool is long-running. */
  private isLongRunningTool(name: string): boolean {
    return name.startsWith('long.') || name.includes('batch') || name.includes('train');
  }

  /** Get the underlying server. */
  getServer(): MCPServer {
    return this.server;
  }

  /** Register a tool. */
  registerTool(tool: MCPTool): void {
    this.server.tools.set(tool.name, tool);
  }

  /** Register a resource. */
  registerResource(resource: MCPResource): void {
    this.server.resources.set(resource.uri, resource);
  }

  /** Register a prompt. */
  registerPrompt(prompt: MCPPrompt): void {
    this.server.prompts.set(prompt.name, prompt);
  }

  /** Create task handle. */
  createTask(tool: string, arguments_: Record<string, unknown>, ttlMs = 300000): MCPTask {
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
    this.server.tasks.set(id, task);
    return task;
  }

  /** Get task. */
  getTask(id: string): MCPTask | undefined {
    return this.server.tasks.get(id);
  }

  /** Update task. */
  updateTask(id: string, updates: Partial<Pick<MCPTask, 'status' | 'result' | 'error'>>): MCPTask | undefined {
    const task = this.server.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates, updatedAt: Date.now() };
    this.server.tasks.set(id, updated);
    return updated;
  }

  /** Store log reference. */
  storeLogReference(uri: string, data: unknown): void {
    this.logReferences.set(uri, data);
  }

  /** Get log reference. */
  getLogReference(uri: string): unknown | undefined {
    return this.logReferences.get(uri);
  }
}

/** Create generated MCP server. */
export function createGeneratedMCPServer(config: GeneratedMCPServerConfig): GeneratedMCPServer {
  return new GeneratedMCPServer(config);
}