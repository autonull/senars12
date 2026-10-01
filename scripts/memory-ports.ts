#!/usr/bin/env tsx
/**
 * The reasoning cycle depends on memory *ports*, not on the `Memory` facade
 * (TODO29.a A5).
 *
 * `Memory` is nine responsibilities in one class — storage, task admission,
 * links, focus, archive, indices, statistics, consolidation and the attention
 * slot — and every cycle-path consumer typed against it inherited all nine.
 * The ports in `nar/src/memory/ports/` exist so a consumer names the one it
 * needs; this gate is what keeps that true, because a widened dependency is
 * invisible to the compiler.
 *
 * **The rule: no cycle-path module may import `nar/src/memory/memory.ts`.** The
 * cycle path is the one `in-cycle-inventory.ts` declares, read from there rather
 * than copied, so the rule and the census cannot disagree about what "cycle
 * path" means. The path is read through the same helpers `core:no-lm` uses, so
 * the two gates cannot disagree about it either.
 *
 * **Composition sites are declared, not inferred.** A module that *builds* a
 * store — a replay reconstructing one from an event log — has to name the
 * implementation, and that is not a dependency on the facade's behaviour. Those
 * sites are in the ledger below with their reason, which makes the set of them
 * enumerable: a new one is a decision somebody has to write down.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CYCLE_PATH_PREFIXES } from '../nar/src/lm/in-cycle-inventory.js';
import { importEdges } from './lib/imports.js';
import {
  isCyclePath,
  lineAt,
  resolveInNar,
  scanCoreLayerSourceFiles,
} from './lib/layer-boundary.js';
import { ROOT } from './lib/root.js';

const FACADE = join(ROOT, 'nar/src/memory/memory.ts');
/** The barrel reaches the facade by re-export, so naming it is naming the facade. */
const BARREL = join(ROOT, 'nar/src/memory/index.ts');

/**
 * Cycle-path modules allowed to name the facade, each with the reason. An empty
 * ledger would be suspicious rather than clean: replay is one.
 */
const COMPOSITION_SITES: readonly { readonly file: string; readonly reason: string }[] = [
  {
    file: 'nar/src/memory/index.ts',
    reason: "memory's own barrel: the module that composes the ports publishes the facade",
  },
  {
    file: 'nar/src/kernel/replay.ts',
    reason: 'reconstructs a store from an event log, so it must construct one',
  },
];

export interface FacadeViolation {
  readonly at: string;
  readonly specifier: string;
}

const violations = (): FacadeViolation[] => {
  const declared = new Set(COMPOSITION_SITES.map((site) => join(ROOT, site.file)));
  return scanCoreLayerSourceFiles().flatMap((file) => {
    if (declared.has(file)) return [];
    const source = readFileSync(file, 'utf-8');
    return importEdges(source).flatMap((edge) => {
      const target = resolveInNar(file, edge.specifier);
      if (target === null) return [];
      // A specifier may name the file, the directory (→ its barrel), or either with
      // an explicit extension, so all four resolutions count as naming the facade.
      const namesFacade = [`${target}.ts`, target, `${target}/index.ts`].includes(FACADE) ||
        [`${target}.ts`, target, `${target}/index.ts`].includes(BARREL);
      if (!namesFacade) return [];
      return [
        {
          at: `${file.slice(ROOT.length + 1)}:${lineAt(source, edge.offset)}`,
          specifier: edge.specifier,
        },
      ];
    });
  });
};

const found = violations();

if (found.length > 0) {
  console.error('memory:ports FAILED — a cycle-path module depends on the Memory facade:');
  for (const v of found) console.error(`  ${v.at} — imports '${v.specifier}'`);
  console.error(
    '\n  Depend on the ports instead (nar/src/memory/ports): ConceptReader / ConceptWriter,\n' +
      'TaskAdmission, BeliefTable, GoalEnumeration, LinkPort, StatisticsView, SymbolIndex,\n' +
      'MemoryClock, AttentionOwner. `MemoryView` is the read surface the strategy layer takes.\n' +
      '  A module that genuinely *builds* a store belongs in COMPOSITION_SITES above, with its reason.'
  );
  process.exit(1);
}

console.log(
  `memory:ports ok — ${CYCLE_PATH_PREFIXES.length} cycle-path prefixes reach memory through its ports, ` +
    `not through ${COMPOSITION_SITES.length} declared composition site(s)`
);