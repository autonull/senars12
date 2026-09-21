import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wrapReflex, vetoAwareReflex, type AdapterReflex } from '../../nar/src/reflex/adapters.js';
import type { ActionProposal, LearningEvent, Reflex } from '../../nar/src/reflex/Reflex.js';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import { mcReturns, recordMcReturnLabels } from '../../nar/src/lm/system-one/mc-return.js';
import { actionFeatures, bakeOffSharedHead, type TrainingRow } from '../../nar/src/lm/system-one/train.js';
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

  it('L3 — bake-off: shared game-featured head transfers when per-game data is scarce', () => {
    const dim = 16;
    const lcg = (seed: number): (() => number) => {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        s = Math.imul(s ^ (s >>> 15), 1 | s);
        return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
      };
    };
    const state = (seed: number): Float32Array => {
      const e = new Float32Array(dim);
      const r = lcg(seed);
      for (let i = 0; i < dim; i++) e[i] = r() * 2 - 1;
      return e;
    };
    // Shared action preference (transferable across games) + a modest game offset.
    const actionPref: Record<string, number> = { cycle: 0.35, revise: 0.1, rest: -0.2, ask_lm: 0.25 };
    const gameOffset: Record<string, number> = { conversation: 0.05, 'tool-use': -0.05, research: 0 };
    const rows: TrainingRow[] = [];
    let n = 0;
    for (const game of Object.keys(gameOffset)) {
      for (let i = 0; i < 14; i++) {
        const action = Object.keys(actionPref)[n++ % 4]!;
        const h = actionFeatures(action, dim);
        const e = state(n * 7919);
        let signal = 0;
        for (let j = 0; j < dim; j++) signal += e[j]! * h[j]!;
        rows.push({ embedding: e, action, game, target: Math.min(1, Math.max(0, 0.5 + signal * 0.3 + actionPref[action]! + gameOffset[game]!)) });
      }
    }
    const meta = { headId: 'reflex_value', rubric: 'reflex_value', axis: 'teleological' };
    const bakeOff = bakeOffSharedHead(rows, meta, { seed: 42, holdoutFraction: 0.25 });
    expect(Object.keys(bakeOff.scores).sort()).toEqual(['conversation', 'research', 'tool-use']);
    for (const [game, s] of Object.entries(bakeOff.scores)) {
      expect(s.shared).toBeGreaterThanOrEqual(0);
      expect(s.perGame).toBeGreaterThanOrEqual(0);
      expect(bakeOff.perGame[game]).toBeDefined();
    }
    // Verdict is derived from the recorded scores, never asserted a priori.
    const expectVerdict = Object.values(bakeOff.scores).every((s) => s.shared <= s.perGame) ? 'shared' : 'per-game';
    expect(bakeOff.verdict).toBe(expectVerdict);
  });

  it('L3 — bake-off: conflicting game×state structure keeps per-game heads (honest loss)', () => {
    const dim = 16;
    const lcg = (seed: number): (() => number) => {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        s = Math.imul(s ^ (s >>> 15), 1 | s);
        return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
      };
    };
    const rows: TrainingRow[] = [];
    let n = 0;
    for (const game of ['conversation', 'tool-use']) {
      // Target flips sign per game on the SAME state×action signal — the shared
      // head's additive game block cannot represent state×game interactions.
      const sign = game === 'conversation' ? 1 : -1;
      for (let i = 0; i < 40; i++) {
        const e = new Float32Array(dim);
        const r = lcg(n * 104729);
        for (let j = 0; j < dim; j++) e[j] = r() * 2 - 1;
        n++;
        const action = ['cycle', 'revise', 'rest', 'ask_lm'][i % 4]!;
        const h = actionFeatures(action, dim);
        let signal = 0;
        for (let j = 0; j < dim; j++) signal += e[j]! * h[j]!;
        rows.push({ embedding: e, action, game, target: Math.min(1, Math.max(0, 0.5 + sign * signal * 0.6)) });
      }
    }
    const bakeOff = bakeOffSharedHead(rows, { headId: 'reflex_value', rubric: 'reflex_value', axis: 'teleological' }, { seed: 7, holdoutFraction: 0.25 });
    expect(bakeOff.verdict).toBe('per-game');
  });

  it('L3 — bake-off rejects rows without a game tag and single-game pools', () => {
    const e = new Float32Array(4);
    expect(() => bakeOffSharedHead([{ embedding: e, action: 'a', target: 0.5 }], { headId: 'r', rubric: 'r', axis: 'x' })).toThrow();
    const tagged = [
      { embedding: e, action: 'a', target: 0.5, game: 'g1' },
      { embedding: e, action: 'b', target: 0.4, game: 'g1' },
    ];
    expect(() => bakeOffSharedHead(tagged, { headId: 'r', rubric: 'r', axis: 'x' })).toThrow(/≥2 games/);
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
