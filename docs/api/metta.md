# @senars/metta — public API

## `.`

- `Concept`

- `ConceptBag`

- `createConfig` — Overrides over the defaults, at any depth.

- `type MeTTaConfig`

- `presets`

- `ErrorCode`

- `MeTTaError`

- `atomKey` — String form of {@link hashAtom}, for the map and set keys that need one. Two

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

- `unify` — Unify `a` and `b`, extending `subst`. Returns `null` when they do not

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

- `createMettaPort`

- `MettaEngine`

- `LLM_COMMANDS`

- `MettaCommandParser`
