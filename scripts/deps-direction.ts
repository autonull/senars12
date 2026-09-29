#!/usr/bin/env tsx
/**
 * Direction gate: fails when a package imports a package that sits *above* it
 * in the declared layering.
 *
 * `deps:gate` counts cycles and compares a number, which is why the layering
 * inversion that let `@senars/kernel` import `@senars/nar` while its manifest
 * declared only `zod` was invisible: an inversion is not a cycle, and a cycle
 * count cannot see one. This gate reads the same manifests for the layer
 * order and then reads the imports, so the *class* of defect fails rather than
 * the instance.
 *
 * Two rules, both deliberately narrow:
 *
 *  - **Value edges only.** `import type` is erased at compile time and cannot
 *    form a runtime cycle, so dpdm's `--transform` mode excludes it too. A
 *    type-only upward edge is a smell, not a layering break.
 *  - **`ALLOWED_UPWARD` is a ledger, not a waiver.** Every entry names a
 *    pre-existing inversion and what would break it. A new upward edge is not
 *    added to the list; it is fixed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { errMsg } from '@senars/util';
import { ROOT } from './lib/root.js';

/** Bottom of the stack first. A package may import anything at or below itself. */
const LAYERS = ['util', 'core', 'io', 'nar', 'metta'] as const;

const layerOf = (pkg: string): number => LAYERS.indexOf(pkg as (typeof LAYERS)[number]);

/**
 * The known upward value edges, each with the seam that would break it. These
 * predate the gate; every one is a real inversion, not a permitted design.
 */
const ALLOWED_UPWARD: Record<string, string> = {
  'core -> io': 'core/memory/SessionManager.ts uses `createLedger`; the ledger belongs below memory.',
  'core -> nar': "core/agent/index.ts re-exports nar's createCognitiveAgent, and core/concept-graph.ts uses `serializeTerm`.",
  'nar -> metta': 'nar/agent/index.ts constructs `MettaEngine` directly; the MeTTa engine seam should be injected.',
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

/** `import`/`export ... from '@senars/x'` — bare specifiers, skipping `import type`. */
const crossPackageImports = (file: string): { pkg: string; typeOnly: boolean }[] => {
  const source = readFileSync(file, 'utf-8');
  const out: { pkg: string; typeOnly: boolean }[] = [];
  const statement = /(^|\n)\s*(import|export)\s+([\s\S]*?)from\s+'(@senars\/([a-z]+)[^']*)'/g;
  for (const [, , kind, clause, , pkg] of source.matchAll(statement)) {
    if (!LAYERS.includes(pkg as (typeof LAYERS)[number])) continue;
    out.push({ pkg, typeOnly: kind === 'import' && /^\s*type\b/.test(clause) });
  }
  return out;
};

const violations: string[] = [];

for (const pkg of LAYERS) {
  const files = sourceFiles(join(ROOT, pkg, 'src'));
  const upward = new Map<string, string>();
  for (const file of files) {
    for (const { pkg: target, typeOnly } of crossPackageImports(file)) {
      if (typeOnly || layerOf(target) <= layerOf(pkg)) continue;
      upward.set(`${pkg} -> ${target}`, relative(ROOT, file));
    }
  }
  for (const [edge, witness] of upward) {
    if (edge in ALLOWED_UPWARD) continue;
    violations.push(`  ${edge} — ${witness}`);
  }
}

if (violations.length > 0) {
  console.error('deps:direction FAILED — a package imports one above it in the layering:');
  for (const v of violations) console.error(v);
  console.error(
    `\n${LAYERS.join(' < ')}. Fix the import, or — if the seam is genuinely not ready — record\n` +
      'the edge in ALLOWED_UPWARD with the reason it cannot be broken yet.'
  );
  process.exit(1);
}

const ledger = Object.entries(ALLOWED_UPWARD);
console.log(
  `deps:direction ok — no upward value edges` +
    (ledger.length > 0 ? ` (${ledger.length} known inversion(s) in the ledger)` : '')
);
for (const [edge, reason] of ledger) console.log(`  known: ${edge} — ${reason}`);
