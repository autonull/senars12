# TODO.asap.md: Operation Ockham's Razor

> "The less complete it is right now, the more possibilities it can grow into." — README.md

**Objective**: Achieve exponential improvements in reasoning capability and developer velocity by ruthlessly eliminating
architectural overhead and embracing a "Hyper-Stream" design.

**Philosophy**: Code is weight. To fly, we must shed the heavy armor of "Enterprise Architecture" and become a nimble,
living stream of intelligence.

## I. The Great Collapse (Immediate Action)

*Goal: Reduce codebase size by 40% while increasing throughput.*

- [ ] **Eradicate `BaseComponent`**: The inheritance hierarchy is a straitjacket. Replace with functional composition
  and simple object lifecycles.
- [ ] **Dissolve the `EventBus`**: Centralized event buses create hidden dependencies. Switch to direct, explicit data
  flow (Pipelines) and native `EventEmitter` only where strictly necessary for observability.
- [ ] **Flatten the Hierarchy**: Stop organizing by "kind" (Managers, Registries). Organize by **Domain** (Memory,
  Reasoning, IO).
- [ ] **Delete "Managers"**: `ConfigManager`, `ProviderRegistry`, `TaskPromotionManager`. These are bureaucratic layers.
  Pass simple configuration objects and use dependency injection.

## II. The Hyper-Stream Architecture

*Goal: <1ms latency per reasoning step. True non-blocking flow.*

- [ ] **Async Generator Core**: Replace the `step()` loop with native JavaScript Async Generators (`async function*`).
    - **From**: `PremiseSource` -> `Strategy` -> `RuleProcessor` (Object-oriented state machines)
    - **To**: `pipeline(source, strategy, processor)` (Functional stream composition)
- [ ] **Reactive State**: Make `Memory` and `Focus` reactive observables. Changes propagate automatically, removing the
  need for manual "Consolidation" cycles.

## III. The Symbiont Protocol (LM-First Design)

*Goal: Invert the control loop. The LM is not a plugin; it is the Pilot.*

- [ ] **Dynamic Strategy**: Deprecate hard-coded `BagStrategy` and `PrologStrategy`. Implement a `LMPolicy` where a
  fast, small model (e.g., Gemini Flash) dynamically selects the next reasoning step based on the current context.
- [ ] **Direct Tooling**: Expose NAL operations (`deduce`, `revise`, `abduce`) as *tools* for the LM. The LM "calls"
  logic when it needs precision, rather than logic "calling" the LM for text.

## IV. The "Virus" Distribution Model

*Goal: Ubiquity. Run everywhere, instantly.*

- [ ] **Universal Bundle**: Refactor to a single ESM entry point (`senars.mjs`) that has **zero** Node.js specific
  dependencies (fs, net) in the core.
- [ ] **Browser-Native**: Ensure the core runs in a browser ServiceWorker. This enables "Edge Reasoning" and instant
  demos.

## V. Immediate Execution Plan (Next 24 Hours)

1. **Refactor `Reasoner.ts`**: Convert to a functional pipeline.
2. **Strip `BaseComponent`**: Remove the class extension from `Memory` and `Term`.
3. **Inline Configuration**: Remove `ConfigManager` and pass plain JSON.

---
**Why this is better**:

- **Less Effort**: Less code to maintain, test, and debug.
- **Drastic Change**: Shifts from "Java-style OOP" to "Modern Functional/Agentic JS".
- **Future Proof**: Aligns with the trend of "AI Agents as Code" and "Serverless/Edge AI".
