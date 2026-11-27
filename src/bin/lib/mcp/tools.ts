/**
 * MCP Tools — All Tool Registrations
 * Consolidated from mcp-tools.ts + mcp-dialogue-tools.ts
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { ChatStreamEvent } from '../../../agent/index';
import { withinWorkspace } from '../../../motor/index';
import type { NAR } from '@senars/nar';
import { Truth } from '../../../kernel/truth';
import type { ExtendedAgent as Agent } from '../../../agent/index';
import { resetDemotions } from '../../../lm/index';
import { filterFolded } from '@senars/util/text';
import { takeLast, unique } from '@senars/util/collections';
import { positiveInt } from '@senars/config';
import { evaluateExpression } from '@senars/util/eval';
import { z } from 'zod';
import type { JobManager } from './jobs';
import { registerNARRegistryTools, ANNOTATIONS, createMCPResponse, formatBeliefsForMCP, stringifyMCP } from './core';
import { SenarsError } from '../../../errors/senars-error';
import type { EpisodicMemory } from '@senars/nar/memory/episodic';
import type { DialogueCapture as DialogueCaptureType } from '../../../dialogue/index';
import { retrospect, selectProbes } from '../../../dialogue/index';
import { parseJsonOr } from '@senars/util/fs';
import type { ReadOnlyLookup } from '@senars/util/collections';

/* ============================================================================
 * NAR Tools (from mcp-tools.ts)
 * ==========================================================================*/

export interface NARToolsOptions {
  jobs?: JobManager;
  /** Require approval for mutating tools (write_file). */
  approval?: boolean;
}

/**
 * Drives the agent chat generator to completion, returning the final text.
 * `onDelta` receives intermediate events so the streaming variant can forward
 * progress notifications instead of blocking until the answer is complete.
 */
const chatToCompletion = async (
  agent: Agent,
  input: string,
  onDelta?: (event: ChatStreamEvent) => void
): Promise<string> => {
  let result = '';
  for await (const event of agent.chat(input)) {
    if (event.kind === 'finish' || event.kind === 'aborted' || event.kind === 'error') {
      result = event.text ?? '';
    } else {
      onDelta?.(event);
    }
  }
  return result;
};

/** Registers an agent chat tool; `stream` mirrors deltas as progress notifications. */
const registerChatTool = (
  server: McpServer,
  agent: Agent,
  spec: { name: string; title: string; description: string; stream: boolean }
): void => {
  const { name, title, description, stream } = spec;
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema: { input: z.string(), historyLimit: z.number().optional() },
      outputSchema: { response: z.string() },
      annotations: ANNOTATIONS.open,
    },
    async ({ input }, extra) => {
      const result = await chatToCompletion(agent, input, (event) => {
        if (stream) {
          extra?.sendNotification?.({
            method: 'notifications/message',
            params: { level: 'info', logger: 'senars', data: event },
          });
        }
      });
      return createMCPResponse(result, { response: result });
    }
  );
};

export function registerNARTools(
  server: McpServer,
  nar: NAR,
  agent: Agent,
  options?: NARToolsOptions
): void {
  server.registerTool(
    'calculate',
    {
      title: 'Calculator',
      description: 'Evaluate arithmetic/math expressions',
      inputSchema: { expression: z.string() },
      outputSchema: { result: z.number() },
      annotations: ANNOTATIONS.read,
    },
    async ({ expression }) => {
      // No character stripping: `evaluateExpression` rejects what it cannot parse,
      // where sanitizing first would silently answer a different question.
      const result = evaluateExpression(expression);
      return createMCPResponse(String(result), { result });
    }
  );

  // read_file and write_file are registered via registerNARRegistryTools from nar's tool registry
  // This avoids duplicate registration conflicts

  server.registerTool(
    'search_memory',
    {
      title: 'Search Memory',
      description: 'Search NAR memory for beliefs',
      inputSchema: { query: z.string() },
      outputSchema: { results: z.array(z.object({ term: z.string(), truth: z.any() })) },
      annotations: ANNOTATIONS.read,
    },
    async ({ query }) => {
      const beliefs = nar.getBeliefs();
      const results = filterFolded(beliefs, query, (b) => b.term.toString());
      const structuredResults = formatBeliefsForMCP(results);
      return createMCPResponse(stringifyMCP(structuredResults), { results: structuredResults });
    }
  );

  server.registerTool(
    'run_reasoning',
    {
      title: 'Run Reasoning',
      description: 'Run NAL inference steps',
      inputSchema: { steps: z.number() },
      outputSchema: {
        derived: z.number(),
        beliefs: z.array(z.object({ term: z.string(), truth: z.any() })),
      },
      annotations: ANNOTATIONS.run,
    },
    async ({ steps }) => {
      const derived = await nar.run(steps);
      const recentBeliefs = formatBeliefsForMCP(takeLast(nar.getBeliefs(), 10));
      return createMCPResponse(stringifyMCP({ derived, beliefs: recentBeliefs }), {
        derived,
        beliefs: recentBeliefs,
      });
    }
  );

  server.registerTool(
    'learn_belief',
    {
      title: 'Learn Belief',
      description: 'Add a belief to memory',
      inputSchema: { belief: z.string() },
      outputSchema: { added: z.string() },
      annotations: ANNOTATIONS.apply,
    },
    async ({ belief }) => {
      await nar.believe(belief);
      return createMCPResponse(`Added belief: ${belief}`, { added: belief });
    }
  );

  server.registerTool(
    'explain_belief',
    {
      title: 'Explain Belief',
      description: 'Explain how a belief was derived',
      inputSchema: { term: z.string() },
      outputSchema: { term: z.string(), derivation: z.string() },
      annotations: ANNOTATIONS.read,
    },
    async ({ term }) => {
      const result = await nar.tools.execute('explain', { term });
      const derivation = result.success
        ? stringifyMCP(result.content)
        : (result.error ?? 'Explain failed');
      return createMCPResponse(`Derivation for ${term}: ${derivation}`, { term, derivation });
    }
  );

  for (const stream of [false, true]) {
    registerChatTool(server, agent, {
      name: stream ? 'agent_chat_stream' : 'agent_chat',
      title: stream ? 'Agent Chat Stream' : 'Agent Chat',
      description: `Chat with the agent (${stream ? 'streaming' : 'non-streaming'})`,
      stream,
    });
  }

  server.registerTool(
    'agent_believe',
    {
      title: 'Agent Believe',
      description: 'Add a belief to NAR memory',
      inputSchema: { narsese: z.string() },
      outputSchema: { success: z.boolean() },
      annotations: ANNOTATIONS.apply,
    },
    async ({ narsese }) => {
      await agent.believe(narsese);
      return createMCPResponse('Belief added successfully', { success: true });
    }
  );

  server.registerTool(
    'agent_recall',
    {
      title: 'Agent Recall',
      description: 'Recall from episodic memory',
      inputSchema: { query: z.string().optional(), limit: z.number().optional() },
      outputSchema: z.any(),
      annotations: ANNOTATIONS.read,
    },
    async ({ query, limit }) => {
      const result = await agent.recall(query, limit);
      return createMCPResponse(stringifyMCP(result), result as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    'agent_know',
    {
      title: 'Agent Know',
      description: 'Store or retrieve knowledge',
      inputSchema: { key: z.string(), value: z.string().optional() },
      outputSchema: {
        key: z.string(),
        value: z.string().optional(),
        stored: z.boolean().optional(),
      },
      annotations: ANNOTATIONS.set,
    },
    async ({ key, value }) => {
      if (value !== undefined) {
        agent.know(key, value);
        return createMCPResponse(`Stored: ${key} = ${value}`, { key, value, stored: true });
      }
      const result = agent.knowGet?.(key);
      return createMCPResponse(stringifyMCP({ key, value: result }), {
        key,
        value: result,
        stored: false,
      });
    }
  );

  server.registerTool(
    'agent_lm_rule_enable',
    {
      title: 'Enable LM Rule',
      description: 'Enable an LM rule',
      inputSchema: { id: z.string() },
      outputSchema: { enabled: z.boolean(), id: z.string() },
      annotations: ANNOTATIONS.set,
    },
    async ({ id }) => {
      const rule = nar.getProcessor().getModelRule(id);
      if (!rule) {
        return createMCPResponse(`LM rule not found: ${id}`, { enabled: false, id });
      }
      rule.enable();
      return createMCPResponse(`Enabled LM rule: ${id}`, { enabled: true, id });
    }
  );

  server.registerTool(
    'agent_lm_rule_disable',
    {
      title: 'Disable LM Rule',
      description: 'Disable an LM rule',
      inputSchema: { id: z.string() },
      outputSchema: { disabled: z.boolean(), id: z.string() },
      annotations: ANNOTATIONS.set,
    },
    async ({ id }) => {
      const rule = nar.getProcessor().getModelRule(id);
      if (!rule) {
        return createMCPResponse(`LM rule not found: {id}`, { disabled: false, id });
      }
      rule.disable();
      return createMCPResponse(`Disabled LM rule: {id}`, { disabled: true, id });
    }
  );

  server.registerTool(
    'list_lm_rules',
    {
      title: 'List LM Rules',
      description: 'List LM rules with their enablement state and stats',
      inputSchema: {},
      outputSchema: { rules: z.array(z.any()) },
      annotations: ANNOTATIONS.read,
    },
    async () => {
      const rules = nar.getProcessor().getModelRuleStats();
      return createMCPResponse(stringifyMCP({ rules }), { rules });
    }
  );

  server.registerTool(
    'agent_explain',
    {
      title: 'Agent Explain',
      description: 'Explain a belief or goal',
      inputSchema: { term: z.string(), type: z.enum(['belief', 'goal']).optional() },
      outputSchema: { term: z.string(), type: z.string(), explanation: z.string() },
      annotations: ANNOTATIONS.read,
    },
    async ({ term, type }) => {
      const result = await nar.tools.execute('explain', {
        term,
        includeDerivations: type !== 'goal',
      });
      const explanation = result.success
        ? stringifyMCP(result.content)
        : (result.error ?? 'Explain failed');
      return createMCPResponse(`Explanation for {term} ({type ?? 'belief'}): {explanation}`, {
        term,
        type: type ?? 'belief',
        explanation,
      } as Record<string, unknown>);
    }
  );

  server.registerTool(
    'agent_goal_progress',
    {
      title: 'Agent Goal Progress',
      description: 'Get goal progress or list active goals',
      inputSchema: { goalId: z.string().optional() },
      outputSchema: { goals: z.array(z.object({ goalId: z.string(), progress: z.number() })) },
      annotations: ANNOTATIONS.read,
    },
    async ({ goalId }) => {
      const goalsList = nar.getGoals();
      // progress = best matching belief truth (f·c): a goal is "achieved" when
      // symbolic inference has admitted a belief with the same term.
      const estimate = (term: string): number => {
        let best = 0;
        for (const b of nar.getBeliefs()) {
          if (String(b.term) === term && b.truth) best = Math.max(best, Truth.attention(b.truth));
        }
        return best;
      };
      if (goalId) {
        const goal = goalsList.find((g) => String(g.term) === goalId);
        if (!goal) return createMCPResponse(`Unknown goal: {goalId}`, { goalId, progress: 0 });
        const goals = [{ goalId, progress: estimate(goalId) }];
        return createMCPResponse(stringifyMCP({ goals }), { goals });
      }
      const goals = goalsList.map((g) => ({
        goalId: String(g.term),
        progress: estimate(String(g.term)),
      }));
      return createMCPResponse(stringifyMCP({ goals }), { goals });
    }
  );

  server.registerTool(
    'routing_reset',
    {
      title: 'Reset Routing Demotions',
      description: 'Clear session-level routing demotions so all candidates rank normally again',
      inputSchema: {},
      outputSchema: { reset: z.boolean() },
      annotations: ANNOTATIONS.set,
    },
    async () => {
      resetDemotions();
      return createMCPResponse('Routing demotions cleared', { reset: true });
    }
  );

  server.registerTool(
    'get_beliefs',
    {
      title: 'Get Beliefs',
      description: 'Get all beliefs from NAR memory',
      inputSchema: {},
      outputSchema: { beliefs: z.array(z.object({ term: z.string(), truth: z.any() })) },
      annotations: ANNOTATIONS.read,
    },
    async () => {
      const beliefs = formatBeliefsForMCP(nar.getBeliefs());
      return createMCPResponse(stringifyMCP(beliefs), { beliefs });
    }
  );

  server.registerTool(
    'get_attention',
    {
      title: 'Get Attention',
      description: 'Get current attention snapshot',
      inputSchema: {},
      outputSchema: z.any(),
      annotations: ANNOTATIONS.read,
    },
    async () => {
      const report = nar.attentionReport();
      return createMCPResponse(stringifyMCP(report), report);
    }
  );

  server.registerTool(
    'run_job',
    {
      title: 'Run Job',
      description:
        'Start a fire-and-forget background job. Kinds: nar-cycles (run NAR inference steps), belief (add a belief), question (queue a question)',
      inputSchema: {
        kind: z.enum(['nar-cycles', 'belief', 'question']),
        steps: positiveInt.max(10_000).optional(),
        content: z.string().optional(),
      },
      outputSchema: { jobId: z.string() },
      annotations: ANNOTATIONS.run,
    },
    async ({ kind, steps, content }) => {
      const jobs = options?.jobs;
      if (!jobs)
        return createMCPResponse('Job manager unavailable', { error: 'jobs not available' });
      const runFn = (): Promise<unknown> | unknown => {
        switch (kind) {
          case 'nar-cycles':
            return nar.run(steps ?? 10);
          case 'question':
            if (!content) throw new SenarsError('run_job kind=question requires content', 'VALIDATION_ERROR', { kind });
            return nar.question(content);
          default:
            if (!content) throw new SenarsError('run_job kind=belief requires content', 'VALIDATION_ERROR', { kind });
            return nar.believe(content);
        }
      };
      const id = jobs.submit(kind, runFn);
      return createMCPResponse(`Job {id} started ({kind})`, { jobId: id });
    }
  );

  server.registerTool(
    'job_status',
    {
      title: 'Job Status',
      description: 'Get the status/result of a background job (or all jobs)',
      inputSchema: { jobId: z.string().optional() },
      outputSchema: z.any(),
      annotations: ANNOTATIONS.read,
    },
    async ({ jobId }) => {
      const jobs = options?.jobs;
      if (!jobs)
        return createMCPResponse('Job tracking not available', { error: 'jobs not available' });
      if (jobId) {
        const job = jobs.get(jobId);
        if (!job) return createMCPResponse(`Unknown job: {jobId}`, { error: 'unknown job id' });
        return createMCPResponse(stringifyMCP(job), job as unknown as Record<string, unknown>);
      }
      return createMCPResponse(stringifyMCP({ jobs: jobs.list() }), {
        jobs: jobs.list() as unknown as Record<string, unknown>,
      });
    }
  );

  registerNARRegistryTools(server, nar);
}

/* ============================================================================
 * Dialogue Tools (from mcp-dialogue-tools.ts)
 * ==========================================================================*/

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
  const row = parseJsonOr<Partial<TurnRow> | undefined>(content, undefined);
  return row?.turnId && row.sessionId ? (row as TurnRow) : undefined;
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
      return createMCPResponse(`Reaction {kind} bound to {turn.turnId}`, {
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
        limit: positiveInt.max(100).default(10),
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
          : `${recent.length} turn(s) for session {session}`,
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
      inputSchema: { limit: positiveInt.max(100).default(16) },
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
          : `{probes.length} probe(s)`,
        { probes }
      );
    }
  );
}