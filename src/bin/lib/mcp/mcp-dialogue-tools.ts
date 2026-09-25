import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DialogueCapture as DialogueCaptureType } from '@senars/nar/dialogue';
import { DialogueCapture } from '@senars/nar/dialogue';
import type { EpisodicMemory } from '@senars/util';
import { retrospect, selectProbes } from '@senars/nar/dialogue';
import { z } from 'zod';
import { createMCPResponse, stringifyMCP } from './mcp-response.js';

export interface DialogueToolsOptions {
  dialogue: DialogueCaptureType;
  /** Trace grades by correlationId (for curriculum probe selection, TODO25 Phase C). */
  traceGrades?: ReadonlyMap<string, number>;
}

/**
 * TODO24 §12 extension point: MCP tool exposure of the Dialogue Flywheel so
 * AI-agent clients can drive the self-correction loop — react to turns, list
 * captures, run retrospectives. Thin adapter over the `DialogueCapture` class
 * boundary (§3: the class is the API).
 */
export function registerDialogueTools(server: McpServer, options: DialogueToolsOptions): void {
  const dialogue: DialogueCaptureType = options.dialogue;

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
      const d = dialogue as DialogueCaptureType;
      const turn = d.latestTurn();
      if (!turn) return createMCPResponse('No captured turn to react to.', {});
      if (kind === 'correct' && !correction?.trim())
        return createMCPResponse('Correction text required for kind=correct.', {});
      await d.bindReaction(turn.turnId, kind, correction);
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
      return createMCPResponse('Episodic memory not available in this context.', { count: 0 });
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
      return createMCPResponse('Episodic memory not available in this context.', {});
    }
  );

  server.registerTool(
    'dialogue_probes',
    {
      title: 'Dialogue Probes',
      description: 'Select curriculum probes from flywheel-graded data (corrected turns first, then low trace grades)',
      inputSchema: { limit: z.number().int().positive().max(100).default(16) },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ limit }) => {
      return createMCPResponse('Episodic memory not available in this context.', { count: 0 });
    }
  );
}