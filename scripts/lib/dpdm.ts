import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { ROOT } from './root.js';

/** Source roots analysed for circular imports by every dpdm-based gate. */
export const DPDM_TARGETS = ['src/', 'core/src/', 'io/src/', 'metta/src/', 'nar/src/', 'util/src/'];

/**
 * The pinned `dpdm` entry point, resolved through the installed package rather
 * than `pnpm dlx`. Both cycle budgets measure the same tree and compare against
 * a checked-in number, so the analyzer version is part of that number's meaning:
 * `dlx` fetched whatever was newest, which makes a passing baseline
 * unreproducible across machines and turns an unrelated dpdm upgrade into a
 * spurious dependency regression. Resolution goes through `createRequire` so it
 * holds under hoisted and pnpm-symlinked layouts alike.
 */
const requireFromRoot = createRequire(join(ROOT, 'noop.js'));

const dpdmBin = (): string => {
  const { bin } = requireFromRoot('dpdm/package.json') as {
    bin: string | Record<string, string>;
  };
  const relative = typeof bin === 'string' ? bin : Object.values(bin)[0]!;
  return join(dirname(requireFromRoot.resolve('dpdm/package.json')), relative);
};

const dpdmArgs = (outPath: string, transform: boolean): string[] => [
  dpdmBin(),
  '--circular',
  '--warning',
  'false',
  '--skip-dynamic-imports',
  'circular',
  ...(transform ? ['--transform'] : ['tree']),
  '-o',
  outPath,
  ...DPDM_TARGETS,
];

const readChains = (outPath: string): string[][] =>
  JSON.parse(readFileSync(outPath, 'utf-8')).circulars as string[][];

const withWorkDir = async <T>(use: (outPath: string) => Promise<T>): Promise<T> => {
  const workDir = mkdtempSync(join(tmpdir(), 'dpdm-'));
  try {
    return await use(join(workDir, 'deps.json'));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};

/**
 * Raw circular dependency chains from dpdm. `--transform` resolves types through
 * the TS transform, so type-only edges no longer count as cycles.
 */
export const circularChains = ({ transform = true }: { transform?: boolean } = {}): string[][] => {
  const workDir = mkdtempSync(join(tmpdir(), 'dpdm-'));
  const outPath = join(workDir, 'deps.json');
  try {
    execFileSync(process.execPath, dpdmArgs(outPath, transform), {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    return readChains(outPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};

/** Number of raw circular chains — the metric the gates budget against. */
export const countCircularChains = (options: { transform?: boolean } = {}): number =>
  circularChains(options).length;

/**
 * The same report, awaited. Gates that measure several slow signals at once
 * (LOC, cycles, typecheck) need dpdm off the blocking path, or running the
 * three in parallel costs exactly as much as the slowest of them serially.
 */
export const circularChainsAsync = ({
  transform = true,
}: {
  transform?: boolean;
} = {}): Promise<string[][]> =>
  withWorkDir(async (outPath) => {
    await promisify(execFile)(process.execPath, dpdmArgs(outPath, transform), { cwd: ROOT });
    return readChains(outPath);
  });
