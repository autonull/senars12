### Cortex Ladder

| Tier | Engine | Role |
|------|--------|------|
| 1 | Judgment Manifold (local heads) | Judge everything, admit with calibrated truth |
| 2 | `LMServiceCortex` (GBNF-constrained LM) | Synthesize Narsese term candidates (`proposeAndJudge`) |
| 3 | Symbolic stub | Degrade gracefully on LM failure — never crash |

Tier-2 candidates are generated under the `narsese-term` GBNF grammar and re-judged by the manifold before admission.
