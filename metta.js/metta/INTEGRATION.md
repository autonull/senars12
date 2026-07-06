# Core-MeTTa Integration Guide

This guide explains how to use the newly integrated Core and MeTTa components.

## Quick Start

### Basic MeTTa (General Purpose)

```javascript
import {MeTTaInterpreter} from './metta/src/MeTTaInterpreter.js';

const interp = new MeTTaInterpreter();
// General stdlib auto-loaded: core, list, match, types

interp.run('(+ 1 2)');  // => 3
interp.run('(map (lambda ($x) (* $x 2)) (: 1 (: 2 (: 3 ()))))');
```

### MeTTa with NAL Reasoning

```javascript
import {MeTTaInterpreter} from './metta/src/MeTTaInterpreter.js';
import {loadNALStdlib} from './metta/src/nal/index.js';

const interp = new MeTTaInterpreter();

// Load NAL capabilities
loadNALStdlib(interp);
// Now has: truth, nal, budget, control, search, attention, learn

// Use NAL truth functions
interp.run('(truth-ded (0.9 0.8) (0.7 0.6))');  // => (0.63 0.504)
interp.run('(truth-rev (0.9 0.7) (0.8 0.6))');  // => (~0.85 ~1.0)

// Use NAL inference rules
interp.run(`
  (Inh cat animal (0.9 0.9))
  (Inh animal living (0.95 0.9))
  !(deduce (Inh cat animal (0.9 0.9)) (Inh animal living (0.95 0.9)))
`);
```

### Using Strategies

```javascript
import {PrologStrategy, MeTTaStrategy} from './metta/src/nal/index.js';
import {MeTTaInterpreter} from './metta/src/MeTTaInterpreter.js';

// Prolog-style backward chaining
const prolog = new PrologStrategy();
prolog.addPrologRule('ancestor(X,Y) :- parent(X,Y).');
prolog.addPrologRule('ancestor(X,Z) :- parent(X,Y), ancestor(Y,Z).');

// MeTTa-based reasoning
const interp = new MeTTaInterpreter();
const mettaStrat = new MeTTaStrategy(interp);
```

### Self-Metaprogramming

```javascript
import {MeTTaInterpreter} from './metta/src/MeTTaInterpreter.js';

const interp = new MeTTaInterpreter();

// Add rules dynamically
interp.run('(&add-rule (fib 0) 0)');
interp.run('(&add-rule (fib 1) 1)');
interp.run('(&add-rule (fib $n) (+ (fib (- $n 1)) (fib (- $n 2))))');

// Use immediately
interp.run('!(fib 10)');  // => 55

// Introspect
interp.run('(&rule-count)');  // => number of rules
interp.run('(&get-rules-for (fib $x))');  // => list of fib rules
```

### Pure MeTTa Benchmarking

```javascript
import {MeTTaInterpreter} from './metta/src/MeTTaInterpreter.js';
import {readFileSync} from 'fs';

const interp = new MeTTaInterpreter();

// Load both grounded and pure implementations
interp.load(readFileSync('./metta/src/nal/stdlib/truth.metta', 'utf-8'));
interp.load(readFileSync('./metta/src/nal/alt/truth-pure.metta', 'utf-8'));

// Benchmark grounded (fast)
console.time('grounded');
for (let i = 0; i < 1000; i++) {
    interp.run('(truth-ded (0.9 0.8) (0.7 0.6))');
}
console.timeEnd('grounded');  // ~1-2ms

// Benchmark pure MeTTa (slow but educational)
console.time('pure');
for (let i = 0; i < 100; i++) {
    interp.run('(truth-ded-pure (0.9 0.8) (0.7 0.6))');
}
console.timeEnd('pure');  // ~10-50ms
```

## Architecture Overview

### Directory Structure

```
core/
├── src/
│   ├── term/
│   │   └── UnifyCore.js          # Shared unification algorithm
│   └── reason/
│       └── strategy/
│           └── PrologStrategy.js  # Backward chaining (re-exported from metta/src/nal/)

metta/
├── src/
│   ├── kernel/                    # MeTTa core
│   │   ├── Term.js
│   │   ├── Space.js
│   │   ├── Unify.js               # Uses UnifyCore
│   │   ├── Reduce.js
│   │   └── Ground.js              # Grounded operations + metaprogramming
│   ├── stdlib/                    # General MeTTa
│   │   ├── core.metta
│   │   ├── list.metta
│   │   ├── match.metta
│   │   └── types.metta
│   └── nal/                       # NAL-specific
│       ├── stdlib/
│       │   ├── truth.metta        # NAL truth functions
│       │   ├── nal.metta          # NAL inference rules
│       │   ├── budget.metta       # Budget heuristics
│       │   ├── control.metta      # Control strategies
│       │   ├── search.metta       # Search algorithms
│       │   ├── attention.metta    # Attention mechanisms
│       │   └── learn.metta        # Learning rules
│       ├── alt/
│       │   ├── truth-pure.metta   # Pure MeTTa truth functions
│       │   ├── search-pure.metta  # Pure MeTTa search
│       │   └── README.md
│       ├── PrologStrategy.js      # Re-export
│       ├── MeTTaStrategy.js       # MeTTa-based reasoning
│       ├── NALStdlibLoader.js
│       └── index.js
```

### Component Responsibilities

| Component             | Purpose                    | Dependencies             |
|-----------------------|----------------------------|--------------------------|
| **core/**             | Pure NARS implementation   | None (standalone)        |
| **metta/src/kernel/** | MeTTa evaluation engine    | Uses UnifyCore from core |
| **metta/src/stdlib/** | General MeTTa functions    | Kernel only              |
| **metta/src/nal/**    | NAL reasoning capabilities | Kernel + stdlib          |

### Design Principles

1. **core/ is Pure**: No MeTTa dependencies, can be used standalone
2. **Opt-in NAL**: Load NAL stdlib only when needed
3. **Shared Unification**: Both systems use identical UnifyCore algorithm
4. **Metaprogramming**: Programs can modify their own rules at runtime
5. **Performance Choice**: Grounded ops (fast) vs pure MeTTa (educational)

## API Reference

### MeTTaInterpreter

```javascript
const interp = new MeTTaInterpreter(options);

// Execute code
interp.run(code);         // Parse, load, and evaluate
interp.load(code);        // Parse and load into space (no evaluation)
interp.evaluate(atom);    // Evaluate single atom
interp.step(atom);        // Single reduction step

// Query
interp.query(pattern, template);

// Stats
interp.getStats();
```

### NAL Stdlib Loader

```javascript
import {loadNALStdlib, NALStdlibLoader} from './metta/src/nal/index.js';

// Simple
loadNALStdlib(interpreter);

// Advanced
const loader = new NALStdlibLoader(interpreter, {
    modules: ['truth', 'nal', 'budget'],  // Selective loading
    nalStdlibDir: './custom/path/'        // Custom directory
});
loader.load();
```

### Metaprogramming Operations

```metta
; Add rule
(&add-rule pattern result)           ; => 'ok'

; Remove rule
(&remove-rule pattern)                ; => 'ok' or 'not-found'

; Query rules
(&get-rules-for pattern)              ; => list of matching rules

; List all
(&list-all-rules)                     ; => list of all rules

; Count
(&rule-count)                         ; => number
```

## Examples

### NAL Inference Chain

```metta
; Define knowledge
(Inh Tweety Bird (0.9 0.9))
(Inh Bird Animal (0.95 0.8))
(Inh Animal LivingThing (0.99 0.9))

; Chain inference
!(deduce (Inh Tweety Bird (0.9 0.9)) (Inh Bird Animal (0.95 0.8)))
; => (Inh Tweety Animal (truth-ded (0.9 0.9) (0.95 0.8)))
```

### Self-Modifying Program

```metta
; Learning rule
(= (learn-fact $fact)
   (&add-rule $fact $fact))

; Use it
(learn-fact (likes Alice Chess))
!(likes Alice Chess)  ; => (likes Alice Chess)
```

### Budget-Based Selection

```metta
; Assign budgets to premises
(premise P1 (0.8 0.6 0.7))  ; (priority durability quality)
(premise P2 (0.5 0.9 0.6))

; Select using OR (max priority)
!(budget-or (0.8 0.6 0.7) (0.5 0.9 0.6))
; => (0.8 0.9 0.7)
```

## Testing

```bash
# Run all tests
npm test

# Kernel tests
npm test tests/unit/metta/kernel/

# MeTTa core
npm test tests/unit/metta/metta-core.test.js

# Integration
npm test tests/integration/metta/
```

## Performance Tips

1. **Use Grounded Ops**: Default truth functions use fast JS math
2. **Lazy Evaluation**: Ground operations marked `lazy` avoid premature evaluation
3. **Memoization**: Interpreter caches reduction results (default 1000 entries)
4. **Selective Loading**: Load only needed NAL modules

## Troubleshooting

### "Module not found" errors

- Ensure you're importing from correct paths
- Check if NAL stdlib was loaded: `loadNALStdlib(interp)`

### Slow performance with pure MeTTa

- This is expected! Pure implementations are 100-1000x slower
- Use grounded operations for production
- Pure MeTTa is for education/benchmarking only

### Rules not found

- Check rule loading: `interp.run('(&rule-count)')`
- Verify pattern matches: `interp.run('(&get-rules-for pattern)')`

### Type errors

- MeTTa is dynamically typed
- Type checking is optional via `&type-check`
