/**
 * One reader for "the production TypeScript in this repository".
 *
 * Ten gate scripts each declared their own recursive `.ts` walker, and no two
 * agreed: some skipped `.test.ts`, some `.d.ts`, some a generated-parser
 * directory, some nothing at all. Today the filters are equivalent on the
 * current tree — the differences were dead specificity — but the *next* test
 * file or generated directory would have made two gates disagree about what
 * production source is, which is precisely the disagreement they exist to
 * prevent. A gate and the census that measures it cannot disagree if they read
 * the same function.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './root.js';

/**
 * The workspace trees the complexity ratchet measures. `ui/src` is absent on
 * purpose: it arrived after `productionLOC` was baselined at 72,663, and adding it
 * would have silently moved a ratchet by 13%. The grammars read
 * {@link ALL_SOURCE_ROOTS} instead — a grammar that quietly skipped the web UI
 * would be a grammar about three quarters of the production code.
 */
export const WORKSPACE_SOURCE_ROOTS = [
  'util/src',
  'core/src',
  'io/src',
  'nar/src',
  'metta/src',
  'src',
] as const;

/** Every production tree, workspace and UI alike. */
export const ALL_SOURCE_ROOTS = [...WORKSPACE_SOURCE_ROOTS, 'ui/src'] as const;

/** Decides whether a directory entry is a source file worth scanning. */
export type SourceFilter = (name: string) => boolean;

/** Authored TypeScript: declarations and tests are not. */
export const moduleSource: SourceFilter = (name) =>
  name.endsWith('.ts') && !name.endsWith('.d.ts') && !/\.(test|spec)\.ts$/.test(name);

/** `moduleSource`, minus any path containing one of `generated`. */
export const excludingGenerated = (...generated: readonly string[]): SourceFilter => {
  const inner = moduleSource;
  return (name) => inner(name) && !generated.some((fragment) => name.includes(fragment));
};

/** Every `.ts` file under `dir`, recursively. */
export const sourceFiles = (dir: string, accept: SourceFilter = moduleSource): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path, accept) : accept(entry) ? [path] : [];
  });

/** Every production source file under the given repo-relative roots. A root
 *  that does not exist contributes nothing — a gate must not fail on a
 *  workspace that has not grown it yet. */
export const productionSources = (
  roots: readonly string[] = ALL_SOURCE_ROOTS,
  accept: SourceFilter = moduleSource
): string[] =>
  roots.flatMap((root) => {
    const dir = join(ROOT, root);
    return existsSync(dir) ? sourceFiles(dir, accept) : [];
  });

/** The 1-based line an offset falls on — a gate that reports `file:line` needs
 *  one of these, and re-deriving it is how two reports disagree on a site. */
export const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

/** Every production source file with its text, repo-relative. One reader, so
 *  gate and test cannot disagree. */
export const scanSubject = (
  roots: readonly string[] = ALL_SOURCE_ROOTS,
  accept: SourceFilter = moduleSource
): { path: string; source: string }[] =>
  productionSources(roots, accept).map((path) => ({
    path: path.slice(ROOT.length + 1),
    source: readFileSync(path, 'utf8'),
  }));
