#!/usr/bin/env tsx
/**
 * The rule set is loaded data (TODO29.a §5.10).
 *
 * Four claims, three of which no runtime test can reach:
 *
 * 1. **No module-side-effect registration.** `registration.ts` used to register
 *    44 rules by being imported, so "which rules are loaded" was a property of
 *    the import graph. Legal TypeScript, invisible to the compiler, and now a
 *    gate failure.
 * 2. **No module-global rule set.** `RuleRegistry` was exactly A1's hidden-global
 *    defect in the place it mattered most, and it is deleted — so any surviving
 *    mention of the name is a resurrection.
 * 3. **The table is enumerable, versioned and revertable.** Checked here against
 *    the runtime, because those three are properties of the *store* rather than
 *    of the text.
 * 4. **An empty table is a runnable state.** Absence is a value, not a crash.
 */
import { BUILTIN_RULE_ARTIFACT_VERSION, RULE_TABLE_SCHEMA_VERSION } from '@senars/core/schemas';

import { LMProposalProducer } from '../nar/src/proposal/lm-rule-producer.js';
import { loadBuiltinTable } from '../nar/src/rules/impls/builtin-table.js';
import { BUILTIN_DECLARATIONS, RULE_BODIES } from '../nar/src/rules/impls/registration.js';
import {
  diffArtifacts,
  RuleTableError,
  RuleTableStore,
  tableArtifact,
} from '../nar/src/rules/impls/rule-table.js';
import { loadedDataViolations, scanSubject } from './lib/rule-table.js';
import { report } from './lib/verdicts.js';

const failures: string[] = [];

// ── 1 & 2: the shape of the code ───────────────────────────────────────────
for (const violation of loadedDataViolations(scanSubject())) {
  failures.push(`${violation.at} — ${violation.rule}: ${violation.detail}`);
}

// ── 3: enumerable, versioned, revertable ───────────────────────────────────
const table = loadBuiltinTable();
const enumeration = table.enumerate();
if (enumeration.revision !== 0)
  failures.push(`builtin table is at r${enumeration.revision}, expected r0`);
if (enumeration.rules.length !== BUILTIN_DECLARATIONS.length) {
  failures.push(
    `enumeration lists ${enumeration.rules.length} rules, declarations say ${BUILTIN_DECLARATIONS.length}`
  );
}
if (enumeration.artifactVersion !== BUILTIN_RULE_ARTIFACT_VERSION) {
  failures.push(`artifact version ${enumeration.artifactVersion} is not the shipped one`);
}
if (
  !enumeration.rules.every(
    (rule) => rule.provenance.kind === 'builtin' && rule.ruleSetRevision === 0
  )
) {
  failures.push('a built-in entry carries a revision or provenance that is not its own');
}

const admitted = table.admit(
  {
    ruleId: 'gate:probe',
    description: 'the gate proves a learned rule can enter and leave',
    left: { op: 'inheritance' },
    right: { op: 'inheritance' },
    truthFn: 'deduction',
    body: 'nal:deduction',
    priority: 0.5,
  },
  1,
  0,
  { proposalId: 'gate-probe' }
);
if (admitted.ruleSetRevision !== 1 || admitted.provenance.kind !== 'proposal') {
  failures.push('an admitted entry does not carry its revision and proposal provenance');
}
if (table.diff(0).added.join() !== 'gate:probe') {
  failures.push(`diff(r0) does not report the addition: ${table.diff(0).added.join(',')}`);
}
if (table.revert(0).revision !== 0 || table.entries().some((e) => e.ruleId === 'gate:probe')) {
  failures.push('revert(0) did not restore the prior revision');
}

// ── 4: an empty table is a state the core runs in ──────────────────────────
const empty = RuleTableStore.empty(RULE_BODIES);
if (empty.entries().length !== 0) failures.push('an empty table loaded rules from somewhere');

// ── version mismatch fails loudly, not by coercion ─────────────────────────
try {
  RuleTableStore.from(
    { ...table.artifact(), schemaVersion: RULE_TABLE_SCHEMA_VERSION + 1 },
    RULE_BODIES
  );
  failures.push('an incompatible artifact schema version loaded without complaint');
} catch (error) {
  if (!(error instanceof RuleTableError)) throw error;
  if (error.faults[0]?.reason !== 'schema-version') {
    failures.push(
      `an incompatible version failed for the wrong reason: ${error.faults[0]?.reason}`
    );
  }
}

// ── an unresolvable body is refused, not admitted inert ────────────────────
try {
  RuleTableStore.from(
    tableArtifact([
      ...loadBuiltinTable().entries(),
      {
        ruleId: 'gate:no-body',
        description: 'names a body nothing implements',
        left: { op: 'atom' },
        right: { op: 'atom' },
        truthFn: 'deduction',
        body: 'nothing:implements:this',
        priority: 0.1,
        artifactVersion: BUILTIN_RULE_ARTIFACT_VERSION,
        ruleSetRevision: 0,
        parentRevision: null,
        ruleSchemaVersion: RULE_TABLE_SCHEMA_VERSION,
        provenance: { kind: 'import', source: 'gate' },
      },
    ]),
    RULE_BODIES
  );
  failures.push('a rule whose body resolves to nothing was admitted');
} catch (error) {
  if (!(error instanceof RuleTableError)) throw error;
  if (error.faults[0]?.reason !== 'unresolved-body') {
    failures.push(`an unresolvable body failed for the wrong reason: ${error.faults[0]?.reason}`);
  }
}

// ── a rule proposal has a path to becoming a rule ──────────────────────────
const producer = new LMProposalProducer({} as never, {} as never);
if (typeof producer.submitRule !== 'function') {
  failures.push('the proposal seam has no way to submit a rule proposal');
}

// ── the diff helper is symmetric ────────────────────────────────────────────
const a = loadBuiltinTable().artifact();
const b = tableArtifact([...loadBuiltinTable().entries(), admitted]);
const forward = diffArtifacts(a, b);
const backward = diffArtifacts(b, a);
if (forward.added.length !== 1 || backward.removed.length !== 1) {
  failures.push('two revisions are not diffable in both directions');
}

report('rules:loaded-data', failures, {
  remedy:
    'Register through the `InferenceTable` a `RuleTableStore` owns (TODO29.a §5.10).\n' +
    '  A rule is a declaration plus a named body, admitted at a boundary, versioned\n' +
    '  and revertable. An empty table is a runnable state.',
});

console.log(
  `rules:loaded-data ok — ${BUILTIN_DECLARATIONS.length} declarations load at r0, ` +
    `admit and revert at runtime, no module registers a rule by import, no global rule set`
);
