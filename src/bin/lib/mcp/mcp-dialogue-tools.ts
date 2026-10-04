import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EpisodicMemory } from '@senars/nar';
import type { DialogueCapture as DialogueCaptureType } from '@senars/nar/dialogue';
import { retrospect, selectProbes } from '@senars/nar/dialogue';
import { type ReadOnlyLookup, takeLast, unique } from '@senars/util';
import { z } from 'zod';
import { ANNOTATIONS, createMCPResponse, stringifyMCP } from './mcp-response.js';

const EMPTY_GRADES: ReadOnlyLookup<string, number> = {
  get: () => undefined,
  has: () => false,
  [Symbol.iterator]: () => [][Symbol.iterator](),
};

export interface DialogueToolsOptions {
  dialogue: DialogueCaptureType;
  /** Episodic memory backing turns/reactions — required by turns/retrospect/probes. */
  episodic?: EpisodicMemory;
  /** Trace grades by correlationId (for curriculum probe selection, TODO25 Phase C). */
  traceGrades?: ReadOnlyLookup<string, number>;
}

interface TurnRow {
  turnId: string;
  sessionId: string;
  seq: number;
  grounding?: { admitted: boolean; score: number };
  responseDigest?: string;
}

const parseTurnRow = (content: string): TurnRow | undefined => {
  try {
    const row = JSON.parse(content) as TurnRow;
    return row.turnId && row.sessionId ? row : undefined;
  } catch {
    return undefined;
  }
};

const sessionIdOf = (episode: { metadata: unknown }): string | undefined =>
  (episode.metadata as { sessionId?: string } | null)?.sessionId;

/**
 * TODO24 §12 extension point: MCP tool exposure of the Dialogue Flywheel so
 * AI-agent clients can drive the self-correction loop — react to turns, list
 * captures, run retrospectives. Thin adapter over the `DialogueCapture` class
 * boundary (§3: the class is the API).
 */
export function registerDialogueTools(server: McpServer, options: DialogueToolsOptions): void {
  const { dialogue, episodic, traceGrades } = options;

  server.registerTool(
    'dialogue_react',
    {
      title: 'Dialogue React',
      description:
        'Bind an explicit reaction (accept/correct/reject/clarify/redirect/abandon) to the most recent dialogue turn',
      inputSchema: {
        kind: z.enum(['accept', 'correct', 'reject', 'clarify', 'redirect', 'abandon']),
        correction: z.string().optional(),
      },
      annotations: ANNOTATIONS.set,
    },
    async ({ kind, correction }) => {
      const turn = dialogue.latestTurn();
      if (!turn) return createMCPResponse('No captured turn to react to.', {});
      if (kind === 'correct' && !correction?.trim())
        return createMCPResponse('Correction text required for kind=correct.', {});
      await dialogue.bindReaction(turn.turnId, kind, correction);
      return createMCPResponse(`Reaction ${kind} bound to ${turn.turnId}`, {
        turnId: turn.turnId,
        kind,
      });
    }
  );

  server.registerTool(
    'dialogue_turns',
    {
      title: 'Dialogue Turns',
      description: 'List captured dialogue turns (hash-only digests)',
      inputSchema: {
        sessionId: z.string().optional(),
        limit: z.number().int().positive().max(100).default(10),
      },
      outputSchema: { sessionId: z.string().nullable(), turns: z.array(z.any()) },
      annotations: ANNOTATIONS.read,
    },
    async ({ sessionId, limit }) => {
      if (!episodic) return createMCPResponse('Episodic memory not available.', { turns: [] });
      const episodes = await episodic.getEpisodes({ type: 'dialogue', limit: 500 });
      const session =
        sessionId ??
        unique(episodes.map((e) => sessionIdOf(e) ?? ''))
          .filter(Boolean)
          .pop();
      const turns = episodes
        .filter((e) => sessionIdOf(e) === session)
        .map((e) => parseTurnRow(e.content))
        .filter((t): t is TurnRow => t !== undefined);
      const recent = takeLast(turns, limit);
      return createMCPResponse(
        recent.length === 0
          ? 'No captured turns.'
          : `${recent.length} turn(s) for session ${session}`,
        { sessionId: session ?? null, turns: recent }
      );
    }
  );

  server.registerTool(
    'dialogue_retrospect',
    {
      title: 'Dialogue Retrospect',
      description: 'Run a session-level retrospective diagnostic over captured turns and reactions',
      inputSchema: { sessionId: z.string() },
      outputSchema: { sessionId: z.string(), retrospective: z.any() },
      annotations: ANNOTATIONS.run,
    },
    async ({ sessionId }) => {
      if (!episodic) return createMCPResponse('Episodic memory not available.', {});
      const retrospective = await retrospect(sessionId, episodic, { traceGrades });
      return createMCPResponse(stringifyMCP(retrospective), { sessionId, retrospective });
    }
  );

  server.registerTool(
    'dialogue_probes',
    {
      title: 'Dialogue Probes',
      description:
        'Select curriculum probes from flywheel-graded data (corrected turns first, then low trace grades)',
      inputSchema: { limit: z.number().int().positive().max(100).default(16) },
      outputSchema: { probes: z.array(z.any()) },
      annotations: ANNOTATIONS.read,
    },
    async ({ limit }) => {
      if (!episodic) return createMCPResponse('Episodic memory not available.', { probes: [] });
      const probes = await selectProbes(
        {
          reactions: () => episodic.getEpisodes({ type: 'reaction', limit: 1000 }),
          grades: () => traceGrades ?? EMPTY_GRADES,
        },
        { limit }
      );
      return createMCPResponse(
        probes.length === 0
          ? 'No probes yet (requires corrected or low-graded turns).'
          : `${probes.length} probe(s)`,
        { probes }
      );
    }
  );
}
