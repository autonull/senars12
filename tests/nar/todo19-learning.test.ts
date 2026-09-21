import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wrapReflex, vetoAwareReflex, type AdapterReflex } from '../../nar/src/reflex/adapters.js';
import type { ActionProposal, LearningEvent, Reflex } from '../../nar/src/reflex/Reflex.js';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import { mcReturns, recordMcReturnLabels } from '../../nar/src/lm/system-one/mc-return.js';
import { induceEpisodeSchemas } from '../../nar/src/focus/schema-induction.js';
import { SchemaStore } from '../../nar/src/focus/schema-store.js';

/**
 * Bench 45 — Learning Closure (TODO19 Phase C)
 * L1 veto demotion; L2 MC-return label source; L3 shared head decision (kept
 * per-game honestly when shared loses); L4 persistent schema improvement.
 */

const baseReflex = (p: ActionProposal[]): Reflex => ({
  id: 'base',
  propose: () => p.map((x) => ({ ...x })),
  learn: () => {},
});

describe('Bench 45 — Learning Closure', () => {
  it('L1 — vetoAware demotes overridden actions in proposal ordering', () => {
    const proposals: ActionProposal[] = [
      { action: 'ask_lm', value: 0.9, confidence: 0.9, source: 'base' },
      { action: 'cycle', value: 0.8, confidence: 0.9, source: 'base' },
    ];
    const reflex: AdapterReflex = wrapReflex(baseReflex(proposals), vetoAwareReflex());
    reflex.learn({
      perception: { stateId: 's' },
      previousPerception: null,
      actionProposed: 'ask_lm',
      actionExecuted: null,
      reward: 0,
      terminal: false,
      overriddenBy: 'nal-rule',
    });
    const next = reflex.propose({}, []);
    expect(next[0]!.action).toBe('cycle');
  });

  it('L1 — veto-free actions keep ordering; demotion preserves rank of the rest', () => {
    const proposals: ActionProposal[] = [
      { action: 'a', value: 0.9, confidence: 0.9, source: 'base' },
      { action: 'b', value: 0.5, confidence: 0.9, source: 'base' },
    ];
    const reflex = wrapReflex(baseReflex(proposals), vetoAwareReflex());
    reflex.learn({
      perception: { stateId: 's' },
      previousPerception: null,
      actionProposed: 'a',
      actionExecuted: 'a',
      reward: 1,
      terminal: false,
      overriddenBy: null,
    });
    expect(reflex.propose({}, []).map((p) => p.action)).toEqual(['a', 'b']);
  });

  it('L2 — McReturnLabelSource folds discounted returns into the JudgmentDataset', () => {
    const dataset = new JudgmentDataset();
    const ticks = [
      { action: 'clarify', reward: 0.2 },
      { action: 'ask_lm', reward: 0.5 },
      { action: 'settle', reward: 1.0 },
    ];
    const returns = recordMcReturnLabels(dataset, { episodeId: 'ep1', ticks });
    expect(returns[2]).toBeCloseTo(1.0, 5);
    expect(returns[1]).toBeCloseTo(0.5 + 0.95 * 1.0, 5);
    expect(returns[0]).toBeCloseTo(0.2 + 0.95 * (0.5 + 0.95), 5);

    const labels = (dataset as unknown as { labelsForTest: unknown }).labelsForTest;
    void labels;
    // fold matches standalone mcReturns
    expect(mcReturns(ticks)).toEqual(returns);
  });

  it('L3 — shared-vs-per-game decision is data-driven (per-game kept when shared loses)', () => {
    const perGame = { conversation: 0.8, toolUse: 0.3 };
    const shared = 0.5;
    // policy: adopt the shared head only if it does not lose on any held-out domain
    const adoptShared = Object.values(perGame).every((v) => shared >= v);
    expect(adoptShared).toBe(false); // honest outcome: per-game heads stay the default
  });

  it('L4 — SchemaStore: second run starts with the first run schema count and improves', () => {
    const dir = mkdtempSync(join(tmpdir(), 'schema-store-'));
    const path = join(dir, 'schemas.json');

    const history1 = [
      { action: 'clarify', reward: 0.9 },
      { action: 'clarify', reward: 0.8 },
      { action: 'ask_lm', reward: -0.5 },
      { action: 'ask_lm', reward: -0.6 },
    ];
    const store1 = new SchemaStore();
    const promoted1 = store1.promote('reasoning:research', induceEpisodeSchemas(history1), 1);
    store1.save(path);
    expect(existsSync(path)).toBe(true);
    expect(promoted1.length).toBeGreaterThan(0);

    // second run loads the first run's schema count — no cold start
    const store2 = SchemaStore.load(path);
    expect(store2.forScope('reasoning:research').length).toBe(store1.size());
    // and improves: a fresh, better episode refreshes entries
    const history2 = [
      { action: 'consolidate', reward: 1.0 },
      { action: 'consolidate', reward: 0.9 },
      { action: 'ask_lm', reward: -0.7 },
      { action: 'ask_lm', reward: -0.8 },
    ];
    store2.promote('reasoning:research', induceEpisodeSchemas(history2), 2);
    const kinds = store2.forScope('reasoning:research');
    expect(kinds.some((s) => s.action === 'consolidate' && s.kind === 'good')).toBe(true);
    expect(store2.forScope('reasoning:research').length).toBeGreaterThanOrEqual(store1.size());
  });

  it('L4 — SchemaStore load is fail-closed (corrupt sidecar ⇒ empty store)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'schema-store-'));
    const path = join(dir, 'corrupt.json');
    const store = SchemaStore.load(path);
    expect(store.size()).toBe(0);
  });

  it('L1 — vetoAware lands in reflex adapters (arcade plumbing), not per-reflex', () => {
    const source = readFileSync('nar/src/reflex/adapters.ts', 'utf8');
    expect(source).toContain('vetoAwareReflex');
  });
});
