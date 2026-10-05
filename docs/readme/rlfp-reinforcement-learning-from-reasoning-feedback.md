## RLFP — Reinforcement Learning from Reasoning Feedback

Where the agent above learns from *external environments*, RLFP turns SeNARS's reward machinery inward, learning from the *reasoning process itself*: trajectories, human preference pairs, and derivation outcomes.

```typescript
import { RLFPLearner, PreferenceCollector, RewardModel, PolicyOptimizer } from '@senars/nar/rlfp';

const rlfp = nar.getRLFP();
// Logs reasoning trajectories
// Collects human preferences on derivations
// Trains reward model on preference pairs
// Optimizes policy via RL (PPO/GRPO)
```

### The Three Applications of the Reward Economy

One substrate — `Bag<T>`, `Focus`, `Game`, `Reflex`, `RewardGate` — powers three distinct, deliberately separated applications:

| Application | Reward Source | Acts On | Failure Containment |
|-------------|---------------|---------|---------------------|
| **General-Purpose RL Agent** | External environments (`Game.step`) | Reflex policies, focus weights | NAL Negotiator veto; kernel gates |
| **RLFP** | Human preferences & derivation outcomes | Attention priorities, policy weights | `RewardGate` epistemic firewall |
| **Autonomous Self-Improvement** | Task outcomes (extrinsic + intrinsic) | `SelfImprovementProposal`s only | Governance pipeline; human approval for high risk |
