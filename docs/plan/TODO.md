# SeNARS Strategic Roadmap

> "From Substrate to Ecosystem: Maximizing Value, Usability, and Reach."

This document outlines the strategic plan to elevate SeNARS from a promising research prototype into a robust, high-value AI platform.

## Guiding Principles

1.  **Usability First**: Complexity should be opt-in. The "Happy Path" must be zero-friction.
2.  **Demonstrable Value**: Every feature must have a corresponding "Show, Don't Tell" demo.
3.  **Research Enablement**: Tools that make the *invisible* reasoning process *visible* and *measurable*.
4.  **Ecosystem Ready**: Designed for extension, embedding, and community growth.

---

## Phase 1: Foundation & Reliability (The "Trust" Phase)

**Goal**: Ensure the system is rock-solid, predictable, and performant so users trust it with real work.

- [ ] **Comprehensive Test Suite Expansion**
    - [ ] Achieve >95% code coverage in `core/` (currently high, but needs edge cases).
    - [ ] Add **Property-Based Testing** for all logical operators to guarantee validity.
    - [ ] Create "Long-Running" stability tests (24h+ runtime without memory leaks).
    - [ ] Implement regression testing for reasoning quality (ensure newer versions don't get "dumber").
- [ ] **Performance Optimization**
    - [ ] Profile and optimize hot paths in `Term` unification and `Memory` queries.
    - [ ] Implement **WASM (WebAssembly)** core for critical NAL operations (10x speedup target).
    - [ ] Add automated logical benchmarks (derivations/sec) to CI pipeline.
- [ ] **Documentation Perfection**
    - [ ] Interactive API docs (TypeDoc + embedded runnable examples).
    - [ ] "Zero to Hero" video tutorial series embedded in docs.

## Phase 2: Usability & Developer Experience (The "Joy" Phase)

**Goal**: Make SeNARS the easiest Cognitive Architecture to install, learn, and use.

- [ ] **Polished CLI & TUI 2.0**
    - [ ] Enhance existing Ink-based REPL with syntax highlighting, autocomplete, and history.
    - [ ] add `senars init` command to scaffold new projects/plugins.
    - [ ] Create a "Dashboard Mode" TUI showing real-time metrics, focus contents, and active goals.
- [ ] **Web UI Revolution (The "Visualizer")**
    - [ ] Complete the React-based Web UI (`ui/`) to be a full-featured IDE.
    - [ ] **Live Derivation Graph**: Force-directed graph visualization of reasoning steps in real-time.
    - [ ] **Interactive Inspector**: Click on any node to see its truth value, confidence, and origin (evidence trace).
    - [ ] "Time Travel" debugging: Scrub back through reasoning history.
- [ ] **Deploy-Anywhere**
    - [ ] **Docker** image (official, optimized).
    - [ ] **NPM** global binary for instant access (`npx senars`).
    - [ ] **Edge-Ready** build for Cloudflare Workers / Vercel Edge.

## Phase 3: Applicability & "Killer App" Demos (The "Value" Phase)

**Goal**: Prove SeNARS can solve problems that pure LLMs or pure Logic cannot.

- [ ] **Personal Knowledge Assistant (PKA)**
    - [ ] A local-first agent that ingests user notes/docs (Markdown, PDF).
    - [ ] Uses SeNARS to find contradictions, infer missing links, and answer "Why?" questions.
    - [ ] *Why SeNARS?* Proven consistency over time (unlike LLM context window amnesia).
- [ ] **Autonomous Coding Agent (The "Architect")**
    - [ ] An agent that maintains a "Mental Model" of a codebase structure.
    - [ ] Can answer high-level architectural questions ("If I change X, what breaks?").
    - [ ] Reasoning-guided refactoring (planning steps before editing).
- [ ] **Game AI Director**
    - [ ] A Unity/Godot plugin demo controlling NPC narratives.
    - [ ] NPCs that have long-term memory, goals, and consistent personalities using SeNARS logic.

## Phase 4: Research Superpowers (The "Discovery" Phase)

**Goal**: Become the de-facto standard implementation for NAL and Neuro-Symbolic research.

- [ ] **RLFP (Reinforcement Learning from Preferences) Workbench**
    - [ ] A specialized UI for human-in-the-loop training.
    - [ ] "Thumps Up/Down" interface for reasoning paths.
    - [ ] Visual policy inspection (heatmaps of attention allocation).
- [ ] **Gym Integration**
    - [ ] OpenAI Gym / PettingZoo wrappers for standard RL environments.
    - [ ] Benchmark SeNARS against standard RL baselines (PPO, DQN) on logic-heavy tasks.
- [ ] **Tensor Logic Explorer**
    - [ ] Visualizer for the Truth-Tensor bridge (see symbolic truth mapping to high-dimensional space).
    - [ ] Interactive "Differentiable Logic" playground.

## Phase 5: Ecosystem & Community (The "Growth" Phase)

**Goal**: Enable a self-sustaining community of creators.

- [ ] **SeNARS Plugin Registry**
    - [ ] Standardized manifest format for plugins (custom rules, I/O adapters, strategies).
    - [ ] `senars install <plugin>` cli command.
- [ ] **Knowledge Market**
    - [ ] Shareable "Knowledge Books" (serialized Narsese ontologies).
    - [ ] e.g., "Common Sense Physics", "Medical Diagnostics Basic", "Software Design Patterns".
- [ ] **Language Bindings**
    - [ ] **Python Bridge** (essential for ML researchers).
    - [ ] Rust Core (long-term rewrite target for max perf?).

---

## Immediate Next Steps (The "Now")

1.  **Benchmark Baseline**: Establish current performance numbers.
2.  **UI "Hello World"**: Get the `ui/` directory to a "deployable" state with basic graph viz.
3.  **RLFP Prototype**: Implement the first end-to-end feedback loop.
