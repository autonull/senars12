# MeTTa TypeScript Implementation: Complete Development Plan

## Executive Summary

This plan delivers a modern, type-safe, high-performance MeTTa interpreter in TypeScript that exceeds the capabilities of the original JavaScript version while being **simpler, more maintainable, and more elegant**. The key insight is that TypeScript's advanced features (const enums, `using` declarations, decorators, variadic tuples, template literal types, Effect-TS) allow us to eliminate entire categories of boilerplate that existed in the JS version.

**Target**: TypeScript 5.5+, Node.js 20+, ESM-only, strict mode, Biome for linting/formatting, Vitest for testing, Turborepo for monorepo management.

---

## Part 1: Core Design Principles

### 1.1 The Seven Simplifications

| # | Principle | Implementation |
|---|---|---|
| 1 | **One Cache to Rule Them All** | Single `Cache<K,V>` replaces ReductionCache, MemoizationCache, SymbolTable |
| 2 | **One Error to Rule Them All** | Single `MeTTaError` with `ErrorCode` enum replaces 30+ error classes |
| 3 | **One Atom Representation** | Discriminated union with `const enum` replaces class hierarchy |
| 4 | **One Space Interface** | Single `Space` interface with multiple implementations |
| 5 | **One Operation Registry** | Type-safe registry with decorators replaces manual registration |
| 6 | **One Runtime** | Single `MeTTaRuntime` with Effect-TS replaces multiple runtime classes |
| 7 | **One Configuration** | Single config object with `satisfies` replaces ConfigManager |

### 1.2 Guiding Constraints

- **Zero-cost abstractions**: Every abstraction must compile to efficient JS
- **Immutable by default**: All data structures are immutable; use structural sharing
- **Effect-TS for all effects**: State, errors, concurrency, resources all go through Effect
- **Validation at boundaries**: Valibot for external input; internal code trusts types
- **Type-safe everywhere**: No `any`, no `as` casts except at FFI boundaries
- **Test everything**: >90% coverage, property-based tests for core algorithms

---

## Part 2: Architecture

### 2.1 Monorepo Structure

```
packages/
├── core/              # Atoms, parser, space interfaces
├── engine/            # Interpreter, reduction, unification, e-graph
├── types/             # Type system (HM inference)
├── stdlib/            # Standard library (grounded ops + .metta files)
├── extensions/        # Neural, SMT, VisualDebugger, PersistentSpace
├── runtime/           # Runtime, builder, config, IPC
├── testing/           # Testing framework, benchmarks
└── docs/              # Documentation, examples
```

### 2.2 Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Ergonomic API  (createMeTTa, evaluate, builder)        │  ← User-facing
├─────────────────────────────────────────────────────────┤
│  Effect Runtime  (structured concurrency, resources)    │  ← Effect-TS
├─────────────────────────────────────────────────────────┤
│  Interpreter Engine  (e-graph + reduction pipeline)     │  ← Hybrid
├─────────────────────────────────────────────────────────┤
│  Core  (atoms, unify, space, cache, errors)             │  ← Foundation
├─────────────────────────────────────────────────────────┤
│  Platform  (Node/Browser, IPC, config)                  │  ← Adapters
└─────────────────────────────────────────────────────────┘
```

---

## Part 3: Unified Abstractions

### 3.1 The Unified Cache

Replaces `ReductionCache`, `MemoizationCache`, `SymbolTable`, and any future caching needs.

```typescript
// packages/core/src/cache.ts
import { FinalizationRegistry as FR } from 'node:gc'; // or polyfill

export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'weak';

export interface CacheOptions<V> {
  readonly maxSize?: number;
  readonly ttl?: number;              // milliseconds
  readonly policy?: EvictionPolicy;
  readonly weakRefs?: boolean;        // Use FinalizationRegistry for V
  readonly onEvict?: (key: string, value: V) => void;
  readonly onHit?: (key: string) => void;
  readonly onMiss?: (key: string) => void;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly evictions: number;
  readonly hitRate: number;
}

export class Cache<V> implements Disposable {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly registry?: FinalizationRegistry<string>;
  private readonly refs = new Map<string, WeakRef<V>>();
  private stats = { hits: 0, misses: 0, evictions: 0 };
  
  constructor(private readonly opts: CacheOptions<V> = {}) {
    if (opts.weakRefs) {
      this.registry = new FinalizationRegistry((key: string) => {
        this.store.delete(key);
        this.refs.delete(key);
        this.stats.evictions++;
      });
    }
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      this.opts.onMiss?.(key);
      // Check weak refs
      if (this.opts.weakRefs) {
        const ref = this.refs.get(key);
        if (ref) {
          const val = ref.deref();
          if (val !== undefined) {
            this.store.set(key, { value: val, accessed: Date.now() });
            this.stats.hits++;
            this.opts.onHit?.(key);
            return val;
          }
        }
      }
      return undefined;
    }
    
    if (this.opts.ttl && Date.now() - entry.accessed > this.opts.ttl) {
      this.store.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    entry.accessed = Date.now();
    entry.hits++;
    this.stats.hits++;
    this.opts.onHit?.(key);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.opts.maxSize && this.store.size >= this.opts.maxSize) {
      this.evict();
    }
    
    this.store.set(key, { value, accessed: Date.now(), hits: 0 });
    
    if (this.opts.weakRefs && this.registry) {
      this.refs.set(key, new WeakRef(value));
      this.registry.register(value, key);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.store.clear();
    this.refs.clear();
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }

  [Symbol.dispose](): void {
    this.clear();
  }

  private evict(): void {
    const policy = this.opts.policy ?? 'lru';
    let victim: string | undefined;
    
    switch (policy) {
      case 'lru':
        victim = [...this.store.entries()]
          .sort((a, b) => a[1].accessed - b[1].accessed)[0]?.[0];
        break;
      case 'lfu':
        victim = [...this.store.entries()]
          .sort((a, b) => a[1].hits - b[1].hits)[0]?.[0];
        break;
      case 'fifo':
        victim = this.store.keys().next().value;
        break;
      case 'weak':
        // Let GC handle it
        return;
    }
    
    if (victim) {
      const entry = this.store.get(victim);
      if (entry) this.opts.onEvict?.(victim, entry.value);
      this.store.delete(victim);
      this.stats.evictions++;
    }
  }
}

interface CacheEntry<V> {
  value: V;
  accessed: number;
  hits: number;
}
```

**Usage examples**:
```typescript
// Symbol interning (full)
const symbols = new Cache<SymbolAtom>({ policy: 'fifo' });

// Symbol interning (weak, for open-ended execution)
const weakSymbols = new Cache<SymbolAtom>({ weakRefs: true });

// Reduction cache (LRU, 10k entries)
const reductions = new Cache<MeTTaAtom>({ maxSize: 10_000, policy: 'lru' });

// Memoization (TTL 5 minutes)
const memo = new Cache<MeTTaAtom>({ ttl: 5 * 60 * 1000 });
```

### 3.2 The Unified Error

Replaces 30+ error classes with a single error type and error codes.

```typescript
// packages/core/src/errors.ts
export enum ErrorCode {
  // Parse errors
  UNEXPECTED_TOKEN = 'UNEXPECTED_TOKEN',
  UNTERMINATED_STRING = 'UNTERMINATED_STRING',
  INVALID_ESCAPE = 'INVALID_ESCAPE',
  UNMATCHED_PAREN = 'UNMATCHED_PAREN',
  
  // Type errors
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  UNIFICATION_FAILED = 'UNIFICATION_FAILED',
  OCCURS_CHECK = 'OCCURS_CHECK',
  INFINITE_TYPE = 'INFINITE_TYPE',
  
  // Runtime errors
  UNBOUND_VARIABLE = 'UNBOUND_VARIABLE',
  UNKNOWN_OPERATION = 'UNKNOWN_OPERATION',
  INVALID_ARITY = 'INVALID_ARITY',
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  STACK_OVERFLOW = 'STACK_OVERFLOW',
  TIMEOUT = 'TIMEOUT',
  STEP_LIMIT = 'STEP_LIMIT',
  
  // Space errors
  SPACE_NOT_FOUND = 'SPACE_NOT_FOUND',
  DUPLICATE_ATOM = 'DUPLICATE_ATOM',
  
  // IO errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Extension errors
  TENSOR_SHAPE_MISMATCH = 'TENSOR_SHAPE_MISMATCH',
  SMT_UNSAT = 'SMT_UNSAT',
}

export class MeTTaError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly context?: Record<string, unknown>,
    readonly cause?: Error
  ) {
    super(`[${code}] ${message}`);
    this.name = 'MeTTaError';
  }

  static parse(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, msg, ctx);
  }

  static type(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(ErrorCode.TYPE_MISMATCH, msg, ctx);
  }

  static runtime(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(ErrorCode.UNBOUND_VARIABLE, msg, ctx);
  }
}
```

**Why this is better**:
- One error class to import, catch, and handle
- Error codes are exhaustive and type-safe
- Context is structured (not scattered across properties)
- Easy to serialize for IPC/logging
- Easy to add new error codes without creating new classes

### 3.3 The Unified Atom Representation

Uses `const enum` for zero-cost discriminated unions.

```typescript
// packages/core/src/atoms.ts
export const enum AtomKind {
  Symbol = 0,
  Variable = 1,
  Number = 2,
  String = 3,
  Expression = 4,
  Grounded = 5,
}

// Branded types for nominal typing
declare const AtomBrand: unique symbol;
export type Atom = { readonly [AtomBrand]: true };

export interface SymbolAtom extends Atom {
  readonly kind: AtomKind.Symbol;
  readonly value: string;
  readonly interned?: boolean;  // For fast equality
}

export interface VariableAtom extends Atom {
  readonly kind: AtomKind.Variable;
  readonly name: string;
}

export interface NumberAtom extends Atom {
  readonly kind: AtomKind.Number;
  readonly value: number;
}

export interface StringAtom extends Atom {
  readonly kind: AtomKind.String;
  readonly value: string;
}

export interface ExpressionAtom extends Atom {
  readonly kind: AtomKind.Expression;
  readonly operator: MeTTaAtom;
  readonly args: readonly MeTTaAtom[];
}

export interface GroundedAtom extends Atom {
  readonly kind: AtomKind.Grounded;
  readonly op: GroundedOp<any, any>;
  readonly args: readonly MeTTaAtom[];
}

export type MeTTaAtom =
  | SymbolAtom
  | VariableAtom
  | NumberAtom
  | StringAtom
  | ExpressionAtom
  | GroundedAtom;

// Smart constructors with const assertions
export const sym = (value: string): SymbolAtom => ({
  kind: AtomKind.Symbol,
  value,
});

export const varr = (name: string): VariableAtom => ({
  kind: AtomKind.Variable,
  name,
});

export const num = (value: number): NumberAtom => ({
  kind: AtomKind.Number,
  value,
});

export const str = (value: string): StringAtom => ({
  kind: AtomKind.String,
  value,
});

export const expr = (
  operator: MeTTaAtom,
  ...args: MeTTaAtom[]
): ExpressionAtom => ({
  kind: AtomKind.Expression,
  operator,
  args,
});

// Type guards
export const isSymbol = (a: MeTTaAtom): a is SymbolAtom =>
  a.kind === AtomKind.Symbol;
export const isVariable = (a: MeTTaAtom): a is VariableAtom =>
  a.kind === AtomKind.Variable;
export const isExpression = (a: MeTTaAtom): a is ExpressionAtom =>
  a.kind === AtomKind.Expression;
export const isGrounded = (a: MeTTaAtom): a is GroundedAtom =>
  a.kind === AtomKind.Grounded;
```

**Why this is better than classes**:
- `const enum` compiles to plain numbers → fastest possible dispatch in V8
- Plain objects are faster to create than class instances
- Structural typing allows easy serialization
- `readonly` everywhere ensures immutability
- No prototype chain overhead

### 3.4 The Unified Configuration

Uses `satisfies` for type-safe configuration without widening.

```typescript
// packages/runtime/src/config.ts
export interface MeTTaConfig {
  readonly maxSteps: number;
  readonly timeout: number;
  readonly caching: {
    readonly enabled: boolean;
    readonly reductionCacheSize: number;
    readonly memoizationTTL: number;
    readonly weakRefs: boolean;  // Use WeakRef for open-ended execution
  };
  readonly interning: {
    readonly enabled: boolean;
    readonly weakRefs: boolean;  // Use WeakRef for symbols
  };
  readonly jit: {
    readonly enabled: boolean;
    readonly threshold: number;  // Hotness threshold for JIT
  };
  readonly concurrency: {
    readonly workers: number;
    readonly ipc: 'shared-memory' | 'message-port' | 'none';
  };
  readonly types: {
    readonly enabled: boolean;
    readonly strict: boolean;
  };
  readonly debug: {
    readonly enabled: boolean;
    readonly trace: boolean;
    readonly visualizer: boolean;
  };
}

export const defaultConfig: MeTTaConfig = {
  maxSteps: 10_000,
  timeout: 30_000,
  caching: {
    enabled: true,
    reductionCacheSize: 10_000,
    memoizationTTL: 5 * 60 * 1000,
    weakRefs: false,
  },
  interning: {
    enabled: true,
    weakRefs: false,
  },
  jit: {
    enabled: false,
    threshold: 100,
  },
  concurrency: {
    workers: 1,
    ipc: 'none',
  },
  types: {
    enabled: true,
    strict: false,
  },
  debug: {
    enabled: false,
    trace: false,
    visualizer: false,
  },
} as const;

// Type-safe configuration with satisfies
export function createConfig(
  overrides: Partial<MeTTaConfig> = {}
): MeTTaConfig {
  return {
    ...defaultConfig,
    ...overrides,
    caching: { ...defaultConfig.caching, ...overrides.caching },
    interning: { ...defaultConfig.interning, ...overrides.interning },
    jit: { ...defaultConfig.jit, ...overrides.jit },
    concurrency: { ...defaultConfig.concurrency, ...overrides.concurrency },
    types: { ...defaultConfig.types, ...overrides.types },
    debug: { ...defaultConfig.debug, ...overrides.debug },
  } satisfies MeTTaConfig;
}

// Presets
export const presets = {
  development: createConfig({
    debug: { enabled: true, trace: true, visualizer: true },
    types: { enabled: true, strict: true },
  }),
  
  production: createConfig({
    caching: { enabled: true, weakRefs: false },
    jit: { enabled: true, threshold: 50 },
    concurrency: { workers: 4, ipc: 'shared-memory' },
  }),
  
  openEnded: createConfig({
    maxSteps: Infinity,
    timeout: Infinity,
    caching: { enabled: true, weakRefs: true },
    interning: { enabled: true, weakRefs: true },
  }),
} as const;
```

---

## Part 4: TypeScript Features to Leverage

### 4.1 Feature Matrix

| Feature | Use Case | Benefit |
|---|---|---|
| `const enum` | AtomKind, ErrorCode | Zero-cost discriminated unions |
| `using` declarations | Space, Cache, Runtime | Automatic resource cleanup |
| Decorators (stage 3) | `@MeTTaOp`, `@MeTTaType` | Eliminate registration boilerplate |
| Variadic tuples | Operation signatures | Type-safe variadic operations |
| Template literal types | `$name`, `&op`, `%Type` | Compile-time syntax validation |
| `satisfies` | Config, presets | Type-safe without widening |
| `as const` | Literals, presets | Preserve literal types |
| Const type parameters | `defineProgram<const T>` | Preserve tuple types |
| Conditional types | Type inference | Type-level computation |
| Mapped types | Type transformations | Generic type operations |
| `infer` keyword | Extract types | Type-level pattern matching |
| Branded types | Atom, Space | Nominal typing |
| `readonly` | All data structures | Immutability guarantees |
| `override` | Method overrides | Safety against refactoring |
| Exhaustiveness checks | `never` returns | Catch missing cases |
| `satisfies` | Config validation | Type-safe config |

### 4.2 Key Examples

#### 4.2.1 Resource Management with `using`

```typescript
// packages/runtime/src/space.ts
export class Space implements Disposable, AsyncDisposable {
  private readonly atoms = new Set<MeTTaAtom>();
  private readonly index = new RuleIndex();
  
  add(atom: MeTTaAtom): void {
    this.atoms.add(atom);
    this.index.add(atom);
  }

  [Symbol.dispose](): void {
    this.atoms.clear();
    this.index.clear();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    // Async cleanup (e.g., persist to disk)
    await this.persist();
    this[Symbol.dispose]();
  }
}

// Usage - automatic cleanup
function withSpace() {
  using space = new Space();
  space.add(sym('cat'));
  space.add(sym('dog'));
  // space is automatically disposed at end of scope
}

// Async usage
async function withAsyncSpace() {
  await using space = new Space();
  space.add(sym('cat'));
  // space is automatically disposed (async) at end of scope
}
```

#### 4.2.2 Decorators for Operation Registration

```typescript
// packages/stdlib/src/ops.ts
export function MeTTaOp(name: string) {
  return function <Args extends readonly MeTTaAtom[], Ret extends MeTTaAtom>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: Args) => Ret>
  ) {
    const original = descriptor.value!;
    descriptor.value = function (...args: Args) {
      return original.apply(this, args);
    };
    
    // Register the operation
    OperationRegistry.register(name, {
      name,
      execute: (...args: Args) => Effect.succeed(original(...args)),
    });
  };
}

export class ArithmeticOps {
  @MeTTaOp('+')
  add(a: NumberAtom, b: NumberAtom): NumberAtom {
    return num(a.value + b.value);
  }

  @MeTTaOp('-')
  sub(a: NumberAtom, b: NumberAtom): NumberAtom {
    return num(a.value - b.value);
  }

  @MeTTaOp('*')
  mul(a: NumberAtom, b: NumberAtom): NumberAtom {
    return num(a.value * b.value);
  }

  @MeTTaOp('/')
  div(a: NumberAtom, b: NumberAtom): NumberAtom {
    if (b.value === 0) throw new MeTTaError(ErrorCode.DIVISION_BY_ZERO, 'Division by zero');
    return num(a.value / b.value);
  }
}
```

#### 4.2.3 Variadic Tuples for Type-Safe Operations

```typescript
// packages/core/src/ops.ts
export interface GroundedOp<
  Args extends readonly MeTTaAtom[] = readonly MeTTaAtom[],
  Ret extends MeTTaAtom = MeTTaAtom
> {
  readonly name: string;
  readonly execute: (...args: Args) => Effect.Effect<Ret, MeTTaError>;
  readonly pure?: boolean;
  readonly lazy?: boolean;
}

export function defineOp<
  Args extends readonly MeTTaAtom[],
  Ret extends MeTTaAtom
>(
  name: string,
  impl: (...args: Args) => Effect.Effect<Ret, MeTTaError>,
  opts?: { pure?: boolean; lazy?: boolean }
): GroundedOp<Args, Ret> {
  return {
    name,
    execute: impl,
    pure: opts?.pure ?? true,
    lazy: opts?.lazy ?? false,
  };
}

// Usage - fully type-safe
const addOp = defineOp(
  '+',
  (a: NumberAtom, b: NumberAtom) => Effect.succeed(num(a.value + b.value))
);

const mapOp = defineOp(
  'map',
  (f: GroundedAtom, list: ExpressionAtom) =>
    Effect.succeed(/* ... */) as Effect.Effect<ExpressionAtom>
);
```

#### 4.2.4 Template Literal Types for Syntax Validation

```typescript
// packages/core/src/syntax.ts
export type VariableName = `$${string}`;
export type OperationName = `&${string}`;
export type TypeName = `%${string}`;
export type Keyword = 'True' | 'False' | 'Nil' | 'superpose' | 'match' | 'let';

// Compile-time validation
export type ValidateAtom<S extends string> =
  S extends VariableName ? 'variable' :
  S extends OperationName ? 'operation' :
  S extends TypeName ? 'type' :
  S extends Keyword ? 'keyword' :
  'symbol';

// Type-safe atom creation
export function createAtom<S extends string>(
  value: S
): MeTTaAtom {
  const kind = ValidateAtom<S>;
  switch (kind) {
    case 'variable': return varr(value);
    case 'operation': return sym(value);
    case 'type': return sym(value);
    case 'keyword': return sym(value);
    case 'symbol': return sym(value);
  }
}
```

#### 4.2.5 Const Type Parameters for Literal Preservation

```typescript
// packages/core/src/program.ts
export function defineProgram<const T extends readonly MeTTaAtom[]>(
  program: T
): T {
  return program;
}

// Usage - preserves exact tuple type
const program = defineProgram([
  expr(sym('+'), num(1), num(2)),
  expr(sym('print'), str('hello')),
]);
// program type: readonly [ExpressionAtom, ExpressionAtom]
```

#### 4.2.6 Type-Level MeTTa Type Checker

```typescript
// packages/types/src/checker.ts
export type TypeContext = Record<string, MeTTaType>;

export type InferType<T, Ctx extends TypeContext = {}> =
  T extends NumberAtom ? TypeConstructors.Number :
  T extends StringAtom ? TypeConstructors.String :
  T extends SymbolAtom ? LookupType<T['value'], Ctx> :
  T extends VariableAtom ? TypeVar<T['name']> :
  T extends ExpressionAtom ?
    T['operator'] extends SymbolAtom ?
      LookupType<T['operator']['value'], Ctx> extends infer OpType ?
        OpType extends ArrowType<infer From, infer To> ?
          T['args'] extends [infer First, ...infer Rest] ?
            Unify<InferType<First, Ctx>, From> extends infer S ?
              S extends Substitution ?
                InferType<
                  { operator: T['operator']; args: Rest },
                  ApplySubst<Ctx, S>
                >
              : never
            : never
          : To
        : never
      : never
    : never
  : never;
```

---

## Part 5: Phased Development Plan

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Core data structures, parser, space interfaces, unified abstractions.

**Deliverables**:
- [ ] `packages/core/src/atoms.ts` - Atom types with const enum
- [ ] `packages/core/src/cache.ts` - Unified Cache with all policies
- [ ] `packages/core/src/errors.ts` - Unified MeTTaError with codes
- [ ] `packages/core/src/parser.ts` - Single parser (no separate tokenizer)
- [ ] `packages/core/src/space.ts` - Space interface + basic implementation
- [ ] `packages/core/src/hash.ts` - Structural hashing for atoms
- [ ] `packages/core/src/intern.ts` - Symbol interning (full + weak)
- [ ] Tests for all above (>95% coverage)

**TypeScript features**: `const enum`, branded types, `readonly`, `using`

**Acceptance criteria**:
- Can parse any valid MeTTa program
- Cache supports all eviction policies
- Symbol interning works in both full and weak modes
- All tests pass

### Phase 2: Engine (Weeks 3-5)

**Goal**: Interpreter, reduction pipeline, unification, e-graph.

**Deliverables**:
- [ ] `packages/engine/src/unify.ts` - Full unification with occurs check
- [ ] `packages/engine/src/match.ts` - Pattern matching
- [ ] `packages/engine/src/reduce.ts` - Multi-stage reduction pipeline
- [ ] `packages/engine/src/egraph.ts` - E-graph with equality saturation
- [ ] `packages/engine/src/interpreter.ts` - Hybrid interpreter (e-graph + reduction)
- [ ] `packages/engine/src/zipper.ts` - Tree traversal
- [ ] `packages/engine/src/closure.ts` - Higher-order functions
- [ ] `packages/engine/src/superpose.ts` - Non-determinism
- [ ] Tests for all above

**TypeScript features**: Effect-TS, variadic tuples, conditional types

**Acceptance criteria**:
- Can evaluate any MeTTa program from the JS test suite
- Unification handles all cases (occurs check, cons-lists, etc.)
- E-graph correctly implements equality saturation
- Performance parity with JS version on benchmarks

### Phase 3: Type System (Weeks 6-7)

**Goal**: Hindley-Milner type inference, type checking.

**Deliverables**:
- [ ] `packages/types/src/types.ts` - Type constructors (Base, Arrow, List, etc.)
- [ ] `packages/types/src/infer.ts` - HM type inference
- [ ] `packages/types/src/constraints.ts` - Constraint generation
- [ ] `packages/types/src/unify.ts` - Type unification
- [ ] `packages/types/src/checker.ts` - Type checker
- [ ] `packages/types/src/substitution.ts` - Substitution application
- [ ] Tests for all above

**TypeScript features**: Type-level programming, conditional types, mapped types

**Acceptance criteria**:
- Can infer types for all standard library functions
- Type errors are caught at compile time (TypeScript level)
- Type errors are caught at runtime (MeTTa level)

### Phase 4: Standard Library (Weeks 8-9)

**Goal**: Grounded operations, .metta stdlib files.

**Deliverables**:
- [ ] `packages/stdlib/src/ops/` - All operation categories:
  - [ ] `arithmetic.ts` - +, -, *, /, %, ^, etc.
  - [ ] `comparison.ts` - ==, !=, <, >, <=, >=, etc.
  - [ ] `list.ts` - cons, car, cdr, append, map, filter, etc.
  - [ ] `string.ts` - concat, length, substring, etc.
  - [ ] `io.ts` - print, read, write, etc.
  - [ ] `time.ts` - now, sleep, etc.
  - [ ] `math.ts` - sin, cos, sqrt, etc.
  - [ ] `set.ts` - union, intersect, difference, etc.
  - [ ] `hof.ts` - map, filter, reduce, etc.
  - [ ] `reflection.ts` - type-of, eval, etc.
- [ ] `packages/stdlib/src/metta/` - All .metta files:
  - [ ] `core.metta`
  - [ ] `list.metta`
  - [ ] `hof.metta`
  - [ ] `match.metta`
  - [ ] `types.metta`
  - [ ] `io.metta`
  - [ ] `js.metta`
  - [ ] `memory.metta`
  - [ ] `channels.metta`
- [ ] Tests for all above

**TypeScript features**: Decorators, variadic tuples

**Acceptance criteria**:
- All stdlib operations work correctly
- All .metta files load and execute correctly
- 100% compatibility with JS stdlib

### Phase 5: Extensions (Weeks 10-12)

**Goal**: Neural, SMT, VisualDebugger, PersistentSpace, etc.

**Deliverables**:
- [ ] `packages/extensions/src/neural/` - NeuralBridge
- [ ] `packages/extensions/src/smt/` - SMTBridge
- [ ] `packages/extensions/src/debug/` - VisualDebugger
- [ ] `packages/extensions/src/persistent/` - PersistentSpace
- [ ] `packages/extensions/src/channel/` - ChannelExtension
- [ ] `packages/extensions/src/memory/` - MemoryExtension
- [ ] `packages/extensions/src/nars/` - NarsExtension
- [ ] Tests for all above

**TypeScript features**: Effect-TS, async/await

**Acceptance criteria**:
- All extensions work correctly
- Extensions integrate seamlessly with core

### Phase 6: Performance (Weeks 13-14)

**Goal**: Optimize for performance parity/exceedance.

**Deliverables**:
- [ ] Benchmark suite (startup, parse, reduce, memory, throughput)
- [ ] JIT compiler (compile hot patterns to `new Function()`)
- [ ] Parallel execution (Effect.all with workers)
- [ ] SharedArrayBuffer IPC (share e-graph, cache, space)
- [ ] Performance optimizations:
  - [ ] Fast paths for common operations
  - [ ] Inline small functions
  - [ ] Optimize hash functions
  - [ ] Optimize cache lookups
  - [ ] Optimize atom creation
- [ ] Performance report comparing to JS version

**TypeScript features**: `const enum`, `@__PURE__`, `@__INLINE__`

**Acceptance criteria**:
- Performance parity with JS version on all benchmarks
- At least 20% improvement on at least 3 benchmarks
- Memory usage within 10% of JS version

### Phase 7: Ergonomics (Week 15)

**Goal**: Builder pattern, configuration, API.

**Deliverables**:
- [ ] `packages/runtime/src/builder.ts` - MeTTaBuilder
- [ ] `packages/runtime/src/config.ts` - Configuration system
- [ ] `packages/runtime/src/api.ts` - Public API (createMeTTa, evaluate, etc.)
- [ ] `packages/runtime/src/presets.ts` - Configuration presets
- [ ] Documentation for API

**TypeScript features**: `satisfies`, `as const`, builder pattern

**Acceptance criteria**:
- API is intuitive and type-safe
- Builder pattern works correctly
- Presets work correctly

### Phase 8: Testing (Week 16)

**Goal**: Testing framework, comprehensive tests.

**Deliverables**:
- [ ] `packages/testing/src/framework.ts` - Testing framework
- [ ] `packages/testing/src/benchmarks.ts` - Benchmark suite
- [ ] `packages/testing/src/properties.ts` - Property-based tests
- [ ] Comprehensive test suite (>90% coverage)
- [ ] Test report

**TypeScript features**: Vitest, property-based testing

**Acceptance criteria**:
- >90% code coverage
- All tests pass
- Property-based tests catch edge cases

### Phase 9: Documentation (Week 17)

**Goal**: Documentation, examples, migration guide.

**Deliverables**:
- [ ] API documentation (TypeDoc)
- [ ] User guide
- [ ] Developer guide
- [ ] Migration guide (from JS to TS)
- [ ] Examples (10+ examples)
- [ ] Performance guide

**Acceptance criteria**:
- Documentation is comprehensive
- Examples work correctly
- Migration guide is clear

---

## Part 6: Performance Strategy

### 6.1 Benchmarking

Create a comprehensive benchmark suite:

```typescript
// packages/testing/src/benchmarks.ts
import { bench } from 'vitest';

bench('parse: small program', () => {
  parse('(= (add $x $y) (+ $x $y))');
});

bench('parse: large program', () => {
  parse(largeProgram);
});

bench('reduce: fibonacci', () => {
  evaluate('(fib 10)');
});

bench('reduce: list operations', () => {
  evaluate('(map (lambda $x (+ $x 1)) (list 1 2 3 4 5))');
});

bench('memory: large space', () => {
  const space = new Space();
  for (let i = 0; i < 100_000; i++) {
    space.add(sym(`sym${i}`));
  }
});

bench('throughput: reductions per second', () => {
  let count = 0;
  const start = Date.now();
  while (Date.now() - start < 1000) {
    evaluate('(= (add $x $y) (+ $x $y))');
    count++;
  }
  return count;
});
```

### 6.2 Optimization Techniques

1. **Const enum for atom kinds**: Fastest possible dispatch
2. **Symbol interning**: O(1) equality checks
3. **Structural hashing**: Fast hash computation
4. **Unified cache**: Single cache with optimal eviction
5. **Effect-TS**: Structured concurrency without overhead
6. **JIT compilation**: Compile hot patterns to native code
7. **Parallel execution**: Use all CPU cores
8. **SharedArrayBuffer**: Share data across threads
9. **Inline small functions**: Reduce call overhead
10. **Optimize hash functions**: Use FNV-1a or similar

### 6.3 Performance Targets

| Benchmark | JS Version | TS Target | TS Stretch |
|---|---|---|---|
| Parse small program | 100μs | 80μs | 50μs |
| Parse large program | 10ms | 8ms | 5ms |
| Reduce fibonacci(10) | 1ms | 0.8ms | 0.5ms |
| Reduce list operations | 5ms | 4ms | 2ms |
| Memory (100k atoms) | 50MB | 45MB | 40MB |
| Throughput | 10k/s | 12k/s | 15k/s |

---

## Part 7: Success Criteria

### 7.1 Functional Criteria

- [ ] 100% compatibility with JS version's functionality
- [ ] All JS tests pass on TS version
- [ ] All extensions work correctly
- [ ] Type system is sound and complete

### 7.2 Performance Criteria

- [ ] Performance parity with JS version on all benchmarks
- [ ] At least 20% improvement on at least 3 benchmarks
- [ ] Memory usage within 10% of JS version
- [ ] Startup time < 100ms

### 7.3 Quality Criteria

- [ ] >90% code coverage
- [ ] Zero TypeScript errors in strict mode
- [ ] Zero linting errors
- [ ] All code formatted with Biome
- [ ] Comprehensive documentation

### 7.4 Maintainability Criteria

- [ ] Code is simpler than JS version (fewer lines, fewer abstractions)
- [ ] All abstractions are unified (one cache, one error, etc.)
- [ ] TypeScript features are used effectively
- [ ] Code is easy to understand and modify

---

## Part 8: Migration Path

### 8.1 From Current TS Version

1. **Week 1**: Replace current atom representation with const enum version
2. **Week 2**: Implement unified Cache and replace all caches
3. **Week 3**: Implement unified Error and replace all error classes
4. **Week 4**: Implement unified Config and replace ConfigManager
5. **Week 5-17**: Follow phased plan above

### 8.2 From JS Version

1. **Port core data structures** (atoms, parser, space) with TypeScript types
2. **Port engine** (interpreter, reduction, unification) with Effect-TS
3. **Port type system** with type-level programming
4. **Port stdlib** with decorators
5. **Port extensions** with async/await
6. **Optimize** with const enums, JIT, parallel execution

---

## Conclusion

This plan delivers a modern, type-safe, high-performance MeTTa interpreter that:

1. **Simplifies** the codebase through unified abstractions (one cache, one error, one config)
2. **Leverages** TypeScript's advanced features (const enum, `using`, decorators, variadic tuples, template literal types)
3. **Exceeds** the JS version's performance through modern optimization techniques
4. **Maintains** 100% compatibility with the JS version's functionality
5. **Provides** a clear, actionable path from current state to final state

The key insight is that TypeScript's advanced features allow us to eliminate entire categories of boilerplate that existed in the JS version, resulting in code that is **simpler, more maintainable, and more elegant** while being **faster and more type-safe**.

---

### Critical Issues & Improvements

#### 1. Cache Implementation (Biggest Red Flag)
Your current `Cache` is elegant but has performance traps:

- **LRU/LFU eviction** doing `Array.from().sort()` on every `set()` when full is **O(n log n)** — catastrophic at 10k+ size.
- **Fix**: Use a proper `LRUCache` implementation (doubly-linked list + Map) or `lru-cache` package for the hot path. Keep your unified interface, but delegate policy implementations.

**Recommendation**:
```ts
export class Cache<V> implements Disposable {
  private impl: MapBasedCache<V> | WeakRefCache<V>;

  constructor(opts: CacheOptions<V> = {}) {
    this.impl = opts.weakRefs 
      ? new WeakRefCache(opts)
      : new MapBasedCache(opts); // contains optimized LRU/LFU/etc.
  }
}
```

Also consider `quick-lru` or rolling your own minimal high-perf version for tree-shaking.

#### 2. Atom Representation — Make It Even Better
Current design is great, but add these:

```ts
export type MeTTaAtom = 
  | SymbolAtom 
  | VariableAtom 
  | NumberAtom 
  | StringAtom 
  | ExpressionAtom 
  | GroundedAtom;

export const hashAtom = (a: MeTTaAtom): string => { /* FNV-1a or xxHash */ };
export const equalAtoms = (a: MeTTaAtom, b: MeTTaAtom): boolean => { /* structural */ };
```

Make `ExpressionAtom` use a **frozen tuple** for `args` and consider a small-object pool for very common small expressions (common in reduction).

`GroundedAtom` should probably hold the *name* + a reference to the op registry rather than the full op object for better serialization/IPC.

#### 3. Configuration Merging
Your `createConfig` has a classic shallow-merge bug on nested objects.

**Better**:
```ts
import { merge } from 'es-toolkit'; // or lodash.merge, or tiny custom deepMerge

export function createConfig(overrides: Partial<MeTTaConfig> = {}): MeTTaConfig {
  return merge(defaultConfig, overrides) satisfies MeTTaConfig;
}
```

Or write a 10-line typed deep merge if you want zero deps.

#### 4. Decorators
The decorator example is too naive (it doesn't actually register properly in the current form).

**Better approach** (stage 3 decorators + metadata):

Use `Symbol.metadata` + a module-level registry, or better — a **decorator factory that returns the op definition** and lets you collect them via a `registerOps()` call. This is cleaner for bundlers/tree-shaking.

Alternatively, use **effector** or **ts-pattern** style for some operations if decorators feel too magical.

### Additional High-Value Suggestions

**1. Parser Strategy**
- Don’t write a single hand-rolled parser if you want speed + correctness. Use **Nearley.js** + custom tokenizer or **lezer** (from CodeMirror) for excellent error recovery and performance.
- Or go full hardcore: write a hand-optimized recursive descent with **zero regex** for maximum speed.
- Or use `peggy` like we use in SeNARS?

**2. E-Graph**
This is the hardest part. Strongly consider porting or heavily inspiring from:
- `egraph` TypeScript implementations

Equality saturation is notoriously subtle. Make the e-graph the *core* data structure early.

**3. Performance Reality Check**
Your stretch targets are aggressive. Prioritize:
1. Symbol interning + structural hashing
2. Fast path for common patterns (`(+ $x $y)` etc.)
3. E-graph rewrites
4. JIT only for *very* hot inner loops

**4. Developer Experience Wins**
- `create-metta` CLI with templates.
- Excellent error messages with context (you already have `context` in errors — use it).

**5. Testing**
- Use **fast-check** for property-based testing on unification and reduction. This will catch bugs that normal tests miss.
- Add **fuzzing** of the parser with random valid MeTTa programs.

### Minor Polish
- Use `brand` + `Extract` patterns more for nominal types.
- Consider `ts-pattern` for atom matching — it’s excellent with discriminated unions.
- Make everything `export type` where possible for better bundler support.
- Add `/// <reference ...>` or proper module augmentation for grounded ops.

