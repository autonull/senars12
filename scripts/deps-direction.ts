#!/usr/bin/env tsx
/**
 * Layering gate: fails when a package import breaks the dependency direction.
 *
 * `deps:gate` counts cycles and compares a number, which is why the inversion
 * that let `@senars/kernel` import `@senars/nar` while its manifest declared
 * only `zod` was invisible: an inversion is not a cycle, and a cycle count
 * cannot see one. This gate reads the manifests for the layer order and the
 * declared edges, then reads the imports, so the *class* of defect fails
 * rather than the instance.
 *
 * Two rules, both from what the previous version of this gate got wrong:
 *
 *  - **Declared means declared.** A package that imports another must declare
 *    it in `dependencies`. The kernel package's manifest said `zod` only and
 *    nothing in CI compared the imports against it; the same held for
 *    `nar → metta`, where `nar/package.json` named no MeTTa dependency at all.
 *  - **Dynamic imports count.** `await import('@senars/metta')` is a value edge
 *    at runtime, and it is what the whole `nar → metta` inversion consisted of
 *    once the static import went. A static-only scan reported the edge closed
 *    while three of its four sites were still live.
 *
 * There is no type-only exemption. `import type` is erased at compile time,
 * but a package naming a package above it is the layering claim being made,
 * and the tree needs no exemption from one.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { importEdges } from './lib/imports.js';
import { coreLayerRemedy, scanCoreLayer } from './lib/layer-boundary.js';
import { readPackageJson } from './lib/pkg.js';
import { ROOT } from './lib/root.js';
import { lineAt, sourceFiles } from './lib/source-scan.js';
import { report } from './lib/verdicts.js';

/** Bottom of the stack first. A package may import anything at or below itself. */
const LAYERS = ['util', 'core', 'io', 'nar', 'metta'] as const;
type Layer = (typeof LAYERS)[number];

const layerOf = (pkg: string): number => LAYERS.indexOf(pkg as Layer);

/**
 * The known upward edges, each with the seam that would break it. These
 * predate the gate; every one is a real inversion, not a permitted design.
 * Empty means the layering is clean, not that the rule was relaxed.
 */
const ALLOWED_UPWARD: Record<string, string> = {};

const specifierPkg = (specifier: string): Layer | undefined => {
  const pkg = /^@senars\/([a-z]+)(?:\/|$)/.exec(specifier)?.[1];
  return pkg && (LAYERS as readonly string[]).includes(pkg) ? (pkg as Layer) : undefined;
};

const violations: string[] = [];

for (const pkg of LAYERS) {
  const manifest = readPackageJson(ROOT, pkg);
  const declared = new Set(Object.keys(manifest?.dependencies ?? {}));
  const seen = new Set<string>();

  for (const file of sourceFiles(join(ROOT, pkg, 'src'))) {
    const source = readFileSync(file, 'utf-8');
    for (const edge of importEdges(source)) {
      const target = specifierPkg(edge.specifier);
      if (!target) continue;
      const witness = `${relative(ROOT, file)}:${lineAt(source, edge.offset)}`;
      const key = `${witness} ${edge.specifier}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const where = `${witness} — ${edge.dynamic ? `import('${edge.specifier}')` : `imports '${edge.specifier}'`}`;

      if (target === pkg) {
        violations.push(
          `  ${where}\n      names its own package; a relative import says the same without a\n      resolution hop through the workspace root`
        );
        continue;
      }
      if (!declared.has(`@senars/${target}`)) {
        violations.push(
          `  ${pkg} -> ${target} — ${witness} loads it but ${pkg}/package.json does not declare it`
        );
        continue;
      }
      if (layerOf(target) <= layerOf(pkg)) continue;
      if (`${pkg} -> ${target}` in ALLOWED_UPWARD) continue;
      violations.push(`  ${pkg} -> ${target} — ${witness}${edge.dynamic ? ' (dynamic)' : ''}`);
    }
  }
}

// The `nar` core against its own induction layer: the same rule `core:no-lm`
// runs on its own, reported here so one gate owns the whole layering.
const coreLayer = scanCoreLayer();

report(
  'deps:direction',
  [...violations, ...coreLayer.map((v) => `${v.at} — ${v.specifier}`)],
  {
    remedy:
      `${LAYERS.join(' < ')}. Fix the import, or — if the seam is genuinely not ready — record\n` +
      'the edge in ALLOWED_UPWARD with the reason it cannot be broken yet.' +
      (coreLayer.length > 0 ? `\n\n${coreLayerRemedy(coreLayer)}` : ''),
  }
);

const ledger = Object.entries(ALLOWED_UPWARD);
console.log(
  `deps:direction ok — every @senars import is declared, relative and downward, and the ` +
    `nar cycle path does not reach nar/src/lm` +
    (ledger.length > 0 ? ` (${ledger.length} known inversion(s) in the ledger)` : '')
);
for (const [edge, reason] of ledger) console.log(`  known: ${edge} — ${reason}`);
