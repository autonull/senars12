/**
 * The rule-table verdicts (TODO29.a §5.10).
 *
 * **`rules:loaded-data` is a claim about the import graph and about one global,
 * and neither is visible to the compiler.** A module-side-effect registration is
 * legal TypeScript; a module-global mutated by an import is a legal side effect.
 * So the rules here are read from the tree's text, one predicate per rule, which
 * is why a failure reads as a sentence about the source rather than a stack
 * trace out of a scanner.
 *
 * The runtime half of the same contract lives in `RuleTableStore` — a schema
 * version, an enumerable table, a revert. This file asserts the *shape of the
 * code*, which no amount of runtime testing can reach.
 */
import { escapeRegExp } from '@senars/util';
import { importEdges, maskNonCode } from './imports.js';
import type { Verdict } from './verdicts.js';
import { lineAt, scanSubject } from './source-scan.js';

export { lineAt };

const SCAN_ROOTS = ['nar/src', 'src'] as const;

export { scanSubject };

export type LoadedDataViolation = Verdict;

/** The modules allowed to call the old global by name — it is deleted, so this is empty. */
export const RETIRED_GLOBALS = ['RuleRegistry'] as const;

/** Every module-side-effect registration: a bare `import './x.js'` with no binding. */
const sideEffectImports = (source: string): { specifier: string; offset: number }[] =>
  importEdges(source).filter((edge) => {
    const line = source.slice(edge.offset).split('\n')[0] ?? '';
    return new RegExp(
      `^\\s*(import|require)\\s*\\(?\\s*['"]${escapeRegExp(edge.specifier)}['"]\\s*\\)?\\s*;`
    ).test(line);
  });

export const loadedDataViolations = (
  files: readonly { path: string; source: string }[]
): LoadedDataViolation[] => {
  const violations: LoadedDataViolation[] = [];
  for (const { path, source: raw } of files) {
    const file = { path, source: maskNonCode(raw) };
    // 1. No module may import a rule module purely for its side effect.
    for (const edge of sideEffectImports(file.source)) {
      if (!/(^|\/)(rules|rule-table|registration)($|\/|\.js)/.test(edge.specifier)) continue;
      violations.push({
        at: `${file.path}:${lineAt(file.source, edge.offset)}`,
        rule: 'no-side-effect-registration',
        detail: `imports '${edge.specifier}' for effect; the table is loaded, not imported`,
      });
    }
    // 2. No module may name the retired global.
    for (const name of RETIRED_GLOBALS) {
      const pattern = new RegExp(`\\b${name}\\b`, 'g');
      for (const match of file.source.matchAll(pattern)) {
        violations.push({
          at: `${file.path}:${lineAt(file.source, match.index ?? 0)}`,
          rule: 'no-retired-global',
          detail: `names the module-global '${name}'; the table is per-instance`,
        });
      }
    }
  }
  return violations;
};
