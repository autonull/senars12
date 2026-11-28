import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/** Standard locations where observation bundles are stored. */
const BUNDLE_LOCATIONS = [
  '.cache/observations',
  'generated/observations',
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