#!/usr/bin/env tsx
/**
 * `primitives:grammar` — the arithmetic and the collection reads reach one answer.
 *
 * `util` names a rate, a decay, an epsilon and a cache-or-create. Production code
 * agreed with all four most of the time and re-derived each of them in the rest:
 * `a / Math.max(b, 1)` is `flooredRatio` with the floor retyped, `Math.abs(x - y)
 * <= 1e-9` is `nearlyEqual` with the epsilon retyped, `[...new Set(xs)]` is
 * `unique` with the intent unstated, and the four-line get-or-create was written
 * out seven times.
 *
 * None of those is a bug. That is the problem: a curve that one module spells with
 * `Math.max(1, …)` and another with the shared `flooredRatio` cannot be tuned, and
 * a reviewer cannot tell a deliberate re-derivation from a drifted copy because
 * both read as ordinary arithmetic. So the grammar belongs in a gate.
 *
 * **The rule: production code spells these operations as the `@senars/util`
 * primitive.** A site that must do the arithmetic itself belongs in
 * `DECLARED` below, with its reason.
 *
 * The patterns are deliberately narrow — each one matches the shape that was
 * actually folded, not the general family — because a gate that cries wolf gets
 * switched off, and a switched-off gate is worse than no gate.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { maskNonCode } from './lib/imports.js';
import { ROOT } from './lib/root.js';
import { lineAt, sourceFiles } from './lib/source-scan.js';

const SOURCE_ROOTS = ['src', 'core/src', 'nar/src', 'io/src', 'metta/src', 'util/src', 'ui/src'];

/** The sites that may spell the arithmetic themselves, each with the reason. */
const DECLARED: readonly { readonly file: string; readonly reason: string }[] = [
  {
    file: 'util/src/utils/numeric.ts',
    reason: 'the primitives themselves — this is where the curves are defined',
  },
  {
    file: 'core/src/verify-derivation.ts',
    reason:
      'the verifier recomputes independently on purpose; a shared epsilon would be a shared bug',
  },
  {
    file: 'util/src/utils/collections.ts',
    reason: 'the primitives themselves — getOrInsert is the get-or-create and unique is the dedup',
  },
  {
    file: 'ui/src/webllm.ts',
    reason:
      'two memos over one key — a resolved engine and an in-flight init — which getOrInsert models as one',
  },
  {
    file: 'nar/src/memory/associative.ts',
    reason: 'the memo write is guarded by a layer probe; inserting first would memoize a miss',
  },
  {
    file: 'nar/src/terms/reduce.ts',
    reason:
      'a memo probe, not a lazy creation — the canonical form is computed, then memoized under two keys; getOrInsert would store the unreduced term first',
  },
  {
    file: 'nar/src/decision/types.ts',
    reason: 'policy coefficients, not rates',
  },
];

/** One open-coded spelling and the primitive that already answers it. */
const IDIOMS: readonly { readonly primitive: string; readonly pattern: RegExp }[] = [
  { primitive: 'flooredRatio', pattern: /\/\s*Math\.max\(\s*\d+\s*,/g },
  { primitive: 'unique', pattern: /\[\s*\.\.\.\s*new Set\(/g },
  { primitive: 'nearlyEqual', pattern: /Math\.abs\([^()]*\)\s*<=\s*[\d.e-]+/g },
  { primitive: 'softFalloff', pattern: /\b1\s*\/\s*\(\s*1\s*\+/g },
  { primitive: 'mapToRecord', pattern: /Object\.fromEntries\(\s*this\.\w+\s*\)/g },
  // The four-line get-or-create, spelled across two consecutive lines.
  {
    primitive: 'getOrInsert',
    pattern:
      /const (\w+) = (?:this\.)?[\w#.]+\.get\([^)]*\);\s*\n\s*if \(\1(?: !== undefined)?\) return \1;/g,
  },
];

const declared = new Set(DECLARED.map((site) => join(ROOT, site.file)));

interface Violation {
  readonly at: string;
  readonly primitive: string;
  readonly text: string;
}

const violations: Violation[] = [];

for (const root of SOURCE_ROOTS) {
  for (const file of sourceFiles(join(ROOT, root))) {
    if (!file.endsWith('.ts') || declared.has(file)) continue;
    const source = readFileSync(file, 'utf-8');
    const code = maskNonCode(source);
    for (const { primitive, pattern } of IDIOMS) {
      for (const match of code.matchAll(pattern)) {
        const offset = match.index ?? 0;
        violations.push({
          at: `${relative(ROOT, file)}:${lineAt(source, offset)}`,
          primitive,
          text: match[0].replaceAll('\n', ' ⏎ ').trim(),
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('primitives:grammar FAILED — open-coded where a shared primitive answers it:');
  for (const v of violations) console.error(`  ${v.at} — ${v.primitive} — ${v.text}`);
  console.error(
    '\n  Use the @senars/util primitive (flooredRatio, unique, nearlyEqual, softFalloff,\n' +
      '  mapToRecord, getOrInsert), or declare the site in DECLARED above with the reason.'
  );
  process.exit(1);
}

console.log(
  `primitives:grammar ok — ${IDIOMS.length} spellings reach ${DECLARED.length} declared site(s)`
);
