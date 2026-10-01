#!/usr/bin/env tsx

/**
 * `gates:one-cycle-path` — exactly one `InferenceController` construction site
 * and one `.step(` call site (TODO29.a §7 invariant 11).
 *
 * "One inference path, many producers" is an invariant a reader cannot check and
 * a compiler cannot express, because `InferenceController` is a class like any
 * other. A second construction site is a second reasoner with its own rules and
 * its own idea of what a cycle is, and it is invisible in review precisely
 * because it looks like ordinary wiring.
 *
 * The count is textual on purpose: the invariant is about *sites*, and a call
 * that does not look like the one in `nar-execution.ts` is the thing to look at.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['nar/src', 'src', 'core/src'] as const;
const CONSTRUCT = /new InferenceController\(/g;
const STEP_CALL = /getInferenceController\(\)\s*\.\s*step\(/g;

export interface CyclePathSite {
  readonly ref: string;
  readonly line: number;
  readonly text: string;
}

const sources = (root: string): string[] => {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) out.push(path);
    }
  };
  walk(root);
  return out;
};

/** Every site in `roots` matching `pattern`, as `file:line` references. */
export const findSites = (roots: readonly string[], pattern: RegExp): readonly CyclePathSite[] =>
  roots.flatMap((root) =>
    sources(root).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((text, index) =>
          [...text.matchAll(pattern)].map(() => ({ ref: `${file}:${index + 1}`, line: index + 1, text: text.trim() }))
        )
    )
  );

const constructions = findSites(ROOTS, CONSTRUCT);
const steps = findSites(ROOTS, STEP_CALL);

console.log('one inference path — construction sites and cycle step call sites\n');
for (const site of constructions) console.log(`  construct  ${site.ref}  ${site.text}`);
for (const site of steps) console.log(`  step       ${site.ref}  ${site.text}`);
console.log();

const failures = [
  ...(constructions.length === 1 ? [] : [`${constructions.length} InferenceController construction sites, expected exactly 1`]),
  ...(steps.length === 1 ? [] : [`${steps.length} inference step call sites, expected exactly 1`]),
];

if (failures.length > 0) {
  for (const failure of failures) console.error(`gates:one-cycle-path FAILED — ${failure}`);
  process.exit(1);
}

console.log('gates:one-cycle-path ok — one controller, one cycle step.\n');
