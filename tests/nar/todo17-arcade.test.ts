import { BrierHarness } from '@senars/nar/eval/brier-harness';
import { ConfidenceRouter } from '@senars/nar/lm/system-one/policy';
import { GameFocus } from '@senars/nar/focus';
import { createGridWorldGame, SeededRNG, type Game } from '@senars/nar/game';
import type { ActionProposal, LearningEvent, Reflex } from '@senars/nar/reflex';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { verifyRecord } from '../../scripts/verify-derivation.js';
import {
  isResumable,
  loadSession,
  saveSession,
  type ArcadeSession,
} from '@senars/nar/eval/session-state';

/** Fixed-confidence scripted reflex (review band lands at p=0.5). */
class FixedConfidenceReflex implements Reflex {
  readonly id = 'fixed-confidence';
  learned: LearningEvent[] = [];
  constructor(private readonly confidence: number) {}
  propose(_state: unknown, legalActions: number[]): ActionProposal[] {
    return [
      { action: String(legalActions[0]), value: 0.9, confidence: this.confidence, source: this.id },
    ];
  }
  learn(event: LearningEvent): void {
    this.learned.push(event);
  }
}

const syntheticRecords = (harness: BrierHarness): void => {
  // honest arm: predicted tracks observed (well calibrated)
  const rng = new SeededRNG(11);
  for (let i = 0; i < 300; i++) {
    const observed = rng.next() < 0.5 ? 1 : 0;
    const predicted = Math.max(0.02, Math.min(0.98, observed + (rng.next() - 0.5) * 0.2));
    harness.record({
      arm: 'honest', game: 'snake', stateId: `s${i}`, action: '0',
      predicted, observed, reward: observed, latencyMs: 1, handover: false,
    });
  }
  // shuffled-probability control: predictions decoupled from outcomes
  for (let i = 0; i < 300; i++) {
    const observed = rng.next() < 0.5 ? 1 : 0;
    const predicted = rng.next();
    harness.record({
      arm: 'shuffled', game: 'snake', stateId: `t${i}`, action: '0',
      predicted, observed, reward: observed, latencyMs: 1, handover: false,
    });
  }
  // random control: advantage signal ≈ 0 (predictions unbiased w.r.t. outcomes)
  for (let i = 0; i < 300; i++) {
    const predicted = 0.5 + (rng.next() - 0.5) * 0.1;
    const observed = rng.next() < predicted ? 1 : 0;
    harness.record({
      arm: 'random', game: 'snake', stateId: `r${i}`, action: '0',
      predicted, observed, reward: observed, latencyMs: 1, handover: false,
    });
  }
};

describe('TODO17 Bench 34 — Arcade harness & controls', () => {
  it('records per-tick predictions with observed outcomes; per-arm Brier/ECE computed', () => {
    const harness = new BrierHarness();
    syntheticRecords(harness);
    expect(harness.size).toBe(900);
    expect(harness.brierByArm('honest')).toBeLessThan(0.05);
    expect(harness.eceByArm('honest')).toBeLessThan(0.1);
    expect(harness.returnCurveByArm('honest').length).toBe(300);
  });

  it('control: shuffled-probability arm degrades ECE vs honest arm', () => {
    const harness = new BrierHarness();
    syntheticRecords(harness);
    expect(harness.eceByArm('shuffled')).toBeGreaterThan(harness.eceByArm('honest'));
    expect(harness.brierByArm('shuffled')).toBeGreaterThan(harness.brierByArm('honest'));
  });

  it('control: random arm advantage signal ≈ 0 (harness measures real signal)', () => {
    const harness = new BrierHarness();
    syntheticRecords(harness);
    expect(Math.abs(harness.advantageByArm('random'))).toBeLessThan(0.05);
  });

  it('handover path fires in the review band and is counted', async () => {
    const baselineCalls: string[] = [];
    const game: Game = createGridWorldGame({ id: 'handover-grid', grid: ['S..', '..G'], seed: 3 });
    const focus = new GameFocus({
      focusId: 'handover-focus',
      game,
      handover: {
        router: new ConfidenceRouter({ act: 0.7, review: 0.4, block: 0.1 }),
        reviewAction: 'escalate-baseline',
        baseline: (g, legal) => {
          baselineCalls.push(legal[0] ?? '');
          return legal[0] ?? null;
        },
      },
    });
    // confidence 0.5 → review band → escalate to baseline
    focus.bindReflex(new FixedConfidenceReflex(0.5));
    await focus.step(10);
    expect(focus.getHandoverCount()).toBe(1);
    expect(focus.didLastTickHandover()).toBe(true);
    expect(baselineCalls.length).toBe(1);

    // confidence 0.9 → act band → no handover
    const focus2 = new GameFocus({
      focusId: 'act-focus',
      game: createGridWorldGame({ id: 'act-grid', grid: ['S..', '..G'], seed: 3 }),
      handover: {
        router: new ConfidenceRouter({ act: 0.7, review: 0.4, block: 0.1 }),
        baseline: () => '2',
      },
    });
    focus2.bindReflex(new FixedConfidenceReflex(0.9));
    await focus2.step(10);
    expect(focus2.getHandoverCount()).toBe(0);

    // block band → AIKR yield, no forced move
    const focus3 = new GameFocus({
      focusId: 'block-focus',
      game: createGridWorldGame({ id: 'block-grid', grid: ['S..', '..G'], seed: 3 }),
      handover: {
        router: new ConfidenceRouter({ act: 0.7, review: 0.4, block: 0.1 }),
        baseline: () => '2',
      },
    });
    focus3.bindReflex(new FixedConfidenceReflex(0.05));
    const result = await focus3.step(10);
    expect(result.gameOutcome).toBeNull();
  });

  it('E7 cognitive mode: belief seeding → NAL veto with recorder-verified justification + per-tick panel', async () => {
    const game = createGridWorldGame({ id: 'cog-grid', grid: ['S..', '..G'], seed: 5 });
    const focus = new GameFocus({ focusId: 'cog-focus', game, cognitive: true });
    focus.bindReflex(new FixedConfidenceReflex(0.9));
    // Domain rule: gridworld 'S..' starts on the top row — moving up (0) bumps the wall.
    focus.seedRule('0', 'wall_bump', { f: 0.1, c: 0.95 });

    const ticks = 200;
    for (let t = 0; t < ticks; t++) await focus.step(10);

    // Veto fires and is counted
    const vetoStats = focus.getVetoStats();
    expect(vetoStats.totalVetos).toBeGreaterThanOrEqual(1);
    expect(vetoStats.vetoDetails[0]?.vetoReason).toBe('nal-focus-memory');

    // Per-tick panel data emitted
    const panel = focus.getPanelLog();
    expect(panel.length).toBe(ticks);
    expect(panel[0]!.decision.source).toBe('nal');
    expect(panel[0]!.nalDerivations.length).toBeGreaterThan(0);

    // Veto justification is a recorder-verifiable derivation record
    const justifications = focus.getVetoJustifications();
    expect(justifications.length).toBeGreaterThanOrEqual(1);
    for (const record of justifications) {
      const result = verifyRecord(record, { strict: true, epsilon: 1e-6 });
      expect(result.passed).toBe(true);
    }
  });

  it('G3 session state: roundtrip, corruption fail-open, config-mismatch rejects resume', () => {
    const dir = '.reports/todo17-session-test';
    rmSync(dir, { recursive: true, force: true });
    const path = `${dir}/session.json`;
    expect(loadSession(path)).toBeNull();

    const session: ArcadeSession = {
      version: 1,
      seed: 7,
      games: ['snake', 'tetris'],
      arms: ['manifold', 'lm'],
      targetEpisodes: 5,
      completed: { 'manifold/snake': 2 },
      bagWeights: { 'manifold-snake': 1.5 },
    };
    saveSession(path, session);
    const loaded = loadSession(path)!;
    expect(loaded.completed).toEqual({ 'manifold/snake': 2 });
    expect(loaded.bagWeights).toEqual({ 'manifold-snake': 1.5 });
    expect(isResumable(loaded, { seed: 7, games: ['snake', 'tetris'], arms: ['lm', 'manifold'], targetEpisodes: 5 })).toBe(true);

    // config mismatch ⇒ not resumable (seed / games / arms / episodes)
    expect(isResumable(loaded, { seed: 8, games: ['snake', 'tetris'], arms: ['lm', 'manifold'], targetEpisodes: 5 })).toBe(false);
    expect(isResumable(loaded, { seed: 7, games: ['snake'], arms: ['lm', 'manifold'], targetEpisodes: 5 })).toBe(false);
    expect(isResumable(loaded, { seed: 7, games: ['snake', 'tetris'], arms: ['lm'], targetEpisodes: 5 })).toBe(false);
    expect(isResumable(loaded, { seed: 7, games: ['snake', 'tetris'], arms: ['lm', 'manifold'], targetEpisodes: 4 })).toBe(false);

    // corruption ⇒ null (caller starts fresh with a note, never crashes)
    writeFileSync(path, '{not json', 'utf-8');
    expect(loadSession(path)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it('G5 arcade OTel spans: tick spans recorded with arm/game attributes, veto + handover events', async () => {
    const { NodeTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } = await import(
      '@opentelemetry/sdk-trace-node'
    );
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    provider.register();
    try {
      const { startArcadeTickSpan } = await import('@senars/nar/eval/arcade-trace');
      const span = startArcadeTickSpan('manifold', 'tetris', 3);
      span.finish({
        action: 'place:r0:c3',
        latencyMs: 12,
        reward: 1,
        terminal: false,
        handover: true,
        decision: { action: 'place:r0:c3', vetoedBy: null, source: 'reflex' },
      });
      startArcadeTickSpan('manifold', 'gridworld', 5).finish({
        action: '0',
        latencyMs: 4,
        reward: 0,
        terminal: false,
        handover: false,
        decision: { action: '0', vetoedBy: 'nal-focus-memory', source: 'nal' },
      });
      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(2);
      const tetris = spans.find((s) => s.attributes['arcade.game'] === 'tetris')!;
      expect(tetris.name).toBe('arcade.tick');
      expect(tetris.attributes['arcade.arm']).toBe('manifold');
      expect(tetris.attributes['arcade.action']).toBe('place:r0:c3');
      expect(tetris.attributes['arcade.handover']).toBe(true);
      expect(tetris.events.map((e) => e.name)).toContain('handover');
      const grid = spans.find((s) => s.attributes['arcade.game'] === 'gridworld')!;
      expect(grid.attributes['arcade.decision_source']).toBe('nal');
      expect(grid.events.map((e) => e.name)).toContain('veto');
    } finally {
      await provider.shutdown();
    }
  });

  it('report written to .reports/arcade.{json,md}', async () => {
    const dir = '.reports/todo17-test';
    rmSync(dir, { recursive: true, force: true });
    const harness = new BrierHarness();
    syntheticRecords(harness);
    const orig = harness.writeReports.bind(harness);
    await orig(dir);
    const json = JSON.parse(readFileSync(`${dir}/arcade.json`, 'utf-8'));
    expect(json.summary.length).toBe(3);
    expect(readFileSync(`${dir}/arcade.md`, 'utf-8')).toContain('Arcade decision-calibration report');
    rmSync(dir, { recursive: true, force: true });
    void mkdirSync;
  });
});
