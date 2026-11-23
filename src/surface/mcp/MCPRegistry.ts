/**
 * MCP Registry — declarative tool and resource registration.
 *
 * All 27+ MCP tools/resources defined as specs. Auto-generates OpenAPI, docs, validation.
 * New tool = 1 spec entry; new resource = 1 spec entry.
 */

import { z } from 'zod';
import { nonEmpty, positiveInt } from '@senars/config/boundary';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/** Tool specification for declarative registration. */
export interface ToolSpec<Input extends z.ZodSchema<any> = z.ZodSchema<any>> {
  /** Unique tool name (e.g., 'nar.step') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Input schema (Zod) */
  inputSchema: Input;
  /** Output schema (Zod) - for documentation */
  outputSchema?: z.ZodSchema<any>;
  /** Required permissions/scopes */
  permissions?: string[];
  /** Whether this tool is mutating (requires approval) */
  mutating?: boolean;
  /** Handler function */
  handler: (input: z.infer<Input>, context: ToolContext) => Promise<CallToolResult>;
}

/** Resource specification for declarative registration. */
export interface ResourceSpec {
  /** URI template (e.g., 'nar://concept/{id}') */
  uriTemplate: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** MIME type */
  mimeType?: string;
  /** Handler function */
  handler: (uri: string, context: ResourceContext) => Promise<ReadResourceResult>;
}

/** Context passed to tool handlers. */
export interface ToolContext {
  /** MCP session ID */
  sessionId: string;
  /** Request metadata */
  metadata: Record<string, unknown>;
  /** Server instance for advanced operations */
  server: McpServer;
}

/** Context passed to resource handlers. */
export interface ResourceContext {
  /** MCP session ID */
  sessionId: string;
  /** Request metadata */
  metadata: Record<string, unknown>;
}

/** Registered tool entry. */
interface RegisteredTool {
  spec: ToolSpec;
  zodSchema: z.ZodSchema<any>;
}

/** Registered resource entry. */
interface RegisteredResource {
  spec: ResourceSpec;
}

/**
 * MCP Registry — central registry for all tools and resources.
 * Supports declarative registration, validation, and auto-documentation.
 */
export class MCPRegistry {
  private tools = new Map<string, RegisteredTool>();
  private resources = new Map<string, RegisteredResource>();

  /** Register a tool. */
  registerTool<Input extends z.ZodSchema<any>>(spec: ToolSpec<Input>): this {
    if (this.tools.has(spec.name)) {
      throw new Error(`Tool already registered: ${spec.name}`);
    }
    this.tools.set(spec.name, {
      spec,
      zodSchema: spec.inputSchema,
    });
    return this;
  }

  /** Register a resource. */
  registerResource(spec: ResourceSpec): this {
    if (this.resources.has(spec.uriTemplate)) {
      throw new Error(`Resource already registered: ${spec.uriTemplate}`);
    }
    this.resources.set(spec.uriTemplate, { spec });
    return this;
  }

  /** Get a tool spec by name. */
  getTool(name: string): ToolSpec | undefined {
    return this.tools.get(name)?.spec;
  }

  /** Get a resource spec by URI template. */
  getResource(uriTemplate: string): ResourceSpec | undefined {
    return this.resources.get(uriTemplate)?.spec;
  }

  /** List all tool names. */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /** List all resource URI templates. */
  listResources(): string[] {
    return Array.from(this.resources.keys());
  }

  /** Get all tool specs. */
  getAllTools(): ToolSpec[] {
    return Array.from(this.tools.values()).map((t) => t.spec);
  }

  /** Get all resource specs. */
  getAllResources(): ResourceSpec[] {
    return Array.from(this.resources.values()).map((r) => r.spec);
  }

  /** Mount all registered tools and resources to an MCP server. */
  mount(server: McpServer): void {
    for (const [name, { spec, zodSchema }] of this.tools) {
      // @ts-expect-error Zod v4 types
      server.tool(name, spec.description, zodSchema.shape, async (input: any, extra: any) => {
        const context: ToolContext = {
          sessionId: extra.sessionId ?? 'unknown',
          metadata: extra.metadata ?? {},
          server,
        };
        return spec.handler(input, context);
      });
    }

    for (const [uriTemplate, { spec }] of this.resources) {
      server.resource(spec.name, uriTemplate, async (uri: any, extra: any) => {
        const context: ResourceContext = {
          sessionId: extra.sessionId ?? 'unknown',
          metadata: extra.metadata ?? {},
        };
        return spec.handler(String(uri), context);
      });
    }
  }

  /** Generate OpenAPI 3.1 specification. */
  toOpenAPI(): OpenAPIDocument {
    const paths: Record<string, any> = {};

    for (const tool of this.getAllTools()) {
      const path = `/tools/${tool.name}`;
      paths[path] = {
        post: {
          summary: tool.description,
          operationId: tool.name,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: this.zodToOpenAPI(tool.inputSchema),
              },
            },
          },
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: tool.outputSchema ? this.zodToOpenAPI(tool.outputSchema) : { type: 'object' },
                },
              },
            },
          },
          security: tool.permissions?.length ? [{ bearerAuth: tool.permissions }] : [],
        },
      };
    }

    for (const resource of this.getAllResources()) {
      const path = resource.uriTemplate.replace(/\{(\w+)\}/g, '{$1}');
      paths[path] = {
        get: {
          summary: resource.description,
          operationId: `get_${resource.name.replace(/\s+/g, '_')}`,
          parameters: this.extractPathParams(resource.uriTemplate),
          responses: {
            '200': {
              description: 'Success',
              content: {
                [resource.mimeType ?? 'application/json']: { schema: { type: 'object' } },
              },
            },
          },
        },
      };
    }

    return {
      openapi: '3.1.0',
      info: {
        title: 'SeNARS MCP API',
        version: '1.0.0',
        description: 'Model Context Protocol tools and resources for SeNARS',
      },
      paths,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };
  }

  /** Generate Markdown documentation. */
  toMarkdown(): string {
    const sections: string[] = ['# SeNARS MCP Registry\n'];

    if (this.tools.size > 0) {
      sections.push('## Tools\n');
      for (const tool of this.getAllTools()) {
        sections.push(`### \`${tool.name}\`\n`);
        sections.push(`${tool.description}\n`);
        sections.push(`**Permissions:** ${tool.permissions?.join(', ') ?? 'none'}`);
        sections.push(`**Mutating:** ${tool.mutating ? 'yes' : 'no'}\n`);
        sections.push('**Input Schema:**');
        sections.push('```json');
        sections.push(JSON.stringify(this.zodToJSONSchema(tool.inputSchema), null, 2));
        sections.push('```\n');
        if (tool.outputSchema) {
          sections.push('**Output Schema:**');
          sections.push('```json');
          sections.push(JSON.stringify(this.zodToJSONSchema(tool.outputSchema), null, 2));
          sections.push('```\n');
        }
      }
    }

    if (this.resources.size > 0) {
      sections.push('## Resources\n');
      for (const resource of this.getAllResources()) {
        sections.push(`### \`${resource.uriTemplate}\`\n`);
        sections.push(`**Name:** ${resource.name}`);
        sections.push(`**Description:** ${resource.description}`);
        sections.push(`**MIME Type:** ${resource.mimeType ?? 'application/json'}\n`);
      }
    }

    return sections.join('\n');
  }

  /** Validate tool input. */
  validateToolInput(name: string, input: unknown): z.infer<z.ZodSchema<any>> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.zodSchema.parse(input);
  }

  /** Convert Zod schema to OpenAPI schema (simplified). */
  private zodToOpenAPI(schema: any): any {
    const ctor = schema.constructor?.name;
    if (ctor === 'ZodString') return { type: 'string' };
    if (ctor === 'ZodNumber') return { type: 'number' };
    if (ctor === 'ZodBoolean') return { type: 'boolean' };
    if (ctor === 'ZodArray') return { type: 'array', items: this.zodToOpenAPI(schema.element) };
    if (ctor === 'ZodObject') {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const [key, field] of Object.entries(schema.shape)) {
        const f = field as any;
        const fieldCtor = f.constructor?.name;
        const optional = fieldCtor === 'ZodOptional' || fieldCtor === 'ZodDefault';
        const inner = optional ? f._def.innerType : f;
        properties[key] = this.zodToOpenAPI(inner);
        if (!optional) required.push(key);
      }
      return { type: 'object', properties, required, additionalProperties: false };
    }
    if (ctor === 'ZodOptional') return this.zodToOpenAPI(schema._def.innerType);
    if (ctor === 'ZodDefault') return this.zodToOpenAPI(schema._def.innerType);
    if (ctor === 'ZodEnum') return { type: 'string', enum: schema._def.values };
    return { type: 'object' };
  }

  /** Convert Zod schema to JSON Schema (simplified). */
  private zodToJSONSchema(schema: z.ZodSchema<any>): any {
    return this.zodToOpenAPI(schema);
  }

  /** Extract path parameters from URI template. */
  private extractPathParams(uriTemplate: string): any[] {
    const params: any[] = [];
    const matches = uriTemplate.match(/\{(\w+)\}/g);
    if (matches) {
      for (const match of matches) {
        const name = match.slice(1, -1);
        params.push({ name, in: 'path', required: true, schema: { type: 'string' } });
      }
    }
    return params;
  }
}

/** OpenAPI 3.1 document type. */
export interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, any>;
  components: {
    securitySchemes: Record<string, any>;
  };
}

/** Create a new MCP registry with default SeNARS tools. */
export function createDefaultMCPRegistry(): MCPRegistry {
  const registry = new MCPRegistry();
  // Tools/resources are registered by feature modules via side-effect imports
  return registry;
}