# SeNARS NEXT — Planned & Unimplemented Subsystems

> Extracted from `DESIGN.md` — subsystems designed but not yet implemented in the codebase.
> This file tracks future work to achieve parity with the architecture vision.

---

## 1. Planner Subsystem (Not Implemented)

**No planner code exists in `src/nar/`.** The architecture design includes:

| Planner                     | Algorithm                               | Purpose                             | Priority |
|-----------------------------|-----------------------------------------|-------------------------------------|----------|
| **HTN** (default)           | Hierarchical Task Network decomposition | Structured, multi-step goals        | High     |
| **A* Search**               | Heuristic-guided optimal pathfinding    | Pathfinding, optimal solutions      | Medium   |
| **Temporal Planning**       | Constraint-based scheduling             | Time-critical, resource-constrained | Medium   |
| **Contingency Planning**    | Branching on uncertainty                | Dynamic/unpredictable environments  | Medium   |
| **Multi-Agent Planning**    | Coordination protocols                  | Distributed problem-solving         | Low      |
| **Reactive Planning**       | Event-driven replanning                 | Real-time adaptation                | Medium   |
| **Learning-Based Planning** | Plan reuse, learning from failures      | Experience-driven efficiency        | Low      |

### Required Integration Points

- Goal tasks → Planner → Operation tasks (`(&/, action, condition)`)
- Plan execution monitoring → deviation detection → `PlanRepairer` (LM service)
- Plan cost models (time, resources, risk) → priority allocation
- Difficulty assessment (knowledge availability) → cognitive resource allocation

---

## 2. Neural Services (Designed, Not Implemented)

The neuro-symbolic bridge architecture defines these services; only `ProactiveEnricher` and `BidirectionalFeedbackLoop`
are implemented.

| Service                      | Class                      | Role                                            | Trigger                                    | Dependencies                                  |
|------------------------------|----------------------------|-------------------------------------------------|--------------------------------------------|-----------------------------------------------|
| **HypothesisGenerator**      | `HypothesisGenerator`      | Creative abduction when logic hits boundaries   | Unanswerable questions, novel situations   | `LMService`, `Memory`, concept context        |
| **PlanRepairer**             | `PlanRepairer`             | Alternative strategies for failed plans         | Plan execution failure, obstacle detection | `LMService`, `Planner`, failed plan context   |
| **SemanticSimilarityEngine** | `SemanticSimilarityEngine` | Vector-based analogical retrieval               | Concept linking, cross-domain transfer     | Vector DB / embeddings, `Memory` index        |
| **NLPProcessor**             | `NLPProcessor`             | Bidirectional Narsese ↔ Natural Language        | I/O, human interaction                     | `LMService`, structured output parsing        |
| **QAService**                | `QAService`                | Natural language QA with confidence & citations | User questions, internal queries           | `LMService`, `Memory`, `ExplanationGenerator` |
| **ExplanationGenerator**     | `ExplanationGenerator`     | Translate formal proofs to fluent narratives    | `explain()` API, audit logs                | `LMService`, `ReasoningTrace`                 |

### Implementation Notes

- Each service should be an `LMRule` subclass for uniform orchestration
- Services need structured prompts with JSON schema output (via `generateObject`)
- Validation/integration via `BidirectionalFeedbackLoop` pattern
- Configurable per-service: model selection, temperature, timeout, retry

---

## 3. Architectural Extensions (Design Phase)

| Extension                            | Status   | Description                                                 | Key Files to Create                                                       |
|--------------------------------------|----------|-------------------------------------------------------------|---------------------------------------------------------------------------|
| **Vector DB Integration**            | Planned  | Semantic search at scale (Qdrant, Pinecone, LanceDB)        | `src/nar/memory/vector-index.ts`, `VectorMemoryIndex`                     |
| **Distributed Knowledge Federation** | Design   | Multi-agent shared memory, negotiation protocols            | `src/nar/federation/`, `FederationProtocol`, `RemoteConcept`              |
| **Constitutional AI (Full)**         | Partial  | Immutable safety core with audit trail, evolution tracking  | Extend `setConstitution`, `ConstitutionAuditLog`, `ConstitutionEvolution` |
| **Edge Deployment**                  | Research | WASM target for offline/embedded agents                     | `wasm-build.ts`, memory/CPU profiling, `wasm-bindgen` config              |
| **Neural-Symbolic Compiler**         | Research | Narsese ↔ neural net distillation, differentiable reasoning | `src/nar/compiler/`, `NeuralRuleExtractor`, `DifferentiableNAL`           |

---

## 4. Advanced Reasoning (Roadmap)

| Capability                      | Description                                                                          | Prerequisites                                                    |
|---------------------------------|--------------------------------------------------------------------------------------|------------------------------------------------------------------|
| **Probabilistic Reasoning**     | Uncertainty propagation beyond frequency/confidence; Bayesian networks over concepts | Extended `Truth` type, probabilistic rule variants               |
| **Advanced Temporal Reasoning** | Complex intervals, Allen's interval algebra, duration reasoning                      | Temporal term types exist; need interval algebra rules           |
| **Causal Reasoning**            | Counterfactual analysis, do-calculus, causal discovery                               | Causal implication rules (`=/>`, `=\\>`), intervention semantics |
| **Quantitative Reasoning**      | Mathematical operations, arithmetic, comparison in Narsese                           | Numeric term types, arithmetic inference rules                   |

---

## 5. Meta-Cognition Enhancements

| Enhancement                          | Current State                                                                                                                | Target                                                               |
|--------------------------------------|------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| **RLFP Full Integration**            | Skeleton classes exist (`RLFPLearner`, `RewardModel`, `PolicyOptimizer`, `PreferenceCollector`, `ReasoningTrajectoryLogger`) | Connect to `CognitiveController.adapt()`, train on live trajectories |
| **Self-Tuning Planners**             | Planner not implemented                                                                                                      | Requires planner + RLFP integration                                  |
| **Principled Goal Refinement**       | `DriveManager` exists, goal hierarchy minimal                                                                                | Hierarchical goal decomposition, precedence, resource allocation     |
| **Auditable Constitution Evolution** | `setConstitution`/`getConstitution` only                                                                                     | Change tracking, rollback, approval workflow                         |
| **Advanced Meta-Cognitive Control**  | `CognitiveController` adapts strategies                                                                                      | Strategy effectiveness tracking, dynamic strategy invention          |

---

## 6. Memory & Scalability

| Feature                                   | Description                                         | Effort |
|-------------------------------------------|-----------------------------------------------------|--------|
| **Hybrid Memory Systems**                 | External storage (SQL, Redis, S3) for archive tier  | Medium |
| **Decentralized Knowledge Federation**    | Multi-agent shared memory with conflict resolution  | High   |
| **Advanced Forgetting Algorithms**        | Importance-weighted, consolidation-aware forgetting | Medium |
| **Scalable Neural Service Architectures** | Batched LM calls, model routing, caching            | Medium |

---

## 7. Multi-Agent & Social

| Capability                       | Description                                       |
|----------------------------------|---------------------------------------------------|
| **Multi-Agent Coordination**     | Shared goals, negotiation, commitment protocols   |
| **Theory of Mind**               | Modeling other agents' beliefs, goals, intentions |
| **Normative/Ethical Regulation** | Constitution-based behavior constraints           |
| **Strategic Communication**      | Dialogue management for collaboration             |

---

## 8. Integration & Application Layer

| Feature                               | Description                                  |
|---------------------------------------|----------------------------------------------|
| **Industry-Specific Knowledge Bases** | Ontologies for finance, bio, legal, DevOps   |
| **Real-Time Enterprise Integration**  | Kafka, gRPC, GraphQL adapters                |
| **Enhanced Explainability Tools**     | Visual derivation graphs, interactive traces |
| **Regulatory Compliance & Audit**     | SOC2, GDPR, AI Act compliance helpers        |

---

## 9. Implementation Priority (Suggested)

### Phase 1: Core Planning (High Impact)

1. **HTN Planner** — enables goal-directed autonomy
2. **PlanRepairer** LM service — closes plan execution loop
3. **HypothesisGenerator** LM service — closes reasoning gap loop

### Phase 2: Scalability & Multi-Agent (Medium Impact)

4. **Vector DB Integration** — semantic search at scale
5. **SemanticSimilarityEngine** — enables analogical reasoning
6. **Distributed Knowledge Federation** — multi-agent foundation

### Phase 3: Advanced Reasoning (Research Impact)

7. **Probabilistic Reasoning** — uncertainty beyond NAL
8. **Causal Reasoning** — intervention, counterfactuals
9. **Neural-Symbolic Compiler** — differentiable NAL

### Phase 4: Production Hardening

10. **Full Constitutional AI** — audit, evolution, compliance
11. **Edge/WASM Deployment** — embedded agents
12. **Enterprise Integrations** — Kafka, gRPC, observability

---

## 10. Technical Debt & Refactoring (From Codebase)

| Area                     | Issue                                   | Fix                                                                            |
|--------------------------|-----------------------------------------|--------------------------------------------------------------------------------|
| **Planner**              | Missing entirely                        | Implement HTN as first planner                                                 |
| **RLFP**                 | Skeleton only                           | Wire into `CognitiveController.adapt()`                                        |
| **Constitution**         | Minimal (`setConstitution` only)        | Audit log, evolution tracking, approval                                        |
| **Temporal Rules**       | Some rules are `undefined` placeholders | Implement `operationExecution`, `goalExecution`, `strategyEffectiveness`, etc. |
| **LM Service Selection** | Basic priority/rotation selectors       | Add cost-aware, latency-aware, quality-aware selectors                         |
| **Tool Adapters**        | Basic external tools                    | Add RAG, code execution sandboxing, approval flows                             |

---

## 11. Tracking

| Item                | Status      | Owner | Target |
|---------------------|-------------|-------|--------|
| HTN Planner         | Not started | —     | Q1     |
| HypothesisGenerator | Not started | —     | Q1     |
| PlanRepairer        | Not started | —     | Q1     |
| Vector DB           | Not started | —     | Q2     |
| RLFP Integration    | Skeleton    | —     | Q2     |
| Constitutional AI   | Partial     | —     | Q3     |
| WASM Build          | Research    | —     | Q3     |

---

*This file is the source of truth for future work. Update as implementation progresses.*