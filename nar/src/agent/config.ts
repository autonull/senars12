import type { PromptBuilder } from '@senars/core';
import type { PersistableSessionManager } from '@senars/core/memory';
import type { EpisodicMemory, LMService, NAR } from '@senars/nar';

export interface CreateAgentConfig {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  persistence?: { path: string };
  sessionId?: string;
  externalTools?: Record<string, unknown>;
  /** Engine enable flags (config-file `backends` block). */
  engines?: { nar?: boolean };
  throttle?: number;
  promptBuilder?: PromptBuilder;
  /** Bot identity — persona injected into the chat system prompt. */
  profile?: {
    name?: string;
    personality?: string;
    narrateTier?: 'quality' | 'fast' | 'structured';
  };
  /** Composable skill package: instructions injected into the system prompt. */
  skills?: Array<{ id: string; description?: string; instructions: string; enabled?: boolean }>;
  /** Conversation compaction thresholds (`bot.conversation` config block). */
  conversation?: { maxHistory?: number; summaryThreshold?: number };
  /** E4 follow-up (a): JSONL path persisting per-cycle trajectories for implicit preference pairing. */
  trajectoryStorePath?: string;
  sessionManager?: PersistableSessionManager;
}
