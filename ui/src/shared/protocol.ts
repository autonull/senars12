import { z } from 'zod';

export const ChatUserMsg = z.object({ type: z.literal('chat.user'), content: z.string() });
export const ChatAgentStream = z.object({ type: z.literal('chat.agent.stream'), delta: z.string() });
export const ChatAgentComplete = z.object({ type: z.literal('chat.agent.complete'), content: z.string() });

export const CognitiveUpdate = z.object({
  type: z.literal('cognitive.update'),
  module: z.enum(['belief_graph', 'stream_reasoner', 'working_memory', 'drives']),
  data: z.any(),
});

export const ConfigSchema = z.object({
  type: z.literal('config.schema'),
  data: z.record(z.string(), z.object({
    type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
    label: z.string(),
    value: z.any(),
    options: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })),
});

export const ConfigUpdate = z.object({
  type: z.literal('config.set'),
  key: z.string(),
  value: z.any(),
});

export const IncomingMessage = z.discriminatedUnion('type', [
  ChatAgentStream, ChatAgentComplete, CognitiveUpdate, ConfigSchema,
]);
export type IncomingMessage = z.infer<typeof IncomingMessage>;
