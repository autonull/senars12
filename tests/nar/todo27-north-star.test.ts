import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TODO27 Bench 109 — the North Star as a test.
 *
 * §0: "a strategy slot names a strategy and its configuration; the registry
 * turns that pair into a validated, memoized instance, and nothing else in
 * the system constructs or selects a strategy." Phase I made the first clause
 * true and found six production paths where the second was false, all by
 * hand-reading. This asserts the second clause over the import graph, so the
 * next bypass fails a bench instead of waiting to be noticed.
 *
 * It is a source test, not a behavioural one — the invariant *is* a property
 * of the source, and the alternatives (mocks, a module interception layer)
 * would test a weaker statement.
 */

/**
 * The only files permitted to construct a strategy, each with the reason it is
 * not a bypass. Anything new here is a claim about the invariant, so it has to
 * be argued rather than appended.
 */
const CONSTRUCTION_SITES: Record<string, string> = {
  'cognitive/impls/registrations.ts': 'the catalogue — every built-in registration',
  'cognitive/impls/composition.ts': 'tier-2 composition, driven by a resolved spec',
  'reason/strategy-algebra.ts': 'the derivation expression algebra (D4)',
  'lm/dynamic-rule.ts': 'CompositeLMRule is an LM rule body, not an lm-rule selector',
  // The three below are not strategy *slots*. They are private samplers for
  // components that own their whole strategy stack and never consult the
  // cognitive registry — so there is no slot to declare them in, and the
  // instance is not a resolved built-in. §7.2 removed the one construction
  // that *was* a bypass (`registerRuleGraph`); these three are the remainder,
  // recorded rather than hidden.
  'learning/aikr-processor.ts': 'AIKR’s own default sampler — injected, never a registry slot',
  'learning/schema-induction.ts': 'schema induction’s own default sampler, as above',
  'lm/system-one/contrastive.ts': 'contrastive memory’s own default sampler, as above',
};

/**
 * The documented exception to the attention clause below (§15.5): a substrate
 * default that primes nothing is not a choice of model, and requiring one
 * would mean `Memory` cannot exist before a `CognitiveController` does.
 */
const SUBSTRATE_DEFAULTS = new Set(['NullAttentionModel']);

const ROOT = join(__dirname, '../../nar/src');

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });

const relative = (path: string): string => path.slice(ROOT.length + 1);

describe('Bench 109 — nothing outside the catalogue constructs a strategy', () => {
  const files = sources(ROOT).filter((path) => !relative(path).startsWith('strategies/'));

  it('finds the tree it is meant to be asserting about', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no module outside an allowed site calls `new *Strategy(` or `new Composite*(`', () => {
    const offenders = files
      .filter((path) => !CONSTRUCTION_SITES[relative(path)])
      .filter((path) => /new \w*(?:Strategy|Composite\w*)\(/.test(readFileSync(path, 'utf8')))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('no module outside the substrate imports an attention implementation', () => {
    // `NullAttentionModel` is the documented exception: a substrate default
    // that primes nothing is not a choice of model (§15.5 — a fallback here
    // would be the regression).
    const offenders = files
      .filter((path) => !CONSTRUCTION_SITES[relative(path)] && relative(path) !== 'memory/memory.ts')
      .filter((path) => /strategies\/attention\/(?!types)/.test(readFileSync(path, 'utf8')))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('every strategy implementation is constructed only at an allowed site', () => {
    // TODO28 §7.2: the regex above only caught names ending in `Strategy` or
    // `Composite*`, which is a naming convention, not the invariant. It missed
    // `registerRuleGraph` — a real built-in, registered by the controller
    // rather than the catalogue, for several phases. Derived from the
    // implementation names instead, so the next one is caught by construction
    // rather than by a reviewer noticing a missing suffix.
    const names = new Set<string>();
    for (const path of sources(join(ROOT, 'strategies'))) {
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/export class (\w+)/g)) {
        const name = match[1] ?? '';
        if (!SUBSTRATE_DEFAULTS.has(name)) names.add(name);
      }
    }
    expect(names.size).toBeGreaterThan(20);

    const offenders = files
      .filter((path) => !CONSTRUCTION_SITES[relative(path)])
      .filter((path) =>
        [...names].some((name) => new RegExp(`new ${name}\\(`).test(readFileSync(path, 'utf8')))
      )
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('every allowed construction site is still a live file', () => {
    expect(files.map(relative)).toEqual(expect.arrayContaining(Object.keys(CONSTRUCTION_SITES)));
  });
});
