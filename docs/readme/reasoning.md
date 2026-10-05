### Reasoning

```typescript
import { NAR, createNAR } from '@senars/nar';

const nar = createNAR({
  maxConcepts: 10000,
  maxTasksPerConcept: 100,
  enableTools: true,
  enableSelf: true,
  enableRLFP: true,
  persistState: true,
  statePath: '.cache/nar-state',
});

await nar.start();

// Input beliefs, goals, questions
await nar.believe('(cat --> animal). %1.0;0.9%');
await nar.goal('(whiskers --> cat)!');
await nar.question('(whiskers --> ?what)?');

// Run inference cycles
const derivations = await nar.run(10);

// Query results
const beliefs = nar.getBeliefs();
const answer = nar.ask('(whiskers --> animal)');
```

**Execution Modes:**
- `run(steps)` — Synchronous batch execution
- `runStream(steps)` — Async generator for incremental results
- Configurable derivation strategies: `BagStrategy`, `ExhaustiveStrategy`, `SampledDerivation`, `FocusedDerivation`, `AnytimeDerivation`
