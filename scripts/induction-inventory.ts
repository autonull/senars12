#!/usr/bin/env tsx
/**
 * `induction:inventory` — the in-cycle induction inventory gate (TODO29.a §11.1 Q1′).
 *
 * Two jobs, and the second is the one that keeps the first honest:
 *
 *  1. **Every cycle-path import of the layer is a declared behaviour.** The
 *     inventory names behaviours rather than call sites, because a behaviour the
 *     cycle reaches by three routes is one row and three rows would each look
 *     complete while the behaviour was half-declared.
 *  2. **Every declared witness still holds.** A ledger entry reads exactly like
 *     a live reference whether or not it is one, which is the accumulator
 *     ledger's failure mode inverted: there, a declared site that did not exist
 *     counted as unbounded; here, a call site whose await was deleted counts as
 *     a live one. Both pass silently.
 *
 * Non-cycle-path files importing the layer are counted and printed. They are
 * A2's subject — the core's dependence on the induction layer in *both*
 * directions — and failing on them here would make this gate a second
 * `deps:direction` with a different opinion.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  CYCLE_PATH_PREFIXES,
  IN_CYCLE_EDGE_ATTRIBUTIONS,
  IN_CYCLE_INVENTORY,
} from '../nar/src/lm/in-cycle-inventory.js';
import { PROVIDER_SEAMS } from '../nar/src/lm/provider-seams.js';
import { witnessFiles } from '../util/src/index.js';
import { importEdges } from './lib/imports.js';
import {
  checkInventory,
  type DiscoveredEdge,
  isTypeOnlyImport,
  lineOf,
} from './lib/induction-inventory.js';
import { ROOT } from './lib/root.js';
import { sourceFiles } from './lib/source-scan.js';

const NAR_SRC = join(ROOT, 'nar/src');
const LAYER_DIR = join(NAR_SRC, 'lm');

const repoRelative = (path: string): string => relative(ROOT, path).replaceAll('\\', '/');

/** Edges from outside the layer into it — the dependency, with its kind. */
const layerEdges = (): readonly DiscoveredEdge[] => {
  const edges: DiscoveredEdge[] = [];
  for (const file of sourceFiles(NAR_SRC)) {
    if (file === LAYER_DIR || file.startsWith(`${LAYER_DIR}/`)) continue;
    const source = readFileSync(file, 'utf-8');
    for (const edge of importEdges(source)) {
      const target = join(file, '..', edge.specifier);
      if (!target.startsWith(LAYER_DIR)) continue;
      edges.push({
        file: repoRelative(file),
        specifier: edge.specifier,
        typeOnly: isTypeOnlyImport(source, edge.offset),
        line: lineOf(source, edge.offset),
      });
    }
  }
  return edges;
};

const edges = layerEdges();
const isCyclePath = (file: string): boolean =>
  CYCLE_PATH_PREFIXES.some((prefix) => file.startsWith(prefix));
const cyclePathFiles = [...new Set(edges.filter((e) => isCyclePath(e.file)).map((e) => e.file))];
const seamFiles = witnessFiles(PROVIDER_SEAMS.flatMap((seam) => seam.callSites));
const sources = new Map(
  [...new Set([...cyclePathFiles, ...seamFiles])].map(
    (file) => [file as string, readFileSync(join(ROOT, file as string), 'utf-8')] as const
  )
);

const failures = checkInventory({
  edges,
  behaviours: IN_CYCLE_INVENTORY,
  attributions: IN_CYCLE_EDGE_ATTRIBUTIONS,
  cyclePathFiles,
  sources,
  callSites: PROVIDER_SEAMS.flatMap((seam) => seam.callSites),
});

const values = edges.filter((edge) => !edge.typeOnly);
const cycleValues = values.filter((edge) => isCyclePath(edge.file));
const cycleEdges = edges.filter((edge) => isCyclePath(edge.file));

console.log('in-cycle induction inventory\n');
for (const behaviour of IN_CYCLE_INVENTORY) {
  console.log(
    `  ${behaviour.disposition.padEnd(11)} ${behaviour.id.padEnd(26)} ${behaviour.behaviour}\n` +
      `  ${''.padEnd(11)} ${' '.repeat(26)} noticed by: ${behaviour.noticedBy}`
  );
}

console.log(
  `\n  ${edges.length} imports of the layer from outside it: ${values.length} values, ` +
    `${edges.length - values.length} types.`
);
console.log(
  `  Of the cycle path: ${cycleEdges.length} edges across ${cyclePathFiles.length} files — ` +
    `${cycleValues.length} values, ${cycleEdges.length - cycleValues.length} types.`
);
console.log(
  `  Everything else — ${values.length - cycleValues.length} value imports across ` +
    `${new Set(values.filter((e) => !isCyclePath(e.file)).map((e) => e.file)).size} files — is ` +
    "assembly or agent-side, and is A2's subject.\n"
);

if (failures.length > 0) {
  for (const failure of failures) console.error(`induction:inventory FAILED — ${failure.kind}`);
  for (const failure of failures) console.error(`  ${failure.subject}: ${failure.detail}`);
  process.exit(1);
}

console.log('induction:inventory ok');
