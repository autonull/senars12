### Narsese Term Language

Full implementation of the Narsese grammar with type-safe construction:

```typescript
import { TermBuilder, atom, termParser, Truth } from '@senars/nar';

// Atomic terms
const cat = atom('cat');
const animal = atom('animal');

// Compound terms
const inheritance = TermBuilder.inheritance(cat, animal);  // (cat --> animal)
const implication = TermBuilder.implication(cat, animal);  // (cat ==> animal)
const conjunction = TermBuilder.conjunction(cat, animal);  // (cat & animal)

// Parse from string
const parsed = termParser.parse('(cat --> animal)');
```

**Every term has one canonical form, and every claim one spelling.** `TermBuilder`
canonicalises before it interns, so `(cat & (dog & bird))`, `(dog & cat)` and
`(cat & dog & bird)` are one term rather than three, and `termsEqual`, interning
and memory dedup agree by construction rather than by which producer remembered
to normalise. The rewrites are a registry — `TERM_REDUCERS` and `TASK_REDUCERS`,
in `nar/src/terms/reduce.ts` and `reduce-task.ts` — and `pnpm terms:canonical`
asserts that the registry reaches a fixed point, that every reducer declines every
canonical term, that the reducers commute, and that `(--x).f = 1 − f_x` holds
across the whole range with the stamp and confidence carried through. The
negation moves into the frequency and never the other way round, because three
registered rules key a premise on `term.kind === 'negation'` and the table's
hottest 21 key on `inheritance`; a canonical form that emptied either bucket would
silently disable rules rather than normalise terms. Adding a reducer is one entry
in a list plus a case in the gate — see the terms canonicalization spec (§5.12).

<details>
<summary><b>Term Types Supported</b></summary>

| Kind | Syntax | Description |
|------|--------|-------------|
| Atomic | `cat` | Basic concept |
| Variable | `?x`, `?y` | Unification variables |
| Inheritance | `(A --> B)` | Subclass/superclass |
| Similarity | `(A <-> B)` | Symmetric similarity |
| Implication | `(A ==> B)` | Conditional implication |
| Equivalence | `(A <=> B)` | Bidirectional equivalence |
| Conjunction | `(A & B & C)` | Logical AND |
| Disjunction | `(A \| B \| C)` | Logical OR |
| Negation | `(- A)` | Logical NOT |
| Sequence | `(A * B * C)` | Temporal sequence |
| Parallel | `(A \| B \| C)` | Parallel execution |

</details>
