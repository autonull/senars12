# Pure MeTTa Alternatives

This directory contains **pure MeTTa** implementations of NAL functions and algorithms, designed for **benchmarking**
and **educational purposes**.

## Purpose

Compare performance characteristics between:

1. **Grounded Operations** (JavaScript-backed): Fast, using native JS math
2. **Pure MeTTa** (reduction-only): Slower, but demonstrates MeTTa's computational model

## Files

### truth-pure.metta

Pure MeTTa implementations of all NAL truth functions without using grounded operations (`&*`, `&/`, `&+`, `&-`).

**Example:**

```metta
; Grounded (fast)
(truth-ded (0.9 0.8) (0.7 0.6))  ; => (0.63 0.504)

; Pure MeTTa (slow, educational)
(truth-ded-pure (0.9 0.8) (0.7 0.6))  ; => (0.63 0.504)
```

**Use cases:**

- Understanding MeTTa's reduction semantics
- Teaching NAL logic without JavaScript dependency
- Verifying grounded implementations
- Self-hosting experiments (MeTTa interpreting itself)

### search-pure.metta

Pure MeTTa search algorithms (DFS, BFS, A*) using only list manipulation primitives defined in MeTTa.

**Example:**

```metta
; Define graph
(edge A B)
(edge B C)
(edge A D)
(edge D C)

; Pure DFS
(dfs-pure A C)  ; => (: A (: B (: C ())))
```

**Use cases:**

- Demonstrating graph traversal in pure functional style
- Teaching search algorithms in MeTTa
- Benchmarking list operation overhead

## Performance Expectations

**Truth Functions:**

- Grounded: ~0.001ms per operation
- Pure MeTTa: ~0.1-1ms per operation (100-1000x slower)

**Search Algorithms:**

- Grounded: ~0.01ms per node
- Pure MeTTa: ~1-10ms per node (100-1000x slower)

## When to Use

### Use Grounded (Default)

- Production reasoning
- Real-time inference
- Large-scale computations

### Use Pure MeTTa

- MeTTa tutorial/documentation
- Self-metaprogramming experiments
- Verifying grounded correctness
- Educational demonstrations
- Self-hosting research

## Implementation Notes

### Arithmetic Primitives

Pure implementations use recursive addition/multiplication:

```metta
(= (add 0 $y) $y)
(= (add $x $y)
   (add (sub $x 1) (add $y 1)))
```

This is **intentionally inefficient** to demonstrate pure reduction.

### List Operations

All list operations (append, reverse, member) are recursive:

```metta
(= (append (:) $list2) $list2)
(= (append (: $head $tail) $list2)
   (: $head (append $tail $list2)))
```

Production code should use grounded `&append`, `&member`, etc.

## Benchmarking

To compare performance:

```javascript
import {MeTTaInterpreter} from './metta/src/MeTTaInterpreter.js';

const interp = new MeTTaInterpreter();
interp.load(fs.readFileSync('./metta/src/nal/stdlib/truth.metta', 'utf-8'));
interp.load(fs.readFileSync('./metta/src/nal/alt/truth-pure.metta', 'utf-8'));

console.time('grounded');
for (let i = 0; i < 1000; i++) {
    interp.run('(truth-ded (0.9 0.8) (0.7 0.6))');
}
console.timeEnd('grounded');

console.time('pure');
for (let i = 0; i < 1000; i++) {
    interp.run('(truth-ded-pure (0.9 0.8) (0.7 0.6))');
}
console.timeEnd('pure');
```

## Future Work

- **Tail-call optimization** for pure recursive functions
- **Memoization** for repeated pure computations
- **JIT compilation** for hot pure MeTTa code paths
- **Self-hosted interpreter** written entirely in MeTTa
