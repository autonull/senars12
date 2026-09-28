# @senars/metta — public API

## `.`

- `Concept`

- `ConceptBag`

- `createConfig`

- `type MeTTaConfig`

- `presets`

- `ErrorCode`

- `MeTTaError`

- `equalAtoms`

- `hashAtom`

- `type InternOptions`

- `SymbolInterner` — Bounded, recency-ordered name → symbol intern table (cold names age out).

- `clearOps`

- `defineOp`

- `type GroundedOp`

- `getOp`

- `hasOp`

- `registerOp`

- `InMemorySpace`

- `Stamp`

- `EGraph`

- `type RewriteRule`

- `MeTTaInterpreter`

- `PatternMatcher`

- `ReductionPipeline`

- `applySubst`

- `type Substitution`

- `unify`

- `type PersistedSpaceData`

- `PersistentSpace`

- `type PersistentSpaceOptions`

- `deserialize`

- `serialize`

- `SharedMemoryQueue`

- `parseMeTTa`

- `globalJIT`

- `JITCompiler` — Hot-pattern detector and compiled-code store over bounded recency caches.

- `parallelMap`

- `parallelReduce`

- `createMeTTa`

- `MeTTaBuilder`

- `MeTTaRuntime`

- `bootstrapStdLib`

- `AtomKind`

- `expr`

- `isExpression`

- `isGrounded`

- `isNumber`

- `isString`

- `isSymbol`

- `isVariable`

- `num`

- `str`

- `sym`

- `varr`

- `composeSubst`

- `freshType`

- `occursCheck`

- `resetTypeIds`

- `TypeChecker`

- `unifyTypes`

- `isTypeCon`

- `isTypeFun`

- `isTypeVar`

- `TypeKind`

- `typecon`

- `typefun`

- `typevar`

## `./engine`

- `RewriteRule`

- `EGraph`

## `./agent`

- `MettaEngine`

- `LLM_COMMANDS`

- `MettaCommandParser`
