# TODO2.md — SeNARS Development Roadmap

> **Strategy**: Make SeNARS power **demonstrable**, **accessible**, and **undeniable**.

---

## Overview

SeNARS has working NAL reasoning, 889 tests, and a Truth-Tensor bridge. What's missing is **visibility** — making it easy to see, use, and extend. This roadmap builds the **IDE + Lab** environment that showcases SeNARS capabilities.

### Core Deliverables

| Deliverable | Purpose | Status |
|-------------|---------|--------|
| `npx senars demo` | 60-second value proof | ✅ Complete |
| `SeNARS.js` facade | Simple API | ✅ Complete |
| IDE | Development environment | Planned |
| Lab | Experiment runner | Planned |
| NARL Benchmark | Scientific proof | Scaffold exists |

---

## Phase 0: Foundation ✅ COMPLETE

- [x] `npx senars demo` — 3 compelling demos
- [x] `SeNARS.js` — Friction-free facade API
- [x] Timeout protection — Prevents hangs
- [x] Progress logging — Visible feedback
- [x] Code cleanup — AGENTS.md compliance

---

## Phase 0.4: Hybrid Demo — LM as Reasoning Rule 🔬

> **Objective**: Demonstrate that LM is not an external service, but an **internal reasoning rule**.

When you input `"Cats are mammals".`:
1. This becomes an **atomic term belief** in NAL
2. The `LMNarseseTranslationRule` **fires automatically** as a reasoning rule
3. The LM translates → `<cat --> mammal>.` appears as a derived task
4. This new task enters NAL and triggers **further derivations**

This is fundamentally different from "LLM with tools" — the LM is **inside the reasoning loop**.

### Demo Modes

Each mode showcases a different LM rule:

| Mode | LM Rule | Shows |
|------|---------|-------|
| **translate** | `LMNarseseTranslationRule` | NL → Narsese as internal rule |
| **elaborate** | `LMConceptElaborationRule` | LM adds commonsense properties |
| **analogize** | `LMAnalogicalReasoningRule` | Problem-solving via analogy |
| **explain** | `LMExplanationGenerationRule` | Narsese → NL explanation |
| **hybrid** | All combined | Full pipeline demo |

### Console UI (with colors and emojis)

```
╔══════════════════════════════════════════════════════════════════╗
║  🧠 SeNARS Hybrid Demo — Where LM Meets Logic                    ║
╠══════════════════════════════════════════════════════════════════╣
║  Model: Xenova/LaMini-Flan-T5-783M                               ║
║  Mode:  hybrid (all LM rules active)                             ║
╚══════════════════════════════════════════════════════════════════╝

📥 INPUT: "Cats are mammals"
   └─ Stored as atom: "Cats are mammals"

⚡ LM RULE FIRED: narsese-translation
   ├─ Prompt: Translate "Cats are mammals" → Narsese
   ├─ LM Output: (cat --> mammal).
   └─ 💡 NEW TASK: (cat --> mammal). <1.0, 0.9>

⚡ LM RULE FIRED: concept-elaboration
   ├─ Prompt: What properties does "cat" have?
   ├─ LM Output: (cat --> [furry]). (cat --> animal).
   └─ 💡 NEW TASKS: 
        (cat --> [furry]). <0.9, 0.8>
        (cat --> animal). <0.9, 0.8>

🔄 NAL INFERENCE: deduction
   ├─ Premises: (cat --> mammal), (mammal --> warm_blooded)
   └─ 💡 DERIVED: (cat --> warm_blooded). <1.0, 0.81>

❓ QUERY: "Are cats warm blooded?"
   └─ Parsed as: (cat --> warm_blooded)?

✅ ANSWER: YES
   ├─ Frequency: 1.00
   ├─ Confidence: 0.81
   └─ Proof: cat→mammal + mammal→warm_blooded = cat→warm_blooded
```

### CLI Interface

```bash
# Run with defaults (hybrid mode, all examples)
node examples/demo-hybrid.js

# Specific mode
node examples/demo-hybrid.js --mode=translate

# Custom input
node examples/demo-hybrid.js --input='"Is coffee hot?"'

# Verbose mode (show all internal events)  
node examples/demo-hybrid.js --verbose
```

### Example Scenarios

**1. Translation Mode** — Shows LM-as-rule for NL→Narsese
```javascript
inputs: ['"Dogs are loyal animals"', '"Birds can fly"', '"Is water wet?"']
```

**2. Elaboration Mode** — LM generates commonsense
```javascript
inputs: ['coffee', 'penguin']  // → <coffee --> [hot]>. <penguin --> bird>.
```

**3. Syllogism + Explanation** — Classic logic with LM explanation
```javascript
facts: ['(socrates --> man).', '(man --> mortal).'],
query: '(socrates --> mortal)?',
explain: true
```

**4. Full Pipeline** — NL question → NAL reasoning → NL answer
```javascript
facts: ['"Penguins are birds"', '"Birds are animals"'],
query: '"Are penguins animals?"'
```

### Why This Is Unique

| Other Systems | SeNARS |
|--------------|--------|
| LLM calls external tools | LM **is** a reasoning rule |
| One-shot responses | Continuous inference cycles |
| No confidence | Computed truth values |
| Black box | Visible proof chains |
| Inconsistent | Logically constrained |

### Timeline

| Task | Effort | Status |
|------|--------|--------|
| Create `examples/demo-hybrid.js` | 3 hrs | [ ] |
| Implement demo modes | 2 hrs | [ ] |
| Add CLI argument parsing | 1 hr | [ ] |
| Test all scenarios | 1 hr | [ ] |
| **Total** | **~7 hrs** | |

### Files

- **[NEW]** `examples/demo-hybrid.js` — Main hybrid demo script
- **Uses** `core/src/reason/rules/lm/*.js` — LM reasoning rules
- **Uses** `core/src/SeNARS.js` — NAL reasoning facade

---

## Phase 0.5: The Killer Demo — Hybrid NAL + LM 🎯

> **Prerequisite**: Phase 0.4 smoke test passing
>
> **Objective**: Demonstrate neuro-symbolic synergy with transparent visualization.

This is the demo that proves SeNARS is different. Natural language in, reasoned answer out, with **visible proof chains** and **explainable confidence**.

### The Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User: "Are penguins mammals?"                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. LM PARSING                                                  │
│     Input: "Are penguins mammals?"                              │
│     → Narsese: (penguin --> mammal)?                            │
├─────────────────────────────────────────────────────────────────┤
│  2. NAL REASONING                                               │
│     Beliefs: (penguin --> bird). (bird --> animal).             │
│              (mammal --> animal). (penguin --> swimmer).        │
│     Derivations: [shown step by step in UI]                     │
│     Result: NO  <0.1, 0.7>  (low frequency, moderate conf)      │
├─────────────────────────────────────────────────────────────────┤
│  3. LM EXPLANATION                                              │
│     "Penguins are not mammals. While both are animals,          │
│      penguins are birds. Confidence: 70%"                       │
├─────────────────────────────────────────────────────────────────┤
│  4. PROOF TREE (visible in Lab UI)                              │
│     (penguin --> bird) + (bird --> animal) = (penguin --> animal)│
│     No path: (penguin --> mammal)                               │
│     Negative evidence from structural difference                │
└─────────────────────────────────────────────────────────────────┘
```

### Lab UI Transparency

The Lab displays **every step** in real-time:

```
┌─────────────────────────────────────────────────────────────────┐
│  🧪 HYBRID REASONING LAB                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUT ───────────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "Are penguins mammals?"                              [▶] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  PARSING (Transformers.js: LaMini-Flan-T5-248M) ─────────────  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "Are penguins mammals?" → (penguin --> mammal)?    ✓   │   │
│  │ Model: Xenova/LaMini-Flan-T5-248M  Time: 312ms         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  REASONING (NAL Inference Engine) ───────────────────────────  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Beliefs loaded: 4                                       │   │
│  │ ├─ (penguin --> bird). <1.0, 0.9>                      │   │
│  │ ├─ (bird --> animal). <1.0, 0.9>                       │   │
│  │ ├─ (mammal --> animal). <1.0, 0.9>                     │   │
│  │ └─ (penguin --> swimmer). <1.0, 0.9>                   │   │
│  │                                                         │   │
│  │ Derivations:                                            │   │
│  │ ├─ [DED] (penguin --> animal) <1.0, 0.81>              │   │
│  │ └─ [ABD] (penguin --> mammal)? → NO SUPPORT            │   │
│  │                                                         │   │
│  │ Answer: NO  Freq: 0.1  Conf: 0.7                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  EXPLANATION (LM Generation) ────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "Penguins are not mammals. They are birds. While both  │   │
│  │  penguins and mammals are animals, penguins belong to  │   │
│  │  the bird family. Confidence: 70%"                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  PROOF TREE ─────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         (penguin --> mammal)?                           │   │
│  │               ╱           ╲                             │   │
│  │    [no support]      [structural diff]                  │   │
│  │                            │                            │   │
│  │              (penguin --> bird) ≠ (x --> mammal)        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Components

**[NEW] `core/src/hybrid/HybridReasoner.js`**
```javascript
export class HybridReasoner {
    constructor(seNARS, lmProvider) {
        this.brain = seNARS;
        this.lm = lmProvider;
    }
    
    async processNaturalLanguage(input) {
        // 1. LM parses to Narsese
        const narsese = await this.lm.parseToNarsese(input);
        
        // 2. NAL reasons
        const result = await this.brain.ask(narsese);
        
        // 3. LM explains result
        const explanation = await this.lm.explain(result);
        
        return { input, narsese, result, explanation, proof: result.proof };
    }
}
```

**[NEW] `ui/src/components/lab/HybridDemo.js`**
- Four-panel layout: Input, Parsing, Reasoning, Explanation
- Live streaming of each phase
- Proof tree visualization
- Timing breakdowns

**[NEW] `ui/lab/demos/H_hybrid.json`** — Demo configuration
```json
{
    "id": "H",
    "name": "Hybrid NAL+LM Reasoning",
    "category": "Hybrid",
    "priority": "P0",
    "description": "The killer demo: natural language meets symbolic reasoning",
    "config": {
        "lm": {
            "provider": "transformers",
            "model": "Xenova/LaMini-Flan-T5-248M"
        }
    },
    "examples": [
        { "input": "Are penguins mammals?", "expectedAnswer": false },
        { "input": "Can birds fly?", "expectedAnswer": true },
        { "input": "Is Socrates mortal?", "expectedAnswer": true }
    ]
}
```

### Why This Demo Wins

| Aspect | LLM-Only | SeNARS Hybrid |
|--------|----------|---------------|
| Answer | "Penguins are not mammals" | Same |
| Confidence | None / hallucinated | 70% (computed) |
| Proof | None | Full derivation chain |
| Explainability | Black box | Transparent steps |
| Consistency | May contradict | Logically guaranteed |
| Offline | No (API required) | Yes (Transformers.js) |

### Timeline

| Task | Effort | Status |
|------|--------|--------|
| `HybridReasoner.js` class | 2 hrs | [ ] |
| NL→Narsese prompt tuning | 2 hrs | [ ] |
| Result→Explanation prompt | 1 hr | [ ] |
| `HybridDemo.js` UI component | 3 hrs | [ ] |
| Lab integration | 2 hrs | [ ] |
| Test & polish | 2 hrs | [ ] |
| **Total** | **~12 hrs** | |

---

## Phase 1: IDE + Lab Architecture

### Vision

The SeNARS **IDE** is a complete development environment for NAL reasoning. The **Lab** is an integrated experimentation mode for running demos, benchmarks, and autonomous explorations.

### Directory Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── shared/                 # Reusable across IDE and Lab
│   │   │   ├── EventStream.js      # WebSocket event handling
│   │   │   ├── ProofTree.js        # Derivation visualization
│   │   │   ├── TermView.js         # Term rendering (copulas, compounds)
│   │   │   ├── TruthDisplay.js     # Truth value badges (<f,c>)
│   │   │   ├── TaskCard.js         # Task display (belief/goal/question)
│   │   │   └── ConceptCard.js      # Concept summary card
│   │   │
│   │   ├── ide/                    # IDE-specific components
│   │   │   ├── Editor.js           # Narsese editor + syntax highlighting
│   │   │   ├── Console.js          # REPL with history
│   │   │   ├── BeliefBrowser.js    # Query and browse beliefs
│   │   │   ├── GoalPanel.js        # Active goals display
│   │   │   ├── ConceptExplorer.js  # Memory exploration
│   │   │   ├── Debugger.js         # Step-through reasoning
│   │   │   └── Timeline.js         # Cycle history scrubber
│   │   │
│   │   └── lab/                    # Lab-specific components
│   │       ├── LabRunner.js        # Experiment orchestrator
│   │       ├── LiveTrace.js        # Real-time inference stream
│   │       ├── ScoreChart.js       # Performance over time
│   │       ├── DiscoveryLog.js     # Notable inferences
│   │       ├── ComparisonView.js   # SeNARS vs LLM side-by-side
│   │       └── Achievements.js     # Gamification badges
│   │
│   ├── layouts/
│   │   ├── IDELayout.js            # IDE panel arrangement
│   │   └── LabLayout.js            # Lab dashboard layout
│   │
│   ├── hooks/
│   │   ├── useSeNARS.js            # React hook for SeNARS
│   │   ├── useWebSocket.js         # Event subscription
│   │   └── useExperiment.js        # Lab experiment state
│   │
│   └── App.js                      # Mode switching (IDE/Lab)
│
├── server/
│   ├── index.js                    # Express + WebSocket server
│   ├── api/
│   │   ├── reasoning.js            # /api/input, /api/query, /api/cycle
│   │   ├── memory.js               # /api/beliefs, /api/concepts
│   │   └── experiments.js          # /api/lab/start, /api/lab/stop
│   └── ws/
│       └── gateway.js              # WebSocket event broadcasting
│
└── lab/
    ├── demos/                      # Demo configurations
    │   ├── A_explainability.json
    │   ├── C_uncertainty.json
    │   └── E_adversarial.json
    ├── benchmarks/                 # Benchmark definitions
    │   └── narl.json
    └── expeditions/                # Long-run configs
        └── causal_exploration.json
```

### CLI Commands

```bash
# Primary modes
npx senars ide                      # Launch full IDE
npx senars lab                      # Launch Lab dashboard
npx senars demo                     # Quick 60-second demo

# Lab subcommands
npx senars lab demo <id>            # Run specific demo
npx senars lab demo --all           # Run all demos
npx senars lab demo --priority P0   # Run priority tier
npx senars lab benchmark narl       # Run NARL benchmark
npx senars lab expedition <config>  # Start long-running expedition

# Utility
npx senars repl                     # Terminal REPL
npx senars serve                    # API server only
npx senars --help                   # Show all commands
```

### Configuration

**`senars.config.js`** — Project-level configuration:

```javascript
export default {
    server: {
        port: 3000,
        host: 'localhost'
    },
    reasoning: {
        defaultCycles: 20,
        timeout: 15000,
        lm: { enabled: false }
    },
    lab: {
        demosDir: './ui/lab/demos',
        reportsDir: './reports',
        achievementsFile: './achievements.json'
    },
    ide: {
        theme: 'dark',
        fontSize: 14,
        autosave: true
    }
};
```

---

## Phase 1.1: Shared Components

Foundation components used everywhere:

### EventStream.js

WebSocket client with automatic reconnection:

```javascript
const events = useEventStream();
events.subscribe('derivation', (d) => console.log('New:', d));
events.subscribe('belief_added', (b) => updateBeliefs(b));
```

### ProofTree.js

Renders derivation chains as interactive trees:
- Expandable nodes
- Hover for truth values
- Click to inspect term

### TermView.js

Renders Narsese terms with proper formatting:
- Copulas: `-->`, `<->`, `==>`, `<=>`, etc.
- Compounds: `(&, ...)`, `(|, ...)`, `(-, ...)`
- Variables: `$x`, `#y`, `?z`
- Syntax highlighting

### TruthDisplay.js

Truth value display with visual confidence:
- Frequency bar (0-1)
- Confidence indicator
- Expectation calculation

---

## Phase 1.2: Lab Components

### LabRunner.js

Unified experiment orchestrator:

```javascript
const runner = new LabRunner();

// Load and run
await runner.load('./demos/A_explainability.json');
await runner.start();

// Control
runner.pause();
runner.resume();
runner.stop();

// Events
runner.on('step', (step) => updateUI(step));
runner.on('complete', (results) => showResults(results));
```

### Experiment Config Format

```json
{
    "id": "A",
    "name": "Inference Audit Trail",
    "category": "Explainability",
    "priority": "P0",
    "description": "Demonstrates complete derivation provenance",
    
    "setup": {
        "cycles": 10,
        "timeout": 5000
    },
    
    "steps": [
        {
            "action": "learn",
            "input": "(socrates --> man).",
            "description": "Socrates is a man"
        },
        {
            "action": "learn", 
            "input": "(man --> mortal).",
            "description": "Men are mortal"
        },
        {
            "action": "ask",
            "input": "(socrates --> mortal)?",
            "expect": { "answer": true, "minConfidence": 0.5 },
            "description": "Is Socrates mortal?"
        },
        {
            "action": "verify",
            "check": "proof.length >= 2",
            "description": "Verify proof chain exists"
        }
    ],
    
    "assertions": [
        { "type": "hasDerivation", "term": "(socrates --> mortal)" },
        { "type": "proofLength", "min": 2 }
    ],
    
    "narrative": {
        "intro": "This demo shows how SeNARS provides complete inference trails.",
        "conclusion": "Unlike LLMs, SeNARS can show exactly why it believes something.",
        "llmComparison": "LLMs produce answers but cannot explain derivation steps."
    }
}
```

### LiveTrace.js

Real-time inference display:
- Streaming derivations
- Filter by rule type
- Highlight key inferences
- Pause/resume stream
- Search/filter

### ScoreChart.js

Performance visualization:
- Time-series plot
- Multiple metrics (accuracy, confidence, throughput)
- Comparison overlays (SeNARS vs baseline)
- Zoom and pan
- Export to PNG/SVG

### DiscoveryLog.js

Notable inference collection:
- Auto-flagged interesting derivations
- Manual bookmarking
- Filter by novelty score
- Export collection

### Achievements.js

Gamification engine:

```javascript
const achievements = [
    { id: 'first_inference', name: 'First Step', condition: 'derivations >= 1' },
    { id: 'hundred_club', name: 'Century', condition: 'derivations >= 100' },
    { id: 'chain_master', name: 'Chain Master', condition: 'maxProofLength >= 5' },
    { id: 'marathon', name: 'Marathon', condition: 'runtime >= 3600000' },
    { id: 'perfect_narl', name: 'NARL Perfect', condition: 'narlScore >= 100' }
];
```

---

## Phase 1.3: IDE Components

### Editor.js

Narsese editor with:
- Syntax highlighting (terms, copulas, truth values)
- Auto-complete for common patterns
- Inline error display
- Multi-cursor editing
- Line numbers, folding

### Console.js

Interactive REPL:
- Command history (up/down arrows)
- Multi-line input
- Output formatting
- Quick commands (`:reset`, `:stats`, `:export`)

### BeliefBrowser.js

Query and explore beliefs:
- Search by term
- Filter by truth value range
- Sort by confidence, recency
- Bulk operations

### ConceptExplorer.js

Memory visualization:
- Concept network graph
- Term relationships
- Priority heatmap
- Drill-down inspection

### Debugger.js

Step-through reasoning:
- Breakpoints on terms/rules
- Step forward/backward
- Inspect premise selection
- Watch expressions

---

## Phase 2: NARL Benchmark

### Enhanced Test Suite

Each of 10 levels gets:

| Level | Name | Tests | Edge Cases |
|-------|------|-------|------------|
| 1 | Trace | 5 | Missing term, empty chain |
| 2 | Revise | 4 | Conflicting evidence, revision order |
| 3 | Persist | 4 | Large memory, cross-query consistency |
| 4 | Cause | 5 | Multi-hop chains, temporal ordering |
| 5 | Resist | 6 | Various injection patterns |
| 6 | Uncertain | 5 | Confidence math, degradation rates |
| 7 | Analog | 4 | Structural similarity, transfer |
| 8 | Meta | 4 | Self-reference, introspection |
| 9 | Bound | 5 | Resource limits, graceful degradation |
| 10 | Compose | 5 | Novel combinations, creativity |

### LLM Baseline

```javascript
// benchmarks/narl/llm_baseline.js
const baseline = new LLMBaseline({
    provider: 'openrouter',
    model: 'gpt-4-turbo',
    maxRetries: 3
});

const results = await baseline.runNARL();
// Returns: { level1: { score: 0, reason: 'No trace available' }, ... }
```

### Report Generation

Auto-generate markdown reports:
- Executive summary
- Level-by-level comparison
- Charts (mermaid)
- Raw data export
- Recommendations

---

## Phase 3: Prototype Demos

### Demo Categories

| ID | Category | Description | Priority |
|----|----------|-------------|----------|
| **H** | **Hybrid** | **NAL+LM neuro-symbolic reasoning** | **P0** 🎯 |
| A | Explainability | Inference audit trail | P0 |
| C | Uncertainty | Confidence propagation | P0 |
| E | Adversarial | Prompt injection resistance | P0 |
| B | Temporal | Event ordering and causality | P1 |
| D | Memory | Cross-session persistence | P1 |
| J | Compositional | Novel concept combinations | P1 |
| L | Resource-Bounded | AIKR graceful degradation | P1 |
| F | Analogical | A:B::C:? reasoning | P2 |
| G | Meta-Cognition | Self-reasoning | P2 |
| I | Learning | RLFP improvement | P2 |
| K | Multi-Agent | Collaborative reasoning | P3 |

**Note**: Demo H (Hybrid) is the killer demo — all other demos should link back to it to show the neuro-symbolic advantage.

### Demo Development Pattern

1. Create config JSON in `ui/lab/demos/`
2. Define steps, assertions, narrative
3. Test via `npx senars lab demo <id>`
4. Review in Lab dashboard
5. Refine based on results

---

## Phase 4: Autonomous Expeditions

### Expedition Mode

Long-running autonomous exploration:

```bash
npx senars lab expedition causal_exploration --duration 24h
```

### Expedition Config

```json
{
    "id": "causal_exploration",
    "name": "Causal Reasoning Expedition",
    "duration": "24h",
    "checkpointInterval": "1h",
    
    "task": {
        "type": "rlfp",
        "domain": "causal-reasoning",
        "goalGeneration": "llm",
        "preferenceSource": "synthetic"
    },
    
    "metrics": ["accuracy", "novelty", "confidence_calibration"],
    
    "alerts": {
        "onDiscovery": true,
        "onMilestone": true,
        "onError": true
    }
}
```

### Features

- Checkpointing and resume
- Live dashboard tracking
- Discovery notifications
- Automatic reporting
- Resource monitoring

---

## Development Flow

### Critical Path

```
Phase 0 ✅ → Phase 0.4 → Phase 0.5 → Phase 1.1 → Phase 1.2 → Phase 2 → Phase 3 → Phase 4
   │            │            │            │            │           │         │
   │            │            │            │            │           │         └── (3+ weeks)
   │            │            │            │            │           └── (1 week)
   │            │            │            │            └── (1 week)
   │            │            │            └── (3-4 days)
   │            │            └── (~12 hours)
   │            └── (~7 hours) LM-as-rule demo
   └── Done!
```

### Sprint 1: Killer Demo (Days 1-3) 🎯

**Goal**: Working hybrid NAL+LM demo in terminal

| Task | Hours | Dependency |
|------|-------|------------|
| `HybridReasoner.js` class | 2 | None |
| NL→Narsese prompt engineering | 2 | HybridReasoner |
| Result→Explanation prompt | 1 | HybridReasoner |
| `examples/hybrid-demo.js` | 2 | All above |
| Test with 5+ queries | 1 | Demo script |
| **Sprint 1 Total** | **8 hrs** | |

**Deliverable**: `npx senars demo hybrid` works in terminal

---

### Sprint 2: Lab Foundation (Days 4-7)

**Goal**: Basic Lab UI with hybrid demo visualization

| Task | Hours | Dependency |
|------|-------|------------|
| `ui/server/ws/gateway.js` | 3 | None |
| `EventStream.js` (shared) | 2 | WebSocket |
| `TermView.js` (shared) | 2 | None |
| `TruthDisplay.js` (shared) | 1 | None |
| `ProofTree.js` (shared) | 4 | TermView |
| `LabRunner.js` | 4 | EventStream |
| `HybridDemo.js` | 4 | All shared |
| Lab layout + routing | 3 | HybridDemo |
| CLI `npx senars lab` | 2 | Lab UI |
| **Sprint 2 Total** | **25 hrs** | |

**Deliverable**: `npx senars lab` opens browser with hybrid demo

---

### Sprint 3: Lab Polish (Days 8-10)

**Goal**: Complete Lab experience with all visualizations

| Task | Hours | Dependency |
|------|-------|------------|
| `LiveTrace.js` | 4 | EventStream |
| `ScoreChart.js` | 4 | None |
| `DiscoveryLog.js` | 3 | LiveTrace |
| Demo config schema | 2 | LabRunner |
| P0 demo configs (A, C, E) | 4 | Schema |
| `npx senars lab demo <id>` | 2 | Demos |
| Achievements system | 3 | LabRunner |
| **Sprint 3 Total** | **22 hrs** | |

**Deliverable**: All P0 demos runnable in Lab with full visualization

---

### Sprint 4: NARL & Benchmarks (Days 11-14)

**Goal**: Publication-ready NARL benchmark

| Task | Hours | Dependency |
|------|-------|------------|
| Enhance Level 1-5 tests | 4 | None |
| Enhance Level 6-10 tests | 4 | None |
| LLM baseline runner | 4 | None |
| Report generator | 4 | Test results |
| Lab benchmark integration | 3 | LabRunner |
| `npx senars lab benchmark narl` | 2 | All above |
| **Sprint 4 Total** | **21 hrs** | |

**Deliverable**: NARL runs in Lab with comparison reports

---

### Sprint 5: IDE (Days 15-21)

**Goal**: Basic IDE for Narsese development

| Task | Hours | Dependency |
|------|-------|------------|
| `Editor.js` with syntax highlighting | 8 | None |
| `Console.js` REPL | 4 | EventStream |
| `BeliefBrowser.js` | 4 | TermView |
| `Timeline.js` | 4 | EventStream |
| IDE layout + panels | 4 | Components |
| `npx senars ide` | 2 | IDE UI |
| **Sprint 5 Total** | **26 hrs** | |

**Deliverable**: Basic IDE for interactive Narsese development

---

### Sprint 6: Expeditions (Days 22-28)

**Goal**: Autonomous long-running exploration

| Task | Hours | Dependency |
|------|-------|------------|
| Expedition runner | 6 | LabRunner |
| RLFP loop integration | 6 | Expedition runner |
| Checkpointing | 4 | Runner |
| Dashboard integration | 4 | Lab UI |
| `npx senars lab expedition` | 2 | All above |
| **Sprint 6 Total** | **22 hrs** | |

**Deliverable**: 24-hour autonomous expeditions with live dashboard

---

### Total Timeline

| Sprint | Duration | Cumulative |
|--------|----------|------------|
| 1: Killer Demo | 1 day | Day 1 |
| 2: Lab Foundation | 3 days | Day 4 |
| 3: Lab Polish | 3 days | Day 7 |
| 4: NARL | 4 days | Day 11 |
| 5: IDE | 7 days | Day 18 |
| 6: Expeditions | 7 days | Day 25 |

**Total**: ~25 working days (~5 weeks)

---

### Quick Start Path

For fastest time-to-value, focus on **Sprints 1-2**:

```bash
# Day 1-2: Terminal hybrid demo
node examples/hybrid-demo.js
# "Are penguins mammals?" → NAL reasoning → Explained answer

# Day 3-4: Lab visualization
npx senars lab
# Browser opens with full transparency
```

**Minimum viable demo**: 4 days

---

## Implementation Checklist

### Phase 0.4: Hybrid Demo — LM as Reasoning Rule
- [ ] `examples/demo-hybrid.js` — Main demo script
- [ ] Implement demo modes (translate, elaborate, analogize, explain, hybrid)
- [ ] Add CLI argument parsing (--mode, --input, --verbose)
- [ ] Colored console output with emojis
- [ ] Test all example scenarios

### Phase 0.5: Hybrid Demo
- [ ] `core/src/hybrid/HybridReasoner.js`
- [ ] `core/src/hybrid/prompts.js` (NL→Narsese, Result→Explanation)
- [ ] `examples/hybrid-demo.js`
- [ ] `ui/lab/demos/H_hybrid.json`

### Phase 1.1: Shared Components
- [ ] `ui/server/ws/gateway.js`
- [ ] `ui/src/components/shared/EventStream.js`
- [ ] `ui/src/components/shared/ProofTree.js`
- [ ] `ui/src/components/shared/TermView.js`
- [ ] `ui/src/components/shared/TruthDisplay.js`

### Phase 1.2: Lab Components
- [ ] `ui/src/components/lab/LabRunner.js`
- [ ] `ui/src/components/lab/HybridDemo.js`
- [ ] `ui/src/components/lab/LiveTrace.js`
- [ ] `ui/src/components/lab/ScoreChart.js`
- [ ] `ui/src/components/lab/DiscoveryLog.js`
- [ ] `ui/src/components/lab/Achievements.js`
- [ ] CLI: `npx senars lab`

### Phase 1.3: IDE Components
- [ ] `ui/src/components/ide/Editor.js`
- [ ] `ui/src/components/ide/Console.js`
- [ ] `ui/src/components/ide/BeliefBrowser.js`
- [ ] `ui/src/components/ide/Timeline.js`
- [ ] CLI: `npx senars ide`

### Phase 2: NARL Enhancement
- [ ] Enhanced tests (3+ per level)
- [ ] Edge case coverage
- [ ] `benchmarks/narl/llm_baseline.js`
- [ ] `benchmarks/narl/report_generator.js`
- [ ] Lab integration

### Phase 3: Demo Configs
- [ ] `ui/lab/demos/A_explainability.json`
- [ ] `ui/lab/demos/C_uncertainty.json`
- [ ] `ui/lab/demos/E_adversarial.json`
- [ ] Demo schema validation
- [ ] Remaining P1/P2 demos

### Phase 4: Expeditions
- [ ] Expedition runner class
- [ ] RLFP loop wrapper
- [ ] Checkpointing system
- [ ] Dashboard integration
- [ ] CLI: `npx senars lab expedition`

---

## Extension Points

### Custom Demos

Drop JSON files in `ui/lab/demos/`:

```json
{
    "id": "my_custom_demo",
    "name": "My Custom Demo",
    "steps": [ ... ]
}
```

### Custom Benchmarks

Add to `benchmarks/`:

```javascript
export class MyBenchmark {
    async run(brain) {
        // Return { score, description, details }
    }
}
```

### Plugins

IDE supports plugins via:

```javascript
// plugins/my-plugin.js
export default {
    name: 'my-plugin',
    components: { MyPanel },
    commands: { 'my-command': handler },
    hooks: { onDerivation: callback }
};
```

---

## Success Metrics

| Metric | Now | 30 Days | 90 Days |
|--------|-----|---------|---------|
| Demo works | ✅ | ✅ | ✅ |
| **Hybrid demo** | ❌ | ✅ 🎯 | ✅ |
| Lab deployed | ❌ | ✅ | ✅ |
| IDE deployed | ❌ | Partial | ✅ |
| NARL avg | ~80% | ≥85% | ≥95% |
| P0 demos | 0/4 | 4/4 | 4/4 |
| All demos | 0/12 | 6/12 | 12/12 |
| npm downloads | ? | 500 | 2000 |

---

## Summary

**Phase 0** ✅: Quick wins (demo, facade)

**Phase 0.4** 🔬: **Hybrid Demo — LM as Reasoning Rule**
- LM rules fire *inside* NAL reasoning, not externally
- Demo modes: translate, elaborate, analogize, explain, hybrid
- Colored console output with emojis
- ~7 hours to complete

**Phase 0.5** 🎯: **Hybrid NAL+LM Demo** — The killer demo
- Natural language in, reasoned answer out
- Transparent proof chains in Lab UI
- Offline Transformers.js integration
- ~12 hours to complete

**Phase 1**: IDE + Lab foundation
- Shared components enable everything
- Lab runner unifies all experiment types
- IDE provides development environment

**Phase 2**: NARL benchmark
- Scientific proof of capabilities
- LLM comparison baseline
- Auto-generated reports

**Phase 3**: Prototype demos
- 12 categories proving compound intelligence (including Hybrid)
- Config-driven, easy to extend
- Narrative-driven for communication

**Phase 4**: Autonomous expeditions
- Long-running exploration
- RLFP integration
- Discovery-focused

---

> *"The best code is code you can watch think."*

