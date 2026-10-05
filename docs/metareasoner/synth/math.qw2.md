# NOUS
## A Unified Algebra of Governed, Bounded Reasoning

*A self-contained specification*

---

## §0 · The Governing Selection

From the objective menu, this synthesis is steered by:

| Role | Selection | Rationale |
|---|---|---|
| **Prime Objectives** | **O1, O2, O3, O4, O8, O12** | Epistemic integrity, causal provenance, fluid control, resource economics, unified commit, formal rigor. |
| **Hard Constraints** | **H1–H10** (all) | These are not tradeable; they are the equational laws of the algebra. |
| **Anti-Goals** | **A2, A4, A5** | No opaque scheduling, no audit bloat, no monolithic language-model authority. |
| **Architectural Bias** | **D3** (unification) *first*, then **D1 ∧ D6** (auditability ∧ adaptivity held in tension by construction) | Elegance is the organizing principle; safety and adaptivity are reconciled *through* it, not balanced against it. |

**Resolving principle.** Wherever algebraic elegance and safety appear to conflict, the conflict is dissolved by relocating the guarantee: *freedom in the control plane is purchased with provenance in the audit plane.* This is the **Conservation of Guarantees** (§11.0).

---

## §1 · The Thesis

> **A reasoner is a resource-bounded, epistemically graded, governed coalgebra, equipped with an event-sourced provenance fold, whose every transition is a typed, priced, judged, and authorized *transaction* committed through a single ledger.**

All cognitive activity — perception, inference, proposal, judgment, learning, action, consolidation, forgetting, and self-modification — is one and the same kind of object: a **transaction**. The architecture is the collection of algebraic structures that *price*, *admit*, *commit*, *record*, and *govern* transactions. Nothing else is load-bearing.

This yields maximal unification (D3): one object, one control algebra, one commit surface, one governance vocabulary, one resource model. Special cases are recovered by *projecting* the algebra, never by adding ad-hoc machinery.

We denote the algebra by $\mathfrak{N}$ (**NOUS**).

---

## §2 · The Signature

$\mathfrak{N}$ is a many-sorted algebra. The carriers are:

| Sort | Symbol | Intuition |
|---|---|---|
| State | $M$ | the typed knowledge base (coalgebra carrier) |
| Content | $A$ | cognitive terms, **graded** by attitude |
| Truth | $V$ | evidence-sensitive valuation |
| Resource | $R$ | budget module / price semiring |
| Transaction | $\tau$ | the unified unit of cognition |
| Control | $\kappa$ | control words (Kleene algebra with tests) |
| Event | $E$ | append-only occurrences (free monoid) |
| Authority | $\mathcal{F}$ | governance filtration |

The coalgebra structure on $M$ is
$$\Phi : M \longrightarrow M \otimes E^{*},$$
a tick that advances state while emitting events. Every construction below is chosen so that $\Phi$ is **total** (cognition never halts on internal fault) and **bounded** (every path is finite).

The eight layers are:

$$\mathfrak{N} \;=\; \underbrace{V}_{\text{Truth}} \;\times\; \underbrace{\tau}_{\text{Transaction}} \;\times\; \underbrace{\kappa}_{\text{Control}} \;\times\; \underbrace{R}_{\text{Resource}} \;\times\; \underbrace{G}_{\text{Gate}} \;\times\; \underbrace{L}_{\text{Ledger}} \;\times\; \underbrace{E^{*}}_{\text{Provenance}} \;\times\; \underbrace{\mathcal{F}}_{\text{Governance}}.$$

---

## §3 · Layer I — The Truth Algebra $V$

### 3.1 Grading
Content $A$ is graded by **attitude**:
$$A \;=\; \bigsqcup_{\gamma \in \Gamma} A_{\gamma}, \qquad \Gamma = \{\,B\ (\text{belief}),\; G\ (\text{goal}),\; Q\ (\text{question}),\; H\ (\text{hypothesis}),\; P\ (\text{plan})\,\}.$$
The grade is carried through every boundary; it is a *type*, not a convention.

### 3.2 Valuation
Truth factors with the grading:
$$V \;=\; V_{\text{epistemic}} \times V_{\text{teleological}}.$$

- **Epistemic** (grade $B$): pairs $(f, c) \in [0,1]^2$ — frequency and confidence.
- **Teleological** (grade $G$): pairs $(d, c) \in [0,1]^2$ — desire and confidence.

### 3.3 Revision
Evidence combination is a **non-idempotent, commutative, non-associative** monoid $(V_B, \otimes, e)$ with prior $e = (\tfrac12, 0)$:
$$\mathrm{rev}\bigl((f_1,c_1),(f_2,c_2)\bigr) \;=\; \left(\frac{f_1 c_1(1-c_2) + f_2 c_2(1-c_1)}{c_1(1-c_2)+c_2(1-c_1)},\ \ c_1(1-c_2)+c_2(1-c_1)\right).$$
Confidence is **sub-additive** ($c_{\text{rev}} < c_1 + c_2$) and revision is gated by an **evidence-independence** predicate: dependent evidence is detected and not double-counted.

### 3.4 Paraconsistency
Contradictions **coexist** with distinct values: both $\varphi$ and $\neg\varphi$ may be resident, each graded. There is no *ex falso*. Contradiction is a *signal for inquiry*, not a trigger for trivialization.

### 3.5 The Epistemic Firewall (Law L1)
The grading is enforced at the level of **mutation authority**:
$$\boxed{\nexists\ \text{operation of type}\ \ \text{Reward} \to V_{\text{epistemic}}.}$$
Reward and desire may modulate *attention* and *policy* (grade-$G$ channels) but can never write a belief's frequency or confidence. This is a typing theorem, not a policy.

---

## §4 · Layer II — The Transaction $\tau$ (the unified carrier)

### 4.1 Definition
Every cognitive operation is a transaction:
$$\tau \;=\; \bigl\langle\, \iota,\ \chi,\ k,\ \vec{x},\ \vec{y},\ \epsilon,\ \beta,\ \theta,\ \rho,\ \varrho,\ \phi,\ \delta \,\bigr\rangle,$$

| Field | Symbol | Type | Meaning |
|---|---|---|---|
| identity | $\iota$ | $\mathrm{Id}$ | unique transaction id |
| **correlation** | $\chi$ | $\mathrm{CorrId}$ | causal thread back to the originating stimulus |
| kind | $k$ | $\mathrm{Kind}$ | one of $\{\textsf{perceive},\textsf{attend},\textsf{infer},\textsf{propose},\textsf{judge},\textsf{commit},\textsf{act},\textsf{learn},\textsf{consolidate},\textsf{forget},\textsf{simulate},\textsf{selfmod}\}$ |
| inputs | $\vec{x}$ | $A^{*}$ | read set |
| candidates | $\vec{y}$ | $A^{*}$ | proposed output (never yet state) |
| effects | $\epsilon$ | $\mathrm{Eff}$ | declared write/action set |
| budget | $\beta$ | $R$ | resource reservation |
| trust | $\theta$ | $[0,1]$ | calibrated source/proposal trust |
| risk | $\rho$ | $[0,1]$ | expected harm / irreversibility |
| reversibility | $\varrho$ | $\mathrm{Rev}$ | rollback class |
| proof obligations | $\phi$ | $\mathrm{Proof}^{*}$ | what must be discharged before commit |
| failure policy | $\delta$ | $\mathrm{Fail}$ | $\{\textsf{open},\textsf{closed},\textsf{abstain},\textsf{degrade}(f)\}$ |

### 4.2 Lifecycle
Every transaction traverses the **same** pipeline, regardless of kind:
$$\boxed{\ \mathsf{propose} \;\longrightarrow\; \mathsf{price} \;\longrightarrow\; \mathsf{judge} \;\longrightarrow\; \mathsf{authorize} \;\longrightarrow\; \mathsf{commit} \;\longrightarrow\; \mathsf{log}\ }$$
This is the single choke-point that makes the whole architecture governable (§8).

### 4.3 Provenance stamping (Law L3, anticipatory)
No transaction may mutate $M$ without first emitting an event; the correlation id $\chi$ is threaded through every field, so every committed belief is joinable to the stimulus, cycle, proposer, judge, proof, and budget that produced it.

---

## §5 · Layer III — The Control Algebra $\kappa$

### 5.1 Kleene Algebra with Tests
Control flow is **data**: an element of a Kleene Algebra with Tests generated by transactions and predicates:
$$\kappa \;::=\; \tau \ \mid\ b? \ \mid\ \kappa_1 \cdot \kappa_2 \ \mid\ \kappa_1 + \kappa_2 \ \mid\ \kappa^{*} \ \mid\ 0 \ \mid\ 1,$$
where $\cdot$ is sequence, $+$ is choice, $^{*}$ is guarded iteration, and $b?$ tests a predicate $b : M \to 2$.

The tick is the **action** of a control word:
$$\Phi_{\kappa} : M \to M \otimes E^{*}.$$

### 5.2 Declarative control (Objective O3, B1)
Stages are generators; sequencing, skipping, parallelism, and looping are algebraic:
- **Skip:** $(\mathsf{bound}?\cdot \tau \;+\; \neg\mathsf{bound}?\cdot 1)$ — run $\tau$ only if its precondition holds.
- **Parallel:** $\kappa_1 \,\|\, \kappa_2$ with a join gate at commit.
- **Loop-until-done:** $(\mathsf{due}?\cdot \mathsf{learn})^{*}$.

The **shape of cognition is a first-class, inspectable, replayable, governable value** — it can be proposed, edited, and authorized like any other transaction (§10, governed reflexivity).

### 5.3 Control as reasoning (Objective B2, D6)
The scheduler $\pi$ is itself a bounded reasoner over *control transactions*: it proposes which $\kappa$-fragment to run next, its proposals are judged and budgeted, and it **may not commit its own edits** (Law L7). Thus the controller can become learned and adaptive *without ever escaping the governance envelope*.

### 5.4 No opacity (Law L6 / Constraint H6)
Every scheduling decision — every choice of $+$ branch, every $^{*}$-exit, every preemption — is itself a logged transaction. **There is no unobserved control move.**

---

## §6 · Layer IV — The Resource Economy $R$

### 6.1 Budget module
Resource dimensions $\{d_1,\dots,d_k\}$ (cycles, derivations, memory-ops, model-calls, tokens, latency, risk, human-attention) form a basis; budgets are elements of the free module
$$R \;=\; \bigoplus_{i=1}^{k} \mathbb{N}\, d_i,$$
with a pointwise order $\leq$, a ceiling $\lceil\cdot\rceil$, and a **reservation/settlement** discipline:
$$\beta_{\text{avail}} \leftarrow \beta_{\text{avail}} - \beta_{\text{reserved}}, \qquad \beta_{\text{settled}} = \beta_{\text{reserved}} - \beta_{\text{unused}}.$$
Reservation precedes execution (no silent starvation); settlement refunds the unused.

### 6.2 Pricing and the scheduler (Objective O4, B5)
Each enabled transaction is assigned a **marginal utility per unit cost**:
$$\mathrm{score}(\tau) \;=\; \frac{\widehat{\Delta K} + \widehat{\Delta G} + \widehat{\Delta H}}{\lambda_c\,\widehat{C} + \lambda_r\,\widehat{\rho} + \lambda_h\,\widehat{H}_{\text{human}}},$$
where $\widehat{\Delta K}, \widehat{\Delta G}, \widehat{\Delta H}$ are expected epistemic, teleological, and homeostatic gain, and $\widehat{C}, \widehat{\rho}$ are expected cost and risk. The scheduler selects by descending score subject to budget feasibility. Scarcity is handled by **graceful re-allocation**, not truncation.

### 6.3 Thermodynamic limit (continuous form)
The discrete economy has a continuous limit governed by a cognitive temperature $T$:
$$\Pr(\text{pursue } \tau) \;\propto\; \exp\!\bigl(-\Delta E(\tau)/T\bigr),$$
where $\Delta E$ is an activation energy (prediction error $\times$ inverse utility). High $T$ explores; low $T$ exploits. The hard budgets of §6.1 are recovered as the $T\to 0$ / bounded-energy projection, so **AIKR bounding is preserved in both regimes**.

### 6.4 Boundedness (Law L4 / Constraint H5)
Every path is finite in every dimension: there is a global, natural **abort** that commutes with every stage, and every container is bounded with a declared forgetting policy. *No reasoning path is unbounded.*

---

## §7 · Layer V — The Gate Lattice $G$

### 7.1 Oriented gates
A gate is a partial morphism $g : \mathrm{Candidate} \rightharpoonup \mathrm{Admitted} \cup \mathrm{Refused}$. Gates form a bounded lattice $(G, \wedge, \vee, \top, \bot)$, where $\wedge$ is conjunctive admission and $\vee$ is disjunctive. Each gate carries an **orientation**:
$$\alpha : G \to \{\textsf{interior},\ \textsf{closure}\},$$
- **interior** (contractive, $g(x) \leq x$) = **fail-closed**,
- **closure** (extensive, $x \leq g(x)$) = **fail-open**.

Orientation is a *typed field*, not a code branch. Admission gates may compose serially ($g_1 \circ g_2$), in parallel, by weighted vote, or by fallback ($g_1 \triangleright g_2$).

### 7.2 Boundary polarity
Untrusted ingress is **interior** (fail-closed); internal cognition and derived egress are **closure** (fail-open), because *a bounded reasoner must not halt on its own internal fault*. The asymmetry is a single algebraic parameter.

### 7.3 The firewall as a closed ideal
The epistemic firewall (§3.5) is a **closed ideal** $I \trianglelefteq G$: any transaction whose effect set crosses a forbidden grade boundary is annihilated by every gate in $I$.

### 7.4 Judgment before commit (Law L5 / Constraint H2)
Every transaction from an **untrusted** proposer (neural, linguistic, reflex, peer) must pass a calibrated judge before admission. Unjudged untrusted content may enter only under an explicit **provisional** grade, which marks it as non-authoritative and routes it to judgment before it can influence committed belief.

### 7.5 No silent failure (Law L9 / Constraint H9)
A fault is never absorbed without producing a typed event: every $\delta = \textsf{degrade}$, $\textsf{abstain}$, or fallback is logged and thereby auditable.

---

## §8 · Layer VI — The Commit Ledger $L$ (single commit authority)

### 8.1 The ledger
All durable mutation flows through **one** ordered, typed, append-only ledger:
$$L \;=\; \bigl(\,\mathrm{Commit}^{*},\ \cdot,\ \epsilon\,\bigr).$$
State is the **fold** of the ledger:
$$M \;=\; \mathrm{fold}\bigl(\,\mathsf{apply}\,\bigr)(L).$$

### 8.2 Single commit authority (Law L2 / Constraint A2-principle)
$$\boxed{\ \exists!\ \mathsf{commit} : \mathrm{Judged} \to M.\ }$$
There is exactly one write surface. Perception, inference, learning, action, and self-modification are all *proposals to the same ledger*; the ledger is the only thing that changes $M$.

### 8.3 The commit gate
Each candidate is normalized, type-checked, evidence-independence-checked, judged/proof-checked, ranked, budget-settled, risk-classified, and then committed or rejected:
$$\mathsf{commit} \;=\; \mathsf{normalize} \;\triangleright\; \mathsf{typecheck} \;\triangleright\; \mathsf{evid} \;\triangleright\; \mathsf{judge} \;\triangleright\; \mathsf{rank} \;\triangleright\; \mathsf{settle} \;\triangleright\; \mathsf{risk} \;\triangleright\; \{\mathsf{accept},\mathsf{reject}\}.$$

### 8.4 Context-sensitive governance (Objective B6)
The commit path is chosen on the **policy surface** $(\theta, \rho, \varrho, \phi)$:

| Trust $\theta$ | Risk $\rho$ | Reversibility $\varrho$ | Path |
|---|---|---|---|
| high | low | high | auto-commit |
| high | medium | high | shadow-commit, then promote |
| medium | low | high | provisional commit with decay |
| medium | medium | medium | review |
| any | high | low | require discharged proof or external authorization |
| low | high | low | reject |

### 8.5 Irreversibility (Law L10 / Constraint H10)
Transactions with $\varrho = \textsf{irreversible}$ must pass risk classification and explicit authorization; they are never auto-committed.

---

## §9 · Layer VII — The Provenance Fold $E^{*}$

### 9.1 Event sourcing
Events form a free monoid $(E^{*}, \cdot, \epsilon)$. The ledger and all control decisions are projected into $E^{*}$; the append-only log **is** the source of truth, and snapshots are caches.

### 9.2 Correlation as a functor (Objective O2, C2)
The correlation id $\chi$ makes events a **functor from stimuli**: for every stimulus $s$ there is a natural family of events $\{e\}_{\chi}$. This makes the following well-formed queries:
- *Which stimulus caused this belief?*
- *Which proposer suggested it, which judge admitted it, which proof secured it, which budget enabled it?*
- *Which control decision selected this path?*

### 9.3 Replay fidelity (Law L3 / Constraint H3, B5)
$$\boxed{\ \mathsf{replay} \circ \mathsf{log} \;\cong\; \mathrm{id}\ \ \text{on reachable states}.\ }$$
Deterministic reducers reconstruct $M$ from $E^{*}$, verified by a state hash. **Admit-before-write**: no state change exists without a preceding event.

### 9.4 Independent verification (Constraint H7)
Derivations are re-checked by a **standalone verifier** that shares no code with the engine: the truth table is transcribed, and engine–verifier drift is *measured and pinned*, never assumed zero.

---

## §10 · Layer VIII — The Governance Filtration $\mathcal{F}$

### 10.1 The tower
Self-modification authority is a **filtration**
$$\mathcal{F}_0 \ \subset\ \mathcal{F}_1 \ \subset\ \cdots\ \subset\ \mathcal{F}_n,$$
where higher index grants authority over a larger fragment of $\mathfrak{N}$:
$$\mathcal{F}_0:\ \text{nothing} \;\mid\; \mathcal{F}_1:\ \text{parameters} \;\mid\; \mathcal{F}_2:\ \text{strategies} \;\mid\; \mathcal{F}_3:\ \text{rules} \;\mid\; \mathcal{F}_4:\ \text{control graph } \kappa \;\mid\; \mathcal{F}_5:\ \text{constitution}.$$

### 10.2 No self-approval (Law L7 / Constraint H4)
A modification at level $\mathcal{F}_k$ requires authorization at level $\mathcal{F}_{j}$ with $j > k$, and the topmost level requires an **external, immutable** arbiter the system cannot edit:
$$\boxed{\ \text{self-mod at } \mathcal{F}_k \;\Rightarrow\; \text{approval by } \mathcal{F}_{>k}\ \ \text{(external at the apex).}\ }$$
This is the formal content of *no Löbian self-approval*.

### 10.3 Governed adaptation (Objective C1, O6)
Learning — parameter, strategy, rule, control-graph, or code — produces **proposals**, never direct writes. Each proposal is shadow-executed, validated, risk-classified, and routed up the ladder. Truth values $V$ sit **outside** the tower entirely: they are never a self-modification target.

### 10.4 Substrate isolation (Law L8 / Constraint H8)
Exact substrates (equality saturation / e-graphs) and uncertain substrates (graded similarity) are kept in **disjoint memory**; an exact structure may never identify two nodes on an uncertain score. Cross-substrate traffic is by proposal through an arbiter, never by shared state.

---

## §11 · The Equational Theory

The valid designs are the models of these ten laws.

### §11.0 · Conservation of Guarantees (meta-law)
> Guarantees cannot be created or destroyed, only **relocated**. Spending freedom in the control plane costs auditability *unless* re-spent on provenance; removing a gate costs safety *unless* re-spent on calibrated judgment.

This is what permits a fluid, adaptive control plane to coexist with maximal auditability: the guarantees are moved into $E^{*}$ and $G$, not dropped.

### The Laws

| # | Law | Form | Constraint |
|---|---|---|---|
| **L1** | Epistemic firewall | $\nexists\ \text{Reward} \to V_{\text{epistemic}}$ | H1 |
| **L2** | Single commit authority | $\exists!\ \mathsf{commit} : \mathrm{Judged} \to M$ | A2 |
| **L3** | Provenance fidelity | $\mathsf{replay}\circ\mathsf{log} \cong \mathrm{id}$; admit-before-write | H3 |
| **L4** | Boundedness / anytime | every path finite; natural abort commutes with all stages | H5 |
| **L5** | Judgment before commit | untrusted $\Rightarrow$ judged $\lor$ provisionally typed | H2 |
| **L6** | No opaque control | every scheduling decision is a logged transaction | H6 |
| **L7** | No self-approval | self-mod at $\mathcal{F}_k$ approved by $\mathcal{F}_{>k}$ (external at apex) | H4 |
| **L8** | Substrate isolation | exact $\not\!\cup$ uncertain | H8 |
| **L9** | No silent failure | every fault $\to$ typed event | H9 |
| **L10** | Irreversibility gating | $\varrho{=}\textsf{irreversible} \Rightarrow$ risk-classified $\land$ authorized | H10 |

---

## §12 · The Feasibility Predicate $\Phi$

The naive product of all layer-values is too large; $\Phi$ carves the **coherent region** $\mathfrak{N}^{+} \subseteq \mathfrak{N}$. A design is a point $r$ with $\Phi(r) = \top$.

| # | Implication | Meaning |
|---|---|---|
| $\Phi_1$ | ampliative inference $\Rightarrow$ graded or paraconsistent truth | binary monotonic truth cannot support induction/abduction |
| $\Phi_2$ | self-mod $\neq$ none $\Rightarrow$ provenance $\geq$ step-audit | you cannot govern what you cannot observe |
| $\Phi_3$ | code self-mod $\Rightarrow$ shadow validation $\land$ event-sourced state | containment of the strongest adaptation |
| $\Phi_4$ | untrusted proposers $\Rightarrow$ judge gates | else laundering |
| $\Phi_5$ | any learning touching policy $\Rightarrow$ epistemic firewall | else reward-hack |
| $\Phi_6$ | AIKR $\Rightarrow$ budget $\land$ anytime $\land$ forgetting | boundedness decomposes |
| $\Phi_7$ | paraconsistency $\Rightarrow$ graded truth | contradictions must be valued to be retained |
| $\Phi_8$ | replay $\Rightarrow$ append-only substrate $\land$ pure reducers | determinism requires it |
| $\Phi_9$ | attention economy $\Rightarrow$ decay | an economy needs forgetting |
| $\Phi_{10}$ | independent verifier $\Rightarrow$ code-disjoint from engine | co-adaptation hides bugs |
| $\Phi_{11}$ | anytime $\Rightarrow$ preemptive scheduler | FIFO cannot preempt |
| $\Phi_{12}$ | standalone step-verifier $\Rightarrow$ step proofs exist | a verifier needs something to check |

**Design is now a path-finding problem:** *improve the reasoner* = *choose a path through $\mathfrak{N}^{+}$*; *safety* = *the path never violates $\Phi$*.

---

## §13 · The Composition Theorem

$\mathfrak{N}$ is assembled as a **fiber product** of the eight layers; the factors are not independent but must be mutually compatible:

$$\mathfrak{N} \;=\; V \times_{\tau} \kappa \times_{\kappa} R \times_{R} G \times_{G} L \times_{L} E^{*} \times_{E^{*}} \mathcal{F}.$$

**Theorem (Compositionality).** For configurations $c_1, c_2$ and semantic function $\llbracket\cdot\rrbracket : \mathfrak{N} \to \mathrm{Coalgebra}$:
$$\llbracket c_1 \otimes c_2 \rrbracket = \llbracket c_1 \rrbracket \circ \llbracket c_2 \rrbracket, \qquad \llbracket c_1 \oplus c_2 \rrbracket = \llbracket c_1 \rrbracket \times \llbracket c_2 \rrbracket, \qquad \llbracket c \mid P \rrbracket = \llbracket c \rrbracket \mid P.$$

**Corollary (Closure).** Any algebraic operation on a valid design — composition $\otimes$, parallel $\oplus$, restriction $\mid P$, refinement $\sqsubseteq$, lifting — yields another valid design *provided* the result still satisfies $\Phi$. New reasoners are **evaluations of algebraic expressions**, not new codebases.

---

## §14 · The Minimal Kernel and Extension Operators

### 14.1 The load-bearing core
Strip $\mathfrak{N}$ to its generators. Exactly five things cannot be removed:

1. **A substrate** $(A, \vdash, \otimes)$ — something to reason with and a truth algebra (§3).
2. **A control word** $\kappa$ — something to sequence the reasoning (§5).
3. **A gate** $g$ — a boundary between outside and state (§7).
4. **A budget** $\beta$ — the fact that cognition is finite (§6).
5. **A provenance fold** $(\log/\mathsf{replay})$ — the auditability that makes the rest trustworthy (§9).

Everything else — drives, proposers, thermodynamics, learned scheduling, the full tower — is an **enrichment**: a coordinate dialable from "absent" to "present" without leaving $\mathfrak{N}^{+}$.

### 14.2 Extension operators
Richness is added by structure-preserving maps, never by special cases:

| Operator | Effect |
|---|---|
| $\mathsf{compose}(c_1, c_2)$ | merge two configurations |
| $\mathsf{restrict}(c, P)$ | degrade by projection (graceful capability loss) |
| $\mathsf{refine}(c, \Phi')$ | impose extra invariants |
| $\mathsf{lift}(c, f)$ | apply a functor $f$ uniformly (e.g. parallelize every serial stage) |
| $\alpha(c)$ | quotient to behavioral equivalence class |

**Graceful degradation (Objective C3)** is simply $\mathsf{restrict}$: when judgment, compute, memory, or models are unavailable, the system projects to a known, declared weaker point rather than producing undefined behavior.

---

## §15 · Instantiation Grammar

A concrete design is a literal in the following grammar; reading any system reduces to filling the slots and checking $\Phi$.

```text
Reasoner ::= {
  Truth       : { grading, calculus, revision, consistency }      # §3
  Transaction : { kinds, fields, lifecycle }                       # §4
  Control     : { generators, tests, scheduler }                  # §5
  Resource    : { dimensions, reservation, pricing, limit }        # §6
  Gate        : { lattice, orientation, judgment }                # §7
  Ledger      : { commit, policy-surface, irreversibility }       # §8
  Provenance  : { correlation, replay, verifier }                  # §9
  Governance  : { filtration, approval, substrate-isolation }      # §10
}
```

The **target point** — the design this specification realizes — is:

$$\boxed{\ \mathfrak{N}^{*} \;=\; \bigl\langle\ \underbrace{\text{graded, paraconsistent}}_{V},\ \underbrace{\text{unified}}_{\tau},\ \underbrace{\text{declarative KAT}}_{\kappa},\ \underbrace{\text{economic + thermodynamic}}_{R},\ \underbrace{\text{oriented lattice}}_{G},\ \underbrace{\text{single ledger}}_{L},\ \underbrace{\text{correlated, replayable, verified}}_{E^{*}},\ \underbrace{\text{externally-capped filtration}}_{\mathcal{F}}\ \bigr\rangle\ }$$

---

## §16 · Why This Is the Synthesis

- **Unification (D3).** One object ($\tau$), one control algebra ($\kappa$), one commit surface ($L$), one resource model ($R$), one governance vocabulary ($\mathcal{F}$), one provenance ($E^{*}$). Every apparent special case is a projection.
- **Elegance.** The architecture is an *equational theory* plus a *feasibility predicate*: building a new reasoner is evaluating an expression; improving one is walking a path in $\mathfrak{N}^{+}$; safety is staying inside $\Phi$.
- **Power without opacity (B2, O4, anti-goal A2).** The scheduler may be learned and economic, but Law L6 and the correlation functor make every control move replayable — adaptivity is *paid for* in provenance, per §11.0.
- **Safety as structure, not policy.** The epistemic firewall, single-commit authority, no-self-approval, substrate isolation, and irreversibility gating are **laws and types**, not reviews.
- **Bounded by construction (A4).** AIKR is an axiom; budgets, forgetting, and anytime interruption are first-class, present in both the discrete and thermodynamic resource regimes.

$\mathfrak{N}$ is therefore not a larger system but a **smaller set of principles** from which the desired system — and every safe variation of it — follows by algebra.

---

*End of specification.*
