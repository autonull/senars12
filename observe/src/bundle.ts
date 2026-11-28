import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Manifest, Verdict, Finding, CheckResult, Mark } from './schema.js';
import type { ObserveProgram } from './programs.js';
import type { Mark as MarkType } from './schema.js';

/** Standard locations where observation bundles are stored. */
const BUNDLE_LOCATIONS = [
  '.cache/observations',
  'generated/observations',
  'fixtures/observe',
] as const;

/** Find a bundle directory by run ID. */
export function findBundle(runId: string): string | null {
  for (const location of BUNDLE_LOCATIONS) {
    const path = join(process.cwd(), location, runId);
    try {
      require('node:fs').accessSync(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

/** Find all bundle directories matching a prefix. */
export function findBundles(prefix: string): string[] {
  const results: string[] = [];
  for (const location of BUNDLE_LOCATIONS) {
    const dir = join(process.cwd(), location);
    try {
      const entries = require('node:fs').readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith(prefix)) {
          results.push(join(dir, entry));
        }
      }
    } catch {
      continue;
    }
  }
  return results;
}

/** Read a JSON file from a bundle, returning null if not found. */
export async function readBundleJSON<T>(bundleDir: string, filename: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(join(bundleDir, filename), 'utf-8'));
  } catch {
    return null;
  }
}

/** Read a JSONL file from a bundle, returning parsed lines. */
export async function readBundleJSONL<T>(bundleDir: string, filename: string): Promise<T[]> {
  try {
    const content = await fs.readFile(join(bundleDir, filename), 'utf-8');
    return content.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export interface BundleData {
  manifest: Manifest | null;
  verdict: Verdict | null;
  checks: CheckResult[];
  marks: Mark[];
  frames: Array<{ hash: string; timestamp: number; markId: string }>;
  events: Array<{ seq: number; ts: number; event: any }>;
  program: ObserveProgram | null;
}

/** Read all standard bundle files at once. */
export async function readBundle(bundleDir: string): Promise<BundleData> {
  const [manifest, verdict, checks, marks, frames, events] = await Promise.all([
    readBundleJSON<Manifest>(bundleDir, 'manifest.json'),
    readBundleJSON<Verdict>(bundleDir, 'verdict.json'),
    readBundleJSON<CheckResult[]>(bundleDir, 'checks.json'),
    readBundleJSONL<Mark>(bundleDir, 'marks.jsonl'),
    readBundleJSON<Array<{ hash: string; timestamp: number; markId: string }>>(bundleDir, 'frames.json'),
    readBundleJSONL<Array<{ seq: number; ts: number; event: any }>>(bundleDir, 'events.jsonl'),
  ]);

  return {
    manifest,
    verdict,
    checks: checks ?? [],
    marks: marks ?? [],
    frames: frames ?? [],
    events: events ?? [],
    program: manifest?.program as ObserveProgram ?? null,
  };
}

/** Write standard bundle files. */
export interface WriteBundleOptions {
  bundleDir: string;
  manifest?: Manifest;
  verdict?: Verdict;
  checks?: CheckResult[];
  marks?: Mark[];
  frames?: Array<{ hash: string; timestamp: number; markId: string }>;
  events?: Array<{ seq: number; ts: number; event: any }>;
}

export async function writeBundle(options: WriteBundleOptions): Promise<void> {
  await fs.mkdir(options.bundleDir, { recursive: true });

  const writes: Promise<void>[] = [];

  if (options.manifest) {
    writes.push(fs.writeFile(join(options.bundleDir, 'manifest.json'), JSON.stringify(options.manifest, null, 2)));
  }
  if (options.verdict) {
    writes.push(fs.writeFile(join(options.bundleDir, 'verdict.json'), JSON.stringify(options.verdict, null, 2)));
  }
  if (options.checks) {
    writes.push(fs.writeFile(join(options.bundleDir, 'checks.json'), JSON.stringify(options.checks, null, 2)));
  }
  if (options.marks) {
    writes.push(fs.writeFile(join(options.bundleDir, 'marks.jsonl'), options.marks.map(m => JSON.stringify(m)).join('\n') + '\n'));
  }
  if (options.frames) {
    writes.push(fs.writeFile(join(options.bundleDir, 'frames.json'), JSON.stringify(options.frames, null, 2)));
  }
  if (options.events) {
    writes.push(fs.writeFile(join(options.bundleDir, 'events.jsonl'), options.events.map(e => JSON.stringify(e)).join('\n') + '\n'));
  }

  await Promise.all(writes);
}

/** Find the first mark that has a finding associated with it. */
export function findFirstDivergentMark(findings: Finding[], marks: MarkType[]): string | undefined {
  for (const finding of findings) {
    if (finding.markId) return finding.markId;
  }
  return undefined;
}