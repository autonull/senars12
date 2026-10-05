### Source Quality & Grounding

The single source-quality table is `SOURCE_QUALITY_CONFIDENCE` (`@senars/core/schemas/truth`), consumed by the PerceptionGate and System One seeding (`seedTruth`):

| Source Type | Quality | Truth Confidence |
|-------------|---------|------------------|
| Official/SEC/PubMed | PRIMARY | 0.9 |
| Major news (Reuters, AP) | SECONDARY | 0.7 |
| Wikipedia/News | GENERAL | 0.55 |
| Blog/Forum | TERTIARY | 0.4 |
| LLM Prior | LLM_PRIOR | 0.5 |

**Source reputation** (`nar/src/kernel/source-reputation.ts`, REFACTOR.todo1 Phase E) lowers this ceiling per source key: a contradiction-dominated track record (egress-gate rejections, `.react` corrections, peer shadow-validation failures) clamps `effectiveCeiling = baseQuality × multiplier` (floor 0.5, neutral 1.0 by default). Trust-not-truth: the multiplier adjusts the *ceiling* only — it never writes a Truth value. Persisted append-only at `.cache/parameters/source-reputation.jsonl`; surfaced in `.status` and retrospectives.
