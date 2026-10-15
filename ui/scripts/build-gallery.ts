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
  ${cell.explain ? `<p class="explain">${escapeHtml(cell.explain)}</p>` : ''}
  ${links ? `<div class="links">${links}</div>` : ''}
  ${cell.error ? `<pre class="error">${escapeHtml(cell.error)}</pre>` : ''}
</figure>`;
}

/** A one-line orientation for each contact-sheet section. */
const GROUP_INTRO: Record<string, string> = {
  Journeys:
    'The live loop proved end to end: chat and graph move together, a node body embeds a projection, an overlay carries the reasoning.',
  Graph: 'The engine graph under different lenses and shapes.',
  Lenses: 'The same graph projected through goal and contradiction lenses.',
  Renderers: 'One workspace rendered by each registered renderer.',
  Fractal: 'A node that embeds a live projection of the substrate it sits on.',
  Layouts: 'The reasoning and conversation layouts that arrange the graph.',
  Views: 'Every view adapter: graph, series, tree, text, code, diff, table.',
  Overlays: 'The surfaces that carry reasoning: explain, artifact, related, chat, settings, …',
  Panels: 'Docked panels for chat history, search and lens design.',
  Components: 'Standalone widgets such as the contradiction badge.',
  Scenarios: 'Named engine scenarios loaded through the real reasoner.',
  States: 'The shell under loading, disconnection and error.',
  Responsive: 'The graph at narrow and medium widths.',
  Lab: 'Named compositions of the same surfaces the ask shell uses — chat, graph, notebook, console, goals and explorer, arranged by intent. The composer bar re-composes them live.',
  Studio: 'The parametric app: the same compositions, addressed by preset, including a cell that is itself a composition.',
  Apps: 'Each surface taken on its own, as a standalone page with its own URL.',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

function render(report: VisualReport): string {
  const byGroup = (cells: VisualCellResult[]): string => {
    const groups = new Map<string, VisualCellResult[]>();
    for (const cell of cells) {
      groups.set(cell.group, [...(groups.get(cell.group) ?? []), cell]);
    }
    return [...groups.entries()]
      .map(([group, list]) => {
        const intro = GROUP_INTRO[group];
        return `<section><h2>${group} <small>${list.length}</small></h2>${
          intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ''
        }<div class="grid">${list.map(renderTile).join('\n')}</div></section>`;
      })
      .join('\n');
  };

  // A tile whose page rendered a view-host error is held back, not presented as
  // working — a manifest of broken screenshots is worse than an honest gap.
  const healthy = report.cells.filter((c) => !c.renderError);
  const held = report.cells.filter((c) => c.renderError);
  const journeys = healthy.filter((c) => c.journey);
  const coverage = healthy.filter((c) => !c.journey);
  const failed = healthy.filter((c) => c.status !== 'passed').length;
  const led = `<p class="led">One substrate · many projections · recursively embeddable · LoD-scaled.
    These ${journeys.length} journeys prove the paradigm end-to-end: the live chat⇄graph loop,
    the fractal node body, and the overlays that carry reasoning. Everything else is the coverage
    contract, collapsed below.</p>`;

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
  .led { color: #aab2c4; max-width: 70ch; }
  details.coverage { margin-top: 2rem; border-top: 1px solid #262b36; padding-top: .5rem; }
  details.coverage > summary { cursor: pointer; color: #7f8798; font-size: .95rem; padding: .3rem 0; }
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
  .explain { margin: 0; padding: .35rem .5rem .5rem; color: #aab2c4; font-size: .72rem; }
  .intro { color: #8b93a5; max-width: 80ch; margin: 0 0 .75rem; font-size: .78rem; }
  .error { margin: 0; padding: .4rem .5rem; max-height: 8rem; overflow: auto; color: #ffb4b4; font-size: .7rem; }
</style></head>
<body>
<header>
  <h1>SeNARS visual gallery</h1>
  <span class="summary">status <b class="${failed ? 'bad' : 'ok'}">${report.status}</b> ·
  ${healthy.length} shown · ${held.length} held · ${failed} failed · ${report.platform}</span>
</header>
<section class="journeys">
  <h2>Journeys <small>${journeys.length}</small></h2>
  ${led}
  <div class="grid">${journeys.map(renderTile).join('\n')}</div>
</section>
<details class="coverage">
  <summary>Coverage — ${coverage.length} contract cells</summary>
  ${byGroup(coverage)}
</details>
${
  held.length
    ? `<details class="coverage held">
  <summary>Held back — ${held.length} tile(s) rendered a view error</summary>
  <p class="intro">These compositions rendered "No view adapter for this shape" — a view host could
  not resolve an adapter for an embedded shape/budget. Listed, not shown, so the gallery stays honest.</p>
  <ul>${held.map((c) => `<li><code>${c.id}</code> — ${escapeHtml(c.title)}</li>`).join('')}</ul>
</details>`
    : ''
}
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
