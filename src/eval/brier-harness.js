import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createIsotonicCalibrator } from '../lm/system-one/calibration';
import { identityECE, meanBrier } from '../lm/system-one/metrics';
import { ensureDir } from '@senars/util/fs';
import { incrementCount, unique } from '@senars/util/collections';
import { mean, sumBy } from '@senars/util/numeric';
import { pct } from '@senars/util/format';
/**
 * TODO17 E1 (W9): per-tick decision calibration against realized game
 * outcomes. Per-arm Brier + isotonic-calibrated ECE (reusing the TODO16c
 * calibration metrics — no second Brier implementation beyond
 * calibration-fit) + return curves → `.reports/arcade.{json,md}`.
 */
export class BrierHarness {
    records = [];
    handoverByGame = new Map();
    record(record) {
        this.records.push(record);
        if (record.handover)
            incrementCount(this.handoverByGame, record.game);
    }
    get size() {
        return this.records.length;
    }
    all() {
        return this.records;
    }
    byArm(arm) {
        return this.records.filter((r) => r.arm === arm);
    }
    /** Per-arm Brier score: mean (predicted − observed)². */
    brierByArm(arm) {
        return meanBrier(this.byArm(arm));
    }
    /** Per-arm isotonic-calibrated ECE on realized outcomes (isotonic fit in-suite). */
    eceByArm(arm) {
        const rows = this.byArm(arm);
        if (rows.length === 0)
            return 0;
        const calibrator = createIsotonicCalibrator('arcade', arm);
        calibrator.update(rows.map((r) => ({ predicted: r.predicted, observed: r.observed, weight: 1 })));
        return identityECE(rows.map((r) => ({ predicted: calibrator.calibrate(r.predicted), observed: r.observed })));
    }
    /** Cumulative-return curve per arm (per-tick reward, running sum). */
    returnCurveByArm(arm) {
        const curve = [];
        let total = 0;
        for (const r of this.byArm(arm)) {
            total += r.reward;
            curve.push(total);
        }
        return curve;
    }
    handoverTotal(game) {
        if (game === undefined)
            return sumBy(this.handoverByGame.values(), (count) => count);
        return this.handoverByGame.get(game) ?? 0;
    }
    /** Advantage signal: mean predicted minus observed — a healthy harness keeps arms honest. */
    advantageByArm(arm) {
        const rows = this.byArm(arm);
        if (rows.length === 0)
            return 0;
        return mean(rows, (r) => r.predicted - r.observed);
    }
    /** Games this arm actually played — the denominator a macro mean rests on. */
    gamesByArm(arm) {
        return unique(this.byArm(arm).map((r) => r.game)).sort();
    }
    /** Per-game Brier for one arm, so an aggregate can be a mean of means. */
    brierByGame(arm) {
        const games = this.gamesByArm(arm);
        return games.map((game) => {
            const rows = this.byArm(arm).filter((r) => r.game === game);
            return { game, brier: meanBrier(rows), ticks: rows.length };
        });
    }
    /** The seed-comparable aggregate: one row per arm, macro means over games. */
    aggregate() {
        const arms = unique(this.records.map((r) => r.arm)).sort();
        return arms.map((arm) => {
            const perGame = this.brierByGame(arm);
            const rows = this.byArm(arm);
            return {
                arm,
                games: perGame.length,
                ticks: rows.length,
                macroBrier: mean(perGame, (g) => g.brier),
                microBrier: this.brierByArm(arm),
                macroEce: mean(this.gamesByArm(arm), (game) => identityECE(rows
                    .filter((r) => r.game === game)
                    .map((r) => ({ predicted: r.predicted, observed: r.observed })))),
                macroReward: mean(this.gamesByArm(arm), (game) => mean(rows.filter((r) => r.game === game), (r) => r.reward)),
                macroReturn: mean(this.gamesByArm(arm), (game) => sumBy(rows.filter((r) => r.game === game), (r) => r.reward)),
            };
        });
    }
    summary() {
        const arms = unique(this.records.map((r) => r.arm));
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
    toMarkdown() {
        const rows = this.summary()
            .map((s) => `| ${s.arm} | ${s.ticks} | ${s.brier.toFixed(4)} | ${s.ece.toFixed(4)} | ${s.meanReward.toFixed(4)} | ${pct(s.handoverRate, 1)} | ${s.return.toFixed(3)} |`)
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
                .map((a) => `| ${a.arm} | ${a.games} | ${a.ticks} | ${a.macroBrier.toFixed(4)} | ${a.microBrier.toFixed(4)} | ${a.macroEce.toFixed(4)} | ${a.macroReward.toFixed(4)} | ${a.macroReturn.toFixed(3)} |`)
                .join('\n'),
        ].join('\n');
    }
    async writeReports(dir = '.reports') {
        await ensureDir(dir);
        await writeFile(join(dir, 'arcade.json'), JSON.stringify({
            summary: this.summary(),
            aggregate: this.aggregate(),
            handoverByGame: [...this.handoverByGame],
            records: this.records,
        }, null, 2));
        await writeFile(join(dir, 'arcade.md'), this.toMarkdown());
    }
}
