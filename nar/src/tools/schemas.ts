import type { ConnectionConfig } from '@senars/util';
import { agentOptionsSchema } from '@senars/util/config';
import { z } from 'zod';

export const ToolSpecSchema = z
  .object({
    name: z.string().min(1).describe('Tool name'),
    description: z.string().min(1).describe('Tool description'),
    inputSchema: z.record(z.string(), z.unknown()).describe('JSON Schema for tool input'),
  })
  .strict();

export type ToolSpec = z.infer<typeof ToolSpecSchema>;

/** The zod twin, pinned to the transport type so a widened field is a compile error here. */
export const ConnectionConfigSchema: z.ZodType<ConnectionConfig> = z
  .object({
    id: z.string().min(1).describe('Connection ID'),
    enabled: z.boolean().describe('Whether the connection is enabled'),
    type: z.string().min(1).describe('Connection type (cli, irc, ws, http, mcp)'),
    config: z.record(z.string(), z.unknown()).describe('Type-specific configuration'),
    authSecret: z.string().optional().describe('Optional auth secret'),
  })
  .strict();

export const AgentOptionsSchema = agentOptionsSchema;

export type AgentOptions = z.infer<typeof AgentOptionsSchema>;
