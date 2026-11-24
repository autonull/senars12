/**
 * Transitive module closure over the `nar` source tree, for the gates whose claim
 * is about a *path* rather than about one file.
 *
 * `coreLayerViolations` reads one file's own edges, which is right when the rule
 * is "this file may not import upward". It is the wrong tool for "this path must
 * be unable to reach a provider anywhere", because that claim is about the
 * closure. Re-implementing the walk per gate is how two gates end up disagreeing
 * about what a path reaches, so it lives here once and every path gate reads it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importEdges } from './imports.js';
import { resolveInNar } from './layer-boundary.js';

const extensions = (base: string): string[] => ['.ts', '.tsx', '/index.ts'];

/** The on-disk source file a specifier lands in, or `null` if there is none. */
const sourceFor = (base: string): string | null => {
  for (const suffix of extensions(base)) if (existsSync(base + suffix)) return base + suffix;
  return null;
};

/**
 * Every `nar` source file reachable from `entry`, transitively, excluding the
 * entry itself and excluding bare package specifiers — a workspace package is
 * somebody else's boundary, and `@senars/util` is not the induction layer.
 *
 * A specifier that resolves to no file is simply not walked, which is the
 * conservative direction: a missing file cannot hide an edge, because an edge to
 * a missing file is a broken build that `typecheck` catches first.
 */
export const moduleClosure = (entry: string): string[] => {
  const seen = new Set<string>([resolve(entry)]);
  const queue = [sourceFor(resolve(entry))].filter((file): file is string => file !== null);

  while (queue.length > 0) {
    const file = queue.pop() as string;
    for (const edge of importEdges(readFileSync(file, 'utf8'))) {
      const target = resolveInNar(file, edge.specifier);
      if (target === null) continue;
      const next = sourceFor(target);
      if (next === null || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return [...seen].filter((file) => file !== resolve(entry)).sort();
};

/** The specifiers one file loads, for a gate that only needs its own edges. */
export const specifiersOf = (file: string): string[] =>
  importEdges(readFileSync(file, 'utf8')).map((edge) => edge.specifier);
