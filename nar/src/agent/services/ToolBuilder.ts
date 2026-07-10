/**
 * Tool Builder Service
 * Centralizes tool creation logic for the agent
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { NAR } from '../..';
import type { EpisodicMemory } from '../../memory/EpisodicMemory.js';
import { createGeneralTools, createNARSTools } from '../../tools/adapters';
import type { ConversationSession } from '../ConversationSession.js';
import type { SessionOrchestrator } from '../subservices/SessionOrchestrator.js';

export interface ToolBuilderConfig {
  nar?: NAR;
  episodicMemory?: EpisodicMemory;
  sessionOrchestrator: SessionOrchestrator;
  extToolOpts: Record<string, unknown>;
  know: (key: string, value: string) => void;
  knowGet: (key: string) => string | undefined;
  knowList: () => Array<{ key: string; value: string }>;
  recall: (
    query?: string,
    limit?: number
  ) => Promise<Array<{ timestamp: number; type: string; content: string }>>;
}

export class ToolBuilder {
  private readonly config: ToolBuilderConfig;

  constructor(config: ToolBuilderConfig) {
    this.config = config;
  }

  buildTools(session?: ConversationSession): Record<string, unknown> {
    const tools: Record<string, unknown> = {};

    if (this.config.nar) {
      Object.assign(
        tools,
        createNARSTools(this.config.nar as Parameters<typeof createNARSTools>[0])
      );
      Object.assign(
        tools,
        createGeneralTools({
          nar: this.config.nar as Parameters<typeof createGeneralTools>[0]['nar'],
          episodicMemory: this.config.episodicMemory as Parameters<
            typeof createGeneralTools
          >[0]['episodicMemory'],
        })
      );
    }

    Object.assign(tools, this.buildAgentTools(session));

    if (session) {
      const pad = this.config.sessionOrchestrator.getScratchpad(session);
      if (pad) {
        Object.assign(tools, this.buildSessionContextTools(pad));
      }
    }

    if (this.config.extToolOpts) {
      Object.assign(tools, this.config.extToolOpts);
    }

    // Filter out any undefined tool values (e.g., session-scoped tools without session)
    return Object.fromEntries(Object.entries(tools).filter(([, v]) => v !== undefined));
  }

  private buildAgentTools(session?: ConversationSession): Record<string, unknown> {
    return {
      know: tool({
        description: 'Store a key-value pair in long-term knowledge.',
        inputSchema: z.object({
          key: z.string().describe('The key to store'),
          value: z.string().describe('The value to store'),
        }),
        execute: ({ key, value }: { key: string; value: string }) => {
          this.config.know(key, value);
          return { stored: true, key };
        },
      }),
      knowGet: tool({
        description: 'Retrieve a value from long-term knowledge.',
        inputSchema: z.object({
          key: z.string().describe('The key to look up'),
        }),
        execute: ({ key }: { key: string }) => {
          const value = this.config.knowGet(key);
          return value !== undefined ? { found: true, key, value } : { found: false, key };
        },
      }),
      knowList: tool({
        description: 'List all entries in long-term knowledge.',
        inputSchema: z.object({}),
        execute: () => ({ entries: this.config.knowList() }),
      }),
      recall: tool({
        description: 'Recall episodic memories.',
        inputSchema: z.object({
          query: z.string().optional().describe('Optional query to filter memories'),
          limit: z.number().optional().describe('Maximum number of memories to return'),
        }),
        execute: async ({ query, limit }: { query?: string; limit?: number }) => {
          return this.config.recall(query, limit);
        },
      }),
      setInstructions: session
        ? tool({
            description: 'Set system instructions for this session.',
            inputSchema: z.object({
              mode: z.enum(['append', 'replace']).describe('How to apply instructions'),
              instructions: z.string().describe('The instructions to set'),
            }),
            execute: ({
              mode,
              instructions,
            }: { mode: 'append' | 'replace'; instructions: string }) => {
              this.config.sessionOrchestrator.setSessionInstructions(session, mode, instructions);
              return { updated: true };
            },
          })
        : undefined,
      getSessionInfo: session
        ? tool({
            description: 'Get information about the current session.',
            inputSchema: z.object({}),
            execute: () => ({
              messageCount: session.history.length,
              createdAt: session.createdAt,
              pinnedBeliefs: [...session.pinnedBeliefs],
            }),
          })
        : undefined,
    };
  }

  private buildSessionContextTools(pad: Map<string, string>): Record<string, unknown> {
    return {
      set_context: tool({
        description: 'Store a key-value pair in the session scratchpad for this conversation.',
        inputSchema: z.object({
          key: z.string().describe('The key to store'),
          value: z.string().describe('The value to store'),
        }),
        execute: ({ key, value }: { key: string; value: string }) => {
          pad.set(key, value);
          return { stored: true, key };
        },
      }),
      get_context: tool({
        description: 'Retrieve a value from the session scratchpad.',
        inputSchema: z.object({
          key: z.string().describe('The key to look up'),
        }),
        execute: ({ key }: { key: string }) => {
          const value = pad.get(key);
          return value !== undefined ? { found: true, key, value } : { found: false, key };
        },
      }),
      list_context: tool({
        description: 'List all entries in the session scratchpad.',
        inputSchema: z.object({}),
        execute: () => ({ entries: [...pad.entries()].map(([k, v]) => ({ key: k, value: v })) }),
      }),
    };
  }
}
