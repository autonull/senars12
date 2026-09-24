import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EpisodicMemory } from '@senars/util';
import type { DialogueCapture } from '@senars/nar/dialogue';
import { retrospect } from '@senars/nar/dialogue';
import { z } from 'zod';
import { createMCPResponse, stringifyMCP } from './mcp-response.js';

export interface DialogueToolsOptions {
  dialogue: DialogueCapture;
  episodic?: EpisodicMemory;
}

/**
 * TODO24 §12 extension point: MCP tool exposure of the Dialogue Flywheel so
 * AI-agent clients can drive the self-correction loop — react to turns, list
 * captures, run retrospectives. Thin adapter over the `DialogueCapture` class
 * boundary (§3: the class is the API).
 */
export function registerDialogueTools(server: McpServer, options: DialogueToolsOptions): void {
  const { dialogue, episodic } = options;

  server.registerTool(
    'dialogue_react',
    {
      title: 'Dialogue React',
      description: 'Bind an explicit reaction (accept/correct/reject/clarify/redirect/abandon) to the most recent dialogue turn',
      inputSchema: {
        kind: z.enum(['accept', 'correct', 'reject', 'clarify', 'redirect', 'abandon']),
        correction: z.string().optional(),
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ kind, correction }) => {
      const turn = dialogue.latestTurn();
      if (!turn) return createMCPResponse('No captured turn to react to.');
      if (kind === 'correct' && !correction?.trim())
        return createMCPResponse('Correction text required for kind=correct.');
      await dialogue.bindReaction(turn.turnId, kind, correction);
      return createMCPResponse(`Reaction ${kind} bound to ${turn.turnId}`, { turnId: turn.turnId, kind });
    }
  );

  server.registerTool(
    'dialogue_turns',
    {
      title: 'Dialogue Turns',
      description: 'List captured dialogue turns (hash-only digests)',
      inputSchema: { limit: z.number().int().positive().max(100).default(10) },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ limit }) => {
      if (!episodic) return createMCPResponse('Episodic memory not available.');
      const episodes = await episodic.getEpisodes({ type: 'dialogue', limit: 100 });
      const rows = episodes.slice(-limit);
      return createMCPResponse(
        stringifyMCP(rows.map((e) => JSON.parse(e.content) as unknown)),
        { count: rows.length }
      );
    }
  );

  server.registerTool(
    'dialogue_retrospect',
    {
      title: 'Dialogue Retrospect',
      description: 'Run a session-level retrospective diagnostic over captured turns and reactions',
      inputSchema: { sessionId: z.string() },
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ sessionId }) => {
      if (!episodic) return createMCPResponse('Episodic memory not available.');
      const r = await retrospect(sessionId, episodic);
      return createMCPResponse(
        stringifyMCP(r),
        { sessionId: r.sessionId, turnCount: r.turnCount, reactionCount: r.reactionCount, digest: r.digest }
      );
    }
  );
}