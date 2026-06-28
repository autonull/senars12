# SeNARS RLFP: Control Plane & UI Automation Architecture

## 1. Executive Summary

This specification defines the **Control Plane Architecture** for SeNARS, transforming the system from a passive
reasoner into an observable, steerable, and trainable platform.

To enable **Reinforcement Learning from Preferences (RLFP)**, we decouple the reasoning engine from the observation
layer. We introduce a **Session-Based Architecture** where the immutable Long-Term Memory (LTM) is shared, but the
mutable Short-Term Memory (Focus/Attention) can be **forked** instantly. This allows for efficient A/B testing of
reasoning trajectories, "time travel" debugging, and high-speed automated training.

The UI is redefined not merely as a visualization tool, but as a **Training Cockpit** that interfaces with the core via
a standardized **Control Surface API**.

---

## 2. Architectural Pattern: The "Shared Memory, Forked Attention" Model

To achieve feature-complete flexibility without exploding memory usage, we isolate mutable state.

```mermaid
graph TD
    subgraph "Immutable Foundation"
        LTM[Long-Term Memory (Shared)]
        Terms[Term Dictionary]
    end

    subgraph "Control Plane"
        CS[ReasonerControlSurface]
    end

    subgraph "Session A (Baseline)"
        FA[Focus Instance A]
        PA[Policy Config A]
    end

    subgraph "Session B (Experimental)"
        FB[Focus Instance B]
        PB[Policy Config B]
    end

    CS -->|Manages| FA
    CS -->|Manages| FB
    FA -->|Reads/Writes| LTM
    FB -->|Reads/Writes| LTM
```

### 2.1 The `Focus` Class as Session Container

The `Focus` class is refactored to contain **all** mutable state required for a reasoning session:

1. **Attention Buffer:** The priority queue of tasks waiting for processing.
2. **Activation Map:** Transient activation levels for Concepts (distinct from LTM storage).
3. **Goal Stack:** The hierarchy of active goals and sub-goals.
4. **Policy Context:** The specific weights and heuristics active for this session.

**Forking Mechanism:**
`control.fork(sessionId)` creates a **Shallow Copy** of the `Focus` instance.

* **Terms/Tasks:** Shared by reference (Immutable).
* **Priority Queues:** Cloned (Mutable).
* **Policy:** Cloned (Mutable).
* **Cost:** O(N) where N is the size of the Focus buffer (very fast).

---

## 3. The Control Surface (`src/control/`)

The **Control Surface** is the single source of truth for interacting with the NAR. It mediates between the Engine, the
UI, and the Test Runner.

### 3.1 `ReasonerControlSurface` API

```typescript
interface ReasonerControlSurface extends BaseComponent {
  /**
   * Session Management
   */
  createSession(config?: Partial<SystemConfig>): string; // Returns sessionID
  forkSession(sourceSessionId: string): string;
  deleteSession(sessionId: string): void;
  
  /**
   * Execution Control
   * Operates on specific sessions or broadcasts to all.
   */
  step(sessionId: string, cycles?: number): Promise<void>;
  runUntilDecision(sessionId: string): Promise<DecisionContext>;
  pause(sessionId: string): void;
  
  /**
   * State Inspection
   * Returns a serializable snapshot for the View Layer.
   */
  captureFrame(sessionId: string): ReasoningFrame;
  
  /**
   * Policy Injection (The "Knobs")
   * Hot-swap parameters for RL exploration.
   */
  overridePolicy(sessionId: string, overrides: PolicyOverrides): void;
  
  /**
   * Intervention (The "Steering Wheel")
   * Force a specific action at a decision point.
   */
  injectDecision(sessionId: string, action: ReasoningAction): void;
}
```

---

## 4. The View Abstraction Layer (`src/view/`)

To support both a React UI and a Headless Test Runner, we abstract the internal state into a standardized **View Model
**.

### 4.1 `ReasoningFrame`

A complete, serializable snapshot of a single moment in a reasoning trajectory.

```typescript
type ReasoningFrame = {
  sessionId: string;
  timestamp: number;
  cycleIndex: number;
  
  // Observability: What is the system attending to?
  focusState: {
    tasks: Array<TaskView>; // Simplified Task objects
    concepts: Array<ConceptView>; // Active concepts
    metrics: { diversity: number, avgPriority: number };
  };

  // Decision Context: If paused at a decision point
  pendingDecision?: {
    id: string;
    type: 'SELECT_TASK' | 'APPLY_RULE' | 'LM_STRATEGY';
    options: Array<{
      id: string;
      label: string; // Human readable
      heuristicScore: number; // Default system preference
      rlScore?: number; // If RL model is active
    }>;
  };

  // Trajectory History: Recent events for context
  recentTrace: Array<TraceEvent>;
};
```

### 4.2 `ViewStateAdapter`

This component subscribes to the `EventBus` and the `ControlSurface`. It handles:

* **Throttling:** Emitting frames at 60fps (or on-demand) to prevent UI flooding.
* **Diffing:** Sending only deltas (changed priorities) to reduce bandwidth.
* **Serialization:** Converting circular references and internal IDs into safe JSON.

---

## 5. The Policy Arbiter (`src/reasoning/PolicyArbiter.js`)

This is the integration point where "How to Think" is decided. It sits inside the `Cycle` and consults the `Focus` (
Session) configuration to make decisions.

**Decision Flow:**

1. **Cycle** reaches a decision point (e.g., "Which Rule?").
2. **Cycle** calls `PolicyArbiter.resolve(context)`.
3. **PolicyArbiter** checks the Session Mode:
    * **Mode: HEURISTIC (Default):** Returns result of standard NAL math.
    * **Mode: RL_INFERENCE:** Queries the loaded `RLFPLearner` model for a probability distribution.
    * **Mode: INTERACTIVE:** Pauses the `ControlSurface`, emits a `pendingDecision` frame, and waits for
      `injectDecision()`.

---

## 6. The "Teaching Cockpit" UI (`ui/`)

The UI is a React application designed for **Comparative Feedback**.

### 6.1 The "Split-Brain" Comparator

A specialized view for RLFP data collection.

* **Left Panel (Session A):** Displays the reasoning trajectory of the Baseline Policy.
* **Right Panel (Session B):** Displays the reasoning trajectory of the Experimental Policy.
* **Center Controls:**
    * **Sync Scrubber:** A timeline slider that moves both sessions forward/backward in lockstep.
    * **Divergence Marker:** Visual indicator of exactly where the two sessions made different choices.
    * **Feedback Buttons:** `< Prefer Left`, `Equal`, `Prefer Right >`.

### 6.2 The "Intervention" Overlay

When a session is in `INTERACTIVE` mode:

1. The UI grays out.
2. The specific decision options (e.g., 3 candidate Tasks) highlight.
3. The user clicks a Task.
4. **Data Capture:** The system records `(Frame, UserSelection)` as a "Gold Standard" training example.

---

## 7. Automated Training Strategy (`src/testing/rlfp/`)

We use the `ControlSurface` to run **Headless Training Loops**. This enables massive scale data generation without human
clicking.

### 7.1 `HeadlessTeacher` Component

```javascript
/**
 * Automates the Training Loop:
 * 1. Setup Context
 * 2. Fork Sessions
 * 3. Apply Policies
 * 4. Evaluate Outcomes
 * 5. Update Learner
 */
class HeadlessTeacher {
  constructor(controlSurface, oracle) { ... }

  async runScenario(inputNarsese, goalNarsese) {
    // 1. Seed Memory
    const rootSession = this.control.createSession();
    await this.control.injectInput(rootSession, inputNarsese);

    // 2. Fork for A/B Testing
    const sessionA = this.control.forkSession(rootSession);
    const sessionB = this.control.forkSession(rootSession);

    // 3. Diverge Policies
    this.control.overridePolicy(sessionA, { lm_temperature: 0.1 }); // Conservative
    this.control.overridePolicy(sessionB, { lm_temperature: 0.9 }); // Creative

    // 4. Run to Completion
    await Promise.all([
      this.control.runUntilResult(sessionA, goalNarsese),
      this.control.runUntilResult(sessionB, goalNarsese)
    ]);

    // 5. Capture Trajectories
    const traceA = this.control.captureFrame(sessionA);
    const traceB = this.control.captureFrame(sessionB);

    // 6. Oracle Evaluation (Heuristic or LLM-Judge)
    const preference = await this.oracle.compare(traceA, traceB);

    // 7. Submit to RL Learner
    await this.learner.submit(traceA, traceB, preference);
  }
}
```

---

## 8. Implementation Roadmap

### Phase 1: The Foundation (Refactoring Focus)

1. Refactor `Focus.js` to include `clone()` method (Shallow copy of buffers).
2. Refactor `NAR.js` to accept a `Focus` instance in its constructor or via `setFocus()`.
3. Implement `ReasonerControlSurface` with basic `fork` and `step`.

### Phase 2: The View Layer

1. Define the `ReasoningFrame` TypeScript schema.
2. Implement `ViewStateAdapter` to serialize internal state.
3. Create a WebSocket server in `io/` that streams Frames.

### Phase 3: The Policy Arbiter

1. Inject `PolicyArbiter` hooks into `Cycle.js` and `RuleEngine.js`.
2. Implement `INTERACTIVE` mode (Pause-and-Wait logic).

### Phase 4: The UI & Automation

1. Build the React "Split-Brain" component.
2. Implement `HeadlessTeacher` and a basic `MetricOracle` (e.g., prefer shorter paths).

## 9. Feature Completeness Checklist

* **Mutable State Isolation:** ✅ Handled via `Focus` class forking.
* **Time Travel:** ✅ Achieved via `fork` (branching) and `snapshot` (serialization).
* **Intervention:** ✅ `PolicyArbiter` supports `INTERACTIVE` mode.
* **Headless Support:** ✅ `ControlSurface` is API-first, UI-agnostic.
* **RL Integration:** ✅ `ReasoningFrame` provides the Observation (O), `injectDecision` provides the Action (A).
* **Performance:** ✅ Shared LTM prevents memory explosion; View Layer throttles updates.

This specification provides a robust, flexible foundation for teaching SeNARS. It transforms the system from a "Black
Box" into a "Glass Box" that can be observed, paused, rewound, and steered by both humans and algorithms.

