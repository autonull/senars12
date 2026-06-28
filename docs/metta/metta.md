# MeTTa Language Specification

> Comprehensive specification distilled from OpenCog Hyperon documentation to guide our reimplementation.

---

## 1. Overview

MeTTa (Meta Type Talk) is a multi-paradigm, reflective programming language designed for Artificial General Intelligence. It operates on a dynamic **Atomspace** metagraph, enabling pattern-matching queries, rewriting, and self-modifying code at runtime.

### 1.1 Design Philosophy

- **Reflective metagraph rewriting**: Programs modify their own code and data structures
- **Cognitive science inspired**: Incorporates cognition principles without rigid biological replication
- **Scalable and distributed**: Modular design for multi-node deployment
- **Multi-paradigm**: Blends functional, logical, probabilistic, and neural-symbolic approaches
- **Beneficial AGI**: Path toward human-level and beyond general intelligence

### 1.2 Key Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Syntax** | S-expression based with atoms as base unit |
| **Programs** | Subgraphs of the Atomspace metagraph |
| **Reflection** | Programs can read/modify their own code at runtime |
| **Types** | Gradual dependent types for mathematical reasoning |
| **Uncertainty** | Integrated probabilistic logic (PLN, fuzzy logic) |
| **Nondeterminism** | Superposition/collapse execution model |
| **Development Status** | Pre-alpha; targeting Alpha release |

---

## 2. Core Architecture

### 2.1 Three Primary Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (Cognitive algorithms, agents, domain applications)        │
├─────────────────────────────────────────────────────────────┤
│                    Integration Layer                        │
│  (Python/C/WASM bindings, Jupyter, modules, DAS)           │
├─────────────────────────────────────────────────────────────┤
│                    Runtime Layer (Hyperon)                  │
│  (Execution engine, Atomspace management, scheduling)       │
├─────────────────────────────────────────────────────────────┤
│                    Language Layer (MeTTa)                   │
│  (Parser, pattern matching, unification, type system)       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Rust Implementation Structure

The canonical implementation uses Rust with the following crate organization:

| Crate | Purpose |
|-------|---------|
| `hyperon-common` | General utilities and data structures |
| `hyperon-atom` | Core Atom and Atomspace APIs for built-in modules |
| `lib` | MeTTa Atomspace storage and interpreter |
| `libhyperonc` | C API (in `/c` folder) for language bindings |
| `libhyperonpy` | Python bindings via pybind11 |

### 2.3 Build System

| Component | Technology |
|-----------|------------|
| Build | Cargo (Rust), CMake |
| Dependencies | Conan (libcheck, protobuf, OpenSSL, Zlib) |
| IDE Support | Rust Analyzer, Clangd, Python LSP |

---

## 3. Core Language Constructs

### 3.1 Atom Types

| Atom Type | Description | Syntax | Status |
|-----------|-------------|--------|--------|
| **Symbol** | Named identifiers | `foo`, `Person`, `+` | ✓ Implemented |
| **Variable** | Pattern placeholders | `$x`, `$name` ($ prefix) | ✓ Implemented |
| **Expression** | S-expression trees | `(add $x 1)` | ✓ Implemented |
| **Grounded Atom** | External values | Python/C/WASM objects | ✓ Implemented |

### 3.2 Core Operators

| Operator | Syntax | Purpose | Status |
|----------|--------|---------|--------|
| **Define** | `(= pattern replacement)` | Define rewrite rules | ✓ Implemented |
| **Type** | `(: symbol Type)` | Declare type of symbol | ✓ Implemented |
| **Evaluate** | `(! expression)` | Force evaluation | ✓ Implemented |
| **Match** | `(match &space pattern template)` | Pattern match on space | ✓ Implemented |
| **Query** | `(query &space pattern)` | Execute query with bindings | ✓ Implemented |
| **Quote** | `(quote expr)` | Quote expression as literal | ✓ Implemented |
| **Transform** | `(transform expr)` | Expression transformation | ✓ Implemented |
| **Chain** | `(chain ...)` | Backward chaining | ✓ Implemented |
| **Eval** | `(eval expr)` | Expression evaluation | ✓ Implemented |
| **Unify** | `(unify pattern1 pattern2)` | Unification of patterns | ✓ Implemented |

### 3.3 Control Flow

| Construct | Syntax | Purpose | Status |
|-----------|--------|---------|--------|
| **Conditional** | `(if cond then else)` | Conditional execution | ✓ Implemented |
| **Case** | `(case expr ...)` | Case expressions | ✓ Implemented |
| **Superpose** | `(superpose (a b c))` | Nondeterministic choice | ✓ Implemented |
| **Collapse** | `(collapse expr)` | Collapse to single value | ✓ Implemented |
| **Collapse-bind** | `(collapse-bind expr)` | Collapse with bindings | ✓ Implemented |
| **Superpose-bind** | `(superpose-bind expr)` | Superpose with bindings | ✓ Implemented |
| **Do** | `(do)` | Empty tuple (None) | ✓ Implemented |
| **Recursion** | Via self-referencing rules | Recursive evaluation | ✓ Implemented |
| **Looping** | Via recursion patterns | Iterative constructs | ✓ Partial |

### 3.4 Arithmetic Operations

| Category | Operations | Status |
|----------|------------|--------|
| **Basic** | `+`, `-`, `*`, `/`, `%` | ✓ Implemented |
| **Power** | `pow`, `pow-math` | ✓ Implemented |
| **Rounding** | `trunc-math`, `ceil-math`, `floor-math`, `round-math` | ✓ Implemented |
| **Utilities** | `abs`, `min-atom`, `max-atom` | ✓ Implemented |
| **Trigonometric** | `sin-math`, `cos-math`, `tan-math`, `atan-math` | ✓ Implemented |
| **Exponential** | `sqrt-math`, `log-math`, `exp-math` | ✓ Implemented |
| **Testing** | `isnan-math` | ✓ Implemented |

### 3.5 List & Tuple Operations

| Operation | Purpose | Status |
|-----------|---------|--------|
| `cons-atom` | Construct cons cell/list | ✓ Implemented |
| `decons-atom` | Deconstruct list (head/tail) | ✓ Implemented |
| `map` | Apply function to each element | ✓ Implemented |
| `TupleConcat` | Concatenate tuples | ✓ Implemented |

### 3.6 String Operations

| Status | Notes |
|--------|-------|
| Under development | Part of standard library expansion |

---

## 4. Atomspace

The **Atomspace** is a self-modifying metagraph serving as the central memory and knowledge base.

### 4.1 Core Operations

| Operation | Purpose | Status |
|-----------|---------|--------|
| `addAtom` | Add atom to atomspace | ✓ Implemented |
| `remAtom` | Remove atom from atomspace | ✓ Implemented |
| `get-atoms` | Retrieve atoms from space | ✓ Implemented |
| `atom-count` | Count atoms in atomspace | ✓ Implemented |
| `atom-replace` | Replace atom in space | ✓ Implemented |
| `match` | Bidirectional pattern matching | ✓ Implemented |
| `matchEV` | Embedding vector matching (ε threshold) | ✓ Implemented |

### 4.2 Variable Binding Operations

| Operation | Purpose | Status |
|-----------|---------|--------|
| `add_var_binding` | Add variable-to-atom association | ✓ Implemented |
| `resolve` | Find atom for given variable | ✓ Implemented |
| `narrow_vars` | Narrow variable set | ✓ Implemented |
| `merge` | Merge binding sets | ✓ Implemented |
| `add_var_equality` | Assert variable equality | ✓ Implemented |
| `is_empty` | Check if bindings empty | ✓ Implemented |

### 4.3 Graph Structure

| Feature | Description | Status |
|---------|-------------|--------|
| Nodes | Basic atomic units | ✓ Implemented |
| Links | Relationships between atoms | ✓ Implemented |
| Truth values | Uncertainty/confidence | ✓ Implemented |
| Atom indexing | Fast lookup | ✓ Implemented |

### 4.4 Scalability Features

| Feature | Description | Status |
|---------|-------------|--------|
| Distributed storage | Knowledge across network nodes | Planned (DAS) |
| State synchronization | Sync across nodes | Planned |
| Persistent storage | Serialize to disk | Planned |
| Garbage collection | Memory optimization | Planned |
| Billion-atom scale | Single workstation: 1B+ atoms | ✓ Demonstrated |

---

## 5. Type System

### 5.1 Implemented Features

| Feature | Syntax | Status |
|---------|--------|--------|
| Type declarations | `(: symbol Type)` | ✓ Implemented |
| Function types | `(: func (-> Input Output))` | ✓ Implemented |
| Type restriction | `->` operator | ✓ Implemented |
| Type universe | `Type` symbol | ✓ Implemented |
| Gradual typing | Runtime inference | ✓ Implemented |
| Informal typing | Based on atom structure | ✓ Implemented |

### 5.2 Dependent Types (Advanced)

| Feature | Description | Status |
|---------|-------------|--------|
| Type predicates | Types depending on values | ✓ Partial (pln-experimental) |
| Compile-time verification | Property verification | ✓ Partial |
| Mathematical reasoning | Built-in type algebra | ✓ Partial |

**Location:** `pln-experimental/metta/dependent-types/`

### 5.3 Planned Features

- Full static type checking
- Complete dependent type support
- Type inference optimization

---

## 6. Module System

### 6.1 Import Directives

```metta
(import! &space module-name)     ; Load MeTTa module into space
(import-py! module-name)          ; Load Python module into MeTTa
(include! ./path/to/file.metta)   ; Include local MeTTa file
```

### 6.2 Module Sources

| Source | Description | Status |
|--------|-------------|--------|
| Local files | Direct path imports | ✓ Implemented |
| Git-based | Load from git repos (default) | ✓ Implemented |
| HTTP URLs | Remote module loading | ✓ Implemented |
| Package registry | Central repository | ✓ Active (metta-catalog) |

### 6.3 Package Management

- **Namespace management**: Isolated, composable units
- **Package resolution**: Disk, git, central repository
- **Default resolver**: `$PYTHONPATH` for Python modules
- **Cargo/pip integration**: Standard package managers

---

## 7. Grounding Interface (FFI)

### 7.1 Python API

| Component | Purpose | Status |
|-----------|---------|--------|
| `GroundedAtom` | Wrapper for native operations | ✓ Implemented |
| `execute` | Call grounded operation | ✓ Implemented |
| `match_` | Pattern matching on grounded | ✓ Implemented |
| `ValueAtom` | Wrap Python values | ✓ Implemented |
| `PrimitiveAtom` | Wrap primitives without conversion | ✓ Implemented |
| `MatchableAtom` | Wrap matchable objects | ✓ Implemented |

**Reference:** `hyperon-experimental/python/hyperon/atoms.py`

### 7.2 Language Bindings

| Language | Interface | Status |
|----------|-----------|--------|
| Python | `hyperon` PyPI package, pybind11 | ✓ Implemented |
| C/C++ | libhyperonc C API | ✓ Implemented |
| WASM | WebAssembly integration | ✓ Implemented |
| Rust | Native libhyperon | ✓ Implemented |

### 7.3 Neural-Symbolic Integration

| Feature | Description | Status |
|---------|-------------|--------|
| PyTorch objects | Direct neural module integration | ✓ Available |
| SAT solver | Via grounded atoms | ✓ Available |
| Hybrid learning | Neural + symbolic combined | ✓ Available |

---

## 8. Pattern Matching & Unification

### 8.1 Matching Modes

| Mode | Description | Status |
|------|-------------|--------|
| Bidirectional unification | Triemap-based | ✓ Implemented |
| Embedding vector | `matchEV` with ε threshold | ✓ Implemented |
| Declarative shape queries | Native database queries | ✓ Implemented |

### 8.2 Implementation Details

- **Triemap optimization**: Efficient S-expression matching
- **High cache locality**: Optimized memory access
- **Full relational algebra**: Union, intersection, set subtraction
- **Lazy evaluation**: Constant-time operations where possible
- **Variable binding**: Full support during unification

---

## 9. Inference Algorithms

### 9.1 Chaining Inference

| Algorithm | Description | Repository | Status |
|-----------|-------------|------------|--------|
| Forward chaining | Data-driven inference | `trueagi-io/chaining` | ✓ Active |
| Backward chaining | Goal-directed deduction | `trueagi-io/chaining` | ✓ Active |
| Converters | Transform between modes | `trueagi-io/chaining` | ✓ Active |

### 9.2 Probabilistic Logic Networks (PLN)

**Repository:** `trueagi-io/pln-experimental`

| Approach | Description | Status |
|----------|-------------|--------|
| Proofs as match queries | Pattern matching based | ✓ Implemented |
| Proofs as atom structures | Atom representation | ✓ Implemented |
| Proofs with dependent types | Most advanced | ✓ Research |
| Generic program synthesizer | Automatic theorem proving | ✓ Research |

**PLN Features:**
- Probabilistic truth values
- Uncertainty handling
- Confidence estimation
- Multi-step reasoning
- Hypothesis generation
- Self-improvement support

**Key Files:**
- `DeductionDTLTest.metta`
- `ImplicationDirectIntroductionDTLTest.metta`
- `DeductionImplicationDirectIntroductionDTLTest.metta`

### 9.3 Pattern Mining

**Repository:** `trueagi-io/hyperon-miner`

| Feature | Description | Status |
|---------|-------------|--------|
| Port of OpenCog miner | Prolog-based | ✓ Active |
| Frequent subgraph discovery | Find recurring patterns | ✓ Implemented |
| Concept formation | Via patterns | ✓ Implemented |
| Constraint-based filtering | Pattern constraints | ✓ Implemented |
| Scalable extraction | Large knowledge bases | ✓ Implemented |

### 9.4 MOSES (Evolutionary Synthesis)

**Repository:** `trueagi-io/hyperon-moses`

| Feature | Description | Status |
|---------|-------------|--------|
| Genetic programming | Fitness-guided evolution | ✓ Active |
| Program synthesis | Automatic generation | ✓ Implemented |
| Hyperparameter optimization | Tuning via evolution | ✓ Implemented |
| Feature engineering | Automatic discovery | ✓ Implemented |
| LLM-guided search | Neural integration (RFP) | Planned |
| Concept blending | Semantic similarity (RFP) | Planned |

### 9.5 NARS (Non-Axiomatic Reasoning)

| Component | Description | Status |
|-----------|-------------|--------|
| Logic component | NAL inference rules, truth functions | ✓ Partial |
| Temporal reasoning | Sequence & temporal implication | ✓ Partial |
| Procedural memory | Decision making with subgoaling | ✓ Partial |
| Declarative memory | Fact storage and retrieval | ✓ Partial |
| Utility package | `util.metta` (do, TupleConcat, If) | ✓ Implemented |

### 9.6 ECAN (Economic Attention Networks)

| Status | Notes |
|--------|-------|
| Planned | Expected cognitive module; no specific repo found |

---

## 10. Execution Model

### 10.1 Evaluation Semantics

1. **Parse**: Convert MeTTa source to atom structures
2. **Match**: Find patterns matching current Atomspace state
3. **Rewrite**: Apply substitution rules
4. **Recurse**: Continue until fixed point (no more rules apply)
5. **Nondeterminism**: Handle via superposition/collapse

### 10.2 Nondeterministic Execution

```metta
; Superpose creates multiple possible values
(superpose (a b c))  ; -> Returns a, b, c nondeterministically

; Collapse selects a single value
(collapse (superpose (a b c)))  ; -> Returns one of a, b, c
```

### 10.3 Self-Modification

```metta
; Add a new rule at runtime
(= (modify-self)
   (addAtom &self (= (new-rule) result)))

; Construct and execute programs dynamically
(= (meta-program)
   (eval (construct-code)))
```

### 10.4 Meta-Programming

| Feature | Description | Status |
|---------|-------------|--------|
| Code as data | Unified representation | ✓ Implemented |
| Quoting/unquoting | Treat code as literals | ✓ Implemented |
| Higher-order functions | Functions as arguments | ✓ Partial |
| Program reflection | Inspect own structure | ✓ Implemented |
| Runtime code rewriting | Modify executing code | ✓ Implemented |
| Macro systems | Via metta-morph | ✓ Available |

---

## 11. Runtime Backends

### 11.1 Native Rust Interpreter (Production)

| Aspect | Details |
|--------|---------|
| **Status** | ✓ Active Release (v0.2.8) |
| **Repository** | `trueagi-io/hyperon-experimental` |
| **Performance** | Baseline reference |
| **Entry Points** | `metta-py`, `metta-repl`, `metta` CLI |

### 11.2 MORK High-Performance Kernel

**Repository:** `trueagi-io/MORK`

| Aspect | Details |
|--------|---------|
| **Status** | Work in Progress (4 deliverables) |
| **Architecture** | Zipper Abstract Machine (ZAM) |
| **Target** | 1000-1,000,000x speedup |
| **Build** | `cargo build --release` in `/kernel` (Rust nightly) |

**MORK Deliverables:**

#### Deliverable 1: Graph Database
- S-expression triemap
- Efficient space-wide operations (union, intersection, set subtraction)
- Lazy/constant-time evaluation
- Full relational algebra
- Billion-atom scale (single workstation)
- JSON interoperability (streaming parser, JSONPath)
- NoCopy binary formats (mmap-friendly)
- WebAssembly + Native targets (Linux, macOS, x86-64, AArch64)

#### Deliverable 2: Zipper Abstract Machine (ZAM)
- Mathematically specified model of computation
- Multi-threaded VM (inspired by Prolog's WAM)
- Zippers as runtime cursors
- Decomposed parallel inference
- Inference control (prioritization & pruning)
- Near-linear core scaling (128+ cores)

#### Deliverable 3: MeTTa Language Support
- ZAM-based interpreter
- Full MeTTa execution
- Massive dataset cohabitation
- Grounded interfaces with native API hooks
- Integrated inference control (sampling, enrichment)

#### Deliverable 4: Hyperon Client Adaptation
- Python integration
- C API
- WASM API
- Complete MeTTa stdlib
- Module system
- Package management

### 11.3 MeTTaLog (Warren Abstract Machine)

**Repository:** `trueagi-io/metta-wam`

| Aspect | Details |
|--------|---------|
| **Status** | ✓ Active |
| **Technology** | SWI-Prolog 9.3.9+ with Janus bridge |
| **Python** | Integration via pyswip |
| **Features** | Highest compatibility, 1B atom loading, fast unification |
| **Entry Points** | `mettalog --repl`, `mettalog script.metta`, `mettalog --test` |

### 11.4 Jetta (JVM Compiler)

| Aspect | Details |
|--------|---------|
| **Status** | ✓ Active Development |
| **Technology** | Kotlin-based, JVM bytecode generation |
| **Performance** | Million-fold speedup for arithmetic |
| **Features** | Lambda expressions, runtime compilation |

### 11.5 Rholang Smart Contract Compilation

| Aspect | Details |
|--------|---------|
| **Status** | Alpha release |
| **Architecture** | MeTTa → MeTTa-IL → Rholang + MORK |
| **Target** | ASI:Chain blockchain |
| **Features** | Concurrent execution, smart contracts, deterministic behavior |

**MeTTa-IL Intermediate Language:**
- Intermediate representation with formal semantics
- Rho-calculus based (for RChain/ASI:Chain)
- Content-addressed memory
- Blockchain integration

### 11.6 Metta-Morph (Scheme Translation)

**Repository:** `trueagi-io/metta-morph`

| Aspect | Details |
|--------|---------|
| **Status** | ✓ Active |
| **Target** | Chicken Scheme |
| **Technology** | Macro-based translation |
| **Purpose** | Two-way testing, compatibility verification |

---

## 12. Integration Ecosystem

### 12.1 Development Tools

| Tool | Purpose | Status |
|------|---------|--------|
| Python REPL | `metta-py` | ✓ Implemented |
| Rust REPL | `metta-repl` | ✓ Implemented |
| MeTTaLog REPL | `mettalog --repl` | ✓ Implemented |
| Jupyter Kernel (PeTTa) | In-notebook development | ✓ Implemented |
| Docker Images | `trueagi/hyperon:latest`, `trueagi/pln` | ✓ Available |

### 12.2 Testing Framework

| Feature | Details |
|---------|---------|
| Unit test syntax | Dedicated MeTTa test syntax |
| Execution | `metta-py --test`, `mettalog --test` |
| HTML reports | Generated test output |
| Test suite | `metta-testsuite` repository |

### 12.3 Debugging & Logging

```bash
# Logging configuration
RUST_LOG=hyperon[::COMPONENT]*=LEVEL metta-py script.metta

# Log levels: error, warn, info, debug, trace
RUST_LOG=hyperon::metta::types=trace metta-py script.metta
```

### 12.4 Error Handling

| Feature | Status |
|---------|--------|
| Basic error reporting | ✓ Partial |
| Graceful exception handling | Planned |
| Stack traces | ✓ Partial |

### 12.5 External Integrations

| Integration | Repository | Status |
|-------------|------------|--------|
| Protobuf → MeTTa | `protobuf-metta` | ✓ Active |
| Jupyter Kernel | `jupyter-petta-kernel` | ✓ Implemented |
| PRIMUS cognitive arch | — | ✓ Partial |
| Distributed Atomspace | `singnet/das` | ✓ Active |

---

## 13. Distributed Atomspace (DAS)

**Repository:** `singnet/das`

### 13.1 Features

| Feature | Description | Status |
|---------|-------------|--------|
| Distributed storage | Knowledge across network nodes | ✓ Active |
| Real-time collaboration | Multiple agents read/write | ✓ Active |
| Flexible queries | DAS-aware pattern matching | ✓ Active |
| Parallel processing | Distributed graph traversal | ✓ Active |
| High availability | Blockchain-compatible consensus | ✓ Active |
| Seamless atomspace replacement | Backward compatible API | ✓ Active |

### 13.2 Demonstrated Scale

| Scale | Dataset |
|-------|---------|
| 330 million atoms | FlyBase biomedical (Rejuve.Bio) |
| 1 billion atoms | Billion-row challenge (MORK/MeTTaLog) |

### 13.3 Integration Methods

1. **Standalone Server**: Independent service
2. **Python Library**: Direct Python integration
3. **MeTTa Queries**: Native DAS support

---

## 14. Concurrency & Distribution

### 14.1 Concurrency Model

| Feature | Description | Status |
|---------|-------------|--------|
| Rho-calculus foundation | Mathematical concurrency model | ✓ Available |
| Process algebra | Multi-agent coordination | ✓ Available |
| Parallel scheduling | Concurrent process management | Planned |
| Deadlock prevention | Runtime scheduling | Planned |

### 14.2 Distribution

| Feature | Description | Status |
|---------|-------------|--------|
| Network protocols | Cross-node communication | Planned |
| State synchronization | Distributed consistency | Planned |
| Decentralized execution | Via ASI:Chain | ✓ Alpha |
| Blockchain consensus | Consistent consensus | ✓ Alpha |

---

## 15. Application Domains

### 15.1 Minecraft Cognitive Agent

| Component | Repository | Status |
|-----------|------------|--------|
| Vereya API | `trueagi-io/Vereya` (Java Fabric mod) | ✓ Active |
| Demo App | `trueagi-io/minecraft-demo` (Python) | ✓ Active |
| Experiments | `trueagi-io/minecraft-experiments` | Archived |

**Agent Capabilities:**
- Environmental perception
- Goal-directed planning
- Hierarchical task decomposition
- MeTTa reasoning integration
- Real-time decision making
- Learning/adaptation

### 15.2 Biomedical Knowledge

- **Dataset**: FlyBase (Drosophila genetics)
- **Scale**: 330M atoms in DAS
- **Application**: Longevity research (Rejuve.Bio)

---

## 16. Standard Library

**Documentation:** https://metta-stdlib.readthedocs.io

### 16.1 Modules

| Module | Contents | Status |
|--------|----------|--------|
| Mathematical | Power, trig, exp, log, rounding, abs, min/max, NaN | ✓ Implemented |
| List manipulation | map, standard list ops | ✓ Implemented |
| String operations | String processing | Under development |
| Type utilities | Type system helpers | ✓ Implemented |

### 16.2 Utility Package (`util.metta`)

| Function | Purpose |
|----------|---------|
| `do` | Empty tuple (None equivalent) |
| `TupleConcat` | Tuple concatenation |
| `If` | Wrapped if-else variant |

---

## 17. Performance & Benchmarks

### 17.1 Demonstrated Speedups

| Backend | Improvement | Use Case |
|---------|-------------|----------|
| Jetta (JVM) | 1,000,000x | Arithmetic functions |
| MORK | 1,000-1,000,000x (target) | Specialized kernel |
| MeTTaLog | Fastest unification | Via SWI-Prolog WAM |
| Compilation Server | Runtime speedup | Dynamic compilation |

### 17.2 Scalability Metrics

| Metric | Achievement |
|--------|-------------|
| Pattern matching | Billion-atom loading |
| Distributed queries | 330M atoms (FlyBase) |
| Parallel processing | Near-linear scaling (128+ cores) |
| Memory efficiency | NoCopy binary, mmap-friendly |

---

## 18. Implementation Roadmap

### Phase 1: Core (Essential) — 3-4 months

- [ ] Atom representation (Symbol, Variable, Expression, Grounded)
- [ ] S-expression parser
- [ ] Pattern matching with unification (triemap-based)
- [ ] Variable binding management
- [ ] Basic Atomspace (add, remove, match, query)
- [ ] Core operators: `=`, `:`, `!`, `match`
- [ ] Evaluation loop (match-rewrite cycle)
- [ ] Nondeterminism: `superpose`, `collapse`

### Phase 2: Type System & Control Flow — 2-3 months

- [ ] Type declarations and basic checking
- [ ] Function types with `->`
- [ ] Control flow: `if`, `case`
- [ ] Recursion support
- [ ] Arithmetic operations (full set)
- [ ] List/tuple operations

### Phase 3: Integration — 2-3 months

- [ ] Module system (`import!`, `include!`)
- [ ] Python grounding interface
- [ ] REPL implementation
- [ ] Error handling and debugging
- [ ] Testing framework

### Phase 4: Inference Algorithms — 3-4 months

- [ ] Forward/backward chaining
- [ ] Truth values and uncertainty
- [ ] Pattern mining basics
- [ ] PLN foundations

### Phase 5: Performance & Scale — 6+ months

- [ ] MORK-style optimizations
- [ ] Distributed Atomspace
- [ ] Persistent storage
- [ ] JVM/alternative backends

### Estimated Timelines

| Scope | Duration |
|-------|----------|
| Functional minimum | 3-4 months |
| Production-ready | 6-8 months |
| High-performance | 12-18 months |
| Full ecosystem | 18-24+ months |

---

## 19. Repository Summary

| Repository | Language | Status | Purpose |
|------------|----------|--------|---------|
| `hyperon-experimental` | Rust/Python | ✓ Active (v0.2.8) | Core interpreter |
| `MORK` | Rust | WIP (4 deliverables) | Performance kernel |
| `metta-wam` | Prolog | ✓ Active | WAM backend |
| `pln-experimental` | Idris | ✓ Research | PLN dependent types |
| `chaining` | Shell/MeTTa | ✓ Experimental | Inference strategies |
| `hyperon-moses` | Multi | ✓ Active | Evolutionary synthesis |
| `hyperon-miner` | Prolog | ✓ Active | Pattern mining |
| `metta-morph` | Python | ✓ Active | Scheme transpiler |
| `metta-catalog` | — | ✓ Active | Package registry |
| `metta-examples` | Python | ✓ Active | Tutorials |
| `protobuf-metta` | Python | ✓ Active | Schema conversion |
| `jupyter-petta-kernel` | Python | ✓ Active | Jupyter kernel |
| `Vereya` | Java | ✓ Active | Minecraft API |
| `minecraft-demo` | Python | ✓ Active | Agent demo |
| `singnet/das` | Python | ✓ Active | Distributed Atomspace |
| `hyperon-cpp` | C++ | Archived | Legacy |

---

## 20. Example Programs

### Basic Definition
```metta
(= (greet $name)
   (Hello $name))

!(greet World)  ; -> (Hello World)
```

### Pattern Matching
```metta
(parent Alice Bob)
(parent Bob Charlie)

(= (grandparent $gp $gc)
   (match &self (parent $gp $p)
     (match &self (parent $p $gc)
       (Grandparent $gp $gc))))
```

### Type Declarations
```metta
(: Person Type)
(: age (-> Person Number))
(: Alice Person)
(= (age Alice) 30)
```

### Nondeterministic Choice
```metta
(= (color) (superpose (red green blue)))
!(collapse (color))  ; -> one of red, green, blue
```

### Self-Modifying Code
```metta
(= (learn $fact)
   (addAtom &self $fact))

!(learn (knows Alice math))
```

### Forward Chaining Example
```metta
; Modus ponens via forward chaining
(= (infer)
   (match &self (Implies $a $b)
     (match &self $a
       (addAtom &self $b))))
```

---

## 21. References

### Primary Sources
- [MeTTa Language](https://superintelligence.io/portfolio/metta-programming-language/)
- [Hyperon Experimental](https://github.com/trueagi-io/hyperon-experimental)
- [MeTTa Standard Library](https://metta-stdlib.readthedocs.io)
- [MeTTa Language Dev](https://metta-lang.dev)
- [TrueAGI GitHub](https://github.com/trueagi-io)

### Research Papers
- [Reflective Metagraph Rewriting (arXiv:2112.08272)](https://arxiv.org/abs/2112.08272) — Language foundations
- [MeTTa Operational Semantics (arXiv:2305.17218)](https://arxiv.org/abs/2305.17218) — Formal semantics
- [OpenCog Hyperon Framework (arXiv:2310.18318)](https://arxiv.org/abs/2310.18318) — System architecture
- [PLN Formalization (arXiv:2203.15970)](https://arxiv.org/abs/2203.15970) — PLN specification

### Additional Resources
- [Hyperon Tutorials](https://hyperon-tutorials.readthedocs.io)
- [OpenCog Wiki](https://wiki.opencog.org)
- [PLN Book](https://wiki.opencog.org/w/Probabilistic_logic_networks)
