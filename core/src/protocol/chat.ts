/**
 * Chat protocol schemas
 */
import { BeliefTruthSchema } from '@senars/util';
import { z } from 'zod';
import { TruthValueSchema } from '../schemas/truth.js';

export const ChatMessage = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'system']),
  content: z.string(),
  html: z.string().optional(),
  timestamp: z.number(),
  term: z.string().optional(),
  truth: BeliefTruthSchema.optional(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  parentId: z.string().nullable(),
  threadRootId: z.string(),
  supports: z.array(z.string()),
  contradicts: z.array(z.string()),
  derivesFrom: z.array(z.string()),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

/** The shared `0..1` truth pair, under this protocol's name. */
export const TruthValue = TruthValueSchema;
export type TruthValue = z.infer<typeof TruthValue>;

export const ChatUserMsg = z.object({
  type: z.literal('chat.user'),
  content: z.string().min(1).max(10000),
});
export const ChatAgentStream = z.object({
  type: z.literal('chat.agent.stream'),
  delta: z.string(),
});
export const ChatAgentComplete = z.object({
  type: z.literal('chat.agent.complete'),
  content: z.string(),
  html: z.string().optional(),
  messageId: z.string(),
});
export const LMStatusRequest = z.object({
  type: z.literal('lm.status.request'),
});
export const LMStatusMsg = z.object({
  type: z.literal('lm.status'),
  data: z.record(z.string(), z.unknown()),
});
