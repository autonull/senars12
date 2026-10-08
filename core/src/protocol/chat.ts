/**
 * Chat protocol schemas
 */
import { MessageRoleSchema } from '@senars/util';
import { nonEmpty } from '@senars/util/config';
import { z } from 'zod';
import { TaskPunctuationSchema } from '../schemas/task.js';
import { TruthValueSchema } from '../schemas/truth.js';
import { msg } from './envelope.js';

export const ChatMessage = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  html: z.string().optional(),
  /** Declared composer intent (§8.1); a free string so the protocol stays UI-agnostic. */
  mode: z.string().optional(),
  /** The workspace block this turn follows up on (§1.6); a free string, client-owned. */
  context: z.string().optional(),
  timestamp: z.number(),
  term: z.string().optional(),
  truth: TruthValueSchema.optional(),
  punctuation: TaskPunctuationSchema.optional(),
  parentId: z.string().nullable(),
  threadRootId: z.string(),
  supports: z.array(z.string()),
  contradicts: z.array(z.string()),
  derivesFrom: z.array(z.string()),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatUserMsg = msg('chat.user', {
  content: nonEmpty.max(10000),
  mode: z.string().optional(),
  context: z.string().optional(),
});
export const ChatAgentStream = msg('chat.agent.stream', { delta: z.string() });
export const ChatAgentComplete = msg('chat.agent.complete', {
  content: z.string(),
  html: z.string().optional(),
  messageId: z.string(),
});
export const LMStatusRequest = msg('lm.status.request', {});
export const LMSwitchMsg = msg('lm.switch', { provider: nonEmpty });
export const LMStatusMsg = msg('lm.status', { data: z.record(z.string(), z.unknown()) });
