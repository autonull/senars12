import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P4 (TODO19): arcade replay report — HTML over `.reports/arcade.json`.
 * Summary table (arm-level Brier/ECE/return) + per-game action/reward timeline.
 * Doubles as the ReasoningGame demo surface: `reasoning:*` arms render here too.
 */

interface ArcadeRecord {
  arm: string;
  game: string;
  stateId: string;
  action: string;
  predicted: number;
  observed: number;
  reward: number;
  latencyMs: number;
  handover: boolean;
}

interface ArcadeReport {
  summary: { arm: string; ticks: number; brier: number; ece: number; meanReward: number; return: number }[];
  handoverByGame: { game: string; handovers: number }[];
  records: ArcadeRecord[];
}

const esc = (s: unknown): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(3));

const summaryTable = (report: ArcadeReport): string => `
<table>
  <thead><tr><th>arm</th><th>ticks</th><th>brier</th><th>ece</th><th>mean reward</th><th>return</th></tr></thead>
  <tbody>
    ${report.summary
      .map((s) => `<tr><td>${esc(s.arm)}</td><td>${s.ticks}</td><td>${num(s.brier)}</td><td>${num(s.ece)}</td><td>${num(s.meanReward)}</td><td>${num(s.return)}</td></tr>`)
      .join('\n')}
  </tbody>
</table>`;

/** Action strip: one cell per record; color = reward valence, title = full detail. */
const timeline = (records: ArcadeRecord[]): string =>
  `<div class="strip">${records
    .map(
      (r) =>
        `<span class="cell ${r.reward > 0 ? 'pos' : r.reward < 0 ? 'neg' : 'zero'}${r.handover ? ' handover' : ''}" ` +
        `title="${esc(r.game)} ${esc(r.stateId)}: action=${esc(r.action)} pred=${num(r.predicted)} obs=${num(r.observed)} reward=${num(r.reward)}">` +
        `${esc(r.action)}</span>`
    )
    .join('')}</div>`;

const gameSections = (report: ArcadeReport): string => {
  const byGame = new Map<string, Map<string, ArcadeRecord[]>>();
  for (const r of report.records) {
    const games = byGame.get(r.game) ?? new Map();
    games.set(r.arm, [...(games.get(r.arm) ?? []), r]);
    byGame.set(r.game, games);
  }
  return [...byGame]
    .map(
      ([game, arms]) => `<section><h2>${esc(game)}</h2>${[...arms]
        .map(([arm, recs]) => `<h3>${esc(arm)}</h3>${timeline(recs)}`)
        .join('')}</section>`
    )
    .join('\n');
};

const html = (report: ArcadeReport): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Arcade Replay</title>
<style>
  body { font: 13px/1.4 monospace; margin: 2rem; background: #111; color: #ddd; }
  table { border-collapse: collapse; margin-bottom: 2rem; }
  th, td { border: 1px solid #444; padding: 4px 10px; text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  h2 { margin: 1.5rem 0 0.5rem; color: #9cf; }
  h3 { margin: 0.75rem 0 0.25rem; font-weight: normal; color: #aaa; }
  .strip { display: flex; flex-wrap: wrap; gap: 2px; }
  .cell { padding: 2px 5px; border-radius: 3px; background: #333; cursor: default; }
  .cell.pos { background: #263; color: #8f8; }
  .cell.neg { background: #422; color: #f88; }
  .cell.handover { outline: 1px solid #fc6; }
</style></head><body>
<h1>Arcade Replay</h1>
${summaryTable(report)}
${gameSections(report)}
</body></html>`;

const [, , inFile = '.reports/arcade.json', outFile] = process.argv;
const report = JSON.parse(readFileSync(inFile, 'utf8')) as ArcadeReport;
const out = outFile ?? join(inFile, '..', 'arcade-replay.html');
mkdirSync(join(out, '..'), { recursive: true });
writeFileSync(out, html(report));
console.log(`arcade replay report → ${out} (${report.summary.length} arms, ${report.records.length} records)`);
