/**
 * The `resource:policy` rule, once (TODO29.a §5.8, A8).
 *
 * The inventory's capacity is a *pointer* to where the bound is declared rather
 * than a copy of it, so this file resolves each pointer by importing the owning
 * module and reading the real binding. A bound raised in `Memory` or in
 * `DEFAULT_MEMORY_CONFIG` therefore cannot drift from its declaration, which is
 * the failure TODO28's accumulator ledger had: it asserted two hand-listed paths
 * *contained the text `LruCache`*, so raising a bound was invisible and deleting
 * a file still "counted".
 *
 * Five rules, and the first is the one the ledger could not express:
 *
 *  1. **A declaration is live** — the module that declares a bound *reads* it
 *     more than once. A capacity constant nobody reads is a comment with a type,
 *     and it would let every bound be raised to infinity in one edit.
 *  2. **A bound is a finite positive number.** `Infinity`, `0` and `NaN` are all
 *     ways of saying "unbounded" that read as a bound.
 *  3. **Retention and overflow are declared**, from the vocabulary the code can
 *     actually perform — a policy word with no implementation is worse than none.
 *  4. **A pressure signal is declared or explicitly `null`.** A blank field is a
 *     missing answer wearing a filled-in shape.
 *  5. **TODO28's ledger is covered.** Those two sites were audited under a
 *     weaker rule; the stronger inventory has to include them, or the audit
 *     silently regresses to a string check.
 */

import { readFileSync } from 'node:fs';
import { RESOURCE_CONTRACTS, type CapacitySource } from '../../nar/src/resources/contracts.js';
import { ACCUMULATOR_LEDGER } from './accumulator-ledger.js';
import { maskNonCode } from './imports.js';
import { sourceFiles } from './layer-boundary.js';
import { fromRoot } from './root.js';

export interface ResourceViolation {
  readonly id: string;
  readonly rule: string;
  readonly detail: string;
}

const exists = (module: string): boolean => {
  try {
    readFileSync(fromRoot(module));
    return true;
  } catch {
    return false;
  }
};

/**
 * Reads the numeric bound a declaration points at. A binding may be the number
 * itself, a numeric record's field, or — for a static class member such as
 * `Memory.REVISION_LOG_CAP` — a property of the exported class.
 */
export const resolveCapacity = async (source: CapacitySource): Promise<number | string> => {
  const module = (await import(fromRoot(source.module))) as Record<string, unknown>;
  const binding = module[source.symbol];
  if (binding === undefined) return `no export named ${source.symbol}`;
  const holder =
    source.field === undefined
      ? binding
      : (binding as unknown as Record<string, unknown>)[source.field];
  if (holder === undefined) return `${source.symbol} has no ${source.field}`;
  return holder as number;
};

const mentionCache = new Map<string, number>();

/**
 * How many files under `nar/src` name the symbol, and in how many places.
 *
 * **Across the package, not in the declaring module.** A bound is often declared
 * beside the thing it names and read by the thing that owns it —
 * `PROPOSAL_LOG_CAPACITY` lives in `proposal/lifecycle.ts` and is spent in
 * `nar.ts` — so a rule that demanded the declaring module read its own constant
 * would have flagged a live bound as dead, and the cheapest fix for that is to
 * delete the constant, which is exactly the wrong outcome.
 *
 * One mention is the declaration and nothing else; a declaration with no reader
 * bounds nothing, which is the property worth checking.
 */
export const mentionsInPackage = (symbol: string): number => {
  const cached = mentionCache.get(symbol);
  if (cached !== undefined) return cached;
  const pattern = new RegExp(String.raw`\b${symbol}\b`, 'g');
  const total = sourceFiles(fromRoot('nar/src')).reduce(
    (count, file) => count + (maskNonCode(readFileSync(file, 'utf8')).match(pattern)?.length ?? 0),
    0
  );
  mentionCache.set(symbol, total);
  return total;
};

export const resourceViolations = async (): Promise<ResourceViolation[]> => {
  const violations: ResourceViolation[] = [];
  const seen = new Set<string>();

  for (const contract of RESOURCE_CONTRACTS) {
    const fail = (rule: string, detail: string): void =>
      violations.push({ id: contract.id, rule, detail });

    if (seen.has(contract.id)) fail('unique-id', `${contract.id} is declared twice`);
    seen.add(contract.id);

    // 3 — the declaration is complete.
    if (!contract.holds.trim()) fail('declared', 'no record of what the resource holds');
    if (!contract.owner.trim()) fail('declared', 'no owner');
    if (!contract.overflow.trim()) fail('declared', 'no declared overflow behaviour');

    // 4 — a signal, or an explicit `null` that means something.
    if (contract.pressureSignal === undefined)
      fail('declared', 'no pressure signal and no explicit null');
    if (contract.pressureSignal !== null && !contract.pressureSignal.trim())
      fail('declared', 'a pressure signal is declared but empty — say something or say null');

    if (!exists(contract.owner)) {
      fail('owner-exists', `${contract.owner} does not exist`);
      continue;
    }

    const { module, symbol, field } = contract.capacity;
    if (!exists(module)) {
      fail('capacity-exists', `${module} does not exist`);
      continue;
    }

    // 1 — a declaration is live.
    const mentions = mentionsInPackage(symbol);
    if (mentions < 2)
      fail('capacity-read', `${symbol} is named once under nar/src — declared and never read`);

    // 2 — a bound is a finite positive number.
    const capacity = await resolveCapacity(contract.capacity);
    if (typeof capacity === 'string') fail('capacity-numeric', capacity);
    else if (!Number.isFinite(capacity) || capacity <= 0)
      fail('capacity-numeric', `${symbol} is ${capacity}, which is not a bound`);
  }

  // 5 — TODO28's ledger is covered by the stronger inventory.
  for (const site of ACCUMULATOR_LEDGER) {
    const covered = RESOURCE_CONTRACTS.some(
      (contract) => contract.owner === site.file || contract.capacity.module === site.file
    );
    if (!covered)
      violations.push({
        id: site.file,
        rule: 'ledger-covered',
        detail: 'on TODO28’s accumulator ledger but claimed by no resource contract',
      });
  }

  return violations;
};
