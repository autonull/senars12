### Truth Value Algebra

Non-Axiomatic Logic truth values with **frequency** (f) and **confidence** (c):

```typescript
import { Truth } from '@senars/nar';

const truth = Truth.create(0.8, 0.9);  // f=0.8, c=0.9
const revised = Truth.revision(truth1, truth2);  // Belief revision
const projected = Truth.deduction(truth1, truth2); // Inference
```

**Operations:** `revision`, `deduction`, `induction`, `abduction`, `comparison`, `negation`, `expectation`
