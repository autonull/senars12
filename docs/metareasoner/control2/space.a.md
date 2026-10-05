# Reasoner Design Space (RDS)

A reasoner is a point in a product space of architectural dimensions. SeNARS is one point (and, via its profiles/presets/autonomy modes, a small reachable manifold).

## 0. Formal model

```
RDS  =  ∏ V_d        (d ∈ Θ, |Θ| = 12)
r    =  ⟨ ε, ρ, σ, ι, κ, ψ, β, λ, α, γ, φ, π ⟩   ∈ RDS
```

Each `V_d` is an ordinal scale 0…3 (higher = more capability/structure on that axis) plus categorical **facets** (§2). A *configuration* is a 12-vector; a *genome string* is its compact encoding (order `ερσΙ κψβλ αγφπ`).

Coherence is not free: not every point in the product space is a viable reasoner (§7).

---

## 1. Dimension catalog Θ

| # | Glyph | Axis | 0 | 1 | 2 | 3 |
|---|-------|------|---|---|---|---|
| ε | **episteme** | truth model | bivalent, monotonic | probabilistic (known model/priors) | many-valued / fuzzy | non-axiomatic evidential (f,c); revision; no assumed model |
| ρ | **resource** | resource assumption | ideal / logical omniscience | hard budget caps | anytime / interruptible | AIKR: forgetting, decay, backpressure first-class |
| σ | **substrate** | representation | propositional / FOL | term algebra + type theory | embedding / vector | hybrid: symbolic core + subsymbolic judgment layer |
| ι | **inference** | mechanism | deduction only | deduction + exact rewriting | + ampliative (induction/abduction) | full uncertain syllogistic + exact co-processor + sampling |
| κ | **control** | scheduling | fixed / exhaustive | heuristic search | priority / attention economy | event-driven, cooperative yield, multi-focus concurrency |
| ψ | **state** | persistence/provenance | ephemeral | snapshot | snapshot + log | event-sourced, replayable, standalone-verifiable |
| β | **belief** | belief dynamics | monotonic accumulation | AGM revision | revision + decay | paraconsistent retention + source-grounded confidence; truth⊥attention decay |
| λ | **learning** | adaptation | none | accumulative memory | parametric (RL / gradient) | strata: memory + RL + schema induction + governed self-mod |
| α | **architecture** | proposer topology | monolith | pipeline | hierarchical | many untrusted proposers + one trusted arbiter |
| γ | **governance** | trust/safety | none | logging/audit | gates/policy | epistemic firewall + autonomy ladder + HITL + sandbox + verifier |
| φ | **formalizer** | LM coupling | absent | LM as tool | LM as judge-gated proposer | LM as core controller |
| π | **praxis** | action/embodiment | contemplation | query/answer | tool use | embodied RL + goal planning + self-mod |

---

## 2. Facets (categorical sub-values)

Orthogonal to the ordinal scales; carried as set-valued tags.

| Dim | Facet | Example values |
|-----|-------|----------------|
| ε | paraconsistency | `{tolerant}` vs `{explosive}` |
| ε | world assumption | `{open}` vs `{closed}` |
| σ | languages | `Narsese`, `MeTTa/e-graph`, `Π/Σ types`, `384-d embeddings` |
| ι | rule provenance | `{builtin, data-loaded, learned}` |
| ι | exactness split | `{uncertain: NAL}` ⊕ `{exact: equality saturation}` |
| ψ | determinism | `{seeded, replayable}` |
| α | proposer kinds | `{LM, reflex, peer, remote-manifold}` |
| γ | firewall | `{belief ⊥ goal}` |
| φ | fallback | `{symbolic-path-always}` |
| π | autonomy | `observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production` |

---

## 3. SeNARS coordinate

| Dim | Value | Grounding |
|-----|-------|-----------|
| ε | 3 | NAL truth values (f,c); AIKR; paraconsistent (Bench 4) |
| ρ | 3 | AIKR: bounded bags, decay, backpressure, anytime |
| σ | 3 | Narsese + MeTTa e-graph + System-One embeddings |
| ι | 3 | 44 NAL rules + MeTTa equality saturation + bag sampling |
| κ | 3 | priority bags, cooperative yielding, multi-focus |
| ψ | 3 | append-only event log, replay, standalone verifier |
| β | 3 | source-quality grounding, decoupled decay, contradiction retention |
| λ | 3 | memory + reflex/RLFP + schema induction + governed self-mod |
| α | 3 | untrusted proposers → four kernel gates → trusted kernel |
| γ | 3 | epistemic firewall, autonomy ladder, HITL, WASI sandbox, verifier |
| φ | **2** | LM = untrusted System-1 proposer, never core; symbolic fallback |
| π | 3 | tools + RL embodiment + goal planning + self-mod |

**Genome:** `ε3 ρ3 σ3 ι3 κ3 ψ3 β3 λ3 α3 γ3 φ2 π3`

```
ε ████████████ 3     ψ ████████████ 3
ρ ████████████ 3     β ████████████ 3
σ ████████████ 3     λ ████████████ 3
ι ████████████ 3     α ████████████ 3
κ ████████████ 3     γ ████████████ 3
                     φ ████████░░░░ 2   ← deliberate; structurally capped
π ████████████ 3
```

`φ=2` is the signature: LM present but subordinate. `core:no-lm` red gate enforces `φ≤2` — SeNARS cannot move to `φ=3` by construction.

---

## 4. SeNARS as a reachable manifold (not a point)

Config surfaces move the point within a bounded subspace. Hard invariants fix the rest.

| Surface | Axes moved | Range |
|---------|-----------|-------|
| profiles (`device`/`arcade` t0 → `conversation`/`tool-use`/`research` t2) | σ, φ | σ∈{1..3}, φ∈{0..2} |
| presets (`FAST`/`LM_HEAVY`/`RESEARCH`) | φ, λ, ψ | φ≤2 |
| `enableRLFP` / `enableSelf` | λ | λ∈{1..3} |
| `persistState` | ψ | ψ∈{2..3} |
| `AutonomyMode` | γ sub-axis | 0..4 |
| `systemOne.enabled` | σ, φ | off ⇒ byte-identical path |

**Invariants (manifold boundary):** ε=ρ=ι=κ=β=α fixed at 3; γ≥2 always; **φ≤2** (firewall).

---

## 5. Comparison points

| System | ε ρ σ ι | κ ψ β λ | α γ φ π | Genome |
|--------|---------|---------|---------|--------|
| Coq / Lean / Isabelle | 0 0 1 0 | 0 1 0 0 | 0 3 0 0 | `ε0ρ0σ1ι0 κ0ψ1β0λ0 α0γ3φ0π0` |
| Cyc | 0 1 0 1 | 1 1 1 1 | 0 1 0 1 | `ε0ρ1σ0ι1 κ1ψ1β1λ1 α0γ1φ0π1` |
| Prob. prog / Bayes net | 1 1 2 2 | 1 1 1 0 | 0 1 0 1 | `ε1ρ1σ2ι2 κ1ψ1β1λ0 α0γ1φ0π1` |
| SOAR | 1 2 2 1 | 2 1 1 2 | 2 0 0 2 | `ε1ρ2σ2ι1 κ2ψ1β1λ2 α2γ0φ0π2` |
| ACT-R | 1 2 2 1 | 2 1 2 2 | 2 0 0 2 | `ε1ρ2σ2ι1 κ2ψ1β2λ2 α2γ0φ0π2` |
| NARS (pure) | 3 3 1 2 | 2 1 2 1 | 0 1 0 1 | `ε3ρ3σ1ι2 κ2ψ1β2λ1 α0γ1φ0π1` |
| ReAct LLM agent | ∅ 1 2 1 | 0 0 0 0 | 0 0 3 2 | `ε∅ρ1σ2ι1 κ0ψ0β0λ0 α0γ0φ3π2` |
| AlphaZero-class RL | ∅ 2 2 1 | 1 0 ∅ 2 | 0 0 0 3 | `ε∅ρ2σ2ι1 κ1ψ0β∅λ2 α0γ0φ0π3` |
| **SeNARS** | **3 3 3 3** | **3 3 3 3** | **3 3 2 3** | `ε3ρ3σ3ι3 κ3ψ3β3λ3 α3γ3φ2π3` |

`∅` = no explicit epistemic/belief layer.

---

## 6. Plane projections

**A. Epistemic–Resource plane** (classic "where does a reasoner assume knowledge & compute"):

```
 ρ ↑
 3 │                                   ○ NARS        ◆ SeNARS
 2 │                       ○ SOAR   ○ ACT-R
 1 │   ○ Cyc      ○ PPL          ○ ReAct
 0 │ ○ Coq/Lean
   └──────────────────────────────────────────────→ ε
     0 (axiomatic)     1          2         3 (non-axiomatic)
```

**B. Governance × LM-coupling plane** (SeNARS's distinctive region):

```
 φ ↑
 3 │ ○ ReAct / LLM-agent
 2 │                                        ◆ SeNARS
 1 │                         ○ ML-guided prover
 0 │                                  ○ Coq      ○ NARS
   └──────────────────────────────────────────────→ γ
     0 (none)        1          2          3 (firewall+verifier)
```

Reading: SeNARS is the only plotted point with **high governance AND an LM present** — resolved by holding `φ=2` (proposer, not core). LLM-agents push `φ→3` and `γ→0`.

---

## 7. Coherence constraints

**Entailments** (raising one axis forces another):

| Antecedent | ⟹ | Consequent |
|-----------|---|-----------|
| ρ ≥ 2 | ⟹ | κ ≥ 2 (scheduler/attention) + anytime |
| ε = 3 | ⟹ | ι ≥ 2 (ampliative rules) ∧ β ≥ 2 (revision) |
| α = 3 | ⟹ | γ ≥ 2 (proposers require arbiter/gates) |
| λ = 3 (self-mod) | ⟹ | γ = 3 (HITL + sandbox) |
| ψ = 3 | ⟹ | determinism + replay + verifier exist |
| β = 3 | ⟹ | ε = 3 |
| φ = 3 | ⟹ | γ ≤ 1 (empirical: LM-core erodes firewall) |

**Forbidden / degenerate:**

| Combination | Status |
|-------------|--------|
| ε=0 ∧ β=3 | incoherent (monotonic axioms + paraconsistent revision) |
| φ=3 ∧ γ=3 | unstable tension — SeNARS resolves via `φ:=2` |
| α=3 ∧ γ=0 | untrusted proposers, no gate = unsafe |
| ρ=0 ∧ λ=3 | unbounded + self-mod ill-defined |

---

## 8. Design-move operators

Navigating the space; each move = an axis delta with a SeNARS mechanism.

| Move | Δ | SeNARS mechanism |
|------|---|------------------|
| add truth values | ε,ι ↑ | `Truth{f,c}` algebra |
| add event sourcing | ψ ↑ | append-only `CognitiveEvent` log |
| add arbiter/gates | α,γ ↑ | four kernel gates |
| demote LM | φ ↓ | `core:no-lm` gate; symbolic fallback |
| add forgetting/decay | β,ρ ↑ | decoupled truth/attention decay, LRU eviction |
| add exact co-processor | ι ↑ (exact slice) | MeTTa e-graph via ActionGate |
| add RL | λ ↑ | Reflex / RLFP |
| add sandbox + HITL | γ ↑ | WASI `CapabilitySpace`, ApprovalService |
| separate belief/goal | γ ↑ | epistemic firewall (`CognitiveAxis`) |

---

## 9. Nearest-neighbor deltas

| vs | Δ axes | SeNARS adds |
|----|--------|-------------|
| NARS (pure) | α0→3, φ0→2, γ1→3, σ1→3, λ1→3 | proposer/arbiter, LM layer, firewall+verifier, embeddings, governed self-mod |
| SOAR | ε1→3, ψ1→3, γ0→3, λ2→3 | uncertain non-axiomatic truth, event-sourcing, governance, self-mod |
| ReAct LLM | ε∅→3, ρ1→3, β∅→3, ψ0→3, γ0→3, α0→3, φ3→2 | everything structural; **demotes** LM from core |
| Coq | ε0→3, ρ0→3, β0→3, ι⊕ampliative, π0→3, φ0→2 | keeps verifier/HITL philosophy, swaps closed-world proof for AIKR revision |

---

## 10. Classification tree (primary splits)

```
RDS
├─ ε: axiomatic (0)
│   ├─ ρ ideal → Coq, Lean
│   └─ ρ bounded → Cyc
├─ ε: probabilistic (1)
│   ├─ σ probabilistic-graph → PPL, Bayes nets
│   └─ σ cognitive (bounded) → SOAR, ACT-R
├─ ε: non-axiomatic (3)
│   ├─ α monolith → NARS (pure)
│   └─ α proposer/arbiter (3)
│       ├─ φ=3 → LLM-agent (γ collapses)
│       └─ φ≤2, γ=3 → ◆ SeNARS
└─ ε: ∅ (no epistemic layer)
    └─ π=3, λ=2 → AlphaZero-class RL
```

**Summary:** SeNARS = the point maximizing (ε,ρ,σ,ι,κ,ψ,β,λ,α,γ,π) while **clamping φ≤2** — i.e., a fully bounded, event-sourced, paraconsistent, neuro-symbolic proposer/arbiter reasoner whose defining boundary is a hardened epistemic firewall that keeps language models as judged proposers rather than the source of truth.
