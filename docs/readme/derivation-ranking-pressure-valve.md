### Derivation Ranking (Pressure Valve)

```typescript
import { rankDerivations } from '@senars/nar/rules/ranking';

const admitted = rankDerivations(ruleProcessorOutput, {
  maxAdmissions: 100,  // default
  minScore: 0          // default
});
// score = confidence × |f−0.5|×2 − min(0.3, termLength/2000)
// tautologies (f≈0.5) score ≤0 and are dropped automatically
```

- `score = confidence × decisiveness − sizePenalty` where `decisiveness = |f−0.5|×2`
- Caps admissions per cycle; configurable via `CognitiveParameters.inference.ranking` and exposed as optimizer/self-game knobs (`rankingMaxAdmissions`, `rankingMinScore`)
