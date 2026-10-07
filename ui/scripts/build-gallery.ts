#!/usr/bin/env tsx
/**
 * Renders the visual contact sheet from `tests/visual/visual-report.json`.
 * One tile per matrix cell with its baseline, status, and links to the actual /
 * diff images on failure — reviewable at a glance without opening a browser.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { VisualCellResult } from '../tests/visual/reporter.js';

type VisualReport = {
  version: number;
  status: string;
  platform: string;
  cells: VisualCellResult[];
};

const root = process.cwd();
const reportPath = join(root, 'tests', 'visual', 'visual-report.json');
const galleryDir = join(root, 'tests', 'visual', 'gallery');
const artifactsDir = join(galleryDir, 'artifacts');

function readReport(): VisualReport {
  if (!existsSync(reportPath)) {
    throw new Error(`No visual report at ${reportPath}; run \`pnpm test:visual\` first.`);
  }
  return JSON.parse(readFileSync(reportPath, 'utf8')) as VisualReport;
}

function stageArtifact(cellId: string, kind: 'actual' | 'diff', file?: string): string | undefined {
  if (!file || !existsSync(file)) return undefined;
  const dest = join(artifactsDir, `${cellId}-${kind}.png`);
  copyFileSync(file, dest);
  return `./artifacts/${basename(dest)}`;
}

function relativeToGallery(target: string): string {
  const abs = resolve(root, target);
  return `../${abs.slice(dirname(galleryDir).length + 1)}`;
}

function statusClass(status: string): string {
  return status === 'passed' ? 'ok' : status === 'skipped' ? 'skip' : 'bad';
}

function renderTile(cell: VisualCellResult): string {
  const baseline = relativeToGallery(cell.baseline ?? '');
  const actual = stageArtifact(cell.id, 'actual', cell.actual);
  const diff = stageArtifact(cell.id, 'diff', cell.diff);
  const links = [
    actual ? `<a href="${actual}">actual</a>` : '',
    diff ? `<a href="${diff}">diff</a>` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `<figure class="tile ${statusClass(cell.status)}" id="${cell.id}">
  <figcaption>
    <span class="badge">${cell.status}</span>
    <span class="title">${cell.title}</span>
    <code>${cell.id}</code>
  </figcaption>
  <a class="shot" href="${baseline}"><img loading="lazy" src="${baseline}" alt="${cell.title}"></a>
  ${links ? `<div class="links">${links}</div>` : ''}
  ${cell.error ? `<pre class="error">${escapeHtml(cell.error)}</pre>` : ''}
</figure>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

function render(report: VisualReport): string {
  const groups = new Map<string, VisualCellResult[]>();
  for (const cell of report.cells) {
    groups.set(cell.group, [...(groups.get(cell.group) ?? []), cell]);
  }
  const sections = [...groups.entries()]
    .map(
      ([group, cells]) =>
        `<section><h2>${group} <small>${cells.length}</small></h2><div class="grid">${cells
          .map(renderTile)
          .join('\n')}</div></section>`
    )
    .join('\n');

  const failed = report.cells.filter((c) => c.status !== 'passed').length;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>SeNARS visual gallery</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 1.5rem; background: #0d0f14; color: #e6e8ee;
         font: 13px/1.5 "JetBrains Mono", ui-monospace, monospace; }
  header { display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
  h1 { font-size: 1.1rem; margin: 0; }
  h2 { font-size: .95rem; margin: 1.5rem 0 .5rem; border-bottom: 1px solid #262b36; padding-bottom: .25rem; }
  h2 small { color: #7f8798; }
  .summary { color: #7f8798; }
  .summary .bad { color: #ff6b6b; }
  .summary .ok { color: #4ade80; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .tile { margin: 0; border: 1px solid #262b36; border-radius: 6px; overflow: hidden; background: #12141a; }
  .tile.bad { border-color: #ff6b6b; }
  figcaption { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; padding: .4rem .5rem; }
  .badge { font-size: .65rem; text-transform: uppercase; padding: .1rem .35rem; border-radius: 3px; background: #1f2430; }
  .tile.bad .badge { background: #4a1d1d; color: #ffb4b4; }
  .tile.ok .badge { background: #14351f; color: #a7f3c4; }
  .title { flex: 1; }
  code { color: #7f8798; font-size: .7rem; }
  .shot img { display: block; width: 100%; height: auto; background: #0d0f14; }
  .links { padding: .3rem .5rem; }
  .links a { color: #67e8f9; }
  .error { margin: 0; padding: .4rem .5rem; max-height: 8rem; overflow: auto; color: #ffb4b4; font-size: .7rem; }
</style></head>
<body>
<header>
  <h1>SeNARS visual gallery</h1>
  <span class="summary">status <b class="${failed ? 'bad' : 'ok'}">${report.status}</b> ·
  ${report.cells.length} cells · ${failed} failed · ${report.platform}</span>
</header>
${sections}
</body></html>`;
}

function main(): void {
  const report = readReport();
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(join(galleryDir, 'index.html'), render(report));
  console.log(
    `Gallery: ${report.cells.length} cells (${report.cells.filter((c) => c.status !== 'passed').length} failed) → ${join('tests', 'visual', 'gallery', 'index.html')}`
  );
}

main();
