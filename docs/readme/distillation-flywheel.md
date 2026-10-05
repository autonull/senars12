### Distillation Flywheel

```
play / reason ─▶ JudgmentDataset (hash-only JSONL + 384-d vector sidecar)
                  │  auto-flush · compact · no raw utterance text persisted
                  ▼
       train.ts (Brier loss, ridge/logistic heads) → digest-pinned weights
                  ▼
       calibration-fit.ts → isotonic calibrators + abstain thresholds → lock file
                  ▼
       bake-off parity gate → sandboxed runtime → governed head swap
```

Label sources include corrections, derivation outcomes, approvals, shadow verdicts, human clarification pairs, agent-trace grades (groundedness/risk per cycle), and **RL outcomes** — rewards from play flow into the same dataset. The loop closes end-to-end in the arcade: `pnpm run demo:arcade -- --distill` has the lm arm (teacher) record its decisions into `JudgmentDataset`, trains a `reflex_value` head after play, and the manifold arm (student, ~zero inference cost) picks it up on the next run — the distilled student matches its teacher's return and beats the heuristic baseline.
