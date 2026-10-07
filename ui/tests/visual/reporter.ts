import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

/** One captured matrix cell, as consumed by the gallery generator. */
export type VisualCellResult = {
  id: string;
  group: string;
  title: string;
  status: TestResult['status'];
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
    const project = test.parent.project()?.name ?? 'chromium';
    const baseline = join('tests', 'visual', 'baselines', project, `${id}-${process.platform}.png`);
    const artifact = (kind: 'actual' | 'diff') =>
      result.attachments.find((a) => a.path?.endsWith(`-${kind}.png`))?.path;

    this.cells.set(id, {
      id,
      group: cellGroup(test),
      title: id,
      status: result.status,
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
