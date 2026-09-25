import { type MinedNegative, MiningBag } from '@senars/nar/lm/system-one/hard-negatives.js';
import { ProposalBag } from '@senars/nar/meta/proposal-bag.js';
import type { SelfImprovementProposal } from '@senars/kernel/schemas';
import { describe, expect, it } from 'vitest';

const proposal = (
  id: string,
  kind: SelfImprovementProposal['kind'],
  riskTier: SelfImprovementProposal['riskTier'] = 'low',
  payload: Record<string, unknown> = {}
): SelfImprovementProposal => ({
  proposalId: id,
  kind,
  riskTier,
  payload,
  rewardDomain: 'self-scheduler',
});

const negative = (
  text: string,
  rubric: MinedNegative['rubric'],
  margin?: number
): MinedNegative => ({ rubric, text, source: 'contradiction', ...(margin !== undefined ? { margin } : {}) });

describe('Bench 89 — ProposalBag (AIKR pattern #4)', () => {
  it('highest-leverage proposal drains first (impact × risk-inverse)', async () => {
    const routed: string[] = [];
    const bag = new ProposalBag({ capacity: 20 });
    bag.admit(proposal('weak', 'test-generate', 'high')); // 0.4 × 0.2 = 0.08
    bag.admit(proposal('mid', 'knob-tune', 'low', { knob: 'taskDecayRate' })); // 0.6
    bag.admit(proposal('strong', 'strategy-switch', 'low', { strategy: 'focused' })); // 0.9
    for (let i = 0; i < 14; i++) bag.admit(proposal(`filler-${i}`, 'focus-weight', 'low', { focusId: `f${i}` }));
    const out = await bag.drainIfPressured((p) => routed.push(p.proposalId), { budget: 3 });
    expect(out.map((p) => p.proposalId)).toEqual(['strong', 'mid', 'filler-0']);
    expect(routed).toEqual(['strong', 'mid', 'filler-0']);
    expect(bag.size).toBe(14); // drained items leave the bag
  });

  it('superseded proposals decay out (same kind + scope)', async () => {
    const bag = new ProposalBag({ capacity: 8 });
    bag.admit(proposal('old', 'knob-tune', 'low', { knob: 'taskDecayRate' }));
    bag.admit(proposal('other', 'knob-tune', 'low', { knob: 'conceptDecayRate' }));
    bag.admit(proposal('newer', 'knob-tune', 'low', { knob: 'taskDecayRate' })); // supersedes 'old'
    const priorities = (bag as unknown as { '#bag': { all(): Iterable<{ id: string; priority: number }> } });
    void priorities; // structurally asserted below via drain order instead
    // Halved elder (0.6 → 0.3) ranks below the untouched sibling (0.6).
    const out = await bag.drain((p) => p, { budget: 3 });
    expect(out.map((p) => p.proposalId)).toEqual(['newer', 'other', 'old']);
  });

  it('inert-by-default: below threshold nothing drains; capacity + decay forget', async () => {
    const routed: string[] = [];
    const bag = new ProposalBag({ capacity: 4 });
    bag.admit(proposal('a', 'knob-tune', 'low', { knob: 'x' }));
    expect(bag.pressure).toBeLessThan(0.4);
    await expect(bag.drainIfPressured((p) => routed.push(p.proposalId))).resolves.toEqual([]);
    expect(routed).toEqual([]);

    // Capacity eviction: lowest priority (high-risk) evicted.
    const tight = new ProposalBag({ capacity: 2 });
    tight.admit(proposal('low-risk', 'knob-tune', 'low', { knob: 'x' }));
    tight.admit(proposal('high-risk', 'patch-apply', 'high'));
    tight.admit(proposal('next', 'knob-tune', 'low', { knob: 'y' }));
    expect(tight.peek().map((p) => p.proposalId).sort()).toEqual(['low-risk', 'next']);

    // Decay forgets stale accumulation.
    const decayer = new ProposalBag({ capacity: 4, forgetRate: 0.3 });
    decayer.admit(proposal('stale', 'test-generate', 'high'));
    decayer.decay(0.5);
    expect(decayer.size).toBe(0);
  });

  it('determinism: same admissions drain identically', async () => {
    const run = async (): Promise<string[]> => {
      const bag = new ProposalBag({ capacity: 16 });
      for (const [id, kind] of [
        ['p1', 'knob-tune'],
        ['p2', 'strategy-switch'],
        ['p3', 'focus-weight'],
        ['p4', 'schema-promotion'],
      ] as const)
        bag.admit(proposal(id, kind, 'low', kind === 'knob-tune' ? { knob: 'k' } : { strategy: 's' }));
      const out = await bag.drain(() => undefined, { budget: 4 });
      return out.map((p) => p.proposalId);
    };
    expect(await run()).toEqual(await run());
  });

  it('drive-alignment multiplier reorders equal-impact proposals', async () => {
    const bag = new ProposalBag({
      capacity: 8,
      alignmentOf: (p) => (p.payload['drive'] === 'competence' ? 1.5 : 1),
    });
    bag.admit(proposal('plain', 'knob-tune', 'low', { knob: 'x' })); // 0.6
    bag.admit(proposal('aligned', 'knob-tune', 'low', { knob: 'x', drive: 'competence' })); // 0.9
    const out = await bag.drain((p) => p, { budget: 2 });
    expect(out.map((p) => p.proposalId)).toEqual(['aligned', 'plain']);
  });
});

describe('Bench 89 — MiningBag (AIKR pattern #5)', () => {
  it('skips low-margin candidates under budget', async () => {
    const bag = new MiningBag({ capacity: 8, marginFloor: 0.4 });
    bag.admit(negative('no-margin-a', 'conflict'));
    bag.admit(negative('low-margin', 'conflict', 0.2));
    bag.admit(negative('high-margin', 'conflict', 0.9));
    const out = await bag.drain({ budget: 8 });
    expect(out.map((n) => n.text)).toEqual(['high-margin', 'no-margin-a']);
  });

  it('pressure gate + capacity/decay + determinism', async () => {
    const bag = new MiningBag({ capacity: 4 });
    bag.admit(negative('only', 'conflict', 0.9));
    expect(bag.pressure).toBeLessThan(0.5);
    await expect(bag.drainIfPressured()).resolves.toEqual([]);

    const decayer = new MiningBag({ capacity: 4, forgetRate: 0.3 });
    decayer.admit(negative('stale', 'groundedness', 0.4));
    decayer.decay(0.5); // 0.4 × 0.8 × 0.5 = 0.16 < 0.3 → forgotten
    expect(decayer.size).toBe(0);

    const run = async (): Promise<string[]> => {
      const b = new MiningBag({ capacity: 8 });
      b.admit(negative('t1', 'conflict', 0.9));
      b.admit(negative('t2', 'groundedness', 0.7));
      const out = await b.drain({ budget: 2 });
      return out.map((n) => n.text);
    };
    expect(await run()).toEqual(await run());
  });

  it('mineHardNegatives `into` accumulates into the bag (contradictions + errors)', async () => {
    const { mineHardNegatives } = await import('@senars/nar/lm/system-one/hard-negatives.js');
    // Structural stand-ins per the todo22 mining-test convention.
    const nar = {
      getBeliefs: () => [
        { term: { toString: () => 'robin --> fly' }, truth: { f: 0.9 } },
        { term: { toString: () => 'robin --> fly' }, truth: { f: 0.1 } },
      ],
    } as never;
    const episodic = {
      getEpisodes: async ({ type }: { type?: string }) =>
        type === 'error'
          ? [{ timestamp: 1, type: 'error', content: 'tool deploy failed', metadata: {} }]
          : [],
    } as never;
    const bag = new MiningBag({ capacity: 8 });
    const mined = await mineHardNegatives(nar, episodic, { limit: 8, into: bag });
    expect(mined).toHaveLength(2);
    expect(bag.size).toBe(2);
    expect(bag.peek().map((n) => n.rubric).sort()).toEqual(['conflict', 'groundedness']);
    // Contradiction (rubric relevance 1.0) outranks the error episode (0.8).
    const drained = await bag.drain({ budget: 2 });
    expect(drained.map((n) => n.rubric)).toEqual(['conflict', 'groundedness']);
  });

  it('NAR: mining bag absent by default; opt-in creates it and the hook drains + seeds', async () => {
    const { NAR } = await import('@senars/nar');
    const plain = new NAR({ enableLMRules: false } as never);
    expect(plain.getMiningBag()).toBeUndefined();

    const nar = new NAR({
      enableLMRules: false,
      hardNegativeMining: { bounded: true, capacity: 4, budget: 4 },
    } as never);
    const bag = nar.getMiningBag();
    expect(bag).toBeDefined();
    bag!.admit(negative('seed-1', 'conflict', 0.9));
    bag!.admit(negative('seed-2', 'conflict', 0.8));
    bag!.admit(negative('seed-3', 'conflict', 0.7));
    bag!.admit(negative('seed-4', 'conflict', 0.6));
    // Hook drains under pressure; without System One there is no contrastive
    // sink — drain must still consume (results dropped, never crash).
    await expect(nar.consolidateLearning({ budget: 4 })).resolves.toBeUndefined();
    expect(bag!.size).toBe(0);
  });
});
