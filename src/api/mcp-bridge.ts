import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NAR } from '@senars/nar';
import type { Schema, SchemaProperty, Tool, ToolResult } from '@senars/nar/tools';
import { type ZodTypeAny, z } from 'zod';
import { createMCPResponse, stringifyMCP } from './mcp-response.js';

const zodFromProperty = (p: SchemaProperty): ZodTypeAny => {
  let base: ZodTypeAny;
  switch (p.type) {
    case 'number':
      base = z.number();
      break;
    case 'boolean':
      base = z.boolean();
      break;
    case 'array':
      base = z.array(p.items ? zodFromProperty(p.items) : z.unknown());
      break;
    case 'object': {
      const inner = Object.fromEntries(
        Object.entries(p.properties ?? {}).map(([k, v]) => [k, zodFromProperty(v)])
      );
      base = z.object(inner);
      break;
    }
    default:
      base = p.enum ? z.enum(p.enum as [string, ...string[]]) : z.string();
  }
  if (p.description) base = base.describe(p.description);
  if (p.minimum !== undefined && base instanceof z.ZodNumber) base = base.min(p.minimum);
  if (p.maximum !== undefined && base instanceof z.ZodNumber) base = base.max(p.maximum);
  return base;
};

export const zodFromSchema = (schema: Schema): Record<string, ZodTypeAny> =>
  Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, zodFromProperty(v)]));

export const toolAnnotations = (tool: Tool) => ({
  readOnlyHint: tool.capabilities?.readOnly ?? false,
  idempotentHint: tool.capabilities?.idempotent ?? false,
  openWorldHint: !tool.capabilities?.pure,
});

const toMcpContent = (result: ToolResult): unknown =>
  result.success ? result.content : { error: result.error ?? 'Tool failed' };

/**
 * Bridge NAR's internal tool registry onto an MCP server.
 * Every registered internal tool becomes an MCP tool (prefixed `nar_`),
 * so MCP clients and the internal agent share one tool implementation.
 */
export function registerNARRegistryTools(server: McpServer, nar: NAR): void {
  const registered = new Set<string>();
  for (const tool of nar.tools.list()) {
    const name = `nar_${tool.name}`;
    if (registered.has(name)) continue;
    registered.add(name);
    server.registerTool(
      `nar_${tool.name}`,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.parameters ? zodFromSchema(tool.parameters) : {},
        annotations: toolAnnotations(tool),
      },
      async (args) => {
        const result = await nar.tools.execute(tool.name, args);
        return createMCPResponse(stringifyMCP(toMcpContent(result)), toMcpContent(result));
      }
    );
  }
}
