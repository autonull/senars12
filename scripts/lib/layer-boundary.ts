/**
 * The `nar` core may not import the induction layer (TODO29.a §5.2).
 *
 * One rule, two entry points: `core:no-lm` is the focused gate a change can run
 * by itself, and `deps:direction` reports the same violations in its own ledger,
 * because a rule that lives in one script is a rule the other script's author
 * does not know about.
 *
 * **The cycle path is the core.** Not all of `nar/src`: `facade/`, `nl/`,
 * `agent/` and `system-one-wiring.ts` are assembly, which is what
 * `induction:inventory` prints when it says "everything else is assembly or
 * agent-side". Policing all of `nar` would have demanded a seventh package;
 * policing the cycle path makes the *reasoning cycle* unable to reach the layer,
 * which is the property the plan wants and the one that can be structural.
 *
 * The prefix list is the one the inventory declares (`CYCLE_PATH_PREFIXES`), not
 * a second copy: a rule and the census that measures it cannot disagree if they
 * read the same array.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CYCLE_PATH_PREFIXES } from '../../nar/src/lm/in-cycle-inventory.js';
import { importEdges } from './imports.js';
import { ROOT } from './root.js';

const NAR_SRC = join(ROOT, 'nar/src');
const LAYER_PREFIX = `${NAR_SRC}/lm/`;

/** Whether `absolutePath` is *inside* the layer — which is exempt, being not a consumer of itself. */
export const isLayerInternal = (absolutePath: string): boolean =>
  absolutePath.startsWith(LAYER_PREFIX);

/** Whether `absolutePath` is on the cycle path, per the inventory's own declaration. */
export const isCyclePath = (absolutePath: string): boolean =>
  CYCLE_PATH_PREFIXES.some((prefix) => absolutePath.startsWith(join(ROOT, prefix)));

/**
 * Where a specifier lands inside `nar/src`, or `null` when it is neither a
 * relative path nor a workspace subpath — a bare package specifier is somebody
 * else's boundary, and `@senars/util` is not the layer.
 */
export const resolveInNar = (from: string, specifier: string): string | null => {
  const target = specifier.startsWith('@senars/nar/')
    ? join(NAR_SRC, specifier.slice('@senars/nar/'.length))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : null;
  return target === null ? null : target.replace(/\.js$/, '');
};

export const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

export interface CoreLayerViolation {
  /** Repo-relative, `file:line`. */
  readonly at: string;
  readonly specifier: string;
  readonly dynamic: boolean;
}

/** One cycle-path file's violations. `from` is absolute; `source` is its text. */
export const coreLayerViolations = (from: string, source: string): CoreLayerViolation[] =>
  importEdges(source).flatMap((edge) => {
    const target = resolveInNar(from, edge.specifier);
    if (target === null || !target.startsWith(LAYER_PREFIX) || isLayerInternal(from)) return [];
    return [
      {
        at: `${from.slice(ROOT.length + 1)}:${lineAt(source, edge.offset)}`,
        specifier: edge.specifier,
        dynamic: edge.dynamic,
      },
    ];
  });

export const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

/** Every cycle-path source file, so a rule over them is written once. */
export const scanCoreLayerSourceFiles = (): string[] =>
  sourceFiles(NAR_SRC).filter((file) => isCyclePath(file));

/** Every violation on the tree, cycle path only. */
export const scanCoreLayer = (): CoreLayerViolation[] =>
  sourceFiles(NAR_SRC)
    .filter((file) => isCyclePath(file))
    .flatMap((file) => coreLayerViolations(file, readFileSync(file, 'utf-8')));

export const report = (violations: readonly CoreLayerViolation[]): string =>
  [
    '  a cycle-path module imports the induction layer:',
    ...violations.map(
      (v) =>
        `  ${v.at} — ${v.dynamic ? `import('${v.specifier}')` : `imports '${v.specifier}'`}`
    ),
    '',
    '  The core declares what it needs: a `ModelRule` (nar/src/rules/types.ts), a',
    '  `TextGenerator` (nar/src/ports), an `EmbeddingRuntime` source',
    '  (nar/src/memory/embedding.ts). Take the dependency through one of those, or',
    '  move the call out of the cycle path.',
  ].join('\n');