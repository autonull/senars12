# NAR End-to-End Test Suite Design

This document describes the comprehensive end-to-end testing strategy for the NAR cognitive reasoning system.

## Test Organization

The e2e tests are organized into modular, focused test files:

### ✅ 01-term-system.test.ts (IMPLEMENTED)
**Purpose**: Validate term creation, canonicalization, and structural sharing

**Coverage**:
- Canonical term creation with structural sharing
- Conjunction normalization
- Truth value consistency
- Compound term creation (inheritance, conjunction, disjunction, implication)

**Status**: ✅ Passing

### 📋 02-inference-rules.test.ts (DESIGN)
**Purpose**: Test NAL inference rules (deduction, induction, abduction)

**Coverage**:
- Deduction: (A --> B), (B --> C) |- (A --> C)
- Multi-step deduction chains
- Similarity reasoning
- Conflicting belief management
- Compound terms in reasoning

**Design Rationale**: Decomposed from epic test to isolate inference rule testing

### 📋 03-memory-operations.test.ts (DESIGN)
**Purpose**: Test memory management, concept formation, and budget propagation

**Coverage**:
- Concept creation and retrieval
- Activation and decay over cycles
- Consolidation and forgetting
- Budget management and prioritization
- High-volume concept handling

**Design Rationale**: Isolates memory system testing from reasoning

### 📋 04-aikr-compliance.test.ts (DESIGN)
**Purpose**: Validate AIKR compliance (Anytime, Bounded, Knowledge-grounded, Resource-aware)

**Coverage**:
- Anytime: Interruptible execution
- Bounded: Memory and derivation limits
- Knowledge-grounded: Uses existing beliefs
- Resource-aware: Throttling and yielding
- Complete reasoning cycles
- Emergent reasoning behavior

**Design Rationale**: Tests system-level cognitive properties

### 📋 05-events-errors.test.ts (DESIGN)
**Purpose**: Test event system and error handling

**Coverage**:
- Event emission and subscription
- Multiple event listeners
- Error recovery
- High-volume input handling
- Concurrent operations

**Design Rationale**: Isolates infrastructure testing

## Implementation Strategy

### Phase 1: Foundation Tests ✅
- [x] Term system tests (01-term-system.test.ts)
- Validates core term operations
- Ensures structural sharing works correctly

### Phase 2: Inference Tests (PENDING)
- [ ] Implement 02-inference-rules.test.ts
- Test each NAL rule independently
- Verify truth value propagation

### Phase 3: Memory Tests (PENDING)
- [ ] Implement 03-memory-operations.test.ts
- Test concept lifecycle
- Verify budget management

### Phase 4: System Properties (PENDING)
- [ ] Implement 04-aikr-compliance.test.ts
- Validate AIKR properties
- Test complete reasoning cycles

### Phase 5: Infrastructure (PENDING)
- [ ] Implement 05-events-errors.test.ts
- Test event system
- Verify error handling

## Running Tests

```bash
# Run all e2e tests
pnpm run test:unit -- e2e

# Run specific test suite
pnpm run test:unit -- 01-term-system
pnpm run test:unit -- 02-inference-rules
pnpm run test:unit -- 03-memory-operations
pnpm run test:unit -- 04-aikr-compliance
pnpm run test:unit -- 05-events-errors
```

## Test Design Principles

1. **Isolation**: Each test file focuses on one aspect
2. **Independence**: Tests can run in any order
3. **Repeatability**: Tests are deterministic
4. **Fast Execution**: Individual tests complete quickly
5. **Comprehensive Coverage**: All critical paths tested

## Integration with senars11 Approach

Following the senars11 pattern of comprehensive e2e testing:
- Full pipeline testing (input → reasoning → output)
- Capability validation
- Resource management verification
- Event-driven architecture testing

## Next Steps

1. Implement remaining test files (02-05)
2. Add performance benchmarks
3. Add stress tests for high-volume scenarios
4. Add integration tests with LM rules
5. Create test fixtures for common reasoning patterns
