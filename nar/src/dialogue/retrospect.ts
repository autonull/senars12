import { createHash } from 'node:crypto';
import { Ledger, createLedger, BaseLedgerEntrySchema } from '@senars/io';
import { z } from 'zod';
import { join } from 'node:path';
import type { Episode } from '@senars/util';
import { DigestMismatchError } from '../lm/system-one/wasi-runtime.js';
import type { EpisodicMemory } from '../memory/EpisodicMemory.js';
import {
  type CausalChainEdge,
  type CorrectionAnalysis,
  emptyReactionDistribution,
  type Lesson,
  type ReactionKind,
  type Retrospective,
} from './types.js';

const RETROSPECTIVE_DIR = '.cache/retrospectives';

const RetrospectiveSchema = BaseLedgerEntrySchema.extend({
  version: z.string(),
  sessionId: z.string(),
  turnCount: z.number(),
  reactionCount: z.number(),
  reactionDistribution: z.record(z.string(), z.number()),
  corrections: z.array(z.unknown()),
  contradictions: z.array(z.string()),
  strategyAudit: z.array(z.unknown()),
  proposals: z.array(z.unknown()),
  causalChains: z.array(z.unknown()).optional(),
  sessionContext: z.array(z.string()).optional(),
  provenance: z.object({ turnIds: z.array(z.string()) }),
  digest: z.string(),
});

type RetrospectiveLedgerEntry = z.infer<typeof RetrospectiveSchema>;

function getRetrospectiveLedger(dir = RETROSPECTIVE_DIR): Ledger<RetrospectiveLedgerEntry> {
  return createLedger<RetrospectiveLedgerEntry>(dir, RetrospectiveSchema, {
    rollover: { fixedFile: join(dir, 'retrospectives.jsonl') },
  });
}
/** Minimum viable session for a full analysis (below ⇒ skeleton report). */
const MIN_TURNS = 10;
const MIN_REACTIONS = 2;
/** Lesson admission floor (seed-truth confidence for non-LLM inputs). */
const LESSON_CONFIDENCE_FLOOR = 0.5;

export interface SessionTurn {
  turnId: string;
  sessionId: string;
  seq: number;
  utteranceDigest?: string;
  responseDigest?: string;
  grounding?: { admitted: boolean; score: number };
}

export interface SessionReaction {
  turnId: string;
  kind: ReactionKind;
  at: number;
  correctionDigest?: string;
  /** Phase A (REFACTOR.todo2): episode identity + cited causes for the causal-chain summary. */
  id?: string;
  causes?: readonly string[];
}

const parseTurn = (e: Episode): SessionTurn | undefined => {
  try {
    const d = JSON.parse(e.content) as SessionTurn;
    return d.turnId && d.sessionId ? d : undefined;
  } catch {
    return undefined;
  }
};

const parseReaction = (e: Episode): SessionReaction | undefined => {
  try {
    const d = JSON.parse(e.content) as SessionReaction;
    return d.turnId && d.kind
      ? {
          ...d,
          at: e.timestamp,
          ...(e.id ? { id: e.id } : {}),
          ...(Array.isArray(e.causes) ? { causes: e.causes } : {}),
        }
      : undefined;
  } catch {
    return undefined;
  }
};

export const digestPin = (
  turnIds: readonly string[],
  distribution: Record<ReactionKind, number>
): string => {
  const canonical = [...turnIds].sort().join(',') + '|' + JSON.stringify(distribution);
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
};

/**
 * TODO24 Phase C: session-level diagnostic aggregation over captured dialogue
 * and reaction episodes. Read-only — no new metacognition; strategy audit and
 * contradiction detection consume existing signals only. Below the minimum
 * viable session, a skeleton retrospective is produced (no strategy audit).
 */
export async function retrospect(
  sessionId: string,
  episodic: EpisodicMemory,
  options: {
    /** Strategy grades by correlationId (existing TraceGradeInput plumbing). */
    traceGrades?: ReadonlyMap<string, number>;
    contradictionTerms?: readonly string[];
    proposals?: readonly unknown[];
    /** Phase B: parameter-ledger changes to enrich the strategy audit with. */
    ledgerEntries?: readonly {
      parameter: string;
      oldValue: number | string;
      newValue: number | string;
      at: number;
      trigger?: string;
    }[];
    minTurns?: number;
    minReactions?: number;
    /** Phase C (REFACTOR.todo2): cross-memory context lookup around the session window. */
    memoryQuery?: import('../query/memory-query.js').MemoryQuery;
  } = {}
): Promise<Retrospective> {
  // Phase D (REFACTOR.todo1): indexed path — O(matches) via the sessionId
  // metadata index instead of O(all episodes).
  const episodes = await episodic.getEpisodes({ type: 'dialogue', sessionId, limit: 10_000 });
  const turns = episodes
    .map(parseTurn)
    .filter((t): t is SessionTurn => t !== undefined && t.sessionId === sessionId)
    .sort((a, b) => a.seq - b.seq);

  const reactionEpisodes = await episodic.getEpisodes({
    type: 'reaction',
    sessionId,
    limit: 10_000,
  });
  const reactions = reactionEpisodes
    .map(parseReaction)
    .filter(
      (r): r is SessionReaction => r !== undefined && turns.some((t) => t.turnId === r.turnId)
    );

  const reactionDistribution = emptyReactionDistribution();
  for (const r of reactions) reactionDistribution[r.kind]!++;

  // Phase A (REFACTOR.todo2): causal-chain summary from the `causes` edges
  // TODO1 Phase D writes on reaction episodes — upstream-first, chronological.
  const causalChains: CausalChainEdge[] = reactions
    .slice()
    .sort((a, b) => a.at - b.at)
    .flatMap((r) =>
      (r.causes ?? []).map((from) => ({ from, to: r.id ?? '', kind: r.kind, at: r.at }))
    )
    .filter((e) => e.to !== '');

  const corrections: CorrectionAnalysis[] = [];
  for (const t of turns) {
    const r = reactions.find((r) => r.turnId === t.turnId && r.kind === 'correct');
    if (!r) continue;
    corrections.push({
      turnId: t.turnId,
      originalDigest: t.responseDigest ?? '',
      ...(r.correctionDigest ? { correctionDigest: r.correctionDigest } : {}),
      reaction: r,
    });
  }

  const minTurns = options.minTurns ?? MIN_TURNS;
  const minReactions = options.minReactions ?? MIN_REACTIONS;
  const full = turns.length >= minTurns && reactions.length >= minReactions;

  // Phase C (REFACTOR.todo2): richer session context — ranked cross-memory
  // results around the session window (semantic activations of the period).
  let sessionContext: string[] | undefined;
  if (options.memoryQuery && episodes.length > 0) {
    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;
    for (const e of episodes) {
      if (e.timestamp < start) start = e.timestamp;
      if (e.timestamp > end) end = e.timestamp;
    }
    const results = await options.memoryQuery
      .search({ timeRange: [start, end], limit: 5 })
      .catch(() => []);
    sessionContext = results.map((r) =>
      r.source === 'episode' ? `episode:${r.episode?.id ?? ''}` : `concept:${r.concept?.term.toString() ?? ''}`
    );
  }

  // Strategy audit (I7 payoff): join turn session ↔ grades by correlationId.
  const strategyAudit = full
    ? [
        {
          strategy: 'dialogue',
          gradedTurns: turns.length,
          meanQuality:
            turns.reduce(
              (acc, t) => acc + (options.traceGrades?.get(t.turnId.split(':')[0]!) ?? 0),
              0
            ) / Math.max(turns.length, 1),
          // Phase B: enrich with ledger changes inside the session window
          // (which parameter/strategy writes preceded quality shifts).
          ...(options.ledgerEntries?.length
            ? { parameterChanges: options.ledgerEntries.slice() }
            : {}),
        },
      ]
    : [];
  const retrospective: Retrospective = {
    version: 'retrospective-v1',
    sessionId,
    at: Date.now(),
    turnCount: turns.length,
    reactionCount: reactions.length,
    reactionDistribution,
    corrections,
    contradictions: full ? [...(options.contradictionTerms ?? [])] : [],
    strategyAudit,
    proposals: options.proposals ?? [],
    ...(causalChains.length > 0 ? { causalChains } : {}),
    ...(sessionContext && sessionContext.length > 0 ? { sessionContext } : {}),
    provenance: { turnIds: turns.map((t) => t.turnId) },
    digest: '',
  };
  retrospective.digest = digestPin(retrospective.provenance.turnIds, reactionDistribution);
  return retrospective;
}

/** Digest-pinned JSONL persistence; load is fail-closed (cf. FrozenEvalSet). */
export async function persistRetrospective(
  r: Retrospective,
  dir = RETROSPECTIVE_DIR
): Promise<void> {
  const ledger = getRetrospectiveLedger(dir);
  ledger.append(r as RetrospectiveLedgerEntry);
}

export async function loadRetrospectives(
  n = 10,
  dir = RETROSPECTIVE_DIR
): Promise<Retrospective[]> {
  const ledger = getRetrospectiveLedger(dir);
  const entries = await ledger.query({ limit: n });
  const out: Retrospective[] = [];
  // Take the newest n entries (first n since query returns newest first)
  for (const entry of entries.slice(0, n)) {
    const r = entry as unknown as Retrospective;
    const expected = digestPin(r.provenance.turnIds, r.reactionDistribution);
    if (r.digest !== expected) throw new DigestMismatchError(expected, `corrupt: ${r.sessionId}`);
    out.push(r);
  }
  return out;
}

/**
 * Lesson extraction (DQ4): a lesson requires ≥2 supporting turns, a
 * non-trivial term, and confidence above the seed-truth admission floor.
 */
export function extractLessons(
  r: Retrospective,
  seed: { term: string; truth: { frequency: number; confidence: number } }
): Lesson[] {
  const supporting = r.reactionDistribution['accept'] ?? 0;
  if (supporting < 2 || !seed.term.trim() || seed.truth.confidence < LESSON_CONFIDENCE_FLOOR)
    return [];
  return [
    {
      term: seed.term,
      truth: seed.truth,
      source: 'retrospect',
      provenance: { turnIds: r.provenance.turnIds },
    },
  ];
}
