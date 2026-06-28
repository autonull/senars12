# TODO.now — Immediate Impact Plan

> **Philosophy**: Stop building infrastructure. Start generating intelligence.  
> **Horizon**: Days, not months. Results, not roadmaps.

---

## The Radical Insight

SeNARS is over-engineered for emergence. The README describes a sophisticated cognitive architecture with pipelines,
layers, strategies, consolidation mechanisms, and federated engines—all waiting for "intelligence to emerge."

**But emergence doesn't need infrastructure. It needs iteration.**

The single most valuable thing SeNARS can do *right now* is **run reasoning loops faster and expose them to humans/LLMs
for feedback**. Everything else is premature optimization.

---

## Immediate Actions (This Week)

### 1. ⚡ Strip to Core Loop (Day 1)

**Delete complexity. Keep the heartbeat.**

The entire value of SeNARS fits in ~500 lines:

- **Term** (immutable knowledge atoms)
- **Task** (what to think about)
- **Truth** (how confident)
- **A rule that fires** (deduction, abduction—pick one)
- **A loop that runs it**

Everything else—Memory consolidation, Focus sets, Bag strategies, Layer systems, Event buses, Circuit breakers—is
infrastructure for a problem you don't have yet.

**Action**: Create `src/core.minimal.js`—a single file containing the complete reasoning loop. No dependencies except
Node.js. If it can't reason in 100 lines, question whether the abstractions are helping.

```javascript
// Target API (5 lines to cognition):
const nar = createNAR();
nar.input("(bird --> animal).");
nar.input("(robin --> bird).");
nar.input("(robin --> animal)?");
console.log(nar.step()); // [{ term: "(robin --> animal)", truth: {...} }]
```

---

### 2. 🔄 LLM-in-the-Loop (Day 1-2)

**The LLM doesn't enhance reasoning. The LLM IS the reasoning.**

Stop treating LLMs as "enhancers" of symbolic reasoning via async rules and circuit breakers. Modern LLMs (GPT-4o,
Claude 3.5, Gemini 2.0) are better at:

- Parsing natural language into logical forms
- Evaluating plausibility of inferences
- Selecting which rule to apply next
- Explaining reasoning to humans

**Action**: Create `src/llm-reasoner.js`—where the LLM is the `Strategy`:

```javascript
async function step(beliefs, question) {
  const prompt = `
Given beliefs: ${beliefs.map(b => b.narsese).join(", ")}
Question: ${question}
What is the most logical inference? Respond with Narsese.`;
  
  const inference = await llm.complete(prompt);
  return parseNarsese(inference);
}
```

This inverts the architecture: **NAL becomes the type system for LLM outputs**, not the other way around. The LLM
generates candidate inferences; NAL validates their logical structure.

---

### 3. 🌊 Streaming First (Day 2)

**Thought is a stream, not a request-response.**

The architecture describes "Stream Reasoner" but the API is still `step()` and `input()`. Real cognitive systems are
continuous.

**Action**: Expose reasoning as an async iterator:

```javascript
async function* reason(initialBeliefs) {
  let state = { beliefs: initialBeliefs, goals: [] };
  while (true) {
    const inference = await nextInference(state);
    yield inference; // Caller decides when to stop
    state = applyInference(state, inference);
  }
}

// Usage
for await (const thought of reason([...])) {
  console.log(thought);
  if (thought.answers(myQuestion)) break;
}
```

This enables:

- **Real-time UI** (React/Svelte can bind directly to the stream)
- **Human-in-the-loop** (inject beliefs mid-reasoning)
- **LLM collaboration** (LLM and NAL reason in parallel streams, merge results)

---

### 4. 🧬 Self-Modifying Beliefs (Day 3)

**The system should learn from every interaction.**

Every time a human or LLM evaluates an inference, that's training data. The README mentions RLFP but it's complex.
Simpler:

**Action**: Create `src/learning.js`:

```javascript
function learn(inference, feedback) {
  // "feedback" is just: { accepted: true/false }
  const currentTruth = inference.truth;
  const adjustment = feedback.accepted ? 0.1 : -0.2;
  
  // Revise confidence on the RULE that produced this inference
  await rules[inference.sourceRule].adjustConfidence(adjustment);
}
```

This is **meta-learning**: the system learns which of its own reasoning patterns work. No neural networks, no complex
training—just truth value revision applied to rules instead of beliefs.

---

### 5. 📡 MCP Native (Day 3-4)

**SeNARS should be a tool that LLMs already know how to use.**

The Model Context Protocol (MCP) is the emerging standard for LLM-tool interaction. SeNARS should be an MCP server, not
a standalone application.

**Action**: Create `src/mcp-server.js`:

```javascript
export const tools = [
  {
    name: "assert_belief",
    description: "Add a belief to the knowledge base",
    parameters: { belief: "string in Narsese format" },
    execute: (params) => nar.input(params.belief)
  },
  {
    name: "ask_question", 
    description: "Query the knowledge base",
    parameters: { question: "string in Narsese format" },
    execute: (params) => nar.query(params.question)
  },
  {
    name: "reason_step",
    description: "Perform one reasoning step, returns new inferences",
    parameters: {},
    execute: () => nar.step()
  }
];
```

Now Claude, GPT-4, or any MCP-compatible agent can use SeNARS as a **persistent reasoning memory**. The LLM provides the
natural language interface; SeNARS provides the logical backbone.

---

## Technology Leverage (No Extra Effort)

### Use What Exists

| Need          | Don't Build                 | Use This                             |
|---------------|-----------------------------|--------------------------------------|
| Parsing       | Custom Narsese parser       | PEG.js or tree-sitter (10 min setup) |
| Persistence   | Custom Memory/Consolidation | SQLite + JSON columns (5 min setup)  |
| Embeddings    | EmbeddingLayer              | OpenAI Embeddings API (2 lines)      |
| UI            | Custom TUI/Web UI           | Gradio (Python) or Vercel AI SDK     |
| Visualization | Custom graph layouts        | Observable Plot or D3.js             |
| Distribution  | Custom node protocol        | NATS or Redis Streams                |

---

## What This Enables

### Day 7 Demo

A working system where:

1. **Human** types: "Birds can fly. Penguins are birds. Can penguins fly?"
2. **LLM** translates to Narsese, feeds to SeNARS
3. **SeNARS** runs 3 reasoning steps, produces `(penguin --> fly) {0.9, 0.4}`
4. **LLM** explains: "Most likely yes, but with low confidence because no direct evidence"
5. **Human** says: "Actually, penguins can't fly"
6. **System** updates belief, learns to lower confidence on inheritance for fly relations
7. **Next query** about ostriches gets lower initial confidence

**This is compound intelligence.** Not through infrastructure, but through iteration.

---

## Anti-Patterns to Avoid

| Trap                        | Why It Feels Productive | Why It's Not                          |
|-----------------------------|-------------------------|---------------------------------------|
| "Optimize the Bag sampler"  | Engineering challenge   | Nobody uses it yet                    |
| "Add more NAL rules"        | Completeness feels good | 3 rules cover 80% of reasoning        |
| "Build visualization"       | Demo-able               | Visualization of nothing is nothing   |
| "Implement RLFP framework"  | Sounds advanced         | Simpler feedback loops work first     |
| "Add distributed reasoning" | Scale feels necessary   | You have 0 users, scale is irrelevant |

---

## Success Metrics

**Not**: Lines of code, test coverage, component modularity  
**Yes**:

- [ ] Can I get an answer in < 100ms?
- [ ] Can an LLM use SeNARS without custom integration?
- [ ] Does a reasoning session produce useful output in 5 minutes?
- [ ] Did a human learn something from watching the reasoning?
- [ ] Did the system improve from that interaction?

---

## The Meta-Insight

The README describes SeNARS as "substrate for a future industrial ecosystem." But substrate is meaningless without life.

**This plan focuses on life**: the reasoning loop, the learning loop, the human-AI collaboration loop.

Infrastructure follows life. Life doesn't follow infrastructure.

---

## Immediate Next Actions

1. [ ] Run existing tests to understand current baseline
2. [ ] Create `src/core.minimal.js` with stripped reasoning loop
3. [ ] Create `src/llm-reasoner.js` with LLM-as-strategy
4. [ ] Create `src/mcp-server.js` for MCP protocol exposure
5. [ ] Demo end-to-end Q&A in < 1 second

---

*"The best architectures are discovered, not designed."*  
*Start with the simplest thing that could possibly work. Observe what's missing. Add only that.*
