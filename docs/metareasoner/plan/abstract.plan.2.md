# MetaReasoner Abstract Architecture — Development Plan

**Purpose:** Abstract SeNARS to support versatile control model implementations while sharing common foundations, achieving configurable/scalable/modular architecture from minimal to fully-featured, following AGENTS.md principles.

---

## 1. Architectural Vision

### 1.1 Core Thesis
> **A reasoner is a governed controller that transforms observations and internal states into justified commitments under scarce resources.**

This thesis, synthesized from `synth/universal.qw1.md` and `synth/flexible.qw1.md`, replaces the current "NAL engine with bolted-on control" mental model with a **unified cognitive transaction calculus** where:
- All cognition = typed, budgeted, governed transactions
- All mutation = single commit ledger
- All control = declarative data (KAT control words / conditional DAGs)
- All resources = reservation economy with prices/markets
- All learning = proposals through governance filtration
- All explanation = causal provenance graph

### 1.2 Target Architecture: The Ω-Calculus / AEGIS Model
The synthesis documents converge on a **single universal architecture** parameterized by ~20 axes across 5 clusters (Knowledge, Inference, Control, Learning, Authority). Every known reasoner type is a projection; SeNARS "default" is one configuration; `synth/` flavors are other projections; future models are unexplored regions of the same space.

**Key architectural shift:**
```
Current SeNARS:           Target Ω/AEGIS:
──────────────────        ──────────────────
Hard-coded 6-stage loop   Declarative Cognitive Graph (KAT/DAG)
Fixed budgets             Reservation economy + utility pricing
Four ad-hoc gates         Oriented gate lattice (closure/interior)
Event log after-the-fact  Provenance-by-construction (causal DAG)
Learning = direct mutate  Learning = governed proposals
LM = implicit authority   LM = untrusted proposer, judged
```

---

## 2. Development Phases (Kernel-First Staging)

Following **Objective O5 + C4** (minimal implementable kernel, incremental migration), each phase delivers a runnable system satisfying the Constitution Φ.

| Phase | Deliverable | Invariants Active | Key Refactoring |
|-------|-------------|-------------------|-----------------|
| **0. Kernel** | Substrate + Control Word + One Gate + Budget Monoid + Provenance Fold | I1–I3, I5 (Epistemic firewall, Single write, Event-sourced, AIKR) | Extract `CognitiveKernel` from `NARExecution`; introduce `ControlWord` type |
| **1. Ledger** | Unified commit port; all mutation → transactions | I2, I4 (Single commit authority, Untrusted ⇒ judged) | Replace `memory.addTask` + `proposals.admit` with `CommitLedger.commit()` |
| **2. Graph** | Control flow as data; conditional stage DAG | I7, Φ10 (Inspectable control, No opaque scheduler) | Replace `NARExecution.run()` for-loop with `StageGraphRunner` |
| **3. Economy** | Reservations + prices; static → adaptive budgets | Φ9 (Anytime + preemptive scheduler) | Replace `ControlBudgets` with `BudgetOffice` (reservations, marginal utility) |
| **4. Manifold** | Calibrated judgment; trust/risk/reversibility surface | Φ2, Φ11 (Judged proposals, Irreversible ⇒ authorized) | Unify `PerceptionGate` + `ActionGate` + `DecisionPort` into `GateLattice` |
| **5. Tower** | Heterochronous multi-rate loops | Φ7 (AIKR ⇒ bounded containers + forgetting) | Introduce `CycleOrchestrator` with Level 0–4 loops |
| **6. Reflexivity** | Governed self-modification ladder | Φ3, Φ4 (Shadow validation + external arbiter) | Replace ad-hoc `SelfOptimizer` with `ReflexivityTower` |
| **7. Ecology** | Multi-agent delegation & collective verification | Φ2 (Untrusted proposers) | Add `DelegationPort` + `CollectiveCalibration` (gated, off by default) |

**Each phase preserves all prior invariants.** The elegance never depends on replacing the whole runtime at once.

---

## 3. Shared Foundations (Refactoring for Shareability)

### 3.1 Core Types Package (`@senars/kernel-types`)
Extract and consolidate all load-bearing type definitions into a single shared package:

```typescript
// kernel-types/src/index.ts
export { CognitiveTransaction, TransactionKind, GovernanceProfile } from './transactions';
export { ControlWord, StageGraph, StageNode, StageEdge } from './control';
export { BudgetScope, BudgetReservation, BudgetOffice, TerminationReason } from './budget';
export { Gate, GateLattice, GateOrientation, GateDecision } from './gates';
export { CognitiveEvent, CorrelationId, Provenance, CausalGraph } from './provenance';
export { Substrate, SubstratePort, EpistemicAxis, CognitiveAttitude } from './substrate';
export { VerificationPortfolio, ProofObligation, JudgeStatus } from './verification';
export { ReflexivityLevel, SelfModProposal, AuthorityFiltration } from './reflexivity';
export { FeasibilityPredicate, Constitution, HardConstraint } from './constitution';
```

**Migration:** All packages (`nar`, `core`, `metta`, `io`) depend on `kernel-types` instead of duplicating types.

### 3.2 Constitution as Code (`@senars/constitution`)
Encode Φ (H1–H14) as executable validation:

```typescript
// constitution/src/feasibility.ts
export function validateConfiguration(config: AEGISConfig): FeasibilityResult {
  const violations: ConstraintViolation[] = [];
  
  // Φ1: reward ∉ writers(Belief.truth)
  if (config.reward?.targets?.includes('belief.truth')) 
    violations.push({ constraint: 'Φ1', message: 'Reward writes belief truth' });
  
  // Φ2: untrusted proposer ⇒ judge gate before commit
  if (config.proposers?.some(p => !p.trusted && !config.gates?.hasJudge))
    violations.push({ constraint: 'Φ2', message: 'Untrusted proposer without judge gate' });
  
  // Φ3: code self-mod ⇒ shadow + external arbiter + event-sourced
  if (config.reflexivity?.level >= 4 && !config.governance?.externalArbiter)
    violations.push({ constraint: 'Φ3', message: 'Level 4 self-mod without external arbiter' });
  
  // ... all 14 constraints
  
  return { legal: violations.length === 0, violations };
}
```

**Usage:** `NARBuilder.fromProfile()` validates against Φ at load time. Infeasible configs rejected before any cognition runs.

### 3.3 Unified Event System (`@senars/event-fold`)
Consolidate `core/eventlog`, `nar/kernel/replay`, `nar/kernel/event-ring` into a single append-only event fold with:

- `CognitiveEvent` union (all event types)
- `EventFold<State>` — pure reducer: `fold(events) ≅ state`
- `replayState(events)` + `verifyReplayHash(events, expectedHash)`
- `causalGraph(events)` — navigable DAG with `correlationId` threading
- Tiered audit: full proof for high-risk, sampled lineage for routine

### 3.4 Substrate Ports (`@senars/substrate-ports`)
Define typed ports for each substrate (enforcing Φ6, Φ8 isolation):

```typescript
// substrate-ports/src/index.ts
export interface SymbolicPort {          // NAL
  infer(inputs: Term[]): Derivation[];
  veto(candidate: Candidate): boolean;
  revise(belief: Belief, evidence: Evidence): Belief;
}

export interface ExactPort {             // MeTTa / e-graph
  compute(program: MettaProgram): Result;
  // NEVER unions on uncertain similarity (Φ6)
}

export interface ProposerPort {          // LM / Reflex / Peer
  propose(context: ProposerContext): Proposal[];
  // Untrusted by construction
}

export interface JudgePort {             // System One / Verifier
  judge(proposals: Proposal[]): JudgmentProposition[];
  // Independent verification: imports ∩ engine = ∅ (Φ8)
}
```

**Current SeNARS mapping:** `SymbolicPort` = `RuleProcessor` + `InferenceController`; `ExactPort` = `MeTTaPort`; `ProposerPort` = `LMProposalProducer` + `Reflex`; `JudgePort` = `JudgmentPipeline`.

### 3.5 Budget Office (`@senars/budget-office`)
Replace `ControlBudgets` + `KernelBudgetGate` with a unified economy:

```typescript
// budget-office/src/index.ts
export interface BudgetOffice {
  // Reservations (prevent silent starvation)
  reserve(scope: BudgetScope, amount: CostVector): ReservationToken;
  settle(token: ReservationToken, actual: CostVector): void;
  
  // Marginal utility pricing
  price(operation: Operation, context: CognitiveContext): UtilityScore;
  
  // Market clearing (optional)
  allocate(claims: Claim[], totalBudget: BudgetVector): Allocation;
  
  // Thermodynamic mode (optional enrichment)
  setTemperature(T: number): void;
  pursuitProbability(claim: Claim): number; // Boltzmann: exp(-ΔE/T)
}
```

**Dimensions:** `cycles, derivations, premises, memoryOps, llmCalls, tokens, latency, attention, risk, humanAttention`

---

## 4. Control Model Abstraction

### 4.1 The Control Word / Cognitive Graph
Replace hard-coded stage sequences with declarative control flow:

```typescript
// control/src/ControlWord.ts
export type ControlWord = 
  | { kind: 'seq'; left: ControlWord; right: ControlWord }
  | { kind: 'choice'; left: ControlWord; right: ControlWord }
  | { kind: 'star'; body: ControlWord }           // iteration
  | { kind: 'guard'; test: (ctx: CycleCtx) => boolean; body: ControlWord }
  | { kind: 'stage'; id: StageId; run: Middleware<CycleCtx> }
  | { kind: 'parallel'; branches: ControlWord[] }
  | { kind: 'skip' };

// Equivalent DAG representation for visualization/analysis
export interface StageGraph {
  nodes: Map<StageId, StageNode>;
  edges: StageEdge[];  // guarded, budgeted, parallelizable
}
```

**SeNARS Default Mapping:**
```
κ_default = perceive · attend · reason · authorize · propose · learn
```

**SeNARS-SG (Stage Graph) Mapping:**
```
κ_sg = perceive · attend · (reason + retrieve) · (propose | verify) · authorize · learn
       with guards: reason→propose iff budget.remaining > θ
```

**SeNARS-JC (Judgment Continuum) Mapping:**
```
κ_jc = perceive · attend · reason · (classify ∨ evaluate) · authorize · propose · learn
       where classify/evaluate are judgment manifold calls
```

**Learned Controller Mapping:**
```
κ_learned = metaController.selectProgram(state, stimulus) → CognitiveProgram
CognitiveProgram = { stageGraph, budgetAllocation, proposerPortfolio, verificationPolicy, ... }
```

### 4.2 Stage Graph Runner
```typescript
// control/src/StageGraphRunner.ts
export class StageGraphRunner {
  constructor(
    private graph: StageGraph,
    private budgetOffice: BudgetOffice,
    private gateLattice: GateLattice,
    private ledger: CommitLedger,
    private eventFold: EventFold<State>
  ) {}

  async *run(correlationId: CorrelationId, stimulus: Stimulus): AsyncGenerator<StageResult> {
    const state = this.eventFold.fold();  // current state = fold of log
    const ctx = new CycleCtx(state, stimulus, correlationId, this.budgetOffice);
    
    for await (const node of this.graph.topologicalSchedule(ctx)) {
      const reservation = this.budgetOffice.reserve(node.budgetScope, node.estimatedCost);
      try {
        const result = await node.run(ctx);
        this.budgetOffice.settle(reservation, result.actualCost);
        yield result;
      } catch (e) {
        this.budgetOffice.settle(reservation, { wasted: true });
        yield this.failurePolicy.handle(e, node, ctx);
      }
    }
  }
}
```

### 4.3 Meta-Controller (Adaptive Scheduling)
```typescript
// control/src/MetaController.ts
export interface MetaController {
  selectProgram(state: State, stimulus: Stimulus): CognitiveProgram;
  update(outcome: CycleOutcome): void;  // learning signal
}

// Portfolio controllers (swappable)
export const controllerPortfolio = {
  deliberative:  new DeliberativeController(),   // deep inference, high proof
  reactive:      new ReactiveController(),       // fast reflexes
  curious:       new CuriousController(),        // exploration
  conservative:  new ConservativeController(),   // high rejection
  creative:      new CreativeController(),       // high proposal diversity
  social:        new SocialController(),         // human-in-loop
  repair:        new RepairController(),         // contradiction resolution
  consolidating: new ConsolidatingController(),  // decay, schema induction
};
```

**Inspectability (Φ10):** Every `selectProgram` decision emits `CognitiveEvent { kind: 'control:decision', program, rationale, weights }`. No opaque scheduler.

---

## 5. Supporting Existing SeNARS "Default" Model

### 5.1 Configuration Profile
```typescript
// configs/default.ts
export const defaultProfile: AEGISConfig = {
  K: { substrate: 'symbolic-uncertain', language: 'narsese', calculus: 'NAL', consistency: 'paraconsistent' },
  I: { spectrum: 'deduction+induction+abduction', exact: false, termination: 'bounded' },
  C: { 
    resources: { cycles: 1000, derivations: 100, premises: 64, memoryOps: 10000, llmCalls: 50 },
    scheduler: 'fixed',  // κ_default
    forgetting: 'decay+lru+pressure' 
  },
  L: { locus: 'internal', reward: 'rlfp+external', beliefGoal: 'firewall' },
  A: { trust: 'source-reputation', provenance: 'full', governance: 'gated', composition: 'single-agent' },
  
  // SeNARS-specific wiring
  controlWord: DEFAULT_CONTROL_WORD,
  gateLattice: SENARS_GATE_LATTICE,
  budgetOffice: SENARS_BUDGET_OFFICE,
  verificationPortfolio: { symbolic: true, manifold: false },
  reflexivity: { level: 1, shadowCI: false, externalArbiter: false },
};
```

### 5.2 Backward Compatibility Layer
```typescript
// compat/src/SeNARSAdapter.ts
export class SeNARSAdapter implements NAR {
  constructor(private kernel: CognitiveKernel) {}
  
  // Map old API to new kernel
  async run(steps: number): Promise<number> {
    return this.kernel.executeCycles(steps, DEFAULT_CONTROL_WORD);
  }
  
  async input(text: string): Promise<void> {
    return this.kernel.transact({ kind: 'perception', inputs: [parseNarsese(text)] });
  }
  
  // ... all NAR public methods delegate to kernel
}
```

**Result:** Existing code using `NAR` interface works unchanged. New code uses `CognitiveKernel` directly.

---

## 6. Supporting `synth/` Flavors

Each flavor is a configuration point in the same design space:

| Flavor | Key Axes | Configuration Delta from Default |
|--------|----------|----------------------------------|
| **Cybernetic** | Control theory, feedback loops | `scheduler: 'pid-adaptive'`, `governance: 'homeostatic'`, `reflexivity: level 2` |
| **Topological** | Geometric, sheaf-theoretic | `substrate: 'topos'`, `inference: 'sheaf-cohomology'`, `provenance: 'causal-sheaf'` |
| **Category** | Coalgebraic, categorical | `dynamics: 'coalgebra'`, `valuation: 'fibration'`, `control: 'distributive-law'` |
| **Thermodynamic** | Free energy, temperature | `economy: 'boltzmann'`, `scheduler: 'free-energy-minimization'`, `attention: 'energy'` |
| **Math** | Pure algebraic | `substrate: 'dependent-types'`, `verification: 'proof-terms'`, `consistency: 'constructive'` |
| **Bio** | Autopoietic, cellular | `memory: 'membrane-bound'`, `control: 'chemical-reaction-network'`, `learning: 'evolutionary'` |
| **Meta** | Recursive, metaprogrammatic | `reflexivity: level 4`, `control: 'self-applicative'`, `governance: 'meta-constitution'` |
| **Universal** | All axes at full | **The Ω-calculus itself** — all enrichments active |
| **Flexible (AEGIS)** | Ambitious + pragmatic | **Recommended target** — kernel-first staging, all Φ active |
| **Ambitious** | Maximum expressiveness | All axes maxed, governance paralysis resolved by graduated autonomy |

### 6.1 Flavor Registration
```typescript
// configs/flavors.ts
export const flavorRegistry: Map<string, AEGISConfig> = new Map([
  ['default', defaultProfile],
  ['cybernetic', cyberneticProfile],
  ['topological', topologicalProfile],
  ['category', categoryProfile],
  ['thermodynamic', thermodynamicProfile],
  ['math', mathProfile],
  ['bio', bioProfile],
  ['meta', metaProfile],
  ['universal', universalProfile],
  ['flexible', aegisProfile],      // AEGIS from flexible.qw1.md
  ['ambitious', ambitiousProfile],
]);
```

### 6.2 Profile Composition
```typescript
// Allow mixing: e.g., thermodynamic economy + cybernetic control + bio memory
export function composeProfile(...flavors: string[]): AEGISConfig {
  return flavors.reduce((acc, f) => mergeConfigs(acc, flavorRegistry.get(f)!), baseConfig);
}
```

---

## 7. Anticipating Future Models

### 7.1 Extension Points (Typed Ports)
Every component is behind a typed port. Future models plug in by implementing ports:

| Extension Point | Port Interface | Current Implementation | Future Could Be |
|----------------|----------------|------------------------|-----------------|
| Substrate | `SubstratePort` | NAL, MeTTa | Quantum, neuromorphic, DNA |
| Scheduler | `MetaController` | Fixed, Portfolio | Learned, market, swarm |
| Judge | `JudgePort` | System One | Constitutional AI, formal verification |
| Memory | `MemoryPorts` | Bounded bags | Holographic, associative, persistent |
| Governance | `GovernanceEngine` | Lattice + risk manifold | DAO, constitutional, prediction market |
| Provenance | `ProvenanceBackend` | SQLite/JSONL | Blockchain, Merkle-DAG, IPFS |

### 7.2 Constitutional Extensibility
New hard constraints can be added to Φ without breaking existing configs:
```typescript
// Future: Φ15 — no cross-agent belief fusion without independence accounting
if (config.ecology?.enabled && !config.provenance?.independenceAccounting)
  violations.push({ constraint: 'Φ15', ... });
```

---

## 8. Configurable/Scalable/Modular Design

### 8.1 Tiered Instantiation (from `synth/universal.qw1.md` §9.2)

| Tier | Name | Adds | Deployable As |
|------|------|------|---------------|
| **Ω₀** | Kernel | Substrate + Control Word + Gate + Budget + Provenance | Embedded, edge, minimal |
| **Ω₁** | Reasoner | Inference substrate, truth algebra, revision | Symbolic reasoner |
| **Ω₂** | Agent | Full gate lattice, trust field, economy pricing, risk manifold | Chat agent, tool user |
| **Ω₃** | Cognitive | Drives, multi-rate loops, consolidation, imagination, reflexivity | Autonomous agent |
| **Ω₄** | Ecological | Peer delegation, collective calibration, provenance fusion | Multi-agent system |

**Each tier satisfies Φ and is independently deployable.** `device` profile = Ω₀; `conversation` = Ω₂; `research` = Ω₃; `arcade` = Ω₁.

### 8.2 Feature Toggles (Config Axes)
```typescript
// configs/feature-flags.ts
export interface FeatureFlags {
  // Substrate
  exactSubstrate: boolean;        // MeTTa/e-graph
  probabilisticSubstrate: boolean;
  neuralSubstrate: boolean;
  
  // Control
  adaptiveScheduler: boolean;     // meta-controller vs fixed
  stageGraph: boolean;            // DAG vs linear
  thermodynamicEconomy: boolean;  // Boltzmann vs quotas
  
  // Governance
  calibratedJudgment: boolean;    // manifold vs symbolic only
  riskManifold: boolean;          // full trust/risk/reversibility
  selfModification: 0 | 1 | 2 | 3 | 4;  // reflexivity level
  
  // Richness
  drives: boolean;
  imagination: boolean;           // counterfactual simulation
  consolidation: boolean;
  
  // Ecology (gated)
  multiAgent: boolean;
  collectiveCalibration: boolean;
}
```

### 8.3 Profiles, Presets, Tiers
```typescript
// Profiles (substrate + neural axis)
profiles = { device, conversation, tool-use, research, arcade };

// Presets (judgment depth, learning, provenance caps)
presets = { FAST, NEURAL_HEAVY, DEEP_AUDIT, MINIMAL };

// Tiers (Ω₀–Ω₄)
tiers = { kernel, reasoner, agent, cognitive, ecological };
```

**All combinations validated against Φ at load time.** Infeasible = rejected.

---

## 9. Migration Strategy (Incremental Implementability)

### 9.1 Phase 0 → 1: Kernel + Ledger (Weeks 1–3)
1. Extract `kernel-types` package
2. Implement `CognitiveTransaction` + `CommitLedger`
3. Replace `memory.addTask` + `proposals.admit` with `ledger.commit()`
4. Add `EventFold` + causal correlation IDs
5. **Verification:** All existing tests pass; `replayState(log) ≅ state`

### 9.2 Phase 1 → 2: Control Graph (Weeks 3–5)
1. Implement `ControlWord` + `StageGraph` + `StageGraphRunner`
2. Encode `DEFAULT_CONTROL_WORD` for SeNARS default
3. Replace `NARExecution.run()` for-loop with `StageGraphRunner`
4. Add `MetaController` interface (stub: returns fixed program)
5. **Verification:** `control:decision` events emitted; no behavior change

### 9.3 Phase 2 → 3: Budget Office (Weeks 5–7)
1. Implement `BudgetOffice` with reservations + marginal utility pricing
2. Replace `ControlBudgets.charge()` with `budgetOffice.reserve()/settle()`
3. Add market clearing (optional, behind flag)
4. **Verification:** Same budget ceilings; graceful degradation under pressure

### 9.4 Phase 3 → 4: Gate Lattice + Manifold (Weeks 7–10)
1. Unify `PerceptionGate` + `ActionGate` + `DecisionPort` → `GateLattice`
2. Implement oriented gates (closure/interior) with typed orientation
3. Add `TrustField` + `RiskManifold` + `ReversibilityClassifier`
4. Wire `JudgmentManifold` as `JudgePort` (proposer/judge adjunction)
5. **Verification:** All 4 gate paths work; fail-closed ingress, fail-open egress

### 9.5 Phase 4 → 5: Heterochronous Tower (Weeks 10–12)
1. Implement `CycleOrchestrator` with Level 0–4 loops
2. Move `memory.consolidate`, `schemaInductor`, `driveManager` to Level 3/4
3. Add `ReflexArc` (Level 0) for fast veto
4. **Verification:** Multi-rate loops coordinated via event log + budgets

### 9.6 Phase 5 → 6: Reflexivity Tower (Weeks 12–14)
1. Implement `ReflexivityTower` with levels 0–4
2. Replace `SelfOptimizer` + `ArchitectureDriver` with governed proposals
3. Add shadow CI + external arbiter for Level 4
4. **Verification:** Self-mod proposals go through ledger; rollback works

### 9.7 Phase 6 → 7: Ecology Layer (Weeks 14–16, gated)
1. Add `DelegationPort` + `CapabilityToken`
2. Implement `CollectiveCalibration` + `ProvenanceFusion`
3. **Verification:** Single-agent stability gate passes before enabling

---

## 10. File Structure (Post-Refactor)

```
packages/
├── kernel-types/           # Shared type definitions (all load-bearing types)
├── constitution/           # Φ validation, feasibility predicate
├── event-fold/             # Append-only event log, causal graph, replay
├── substrate-ports/        # Typed ports for each substrate
├── budget-office/          # Reservation economy, pricing, markets
├── control/                # ControlWord, StageGraph, MetaController
├── gate-lattice/           # Oriented gates, trust field, risk manifold
├── commit-ledger/          # Single commit authority, admission pipeline
├── verification/           # Proof/Judge/Simulation portfolio
├── reflexivity/            # Governed self-modification ladder
├── ecology/                # Multi-agent delegation (gated)
│
├── nar/                    # SeNARS default implementation (Ω₂ Agent tier)
│   ├── substrates/
│   │   ├── symbolic/       # NAL inference, revision, veto
│   │   ├── exact/          # MeTTa port
│   │   └── neural/         # LM proposer (untrusted)
│   ├── profiles/
│   │   ├── default.ts      # SeNARS default config
│   │   ├── conversation.ts
│   │   ├── tool-use.ts
│   │   ├── research.ts
│   │   └── device.ts
│   └── compat/             # SeNARSAdapter for backward compatibility
│
├── core/                   # Agent runtime (unchanged, uses kernel)
│   ├── Agent.ts            # Now wraps CognitiveKernel
│   ├── phases.ts           # Macro-cycle (unchanged)
│   └── ...
│
└── configs/                # All flavor configs, feature flags, composition
```

---

## 11. Testing Strategy

### 11.1 Constitution Compliance Tests
```typescript
// tests/constitution.test.ts
describe('Φ feasibility', () => {
  test('default profile satisfies Φ', () => 
    expect(validateConfiguration(defaultProfile).legal).toBe(true));
  
  test('reward-writes-truth rejected', () => {
    const bad = { ...defaultProfile, L: { ...defaultProfile.L, beliefGoal: 'reward' }};
    expect(validateConfiguration(bad).legal).toBe(false);
  });
  
  test('untrusted proposer without judge rejected', () => { ... });
  test('self-mod level 4 without external arbiter rejected', () => { ... });
  // ... all 14 constraints
});
```

### 11.2 Behavioral Equivalence Tests
```typescript
// tests/migration-equivalence.test.ts
describe('SeNARS default behavior preserved', () => {
  test('macro-cycle produces same events', async () => {
    const old = createLegacyNAR();
    const neu = createKernelWithProfile('default');
    const eventsOld = await runAndCapture(old, stimulus);
    const eventsNew = await runAndCapture(neu, stimulus);
    expect(eventsNew).toEqualEvents(eventsOld);  // modulo correlationIds
  });
  
  test('inference derives same conclusions', () => { ... });
  test('budget exhaustion behaves identically', () => { ... });
  test('gate refusals match', () => { ... });
});
```

### 11.3 Property Tests (Generative)
```typescript
// tests/properties.test.ts
test('event fold determinism', () => {
  fc.assert(fc.property(fc.eventSequence(), (events) => {
    const state1 = fold(events);
    const state2 = fold(replayState(events));
    expect(state1).toEqual(state2);
  }));
});

test('budget conservation', () => {
  fc.assert(fc.property(fc.budgetOperations(), (ops) => {
    const office = new BudgetOffice(config);
    const total = ops.reduce((sum, op) => sum + op.cost, 0);
    expect(office.getTotalConsumed()).toBeLessThanOrEqual(total);
  }));
});
```

### 11.4 Architecture Gate Tests
- `gates:one-cycle-path` — only one `StageGraphRunner` construction site
- `control-budgets` — declared scope ⇔ spent
- `config:model-matrix` — unregistered call site fails build
- `derivation:verifiable` — all derivations independently checkable
- `docs:drift` — architecture docs match implementation

---

## 12. README.md (System Overview)

**Location:** `docs/metareasoner/README.md`

```markdown
# MetaReasoner — Universal Reasoner Architecture

> **One calculus. Every reasoner a projection.**

The MetaReasoner is a **universal architecture for governed, bounded, neuro-symbolic reasoners**. It abstracts the SeNARS cognitive kernel into a configurable design space where:

- **All cognition is a typed transaction** — perception, inference, proposals, learning, actions, self-modification flow through a single commit ledger
- **Control flow is data** — declarative stage graphs (KAT control words) replace hard-coded loops
- **Resources are an economy** — reservations, marginal utility pricing, optional thermodynamic allocation
- **Governance is a manifold** — trust × risk × reversibility determines commit path; no self-approval
- **Provenance is causal** — correlation IDs thread stimulus→outcome; full replay + independent verification
- **Adaptation is governed** — learning proposes changes; shadow testing + external arbiter required

## Design Space

Every reasoner is a point in a 20-axis space across 5 clusters:
- **Knowledge** (substrate, language, calculus, consistency)
- **Inference** (spectrum, exact, termination)
- **Control** (resources, scheduler, forgetting)
- **Learning** (locus, reward, belief/goal firewall)
- **Authority** (trust, provenance, governance, composition)

## Configurations

| Profile | Tier | Use Case |
|---------|------|----------|
| `device` | Ω₀ Kernel | Embedded, no LM, reflex-only |
| `conversation` | Ω₂ Agent | Chat with System One |
| `tool-use` | Ω₂ Agent | Tool-using agent (SeNARS default) |
| `research` | Ω₃ Cognitive | Deep reasoning, RLFP, self-improvement |
| `arcade` | Ω₁ Reasoner | Game-playing, RL benchmarking |

## Flavors (Projections)

`default` • `cybernetic` • `topological` • `category` • `thermodynamic` • `math` • `bio` • `meta` • `universal` • `flexible` (AEGIS) • `ambitious`

## Constitution (Non-Negotiable)

1. **Reward never mutates factual truth**
2. **Untrusted proposals judged before commit**
3. **Every mutation event-sourced**
4. **No self-modification self-approved**
5. **All reasoning paths bounded**
6. **No opaque scheduler decisions**
7. **Verifier independent of engine**
8. **Exact substrate isolated from uncertain similarity**
9. **No silent cognitive faults**
10. **Irreversible actions authorized**
11. **Paraconsistent graded truth**
12. **Evidence independence tracked**
13. **Attention decay separated from truth decay**
14. **Config validated at load time**

## Quick Start

```bash
# SeNARS default (tool-use profile)
pnpm meta:build --profile=tool-use

# AEGIS flexible (recommended target)
pnpm meta:build --profile=flexible

# Custom composition
pnpm meta:build --compose=thermodynamic,cybernetic,bio
```

## Architecture Documents

- `abstract.md` — This plan
- `compare.md` — 15-specification comparison
- `synthesize.md` — Design objective menu
- `synth/*.md` — Individual flavor specifications
- `control1/flow.control.md` — Current SeNARS control flow (distilled)
- `control2/flow.control.md` — Current SeNARS with wiring status
- `information1/flow.information.md` — Current SeNARS information flow

## Implementation Status

See `IMPLEMENTATION_STATUS.md` for phase-by-phase progress.
```

---

## 13. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| **Versatile control models** | All 11 flavors (`default` + 10 `synth/`) load and run |
| **Shared foundations** | Zero duplicate type definitions; all packages depend on `kernel-types` |
| **Configurable/scalable** | Ω₀–Ω₄ tiers each independently deployable; feature flags toggle axes |
| **Elegant universal architecture** | Single `CognitiveTransaction` class; single `CommitLedger`; single `ControlWord` |
| **Backward compatible** | All existing SeNARS tests pass via `SeNARSAdapter` |
| **Constitution enforced** | `validateConfiguration()` runs at build + runtime; infeasible = rejected |
| **Incremental migration** | Each phase delivers runnable system; no "big bang" rewrite |
| **AGENTS.md compliance** | Elegant, consolidated, consistent, organized, DRY, abstract, modularized, parameterized |

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Over-abstraction before runnable kernel | **Kernel-first staging** (Phase 0 = runnable in week 1) |
| Performance regression | Budget office reservations prevent starvation; benchmarks at each phase |
| Migration breaks existing code | `SeNARSAdapter` maintains 100% API compatibility; behavioral equivalence tests |
| Governance paralysis | Graduated autonomy (risk determines path); `focus-weight` auto-applies |
| Audit bloat | Tiered/sampled audit; provenance depth configurable |
| LM authority creep | Constitution Φ2 + Φ10: untrusted ⇒ judged; scheduler decisions event-sourced |

---

## 15. Next Steps

1. **Approve this plan** — confirm phase breakdown, priorities, timeline
2. **Create `kernel-types` package** — extract all shared types (Week 1)
3. **Implement `Constitution` validator** — encode Φ as executable checks (Week 1)
4. **Build `CognitiveKernel` scaffold** — minimal Ω₀ with transaction + ledger + provenance (Week 2)
5. **Wire SeNARS `default` profile** — prove behavioral equivalence (Week 3)
6. **Iterate through phases** — 2-week sprints per phase, with integration checkpoints

---

*This plan follows AGENTS.md principles: surgical edits, self-documenting code, composition over inheritance, typed ports over concrete dependencies, configuration over code, and incremental implementability.*