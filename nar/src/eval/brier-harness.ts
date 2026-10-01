import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createIsotonicCalibrator } from '../lm/system-one/calibration.js';
import { identityECE, meanBrier } from '../lm/system-one/metrics.js';
import { ensureDir, incrementCount, mean, pct } from '@senars/util';

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
 * The one number Q3 compares across seeds (TODO29.a §11.1). `microBrier` weights
 * every tick equally, so a long game outvotes a short one; `macroBrier` is the
 * mean over games of each game's Brier, so no game decides the arm. Both are
 * reported because a difference that survives only one of them is a difference
 * about tick counts, not about decisions.
 */
export interface ArmAggregate {
  arm: string;
  games: number;
  ticks: number;
  macroBrier: number;
  microBrier: number;
  macroEce: number;
  macroReward: number;
  macroReturn: number;
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
    if (record.handover) incrementCount(this.handoverByGame, record.game);
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
    return meanBrier(this.byArm(arm));
  }

  /** Per-arm isotonic-calibrated ECE on realized outcomes (isotonic fit in-suite). */
  eceByArm(arm: string): number {
    const rows = this.byArm(arm);
    if (rows.length === 0) return 0;
    const calibrator = createIsotonicCalibrator('arcade' as never, arm as never);
    calibrator.update(
      rows.map((r) => ({ predicted: r.predicted, observed: r.observed, weight: 1 }))
    );
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
    return mean(rows, (r) => r.predicted - r.observed);
  }

  /** Games this arm actually played — the denominator a macro mean rests on. */
  gamesByArm(arm: string): string[] {
    return [...new Set(this.byArm(arm).map((r) => r.game))].sort();
  }

  /** Per-game Brier for one arm, so an aggregate can be a mean of means. */
  brierByGame(arm: string): Array<{ game: string; brier: number; ticks: number }> {
    const games = this.gamesByArm(arm);
    return games.map((game) => {
      const rows = this.byArm(arm).filter((r) => r.game === game);
      return { game, brier: meanBrier(rows), ticks: rows.length };
    });
  }

  /** The seed-comparable aggregate: one row per arm, macro means over games. */
  aggregate(): ArmAggregate[] {
    const arms = [...new Set(this.records.map((r) => r.arm))].sort();
    return arms.map((arm) => {
      const perGame = this.brierByGame(arm);
      const rows = this.byArm(arm);
      return {
        arm,
        games: perGame.length,
        ticks: rows.length,
        macroBrier: mean(perGame, (g) => g.brier),
        microBrier: this.brierByArm(arm),
        macroEce: mean(this.gamesByArm(arm), (game) =>
          identityECE(
            rows
              .filter((r) => r.game === game)
              .map((r) => ({ predicted: r.predicted, observed: r.observed }))
          )
        ),
        macroReward: mean(this.gamesByArm(arm), (game) =>
          mean(rows.filter((r) => r.game === game), (r) => r.reward)
        ),
        macroReturn: mean(this.gamesByArm(arm), (game) =>
          rows.filter((r) => r.game === game).reduce((a, r) => a + r.reward, 0)
        ),
      };
    });
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
        meanReward: mean(rows, (r) => r.reward),
        handoverRate: mean(rows, (r) => Number(r.handover)),
        return: this.returnCurveByArm(arm).at(-1) ?? 0,
      };
    });
  }

  toMarkdown(): string {
    const rows = this.summary()
      .map(
        (s) =>
          `| ${s.arm} | ${s.ticks} | ${s.brier.toFixed(4)} | ${s.ece.toFixed(4)} | ${s.meanReward.toFixed(4)} | ${pct(s.handoverRate , 1)} | ${s.return.toFixed(3)} |`
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
      '',
      '## Aggregate (macro = mean over games; micro = tick-weighted)',
      '',
      '| arm | games | ticks | macro Brier | micro Brier | macro ECE | macro reward | macro return |',
      '|---|---|---|---|---|---|---|---|',
      this.aggregate()
        .map(
          (a) =>
            `| ${a.arm} | ${a.games} | ${a.ticks} | ${a.macroBrier.toFixed(4)} | ${a.microBrier.toFixed(4)} | ${a.macroEce.toFixed(4)} | ${a.macroReward.toFixed(4)} | ${a.macroReturn.toFixed(3)} |`
        )
        .join('\n'),
    ].join('\n');
  }

  async writeReports(dir = '.reports'): Promise<void> {
    await ensureDir(dir);
    await writeFile(
      join(dir, 'arcade.json'),
      JSON.stringify(
        {
          summary: this.summary(),
          aggregate: this.aggregate(),
          handoverByGame: [...this.handoverByGame],
          records: this.records,
        },
        null,
        2
      )
    );
    await writeFile(join(dir, 'arcade.md'), this.toMarkdown());
  }
}

