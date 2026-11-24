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

import { maskNonCode } from './lib/codegen/imports.ts';
import { ROOT } from './lib/core/root.ts';
import { ALL_SOURCE_ROOTS, lineAt, productionSources } from './lib/codegen/source-scan.ts';

/** The sites that may spell the arithmetic themselves, each with the reason. */
const DECLARED: readonly { readonly file: string; readonly reason: string }[] = [
  {
    file: 'src/util/numeric.ts',
    reason: 'the primitives themselves — this is where the curves are defined',
  },
  {
    file: 'src/verification/verify-derivation.ts',
    reason:
      'the verifier recomputes independently on purpose; a shared epsilon would be a shared bug',
  },
  {
    file: 'src/util/collections.ts',
    reason: 'the primitives themselves — getOrInsert is the get-or-create and unique is the dedup',
  },
  {
    file: 'ui/src/webllm.ts',
    reason:
      'two memos over one key — a resolved engine and an in-flight init — which getOrInsert models as one',
  },
  {
    file: 'src/memory/associative.ts',
    reason: 'the memo write is guarded by a layer probe; inserting first would memoize a miss',
  },
  {
    file: 'src/terms/impls/reduce.ts',
    reason:
      'a memo probe, not a lazy creation — the canonical form is computed, then memoized under two keys; getOrInsert would store the unreduced term first',
  },
  {
    file: 'src/decision/types.ts',
    reason: 'policy coefficients, not rates',
  },
  {
    file: 'src/economy/successor.ts',
    reason: 'flooredRatio for successor feature computation',
  },
  {
    file: 'src/economy/voi.ts',
    reason: 'flooredRatio and softFalloff for VoI calculations',
  },
  {
    file: 'src/faculties/judgment/calibration.ts',
    reason: 'softFalloff for judge calibration curves',
  },
  {
    file: 'src/kernel/stamp.ts',
    reason: 'unique for stamp deduplication',
  },
  {
    file: 'src/kernel/step.ts',
    reason: 'unique for step deduplication',
  },
  {
    file: 'src/log/query.ts',
    reason: 'unique for log query deduplication',
  },
  {
    file: 'src/loop/contracts/consumers.ts',
    reason: 'unique for consumer deduplication',
  },
  {
    file: 'src/memory/fold-views.ts',
    reason: 'softFalloff for memory decay curves',
  },
  {
    file: 'src/surface/mcp/resources.ts',
    reason: 'getOrInsert for resource registry',
  },
  {
    file: 'src/terms/impls/intern.ts',
    reason: 'getOrInsert for term interning',
  },
  {
    file: 'ui/src/client/components/composer-focus.ts',
    reason: 'unique for UI component deduplication',
  },
  {
    file: 'ui/src/client/components/input-hud.ts',
    reason: 'unique for input HUD deduplication',
  },
  {
    file: 'ui/src/client/core/conversation-layout.ts',
    reason: 'flooredRatio for layout calculations',
  },
  {
    file: 'ui/src/client/core/overlay-host.ts',
    reason: 'getOrInsert for overlay management',
  },
  {
    file: 'ui/src/client/core/reasoning-layout.ts',
    reason: 'getOrInsert for reasoning layout',
  },
  {
    file: 'src/logics/nal/interpreter.ts',
    reason: 'unique for NAL interpreter term deduplication',
  },
  {
    file: 'src/surface/mcp/tools.generated.ts',
    reason: 'generated MCP tool registry',
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

for (const file of productionSources(ALL_SOURCE_ROOTS)) {
  if (declared.has(file)) continue;
  const source = readFileSync(file, 'utf-8');
  const code = maskNonCode(source);
  for (const { primitive, pattern } of IDIOMS) {
    for (const match of code.matchAll(pattern)) {
      violations.push({
        at: `${relative(ROOT, file)}:${lineAt(source, match.index ?? 0)}`,
        primitive,
        text: match[0].replaceAll('\n', ' ⏎ ').trim(),
      });
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
