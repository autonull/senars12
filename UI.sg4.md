# SeNARS UI: Comprehensive Development Specification & Plan

## 1. Vision & Core Philosophy
The SeNARS UI is not merely a graph renderer; it is a **cognitive workspace** powered by a rigorous, algebraic rendering engine. 

Historically, the project evolved through three specification phases:
*   **v1:** Feature-heavy, focused on visual spectacle and embodied navigation (tunnels, physics springs).
*   **v2:** A radical pivot to mathematical purity. The UI became an algebraic engine where every visual encoding is a pure function: `M : (Item, Lens, View) → ΔDisplay`.
*   **v3:** Engineering pragmatism. Mandated zero-allocation paths, strict separation of concerns (Engine vs. Adapters), and elevated configuration tooling to a core requirement.

**The Reality Check:** Despite this architectural sophistication, a system is useless without a usable interface. Therefore, this specification balances the mathematical rigor of v2/v3 with the practical necessity of a **Core Cognitive Loop**: *Ingest → Contextualize → Evaluate → Refine → Navigate.*

**Core Principles:**
1.  **User-Centric Cognition:** The algebraic engine exists to serve the user's cognitive loop, not the other way around.
2.  **Math-Driven Rendering:** No bespoke rendering branches. All visual state is derived from the Modulation algebra.
3.  **Strict 2D/3D Parity:** Both viewports consume the exact same `ΔDisplay` patches.
4.  **Performance as a Feature:** Zero-allocation paths and aggressive memoization are mandatory for high-frequency updates.

---

## 2. Architectural Overview

The system is divided into three strict layers to ensure implementability and extensibility:

### Layer 1: The Cognitive Workspace (UI)
The user-facing application. It handles text ingestion, form generation, timeline scrubbing, and the Lens Designer. It translates user intent into state changes (`Item`, `Lens`, `View`).

### Layer 2: The Modulation Engine (Pure Math)
The algebraic core. It takes the current state and evaluates the active `Lens` and `View` to produce a `ΔDisplay` patch. 
*   **Inputs:** `Item` (data), `Lens` (interpretation config), `View` (camera/LOD state).
*   **Operators:** `Leaf`, `Const`, `Field ⇒`, `When`, `⊕` (union/last-wins), `Memo`.
*   **Outputs:** `ΔDisplay` (a strictly typed, minimal patch of visual channel updates).

### Layer 3: Viewport Adapters (Renderer Glue)
Thin, testable adapters that translate `ΔDisplay` into renderer-specific API calls.
*   **2D Adapter:** Maps `ΔDisplay` to Cytoscape.js styles.
*   **3D Adapter:** Maps `ΔDisplay` to Three.js/SpaceGraph properties.

---

## 3. Phased Development Plan

This trajectory prioritizes building a usable UI *alongside* the engine, ensuring we never lose the "basic SeNARS experience" while scaling up to the v2/v3 architectural ideals.

### Phase 1: The Minimal Cognitive Workspace (Usability First)
*Goal: A user can ingest a concept, see it in the graph, and edit its truth value.*
*   **1.1 Ingestion Box:** A simple text input to create basic NAR nodes (e.g., "The sky is blue").
*   **1.2 Basic 2D Graph:** A Cytoscape view rendering nodes as simple circles with labels. 
*   **1.3 The Truth Slider:** Clicking a node opens a minimal panel with a slider for `truth.f`. Changing it updates the node's color (e.g., red to green).
*   *Milestone (Cognitive Gate):* A user can type a sentence, see it appear, and change its truth value.

### Phase 2: The Algebraic Substrate (Implementability)
*Goal: Refactor Phase 1 to use the Modulation engine, establishing the v2/v3 foundation.*
*   **2.1 Core Algebra:** Implement `Leaf`, `Const`, `Field ⇒`, `When`, and `⊕`. (Defer `⊗` blending until required).
*   **2.2 Engine Integration:** Refactor the Truth Slider to update the `Item` state, which triggers the Modulation engine to generate a `ΔDisplay` patch, which the 2D Adapter applies.
*   **2.3 Memoization & Zero-Allocation:** Implement the `Memo` operator. Design `ΔDisplay` generation to reuse objects in hot loops to prevent garbage collection spikes.
*   *Milestone (Engine Gate):* 100% test coverage on algebraic laws. The UI updates strictly via `ΔDisplay` patches with zero GC spikes during rapid slider manipulation.

### Phase 3: Relational Context & Layout (Usability)
*Goal: A user can see and create relationships between concepts.*
*   **3.1 Auto-Linking:** Ingesting complex sentences automatically creates links between existing or new nodes.
*   **3.2 Link Editing:** Clicking a link allows editing its `truth.f` and `type` (e.g., "is-a", "has-property").
*   **3.3 Force-Directed Layout:** Implement a physics layout that keeps related nodes visually clustered.
*   *Milestone (Relational Gate):* A user can ingest a network of concepts, see them auto-link, and adjust relationship properties.

### Phase 4: The Lens System & Designer (Extensibility)
*Goal: Prove that "adding a feature is just a config object" and make it usable for non-engineers.*
*   **4.1 Hardcoded Lenses:** Implement "Belief" (colors by `truth.f`) and "Goal" (sizes by `goal.relevance`) lenses via the Modulation engine.
*   **4.2 Schema Migration:** Move Lens definitions from TypeScript to a strict JSON schema (`config.schema.json`).
*   **4.3 The Lens Designer UI:** Build a visual interface allowing users to map NAR fields to visual channels via dropdowns/sliders. The UI generates the JSON config in real-time.
*   *Milestone (Config Gate):* A user can create a custom Lens, map fields to channels, and see it render instantly without touching engine code.

### Phase 5: Temporal Navigation & History (Usability)
*Goal: A user can see how beliefs have changed over time.*
*   **5.1 Timeline Scrubber:** A horizontal UI slider representing time.
*   **5.2 Time-Gated Rendering:** Use a `When(t ≤ scrubberT)` Modulation to control `opacity`. Nodes fade in/out as the user scrubs.
*   **5.3 Revision History:** The node inspector shows a chronological list of past truth values.
*   *Milestone (Temporal Gate):* A user can scrub through time to watch the graph evolve and understand belief revisions.

### Phase 6: 3D Parity & Spatial Depth (Extensibility)
*Goal: A user can explore large, complex graphs in 3D with zero logic duplication.*
*   **6.1 3D Adapter:** Implement `projectΔ` for the Three.js/SpaceGraph renderer.
*   **6.2 Z-Axis Mapping:** Map `time` or `abstraction level` to the Z-axis via a specific Lens.
*   **6.3 Parity Test Suite:** Feed 1,000 random `(Item, Lens, View)` tuples into both 2D and 3D adapters. Assert functional equivalence (accounting for documented missing channels like `rotation` in 2D).
*   *Milestone (Spatial Gate):* A user can toggle to 3D, and all Lenses, timelines, and edits work identically without writing 3D-specific logic.

### Phase 7: Accessibility, i18n, & Polish (Usability)
*Goal: Fulfill the v3 mandate that a11y and i18n are first-class citizens.*
*   **7.1 A11y Modulations:** Inject mandatory Modulations into the composition root. E.g., `When(V.flags.reducedMotion) ⇒ Const({flow:{enable:false}})`.
*   **7.2 Redundant Encodings:** Automatically map `truth.f` to both `color` and `stroke.dash` for colorblind accessibility.
*   **7.3 i18n & Screen Readers:** Ensure all auto-generated labels use translation files. Integrate `aria-live` regions to announce Modulation changes.
*   *Milestone (A11y Gate):* Passes WCAG 2.1 AA. High contrast mode works. Screen readers can navigate the graph.

---

## 4. Quality Gates & Definition of Done

To prevent scope creep and ensure implementability, no phase may begin until the previous phase's gate is passed.

*   **Gate Criteria:**
    *   **Code:** All code passes strict TypeScript linting and Zod schema validation.
    *   **Tests:** 100% unit test coverage on the Modulation Engine. Integration tests for the Viewport Adapters.
    *   **Performance:** Zero-allocation paths verified via profiling (no GC spikes during 60fps updates).
    *   **Usability:** A non-technical user can complete the core cognitive loop for that phase without documentation.

---

## 5. Risk Management

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Algebraic Over-engineering** | High | Strictly defer complex operators like `⊗` (blending) until a concrete UI use case demands them. Start with `⊕` (last-wins). |
| **Usability Vacuum** | High | Phase 1 and 3 focus purely on the user. The "feel" of the app comes from crisp, instant data manipulation (auto-linking, smooth scrubbing), not camera animations. |
| **Config Sprawl** | Medium | The "Lens Designer" UI (Phase 4) is mandatory. Humans will not write Modulation JSON by hand. The UI enforces schema validity. |
| **2D/3D Parity Drift** | Medium | The Parity Test Suite (Phase 6) runs continuously in CI. If a new Modulation channel is added, the test fails until both adapters support it (or explicitly document it as unsupported). |

## 6. Conclusion

This specification bridges the gap between the theoretical elegance of the v2/v3 algebraic engine and the practical reality of a user-facing application. By strictly sequencing the development to build the **Cognitive Workspace** first, then the **Algebraic Engine**, and finally the **Advanced Adapters**, we ensure that SeNARS remains a usable, performant, and infinitely extensible tool for cognitive operations.

