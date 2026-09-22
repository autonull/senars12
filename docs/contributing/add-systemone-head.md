# Adding a System One Judgment Head

System One heads are lightweight, embedding-driven judgment surfaces (classify
or evaluate) consulted by the manifold, ingress judge, and dispatcher. The
ontology is declared **exactly once**, in `HEAD_SPECS`
(`nar/src/lm/system-one/head-specs.ts`) — "the ONLY place head
spaces/levels/instructions are written down" (G1/Bench 25).

## The spec

```ts
export interface HeadSpec {
  readonly rubric: RubricId;          // unique key; also the scorer lookup key
  readonly axis: CognitiveAxis;       // 'epistemic' | 'teleological' | ...
  readonly kind: 'classify' | 'evaluate';
  readonly space?: readonly string[]; // classify: the option space
  readonly levels?: readonly string[];// evaluate: ordered legend (e.g. ['none', ... 'critical'])
  readonly instruction: string;
  readonly criticality?: CriticalityLevel;
  readonly group: 'ingress' | 'action' | 'synthesis' | 'memory';
}
```

## How a spec becomes a head

`createHead(spec, options)` (also in `head-specs.ts`) wires:

1. **Scorer** — `getScorer(rubric)` from `nar/src/lm/system-one/scoring.ts`
   (deterministic embedding-hash scorer keyed by rubric).
2. **Calibrator** — `createIsotonicCalibrator(calibrationVersion, rubric)`
   from `./calibration.js`.
3. **Abstention** — scores below `abstainThreshold` return
   `{ abstained: true, abstainReason: 'low-confidence' }`; disabled heads or
   classify queries with an empty space abstain with `'out-of-domain'`.
4. **Output shape** — classify heads return a `distribution` over `space`;
   evaluate heads return a triangular-kernel `legend` over the ordered
   `levels`.

`nar/src/nar/system-one.ts` (`SystemOneRuntime`) builds the heads per group at
startup via the factory (`nar/src/lm/system-one/heads/factory.ts`), honoring
per-head overrides (`calibrationVersion`, `abstainThreshold`, `enabled`) from
config; `head-specs.ts` is the consumer that instantiates them.

## Example — add a `sarcasm` evaluate head

In `nar/src/lm/system-one/head-specs.ts`, add one entry to `HEAD_SPECS`:

```ts
sarcasm: {
  rubric: 'sarcasm',
  axis: 'epistemic',
  kind: 'evaluate',
  levels: ['literal', 'ambiguous', 'sarcastic'],
  instruction: 'Evaluate sarcastic intent',
  group: 'synthesis',
},
```

Because `HEAD_SPECS` is `as const satisfies Record<string, HeadSpec>`, type
errors surface immediately if the spec is malformed. `HeadId` (the keyof
union), group filtering (`createHeadsForGroup`), and the query builders
(`specToQuery`, `groupQueries`, `ingressQueries`, `actionQueries`) pick it up
automatically — no other registration site exists, by design.

If the head needs a non-default scoring flavor, register/adjust its scorer in
`scoring.ts` (scorers are looked up by rubric id via `getScorer`). Calibration
data is fitted offline (`calibration-fit.ts`, `train.ts`) and addressed by
`calibrationVersion`.

## Runtime notes

- Heads only exist when System One is enabled
  (`SystemOneRuntime.enabled`, gated on `config.systemOne.enabled`).
- `JudgmentHead.evaluate(embedding, query)` is async and must never throw —
  return an abstained result on out-of-domain input.
- Embeddings come from `EmbeddingCache` (`nar/src/lm/system-one/embedding-cache.ts`).

## Checklist

- [ ] Spec added to `HEAD_SPECS` only (single source of truth)
- [ ] `rubric` unique; `space` (classify) or ordered `levels` (evaluate) set
- [ ] `group` reflects where queries run (ingress / action / synthesis / memory)
- [ ] Scorer behavior defined for the rubric (default hash scorer is fine)
- [ ] Abstention semantics understood (`abstainThreshold`, `'low-confidence'`)

## Tests to write

Follow `tests/nar/todo16c-head-specs.test.ts` and
`tests/nar/todo16-systemone-knobs.test.ts` conventions:

- Spec integrity: every `HEAD_SPECS` entry satisfies `HeadSpec`; classify
  specs have non-empty `space`, evaluate specs have ≥ 2 `levels`.
- Head behavior: `createHeadById('sarcasm', options)` abstains below the
  threshold and returns a well-formed `legend` above it.
- Group wiring: the head appears in `groupQueries('<group>')` output.