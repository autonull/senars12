import { BrierHarness } from '@senars/nar/eval/brier-harness';
import { ConfidenceRouter } from '@senars/nar/lm/system-one/policy';
import { GameFocus } from '@senars/nar/focus';
import { createGridWorldGame, SeededRNG, type Game } from '@senars/nar/game';
import type { ActionProposal, LearningEvent, Reflex } from '@senars/nar/reflex';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
