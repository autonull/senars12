# Java to JavaScript NARS Migration Plan

Complete migration guide organized with non-temporal functionality in primary phases and temporal support deferred to
final phases.

---

## 1. Codebase Compatibility Analysis

### 1.1 Current JavaScript Architecture Review

**`Term.js` Structure:**

```javascript
class Term {
    constructor(type, name, components = [], operator = null) {
        this._type = type;          // 'atom' | 'compound'
        this._name = name;          // Canonical string name
        this._operator = operator;  // String (e.g., '-->', '&&')
        this._components = [...];   // Array of Term
        // NO dt (temporal delta) field exists
    }
}
```

**`TermFactory.js` Operator Handling:**

```javascript
const COMMUTATIVE_OPERATORS = new Set(['&', '|', '+', '*', '<->', '=', '||', '&&']);
const ASSOCIATIVE_OPERATORS = new Set(['&', '|', '||', '&&']);
// Uses simple string matching, no operator metadata
```

**`narsese.peggy` Parser:**

- Supports: `-->`, `<->`, `==>`, `<=>`, `=/>', `=|`, `=/=`, `=`, `&&`, `||`, `&|`, `&/`
- Missing: Temporal deltas (`&&+5`), pattern variables (`%`), budget, occurrence time
- Punctuation: Only `.!?` (missing `@` QUEST and `;` COMMAND)

### 1.2 Critical Incompatibilities to Address

| Issue                     | Current State              | Required Change            | Phase                 |
|---------------------------|----------------------------|----------------------------|-----------------------|
| **No `dt` field in Term** | Term has no temporal delta | Add optional `dt` property | Temporal              |
| **Missing operators**     | 9 operators                | Add 10 more from Op.java   | Primary               |
| **Pattern variable `%`**  | Not parsed                 | Add to Variable rule       | Primary               |
| **Negation syntax**       | No `--` prefix support     | Add negation rule          | Primary               |
| **QUEST/COMMAND punc**    | Missing `@` and `;`        | Add to Punctuation         | Primary               |
| **Image placeholders**    | Not implemented            | Add `\` and `/` atomics    | Primary               |
| **Equality operator**     | `=` exists but limited     | Extend `EQ` handling       | Primary               |
| **DIFF operator**         | Not implemented            | Add `<~>`                  | Primary               |
| **DELTA operator**        | Not implemented            | Add `Δ` and `/\`           | Primary               |
| **INT term type**         | Not implemented            | Add numeric term type      | Primary               |
| **Functor form**          | Partial (`func(args)`)     | Ensure parity              | Primary               |
| **Compact INH**           | Not implemented            | Add `pred:subj` syntax     | Primary               |
| **Temporal operators**    | `&                         | `, `&/` listed             | Full temporal support | Temporal |
| **Time deltas**           | Not implemented            | Add `&&+N` parsing         | Temporal              |
| **Occurrence time**       | Not implemented            | Add `\|`, `now`            | Temporal              |
| **Budget values**         | Not implemented            | Add `$0.5$`                | Temporal              |

### 1.3 Rule File Compatibility Analysis

**Current JS Rules (4 files):**

- `SyllogisticRule.js` - Inheritance/Implication deduction
- `ModusPonensRule.js` - Basic modus ponens
- `MetacognitionRules.js` - Meta-level rules
- `NALRule.js` - Base class

**Java NAL Rules (24 enabled):**

- Use `.nal` DSL with preconditions and truth functions
- Reference temporal operators in many rules
- Many rules can work without temporal support

**Classification of Rule Files:**

| Category          | Files                                  | Can Migrate Without Temporal   |
|-------------------|----------------------------------------|--------------------------------|
| **Structural**    | `inh.nal`, `sim.nal`                   | ✅ Yes                          |
| **Sets**          | `set.*.nal` (3 files)                  | ✅ Yes                          |
| **Conversion**    | `conversion.nal`, `contraposition.nal` | ✅ Yes                          |
| **Analogy**       | `analogy.*.nal` (3 files)              | ⚠️ Partial (some use temporal) |
| **Implication**   | `impl.syl.nal`, `impl.strong.nal`      | ⚠️ Partial                     |
| **Decomposition** | `cond.decompose.*.nal` (5 files)       | ❌ Heavy temporal               |
| **Composition**   | `impl.compose.nal`                     | ⚠️ Partial                     |

---

## 2. Phase 1: Core Non-Temporal Operators (Week 1)

### 2.1 Extend `constants.js`

**File:** `core/src/config/constants.js`

```javascript
// Add operator constants (non-temporal subset)
export const OP = Object.freeze({
    // Atomic types
    ATOM: { str: '.', arity: [0,0] },
    INT: { str: '+', arity: [0,0] },
    BOOL: { str: 'B', arity: [0,0] },
    IMG: { str: '/', arity: [0,0] },
    
    // Variables
    VAR_INDEP: { str: '$', ch: '$' },
    VAR_DEP: { str: '#', ch: '#' },
    VAR_QUERY: { str: '?', ch: '?' },
    VAR_PATTERN: { str: '%', ch: '%' },
    
    // Statements (binary, non-temporal)
    INH: { str: '-->', arity: [2,2], statement: true },
    SIM: { str: '<->', arity: [2,2], statement: true, commutative: true },
    EQ: { str: '=', arity: [2,2], commutative: true },
    DIFF: { str: '<~>', arity: [2,2], commutative: true },
    
    // Compounds
    NEG: { str: '--', arity: [1,1] },
    PROD: { str: '*', arity: [0,Infinity] },
    SETi: { str: '[', ch: '[', arity: [1,Infinity], commutative: true },
    SETe: { str: '{', ch: '{', arity: [1,Infinity], commutative: true },
    DELTA: { str: 'Δ', ch: 'Δ', arity: [1,1] },
    
    // Deferred temporal operators (defined but not fully implemented)
    CONJ: { str: '&&', arity: [2,Infinity], commutative: true, temporal: true },
    IMPL: { str: '==>', arity: [2,2], statement: true, temporal: true },
});

// Punctuation
export const PUNCTUATION = Object.freeze({
    BELIEF: '.',
    QUESTION: '?',
    GOAL: '!',
    QUEST: '@',
    COMMAND: ';',
});

// Syntax characters
export const SYNTAX = Object.freeze({
    ARGUMENT_SEPARATOR: ',',
    SETi_CLOSE: ']',
    SETe_CLOSE: '}',
    COMPOUND_OPEN: '(',
    COMPOUND_CLOSE: ')',
});
```

### 2.2 Update `TermFactory.js`

**Changes required:**

1. Add missing operators to `COMMUTATIVE_OPERATORS`:
   ```javascript
   const COMMUTATIVE_OPERATORS = new Set([
       '&', '|', '+', '*', '<->', '=', '||', '&&',
       '<~>', '{}', '[]'  // Add DIFF, SETe, SETi
   ]);
   ```

2. Add `CANONICAL_NAME_PATTERNS` for new operators:
   ```javascript
   '<~>': (n) => `(<~>, ${n[0]}, ${n[1]})`,
   'Δ': (n) => `Δ${n[0]}`,
   ```

3. Add factory methods:
   ```javascript
   difference(a, b) { return this._createCompound('<~>', [a, b]); }
   delta(term) { return this._createCompound('Δ', [term]); }
   ```

### 2.3 Extend `narsese.peggy` Parser

**Add to grammar:**

```peggy
// Add pattern variable
Variable "variable"
  = varName:$([?$#%][^(){}.<>.,!%?; \t\n\r=&/|>-]*) { 
      return options.termFactory.atomic(varName); 
    }

// Add all punctuation
Punctuation
  = _ punc:[.!?@;] { return punc; }

// Add negation prefix
NegationTerm
  = "(--," _ term:Term _ ")" { return options.termFactory.negation(term); }
  / "--" term:Term { return options.termFactory.negation(term); }

// Add delta prefix  
DeltaTerm
  = "Δ" term:Term { return options.termFactory.delta(term); }
  / "/\\" term:Term { return options.termFactory.delta(term); }

// Add compact inheritance: pred:subj
CompactInheritance
  = pred:AtomicTerm ":" subj:Term { 
      return options.termFactory.inheritance(subj, pred); 
    }

// Add difference operator to InfixOperator
InfixOperator
  = op:("-->" / "<->" / "==>" / "<=>" / "<~>" / "=" / "&&" / "||") { return op; }

// Add image placeholders
ImagePlaceholder
  = "\\" { return options.termFactory.atomic('\\'); }
  / "/" { return options.termFactory.atomic('/'); }
```

---

## 3. Phase 2: Truth Functions (Week 1-2)

### 3.1 Extend `Truth.js`

**Add missing non-temporal functions:**

```javascript
// SET OPERATIONS
static intersection(t1, t2) {
    return Truth.binaryOperation(t1, t2, (t, u) =>
        new Truth(t.f * u.f, t.c * u.c));
}

static union(t1, t2) {
    return Truth.binaryOperation(t1, t2, (t, u) =>
        new Truth(1 - (1 - t.f) * (1 - u.f), t.c * u.c));
}

static subtract(t1, t2) {
    return Truth.binaryOperation(t1, t2, (t, u) =>
        new Truth(Math.max(0, t.f - u.f), t.c * u.c));
}

static diff(t1, t2) {
    return Truth.binaryOperation(t1, t2, (t, u) =>
        new Truth(Math.abs(t.f - u.f), t.c * u.c));
}

// SYLLOGISTIC EXTENSIONS
static exemplification(t1, t2) {
    return Truth.binaryOperation(t1, t2, (t, u) => {
        const w = t.c / (t.c + 1); // weakening factor
        return new Truth(t.f * u.f, w * t.c * u.c * t.f * u.f);
    });
}

static sameness(t1, t2) {
    return Truth.binaryOperation(t1, t2, (t, u) => {
        const diff = Math.abs(t.f - u.f);
        return new Truth(1 - diff, t.c * u.c);
    });
}

// DEDUCTIVE VARIANTS
static deductionWeak(t1, t2) {
    const result = Truth.deduction(t1, t2);
    return result ? new Truth(result.f, Truth.weak(result.c)) : null;
}

static structuralDeduction(t) {
    if (!t) return null;
    const c = t.c / (t.c + 1);
    return new Truth(t.f * t.f, c * t.c);
}

static structuralReduction(t) {
    if (!t) return null;
    return new Truth(t.f, Truth.weak(t.c));
}
```

---

## 4. Phase 3: Non-Temporal NAL Rules (Week 2-3)

### 4.1 Rule Loading Strategy

Create a `.nal` rule parser that handles the subset of rules without temporal operators.

**File:** `core/src/reason/rules/nal/NALRuleParser.js`

```javascript
export class NALRuleParser {
    constructor() {
        this.temporalPatterns = /&&\+|&&-|&\||=\|>|dt|XTERNAL|DTERNAL/;
    }
    
    isNonTemporal(ruleText) {
        return !this.temporalPatterns.test(ruleText);
    }
    
    parseFile(content) {
        const rules = [];
        // Parse .nal format, filter non-temporal rules
        for (const rule of this.extractRules(content)) {
            if (this.isNonTemporal(rule.text)) {
                rules.push(this.compileRule(rule));
            }
        }
        return rules;
    }
}
```

### 4.2 Rules to Migrate (Non-Temporal Subset)

**Fully Migratable (no temporal references):**

| File                 | Rules | Description                                       |
|----------------------|-------|---------------------------------------------------|
| `inh.nal`            | ~10   | Inheritance deduction/abduction (filter temporal) |
| `sim.nal`            | ~8    | Similarity rules                                  |
| `conversion.nal`     | ~4    | Conversion rules                                  |
| `contraposition.nal` | ~4    | Contraposition                                    |
| `set.compose.nal`    | ~6    | Set composition                                   |
| `set.decompose.nal`  | ~5    | Set decomposition                                 |
| `set.guess.nal`      | ~7    | Set guessing                                      |

**Partially Migratable (extract non-temporal rules):**

| File              | Non-temporal % | Approach                   |
|-------------------|----------------|----------------------------|
| `impl.syl.nal`    | ~40%           | Extract eternal-only rules |
| `impl.strong.nal` | ~30%           | Filter `Time:Union` rules  |
| `analogy.*.nal`   | ~50%           | Skip temporal analogy      |

### 4.3 Rule Preconditions to Implement

```javascript
// core/src/reason/rules/nal/Preconditions.js
export const Preconditions = {
    // --var(X) - X has no variables
    noVar: (term) => !hasVariables(term),
    
    // --var({X,Y,Z}) - None of X,Y,Z have variables  
    noVarSet: (...terms) => terms.every(t => !hasVariables(t)),
    
    // hasBelief() - Belief premise exists
    hasBelief: (belief) => belief != null,
    
    // neq(X,Y) - X not equal Y
    neq: (x, y) => !x.equals(y),
    
    // eqPN(X,Y) - X equals Y or --X equals Y
    eqPN: (x, y) => x.equals(y) || negEquals(x, y),
    
    // ceqPN(X,Y) - X equals Y considering polarity
    ceqPN: (x, y) => structurallyEqual(x.unneg(), y.unneg()),
    
    // --taskBeliefEq() - Task and belief not equal
    taskBeliefNeq: (task, belief) => !task.term.equals(belief.term),
};
```

---

## 5. Phase 4: Integration & Serialization (Week 3)

### 5.1 Create `TermSerializer.js`

**File:** `core/src/term/TermSerializer.js`

```javascript
export class TermSerializer {
    stringify(term, options = {}) {
        switch (term.operator) {
            case 'SETi': return this.printSet(term, '[', ']');
            case 'SETe': return this.printSet(term, '{', '}');
            case 'PROD': return this.printProduct(term);
            case 'NEG': case '--': return this.printNegation(term);
            case 'EQ': case '=': return this.printEquality(term);
            case 'DELTA': case 'Δ': return this.printDelta(term);
            default:
                return term.components?.length === 2 
                    ? this.printBinary(term)
                    : this.printCompound(term);
        }
    }
    
    printNegation(term) {
        const inner = term.components[0];
        return `(--,${this.stringify(inner)})`;
    }
    
    printDelta(term) {
        return `Δ${this.stringify(term.components[0])}`;
    }
    
    // ... other methods
}
```

### 5.2 Update Existing Rules for New Operators

Audit and update existing rule files:

- `SyllogisticRule.js` - Ensure works with new OP constants
- `ModusPonensRule.js` - Add support for new operators

---

## 6. Phase 5: Testing & Validation (Week 3-4)

### 6.1 Unit Tests

**Test commands:**

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --grep "TermFactory"
npm test -- --grep "Truth"
npm test -- --grep "Parser"
npm test -- --grep "NALRule"
```

**Tests to add:**

1. **Operator Tests** (`test/term/operators.test.js`)
    - Test each new operator creation
    - Test canonical name generation
    - Test equality for commutative operators

2. **Parser Tests** (`test/parser/narsese.test.js`)
    - Test pattern variable parsing
    - Test negation syntax
    - Test compact inheritance
    - Test all punctuation types

3. **Truth Function Tests** (`test/Truth.test.js`)
    - Test intersection, union, difference
    - Test exemplification
    - Test structural functions

4. **Rule Tests** (`test/reason/rules/*.test.js`)
    - Test each migrated rule against expected outputs

### 6.2 Integration Tests

```bash
# Full inference pipeline test
npm run test:integration
```

---

## 7. Temporal Phases (Deferred - Future Work)

### Phase T1: Temporal Infrastructure

> **Note:** These phases are deferred pending decision on temporal representation (`+dt` vs alternative).

**If proceeding with dt representation:**

1. **Extend Term class:**
   ```javascript
   class Term {
       constructor(type, name, components, operator, dt = null) {
           // ... existing
           this._dt = dt; // null = eternal, integer = delta
       }
       get dt() { return this._dt; }
       get isEternal() { return this._dt === null; }
       get isTemporal() { return this._dt !== null; }
   }
   ```

2. **Add temporal constants:**
   ```javascript
   export const TEMPORAL = Object.freeze({
       DTERNAL: null,           // Eternal (no timing)
       XTERNAL: Symbol('+-'),   // Variable timing
   });
   ```

3. **Extend parser for temporal:**
   ```peggy
   TemporalOperator
     = op:("&&" / "==>") dt:TimeDelta { 
         return { op, dt }; 
       }
   
   TimeDelta
     = "+-" { return XTERNAL; }
     / "+" n:Integer { return parseInt(n); }
     / "-" n:Integer { return -parseInt(n); }
   ```

### Phase T2: Temporal Truth Functions

```javascript
// Pre/Post functions (temporal-specific)
static pre(t1, t2, strong = true) { /* ... */ }
static post(t1, t2, timeBased = true, strong = true) { /* ... */ }
static conduct(t1, t2, weak = false) { /* ... */ }
```

### Phase T3: Temporal NAL Rules

- Migrate remaining rules from `cond.decompose.*.nal`
- Migrate temporal rules from `impl.*.nal`
- Implement temporal induction rules

---

## 8. Potential Issues & Mitigations

### 8.1 Breaking Changes Risk

| Risk                    | Impact             | Mitigation                                    |
|-------------------------|--------------------|-----------------------------------------------|
| Term structure change   | All existing terms | Keep backward compatible; dt defaults to null |
| Operator string changes | Term matching      | Use constants, not hardcoded strings          |
| Parser changes          | Existing NARsese   | Ensure backward compatible parsing            |

### 8.2 Performance Concerns

| Concern                 | Mitigation              |
|-------------------------|-------------------------|
| Larger Term objects     | Only add dt if temporal |
| More complex parsing    | Profile critical paths  |
| Truth function overhead | Use static methods      |

### 8.3 Testing Strategy

1. **Regression testing:** Run full test suite after each phase
2. **Comparison testing:** Compare outputs with Java reference
3. **Property-based testing:** Use randomized term generation

---

## 9. File Change Summary

### Primary Phases (Non-Temporal)

| File                                         | Action  | Changes                            |
|----------------------------------------------|---------|------------------------------------|
| `core/src/config/constants.js`               | Extend  | Add OP, PUNCTUATION, SYNTAX        |
| `core/src/term/Term.js`                      | Minimal | No changes needed for non-temporal |
| `core/src/term/TermFactory.js`               | Extend  | Add operators, methods             |
| `core/src/parser/narsese.peggy`              | Extend  | Add pattern var, negation, etc.    |
| `core/src/Truth.js`                          | Extend  | Add 15+ truth functions            |
| `core/src/term/TermSerializer.js`            | **NEW** | Term-to-string conversion          |
| `core/src/reason/rules/nal/NALRuleParser.js` | **NEW** | .nal file parser                   |
| `core/src/reason/rules/nal/Preconditions.js` | **NEW** | Rule preconditions                 |
| `core/src/reason/rules/nal/*.js`             | **NEW** | Migrated rule files                |

### Temporal Phases (Deferred)

| File                            | Action | Changes                      |
|---------------------------------|--------|------------------------------|
| `core/src/term/Term.js`         | Extend | Add optional dt property     |
| `core/src/config/constants.js`  | Extend | Add TEMPORAL constants       |
| `core/src/parser/narsese.peggy` | Extend | Add temporal parsing         |
| `core/src/Truth.js`             | Extend | Add temporal truth functions |

---

## 10. Native (Non-.nal) Rules from NARS.java

These are Java rules implemented as classes, not loaded from `.nal` files. They are excellent candidates for native
JavaScript implementation.

### 10.1 Core Rules (Always Enabled via `core()`)

| Class                          | Purpose                                          | Temporal?  | Priority |
|--------------------------------|--------------------------------------------------|------------|----------|
| `BeliefResolve`                | Resolves beliefs for premise matching            | No         | High     |
| `Decompose1`                   | Generic compound decomposition                   | No         | **High** |
| `DecomposeStatement(INH, SIM)` | Extract subject/predicate from statements        | No         | **High** |
| `DecomposeImpl`                | Implication decomposition (subj/pred extraction) | ⚠️ Partial | Medium   |
| `DecomposeCond`                | Condition decomposition from conjunctions        | ⚠️ Partial | Medium   |
| `TermLinking`                  | Build term linkage graph via `BagAdjacentTerms`  | No         | **High** |
| `VariableIntroduction`         | Introduce `$` and `#` variables to generalize    | No         | **High** |
| `Evaluate`                     | Execute functors/functions on terms              | No         | **High** |

### 10.2 Optional Rules

| Class                             | Method                | Purpose                               | Temporal? | Priority |
|-----------------------------------|-----------------------|---------------------------------------|-----------|----------|
| `STMLinker`                       | `stm()`               | Short-term memory linking             | Yes       | Deferred |
| `ImageUnfold`                     | `images()`            | Unfold image terms to relations       | No        | Low      |
| `ImageAlign.ImageAlignBidi`       | `images()`            | Bidirectional image alignment         | No        | Low      |
| `TemporalInduction.ConjInduction` | `temporalInduction()` | Conjunction from temporal observation | Yes       | Deferred |
| `TemporalInduction.DisjInduction` | `temporalInduction()` | Disjunction from temporal observation | Yes       | Deferred |
| `TemporalInduction.ImplInduction` | `temporalInduction()` | Implication from temporal sequence    | Yes       | Deferred |

### 10.3 Recommended Native JavaScript Implementation

**Phase 3A - High Priority Native Rules:**

1. **`Decompose1`** - Extract subterms from any compound
   ```javascript
   // (A && B) -> derive A, derive B
   // {A, B, C} -> derive A, derive B, derive C
   ```

2. **`DecomposeStatement`** - Extract from INH/SIM
   ```javascript
   // (A --> B) -> can use A as subject concept, B as predicate concept
   ```

3. **`TermLinking`** - Build concept graph
   ```javascript
   // Link A to B when (A --> B) is believed
   // Enables spreading activation for premise selection
   ```

4. **`VariableIntroduction`** - Generalization
   ```javascript
   // (cat --> animal), (dog --> animal) -> ($x --> animal)
   ```

5. **`Evaluate`** - Functor execution
   ```javascript
   // add(1, 2) -> 3
   // intersect({A,B}, {B,C}) -> {B}
   ```

**Phase 3B - Medium Priority:**

6. **`DecomposeImpl`** - Non-temporal subset only
7. **`DecomposeCond`** - Non-temporal subset only

**Deferred (Temporal):**

- `STMLinker` - Requires temporal proximity
- All `TemporalInduction.*` - Requires `dt` support

---

## 11. Success Criteria

### Primary Phases Success

- [ ] All 19 operators defined in constants
- [ ] Pattern variable `%` parsed correctly
- [ ] Negation `(--,X)` and `--X` parsed
- [ ] All 5 punctuation types work
- [ ] 15+ truth functions implemented (core set)
- [ ] 5 high-priority native rules implemented
- [ ] Non-temporal rules from 7+ .nal files migrated (or manually translated)
- [ ] All existing tests pass
- [ ] New test coverage >80%

### Temporal Phases Success (Future)

- [ ] Term.dt property implemented
- [ ] Temporal operators parse with timing
- [ ] Temporal truth functions work
- [ ] All 24 .nal rule files fully migrated
- [ ] All temporal native rules implemented
- [ ] Temporal inference works end-to-end

---

## 12. Final Notes and Recommendations

### 12.1 Assessment Summary

| Question                         | Answer                                  |
|----------------------------------|-----------------------------------------|
| **Is it worth doing?**           | Yes, with focused scope                 |
| **Total effort (non-temporal)**  | ~2 weeks                                |
| **Total effort (with temporal)** | ~4 weeks                                |
| **Recommended approach**         | Native implementation over .nal parsing |

### 12.2 Recommended Minimal Viable Migration

For fastest value, implement only:

1. **6 operators** you'll actually use (NEG, DIFF, DELTA, pattern var)
2. **10 truth functions** (intersection, union, exemplification, conduct, sameness, etc.)
3. **5 native rules** (Decompose1, DecomposeStatement, TermLinking, VariableIntroduction, Evaluate)
4. **10-15 rules** manually translated from `inh.nal`, `sim.nal`, `conversion.nal`

This gets ~80% of inference capability in ~1 week.

### 12.3 Concerns and Caveats

| Item                 | Concern                         | Recommendation                          |
|----------------------|---------------------------------|-----------------------------------------|
| `DELTA` (Δ)          | Low usage, unclear value        | Defer unless needed                     |
| `DIFF` (<~>)         | Rarely used in enabled rules    | Low priority                            |
| `IMG` (/)            | NAL4-specific, complex          | Skip unless relational reasoning needed |
| `.nal` parser        | Significant effort for 40 rules | Manual translation faster               |
| 50+ truth functions  | Many are variants               | Start with 15 core, add on demand       |
| Pattern variable `%` | Internal rule matching only     | May not need in user-facing parser      |

### 12.4 Alternative Approaches Considered

1. **Full .nal parser** - Higher effort, more maintainable long-term
2. **Transpile .nal to JS** - One-time conversion, lose sync with Java
3. **Native implementation** - Recommended: faster, cleaner, JS-idiomatic

---

## 13. Document History

| Version | Date       | Changes                                                 |
|---------|------------|---------------------------------------------------------|
| 1.0     | 2025-12-10 | Initial draft with gap analysis                         |
| 2.0     | 2025-12-10 | Added complete operator/parsing/printing specs          |
| 3.0     | 2025-12-10 | Separated temporal phases, added compatibility analysis |
| 4.0     | 2025-12-10 | Added native rules, final assessment, recommendations   |

---

*Document Version: 4.0 (Final)*  
*Created: 2025-12-10*  
*Status: Complete - Ready for Execution*
