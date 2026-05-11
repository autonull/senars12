# SeNARS12 Development Plan

**Last Updated:** 2026-05-11  
**Status:** Active Development

## Priority Legend
- **P0**: Critical — bugs, broken UX, correctness issues, hash instability
- **P1**: High — significant quality, coverage, or usability gaps
- **P2**: Medium — important improvements, less urgent
- **P3**: Low — nice-to-have, polish

---

## Phase 0: Critical Bug Fixes (P0)

### 0.1 Config loader silently ignores user config values
**Files:** `src/config/loader.ts:144-145`  
**Issue:** `priorityThreshold` and `activationDecayRate` are hardcoded constants, not read from config file.
```typescript
// BUG: First arg is the constant value, not the config value
priorityThreshold: this.clamp(0.1, 0, 1),      // Always 0.1
activationDecayRate: this.clamp(0.01, 0, 1),  // Always 0.01
```
**Fix:**
```typescript
priorityThreshold: this.clamp(raw.memory?.priorityThreshold ?? 0.1, 0, 1),
activationDecayRate: this.clamp(raw.memory?.activationDecayRate ?? 0.01, 0, 1),
```
**Impact:** User configuration is silently ignored.

### 0.2 Hash instability for `parallel` operator
**Files:** `src/nar/terms/hash.ts:23`, `src/nar/terms/operators.ts:25-29`  
**Issue:** `hash.ts` hardcodes `COMMUTATIVE_OPS` missing `parallel`, while `operators.ts` correctly derives it from `OPERATORS`. Terms with `parallel` operator will have order-dependent hashes.
**Fix:** Import `COMMUTATIVE_OPS` from `operators.ts` instead of hardcoding.
**Impact:** `parallel(A, B)` and `parallel(B, A)` produce different hashes, breaking term caching and matching.

### 0.3 RLFP passed as `undefined` to NARExecution
**File:** `src/nar/nar.ts:113`, `129-131`  
**Issue:** `NARExecution` is constructed with `this.rlfp` before `rlfp` is initialized.
**Fix:** Move `this.rlfp = new RLFPLearner({})` initialization above line 113.

### 0.4 `choice()` null-safety bug
**File:** `src/nar/terms/truth.ts:120-124`  
**Issue:** `!t1` treats `{f:0, c:0}` (valid falsy truth) as undefined. `!t2` followed by `t2!` non-null assertion can crash.
**Fix:** Replace `!t1` with `t1 === undefined`.

### 0.5 `pnpm run start` exits silently
**File:** `src/index.ts`, `src/app.ts`  
**Issue:** Entry point is a barrel export with no side effects.
**Fix:** Change `package.json` script to `tsx src/app.ts` or add demo output.

---

## Phase 1: Code Quality & Deduplication (P1)

### 1.1 Duplicate truth functions
**File:** `src/nar/terms/truth.ts:35-49` vs `94-118`  
**Issue:** Private `deductionBinary`, `inductionBinary`, `abductionBinary`, `revisionBinary` are exact duplicates of public `Truth.deduction`, `Truth.induction`, `Truth.abduction`, `Truth.revision`.
**Fix:** Remove private binaries, call public methods directly.

### 1.2 Duplicate NAL rules across `nal.ts` and `nal-extended.ts`
| Rule | nal.ts | nal-extended.ts | Status |
|------|--------|-----------------|--------|
| `exemplification` | 198-205 | 158-163 | Exact duplicate |
| `higherOrderDeduction` / `implicationDeduction` | 207-214 | 88-97 | Exact duplicate |
| `equivalenceIntro` / `equivalence` | 100-108 | 99-108 | Exact duplicate |
| `analogy` | 171-178 | 141-149 | Different inputs, same output pattern |
| `comparison` | 180-187 | 131-139 | Different semantics, same name |
**Fix:** Consolidate into single definitions, use aliases if needed.

### 1.3 Priority boost pattern repeated 3× in concept.ts
**File:** `src/nar/memory/concept.ts:95-97`, `287-290`, `298-301`
```typescript
this.useCount++;
this.lastAccessedAt = Date.now();
this._priority = Math.min(1, this._priority + 0.1);
```
**Fix:** Extract to private `recordAccess()` method.

### 1.4 REPL god class (846 lines, 14+ responsibilities)
**File:** `src/cli/repl.ts`  
**Responsibilities:** command dispatch, history, tab-completion, display rendering, multi-line input, profiling, file I/O, query/trace/explain, RLFP, LM, self/metacognition, constitution, attention, domain loading.
**Fix:** Extract into modules:
- `src/cli/commands/` — command handlers
- `src/cli/display.ts` — box-drawing, formatting
- `src/cli/history.ts` — persistence
- `src/cli/profile.ts` — profiling session

### 1.5 REPL type erosion via `as any` (14+ occurrences)
**File:** `src/cli/repl.ts:632-838`  
**Issue:** Every command casts `this.nar as any` to access `.self`, `.rlfp`, `.lmClient`, etc.
**Fix:** Add typed public getters on NAR: `getSelfAnalyzer()`, `getRLFP()`, `getLMClient()`.

### 1.6 NARFacade is pure pass-through (zero value-add)
**File:** `src/nar/nar-facade.ts`  
**Issue:** All 14 methods are `X(...args) { return dep.X(...args); }`.
**Fix:** Either remove facade and delegate directly on NAR, or make it aggregate (e.g., `getComprehensiveStats()`).

### 1.7 Guards.ts is redundant re-export barrel
**File:** `src/nar/terms/guards.ts`  
**Issue:** 21 of 24 exports are re-exports. Only `termHashKey`, `isCanonical`, `getCompoundArgs` are original.
**Fix:** Delete file, move originals to `accessors.ts`.

### 1.8 `deductionWeak` double-creates Truth
**File:** `src/nar/terms/truth.ts:96-98`  
**Issue:** `deductionBinary` returns Truth, then `deductionWeak` calls `createTruth` again on the returned values.
**Fix:** Remove redundant `createTruth` wrapper.

### 1.9 Expectation formula extracted 4×
**File:** `src/nar/terms/truth.ts:63`, `120-124`, `136-139`, `155-158`  
**Issue:** `exp = c * (f - 0.5) + 0.5` computed in `expectation()`, `choice()`, `isStronger()`, `compare()`.
**Fix:** Extract as private helper `computeExpectation(t: Truth)`.

### 1.10 TimerTool dead callback
**File:** `src/nar/tools/TimerTool.ts:79-91`  
**Issue:** `executeCallback` increments `config.count` but callback string is never invoked.
**Fix:** Either invoke callback via tool chaining or remove dead code.

### 1.11 CalculateTool uses `Function()` constructor (eval)
**File:** `src/nar/tools/CalculateTool.ts:27`  
**Issue:** Sanitizer `replace(/[^0-9+\-*/().\s]/g, '')` fails to block property access.
**Fix:** Use recursive descent math parser or `mathjs` library.

### 1.12 Tools access `Memory.concepts` via `as any`
**Files:** `src/nar/tools/SearchTool.ts:48`, `ExplainTool.ts:60`  
**Issue:** Both cast `(this.memory as any).concepts` to access private Map.
**Fix:** Add public `findConcepts(pattern: string, limit: number)` to Memory.

### 1.13 Hardcoded tool list out of sync
**File:** `src/cli/repl.ts:324-336`  
**Issue:** `showTools()` lists 5 tools, but 11 are registered in `nar.ts:419-429`.
**Fix:** Query `this.nar.listTools()` instead of hardcoding.

### 1.14 Clear/reset are identical
**File:** `src/cli/repl.ts:364-372`  
**Issue:** Both call `this.nar.clearMemory()`. Only console message differs.
**Fix:** Remove `.reset` or differentiate behavior.

### 1.15 `consolidationInterval` mapped to wrong field
**File:** `src/config/loader.ts:146`  
**Issue:** `raw.inference?.maxDerivationsPerStep` assigned to `core.consolidationInterval`.
**Fix:** Map to `raw.inference?.consolidationInterval` or remove field.

### 1.16 `lm.enabled` never set from file config
**File:** `src/config/loader.ts:137`  
**Issue:** Always defaults to `false` even if config file defines `lm` section.
**Fix:** Set `enabled: raw.lm?.enabled ?? !!raw.lm?.provider`.

---

## Phase 2: Declarative Test Framework (P1)

### 2.1 Create `src/nar/tests/framework/ReasoningTestBuilder.ts`

A fluent, declarative DSL for specifying multi-cycle reasoning tests:

```typescript
import { describe, expect, it } from '@jest/globals';
import { Truth, TermBuilder, NAR, type NARConfig } from '../../index.js';
import { parseNarsese } from './parser.js';

interface Premise {
  input: string;
  truth?: Truth;
  type?: 'belief' | 'goal' | 'question' | 'command';
}

interface ExpectedDerivation {
  term: string;
  f?: number | [number, number];  // Single value or [min, max]
  c?: number | [number, number];
  depth?: number | [0, number];
  mustExist?: boolean;  // default true
}

interface TestSpec {
  name: string;
  premises: Premise[];
  cycles: number;
  expect: ExpectedDerivation[];
  expectNot?: ExpectedDerivation[];  // Negative assertions
  config?: Partial<NARConfig>;
}

export async function assertReasoning(spec: TestSpec): Promise<void> {
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    consolidationInterval: 5,
    cpuThrottleMs: 10,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: false,
    ...spec.config
  });

  // Input premises
  for (const premise of spec.premises) {
    await nar.input(
      premise.input,
      premise.type ?? 'belief',
      premise.truth ?? Truth.NEUTRAL
    );
  }

  // Run cycles
  await nar.run(spec.cycles);

  // Positive assertions
  for (const exp of spec.expect) {
    const term = parseNarsese(exp.term);
    const concept = nar.memory.getConcept(term);
    
    if (exp.mustExist !== false) {
      expect(concept).toBeDefined();
      if (concept) {
        const belief = concept.beliefBag.peek();
        if (belief) {
          if (exp.f !== undefined) {
            if (Array.isArray(exp.f)) {
              expect(belief.truth.f).toBeGreaterThanOrEqual(exp.f[0]);
              expect(belief.truth.f).toBeLessThanOrEqual(exp.f[1]);
            } else {
              expect(belief.truth.f).toBeCloseTo(exp.f, 5);
            }
          }
          if (exp.c !== undefined) {
            if (Array.isArray(exp.c)) {
              expect(belief.truth.c).toBeGreaterThanOrEqual(exp.c[0]);
              expect(belief.truth.c).toBeLessThanOrEqual(exp.c[1]);
            } else {
              expect(belief.truth.c).toBeCloseTo(exp.c, 5);
            }
          }
          if (exp.depth !== undefined) {
            if (Array.isArray(exp.depth)) {
              expect(belief.stamp.depth).toBeGreaterThanOrEqual(exp.depth[0]);
              expect(belief.stamp.depth).toBeLessThanOrEqual(exp.depth[1]);
            } else {
              expect(belief.stamp.depth).toBeLessThanOrEqual(exp.depth);
            }
          }
        }
      }
    }
  }

  // Negative assertions
  if (spec.expectNot) {
    for (const exp of spec.expectNot) {
      const term = parseNarsese(exp.term);
      const concept = nar.memory.getConcept(term);
      if (exp.mustExist !== false) {
        expect(concept).toBeUndefined();
      }
    }
  }
}

export function describeReasoning(name: string, specs: TestSpec[]): void {
  describe(name, (specs.length > 0 ? it : it.skip)(specs[0]?.name ?? 'unnamed', () => {
    // Placeholder - actual tests generated below
  }));
  
  for (const spec of specs) {
    it(spec.name, async () => {
      await assertReasoning(spec);
    });
  }
}
```

### 2.2 Create `src/nar/tests/framework/index.ts`

```typescript
export { assertReasoning, describeReasoning, type TestSpec } from './ReasoningTestBuilder.js';
export { parseNarsese } from './parser.js';
```

### 2.3 Create `src/nar/tests/framework/parser.ts`

```typescript
import { TermBuilder, Truth } from '../../terms/index.js';
import { termParser } from '../../terms/parser.js';

export function parseNarsese(input: string) {
  return termParser.parse(input);
}

export function parseWithTruth(input: string) {
  return termParser.parseWithTruth(input);
}
```

### 2.4 Rewrite core NAL tests using new framework

**File:** `src/nar/tests/framework/nal-deduction.test.ts`
```typescript
import { describeReasoning } from './index.js';
import { Truth } from '../../terms/index.js';

describeReasoning('NAL Deduction', [
  {
    name: 'basic deduction: (A --> B), (B --> C) |- (A --> C)',
    premises: [
      { input: '(bird --> animal)', truth: Truth.create(0.9, 0.9) },
      { input: '(animal --> living)', truth: Truth.create(0.9, 0.9) },
    ],
    cycles: 1,
    expect: [
      { 
        term: '(bird --> living)', 
        f: [0.7, 0.82],  // Range assertion
        c: [0.7, 0.82],
        depth: 1,
      },
    ],
    expectNot: [
      { term: '(living --> bird)' },  // Should NOT be derived
    ],
  },
  {
    name: 'deduction chain (3-step)',
    premises: [
      { input: '(mammal --> animal)', truth: Truth.create(0.95, 0.9) },
      { input: '(dog --> mammal)', truth: Truth.create(0.95, 0.9) },
      { input: '(animal --> living)', truth: Truth.create(0.95, 0.9) },
    ],
    cycles: 3,
    expect: [
      { term: '(dog --> living)', depth: [0, 2] },
    ],
  },
]);
```

### 2.5 Replace `fixtures.ts` with factory pattern

**File:** `src/nar/tests/framework/fixtures.ts`
```typescript
import { NAR, type NARConfig } from '../../nar.js';

export const E2E_CONFIG: NARConfig = Object.freeze({
  maxConcepts: 100,
  priorityThreshold: 0.1,
  activationDecayRate: 0.01,
  consolidationInterval: 5,
  cpuThrottleMs: 10,
  maxDerivationDepth: 10,
  maxDerivationsPerStep: 100,
  enableLMRules: false,
});

export function createTestNAR(overrides?: Partial<NARConfig>): NAR {
  return new NAR({ ...E2E_CONFIG, ...overrides });
}

export function createMinimalNAR(): NAR {
  return new NAR({
    maxConcepts: 10,
    priorityThreshold: 0.05,
    maxDerivationDepth: 5,
    enableLMRules: false,
  });
}

export function createHighCapacityNAR(): NAR {
  return new NAR({
    maxConcepts: 1000,
    priorityThreshold: 0.01,
    maxDerivationDepth: 20,
    enableLMRules: false,
  });
}
```

### 2.6 Migrate existing tests to new framework

| Old Test File | New Framework File | Status |
|---------------|-------------------|--------|
| `e2e/01-term-system.test.ts` | `framework/term-system.test.ts` | Rewrite |
| `e2e/02-inference-rules.test.ts` | `framework/nal-deduction.test.ts` | Rewrite |
| `e2e/03-memory-operations.test.ts` | `framework/memory-ops.test.ts` | Rewrite |
| `e2e/04-aikr-compliance.test.ts` | `framework/aikr-compliance.test.ts` | Rewrite |
| `nal2-copula.test.ts` | `framework/nal-extended.test.ts` | Merge |
| `nal7-temporal.test.ts` | `framework/nal-temporal.test.ts` | Rewrite |
| `nal8-procedural.test.ts` | `framework/nal-procedural.test.ts` | Rewrite |
| `nal9-self.test.ts` | `framework/nal-self.test.ts` | Rewrite |

---

## Phase 3: Test Coverage Expansion (P1)

### 3.1 NAL1 core rules unit tests
**File:** `src/nar/tests/framework/nal-core.test.ts`  
**Coverage:** Direct `RuleRegistry.apply()` calls with known inputs, assert specific derived terms + truth values for:
- `nal.deduction`
- `nal.induction`
- `nal.abduction`
- `nal.comparison`
- `nal.analogy`
- `nal.resemblance`

### 3.2 Strategy tests
**File:** `src/nar/tests/framework/strategies.test.ts`  
**Coverage:** All 13 strategies with controlled Memory fixtures:
- `BagStrategy`
- `ExhaustiveStrategy`
- `AdaptiveStrategy`
- `SwitchingStrategy`
- `CompositeStrategy`
- `PrologStrategy`
- `ResolutionStrategy`
- `GoalDrivenStrategy`
- `AnalogicalStrategy`
- `TermLinkStrategy`
- `TaskMatchStrategy`
- `DecompositionStrategy`
- `DefaultFormationStrategy`

### 3.3 Tool unit tests (7 uncovered tools)
**Files:** `src/nar/tests/unit/tools-*.test.ts`
- `tools-http.test.ts` — HTTPTool
- `tools-search.test.ts` — SearchTool
- `tools-reason.test.ts` — ReasonTool
- `tools-explain.test.ts` — ExplainTool
- `tools-learn.test.ts` — LearnTool
- `tools-timer.test.ts` — TimerTool
- `tools-process.test.ts` — ProcessTool

### 3.4 CLI/REPL tests
**File:** `src/nar/tests/unit/cli.test.ts`  
**Coverage:** Command dispatch, input parsing, history operations, edge cases.

### 3.5 Config loader tests
**File:** `src/nar/tests/unit/config-loader.test.ts`  
**Coverage:** `loadFromFile`, `loadFromEnv`, `validate`, `findConfigFile` with mocked fs and env vars.

### 3.6 Reasoner tests
**File:** `src/nar/tests/unit/reasoner.test.ts`  
**Coverage:** `step()`, `deriveFromSecondary()`, `exceedsDepthLimit()`, `isCircular()`, `checkQualityThreshold()`.

### 3.7 nar-lm tests
**File:** `src/nar/tests/unit/nar-lm.test.ts`  
**Coverage:** `NARLM` class: feedback loop, proactive enrichment, streaming.

### 3.8 nar-io and task/input tests
**Files:** `src/nar/tests/unit/nar-io.test.ts`, `src/nar/tests/unit/input-processor.test.ts`

### 3.9 QueryAPI and ReasoningTrace tests
**File:** `src/nar/tests/unit/query-api.test.ts`, `src/nar/tests/unit/reasoning-trace.test.ts`

### 3.10 EventBus tests
**File:** `src/nar/tests/unit/eventbus.test.ts`  
**Coverage:** `on`, `once`, `off`, `emit`, `clear`, `listenerCount`, error handling in listeners.

### 3.11 Concept class tests
**File:** `src/nar/tests/unit/concept.test.ts`  
**Coverage:** Activation, belief/goal/question bag operations, merging, link management.

### 3.12 Memory submodule tests
**Files:**
- `src/nar/tests/unit/memory-focus.test.ts`
- `src/nar/tests/unit/memory-scorer.test.ts`
- `src/nar/tests/unit/memory-gc.test.ts`
- `src/nar/tests/unit/memory-consolidation.test.ts`
- `src/nar/tests/unit/memory-archive.test.ts`
- `src/nar/tests/unit/memory-forgetting.test.ts`
- `src/nar/tests/unit/memory-distribution.test.ts`

### 3.13 Property-based test expansion
**Files:** `src/nar/tests/property/`:
- `memory-invariants.test.ts` — size <= maxConcepts, index consistency
- `stamp-properties.test.ts` — depth limits, idempotence
- `bag-properties.test.ts` — capacity, priority ordering
- `reasoning-invariants.test.ts` — truth bounds through derivation chains

---

## Phase 4: ESLint & Configuration (P1)

### 4.1 Expand ESLint config
**File:** `eslint.config.js`  
Add:
```typescript
'@typescript-eslint/no-explicit-any': 'error',
'no-empty': 'error',
'max-lines': ['error', { max: 500, skipBlankLines: true }],
'max-lines-per-function': ['error', { max: 50 }],
'complexity': ['error', { max: 10 }],
'@typescript-eslint/no-floating-promises': 'error',
'@typescript-eslint/prefer-optional-chain': 'error',
'@typescript-eslint/no-unnecessary-type-assertion': 'error',
'prefer-const': 'error',
'eqeqeq': 'error',
'no-var': 'error',
'@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
'no-throw-literal': 'error',
```

### 4.2 Fix ESLint violations
Run `pnpm run lint` and fix all new errors/warnings.

### 4.3 Add missing npm scripts
**File:** `package.json`
```json
{
  "scripts": {
    "benchmark": "tsx benchmarks/rule-dispatch.ts",
    "coverage": "pnpm run test --coverage",
    "clean": "rm -rf node_modules dist .eslintcache",
    "demo": "tsx src/app.ts demo"
  }
}
```

### 4.4 Add coverage thresholds
**File:** `jest.config.cjs`
```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

### 4.5 Fix `pnpm-workspace.yaml` placeholder values
**File:** `pnpm-workspace.yaml`  
Replace `"set this to true or false"` with actual booleans.

---

## Phase 5: Architecture Refactoring (P2)

### 5.1 Extract REPL modules
**Files:**
- `src/cli/commands/index.ts` — Command registry and dispatch
- `src/cli/commands/belief-commands.ts` — `.run`, `.stats`, `.concepts`
- `src/cli/commands/query-commands.ts` — `.ask`, `.trace`, `.explain`
- `src/cli/commands/lm-commands.ts` — `.lm-*` commands
- `src/cli/commands/rlfp-commands.ts` — `.rlfp-*` commands
- `src/cli/commands/self-commands.ts` — `.self`, `.meta`, `.optimize`
- `src/cli/display.ts` — All box-drawing and formatting
- `src/cli/history.ts` — Persistence logic
- `src/cli/profile.ts` — Profiling session

### 5.2 Remove NARFacade indirection
**Option A (recommended):** Remove facade entirely, delegate directly on NAR:
```typescript
// NAR class
getBeliefs = this.query.getBeliefs;
getMetrics = () => this.metrics.getSummary();
```
**Option B:** Make facade aggregate multiple sources into unified views.

### 5.3 Consolidate rule definitions
**File:** `src/nar/rules/nal-consolidated.ts`
Merge `nal.ts` and `nal-extended.ts` into single source, use aliases for duplicate rule names.

### 5.4 Extract expectation helper
**File:** `src/nar/terms/truth.ts`
```typescript
function computeExpectation(t: Truth): number {
  return t.c * (t.f - 0.5) + 0.5;
}
```

### 5.5 Add Memory public API for concept search
**File:** `src/nar/memory/memory.ts`
```typescript
findConcepts(pattern: string, limit: number = 10): Concept[] {
  // Implementation
}
```

### 5.6 Fix constructor parameter overload
**Files:** `src/nar/nar.ts`, `src/nar/reason/reasoner.ts`  
Use options objects for constructors with >3 parameters.

### 5.7 Move tests to root `tests/` directory
**Decision:** Either consolidate all tests from `src/nar/tests/` under root `tests/`, or remove empty root `tests/` directory.

---

## Phase 6: Usability Improvements (P2)

### 6.1 Fix CLI input validation
**File:** `src/cli/repl.ts:170`  
Validate integer parsing for `.run` command, default gracefully.

### 6.2 Improve multi-line input detection
**File:** `src/cli/repl.ts:67-89`  
Use more robust heuristic than "starts with `{`".

### 6.3 Add progress indication for `.run`
**File:** `src/cli/repl.ts`  
Add spinner or periodic status updates for large step counts.

### 6.4 Wrap raw system errors
**File:** `src/cli/repl.ts:401-404`  
Show user-friendly messages instead of raw `ENOENT`.

### 6.5 Extract domain data
**File:** `src/cli/domains.ts`  
Move hardcoded `loadDomain` data out of `repl.ts`.

### 6.6 Add per-command help text
**File:** `src/cli/repl.ts`  
Add help for `.ask-nl`, `.constitution`, `.attention`, `.load-domain`.

### 6.7 Fix config validation
**File:** `src/config/loader.ts`  
Add validation for ALL config fields, not just 2.

---

## Phase 7: Documentation (Deferred to End)

### 7.1 Create missing referenced docs
**Files:**
- `README.quickref.md` — Commands and patterns
- `README.usage.md` — Getting started
- `README.architecture.md` — System design
- `README.api.md` — API reference
- `README.development.md` — Developer guide
- `CONTRIBUTING.md` — Contribution guidelines
- `LICENSE` — MIT license file

### 7.2 Write Narsese syntax reference
**File:** `docs/narsese-syntax.md`  
Cover all operators, truth values, variables, statement types, examples.

### 7.3 Add JSDoc to public API
**Files:**
- `src/index.ts` — Every export
- `src/nar/nar.ts` — All public methods
- `src/nar/types/core.ts` — All interfaces
- `src/config/loader.ts` — All config interfaces

### 7.4 Create getting-started walkthrough
**File:** `docs/getting-started.md`  
Step-by-step CLI walkthrough with example session.

### 7.5 Create configuration guide
**File:** `docs/configuration.md`  
Explain every field in `senars.config.json`, environment variable overrides, factory presets.

### 7.6 Create `.env.example`
**File:** `.env.example`
```bash
# Anthropic API key (for Vercel AI SDK)
ANTHROPIC_API_KEY=

# LM provider: mock | vercel | ollama
LM_PROVIDER=mock

# LM model name
LM_MODEL=claude-3-5-sonnet

# Maximum concepts in memory
MAX_CONCEPTS=100
```

### 7.7 Update examples
**Files:** `examples/*.ts`  
- Fix imports to use public API
- Add config file loading example
- Reference from README

### 7.8 Generate API docs with typedoc
**File:** `typedoc.json`, `package.json` script

---

## Summary by Priority

| Priority | Count | Focus Areas |
|----------|-------|-------------|
| **P0** | 5 | Config bugs, hash instability, RLFP init, null safety, entry point |
| **P1** | 16 | Deduplication, REPL refactor, type erosion, test framework, coverage |
| **P2** | 14 | Architecture refactoring, usability, module decomposition |
| **P3** | 8 | Documentation, polish, examples, typedoc |

## Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 0 (P0 bugs) | 1-2 days | None |
| Phase 1 (P1 quality) | 3-5 days | Phase 0 |
| Phase 2 (Test framework) | 2-3 days | Phase 0 |
| Phase 3 (Coverage) | 5-7 days | Phase 2 |
| Phase 4 (ESLint) | 1-2 days | Phase 1 |
| Phase 5 (Architecture) | 3-5 days | Phase 1, 3 |
| Phase 6 (Usability) | 2-3 days | Phase 5 |
| Phase 7 (Docs) | 3-5 days | All previous |

**Total:** ~20-30 days of focused development
