import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { identityECE } from '../lm/system-one/calibration-fit.js';
import { createIsotonicCalibrator } from '../lm/system-one/calibration.js';

export interface ArcadeTickRecord {
  arm: string;
  game: string;
  stateId: string;
  action: string;
  /** Confidence/probability the arm attached to the chosen action. */
  predicted: number;
  /** Realized outcome in [0,1] (e.g. positive-reward indicator or shaped reward). */
  observed: number;
  reward: number;
  latencyMs: number;
  /** E2: this tick escalated to the heuristic baseline via the review band. */
  handover: boolean;
}

export interface ArmSummary {
  arm: string;
  ticks: number;
  brier: number;
  ece: number;
  meanReward: number;
  handoverRate: number;
  return: number;
}

/**
 * TODO17 E1 (W9): per-tick decision calibration against realized game
 * outcomes. Per-arm Brier + isotonic-calibrated ECE (reusing the TODO16c
 * calibration metrics — no second Brier implementation beyond
 * calibration-fit) + return curves → `.reports/arcade.{json,md}`.
 */
export class BrierHarness {
  private readonly records: ArcadeTickRecord[] = [];
  private readonly handoverByGame = new Map<string, number>();

  record(record: ArcadeTickRecord): void {
    this.records.push(record);
    if (record.handover)
      this.handoverByGame.set(record.game, (this.handoverByGame.get(record.game) ?? 0) + 1);
  }

  get size(): number {
    return this.records.length;
  }

  all(): readonly ArcadeTickRecord[] {
    return this.records;
  }

  byArm(arm: string): ArcadeTickRecord[] {
    return this.records.filter((r) => r.arm === arm);
  }

  /** Per-arm Brier score: mean (predicted − observed)². */
  brierByArm(arm: string): number {
    const rows = this.byArm(arm);
    if (rows.length === 0) return 0;
    return rows.reduce((sum, r) => sum + (r.predicted - r.observed) ** 2, 0) / rows.length;
  }

  /** Per-arm isotonic-calibrated ECE on realized outcomes (isotonic fit in-suite). */
  eceByArm(arm: string): number {
    const rows = this.byArm(arm);
    if (rows.length === 0) return 0;
    const calibrator = createIsotonicCalibrator('arcade' as never, arm as never);
    calibrator.update(rows.map((r) => ({ predicted: r.predicted, observed: r.observed, weight: 1 })));
    return identityECE(
      rows.map((r) => ({ predicted: calibrator.calibrate(r.predicted), observed: r.observed }))
    );
  }

  /** Cumulative-return curve per arm (per-tick reward, running sum). */
  returnCurveByArm(arm: string): number[] {
    const curve: number[] = [];
    let total = 0;
    for (const r of this.byArm(arm)) {
      total += r.reward;
      curve.push(total);
    }
    return curve;
  }

  handoverTotal(game?: string): number {
    if (game === undefined) return [...this.handoverByGame.values()].reduce((a, b) => a + b, 0);
    return this.handoverByGame.get(game) ?? 0;
  }

  /** Advantage signal: mean predicted minus observed — a healthy harness keeps arms honest. */
  advantageByArm(arm: string): number {
    const rows = this.byArm(arm);
    if (rows.length === 0) return 0;
    return rows.reduce((s, r) => s + (r.predicted - r.observed), 0) / rows.length;
  }

  summary(): ArmSummary[] {
    const arms = [...new Set(this.records.map((r) => r.arm))];
    return arms.map((arm) => {
      const rows = this.byArm(arm);
      return {
        arm,
        ticks: rows.length,
        brier: this.brierByArm(arm),
        ece: this.eceByArm(arm),
        meanReward: rows.length ? rows.reduce((s, r) => s + r.reward, 0) / rows.length : 0,
        handoverRate: rows.length ? rows.filter((r) => r.handover).length / rows.length : 0,
        return: this.returnCurveByArm(arm).at(-1) ?? 0,
      };
    });
  }

  toMarkdown(): string {
    const rows = this.summary()
      .map(
        (s) =>
          `| ${s.arm} | ${s.ticks} | ${s.brier.toFixed(4)} | ${s.ece.toFixed(4)} | ${s.meanReward.toFixed(4)} | ${(s.handoverRate * 100).toFixed(1)}% | ${s.return.toFixed(3)} |`
      )
      .join('\n');
    return [
      '# Arcade decision-calibration report',
      '',
      '| arm | ticks | Brier | ECE (isotonic) | mean reward | handover | return |',
      '|---|---|---|---|---|---|---|',
      rows,
      '',
      `Handover totals by game: ${JSON.stringify([...this.handoverByGame])}`,
    ].join('\n');
  }

  async writeReports(dir = '.reports'): Promise<void> {
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'arcade.json'),
      JSON.stringify(
        { summary: this.summary(), handoverByGame: [...this.handoverByGame], records: this.records },
        null,
        2
      )
    );
    await writeFile(join(dir, 'arcade.md'), this.toMarkdown());
  }
}
