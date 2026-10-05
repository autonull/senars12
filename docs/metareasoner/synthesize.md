Flavors:

# ambitious
Synthesize the ultimate ambitious design, delivering a complete, self-contained specification.

# flexible
Synthesize the ultimate ambitious, flexible, scalable, comprehensive, customizable design - delivering a complete, self-contained specification.

# universal
Synthesize an ultimate design - delivering a complete, self-contained specification.
- flexible, scalable, comprehensive, customizable - elegantly covering all known reasoner types, and beyond

# meta
Synthesize an ultimate design - delivering a complete, self-contained specification.
- flexible, scalable, comprehensive, customizable - covering all known reasoner types, and beyond
- metaprogrammatic, recursive, elegant, efficient

# bio
Synthesize an ultimate design - delivering a complete, self-contained specification.
- cellular, evolving, growing/scalable, autopoietic

# math
Synthesize an ultimate design - delivering a complete, self-contained specification.
- mathematical, algebraic, pure, elegant


----

Note: Exclude comparisons with the original SeNARS design.

# Design Objectives & Principles

### Select the principles that should govern the ultimate hybrid specification

## A. Non-negotiable foundations

**A1 — Epistemic Integrity**
Preserve the belief/goal firewall, evidence-sensitive truth, contradiction tolerance, and prevention of reward/desire → factual-truth mutation. 

**A2 — Single Commit Authority**
All durable cognitive mutation should pass through one explicit, typed, governable commit/admission surface. 

**A3 — Provenance by Construction**
Every meaningful operation should be observable, correlated, replayable, and independently verifiable rather than merely logged after the fact. 

**A4 — Bounded / Anytime Cognition**
No unbounded reasoning path: budgets, interruption, yielding, degradation, and bounded memory remain first-class architectural properties. 

## B. Capability objectives

**B1 — Declarative Control Flow**
Make stages, transitions, guards, optionality, parallelism, and iteration **data**, not hard-coded sequencing. 

**B2 — Adaptive Scheduling**
Move from fixed sequencing toward priority, dataflow, claim queues, and eventually learned scheduling—but only within hard safety and budget constraints. 

**B3 — Unified Cognitive Transactions**
Represent perception, inference, proposals, learning, actions, consolidation, and self-modification as the same general class of typed, budgeted, governed operation. 

**B4 — Hybrid Substrate Synergy**
Permit symbolic, exact, probabilistic, neural, and heuristic mechanisms to coexist while preserving explicit arbitration boundaries and preventing semantic contamination between substrate types. 

**B5 — Resource Economy**
Treat computation as an allocatable economy: reservations, costs, priorities, utility, backpressure, and graceful degradation rather than only fixed counters. 

**B6 — Context-Sensitive Governance**
Make trust, risk, reversibility, proof status, and blast radius jointly determine the required execution/commit path. 

## C. Evolution / autonomy objectives

**C1 — Governed Adaptation**
Learning may alter strategies, parameters, rules, and eventually code, but changes remain proposals subject to testing, shadow execution, rollback, and progressively stronger authority. 

**C2 — Causal Observability**
Make every cognitive outcome traceable to its stimulus, cycle, transaction, proposer, judge, proof, parent event, and resource/failure context. 

**C3 — Graceful Degradation**
When judgment, compute, memory, tools, or models are unavailable, degrade to a known weaker mode rather than producing undefined behavior or unnecessarily halting cognition. 

**C4 — Incremental Implementability**
Every architectural abstraction must have a plausible migration path from current SeNARS mechanisms; avoid designs whose elegance depends on replacing the entire runtime at once.

## D. Architectural character — choose the desired bias

**D1 — Maximum Auditability**
Prefer deterministic, inspectable, replayable behavior even at the cost of some adaptability.

**D2 — Maximum Cognitive Power**
Prefer richer search, concurrent reasoning, deeper adaptation, and broader operator portfolios within invariant constraints.

**D3 — Maximum Elegance / Unification**
Minimize special cases: one control model, one transaction model, one commit surface, one governance vocabulary, one resource model. 

**D4 — Maximum Robustness**
Optimize for fault tolerance, uncertainty, partial failure, interruption, contradiction, and degraded environments.

**D5 — Maximum Modularity**
Keep substrates, schedulers, judges, memory models, and governance mechanisms replaceable behind typed ports.

**D6 — Maximum Adaptivity**
Permit the controller itself to become increasingly responsive to state, history, objectives, and learned evidence—while retaining hard architectural constraints.

----

Below is a compact **design-objective / principle menu** for steering the synthesis of the 15 design-space documents into one implementable hybrid specification.

Suggested usage:

> **Pick 3–5 Prime Objectives**  
> **Pick 2–4 Hard Constraints**  
> **Pick 1–3 Anti-Goals**  
> Then use those selections to resolve conflicts between algebraic elegance, safety, performance, adaptability, and implementability.

---

## Baseline Load-Bearing Principles

These appear across nearly all the documents and are probably worth preserving unless we explicitly want a different class of system.

| ID | Principle | Meaning |
|---|---|---|
| **B1** | **Epistemic firewall** | Reward, desire, goals, and utility must not mutate factual truth values. |
| **B2** | **AIKR boundedness** | Cognition is finite: budgets, forgetting, decay, backpressure, and interruption are first-class. |
| **B3** | **Event-sourced state** | State is reconstructable from an append-only cognitive event log. |
| **B4** | **Untrusted proposers, trusted judgment** | LM/neural/reflex/peer outputs are proposals, not direct truth. |
| **B5** | **Replayable auditability** | Derivations and control decisions can be independently verified or replayed. |

---

## Selectable Design Objectives

| ID | Objective / Principle | Synthesis Bias | Main Cost |
|---|---|---|---|
| **O1** | **Maximum epistemic integrity** | Prioritize belief/goal separation, paraconsistency, evidence independence, calibrated admission, and truth preservation. | May reduce speed and opportunistic learning. |
| **O2** | **Auditable causal provenance** | Every perception, inference, proposal, judgment, budget charge, and commit carries correlation/causal IDs. | Storage and tracing overhead. |
| **O3** | **Control-plane fluidity** | Replace fixed stage loops with data-driven conditional stage graphs, KAT control words, or cognitive DAGs. | Harder static analysis; needs stronger tracing. |
| **O4** | **Resource economics** | Budgets become reservations, prices, markets, or thermodynamic allocations rather than only static quotas. | More complex scheduler and potential gaming. |
| **O5** | **Minimal implementable kernel** | Reduce the architecture to the smallest load-bearing core: substrate, control word, gate, budget, provenance. | Fewer built-in cognitive behaviors initially. |
| **O6** | **Governed reflexivity** | All learning, strategy change, rule induction, and self-modification pass through proposal, shadow validation, and governance. | Slower adaptation; more process overhead. |
| **O7** | **Neuro-symbolic synergy** | Neural/LM/reflex systems propose; symbolic/NAL/manifold systems judge, calibrate, veto, and commit. | Verification bottleneck; calibration burden. |
| **O8** | **Unified commit ledger** | All state mutation — perception, inference, learning, action, self-mod — uses one governed transaction/commit path. | Refactor complexity; possible throughput cost. |
| **O9** | **Compositional configurability** | Make stages, gates, budgets, strategies, memory ports, and governance policies declarative and pluggable. | Abstraction overhead; larger test surface. |
| **O10** | **Real-time / deployment performance** | Optimize latency, throughput, edge operation, deterministic scheduling, and graceful degradation. | May pressure audit depth or judgment coverage. |
| **O11** | **Cognitive richness / agency** | Support drives, curiosity, consolidation, imagination, multi-rate loops, and self-assessment. | Larger safety and resource surface. |
| **O12** | **Formal/mathematical rigor** | Prefer algebraic laws, feasibility predicates, typed invariants, and verifiable composition. | Slower implementation; risk of overformalization. |
| **O13** | **Incremental migration from SeNARS** | Preserve current invariants while moving stepwise toward the hybrid spec. | May retain legacy seams longer. |
| **O14** | **Multi-agent/ecological reasoning** | Support delegation, peer proposals, shared calibration, collective verification, and capability tokens. | Increases attack surface and coordination complexity. |

---

## Selectable Hard Constraints

These are stronger than objectives: they define what the final spec must never violate.

| ID | Constraint |
|---|---|
| **H1** | No reward signal may directly alter belief truth values. |
| **H2** | No untrusted proposal may enter memory without judgment or explicit provisional typing. |
| **H3** | No state mutation may occur without an event-log entry. |
| **H4** | No self-modification may be self-approved without external or governed arbitration. |
| **H5** | No reasoning path may be unbounded in memory, time, derivations, or LM calls. |
| **H6** | No scheduler decision may be completely opaque; control choices must be inspectable. |
| **H7** | No verifier may share unsafe engine dependencies when checking derivations. |
| **H8** | No exact symbolic/e-graph substrate may union nodes based solely on uncertain similarity. |
| **H9** | No failure may be silently swallowed where it affects cognition, budget, or admission. |
| **H10** | No irreversible action may bypass risk classification and authorization. |

---

## Selectable Anti-Goals

These are things we should explicitly avoid over-optimizing.

| ID | Anti-Goal | Meaning |
|---|---|---|
| **A1** | **Avoid maximal abstraction before implementation** | Do not let algebraic purity block a runnable kernel. |
| **A2** | **Avoid scheduler opacity** | Do not create a learned/market scheduler that cannot be audited. |
| **A3** | **Avoid governance paralysis** | Do not make every low-risk change require human approval. |
| **A4** | **Avoid audit bloat** | Do not log everything at full fidelity if it kills performance. |
| **A5** | **Avoid monolithic LM authority** | Do not let the LM become the implicit core controller. |
| **A6** | **Avoid premature multi-agent complexity** | Do not add peer mesh before single-agent control is stable. |
| **A7** | **Avoid unbounded cognitive richness** | Do not add drives/imagination/consolidation without budgets and governance. |

---

## Example Selection Bundles

### 1. **Safe Fortress**
Best if the priority is trustworthy, auditable operation.

- **Prime Objectives:** O1, O2, O6, O10  
- **Hard Constraints:** H1, H2, H3, H4, H5  
- **Anti-Goals:** A2, A5, A7  

Result: conservative, highly governable, excellent auditability, limited control-plane flexibility.

---

### 2. **Auditable Adaptive Control**
Probably the strongest balanced path.

- **Prime Objectives:** O1, O2, O3, O6, O8  
- **Hard Constraints:** H1, H2, H3, H6  
- **Anti-Goals:** A2, A5  

Result: preserves SeNARS safety while making control flow data-driven, inspectable, and governable.

---

### 3. **Economic Cognitive Engine**
Best if we want powerful scheduling and resource adaptation.

- **Prime Objectives:** O2, O3, O4, O7, O8  
- **Hard Constraints:** H1, H2, H3, H5, H6  
- **Anti-Goals:** A2, A4  

Result: flexible, utility-driven cognition; requires strong provenance to avoid opaque economic scheduling.

---

### 4. **Minimal Implementable Core**
Best if the goal is to build the smallest viable hybrid first.

- **Prime Objectives:** O2, O3, O5, O8  
- **Hard Constraints:** H1, H3, H5, H9  
- **Anti-Goals:** A1, A7  

Result: small kernel with clear extension points; defers rich agency and complex economics.

---

### 5. **Full Synergistic Target**
Best for the most ambitious final architecture.

- **Prime Objectives:** O1, O2, O3, O4, O6, O7, O8  
- **Hard Constraints:** H1, H2, H3, H4, H5, H6, H9  
- **Anti-Goals:** A2, A5, A7  

Result: powerful, adaptive, neuro-symbolic, governed, and auditable — but implementation-heavy.

