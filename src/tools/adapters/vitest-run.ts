import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runProcess } from './proc.js';

export interface VitestRunOptions {
  workspaceRoot: string;
  testPath?: string | undefined;
  coverage?: boolean;
  timeoutMs?: number;
}

export interface VitestRunResult {
  /** Process exit code, or 1 when the run could not be read at all. */
  code: number;
  stderr: string;
  /** Raw contents of the JSON reporter output file, or null when unreadable. */
  output: string | null;
  error?: string;
}

const OUTPUT_FILE = '.vitest/json/output.json';

/**
 * Run vitest with the JSON reporter and read its output file. Spawn failures
 * and missing output both resolve — callers branch on `output`/`error` rather
 * than on a rejected promise.
 */
export async function runVitestJson({
  workspaceRoot,
  testPath,
  coverage = false,
  timeoutMs = 30 * 60_000,
}: VitestRunOptions): Promise<VitestRunResult> {
  const args = [
    'vitest',
    'run',
    '--reporter=json',
    ...(coverage ? ['--coverage'] : []),
    ...(testPath ? [testPath] : []),
  ];
  const proc = await runProcess('pnpm', args, { cwd: workspaceRoot, timeoutMs });
  let output: string | null = null;
  try {
    output = await readFile(resolve(workspaceRoot, OUTPUT_FILE), 'utf-8');
  } catch {
    output = null;
  }
  return {
    code: proc.code,
    stderr: proc.stderr,
    output,
    error: output ? undefined : proc.stderr.slice(0, 1000),
  };
}
