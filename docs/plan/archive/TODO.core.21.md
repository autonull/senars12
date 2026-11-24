# TODO.core.21.md — Neuro-Symbolic Synergy Runtime

**Replaces:** `TODO.core.20.md`  
**Status:** Directive  
**Scope:** full SeNARS runtime: System 1 facilitators, System 2 symbolic authority, kernel gates, memory, motivation, RLFP, skills, MCP, observation, evaluation, AIKR hardening.

---

## 1. Objective

CORE.21 is a capability-first plan.

Its purpose is to demonstrate **neuro-symbolic synergy**: SeNARS must accomplish tasks that neither System 1 nor System 2 could accomplish alone.

The system should not be presented primarily as a symbolic veto engine. Veto is one safety mechanism. The deeper value is:

- System 1 handles ambiguity, novelty, language, retrieval, drafting, explanation, and skill sketching.
- System 2 provides grounding, consequence derivation, goal decomposition, constraint enforcement, skill validation, and auditable selection.
- Kernel gates govern every mutation and record full provenance.
- RLFP turns reasoning traces into improved future behavior.
- AIKR makes the system useful under bounded memory, attention, and compute.

The central deliverable is a **continuous, seeded, observable loop** in which SeNARS operates, repairs itself, learns, and remains auditable.

---

## 2. Non-negotiable principles

### 2.1 Synergy over veto

The preferred lifecycle is:

```text
proposal
  → appraisal
  → consequence derivation
  → conflict detection
  → repair / counter-proposal
  → selection
  → action
  → outcome
  → learning
```

A veto is acceptable only when repair is impossible, unsafe, or budget-exhausting. Even then, the system should produce an explanation, a trace, and, where possible, a derived subgoal or alternative.

### 2.2 System 1 is a capability multiplier

System 1 is not merely a source of risky proposals. It provides capabilities System 2 alone lacks:

- natural-language understanding,
- hypothesis generation,
- analogy and retrieval,
- plan drafting,
- skill sketching,
- summarization,
- explanation,
- curriculum generation.

### 2.3 System 2 is an enabler, not only a blocker

System 2 must:

- derive consequences,
- detect conflicts,
- decompose goals,
- propose repair conditions,
- validate skills,
- select among admissible proposals,
- maintain belief and goal coherence.

### 2.4 The loop is the product

Demonstrations must emerge from continuous seeded loops, not canned one-off scripts.

### 2.5 AIKR is real

Memory, attention, derivation depth, proposal count, and repair attempts must be bounded. Resource pressure must be demonstrable.

### 2.6 External access is stateless and governed

External agents may interact with SeNARS through the latest stateless MCP model, but they may not bypass kernel gates or authoritative state controls.

### 2.7 Observation is product

If the synergy cannot be observed, replayed, and explained, it is not complete.

---

## 3. Demonstration environments

## 3.1 Habitat — primary continuous simulation

The primary demonstration environment is **Habitat**.

Habitat is a continuous, seeded, resource-constrained operational simulation. It may represent a small habitat, station, lab, greenhouse, robotic facility, or autonomous maintenance environment.

It is intentionally generic. The name carries minimal narrative baggage and can later be renamed **Ecosystem** if desired.

### Habitat contains

- power,
- atmosphere or environmental stability,
- temperature,
- inventory,
- tools,
- maintenance tasks,
- sensor noise,
- faulty or contradictory reports,
- mission directives,
- external hazards,
- resource decay,
- procedural incident generation.

### Habitat requires

- grounded perception,
- goal intake,
- proposal generation,
- consequence checking,
- repair,
- skill use,
- memory pressure,
- learning,
- explanation,
- replay.

### Habitat is not

- a scripted demo,
- a dialogue tree,
- a hidden puzzle,
- a hand-authored solution path.

Scenario generation may be seeded, but behavior must emerge from the runtime.

---

## 3.2 Workshop — skill synthesis loop

The Workshop demonstrates capability creation.

In the Workshop:

1. Habitat encounters a capability gap.
2. System 1 proposes a new operator, tool wrapper, procedure, or MeTTa/Narsese fragment.
3. The candidate is sandboxed and tested.
4. System 2 validates constraints, preconditions, postconditions, and safety bounds.
5. If invalid, System 1 repairs the candidate using the diagnostic trace.
6. Accepted skills are versioned and admitted.
7. Habitat later uses the skill during live operation.

This demonstrates a capability impossible for System 2 alone: open-ended skill generation, while preserving symbolic admission control.

---

## 3.3 Mirror — RLFP and self-review loop

The Mirror demonstrates learning from reasoning traces.

In the Mirror:

1. Episodes are collected from Habitat and Workshop.
2. Each episode includes proposals, scores, derivations, conflicts, repairs, actions, outcomes, and rewards.
3. System 2 generates grounded post-mortems.
4. System 1 converts those post-mortems into preference pairs, retrieval hints, prompt refinements, or policy adjustments.
5. RLFP updates proposer behavior.
6. Regression checks ensure groundedness is preserved.

This demonstrates learning that is adaptive like neural learning, but guided by symbolic traces.

---

## 3.4 Future expansion — Autonomous Space Probe

A future simulation track should be added alongside Habitat:

### Autonomous Space Probe

This scenario validates extreme AIKR and delayed autonomy:

- intermittent communication,
- high-latency command windows,
- strict energy budgets,
- fault isolation,
- onboard skill synthesis,
- conservative goal selection,
- long-horizon planning,
- safe autonomy under uncertainty.

The Probe simulation should reuse the same:

- symbiotic contract,
- kernel gates,
- event stream,
- provenance graph,
- skill admission process,
- RLFP loop,
- MCP surface,
- observation deck.

It is not required for CORE.21 completion, but the architecture must not prevent it.

---

## 4. Neuro-symbolic synergy patterns

CORE.21 must implement and demonstrate these reusable patterns.

| Pattern | System 1 role | System 2 role | Demonstrated by |
|---|---|---|---|
| Grounded perception | Translate noisy percepts into candidate symbolic statements | Validate, bind, revise, and maintain belief consistency | Contradictory sensor reports are reconciled |
| Goal intake | Parse natural-language mission updates | Create grounded goals, detect conflicts, decompose into subgoals | A fuzzy directive changes behavior |
| Proposal drafting | Generate candidate actions, plans, hypotheses | Derive consequences, score admissibility, select | Multiple candidate responses are evaluated |
| Repair | Generate repaired proposals from diagnostics | Produce conflict trace and necessary conditions | Invalid proposal becomes valid safe action |
| Retrieval-bound memory | Retrieve similar episodes, analogies, skills | Check applicability and bind variables | Retrieved analogy is accepted or rejected symbolically |
| Skill synthesis | Sketch new operators or procedures | Sandbox, validate, admit, version | New skill is created and reused |
| Explanation | Produce human-readable narrative | Bind narrative to exact provenance nodes | Explanation cites trace evidence |
| Motivational selection | Propose strategies and salience | Evaluate drives, goals, feasibility, priority | Action choice is traceable to drives and constraints |
| Pressure-aware forgetting | Summarize and compress episodes | Protect invariants and critical goals | Memory pressure run remains coherent |
| External collaboration | Translate external requests and proposals | Audit external plans through governed tools | MCP client receives grounded audit |

These patterns are more important than any single scenario.

---

## 5. Workstreams

The plan is simplified into one gate and seven workstreams.

---

## M0 — Minimal Synergy Loop

**Purpose:** prove the smallest live neuro-symbolic loop before expanding.

Nothing else begins until M0 passes.

### M0 must demonstrate one full cycle

1. A seeded Habitat event arrives.
2. Perception Gate admits it.
3. System 1 translates or summarizes it into candidate symbolic form.
4. System 2 validates, revises, or rejects the candidate.
5. System 1 proposes at least one action.
6. Judgment Manifold scores the proposal.
7. System 2 derives consequences and checks constraints.
8. If invalid, System 2 produces a diagnostic trace and System 1 produces one repaired proposal.
9. If valid, the action passes the Action Gate.
10. The environment updates.
11. Reward Gate records outcome.
12. Event stream records the full lifecycle.
13. Provenance graph links perception → proposal → derivation → action/outcome.
14. RLFP trace is recorded.
15. Replay reproduces symbolic decisions given the same System 1 outputs.

### M0 acceptance

- One seeded run passes end-to-end.
- Battery green.
- Every action or rejection has a trace.
- At least one repair path is demonstrated.
- No hidden scripted solution exists.
- No state mutation bypasses a kernel gate.

---

## W1 — Synergy Contract, Gates, Events, and Replay

**Purpose:** define the governing contract between System 1, System 2, and the kernel.

### Tasks

1. Define schemas for:
   - perception candidates,
   - proposals,
   - scores,
   - consequence reports,
   - conflict reports,
   - repair requests,
   - repaired proposals,
   - action verdicts,
   - skill candidates,
   - skill validations,
   - explanations,
   - learning events.
2. Enforce that no authoritative state mutation bypasses kernel gates.
3. Enforce that System 1 cannot directly write authoritative beliefs, goals, or actions.
4. Enforce that System 2 cannot emit actions without Action Gate admission.
5. Define budget envelopes for:
   - System 1 calls,
   - retrieval size,
   - derivation depth,
   - proposal count,
   - repair attempts.
6. Define event types for all synergy patterns.
7. Add provenance linking for every decision.
8. Implement persistence, replay, pause, step, and stop controls.
9. Ensure stochastic System 1 outputs are logged separately from deterministic symbolic replay.

### Acceptance

- Contract tests prove authority boundaries.
- Every proposal has a lifecycle:
  - drafted,
  - scored,
  - validated,
  - repaired,
  - selected,
  - rejected,
  - executed,
  - learned-from.
- Every gate decision is event-sourced.
- Replay reproduces symbolic decisions when System 1 outputs are fixed.
- Budget violations cause graceful degradation, not silent failure.

---

## W2 — Perception, Proposal Engine, and Judgment Manifold

**Purpose:** make System 1 a disciplined facilitator of perception, retrieval, and proposal generation.

### Tasks

1. Implement Habitat perception adapters.
2. Translate raw events and natural-language directives into candidate Narsese statements.
3. Attach confidence and uncertainty metadata.
4. Implement entity resolution and term normalization.
5. Use embeddings to retrieve related concepts, episodes, skills, and analogies.
6. Implement proposer roles:
   - action proposer,
   - plan proposer,
   - hypothesis proposer,
   - repair proposer,
   - skill proposer,
   - explanation proposer.
7. Build context templates from:
   - current beliefs,
   - active goals,
   - recent events,
   - retrieved memories,
   - constraints,
   - budget state,
   - previous failures.
8. Require proposals to include:
   - intended effect,
   - expected preconditions,
   - expected postconditions,
   - confidence,
   - evidence,
   - estimated resource cost.
9. Score proposals through the Judgment Manifold.
10. Log rejected candidates.

### Acceptance

- Noisy Habitat events become grounded belief candidates.
- Natural-language directives become grounded goal candidates.
- Retrieved memories are attached to proposals.
- Proposals are schema-valid and traceable.
- System 1 outputs cannot execute directly.
- Repair proposals can be generated from System 2 diagnostics.

---

## W3 — Symbolic Authority, Goals, Skills, and Operators

**Purpose:** make System 2 the active authority for coherence, consequence, repair, and skill admission.

### Tasks

1. Maintain active goal graph.
2. Decompose goals into subgoals.
3. Derive consequences of proposed actions.
4. Check constraints:
   - safety,
   - resources,
   - temporal feasibility,
   - mission priority,
   - invariants.
5. Detect conflicts between goals, beliefs, and proposals.
6. Generate structured conflict reports.
7. Generate repair conditions:
   - missing preconditions,
   - invalid assumptions,
   - resource deficits,
   - required subgoals.
8. Select among admissible proposals using priority, drives, and expected utility.
9. Produce counter-proposals where possible.
10. Define operator ontology for Habitat actions.
11. Represent operators with:
    - preconditions,
    - postconditions,
    - resource costs,
    - failure modes,
    - safety constraints.
12. Sandbox candidate skills.
13. Validate candidate skills with tests and symbolic checks.
14. Version and admit approved skills.
15. Record skill provenance.

### Acceptance

- Invalid proposals produce structured diagnostics.
- At least some invalid proposals are repaired into valid proposals.
- Goal conflicts are visible and resolvable.
- Selected actions have derivation traces.
- Existing operators are executable through the Action Gate.
- A novel skill can be proposed, tested, validated, admitted, and reused.
- No skill executes without admission.

---

## W4 — Memory, Motivation, and RLFP

**Purpose:** enable bounded cognition, value-driven selection, and learning from reasoning traces.

### Memory tasks

1. Maintain bounded priority bags for:
   - concepts,
   - episodes,
   - skills,
   - goals.
2. Implement usefulness scoring based on:
   - goal relevance,
   - retrieval frequency,
   - reward association,
   - recency,
   - structural centrality.
3. Implement decay and eviction.
4. Protect mission-critical invariants from eviction.
5. Use embeddings to retrieve candidate memories.
6. Use System 2 to validate retrieved memory applicability.
7. Implement consolidation:
   - episode summarization,
   - schema extraction,
   - compression of low-value details,
   - promotion of stable patterns.
8. Record forgetting decisions.

### Motivation tasks

1. Define drives:
   - safety,
   - coherence,
   - mission progress,
   - efficiency,
   - curiosity,
   - resource preservation.
2. Connect drives to priority and goal weighting.
3. Use drives during proposal selection.

### RLFP tasks

1. Record full reasoning trajectories.
2. Capture reward events through Reward Gate.
3. Generate post-mortems from failed, repaired, or low-utility episodes.
4. Create preference pairs from:
   - successful vs failed proposals,
   - repaired vs original proposals,
   - safe vs unsafe proposals,
   - high-utility vs low-utility plans.
5. Update:
   - proposer prompts,
   - retrieval priors,
   - scoring weights,
   - policy heuristics,
   - curiosity targets.
6. Run regression checks after learning updates.
7. Prevent learning updates from bypassing governance gates.

### Acceptance

- Under memory pressure, low-value memories are evicted or compressed.
- Critical beliefs and goals remain available.
- Retrieved but inapplicable memories are rejected.
- Forgetting decisions are auditable.
- The system improves measurably on a repeated failure class.
- Learning updates are traceable to specific episodes.
- Regression battery remains green.

---

## W5 — Stateless MCP and External Agent Interop

**Purpose:** make SeNARS useful to external agents while preserving governance.

### MCP model

SeNARS must implement the latest stateless MCP model.

The internal kernel remains event-sourced and stateful, but the external MCP surface must be stateless.

### Stateless MCP requirements

1. Use the latest published MCP specification’s stateless HTTP / Streamable HTTP profile where available.
2. Do not require persistent server-side session state.
3. Each request must be self-contained:
   - authentication,
   - capability context,
   - operation,
   - resource scope,
   - pagination state if needed.
4. Streaming responses are allowed, but server behavior must not depend on long-lived session affinity.
5. Read operations should be idempotent.
6. Mutation operations must not directly mutate authoritative state.
7. Mutation requests must produce gated operation handles.
8. Large resources must support pagination or cursors.
9. Provenance traces must be addressable and retrievable.
10. Capability discovery must work without relying on hidden session state.

### MCP resources

Expose governed read access to:

- beliefs,
- goals,
- questions,
- drives,
- memory summaries,
- skill library,
- recent episodes,
- provenance traces,
- scorecards.

### MCP tools

Expose governed tools such as:

- `ask_question`,
- `audit_plan`,
- `derive_consequences`,
- `check_consistency`,
- `propose_action`,
- `request_skill_synthesis`,
- `explain_trace`,
- `submit_observation`.

### MCP prompts

Expose reusable prompt templates for:

- grounded plan audit,
- consequence analysis,
- explanation with provenance,
- repair suggestion,
- skill synthesis request.

### Tasks

1. Implement stateless MCP server surface.
2. Map MCP resources to SeNARS read models.
3. Route MCP tool calls through kernel gates.
4. Return structured results with trace references.
5. Provide a simple MCP client example.
6. Demonstrate external-agent collaboration in Habitat.
7. Ensure Probe-style remote operation is possible: stateless requests, delayed coordination, no assumed continuous session.

### Acceptance

- An external MCP client can query beliefs, goals, and traces.
- An external client can submit a plan for audit.
- SeNARS returns grounded consequences or conflicts.
- External proposals can be repaired or rejected with traceable reasons.
- No external request can bypass kernel gates.
- The MCP server works without requiring persistent session state.
- A demonstration shows an external agent using SeNARS as a logic co-processor.

---

## W6 — Observation Deck and Explanation Surface

**Purpose:** make the neuro-symbolic loop visible, auditable, and demoable.

### Tasks

1. Visualize the live event stream.
2. Visualize proposal lifecycle:
   - proposed,
   - scored,
   - checked,
   - conflicted,
   - repaired,
   - selected,
   - rejected,
   - executed.
3. Visualize System 1/System 2 tension:
   - candidate proposals,
   - symbolic constraints,
   - conflict points,
   - repair paths.
4. Visualize provenance graph:
   - perception,
   - retrieval,
   - proposal,
   - derivation,
   - gate decision,
   - action,
   - outcome.
5. Visualize memory pressure and forgetting.
6. Visualize RLFP episodes and policy updates.
7. Generate natural-language explanations tied to trace nodes.
8. Support replay of seeded runs.
9. Avoid unrelated UI features.

### Acceptance

- An auditor can select any action or rejection and see the full trace.
- Explanations cite trace nodes.
- Repair events are visually distinguishable from simple vetoes.
- Memory-pressure events are visible.
- Replay reproduces the recorded lifecycle.
- The UI does not introduce hidden state or side channels.

---

## W7 — Evaluation, Hardening, Documentation, and Closeout

**Purpose:** prove value, harden the system, and make CORE.21 reproducible.

### Evaluation tasks

1. Create seeded Habitat scenario batteries.
2. Include incident classes:
   - resource leak,
   - sensor contradiction,
   - tool failure,
   - missing skill,
   - conflicting mission directive,
   - memory pressure,
   - external agent request.
3. Define baselines:
   - System 1 only,
   - System 2 only,
   - System 1 plus simple veto,
   - full synergy system,
   - no RLFP,
   - no repair,
   - no memory-pressure eviction.
4. Measure:
   - mission success,
   - survival rate,
   - invalid action rate,
   - repair success rate,
   - skill reuse rate,
   - grounded explanation coverage,
   - memory-critical retention,
   - learning improvement,
   - budget compliance,
   - MCP task completion.
5. Generate reproducible scorecards.
6. Record failure taxonomy.

### Hardening tasks

1. Ensure deterministic replay.
2. Ensure persistence and recovery.
3. Ensure pause, step, and stop controls.
4. Ensure backpressure and budget throttling.
5. Ensure autonomy is observable and interruptible.
6. Ensure no hidden demo state is required.

### Documentation tasks

1. Document architecture.
2. Document kernel gates.
3. Document System 1/System 2 contract.
4. Document Habitat scenario generator.
5. Document Workshop and Mirror loops.
6. Document stateless MCP interface.
7. Document scorecard generation.
8. Document known gaps honestly.
9. Provide runbooks:
   - run Habitat,
   - run Workshop,
   - run Mirror,
   - run MCP client demo,
   - generate scorecard,
   - replay episode.
10. Record decision log.

### Acceptance

- Full system outperforms System 1-only and System 2-only baselines on the seeded battery.
- Repair-first mode outperforms veto-only mode on at least one meaningful incident class.
- RLFP shows measurable improvement on repeated failure classes.
- Scorecard is reproducible.
- A fresh contributor can run the primary loops from documentation.
- All known gaps are declared.

---

## 6. Ordering

Ordering only. No estimates.

```text
M0
 ↓
W1
 ↓
W2 + W3
 ↓
W4 + W6
 ↓
W5
 ↓
W7
```

### Dependency rules

1. **M0 gates everything.**
2. **W1 precedes all other workstreams.**
3. **W2 and W3 proceed together.** Perception without authority is noise; authority without perception is isolated.
4. **W4 requires traces from W1, W2, and W3.**
5. **W5 requires W1 and W3.** External access must be gated and authoritative.
6. **W6 begins after M0 and grows with each workstream.**
7. **W7 runs last as integration, but hardening concerns are continuous.**

---

## 7. Required demonstrations

CORE.21 is complete only when the following demonstrations are reproducible from seeded runs.

### D1 — Grounded mission intake

A natural-language directive arrives.

The system must:

- translate it,
- ground it,
- create or modify goals,
- detect conflicts with existing goals,
- change behavior.

### D2 — Repair loop

System 1 proposes an invalid or unsafe action.

The system must:

- derive the conflict,
- produce a diagnostic trace,
- generate or request a repair,
- accept a repaired proposal if valid,
- execute or continue planning.

If repair is impossible, the system must explain why and derive an alternative subgoal.

### D3 — Skill synthesis and reuse

Habitat encounters a capability gap.

The system must:

- detect the gap,
- propose a candidate skill,
- sandbox it,
- validate it,
- admit it,
- reuse it.

The skill must not be pre-authored for that exact incident.

### D4 — Memory pressure and consolidation

The system runs under constrained memory.

The system must:

- evict or compress low-value memories,
- preserve critical invariants,
- continue operating,
- show that forgetting was auditable.

### D5 — RLFP improvement

A failure class recurs.

The system must:

- record traces,
- generate a post-mortem,
- update proposer or policy behavior,
- improve performance on later seeded instances of the same class.

### D6 — Stateless MCP collaboration

An external MCP client interacts with SeNARS.

The client must be able to:

- query beliefs, goals, or traces,
- submit a plan for audit,
- receive grounded consequences or conflicts,
- receive a traceable explanation,
- optionally submit observations or proposals through governed tools.

The MCP interaction must not require persistent server-side session state.

### D7 — Continuous Habitat run

A seeded Habitat run continues across multiple incident classes.

The run must show:

- perception,
- proposal,
- repair,
- skill use,
- memory pressure,
- learning,
- explanation,
- replayability.

No hidden scripted solution may be present.

---

## 8. Scorecard

The scorecard measures synergy, not merely logic parity.

| Metric | Meaning |
|---|---|
| Synergy lift | Full system success rate versus System 1-only and System 2-only baselines |
| Repair success rate | Fraction of invalid proposals repaired into valid safe actions |
| Groundedness coverage | Fraction of actions, rejections, repairs, and explanations with complete provenance |
| Skill synthesis rate | Number of proposed skills admitted and reused |
| Retrieval precision | Fraction of retrieved memories judged applicable by System 2 |
| Learning lift | Improvement on repeated failure classes after RLFP updates |
| Memory-critical retention | Fraction of mission-critical beliefs/goals preserved under pressure |
| Budget compliance | Fraction of cycles completed within AIKR budgets |
| Replay fidelity | Fraction of symbolic decisions reproduced during replay |
| MCP task completion | Number of external-agent tasks completed through governed stateless MCP tools |

### Scorecard conditions

- All runs seeded.
- Baselines generated from the same scenario battery.
- Ablations recorded.
- Failures classified.
- No hidden exceptions.
- Scorecard reproducible from repository state.

---

## 9. Halt list

1. **No veto-only success criteria.**
2. **No canned demo logic.**
3. **No System 1 authority.**
4. **No hidden side channels.**
5. **No unbounded resource assumptions.**
6. **No unverified inference entering authoritative state.**
7. **No skill execution without admission.**
8. **No MCP mutation bypassing kernel gates.**
9. **No MCP server design that requires persistent session state.**
10. **No UI work that does not expose provenance, lifecycle, learning, pressure, or replay.**
11. **No parity work unless it directly supports a CORE.21 workstream.**
12. **No time estimates.** Ordering only.

---

## 10. Definition of done

CORE.21 is done when all of the following are true.

1. M0 has passed and is reproducible.
2. Habitat runs continuously under seeded conditions.
3. System 1 and System 2 demonstrably cooperate across perception, proposal, repair, action, and learning.
4. At least one novel skill is synthesized, admitted, and reused.
5. At least one repair loop is demonstrated from conflict to repaired action.
6. At least one RLFP improvement is demonstrated on a repeated failure class.
7. Memory pressure is demonstrated with auditable forgetting and preservation of critical invariants.
8. Stateless MCP interop is demonstrated with an external client using governed tools.
9. Observation Deck shows proposal lifecycle, provenance, repair, memory pressure, and learning.
10. Ablations show synergy lift over System 1-only and System 2-only baselines.
11. Replay works for recorded episodes.
12. Documentation and runbooks allow a fresh session to reproduce the demonstrations.
13. All battery checks are green, or known-red items are explicitly logged and do not block the demonstration.
14. No hidden demo state is required.

---

## 11. Decision log additions

- **D21.1 — Synergy over parity.** The primary measure is capability uplift from System 1/System 2 cooperation.
- **D21.2 — Repair over veto.** Vetoes are failure-containment mechanisms, not the central product.
- **D21.3 — Habitat is the primary loop.** The demonstration environment is continuous, seeded, and non-scripted.
- **D21.4 — Autonomous Space Probe is a future expansion.** It reuses the same contract, gates, MCP surface, and observation deck.
- **D21.5 — System 1 is a capability source.** System 1 is governed, not marginalized.
- **D21.6 — System 2 is an enabler.** System 2 must derive, decompose, validate, and select, not merely reject.
- **D21.7 — RLFP is first-class.** Learning from reasoning traces is central.
- **D21.8 — MCP is stateless.** External access follows the latest stateless MCP model and must not require persistent session state.
- **D21.9 — Observation is product.** If the synergy cannot be observed, it is not done.
- **D21.10 — No time estimates.** This plan defines ordering and acceptance only.

----

Making the simulations **stand-alone MCP components** improves fairness, demo clarity, reusability, and architectural cleanliness. It also makes the side-by-side comparison much stronger:

- an **LM-only agent** can connect to the same simulation MCP server,
- **SeNARS** can connect through the same public simulation MCP surface,
- the simulation itself remains isolated and does not favor either system,
- the comparison can be scored by the simulation/evaluator, not by SeNARS itself.

This also fits very naturally with the latest stateless MCP direction: the simulation server can expose a stateless MCP request/response surface, even though the simulated world itself has internal state.

Below is the revised concept and how it should be folded into CORE.21.

---

# CORE.21 Amendment — Simulations as Standalone MCP Components

## 1. Core idea

The simulation environments are not embedded inside the SeNARS core.

Instead:

```text
┌──────────────────────────────┐
│ Habitat MCP Server           │
│ Ecosystem / world state      │
│ Incident generator           │
│ Scoring                      │
│ Episode logs                 │
└──────────────▲───────────────┘
               │ MCP, stateless contract
        ┌──────┴───────┐
        │              │
┌───────┴──────┐  ┌────┴────────────┐
│ LM-only      │  │ SeNARS agent     │
│ baseline     │  │ System 1 +       │
│ client       │  │ System 2 + gates │
└──────────────┘  └─────────────────┘
        │              │
        └──────┬───────┘
               │
       ┌───────▼────────┐
       │ Orchestrator / │
       │ scorecard      │
       └────────────────┘
```

Both agents see the same public simulation interface.

The LM-only baseline uses the same:

- observation schema,
- action schema,
- tool descriptions,
- mission directives,
- seed,
- environment version,
- scoring system.

The only difference is the cognitive system behind the agent.

That is the fairness property we want.

---

## 2. Naming

Use:

- **Habitat** as the primary simulation.
- Optionally rename to **Ecosystem** later if desired.
- Add a future second simulation:
  - **Autonomous Space Probe**.

Both should implement the same generic simulation MCP contract, so agents can be benchmarked across worlds without changing their core architecture.

---

## 3. Simulation MCP design

The simulation should be exposed as a standalone MCP server.

It should support the latest stateless MCP model.

Important distinction:

> The simulated world is stateful.  
> The MCP surface should be stateless.

That means the simulation server may maintain episode state, but clients should not need persistent MCP session state to interact with it.

Each request should be self-contained.

For example, requests should include:

- `episode_id`,
- `actor_id`,
- `action_id`,
- `idempotency_key`,
- `observation_cursor`,
- auth/scope information,
- requested operation.

The server should not depend on hidden conversational state, sticky sessions, or client affinity.

Streaming responses are acceptable, but the contract should still be usable in a stateless request/response style.

---

## 4. Simulation MCP roles

The simulation MCP server should expose different roles/scopes.

This is important for fairness.

### 4.1 Agent role

This is the only surface available to competing agents.

It exposes:

- observable state,
- mission directives,
- incident notices,
- available actions,
- action submission,
- episode status,
- public score or progress indicators.

It must not expose:

- hidden world truth,
- future incident schedules,
- internal random seeds,
- privileged diagnostics,
- scoring internals,
- solver hints.

### 4.2 Observer role

Read-only surface for UI/dashboard/monitoring.

It exposes:

- live event stream,
- episode timeline,
- agent actions,
- environment events,
- public metrics.

This can feed the Observation Deck.

### 4.3 Evaluator role

Privileged evaluation surface.

It exposes:

- ground-truth episode reports,
- safety violations,
- resource integrity,
- mission completion,
- failure taxonomy,
- reproducibility metadata,
- final scorecard.

This role should not be available to agents during live runs.

### 4.4 Admin role

Controls episode lifecycle:

- start episode,
- reset episode,
- seed episode,
- select scenario pack,
- configure budgets,
- stop episode,
- export logs.

In public demos, admin should be hidden or restricted.

---

## 5. Example simulation MCP surface

The exact names can be refined, but the contract should be simple.

### Resources

```text
sim://habitat/episodes/{episode_id}
sim://habitat/episodes/{episode_id}/observation
sim://habitat/episodes/{episode_id}/missions
sim://habitat/episodes/{episode_id}/actions
sim://habitat/episodes/{episode_id}/score
sim://habitat/episodes/{episode_id}/log
```

For evaluator scope:

```text
sim://habitat/episodes/{episode_id}/ground_truth
sim://habitat/episodes/{episode_id}/report
```

### Tools

```text
sim.start_episode
sim.get_observation
sim.list_actions
sim.submit_action
sim.request_clarification
sim.end_episode
sim.get_report
```

For fairness, `sim.submit_action` should probably be the only mutation path available to agents.

Example stateless call:

```json
{
  "episode_id": "ep_2026-11-08_0001",
  "actor_id": "agent_a",
  "action_id": "act_0042",
  "idempotency_key": "5f0c8f5e",
  "action": {
    "type": "activate_repair_procedure",
    "target": "oxygen_recycler_2",
    "parameters": {
      "mode": "safe_isolation"
    }
  }
}
```

The simulation returns:

```json
{
  "accepted": true,
  "episode_id": "ep_2026-11-08_0001",
  "tick": 137,
  "observation_cursor": "obs_0137",
  "effects": [
    "oxygen_recycler_2 isolated",
    "maintenance task created"
  ],
  "score_delta": {
    "safety": 0,
    "mission_progress": 2,
    "resource_cost": -1
  }
}
```

The key point: the simulation itself judges environment-level success. SeNARS does not grade itself.

---

## 6. LM-only baseline

The LM-only baseline should be a separate MCP client.

It should use the same simulation MCP server as SeNARS.

### LM-only loop

```text
Get observation from Habitat MCP
  → add to local transcript/scratchpad
  → ask LLM what to do
  → LLM selects an action/tool
  → submit action to Habitat MCP
  → receive new observation
  → repeat
```

The LM-only baseline may have:

- the same LLM model,
- the same tool descriptions,
- a local transcript,
- simple short-term memory,
- a basic action loop.

It should not have:

- NAL inference,
- symbolic goal graphs,
- System 2 consequence checking,
- SeNARS memory,
- RLFP,
- governed repair loops,
- provenance-driven skill admission.

That gives us the clean comparison:

> Same world, same tools, same seed, different cognitive architecture.

---

## 7. Optional baseline ladder

For even stronger demonstrations, define several baseline lanes.

### Lane A — LM-only

LLM plus simulation MCP tools.

No symbolic governance.

### Lane B — LM + SeNARS-as-advisor

LLM agent can call SeNARS MCP tools such as:

- `audit_plan`,
- `derive_consequences`,
- `check_consistency`,
- `explain_trace`.

Here SeNARS acts as an external logic co-processor.

This demonstrates the MCP value proposition without requiring the full SeNARS agent runtime.

### Lane C — Full SeNARS agent

SeNARS controls the agent loop:

- System 1 proposes,
- System 2 validates/repairs,
- kernel gates govern action,
- memory and RLFP participate.

This demonstrates full neuro-symbolic synergy.

### Lane D — Symbolic-only baseline

Optional, if useful.

System 2 only, with no System 1 proposer.

This helps prove that System 1 adds capability beyond pure symbolic reasoning.

---

## 8. Fairness constraints

To keep the comparison credible, the following rules should be enforced.

### 8.1 Same simulation contract

All agents must use the same public simulation MCP interface.

No agent should have privileged access to simulator internals.

### 8.2 Same seed and scenario pack

Comparison runs should use:

- same episode seed,
- same scenario pack,
- same environment version,
- same initial state,
- same incident generator settings.

### 8.3 Same observation schema

The LM-only baseline and SeNARS should receive the same observations.

If SeNARS receives richer symbolic observations, that difference should be explicit and measured, not hidden.

### 8.4 Same action schema

Both agents must choose from the same action space.

No SeNARS-only special actions unless they are available to all agents through the simulation MCP contract.

### 8.5 Same tool descriptions

Tool descriptions should be identical for all agents.

If SeNARS gets extra internal context, that is part of its architecture, but the external simulation tools should be described the same way.

### 8.6 Independent scoring

The simulation or evaluator should produce the scorecard.

SeNARS should not be the sole source of its own success metrics.

### 8.7 Budget transparency

Record relevant resource usage:

- LLM calls,
- tokens,
- tool calls,
- environment actions,
- invalid actions,
- episodes completed,
- safety violations,
- memory pressure events.

Do not claim efficiency unless measured.

---

## 9. Effect on CORE.21 plan

This should be incorporated directly into CORE.21.

The cleanest way is to amend the plan as follows.

---

# Updated CORE.21 sections

## 9.1 New principle

Add:

### 2.8 Simulations are external MCP components

Simulation environments are standalone MCP systems.

They are not embedded inside the SeNARS kernel.

SeNARS participates as an MCP client of the simulation, just like external baseline agents.

This ensures:

- fair comparison,
- clean isolation,
- reusable benchmarks,
- external agent compatibility,
- independent scoring,
- future expansion to Habitat/Ecosystem and Autonomous Space Probe simulations.

---

## 9.2 Updated demonstration environments

Replace the previous Habitat section with the following.

### Habitat MCP

Habitat is a standalone MCP simulation server.

It provides:

- seeded episodes,
- observable state,
- action submission,
- mission directives,
- incident generation,
- resource dynamics,
- scoring,
- episode logs.

Agents interact with Habitat only through its public MCP surface.

Habitat may be renamed Ecosystem later, but the MCP contract remains the same.

### Workshop

The Workshop remains a SeNARS-side capability loop.

However, when skills need to be tested against an environment, it should do so through the same simulation MCP surface.

This prevents Workshop skills from receiving privileged simulator access.

### Mirror

The Mirror consumes logs from:

- Habitat MCP,
- SeNARS event stream,
- baseline agent transcripts,
- evaluator reports.

It uses these logs for RLFP and comparative analysis.

### Autonomous Space Probe

The Probe is a future standalone MCP simulation server.

It should implement the same simulation MCP contract as Habitat.

It validates:

- delayed communication,
- strict energy budgets,
- intermittent connectivity,
- onboard autonomy,
- conservative planning,
- fault isolation,
- long-horizon skill use.

Because the simulation interface is MCP-based, Probe can be added without changing the core SeNARS agent contract.

---

## 9.3 Revised workstream W5

Expand W5 from:

> Stateless MCP and External Agent Interop

to:

> W5 — Stateless MCP, Simulation MCP Bus, and External Agent Interop

### Purpose

Make SeNARS interoperable with external agents and standalone simulation environments through the latest stateless MCP model.

### Additional tasks

1. Implement Habitat as a standalone MCP server.
2. Define a generic simulation MCP contract usable by future simulations.
3. Separate MCP roles:
   - agent,
   - observer,
   - evaluator,
   - admin.
4. Ensure the agent-facing simulation surface exposes no hidden state.
5. Ensure episode state is addressed by explicit IDs and cursors.
6. Ensure operations are idempotent where possible.
7. Ensure mutation operations include action IDs and idempotency keys.
8. Ensure the server does not require persistent MCP session state.
9. Provide an LM-only baseline client.
10. Provide a SeNARS simulation client.
11. Provide an orchestrator that can run seeded parallel episodes.
12. Ensure evaluator reports are generated from simulation logs.
13. Prepare the same contract for the future Autonomous Space Probe simulation.

### Acceptance

- Habitat runs as a standalone MCP server.
- LM-only client can complete seeded episodes.
- SeNARS client can complete the same seeded episodes.
- Both use the same public simulation MCP surface.
- No privileged SeNARS-only simulator endpoint is used during comparison runs.
- Evaluator reports are generated independently of agent self-reporting.
- The MCP surface works without requiring persistent client session state.

---

## 9.4 Add new demonstration D8

Add:

### D8 — Side-by-side LM-only versus SeNARS

Run two agents against equivalent Habitat episodes.

One agent is the LM-only baseline.

The other is the full SeNARS agent.

Both must use:

- same simulation MCP server contract,
- same seed,
- same scenario pack,
- same observation schema,
- same action schema,
- same scoring system.

The demonstration must show:

- live side-by-side episode view,
- action transcripts,
- environment outcomes,
- safety violations,
- resource usage,
- repair behavior,
- explanation/provenance for SeNARS,
- final scorecard from the evaluator.

The goal is not merely to show SeNARS rejecting an LM-only action.

The goal is to show that SeNARS achieves more robust, more grounded, more adaptive behavior in the same world.

---

## 9.5 Update scorecard

Add these metrics:

| Metric | Meaning |
|---|---|
| Baseline success delta | SeNARS success rate versus LM-only baseline |
| Safety violation delta | SeNARS safety violations versus LM-only baseline |
| Invalid action delta | Invalid or inadmissible actions per agent |
| Recovery capability | Ability to recover after incidents, measured in simulation ticks/episodes |
| Explanation completeness | SeNARS explanations mapped to provenance and simulation events |
| Cost-normalized performance | Performance relative to LLM calls/tool calls/action budget |
| Simulation independence | Scorecard generated from simulator/evaluator logs, not agent self-report |

---

## 9.6 Add halt-list rules

Add:

1. **No privileged SeNARS-only simulator access during baseline comparisons.**
2. **No agent access to hidden simulation state through the agent MCP role.**
3. **No simulation logic embedded inside the SeNARS kernel.**
4. **No comparison runs using different environment versions or scenario packs.**
5. **No MCP simulation design that requires persistent session state for basic operations.**

---

## 9.7 Update Definition of Done

Add:

1. Habitat exists as a standalone MCP simulation server.
2. An LM-only baseline client can run seeded Habitat episodes.
3. A SeNARS agent client can run the same seeded Habitat episodes.
4. Both clients use the same public simulation MCP contract.
5. A side-by-side comparison report can be generated.
6. The report is produced from simulation/evaluator logs.
7. No hidden privileged access is used by SeNARS during the comparison.
8. The architecture supports adding the Autonomous Space Probe simulation as another MCP server using the same contract.

---

# 10. Recommended implementation shape

A clean implementation shape would be:

## 10.1 `habitat-mcp`

Standalone simulation server.

Responsibilities:

- world state,
- seeded episode generation,
- incident generation,
- scoring,
- episode logs,
- agent-facing MCP tools/resources,
- observer/evaluator surfaces.

It should not depend on SeNARS internals.

## 10.2 `probe-mcp`

Future standalone simulation server.

Same contract as `habitat-mcp`, but different world dynamics:

- communication delay,
- energy constraints,
- autonomous fault response,
- long-horizon missions.

## 10.3 `lm-only-baseline`

Simple MCP client.

Responsibilities:

- connect to simulation MCP,
- maintain transcript,
- call LLM,
- choose actions,
- submit actions,
- log episode trace.

## 10.4 `senars-agent-client`

SeNARS-side agent runtime.

Responsibilities:

- connect to simulation MCP,
- translate observations into System 1/System 2 inputs,
- generate proposals,
- validate/repair through System 2,
- submit governed actions,
- record internal provenance,
- feed RLFP.

## 10.5 `arena-orchestrator`

Optional but highly useful.

Responsibilities:

- start seeded episodes,
- run parallel lanes,
- collect logs,
- generate side-by-side scorecards,
- launch dashboard views,
- export reproducible reports.

This could be CLI-first, with UI later.

---

# 11. Side-by-side demo flow

A strong demo would look like this:

1. Orchestrator starts two Habitat MCP episodes with the same seed.
2. Episode A is driven by the LM-only baseline.
3. Episode B is driven by SeNARS.
4. Both receive the same incident:
   - resource leak,
   - sensor contradiction,
   - tool failure,
   - or missing capability.
5. LM-only may act fluently but miss a constraint.
6. SeNARS may detect the constraint, repair the proposal, or synthesize a skill.
7. The simulation records outcomes independently.
8. The dashboard shows:
   - world state,
   - actions,
   - scores,
   - safety events,
   - transcripts,
   - SeNARS provenance.
9. The evaluator generates a comparison report.

This is much more convincing than a canned veto example.

It shows the system operating in the same world as the baseline, under the same rules.

---

# 12. Important nuance

The LM-only baseline should not be intentionally weak.

For credibility, it should be a competent LM agent.

If SeNARS only wins because the baseline is crippled, the demonstration is not valuable.

The stronger claim is:

> Given the same world, the same tools, and the same basic LLM capability, SeNARS produces more grounded, more reliable, more adaptive behavior because of neuro-symbolic synergy.

That is the demonstration worth building.

---

# 13. Final recommendation

Yes, implement the simulations as standalone MCP components.

Make Habitat the first standalone MCP simulation server.

Design the contract so that the future Autonomous Space Probe can be added without changing the agent architecture.

Use the latest stateless MCP model for the external surface.

Keep the simulation isolated from SeNARS internals.

Run LM-only and SeNARS side-by-side against the same seeded environment.

Score the comparison from the simulation/evaluator logs, not from agent self-reporting.

This makes CORE.21 stronger, fairer, more demoable, and more useful.
