/** Dialogue Flywheel commands (`.react`, `.turns`, `.retrospect*`, `.probes`, …). */

import { OutcomeLinker } from '@senars/nar/config';
import { episodeQualitySurface } from '@senars/nar/query';
import { errMsg, finiteOr, makeId, takeLast, unique } from '@senars/util';
import { cmd } from '../../cli/commands.js';
import { tokenize } from './args.js';
import { type BotRuntime, systemOneOf } from './context.js';

const REACTIONS = ['accept', 'correct', 'reject', 'clarify', 'redirect', 'abandon'] as const;
const REACTION_SET: ReadonlySet<string> = new Set(REACTIONS);

const REACTION_USAGE = `.react ${REACTIONS.join('|')} [correction]`;
/** Reactions that count as a negative verification signal for the user channel. */
const isCorrection = (kind: string): boolean =>
  kind === 'reject' || kind === 'correct' || kind === 'abandon';

/**
 * Aggregate one session's turns, mine contradiction terms, and persist a
 * `Retrospective`. Emits a low-risk focus-weight proposal when corrections
 * dominate — payload only, never auto-applied (governance is the consumer's).
 */
export const runSessionRetrospective = async (
  rt: BotRuntime,
  sessionId: string
): Promise<string> => {
  const { wired, strategyAdapter, memoryQuery } = rt;
  const { parameterLedger } = rt;
  if (!parameterLedger) return 'Parameter ledger not attached.';
  const { mineHardNegatives } = await import('@senars/nar/lm/system-one/hard-negatives.js');
  const miningBag = wired.nar.getMiningBag?.();
  const negatives = await mineHardNegatives(wired.nar, wired.episodicMemory, {
    limit: 16,
    ...(miningBag ? { into: miningBag } : {}),
  }).catch(() => []);
  const contradictionTerms = negatives
    .filter((n) => n.source === 'contradiction')
    .map((n) => n.text);
  const reactionEpisodes = await wired.episodicMemory.getEpisodes({ type: 'reaction', limit: 500 });
  const sessionReactions = reactionEpisodes.filter(
    (e) => (e.metadata as { sessionId?: string }).sessionId === sessionId
  );
  const corrections = sessionReactions.filter(
    (e) => (e.metadata as { kind?: string }).kind === 'correct'
  ).length;
  const correctionDominates =
    sessionReactions.length >= 2 && corrections * 2 >= sessionReactions.length;
  const proposal = {
    proposalId: makeId(),
    kind: 'focus-weight' as const,
    riskTier: 'low' as const,
    payload: { focusId: 'conversation', weight: 0.8 },
    rewardDomain: 'external-reflex' as const,
    correlationId: sessionId,
  };
  const { retrospect, persistRetrospective } = await import('@senars/nar/dialogue');
  const r = await retrospect(sessionId, wired.episodicMemory, {
    // Turn ids share the correlationId the kernel minted, so the join is exact.
    traceGrades: systemOneOf(rt)?.traceGradeHistory,
    ledgerEntries: parameterLedger
      .query()
      .filter(
        (entry) =>
          sessionReactions.length === 0 ||
          entry.at >= Math.min(...sessionReactions.map((e) => e.timestamp))
      ),
    memoryQuery,
    contradictionTerms,
    proposals: correctionDominates ? [proposal] : [],
  });
  await persistRetrospective(r);
  const controller = wired.nar.getController?.();
  const adapted = controller && strategyAdapter ? strategyAdapter.adaptFromRetrospective(r) : false;
  return (
    `Retrospective ${r.sessionId}: turns=${r.turnCount} reactions=${r.reactionCount} ` +
    `corrections=${r.corrections.length} proposals=${r.proposals.length} ` +
    `adapted=${adapted ? 'derivation→focused,lm-rule→priority' : 'no'} digest=${r.digest.slice(0, 19)}`
  );
};

export const dialogueCommandsFor = (rt: BotRuntime) => [
  cmd('react', `Bind a reaction to the last turn: ${REACTION_USAGE}`, async (args = '') => {
    const [kind, ...rest] = tokenize(args);
    const turn = rt.dialogue.latestTurn();
    if (!turn) return 'No captured turn to react to (capture disabled or no exchange yet).';
    if (!kind || !REACTION_SET.has(kind)) return `Usage: ${REACTION_USAGE}`;
    const correction = kind === 'correct' ? rest.join(' ') : undefined;
    if (kind === 'correct' && !correction) return 'Usage: .react correct <correction text>';
    try {
      await rt.dialogue.bindReaction(turn.turnId, kind as never, correction);
      // Reactions are verification signals for the user channel: trust-not-truth.
      rt.wired.nar
        .getSourceReputation?.()
        ?.record('user', isCorrection(kind) ? 'contradicted' : 'confirmed');
      return `Reaction ${kind} bound to ${turn.turnId}${kind === 'correct' ? ' (embedded + labeled, text discarded)' : ''}`;
    } catch (e) {
      return `react failed: ${errMsg(e)}`;
    }
  }),
  cmd('turns', 'Show captured dialogue turns: [session-id] [n]', async (args = '') => {
    const [sid, nRaw] = tokenize(args);
    const limit = finiteOr(nRaw, 10);
    const episodes = await rt.wired.episodicMemory.getEpisodes({ type: 'dialogue', limit: 500 });
    const sessionIds = new Set(
      episodes.map((e) => (e.metadata as { sessionId?: string }).sessionId)
    );
    const target = sid ?? unique(sessionIds).at(-1);
    const rows = episodes
      .filter((e) => (e.metadata as { sessionId?: string }).sessionId === target)
      .slice(-limit);
    if (rows.length === 0) {
      return target ? `No turns for session ${target}` : 'No captured turns.';
    }
    return rows
      .map((e) => {
        const d = JSON.parse(e.content) as {
          turnId: string;
          seq: number;
          grounding?: { score: number };
          responseDigest?: string;
        };
        const ground = d.grounding ? ` ground=${d.grounding.score.toFixed(2)}` : '';
        return `  ${d.turnId} seq=${d.seq}${ground} resp=${d.responseDigest?.slice(0, 19) ?? '—'}`;
      })
      .join('\n');
  }),
  cmd('parameters', 'Show the parameter change ledger: [improved]', async (args = '') => {
    const { memoryQuery, wired } = rt;
    const { parameterLedger } = rt;
    if (!parameterLedger) return 'Parameter ledger not attached.';
    if (args.trim() === 'improved') {
      const [turnResults, reactions] = await Promise.all([
        memoryQuery.search({ episodeType: 'dialogue', limit: 500 }).catch(() => []),
        wired.episodicMemory.getEpisodes({ type: 'reaction', limit: 500 }),
      ]);
      const samples = episodeQualitySurface([
        ...turnResults.flatMap((r) => (r.episode ? [r.episode] : [])),
        ...reactions,
      ]);
      const improved = await new OutcomeLinker(parameterLedger, () => samples).improvedOnly({
        windowMs: 120_000,
      });
      if (improved.length === 0) return 'No improvement-evidenced parameter changes.';
      return improved
        .map(
          (i) =>
            `  ${i.parameter} ${i.oldValue}→${i.newValue} quality ${i.before.toFixed(2)}→${i.after.toFixed(2)}`
        )
        .join('\n');
    }
    const records = parameterLedger.query().slice(-20);
    if (records.length === 0) return 'No parameter changes recorded.';
    return records
      .map(
        (r) =>
          `  [${new Date(r.at).toLocaleTimeString()}] ${r.writer}/${r.scope} ${r.parameter} ${r.oldValue}→${r.newValue}${r.trigger ? ` (${r.trigger.slice(0, 12)})` : ''}`
      )
      .join('\n');
  }),
  cmd('retrospect', 'Run a retrospective: [session-id]', async (args = '') => {
    const explicit = args.trim();
    const sid =
      explicit ||
      unique(
        (await rt.wired.episodicMemory.getEpisodes({ type: 'dialogue', limit: 500 })).map(
          (e) => (e.metadata as { sessionId?: string }).sessionId
        )
      ).at(-1);
    if (!sid) return 'No captured sessions.';
    return runSessionRetrospective(rt, sid);
  }),
  cmd('retrospectives', 'List past retrospectives: [n]', async (args = '') => {
    const { loadRetrospectives } = await import('@senars/nar/dialogue');
    const limit = finiteOr(args.trim(), 10);
    const rs = await loadRetrospectives(limit);
    if (rs.length === 0) return 'No retrospectives.';
    return rs
      .map(
        (r) =>
          `  ${r.sessionId} turns=${r.turnCount} reactions=${r.reactionCount} digest=${r.digest.slice(0, 19)}`
      )
      .join('\n');
  }),
  cmd(
    'lessons',
    'Show lessons extracted from retrospectives + formalized corrections',
    async () => {
      const { extractLessons, loadRetrospectives } = await import('@senars/nar/dialogue');
      const retrospectLessons = (await loadRetrospectives(50)).flatMap((r) =>
        extractLessons(r, {
          term: 'dialogue_performance',
          truth: { frequency: 0.9, confidence: 0.6 },
        })
      );
      // Lessons from formalized corrections join the same ingestion path.
      const lessons = [...rt.dialogue.lessons, ...retrospectLessons];
      if (lessons.length === 0) {
        return 'No lessons (require ≥2 supporting turns per retrospective, or formalized corrections).';
      }
      // Ingest as Narsese self-beliefs (seeded truth, no LM) so they answer `.ask`.
      await Promise.all(
        lessons.map((l) =>
          rt.wired.nar
            .input(`<${l.term}>.`, 'belief', {
              f: l.truth.frequency,
              c: l.truth.confidence,
            } as never)
            .catch(() => undefined)
        )
      );
      return lessons
        .map(
          (l) =>
            `  ${l.term} f=${l.truth.frequency} c=${l.truth.confidence} turns=${l.provenance.turnIds.length}`
        )
        .join('\n');
    }
  ),
  cmd(
    'reconsolidate',
    'Ingest retrospective lessons as self-beliefs (one-shot per digest, survives restarts)',
    async () => {
      const { Reconsolidator, loadRetrospectives } = await import('@senars/nar/dialogue');
      const reconsolidator = new Reconsolidator(
        { load: (n: number) => loadRetrospectives(n) },
        {
          input: (term, frequency, confidence) =>
            rt.wired.nar
              .input(`<${term}>.`, 'belief', { f: frequency, c: confidence } as never)
              .then(() => {}),
        },
        { term: 'dialogue_performance', truth: { frequency: 0.9, confidence: 0.6 } }
      );
      const { ingested, skipped } = await reconsolidator.reconsolidate(50).catch((e: unknown) => {
        throw new Error(`Reconsolidation failed (fail-closed): ${errMsg(e)}`);
      });
      return `Reconsolidated: ingested=${ingested} already-done=${skipped}`;
    }
  ),
  cmd(
    'probes',
    'Show curriculum probes selected from flywheel-graded data (corrections + low grades)',
    async () => {
      const { selectProbes } = await import('@senars/nar/dialogue');
      const probes = await selectProbes(
        {
          reactions: () => rt.wired.episodicMemory.getEpisodes({ type: 'reaction', limit: 1000 }),
          grades: () => systemOneOf(rt)?.traceGradeHistory ?? new Map<string, number>(),
        },
        // The curriculum trains on the least-reliable sources first.
        {
          sourceReputation: {
            multiplier: (key) => rt.wired.nar.getSourceReputation?.()?.multiplier(key) ?? 1,
          },
        }
      );
      if (probes.length === 0) return 'No probes yet (requires corrected or low-graded turns).';
      return probes.map((p) => `  ${p.kind} ${p.id} score=${p.score.toFixed(2)}`).join('\n');
    }
  ),
  cmd(
    'adaptations',
    'Show retrospective-driven strategy adaptations: [.restore]',
    async (args = '') => {
      const { strategyAdapter } = rt;
      if (!strategyAdapter) return 'Strategy adaptation unavailable (no kernel controller).';
      if (args.trim() === 'restore') {
        return strategyAdapter.restore()
          ? 'Restored pre-adaptation strategies.'
          : 'Nothing to restore.';
      }
      const ledger = strategyAdapter.ledger;
      if (ledger.length === 0) {
        return 'No adaptations yet (correction-dominated retrospectives drive them).';
      }
      return ledger
        .map(
          (a) =>
            `  ${a.at ? new Date(a.at).toISOString() : ''} ${a.retrospectiveDigest.slice(0, 19)} ${Object.entries(
              a.to
            )
              .map(([k, v]) => `${k}→${v}`)
              .join(', ')}`
        )
        .join('\n');
    }
  ),
  cmd('schemas-induce', 'Induce schemas from captured derivation chains (LM-backed)', async () => {
    const { nar, lmService } = rt.wired;
    const chains = nar.getDerivationChains(64);
    if (chains.length === 0) {
      return 'No derivation chains captured yet (chains accrue as the kernel reasons).';
    }
    const inductor =
      nar.getSchemaInductor() ??
      new (await import('@senars/nar/learning')).SchemaInductor(nar.memory, lmService, {
        inductionIntervalMs: 0,
      });
    for (const chain of chains) inductor.onDerivation(chain as never);
    const results = await inductor.induceNow({ budget: 8 }).catch((e: unknown) => {
      throw new Error(`Schema induction failed: ${errMsg(e)}`);
    });
    if (results.length === 0) {
      return `No schemas induced from ${chains.length} chains (below confidence/steps bar).`;
    }
    return results
      .map(
        (r) =>
          `  ${r.schema.template} conf=${r.confidence.toFixed(2)} instances=${r.instances.length}`
      )
      .join('\n');
  }),
];
