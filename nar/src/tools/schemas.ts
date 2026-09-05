import { z } from 'zod';

export const ToolSpecSchema = z.object({
  name: z.string().min(1).describe('Tool name'),
  description: z.string().min(1).describe('Tool description'),
  inputSchema: z.record(z.string(), z.unknown()).describe('JSON Schema for tool input'),
});

export type ToolSpec = z.infer<typeof ToolSpecSchema>;

export const ConnectionConfigSchema = z.object({
  id: z.string().min(1).describe('Connection ID'),
  enabled: z.boolean().describe('Whether the connection is enabled'),
  type: z.string().min(1).describe('Connection type (cli, irc, ws, http, mcp)'),
  config: z.record(z.string(), z.unknown()).describe('Type-specific configuration'),
  authSecret: z.string().optional().describe('Optional auth secret'),
});

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export const AgentOptionsSchema = z.object({
  nar: z.unknown().optional().describe('NAR instance'),
  lmService: z.unknown().optional().describe('LM service'),
  episodicMemory: z.unknown().optional().describe('Episodic memory'),
  systemInstructions: z.string().min(1).max(16_000).optional().describe('System instructions'),
  context: z
    .object({
      attention: z.union([z.boolean(), z.array(z.string())]).optional(),
      beliefs: z.union([z.boolean(), z.array(z.string())]).optional(),
      goals: z.union([z.boolean(), z.array(z.string())]).optional(),
      questions: z.union([z.boolean(), z.array(z.string())]).optional(),
      concepts: z.union([z.boolean(), z.array(z.string())]).optional(),
      maxItems: z.number().int().positive().optional(),
      recency: z.number().int().min(0).optional(),
    })
    .optional()
    .describe('Context options'),
  maxLoops: z.number().int().min(0).max(50).default(5).describe('Maximum reasoning loops'),
  logger: z.unknown().optional().describe('Logger instance'),
  persistKnowledge: z.boolean().default(false).describe('Persist knowledge'),
  knowledgePath: z.string().default('.cache/agent-knowledge.json').describe('Knowledge persistence path'),
  workspaceRoot: z.string().optional().describe('Workspace root path'),
  externalTools: z.any().optional().describe('External tools'),
  approvalManager: z.any().optional().describe('Approval manager'),
  autonomyEngine: z.any().optional().describe('Autonomy engine'),
  reasoningIntervalMs: z.number().int().min(0).optional().describe('Reasoning interval in ms'),
  sessionHistoryLimit: z.number().int().min(0).optional().describe('Session history limit'),
  rateLimitPerMinute: z.number().int().min(0).optional().describe('Rate limit per minute'),
  enableNlTranslation: z.boolean().optional().describe('Enable NL translation'),
  enableNarseseHumanization: z.boolean().optional().describe('Enable Narsese humanization'),
});

export type AgentOptions = z.infer<typeof AgentOptionsSchema>;