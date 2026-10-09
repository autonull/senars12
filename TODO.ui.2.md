# TODO.ui.2.md — The Reasoning-OS UI (course correction)

> **Relationship to `TODO.ui.md`.** This document supersedes the *product framing and phase ordering*
> of `TODO.ui.md`. It does **not** discard its work: the SSOT registries, the reactive core, the
> `ViewSpec`/adapter system, the protocol/contract, the event bridge + catalogs, the tokens, the
> scenario catalog, and the `/test/*` harness are the **existing baseline** this plan builds on.
> `TODO.ui.md` remains the record of what landed (its progress log) and the source of the still-valid
> backlog items referenced below.
>
> **Why a v2.** The previous plan front-loaded invisible infrastructure and deferred the product.
> Every session's success criterion was "baselines unchanged," which entrenched a mediocre look, and
> pixel baselines were the wrong gate for an exploration UI. The result had little substance or
> usability. This plan re-centers on the actual product and demotes determinism/pixel/3D.

---

## 0. What we are building

A **universal interaction substrate for a reasoning/language agent**: a surface that can *converse,
visualize, steer, author, inspect, and self-demonstrate* — over one or more reasoning engines and one
or more language models, where **natural language is the universal input** and **rendered artifacts
are the universal output**, and where the **agent itself can drive the UI**.

The long-horizon target is a **Reasoning Operating System UI**: the control and observation surface
for reasoning processes, general-purpose across application domains (not NARS-specific), capable of
high-frequency human-in-the-loop use, and of driving its own demonstrations.

### 0.1 Independently toggleable capabilities (none is privileged)

The UI is a **composition of capabilities**, each of which can be on or off. No capability is
"special": the same shell yields different products by composition.

| Capability | Provides | When off |
|---|---|---|
| `language` | Conversational LM agent: NL I/O, artifacts, tool use | No NL surface; purely symbolic |
| `reasoning` | One or more reasoning backends (NARS, MeTTa, …) | **Generic LM-agent UI** (NL only) |
| `uiControl` | Agent drives the UI (open/explain/scrub/narrate/present) via tools; **default off** | UI cannot be driven by the agent |
| `tools` | External actions (search, code, egress) invoked by an agent | No external actions |
| `memory` | Persistence: sessions, episodes, knowledge stores | Ephemeral |

Canonical compositions:

- `language` only → **generic Language-Model agent UI**.
- `reasoning` only → **symbolic reasoning workbench** (derivations, truth, agenda; no chat).
- `language` + `reasoning` → **reasoned agent** (today's SeNARS + LM).
- `+ uiControl` → **self-demonstrating / agent-operable**.
- `+ tools` → **agentic tool use**.

Visualization/inspection is the **substrate**, always present; it is how every capability's state and
output becomes legible.

### 0.2 Non-goals (explicit)

- **Not** a bespoke UI per application or domain — domains arrive as data (descriptors/adapters).
- **Not** a fixed spec of a finite feature set — the surface is open-ended; the **contracts** are not.
- **Not** a single-engine tool — NARS is the *first* backend, not the definition.
- **Not** byte-deterministic or pixel-gated — narrative reproducibility, not byte reproducibility.
- **Not** 3D-first — SpaceGraph/3D is deferred until 2D cognition is fully realized.

---

## 1. Principles (the spine)

An open-ended surface stays coherent only with a small, opinionated core. These are non-negotiable.

1. **Capabilities compose; none is privileged.** The shell renders zones per active capability; the
   center of gravity adapts (chat when `language`, derivation surface when `reasoning`).
2. **Everything is a view over a source.** Sources and view adapters are pluggable registries.
   Graph, chart, table, tree, text, math, code, diagram, image, and interactive widgets are all
   adapters; unknown kinds degrade to text.
3. **One engine-agnostic semantic substrate.** Terms/expressions, statements+uncertainty,
   rules/derivations, goals/agenda, processes, time, provenance/cost. Engines map into it; their
   vocabulary (NAL truth, proof terms, substitutions) is **declared by the backend adapter** and
   rendered through the field/event catalogs.
4. **Artifacts are first-class output.** The agent emits self-describing artifacts/view specs; the UI
   renders them. Communication is not text-only.
5. **The agent can drive the UI — as tools.** UI control is exposed as a toolset (`ui.*`) callable by
   an LM (function calling) or by SeNARS (skill/tool execution), **gated behind UI Control Mode**
   (default `false`) so it never interferes with the user's application by default.
6. **Explanation is contextual and modeless.** Derivations, provenance, uncertainty, and history open
   as **popovers / expanded sections anchored to the object** they concern — never as standing panels.
   Progressive disclosure is a property, not a place.
7. **Time is bidirectional and present-anchored.** Live, scrub-back, and look-ahead (goals/plans/
   simulations) are one control with different signs.
8. **Latency and interruptibility are product features.** Streaming, keyboard-first, honest
   cancellation — principles from day one even when the deep work lands later.
9. **Real over fake.** Real LMs (local **and** frontier) with dynamic routing; fixtures are a
   fallback for offline/CI, never the product.
10. **Accessibility and keyboard-first** are definition-of-done; the command palette is the spine of
    power use.

---

## 2. Contracts (the spine — build these first)

### 2.1 `ReasoningBackend`

The engine-agnostic interface. NARS is adapter #1; MeTTa is adapter #2 (to prove generality).
Prolog/LEAN are later.

```ts
interface ReasoningBackend {
  readonly id: string;                 // 'nars' | 'metta' | ...
  readonly kind: string;
  capabilities(): BackendCaps;         // what it can answer/do/stream
  vocab(): VocabularyDescriptor;       // node/edge kinds, truth/uncertainty semantics, labels
  submit(input: BackendInput): Promise<Ref>;   // observation | query | goal | command
  step?(n?: number): Promise<void>;
  run?(): void; pause?(): void; resume?(): void;
  subscribe(fn: (e: BackendEvent) => void): Unsubscribe;
  snapshot(): SubstrateSnapshot;
  provenance(ref: Ref): DerivationRecord | undefined;
  explain?(ref: Ref): Explanation;
}
```

### 2.2 The semantic substrate

```ts
type Ref = string;
type Node = { id: Ref; kind: string; label: string; attrs: Record<string, unknown>; uncertainty?: Uncertainty };
type Edge = { id: Ref; source: Ref; target: Ref; kind: string; attrs: Record<string, unknown>; uncertainty?: Uncertainty };
type Derivation = { id: Ref; rule: string; premises: Ref[]; conclusion: Ref; truthFn?: string; cost?: Cost };
type Goal = { id: Ref; description: string; urgency: number; status: string };
type Process = { id: Ref; backend: string; status: string; resources: Cost };
```

`uncertainty` is engine-declared (NAL `{frequency, confidence}`, probability, proof-checked, …); its
rendering is data (field catalog), not hard-coded.

### 2.3 `ViewSpec` / `Source` / artifacts (open registry)

- The existing `Source`/`ViewSpec`/adapter registry generalizes: shapes become an **open registry**,
  not a fixed union. Core adapters ship; apps/agents register more.
- An **artifact** is a self-describing payload the agent emits: `{ kind, spec?, data }`. Known kinds
  render richly (math, chart, diagram, image, HTML/widget sandbox); unknown kinds render as text/JSON.
- The agent **emits view specs** as output; the host renders them with the shared chrome/selection.

### 2.4 `LmProvider` + routing

- Providers: local (`webllm`, `llamacpp-embedded`, `llamacpp`, `transformers`) and frontier
  (`anthropic`, `openai`, `openai-compatible`).
- Per-provider parameters surfaced and editable; `lm.status` / `lm.switch` are real.
- A **routing policy** selects a provider/model by task, cost, availability, health — observable, and
  eventually chosen by the system for its own needs.

### 2.5 `ui.command` + UI-control tools

Server→client commands, and a toolset the agent can call. **Gated behind UI Control Mode.**

```ts
type UiCommand =
  | { type: 'ui.openView'; view: ViewRef }
  | { type: 'ui.focus'; ref: Ref }
  | { type: 'ui.explain'; ref: Ref }          // opens the contextual popover
  | { type: 'ui.filter' | 'ui.highlight'; refs: Ref[] }
  | { type: 'ui.scrubTime'; t: number }
  | { type: 'ui.presentArtifact'; artifact: Artifact }
  | { type: 'ui.narrate'; text: string }
  | { type: 'ui.setCapability'; id: string; enabled: boolean };
```

This single channel is simultaneously the **self-demonstration** system, the **self-explanation**
system, and the **agent-operable interface**.

---

## 3. The core loop (Phase 1 wedge)

> **Ask anything → watch it reason and act → inspect the *why* in place → steer/author → tell it to
> show you again.**

Concretely:

1. **Input** any NL request (and/or Narsese/structured input).
2. **React** — a streaming answer/artifact, plus the reasoning reaction (derivations, uncertainty,
   cost) when `reasoning` is on.
3. **Inspect** — click any claim, node, edge, or artifact to open a **contextual explanation popover**
   (derivation chain, truth history, competing beliefs, cost).
4. **Steer/author** — retract a belief, add a goal, adjust a budget/provider; see the reaction live.
5. **Demonstrate** — "show me how you got that"; the agent drives the UI to replay and narrate the
   explanation (requires UI Control Mode).

Acceptance is **behavioral**, not pixel: the loop completes end-to-end against a real LM + a real
backend, headless-drivable, and the explanation equals the backend's `DerivationRecord`.

---

## 4. Progressive disclosure & contextual explanation

- **No always-on explanation panels.** Explanation is an affordance on an object: popover/expandable
  section anchored to the term/claim/edge/artifact/process it refers to.
- Disclosure levels (`summary · card · detail · raw`) are **data on the descriptor**; a surface
  renders the active level. Embedded defaults to `card`; the popover opens at `detail`; `raw` is one
  action away.
- Panels are user-pinned or contextual — never mandatory. The default screen is the **working
  surface** (conversation + active view), not a wall of diagnostics.

---

## 5. Self-model & self-demonstration

- **Self-model as views**: health, attention, agenda, resources, uncertainty, capability status —
  each a `ViewSpec` over a source (some backend-provided, some client-derived). The system reporting
  and explaining *itself* is the same machinery as reporting anything else.
- **Self-demonstration**: demos are the agent commanding the live UI through `ui.command` tools —
  open views, focus objects, present artifacts, narrate, scrub time. No separate player, no fake
  animation.
- **Narrative over reproducibility**: an episode is a teachable story with real state; screen-
  recordable for teaching/marketing. Byte-reproducibility is not required.

---

## 6. Generality path

- **Backend #2 = MeTTa** to force the substrate to be engine-agnostic (cheapest, already referenced).
- **NL-only mode** is the substrate with `reasoning` off: a generic LM-agent UI.
- **Rich output** (math, tables, charts, diagrams, code, images, widgets) is just more adapters; the
  agent can emit any of them as an artifact.
- **Plugin/descriptor API**: minimal now, evolve rather than perfect up front. A new surface = a
  descriptor + `renderBody`; a new domain = data + an adapter; a new engine = a backend adapter.

---

## 7. Platform & UX

- **IA from capabilities**: zones/panels derive from the active capability set; the center adapts.
- **Command palette** (⌘K) indexes registries reflectively: capabilities, views, backends, providers,
  artifacts, terms, scenarios, actions.
- **Keyboard-first, streaming, interruptible**; honest cancellation. Latency budgets tracked.
- **Provider UX**: current provider/model, per-provider params, mid-session switch, routing rationale.
- **Time control**: present-anchored scrub with live / past / prospective modes.
- **Accessibility**: named, keyboard-operable controls; canvas text alternatives via the view
  adapters; announce state changes.

---

## 8. Validation

- **Behavioral/state assertions are the gate** — does it do the thing, with the right content.
- **A few curated "design intent" shots** for human review — not a 1:1 pixel gate.
- **Task-success checks** on the canonical loop.
- **Screen-recorded demos** as acceptance artifacts.
- **Pixel baselines and 3D are deferred**; the existing visual harness is kept but demoted to a
  design-regression net to be re-expanded only once the design stabilizes.

---

## 9. Delivery phases

Each phase is small, verifiable, and leaves the app working. Task IDs are stable handles.

### Phase 0 — Contracts
**Goal:** the spine exists before any surface depends on it.
- [ ] **0.1** `ReasoningBackend` + semantic substrate types; adapt the existing NARS server projection to it (behavior-preserving).
- [ ] **0.2** Open `ViewSpec`/adapter registry + `Artifact` contract; migrate existing adapters.
- [ ] **0.3** `ui.command` schema + client dispatcher; **UI Control Mode** flag (default off).
- [ ] **0.4** `LmProvider` façade + real `lm.status`/`lm.switch`; provider params.
- [ ] **0.5** Capability registry + toggle wiring (language/reasoning/uiControl/tools/memory).
**Deliverable:** nothing visible changes; everything is pluggable.

### Phase 1 — The core loop (wedge)
**Goal:** input → reaction → inspect → steer → demonstrate, end-to-end, real LM.
- [ ] **1.1** Unified input surface (NL now; Narsese/structured seam).
- [ ] **1.2** Streamed answer + artifacts; reasoning reaction surfaced when `reasoning` on.
- [ ] **1.3** Contextual explanation popover anchored to any object (derivation/truth/competing).
- [ ] **1.4** Steer/author: retract belief, add goal, adjust budget/provider — live reaction.
- [ ] **1.5** "Demonstrate that": agent drives the UI and narrates (UI Control Mode).
- [ ] **1.6** Behavioral E2E of the whole loop; headless-drivable.
**Deliverable:** the app does something real and shows its work.

### Phase 2 — Capability composition & IA
**Goal:** the shell adapts to enabled capabilities; nothing is privileged.
- [ ] **2.1** Capability-driven shell/zones; LM-only and reasoning-only identities.
- [ ] **2.2** Command palette indexing registries reflectively.
- [ ] **2.3** Progressive-disclosure levels as data across surfaces.
- [ ] **2.4** Provider/routing UX; latency/keyboard pass.
**Deliverable:** one shell, several products; usable without a manual.

### Phase 3 — Generality
**Goal:** prove the substrate is not NARS-shaped.
- [ ] **3.1** MeTTa backend adapter; a scenario that runs through it.
- [ ] **3.2** Non-NARS artifacts end-to-end (a second domain).
- [ ] **3.3** Vocabulary descriptors drive the field/event catalogs per backend.
**Deliverable:** two engines, one UI.

### Phase 4 — Self-model & demonstration system
**Goal:** the system reports/explains/demonstrates itself.
- [ ] **4.1** Introspection views (health/attention/agenda/resources/uncertainty).
- [ ] **4.2** Agent-authored episodic demos (beats, narration, artifacts) via `ui.command`.
- [ ] **4.3** Demo library / screen-record mode; teaching + marketing capture.
**Deliverable:** the UI that demonstrates itself.

### Phase 5 — Platform & hardening (later)
- [ ] **5.1** Plugin/descriptor API formalized; third-party extension path.
- [ ] **5.2** Performance: batching, virtualization, decimation, latency budgets.
- [ ] **5.3** Error taxonomy surfaced in the log + boundary.
- [ ] **5.4** Docs-as-code derived from descriptors.
- [ ] **5.5** 3D/SpaceGraph as a view adapter (deferred until 2D cognition is complete).
- [ ] **5.6** Determinism/pixel gate re-introduced as a design-regression net.

---

## 10. Keep / demote / reuse ledger

**Keep & build on (from `TODO.ui.md`):** protocol/contract; event bridge + `eventCatalog` +
`fieldCatalog`; store/reactive core; tokens/`theme`; `ViewSpec`/adapters (generalize); scenario
catalog; server projection (generalize); `/test/*` harness (repositioned as a **steering** API);
`defineSurface` reflective contract; command contract.

**Demote:** pixel baselines as the gate (keep the harness, shrink the corpus, re-expand later);
SpaceGraph/3D; Storybook coverage as a blocker; the standalone demo player (fold into `ui.command`).

**Reuse as-is where possible:** the determinism seed/clock/id seam stays for offline/CI fixtures, but
is no longer the definition of correctness.

---

## Appendix A — Open questions / assumptions to revisit

- Tool transport for `uiControl` (in-process tool registry vs MCP) — start in-process; MCP later.
- Whether `language` and `reasoning` share one agent facade or remain separate capabilities that
  compose into one conversational surface.
- Multi-agent: the UI targets a single user/agent; the underlying agent may belong to a multi-agent
  system — the boundary is a future contract.
- Artifact sandboxing policy (HTML/widget) — security model before any remote content.
- Second domain for Phase 3 beyond "a second engine" (e.g., a math/LEAN or planning realm).

## Appendix B — Contract sketches

```ts
type Capability = 'language' | 'reasoning' | 'uiControl' | 'tools' | 'memory';

interface BackendCaps { tasks: string[]; streaming: boolean; provenance: boolean; steerable: boolean; }

interface VocabularyDescriptor {
  nodeKinds: Array<{ id: string; label: string; color?: string }>;
  edgeKinds: Array<{ id: string; label: string }>;
  uncertainty?: FieldDescriptor;      // engine-declared
  fields: FieldDescriptor[];
  events: EventMeta[];
}

interface Artifact<T = unknown> { kind: string; title?: string; spec?: ViewSpec; data: T; }
```
