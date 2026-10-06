import type { ConnectionConfig } from '@senars/util';
import { agentOptionsSchema, nonEmpty } from '@senars/util/config';
import { z } from 'zod';

/** The zod twin, pinned to the transport type so a widened field is a compile error here. */
export const ConnectionConfigSchema: z.ZodType<ConnectionConfig> = z
  .object({
    id: nonEmpty.describe('Connection ID'),
    enabled: z.boolean().describe('Whether the connection is enabled'),
    type: nonEmpty.describe('Connection type (cli, irc, ws, http, mcp)'),
    config: z.record(z.string(), z.unknown()).describe('Type-specific configuration'),
    authSecret: z.string().optional().describe('Optional auth secret'),
  })
  .strict();

export const AgentOptionsSchema = agentOptionsSchema;

export type AgentOptions = z.infer<typeof AgentOptionsSchema>;
