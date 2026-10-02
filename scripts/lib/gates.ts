/**
 * The gate list — one place, so a gate added in CI without a local entry point
 * cannot be the only place it runs.
 *
 * The docs-drift gate was in `ci.yml` and red for a whole pass of TODO28
 * without anyone noticing, because the way these get run by hand is
 * `typecheck && lint && test:unit` and the set of gates was ten separate
 * scripts plus one inline shell block. Same lesson as the layering gate and the
 * naming-convention bench: a check nobody runs on the way through is a comment.
 *
 * Two tiers, because the cost is not uniform. `gate` is what every change should
 * be able to pass; `slow` is what CI already runs in its own jobs, kept out of
 * the default so the command stays cheap enough to actually be used.
 */
export interface Gate {
  /** `pnpm` script name, or a synthetic name for a gate with no script of its own. */
  readonly name: string;
  /** argv to run from the repository root. */
  readonly command: readonly string[];
  readonly tier: 'gate' | 'slow';
}

const script = (name: string, tier: Gate['tier'] = 'gate'): Gate => ({
  name,
  command: ['pnpm', 'run', name],
  tier,
});

export const GATES: readonly Gate[] = [
  script('typecheck'),
  script('typecheck:bin'),
  script('typecheck:packages'),
  script('lint'),
  script('deps:gate'),
  script('deps:direction'),
  // TODO29.a A2: the cycle path names a ModelRule, a TextGenerator and an
  // EmbeddingRuntime — never the induction layer it was reaching into.
  script('core:no-lm'),
  // TODO29.a A0: every cycle-path await on a provider is declared with the bound
  // it actually has, and every declared bound is true.
  // TODO29.a A5: the cycle path reaches memory through its ports, not the facade.
  script('memory:ports'),
  // TODO29.a A4: attention has one write surface, the decay sweep has one
  // caller, and the two read paths contain no write.
  script('attention:write-surface'),
  // TODO29.a A3: the eight proposal decisions are written down, each names the
  // reason its rejection carries, and the two kinds are structurally distinct.
  script('proposal:protocol'),
  // TODO29.a A6: dispatch is a port, and every registered rule declares both of
  // its kinds — no wildcard bucket, no catch-all.
  script('dispatch:no-wildcard'),
  // TODO29.a A10: the rule set is loaded data — no module registers a rule by
  // importing one, no module-global rule set, and the table is versioned,
  // enumerable and revertable.
  script('rules:loaded-data'),
  // TODO29.a A7: every control budget is a declared scope with a named owner,
  // and every declared scope is spent somewhere.
  script('control-budgets'),
  // TODO29.a A9: a recorded proposal stream is a sufficient fixture — the
  // reduction is pure, the replay path reaches no provider, an incompatible
  // schema version fails loudly, and a stream recorded against R is stale at R+1.
  script('replay:proposal'),
  // TODO29.a A8: every resource that can grow has a declared owner, a bound the
  // owner actually reads, a retention rule, an overflow behaviour, and a pressure
  // signal or an explicit null.
  script('resource:policy'),
  script('cycle:no-provider'),
  // TODO29.a A0: the in-cycle induction inventory, and its references still hold.
  script('induction:inventory'),
  // TODO29.a A1: every model-backed rule declares a symbolic body, and it runs.
  script('rule:has-fallback'),
  // TODO29.a A1: one InferenceController, one cycle step call site.
  script('gates:one-cycle-path'),
  // TODO29.a A1: S / S+J / S+P / S+J+P are four complete systems.
  script('config:model-matrix'),
  // TODO29.a A12 step 1: the operator table, the grammar and the serialiser are
  // one surface form, and every kind survives the round trip.
  script('terms:canonical'),
  // TODO30 T2: a Bool atom cannot name a Task; the cascade makes it total.
  script('terms:no-bool-task'),
  // TODO30 U1: an answer is the asked term, a ground instance of it, or nothing —
  // never a neighbour that merely looks similar.
  script('answer:no-fabrication'),
  // TODO30 U2: relevance is a read path, and how much of a 133-belief store
  // actually bears on the question is a number rather than an opinion.
  script('relevance:measured'),
  // TODO30 T3: every narsese string literal parses and re-serialises to itself
  script('narsese:literals'),
  script('exports:audit'),
  script('exports:check'),
  script('exports:barrels'),
  script('complexity:budget'),
  // TODO32: the integration milestones, each its own gate so a red one names the
  // milestone rather than "tests failed". e2e:pipeline is M1/M3/M6/M7 and rides
  // the committed example, so the getting-started docs cannot drift from reality.
  script('e2e:pipeline'),
  // TODO32 M4: a second NAR on the same statePath reconstructs the same committed
  // state — snapshot plus event-log replay, at rest and under eviction pressure.
  script('persistence:replay'),
  // TODO32 M8: every answer carries a derivation that the standalone verifier
  // accepts. An unverifiable trace is omitted rather than shown.
  script('derivation:verifiable'),
  // TODO32 M5: reward moves a policy observable and never a Truth value.
  script('reward:policy-only'),
  // TODO32 M9: no contradictory or redundantly nested term reaches committed state.
  script('derivation:clean'),
  // Generated docs must match the committed output. A diff rather than a red
  // test, which is why it survived being red for a pass.
  script('docs:drift'),
  script('test:unit'),
  script('test:determinism', 'slow'),
  // Ambient entropy throws for the duration — TODO28 §7.3's hermetic seeded run.
  script('test:hermetic', 'slow'),
  script('test:load-sensitive', 'slow'),
];

/** The gate names a `pnpm` script in the root manifest is missing. */
export const missingGateScripts = (scripts: Record<string, string>): string[] =>
  GATES.filter((gate) => !(gate.name in scripts)).map((gate) => gate.name);
