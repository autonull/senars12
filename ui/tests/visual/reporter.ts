import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { VISUAL_CELLS } from './matrix.js';

/** One captured matrix cell, as consumed by the gallery generator. */
export type VisualCellResult = {
  id: string;
  group: string;
  title: string;
  /** One-sentence gallery caption: what the cell shows and what you can do. */
  explain?: string;
  status: TestResult['status'];
  /** Led in the gallery's Journeys strip. */
  journey?: boolean;
  /** The page rendered a view-host error (no adapter for a shape) — held back. */
  renderError?: boolean;
  baseline?: string;
  actual?: string;
  diff?: string;
  error?: string;
};

/**
 * Emits `tests/visual/visual-report.json` — the machine-readable half of the
 * gallery. The human half is `scripts/build-gallery.ts`, which renders this
 * report plus the referenced images into a contact sheet.
 */
export default class VisualReporter implements Reporter {
  private rootDir = process.cwd();
  private readonly cells = new Map<string, VisualCellResult>();

  onBegin(config: FullConfig): void {
    this.rootDir = config.rootDir;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const id = test.title;
    // Only matrix cells become gallery tiles; assertions (e.g. the legibility
    // check, T.4) share this project but own no baseline.
    if (!VISUAL_CELL_IDS.has(id)) return;
    const def = CELL_BY_ID.get(id);
    const project = test.parent.project()?.name ?? 'chromium';
    const baseline = join('tests', 'visual', 'baselines', project, `${id}-${process.platform}.png`);
    const artifact = (kind: 'actual' | 'diff') =>
      result.attachments.find((a) => a.path?.endsWith(`-${kind}.png`))?.path;

    this.cells.set(id, {
      id,
      group: def?.group ?? cellGroup(test),
      title: def?.title ?? id,
      explain: def?.explain,
      status: result.status,
      journey: def?.journey ?? JOURNEY_IDS.has(id),
      renderError: test.annotations.some((a) => a.type === 'render-error'),
      baseline,
      actual: artifact('actual'),
      diff: artifact('diff'),
      error: result.error?.message,
    });
  }

  onEnd(result: FullResult): void {
    const payload = {
      version: 1,
      status: result.status,
      platform: process.platform,
      cells: [...this.cells.values()],
    };
    const out = join(this.rootDir, 'visual-report.json');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  }
}

/** Group is carried on the test as a `group` annotation. */
function cellGroup(test: TestCase): string {
  return test.annotations.find((a) => a.type === 'group')?.description ?? 'misc';
}

/** The ids of the matrix cells; anything else in the project is a plain assertion. */
const VISUAL_CELL_IDS = new Set(VISUAL_CELLS.map((cell) => cell.id));

/** The cell definitions by id — the source of the gallery's titles and captions. */
const CELL_BY_ID = new Map(VISUAL_CELLS.map((cell) => [cell.id, cell]));

/** The led journey cells — the paradigm proved, not just covered. */
const JOURNEY_IDS = new Set(VISUAL_CELLS.filter((cell) => cell.journey).map((cell) => cell.id));
