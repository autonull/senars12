# E2E Pipeline (M1)

`tests/nar/e2e/07-full-pipeline.test.ts` exercises NL → PerceptionGate → NAL → QueryAPI → NL
in one run, with LM-optional and budget-in-bounds assertions. The gate `e2e:pipeline`
(`scripts/lib/gates.ts`, `ci.yml`) also runs `08-metta-tool`, `13-delegation`, and
`examples/hello-world.ts`.

## Variants

| Variant | What it proves | Gate behavior |
|---------|----------------|---------------|
| **A** — LM off | Byte-identical symbolic path with no LM credentials (`lmProvider: 'none'`, System One off). Every cognitive function has a symbolic path; none depends on LM availability. | Always runs (CI default). |
| **B** — LM fills KB gaps | With `lmProvider: 'llamacpp-embedded'`, the LM formalizes a missing premise (`water --> wet`) that NAL then derives from; trace shows `lm-narsese-translation` → `LLM_PRIOR` (≤ 0.5 ceiling) → revision/deduction. | `skipIf` unless `LM_PROVIDER=llamacpp-embedded`. |
| **C** — System One heads adjudicate | With System One on, an ambiguous input (`The bank is closed.`) yields a clarification Question + curiosity drive, not a malformed belief. | `skipIf` unless `LM_PROVIDER=llamacpp-embedded`. |

## Verified status (2026-10-03)

- **Variant A**: green, always. No LM credentials required.
- **Variant B**: **fails** when run with `LM_PROVIDER=llamacpp-embedded` —
  `answer.answer` is `undefined`; the LM never produces a `lm-narsese-translation`
  premise that NAL can derive from. The trace-fingerprint assertion is therefore
  vacuous today.
- **Variant C**: **fails** under the same env — no clarification Question is
  injected for the ambiguous input; the ambiguity-head → clarification path is not
  wired on this ingress.

Both B and C are `skipIf`-gated in CI, so `e2e:pipeline` is green while the two LM /
System-One claims are **unasserted in practice**. The fix is real feature work on the
LM formalization path and the PerceptionGate ambiguity→clarification seam, not a test
adjustment. Until that lands, treat the README's "LM fills KB gaps" and "heads
adjudicate" claims as aspirational, not verified.

## Budget assertion

After each run, `ControlBudgets.getSpendSummary()` must show every scope within its
declared limit (TODO32 §5.8). Variant A asserts this; it is the cheap always-on
half of the pipeline contract.
