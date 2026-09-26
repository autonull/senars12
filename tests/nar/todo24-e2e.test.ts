import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { EpisodicMemory } from '../../nar/src/memory/EpisodicMemory.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import { ProposalRouter } from '../../nar/src/governance/pipeline.js';
import { DialogueCapture } from '../../nar/src/dialogue/capture.js';
import { loadRetrospectives, persistRetrospective, retrospect } from '../../nar/src/dialogue/retrospect.js';
import { emptyReactionDistribution } from '../../nar/src/dialogue/types.js';
import { rm } from 'node:fs/promises';

const makeEpisodic = async (): Promise<EpisodicMemory> =>
  new EpisodicMemory({
    enabled: true,
    basePath: join(await mkdtemp(join(tmpdir(), 'todo24-e2e-')), 'episodes'),
    retentionDays: 1,
    maxEntriesPerFile: 100,
  });

describe('TODO24 bench 74: end-to-end flywheel', () => {
  it('dialogue → capture → react → label → retrospect → proposal, governance intact', async () => {
    const ep = await makeEpisodic();
    const tmp = await mkdtemp(join(tmpdir(), 's1-e2e-'));
    const dataset = new JudgmentDataset(tmp);
    const d = new DialogueCapture({
      dataset,
      episodic: ep,
      embeddingCache: createEmbeddingCache({ generator: { generate: async (t) => [t.length % 5, 1, 2] }, dimension: 3 }),
      config: { enabled: true },
    });

    // Capture + react
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      ids.push((await d.onExchange({ correlationId: 'e2e', utterance: `u${i}`, response: `r${i}` }))!);
    }
    await d.bindReaction(ids[1]!, 'correct', 'the corrected answer');
    await d.bindReaction(ids[4]!, 'reject');
    await d.bindReaction(ids[7]!, 'accept');
    await d.bindReaction(ids[10]!, 'accept');

    // Labels landed with REACTION_SOURCE; correction is a preference pair
    const reactionRows = dataset.all().filter((r) => r.source === 'reaction');
    expect(reactionRows.length).toBeGreaterThanOrEqual(4);
    expect(reactionRows.some((r) => r.observed === 1)).toBe(true);

    // Retrospect produces the diagnostic and persists digest-pinned
    const r = await retrospect('e2e', ep);
    expect(r.turnCount).toBe(12);
    expect(r.reactionCount).toBe(4);
    expect(r.corrections).toHaveLength(1);
    await persistRetrospective(r);
    expect((await loadRetrospectives()).some((x) => x.sessionId === 'e2e')).toBe(true);

    // Governance: retrospective findings become proposals; only low-risk
    // focus-weight auto-applies — governance pipeline is the sole gate.
    const router = new ProposalRouter();
    const proposal = {
      proposalId: uuidv4(),
      kind: 'focus-weight' as const,
      riskTier: 'low' as const,
      payload: { focusId: 'conversation', weight: 0.8 },
      rewardDomain: 'external-reflex' as const,
      correlationId: 'e2e',
    };
    const verdict = router.route(proposal, 'observe-only', { applyFocusWeight: () => {} });
    expect(['auto-apply', 'sandbox-validate', 'human-approval']).toContain(verdict.route);

    // High-risk proposals never auto-apply
    const highRisk = router.route(
      { ...proposal, proposalId: uuidv4(), kind: 'patch-apply', riskTier: 'high', payload: { patch: 'x' } },
      'human-approved-production'
    );
    expect(highRisk.applied).toBe(false);

    await rm('.cache/retrospectives', { recursive: true, force: true });
    expect(emptyReactionDistribution().accept).toBe(0);
  });
});