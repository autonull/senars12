# ADR 0005: Property-Based Testing Expansion

## Status
Accepted

## Context
The codebase had 6 property test files covering:
- Term invariants (idempotent normalization, conjunction order, factory sharing)
- Truth algebra laws (revision, deduction, expectation)
- Narsese round-trip (serialization, grammar alignment)
- Cognitive parameters bounds
- Game spec contracts
- Truth invariants

Core data structures (Memory, Concept) lacked property-based tests despite being critical for correctness.

## Decision
Expand property-based testing with `fast-check` for:
- Concept priority management (clamping, decay, boost, cap composition)
- Concept task management (totalTasks, bag access, matching)
- Concept merging (idempotent, reflexive-false, truth revision)
- Memory operations (idempotent addConcept, getConcept, addTask, topConcepts ordering, consolidate, removeConcept)

New file: `tests/nar/property/memory-concept.test.ts` (18 property tests)

## Consequences

### Positive
- Discovers edge cases unit tests miss
- Documents invariants as executable specifications
- High confidence in core data structure correctness
- 403 test files, 3779 tests passing

### Negative
- Longer test execution time (~20s for property tests)
- Requires fast-check expertise
- Flaky tests possible if invariants are wrong

## References
- TODO.core.28.md W28: Property-Based Test Expansion
- `tests/nar/property/memory-concept.test.ts`
- Existing: `tests/nar/property/*.test.ts`