### RL Without NAL

The Judgment Manifold is a general decision API — proven by driving a reinforcement learner with it, NAL nowhere in the loop. `ManifoldRLAgent` (in `@senars/nar/rl`) issues one joint judgeBatch per decision — `reflex_value` (value) + `feasibility` (mask) + `risk` (floor) — and follows an ε-greedy or UCB policy over manifold scores; only `EmbeddingCache`, `JudgmentManifold`, and `JudgmentDataset` are involved. `scripts/rl-manifold.ts` runs the full demo (`systemOne.rl` config: `policy`, `epsilon`, `ucbC`, `feasibilityMask`, `riskFloor`, `labelOutcomes`).
