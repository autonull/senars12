## MeTTa — Exact Computation Substrate

MeTTa operates as a deterministic, exact-computation tool invoked through the ActionGate, complementing NAL's uncertain reasoning. It does **not** run as a parallel cognitive engine, but rather provides equality saturation, pattern matching, and dependent type theory on demand.

```typescript
import { createMeTTa, parseMeTTa, EGraph, MeTTaRuntime } from '@senars/metta';

const runtime = createMeTTa();

// Define rewrite rules
await runtime.evaluate(parseMeTTa(`
  (= (add $x 0) $x)
  (= (add $x (succ $y)) (succ (add $x $y)))
`));

// Query with pattern matching
const result = await runtime.evaluate(parseMeTTa('(add (succ 0) (succ (succ 0)))'));
// → (succ (succ (succ 0)))

// Multi-space reasoning
const space1 = runtime.createSpace();
const space2 = runtime.createSpace();
// Each space has independent facts, can be merged/queried

// E-graph for equality saturation
const egraph = new EGraph();
egraph.addExpr(parseMeTTa('(add a b)'));
egraph.addExpr(parseMeTTa('(add b a)'));
egraph.union(parseMeTTa('a'), parseMeTTa('b'));
// Now (add a b) ≡ (add b a) ≡ (add a a)
```

**MeTTa Capabilities:**

| Feature | Description |
|---------|-------------|
| **E-Graphs** | Equality saturation for algebraic simplification, program optimization |
| **Pattern Matching** | Structural matching with variables, guards, and multi-match |
| **Rewrite Rules** | User-defined ` (= lhs rhs )` rules with conditional guards |
| **Multi-Space** | Independent fact spaces (contexts) with merge/fork/clone |
| **Skill Execution** | MeTTa programs as callable skills from NAR/agent |
| **Dependent Types** | Full type theory with Π/Σ types, type inference, unification |
| **JIT Compiler** | Hot path compilation to native code via Effect JIT |
| **Parallel Execution** | `parallelReduce`, `parallelMap` for batch operations |
| **Persistent Spaces** | Serializable spaces with incremental persistence |
| **IPC/Shared Memory** | Cross-process space sharing via shared memory queues |

**Integration with Agent:**

`createAgent` wires the `metta` builtin tool automatically; no engine registration or `metta:` command routing exists.

```typescript
import { createAgent } from '@senars/nar/agent';

const agent = await createAgent({ /* config */ });
// NAR input: (cat --> animal).
// MeTTa (via the ActionGate tool): tools.execute('metta', { program: '(add 1 2)' })
```

**Engine Isolation (Arbiter Pattern):**
- NAR and MeTTa must not share memory directly. They must emit `EngineResult` proposals to the Kernel.
- The boundary between MeTTa's exact `definitional-equality` and NAR's `uncertain-equivalence` is enforced. The e-graph must *never* union nodes based on NAR similarity scores.
