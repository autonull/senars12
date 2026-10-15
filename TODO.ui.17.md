# UI.17 — The Focus Model

**Status:** vision (settled) · supersedes the *UI.16 composition framework* as the organising model.
UI.16 built the plumbing (surfaces are dumb, the shell owns chrome, compositions are data). UI.17
decides **what the plumbing is for**: a single workspace that is simultaneously a document and a
graph, addressed by one focus, reducible to any conventional UI, and never "a canvas with panels
pasted on".

**Ready to implement.** §16 is the fresh-session start; §19 names the honest risks. The keystone is
§0's attention economy: **the UI spends attention the way the mind does.**

**Progress:** §16 Steps 0–1 landed (the four coordinates, `FocusRef`, focus stack, `FocusCell`, and
the typed Resolver over the WorkspaceGraph). See §21 for the log and the next step.

> **SeNARS is a live two-system cognitive runtime, and the UI is a projection of one Focus
> through one Aspect at one Depth at one Time — where content and structure are the same
> substrate seen at different depths.**

---

## 0. Why this model (the stake)

SeNARS is not a dataset to visualise. It is a **live mind**: System 1 *proposes* (LM translation,
the Judgment Manifold, reflexes), System 2 *derives* (NAL, MeTTa), four gates *admit and record*,
an append-only log *remembers*, drives *pull*, and it is **always in motion and always ready to
react to new input**. A dataset sits still; a mind does not.

The UI must therefore be a **window onto a running mind that responds to what you are doing** —
not a graph of nodes with panels bolted around it. Three things follow, and they are the whole
document:

1. **One focus.** The subject of everything. Time, concepts, derivations, goals, turns, events,
   drives — all are just *things one can focus*.
2. **A continuum, not modes.** Flat content and graph are the same substrate at different depth.
   Conventional UI, graph UI, and every messy mixture are points on one line — not separate apps.
3. **Input is perception.** A prompt is not decoration; it is **perceived**, admitted, formalised
   — it **becomes a concept** in the mind, with a term, a truth value, and links. The conversation
   *is* graph growth.

### The interface is an attention economy — the UI spends attention the way the mind does

The mind has no infinite canvas; it has a **budget** (AIKR): bounded attention, decay, sampling. The UI
has the same constraints — finite pixels, finite frame time, finite *human* attention. So the UI must
not fake infinity. It must **allocate by the same mechanism the reasoner uses**: attention.

- **Focus is the signal.** Where the user focuses, energy flows — exactly as the reasoner spends on
  the concepts it attends to. Focusing is a real `focus.set`/priming event, so **user and system
  co-direct attention**: the UI shows what the system attends to, and the system attends to what the
  user focuses.
- **Fidelity is a function of attention × proximity to focus.** The focus gets full fidelity
  (provenance, mounted bodies, live labels); the context ring gets **sampled** fidelity; the ambient
  gets **aggregates**; everything behind gets **reclaimed**.
- **Decay, not teardown.** As focus moves, previous foci decay — bodies unmount, glyphs simplify —
  just as concept priority decays without reinforcement.
- **This resolves the performance problem by principle, not by engineering.** The UI degrades
  gracefully under load *because* it is an attention economy — so its behaviour under pressure
  **mirrors the mind's**, and that is why it "best reflects how it actually works."

The UI's own expensive operations (deep provenance, replay, counterfactual) are **budgeted** like
reasoning operations: you spend to render them, and the spend is visible. There is **no obligation to
record or render everything** — focus defines where the energy goes, and all resources are finite.

---

## 1. The axiom — four coordinates

The entire UI state is four coordinates. There is no other state.

| Coordinate | Meaning | Answers |
|---|---|---|
| **Focus** | *what* is the subject — a typed reference into the substrate | "what am I looking at?" |
| **Aspect** | *how* it is projected — **this is the user's intent** | "what am I doing with it?" |
| **Depth** | *how far into* the subject's containment (the fractal) | "at what scale?" |
| **Time** | *when* — `live` \| `at(t)` \| `range(t₀,t₁)` | "at what time?" |

Every rendered thing is `render(focus, aspect, depth, time)`. Every interaction mutates exactly one
coordinate. This is the connective tissue that makes *everything connect*.

---

## 2. Focus — the one object

A focus is a **typed reference into the cognitive substrate**, never a UI invention:

```
FocusRef =
  | concept(term)                      // a concept in memory
  | task(term, belief|goal|question)   // an admitted task
  | goal(term)                         // a teleological aim
  | derivation(id)                     // a System-2 proof record
  | step(derivationId, index)          // one inference in a proof
  | proposal(id)                       // a System-1 candidate (LM / manifold / reflex)
  | judgment(id)                       // a manifold score artifact
  | turn(id)                           // one utterance (user or agent) — a *perceived* thing
  | event(id)                          // one logged mutation
  | cycle(id)                          // one kernel micro-tick
  | time(at | range)                   // a position / interval in the log
  | drive(name) | space(id) | mind     // motivational / MeTTa space / the whole system
```

**Laws**

1. **One focus.** A single `$focus`. Every surface reads it; no surface owns subject state.
2. **Everything is focusable** — including *time*, a *drive*, a *proposal*, an *event*.
3. **Focus is a stack.** Navigation pushes history; back / forward / "return to context" always work.
4. **Focus is native** — a term or a provenance id, so it round-trips with the kernel.

---

## 3. The Cell — the atom of UI

The unit of the interface is not a "panel" or a "widget"; it is a **cell**:

```
Cell = {
  focus: FocusRef,          // the subject
  aspect: Aspect,           // the projection  (default: derived from intent)
  depth: number,            // expansion into the focus's containment
  time: TimeRef,            // the temporal coordinate
  expanded: boolean         // this cell's children shown or collapsed
}
```

A cell renders **anything**, because it renders `(focus, aspect, depth, time)`. A cell can be flat
text, a graph, a table, a derivation, a form, an image, a chart — the *aspect* decides. A cell can
**contain** other cells: its children are cells at `depth+1` (its containment). So the workspace is a
**recursive collection of cells** — which is to say it is simultaneously a document (children in
order) and a graph (children by relation).

**This is the whole trick:** a document is a cell-tree; a graph is a cell-graph; a chat is a cell-list
ordered by time. They differ only in **arrangement**, not in kind.

---

## 4. The Workspace — a graph of cells

A workspace is a set of cells plus an **arrangement**:

| Arrangement | Result | Conventional name |
|---|---|---|
| **Linear** (ordered) | cells in sequence | chat, transcript, article |
| **Outline** (tree) | cells nested by containment | notebook, outliner, docs |
| **Spatial** (graph) | cells placed by relation | concept graph, map |
| **Grid** (tiles) | cells in a fixed matrix | dashboard |
| **Mixed** | some cells linear, some spatial, some nested | *the real thing* |

Arrangement is itself a projection — you can switch a region from linear to spatial and the same
foci re-lay-out. The old `composition`/`layout` machinery (UI.16) becomes one **arrangement
strategy** among several, not the organising model.

---

## 5. Flat ↔ Graph is a **continuum**, not two modes

This is the central requirement.

- **Flat content** = a focus at a depth that **hides its structure** (a paragraph, a label, a row).
- **A graph** = the same focus at a depth that **hides its content** (a node and edges).
- **The mixture** = per-cell depth: some cells flat, some graphs, some both.

Because *every cell's content is itself nodes*, and *every node has content*, a message can
**contain a graph**, and a graph node can **contain a message**. The fractal guarantees the mixture
is stable at every depth.

> **Reducing to a conventional UI is just setting depth to 0 (flatten) for the relevant cells.**
> Charting the graph is setting depth high and aspect to Neighborhood. There is no separate mode.

### Worked reductions (all the *same* cells, different coordinates)

| You want | Focus | Aspect | Depth | Arrangement |
|---|---|---|---|---|
| **Standard LM chat** (no graph) | the `turn` list | Content | turn flat (0) | Linear by time |
| **Simple concept graph** | a `concept` | Neighborhood | labels only | Spatial |
| **A table of beliefs** | a `concept`/`query` | Content | rows (1) | Grid (table) |
| **A form / prompt** | a `mind` action | Direct | 0 | Linear |
| **A derivation view** | a `derivation` | Provenance | steps (1) | Tree |
| **A dashboard** | several `concept`s | Content | tiles | Grid |
| **A live debug console** | `mind` | Ambient | events (0) | Linear, streaming |
| **Chat that *grows a graph*** | `turn` + induced `concept`s | Content ⊕ Neighborhood | mixed | Mixed |

The last row is the payoff: the conventional chat **and** the graph are one workspace, because the
turn is a perceived concept and its edges to the concepts it induced are real.

---

## 6. Reifying prompts as perceived concepts

**A prompt is not a chat bubble; it is a perception.**

```
you type  ──▶  PerceptionGate.admit(raw utterance)
                 ├─ System-1: formalization candidates (NL → Narsese, spans, ambiguity flags)
                 ├─ System-2: admitted task(s) → concept belief/goal/question tables updated
                 └─ gates record the mutation to the event log
              ⇓
           the utterance is now a `turn` focus that IS a concept:
             • a term / formalization
             • a truth value it seeded
             • edges to every concept it induced
             • provenance (which judgment, which gate, which cycle)
```

Consequences that make the UI cohere:

- The **transcript is a graph of perceived inputs** — a chat rendered linearly *or* spatially is the
  same data. Your words literally enter the mind, and the graph grows as you talk.
- A turn-cell can render **itself as a concept** (its formalization, truth, links), so "message" and
  "node" are one object at different depths.
- The **Dialogue Flywheel** becomes visible: each turn already carries a `DialogueTurn` (digests,
  embeddings); **accept / correct / reject** are cell affordances, feeding distillation directly.
- The **Judgment Manifold** becomes visible: each turn's **Origin** aspect shows the calibrated
  scores (task type, ambiguity, injection, source quality) that admitted it.

This is where SeNARS's LM capabilities live in the UI — **not everything is a derivation**.

---

## 7. Aspect — the projection *is* the intent

Intent is not a separate mode to infer; the **aspect** you are viewing *is* the intent. The complete
aspect set (uniform over any focus):

| Aspect | Projects | Renders | Absorbs (UI.16 surface) |
|---|---|---|---|
| **Neighborhood** | the focus among its relations | graph (focus + context ring) | `graph-viewport`, `s-nodes`, `s-related`, `s-toc` |
| **Content** | the focus's intrinsic substance | document / card / row | `s-node-body`, `s-notebook` |
| **Provenance** | *how* the focus came to be | derivation DAG | `s-explain`, derivation viewer |
| **Origin** | System-1 vs System-2 around it | proposed vs derived split + scores | *(new, from the firewall)* |
| **History** | the focus over time | timeline / truth evolution | `s-timeline`, revision history |
| **Ambient** | the mind with no focus | attention field, drives, live events | `s-events`, `s-telemetry`, HUD |
| **Direct** | what you can *do* to it | affordances + kernel ops | `s-settings`, `lens-designer`, config |

**Origin is first-class** because the epistemic firewall is SeNARS's signature: at a glance, *proposed
(uncertain, calibrated)* vs *derived (auditable)*.

---

## 8. Depth — the fractal

Zooming in **follows containment**, which is the substrate's own structure:

```
mind
 └─ concept ──▶ task ──▶ { truth-history, provenance }
      └─ (links) ──▶ concept …                 // recursion
 turn ──▶ { formalization(candidates), derivation, answer }
 derivation ──▶ step ──▶ { premises, rule, truth algebra }
 goal ──▶ { subgoals, achievement trace }
 event ──▶ { gate, reason, correlation }
```

**Graph and content are the same object at different depths.** A concept is a *node* in its
neighborhood (depth−1) and a *document* at center (depth 0); its beliefs are *rows* (depth+1); a
belief's proof is a *DAG* (depth+2).

Rendering is **Focus + Context**: the focused cell is drawn richly at centre; its neighborhood is a
ring around it; focusing a ring cell re-centres it and the old focus becomes ring. That transition
*is* the fractal — self-similar at every depth, content and graph coexisting in one space
(SpaceGraph's principle, realised with Cytoscape + translucent overlays).

---

## 9. Time — a coordinate, not a mode

Every focus has a temporal extent. `$time` = `live` | `at(t)` | `range(t₀,t₁)`.

- **Past** = projection of the event log (replay). **Present** = the live stream. **Future** = goals,
  expectations, reflex predictions. All three are projections of the *same* substrate under `$time`.
- **Time is focusable.** Focusing an `event`/`cycle`/`timepoint` centres the timeline; focusing a
  `concept` gives *its* history. The "timeline scrubber" dissolves into the general model.
- Scrubbing is just changing the time coordinate; the focused cell's projection recomputes.

---

## 10. Visual grammar — legibility and meaning

Driven by the **existing Lens AST** (`belief`/`goal`/`contradiction`), never cyan-for-everything:

| Channel | Encodes | Source |
|---|---|---|
| **Size** | attention / priority | `FocusBag` weight, concept `priority` |
| **Color** | truth frequency (belief) / desire (goal) / conflict | Lens AST |
| **Opacity** | confidence | Truth |
| **Outline style** | **system origin** — proposed (dashed) vs derived (solid) | system/kernel |
| **Edge style** | relation kind | inheritance / implication / derivation / link / thread |
| **Motion** | liveness — pulses while reasoning, settles when idle | cycle activity |

**Overlays are translucent** (`color-mix(… 82%, transparent)`): drill-down draws *over* the
neighborhood so context reads through — **never blot out a whole box**.

**Legibility by construction:** the default is a *focused neighborhood* (radial around focus, tens of
nodes) at a guaranteed-legible zoom — never the whole store, never a centrality hairball. The
LOD / label-budget machinery (UI.16) becomes unnecessary once we stop drawing everything.

---

## 11. Affordances — actions as a function of focus

Available actions = `f(focus.kind, origin, aspect)`, wired to **real kernel operations**:

- derived belief → assert / negate / query / revise / **explain** / pin
- proposal → **accept / correct / reject** (the Dialogue Flywheel)
- question → answer / clarify
- goal → decompose / achieve / abandon
- contradiction → weigh / resolve
- turn → re-ask / correct (feeds distillation)

Connects the interface to the actual cognitive loop — not a dead canvas.

---

## 12. The composer — a pure function

`controls = composer(focus, aspect)` — **derived, not heuristic.** Graph controls appear iff the
focus's neighborhood is a graph; goal controls iff a goal is focused; judgment panel iff a proposal
is focused. No "which controls to show" guesses.

---

## 13. The ambient layer — always in motion

`Ambient` (no focus, or focus = `mind`) shows the attention field, drives, and the live event stream —
always on, because the system is always running. It **interrupts only within a noise budget**
(contradiction admitted, goal achieved, question needs clarification, LM / gate failure). Everything
else accumulates quietly. Motion in the field communicates liveness.

---

## 14. Invariants (the implementation must hold these)

1. One `$focus`; every surface reads it; no surface owns subject state.
2. Everything is focusable — including time, drives, proposals, events.
3. Focus is a stack; navigation is reversible.
4. Every view is `render(focus, aspect, depth, time)` — no exceptions.
5. The unit is a **cell**; a workspace is a graph of cells with an arrangement.
6. Flat and graph are one continuum — reducing to a conventional UI is setting depth, not a mode.
7. A prompt is perceived: every `turn` is a concept with a term, truth, links, provenance.
8. Origin (proposed vs derived) is always distinguishable.
9. Context is never destroyed; overlays are translucent.
10. Time is a coordinate, not a mode.
11. Controls are derived from `(focus, aspect)`.
12. Ambient respects a noise budget.
13. Adding a view = adding a projection, not a panel.
14. **Fidelity is allocated by attention** (focus → full, ring → sampled, ambient → aggregate, behind
    → reclaimed) and reclaimed by decay — the UI obeys AIKR like the mind does.
15. Nothing is recorded or rendered by default; expensive fidelity (replay, counterfactual) is
    **budgeted and opt-in**.

---

## 15. Arrangement — re-parenting existing surfaces (nothing is deleted)

| UI.16 surface | UI.17 role |
|---|---|
| `composition-view` / layout | **an arrangement strategy** for cells (linear / spatial / grid) |
| `app-chrome` | the workspace frame (focus breadcrumb, time, connection) |
| `composer-controls` | `composer(focus, aspect)` — contextual, derived |
| `graph-viewport` | `Neighborhood` aspect renderer |
| `s-node-body` | `Content` at entity depth — **translucent** |
| `s-notebook` | `Content` at document depth / outline arrangement |
| `s-chat` / `ask-surface` | a **linear arrangement of `turn` cells** (perceived concepts) |
| `s-explain` / derivation | `Provenance` aspect |
| `s-timeline` | `History` under the time coordinate |
| `s-events` / `s-telemetry` / HUD | `Ambient` aspect |
| `s-settings` / `lens-designer` / config | `Direct` aspect |
| `surface-registry`, `composition registry` | the registries of projections and arrangement presets |

Every component is **retained** — re-parented onto the four coordinates, not discarded. A surface that
does not fit a projection yet is parked behind a registry entry, not deleted: the substrate it was
built on (UI.16 — dumb surfaces, one shell, data-driven compositions) is exactly what UI.17 needs.

---

## 16. Implementation order — the fresh-session start

Build **attention-first**: the resource model (§0) is not a later optimisation; it is the first
principle, because it is what the whole thing rests on.

**Step 0 — the Resolver (design first, §19.3).** The typed interface
`resolve(FocusRef) → { content, neighborhood, provenance, history, trace }`. Everything else is a
consumer; get this shape right before building on it.

1. **The four coordinates** — `$focus`, `$aspect` (per-cell), `$depth`, `$time`; the `FocusRef` type;
   the focus stack; the `Cell` type. *(Spec already persisted as this file.)*
2. **Attention governs fidelity** — one allocator mapping `(focus, attention weight) → fidelity tier`,
   with decay and reclaim. Fold the existing LOD/scaling numbers into it rather than discarding them.
3. **Route every existing focus source** into `$focus` (graph tap → `concept`; chat submit → `turn`;
   node select → `task`; timeline → `time`; …).
4. **Cell renderer + Focus+Context canvas** — centre = `Content(focus)`, ring = `Neighborhood(focus)`,
   translucent `Provenance` / `History` / `Origin` overlays. *Discrete depth ladder first.*
5. **Visual grammar** from the Lens AST + origin; translucent node bodies.
6. **Perceive prompts** — a submitted utterance becomes a `turn` cell that is a concept.
7. **Composer + affordances** derived from `(focus, aspect)`; wire to kernel ops (incl. `.react`).
8. **Arrangement strategies** — linear / outline / spatial / grid / mixed over a cell set.
9. **Ambient** — attention field, drives, vitals; noise budget.
10. **Instrument, budgeted & opt-in** — Trace; cycle step; gates; breakpoints; intervention + diff;
    counterfactual replay. Each is a *spend*, surfaced before it runs.
11. **The obsolete** — the whole-store hairball default and intent-mode hacks become unreachable; the
    LOD machinery is **absorbed** into the attention allocator, not deleted.

---

## 17. The potential (why this is the point)

Because content and structure are one substrate:

- **One workspace is every UI.** A chat, an outline, a graph, a table, a dashboard, a debugger — and
  every fluid mixture — are **coordinate settings**, not separate apps or modes.
- **The conversation *is* the graph.** Your prompt becomes a perceived concept; the mind grows as you
  talk; the transcript and the concept map are one artifact seen two ways.
- **The system's nature is visible.** Proposals vs derivations (the firewall), attention (size), truth
  (colour), confidence (opacity), liveness (motion) — SeNARS's whole thesis, legible at a glance,
  and nothing else shows it.
- **The UI *is* the cognition, projected.** Not a dashboard about the mind — a window that *is* the
  mind at whatever depth the user is thinking at.

---

## 18. The Instrument — vivisection, intervention, and the UI as a channel *into* the mind

§0–§17 are the **navigation** half (a window). This is the **instrument** half: what makes the UI a
developer's vivisection bench on a *running* mind, seeing immediate responses to changes — not a
viewer. **The UI is not a window onto the mind; it is a channel *into* it** — simply another transport
into the same live agent, alongside CLI / IRC / WS / MCP.

### 18.1 Trace — a unit of cognition

A new `FocusRef` kind. Where *focus* is a **subject**, a **trace** is a **process instance**: one
cognitive act threaded end-to-end by the kernel's `correlationId` —

```
input ─▶ perception ─▶ formalization ─▶ attention ─▶ inference ─▶ admission ─▶ action ─▶ record
```

Focus a trace and the whole pipeline for that unit is one view. Correlates across gates, cycles, and
subsystems; joins counters to the events behind them.

### 18.2 The cycle as the clock

The kernel micro-tick (`perceive · attend · reason · authorize · propose · learn`) is the heartbeat.
Time's atomic unit is the **cycle**: `run / pause / step / rewind`. Every projection is
cycle-relative, so "time" is grounded in the system's own beat, not wall-clock.

### 18.3 Gates as control points

Perception / Action / Reward / Budget are the *only* writers. The UI stands **at** a gate: watch what
arrives, **why it was admitted or refused**, and intercept — `observe → veto → inject`. **Adjudication
is a first-class aspect**, not a log tab.

### 18.4 Breakpoints & watchpoints

Halt when a condition holds — contradiction admitted, confidence exceeds *x*, budget exhausted,
LM/gate failure, source-reputation clamp. At the break, inspect the whole four-coordinate state.
**Watchpoints** are pinned traces / concepts that update live.

### 18.5 Intervention + diff

Edit the mind at runtime — believe · retract · goal · tune · swap-strategy · attach-probe — and see
the **diff**: which concepts / tasks / goals changed, with truth deltas. *Git diff for a mind.*

### 18.6 Causal & counterfactual replay — the killer

SeNARS is event-sourced, so this is *possible*, and no ordinary UI can do it. Trace causality **both
ways** (why it holds / what it caused); then **rewind to an event, alter one input or truth value,
re-run, and see what the mind would have concluded.** This is the vivisection — **budgeted and opt-in**:
a deliberate spend, surfaced before it runs, not a background recorder. Counterfactual replay is
expensive and attention is finite (§0).

### 18.7 Interaction as cognition

Every focus, injection, and correction *can* be perceived: a cognitive event, and — via the Dialogue
Flywheel — usable as training signal. The tool is **part of the mind it inspects**; a developer is
another channel into the same running agent.

But recording is **not an obligation**: it is a budgeted, opt-in spend (like any other attention
cost), not a background timeline of every keystroke. **Focus decides what is worth keeping.**

### 18.8 The vitals layer

Always-on, ambient, not a panel: attention heat, active foci, drives, budget pressure, LM spend, gate
queue depths. *The mind at a glance.*

---

## 19. Risks & de-risking (honest limits)

1. **Continuous fractal zoom.** Cytoscape is a *discrete* 2-D canvas; "a node becomes a document,
   continuously" needs a canvas + pinned-DOM hybrid with coordinated layout and hit-testing (the
   problem SpaceGraph exists to solve). → *Ship a discrete **depth ladder** first; add continuity only
   if it earns its keep.*
2. **Global time-travel.** Projecting the *whole* UI at arbitrary `t` needs replay or snapshot+delta.
   → *Time v1 = what the substrate already time-indexes — concept **revision history** and derivation
   **provenance** — plus event-log navigation; whole-state rewind later.*
3. **The Resolver is load-bearing.** Every `FocusRef` kind must resolve to
   `content · neighborhood · provenance · history · trace`. **Design this typed interface first** — it
   is most of the real cost.
4. **Containment must be real.** The fractal is only as deep as the substrate's containment edges.
   Exist today: concept→tasks, derivation→steps, event→cycle, proposal→judgment. Partial:
   turn→formalization, goal→subgoals. Fill the gaps as needed.
5. **Liveness & performance → resolved by principle.** A live mind emits continuously, but the UI is
   itself an attention economy (§0): fidelity is allocated by focus, sampled for the ring, aggregated
   for the ambient, reclaimed behind, and decayed over time. The **noise budget is the same budget the
   reasoner runs on.** *This is the one risk that becomes the design's best feature.*

---

## 20. The stake, restated

The UI is **not a dashboard about the mind — it is a projection that *is* the mind**, at whatever
depth the user is thinking, reducible to any conventional UI, mixing flat content and graph freely,
where a prompt is a perceived concept and the conversation is graph growth — and, for a developer, a
**vivisection bench**: step the cycle, stand at the gates, break on a condition, intervene, diff the
ripple, replay counterfactually, and treat your own interaction as cognition.

Above all: **the interface spends attention the way the mind does.** Focus defines where the energy
flows; fidelity is bought and reclaimed; nothing is recorded that is not worth the spend. The UI is
not a picture of cognition — it is cognition, allocated the same way.

That is the stake. This document is the contract.

---

## 21. Progress log

### Landed — Steps 0–1 (the coordinates + the Resolver shape)

Pure, tested, DOM-free foundation under `ui/src/client/framework/`, re-exported from the framework
barrel. Nothing is deleted; this is additive.

| Piece | File | What it is |
|---|---|---|
| Four coordinates + `FocusRef` + `FocusCell` | `framework/coordinates.ts` | `FocusRef` (14 typed kinds), `focus` constructors, `focusKey`/`focusEquals`, `Aspect` (+ `ASPECT_SURFACES`, the §7/§15 surface map), `TimeRef` (`live`/`at`/`range`), the `DEPTHS` ladder + `clampDepth`, `FocusCell` + `cellFor`/`cellKey`/`cellEquals` |
| Focus stack | `framework/focus-stack.ts` | `createFocusStack` — reversible navigation (`set`/`replace`/`back`/`forward`/`reset`), bounded history, `subscribe` |
| Resolver (Step 0) | `framework/resolver.ts` | `resolveFocus(FocusRef, {graph,depth}) → { content, neighborhood, provenance, history, trace }`, `workspaceResolver`, `aspectSlice`/`hasSlice` |
| Tests | `tests/framework/focus-model.test.ts` | 12 tests over keys, guards, ladder, stack, and resolution slices |

Design notes:

- The `FocusCell` name is used (not `Cell`) to avoid colliding with the UI.16 `Cell` in
  `framework/composition.ts` — the latter becomes an arrangement strategy (§15). When the two
  reconcile, the UI.16 `Cell` retires and `FocusCell` takes the name.
- The Resolver reads the **one `WorkspaceGraph`** (`core/workspace-graph.ts`), so there is no new
  substrate: `content` = block + ordered children, `neighborhood` = existing `core/neighborhood.ts`,
  `provenance` = `provenanceRefs` ⊕ `derived-from`/`supports`, `history` = `revises`/`elaborates`
  (oldest first), `trace` = `eventRefs` ⊕ `admitted/rejected-by-gate` ⊕ `produced-by-tool`.
- `origin`/`ambient`/`direct` aspects intentionally carry no graph slice yet — they project a split,
  a mind and verbs, not a focus's slices.

### Remaining — facilitated next steps

1. **Step 3 wiring (the immediate next slice).** Route the live focus sources into one `$focus`
   stack in `kernel/state.ts` and re-parent `setWorkspaceFocus` onto it. Today the only focus is the
   legacy `workspaceGraph.focus: Ref`; ~15 call sites (`graph-viewport`, `notebook`, `toc`, `related`,
   `artifact`, `block-menu`, `graph`, `graph3d`, `app-layout`) read/write it. Decide the `Ref →
   FocusRef` mapping (block kind → focus kind) there, deliberately — it is the one place kind
   ambiguity is resolved, and it is why it was *not* guessed in this slice.
2. **Step 2 (attention allocator).** Fold the existing LOD/zoom numbers (`utils/graph-scaling.ts`,
   `utils/renderer-capabilities.ts`, `core/performance-budget.ts`) into one
   `(focus, weight) → fidelity tier` allocator with decay/reclaim.
3. **Tests:** the resolver covers block-backed foci; add cases as wiring introduces real
   non-block foci (`mind`/`drive`/`time`) and as containment edges fill the §19.4 gaps
   (turn→formalization, goal→subgoals).

### New improvement opportunities

- **`SemanticLinkKind` ↔ provenance/history/trace are sets here; they want one declared table**
  (like `BUDGET_RESOURCES`) so the resolver and future breakpoints/Instrument aspects agree on which
  link kinds mean "support", "revised" and "caused".
- **`ASPECT_SURFACES` is the routing seam for Step 3** — it could also carry the default arrangement
  (linear/spatial/grid) per `(aspect, depth)`, letting one table drive both aspect and arrangement.
- **`focusKey` is a natural URL/fragment encoding** (the four coordinates serialize to one address),
  which would make focus deep-linkable and replayable for free.
