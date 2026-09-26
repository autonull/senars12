# ADR-008: JudgmentPipeline as Manifold Evaluation Entry

## Status
Accepted

## Context
The JudgmentPipeline (`nar/src/lm/system-one/judgment-pipeline.ts`) composes over HEAD_SPECS (ordered heads + bands + calibrators + router + cascade) to provide a comprehensive evaluation pipeline. It was built in TODO5 but never wired as a production consumer.

REFACTOR.todo6 Phase E requires wiring the JudgmentPipeline as a manifold evaluation entry or recording an explicit HOLD with rationale.

## Decision
Wire the JudgmentPipeline as an additional evaluation entry point in SystemOneRuntime, alongside the existing Tier-1 manifold. The JudgmentPipeline provides:
- Full pipeline composition over all HEAD_SPECS groups (ingress, action, synthesis, memory)
- Configurable routing (confidence, cascade, consensus)
- ModelDigest for auditability (encoderDigest + headWeightsDigest + specHash)
- Per-stage results with decision bands

The existing manifold (JudgmentManifold) remains the primary Tier-1 judgment path for the dispatcher and reflexes. The JudgmentPipeline is exposed as a secondary, more comprehensive evaluation entry for:
- Batch evaluation of multiple rubrics
- Audit trails requiring full pipeline provenance
- Experimental head configurations without affecting the primary manifold

## Consequences
- Positive: JudgmentPipeline now has a production consumer (SystemOneRuntime) and is falsifiable via bench
- Positive: ModelDigest enables reproducible evaluation verification
- Negative: Additional memory/compute for maintaining pipeline heads (mitigated: heads are shared with manifold via HEAD_SPECS)
- Negative: Two evaluation paths require clarity on which to use when (documented in SystemOneRuntime API)

## Alternatives Considered
1. **Replace manifold with JudgmentPipeline** — Rejected: manifold is optimized for single-batch tiered judgment; pipeline is for comprehensive multi-stage evaluation.
2. **HOLD (no wiring)** — Rejected: violates C24 (no orphan deliverables); JudgmentPipeline was a TODO5 deliverable with zero consumers.
3. **Wire only for specific use cases (e.g., distillation)** — Accepted as future work; current wiring exposes it generally for any consumer.

## Implementation
- `SystemOneRuntime.judgmentPipeline` instantiated in constructor when System One enabled
- `NAR.getSystemOneJudgmentPipeline()` accessor for external consumers
- Default pipeline spec uses `DEFAULT_PIPELINE_STAGES` matching HEAD_SPECS groups
- Heads are created from HEAD_SPECS with calibrators from pipeline spec

## Bench
Falsified by: `tests/nar/systemone-judgment-pipeline.test.ts` (to be added) verifying:
- Pipeline produces results for all four stage groups
- ModelDigest is stable across instantiations with same config
- Router produces decision bands per rubric
- Integration with SystemOneRuntime embedding cache