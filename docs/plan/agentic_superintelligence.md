# Compound Intelligence Bootstrap

> **Objective**: Demonstrable, tangible **compound intelligence emergence** via validated benchmark performance on industry-standard agentic evaluations, using maximum-leverage interventions on existing SeNARS infrastructure.

---

## Executive Summary

This plan closes the self-improvement loop in SeNARS by connecting the existing RLFP infrastructure (trajectory logging, preference collection, policy adaptation) into an autonomous continuous learning cycle. The result is a system that:

1. **Learns to reason better over time** — Autonomous RLFP loop runs 10K+ cycles/day
2. **Proves the hybrid thesis** — Standard benchmarks demonstrate NAL+LM > either alone
3. **Enables external orchestration** — Any AI assistant can use SeNARS as a reasoning backend

> *"Compound intelligence is not a destination; it's a measurable trajectory through benchmark space."*

---

## Current State Analysis

### What Already Works (99.8% test pass rate)

| Component | Location | Status |
|-----------|----------|--------|
| Stream Reasoner | `core/src/reason/` | ✅ 100ms non-blocking cycle |
| Tensor.backward() | `core/src/functor/Tensor.js` | ✅ Autograd operational |
| MCP Server | `agent/src/mcp/Server.js` | ✅ 6 tools exposed |
| RLFP Learner | `agent/src/rlfp/RLFPLearner.js` | ✅ Writes training data |
| Trajectory Logger | `agent/src/rlfp/ReasoningTrajectoryLogger.js` | ✅ Records full traces |
| LM Integration | `agent/src/lm/LMIntegration.js` | ✅ NAL↔NL translation |
| ReasoningPolicyAdapter | `agent/src/rlfp/ReasoningPolicyAdapter.js` | ✅ Policy layer exists |

### Existing MCP Tools (Ready Now)

```javascript
// From Server.js - 6 tools already implemented
ping()                          // Health check
reason({premises, goal})        // Execute reasoning with 10 cycles
memory-query({query, limit})    // Query concepts
execute-tool({toolName, params})// Tool execution
get-focus({limit})              // View focus buffer
evaluate_js({code})             // Sandboxed JS execution
```

### Gap Analysis

| Gap | Severity | Effort to Close |
|-----|----------|-----------------|
| No standard benchmark harness | **CRITICAL** | ~200 lines |
| RLFP loop not autonomous | HIGH | ~80 lines |
| NAL↔Function Call translator | HIGH | ~80 lines |
| LLM evaluator wrapper missing | HIGH | ~60 lines |
| MCP lacks `teach` and `trace` tools | MEDIUM | ~50 lines |
| No epistemic stability test | MEDIUM | ~40 lines |

---

## The Four Leverage Points

### 1. Autonomous RLFP Loop

**Current State**: 
- `ReasoningTrajectoryLogger` records traces via event subscriptions
- `RLFPLearner.updateModel()` writes training data to JSONL
- `ReasoningPolicyAdapter` can consume preference models
- **Missing**: Orchestrator that runs continuously

**Implementation**:

```javascript
// agent/src/rlfp/autonomous_loop.js (~80 lines)
import { ReasoningTrajectoryLogger } from './ReasoningTrajectoryLogger.js';
import { RLFPLearner } from './RLFPLearner.js';
import { ReasoningPolicyAdapter } from './ReasoningPolicyAdapter.js';
import { LLMEvaluator } from './llm_evaluator.js';
import { generateRandomGoal, createPreferencePairs } from './synthetic_preference.js';
import { Logger } from '../../../core/src/util/Logger.js';

export async function runAutonomousLoop(nar, config = {}) {
    const logger = new ReasoningTrajectoryLogger(nar);
    const learner = new RLFPLearner(nar);
    const policyAdapter = new ReasoningPolicyAdapter(learner.model);
    const evaluator = new LLMEvaluator(config.llm || {});
    
    let cycleCount = 0;
    let running = true;
    
    // Graceful shutdown
    const shutdown = () => { running = false; };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    Logger.info(`Autonomous RLFP loop starting (batch=${config.batchSize || 10})`);
    
    while (running) {
        try {
            const traces = [];
            for (let i = 0; i < (config.batchSize || 10); i++) {
                logger.startTrajectory();
                const goal = generateRandomGoal(nar); // Sample from KB or templates
                await nar.input(goal);
                await nar.runCycles(config.cycles || 20);
                traces.push({ goal, trajectory: logger.endTrajectory() });
            }
            
            // Synthetic evaluation via LLM
            const scores = await evaluator.evaluateBatch(traces);
            
            // Alignment drift check (epistemic stability)
            const avgScore = scores.reduce((a, b) => a + b.total, 0) / scores.length;
            if (avgScore < (config.minScore || 5.0)) {
                Logger.warn(`Alignment drift detected (avg=${avgScore.toFixed(2)}). Pausing.`);
                break;
            }
            
            // Create preference pairs and update model
            const preferences = createPreferencePairs(traces, scores);
            if (preferences.length > 0) {
                learner.updateModel(preferences);
                // Feed updated preferences to policy adapter
                policyAdapter.updatePolicy(learner.model);
            }
            
            cycleCount += traces.length;
            if (cycleCount % 100 === 0) {
                Logger.info(`RLFP: ${cycleCount} cycles completed`);
            }
            
            await delay(config.intervalMs || 1000);
        } catch (error) {
            Logger.error(`RLFP loop error: ${error.message}`);
            await delay(5000); // Back off on error
        }
    }
    
    Logger.info(`Autonomous loop stopped after ${cycleCount} cycles`);
    return cycleCount;
}

const delay = ms => new Promise(r => setTimeout(r, ms));
```

**RLFP Layer Integration** (per README.vision.md):

| Layer | Component | Role in Loop |
|-------|-----------|--------------|
| Data | `ReasoningTrajectoryLogger` | Records reasoning episodes |
| Data | `LLMEvaluator` | Generates preference signals |
| Learning | `RLFPLearner` | Trains preference model |
| Policy | `ReasoningPolicyAdapter` | Guides FocusManager, RuleEngine decisions |

**Alternatives**:
- **Alternative A**: Use existing `PreferenceCollector` with human review (slower, higher quality)
- **Alternative B**: Pure constitutional evaluation without LLM (faster, less nuanced)
- **Recommended**: Hybrid — LLM-as-judge for fast iteration, human audit weekly

**Success Metric**: 10,000 cycles/day = 7 cycles/minute

**LLM Cost Budget**:

| Provider | Model | Cost/Eval | Daily Cost (10K cycles) |
|----------|-------|-----------|------------------------|
| Ollama (local) | llama3.2 | $0 | $0 |
| OpenAI | gpt-4o-mini | ~$0.001 | ~$10/day |
| Anthropic | claude-3-haiku | ~$0.0005 | ~$5/day |

**Recommendation**: Use Ollama locally for development, cloud models for weekly verification runs.

**Concerns & Mitigations**:

| Concern | Mitigation |
|---------|-----------|
| LLM API costs | Local Ollama default, cloud for verification |
| Rate limits | Batch evaluations, exponential backoff |
| Reward hacking | Novelty penalty in rubric, diverse goal sampling |
| Model drift | Constitutional invariants block unsafe beliefs |

---

### 1b. LLM Evaluator Wrapper

**Current State**: No unified LLM client for synthetic evaluation

**Implementation**:

```javascript
// agent/src/rlfp/llm_evaluator.js (~60 lines)
import { Logger } from '../../../core/src/util/Logger.js';

const RUBRIC = `Evaluate this reasoning trace on a scale of 1-10 for each criterion:
- Logic: Soundness of inference steps
- Efficiency: Minimal unnecessary steps  
- Novelty: Non-trivial conclusions derived
- Stability: Consistent with prior beliefs (epistemic anchoring)

Respond with ONLY valid JSON: {"logic": N, "efficiency": N, "novelty": N, "stability": N}`;

export class LLMEvaluator {
    constructor(config = {}) {
        this.provider = config.provider || 'ollama'; // 'ollama' | 'openai' | 'anthropic'
        this.model = config.model || 'llama3.2';
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.maxRetries = config.maxRetries || 3;
    }

    async evaluateBatch(traces) {
        const results = [];
        for (const trace of traces) {
            try {
                const score = await this._evaluate(trace);
                results.push(score);
            } catch (error) {
                Logger.warn(`Evaluation failed, using fallback: ${error.message}`);
                results.push(this._constitutionalFallback(trace));
            }
        }
        return results;
    }

    async _evaluate(trace, retries = 0) {
        const prompt = `${RUBRIC}\n\nTrace:\n${JSON.stringify(trace.trajectory, null, 2)}`;
        
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.model, prompt, stream: false })
        });
        
        if (!response.ok) {
            if (retries < this.maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
                return this._evaluate(trace, retries + 1);
            }
            throw new Error(`LLM API error: ${response.status}`);
        }
        
        const data = await response.json();
        const parsed = JSON.parse(data.response.match(/\{[^}]+\}/)?.[0] || '{}');
        return {
            logic: parsed.logic || 5,
            efficiency: parsed.efficiency || 5,
            novelty: parsed.novelty || 5,
            stability: parsed.stability || 5,
            total: (parsed.logic + parsed.efficiency + parsed.novelty + parsed.stability) / 4
        };
    }

    // Fallback when LLM unavailable: constitutional heuristics
    _constitutionalFallback(trace) {
        const steps = trace.trajectory?.length || 0;
        const hasContradiction = trace.trajectory?.some(s => 
            s.truthValue?.frequency < 0.1 && s.truthValue?.confidence > 0.8
        );
        return {
            logic: hasContradiction ? 3 : 6,
            efficiency: steps < 20 ? 7 : 4,
            novelty: 5,
            stability: hasContradiction ? 2 : 7,
            total: hasContradiction ? 4.25 : 6.25
        };
    }
}
```

---

### 1c. Goal Generation & Preference Pairing

**Implementation**:

```javascript
// agent/src/rlfp/synthetic_preference.js (~100 lines)
import { Logger } from '../../../core/src/util/Logger.js';

// Goal templates for diverse reasoning tasks
const GOAL_TEMPLATES = [
    // Inheritance chains
    { type: 'chain', template: '($A --> $B)?' },
    { type: 'chain', template: '($A --> $C)?' },
    // Similarity queries  
    { type: 'similarity', template: '($A <-> $B)?' },
    // Property inheritance
    { type: 'property', template: '(($A --> $B) ==> ($A --> $C))?' },
    // Goal achievement
    { type: 'goal', template: '($X --> achieved)!' },
];

const CONCEPT_POOL = ['cat', 'animal', 'mammal', 'living', 'thing', 'pet', 'furry'];

/**
 * Generate a random goal, optionally sampling from NAR's knowledge base.
 */
export function generateRandomGoal(nar = null) {
    // Try to sample from existing knowledge
    if (nar?.memory && Math.random() > 0.3) {
        const concepts = nar.memory.getConcepts?.() || [];
        if (concepts.length >= 2) {
            const [a, b] = sampleN(concepts, 2);
            return `(${a} --> ${b})?`;
        }
    }
    
    // Fall back to template-based generation
    const template = GOAL_TEMPLATES[Math.floor(Math.random() * GOAL_TEMPLATES.length)];
    const [a, b, c] = sampleN(CONCEPT_POOL, 3);
    
    return template.template
        .replace('$A', a)
        .replace('$B', b)
        .replace('$C', c)
        .replace('$X', a);
}

/**
 * Create preference pairs from traces and scores.
 * Uses Bradley-Terry model: pair traces with score difference > threshold.
 */
export function createPreferencePairs(traces, scores, minDiff = 1.5) {
    const pairs = [];
    const indexed = traces.map((t, i) => ({ trace: t, score: scores[i] }));
    
    // Sort by total score descending
    indexed.sort((a, b) => b.score.total - a.score.total);
    
    // Pair best with worst, second-best with second-worst, etc.
    const half = Math.floor(indexed.length / 2);
    for (let i = 0; i < half; i++) {
        const better = indexed[i];
        const worse = indexed[indexed.length - 1 - i];
        
        const diff = better.score.total - worse.score.total;
        if (diff >= minDiff) {
            pairs.push({
                trajectoryA: better.trace.trajectory,
                trajectoryB: worse.trace.trajectory,
                preference: 'A',
                scoreDiff: diff
            });
        }
    }
    
    Logger.debug(`Created ${pairs.length} preference pairs from ${traces.length} traces`);
    return pairs;
}

function sampleN(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}
```

---

### 2. NAL ↔ Function Call Translation Layer

**Critical Bridge**: This layer enables SeNARS to participate in function-calling benchmarks (BFCL) and tool-use evaluations.

**Design Philosophy**: SeNARS provides the *reasoning* about which function to call and why. The LM integration handles *surface form* translation.

```javascript
// agent/src/mcp/function_translator.js (~80 lines)
import { Logger } from '../../../core/src/util/Logger.js';

/**
 * Translates between Narsese goal/belief structures and JSON function calls.
 * 
 * Narsese representation:
 *   Goal: (call * (function_name * (arg1 * arg2)))!
 *   Result: <(result * value) --> (call * function_name)>.
 * 
 * JSON representation:
 *   {"function": "function_name", "args": {"arg1": v1, "arg2": v2}}
 */
export class FunctionTranslator {
    constructor(functionRegistry = {}) {
        // Map of function names to their Narsese templates
        this.registry = functionRegistry;
    }

    /**
     * Convert JSON function call to Narsese goal.
     * Example:
     *   Input:  {"function": "get_weather", "args": {"city": "NYC"}}
     *   Output: (call * (get_weather * (city * NYC)))!
     */
    jsonToNarsese(jsonCall) {
        const { function: fn, args = {} } = jsonCall;
        
        // Build argument structure
        const argPairs = Object.entries(args)
            .map(([k, v]) => `(${k} * ${this._escapeValue(v)})`)
            .join(' * ');
        
        const argStr = argPairs || 'nil';
        return `(call * (${fn} * ${argStr}))!`;
    }

    /**
     * Convert Narsese derivation to JSON function call.
     * Example:
     *   Input:  (call * (get_weather * (city * NYC))) {0.9, 0.85}
     *   Output: {"function": "get_weather", "args": {"city": "NYC"}, "confidence": 0.85}
     */
    narseseToJson(narsese) {
        // Parse: (call * (function * args))
        const match = narsese.match(/\(call \* \((\w+) \* (.+)\)\)/);
        if (!match) return null;
        
        const fn = match[1];
        const argsStr = match[2];
        
        // Parse confidence if present
        const truthMatch = narsese.match(/\{([\d.]+),\s*([\d.]+)\}/);
        const confidence = truthMatch ? parseFloat(truthMatch[2]) : 1.0;
        
        // Parse arguments
        const args = this._parseArgs(argsStr);
        
        return { function: fn, args, confidence };
    }

    /**
     * Parse BFCL test case format into SeNARS reasoning task.
     */
    parseBFCLTestCase(tc) {
        return {
            premises: tc.input,
            goal: this.jsonToNarsese({ function: tc.expected_action, args: {} }),
            expectedOutput: tc.expected_output
        };
    }

    _parseArgs(argsStr) {
        const args = {};
        const pairs = argsStr.match(/\((\w+) \* ([^)]+)\)/g) || [];
        for (const pair of pairs) {
            const [, key, value] = pair.match(/\((\w+) \* ([^)]+)\)/) || [];
            if (key) args[key] = value;
        }
        return args;
    }

    _escapeValue(v) {
        if (typeof v === 'string') return v.replace(/\s+/g, '_');
        return String(v);
    }
}
```

**Usage in Benchmark Harness**:

```javascript
// In BFCL harness
const translator = new FunctionTranslator();
const narseseGoal = translator.jsonToNarsese({
    function: "get_weather",
    args: { city: "NYC", unit: "celsius" }
});
// => "(call * (get_weather * (city * NYC) * (unit * celsius)))!"

await nar.input(narseseGoal);
const result = await nar.runCycles(20);
const jsonResult = translator.narseseToJson(result[0].term.toString());
// => {"function": "get_weather", "args": {"city": "NYC", "unit": "celsius"}, "confidence": 0.85}
```

---

### 3. Enhanced MCP Tool Exposure

**Current State**: 6 tools implemented, missing key agentic capabilities

**Implementation**:

```javascript
// Add to Server.js registerTools() (~50 lines)

this.server.tool(
    "teach",
    { belief: z.string().describe("Narsese belief to add") },
    async ({belief}) => {
        const safe = this.safety.validateInput(belief);
        await this.nar.input(safe);
        return { content: [{ type: "text", text: `Belief added: \`${safe}\`` }] };
    }
);

this.server.tool(
    "set-goal",
    { goal: z.string().describe("Narsese goal (ends with !)") },
    async ({goal}) => {
        const safe = this.safety.validateInput(goal);
        await this.nar.input(safe.endsWith('!') ? safe : safe + '!');
        return { content: [{ type: "text", text: `Goal set: \`${safe}\`` }] };
    }
);

this.server.tool(
    "get-trace",
    { limit: z.number().default(20).describe("Max steps to return") },
    async ({limit}) => {
        const trace = this.nar.trajectoryLogger?.trajectory?.slice(-limit) || [];
        return { content: [{ type: "text", 
            text: `### Reasoning Trace\n\`\`\`json\n${JSON.stringify(trace, null, 2)}\n\`\`\`` }]
        };
    }
);
```

**Result**: Any AI assistant (Claude, Cursor, Cline) can:
1. Teach SeNARS knowledge via `teach`
2. Set goals via `set-goal`
3. Reason via existing `reason`
4. Inspect reasoning via `get-trace`
5. Query memory via `memory-query`

**Tool Summary (9 total)**:

| Tool | Purpose | Category |
|------|---------|----------|
| `ping` | Health check | System |
| `reason` | Execute reasoning cycles | Core |
| `memory-query` | Query concept store | Core |
| `execute-tool` | External tool invocation | Agentic |
| `get-focus` | Inspect attention buffer | Debug |
| `evaluate_js` | Sandboxed JS execution | Agentic |
| `teach` | Add beliefs | Core |
| `set-goal` | Set goals | Core |
| `get-trace` | Retrieve reasoning trace | Debug |

---

### 4. Standard Benchmark Integration

**Rationale**: Scientific credibility requires demonstrating proficiency on **industry-standard benchmarks**, not custom tests.

**Benchmark Ladder** (ordered by difficulty):

| Level | Benchmark | Tasks | Baseline Target | Stretch Target | Timeline |
|-------|-----------|-------|-----------------|----------------|----------|
| 1 | BFCL Single-Turn | Simple function calls | ≥70% AST match | ≥85% | Week 1-2 |
| 2 | BFCL Multi-Turn (V3) | Stateful tool sequences | ≥60% | ≥75% | Week 2-3 |
| 3 | AgentBench (subset) | OS, DB, KG environments | ≥50% | ≥65% | Week 3-4 |
| 4 | GAIA Level 1 | Real-world multi-tool | Baseline only | ≥40% | Week 4+ |

> **Note**: Targets are intentionally conservative. The goal is to *measure first*, then improve. Beating LLM-only baselines on specific categories (multi-step reasoning, consistency) is more valuable than overall score.

**Implementation**:

```javascript
// tests/benchmarks/bfcl_harness.js (~120 lines)
import { NAR } from '../../core/src/nar/NAR.js';
import { Server } from '../../agent/src/mcp/Server.js';
import { FunctionTranslator } from '../../agent/src/mcp/function_translator.js';
import fs from 'fs';

/**
 * BFCL Benchmark Harness
 * Loads official BFCL test cases and evaluates SeNARS via MCP.
 */
export class BFCLHarness {
    constructor(config = {}) {
        this.nar = new NAR();
        this.server = new Server({ nar: this.nar });
        this.translator = new FunctionTranslator();
        this.dataPath = config.dataPath || './benchmarks/bfcl/';
    }

    async runSingleTurnSuite() {
        const testCases = JSON.parse(fs.readFileSync(
            `${this.dataPath}/simple_function_v4.json`, 'utf8'
        ));
        
        const results = { pass: 0, fail: 0, errors: [], details: [] };
        
        for (const tc of testCases) {
            try {
                // Convert to Narsese via translator
                const { premises, goal, expectedOutput } = this.translator.parseBFCLTestCase(tc);
                
                // Execute reasoning
                this.nar.reset();
                await this.nar.input(premises);
                await this.nar.input(goal);
                const derivations = await this.nar.runCycles(20);
                
                // Convert back to JSON
                const result = derivations.find(d => 
                    d.term.toString().includes('call')
                );
                const jsonResult = result ? 
                    this.translator.narseseToJson(result.term.toString()) : null;
                
                // AST comparison
                const match = this._compareAST(jsonResult, expectedOutput);
                match ? results.pass++ : results.fail++;
                
                results.details.push({
                    id: tc.id,
                    passed: match,
                    expected: expectedOutput,
                    actual: jsonResult
                });
            } catch (e) {
                results.errors.push({ id: tc.id, error: e.message });
            }
        }
        
        return {
            benchmark: 'BFCL-Single-Turn',
            score: (results.pass / (results.pass + results.fail) * 100).toFixed(1),
            ...results
        };
    }

    async runMultiTurnSuite() {
        const testCases = JSON.parse(fs.readFileSync(
            `${this.dataPath}/multi_turn_v4.json`, 'utf8'
        ));
        
        const results = { pass: 0, fail: 0, errors: [] };
        
        for (const conversation of testCases) {
            // Reset NAR state for each conversation (epistemic stability test)
            this.nar.reset();
            let conversationPassed = true;
            
            for (const turn of conversation.turns) {
                const { premises, goal, expectedOutput } = this.translator.parseBFCLTestCase(turn);
                
                await this.nar.input(premises);
                await this.nar.input(goal);
                const derivations = await this.nar.runCycles(20);
                
                const result = derivations.find(d => d.term.toString().includes('call'));
                const jsonResult = result ? 
                    this.translator.narseseToJson(result.term.toString()) : null;
                
                if (!this._compareAST(jsonResult, expectedOutput)) {
                    conversationPassed = false;
                    break;
                }
            }
            
            conversationPassed ? results.pass++ : results.fail++;
        }
        
        return {
            benchmark: 'BFCL-Multi-Turn',
            score: (results.pass / (results.pass + results.fail) * 100).toFixed(1),
            ...results
        };
    }

    _compareAST(actual, expected) {
        if (!actual || !expected) return false;
        // Simplified AST comparison - function name + arg keys match
        if (actual.function !== expected.function) return false;
        const actualKeys = Object.keys(actual.args || {}).sort();
        const expectedKeys = Object.keys(expected.args || {}).sort();
        return JSON.stringify(actualKeys) === JSON.stringify(expectedKeys);
    }
}
```

**Epistemic Stability Benchmark** (SeNARS-specific advantage):

```javascript
// tests/benchmarks/epistemic_stability.test.js (~50 lines)
describe('Epistemic Stability', () => {
    test('consistent answers under paraphrase', async () => {
        const nar = new NAR();
        
        // Establish belief
        await nar.input('(fire --> hot). {1.0, 0.9}');
        
        // Query in 5 different ways
        const queries = [
            '(fire --> hot)?',
            '($x --> hot)? // where $x=fire',
            '(fire --> $y)?',
            '((fire --> hot) ==> result)?',
            '((hot <-- fire) && true)?'
        ];
        
        const results = [];
        for (const q of queries) {
            await nar.input(q);
            const r = await nar.runCycles(10);
            results.push(r.some(t => 
                t.term.toString().includes('fire') && 
                t.term.toString().includes('hot') &&
                t.truthValue?.frequency > 0.8
            ));
        }
        
        // All queries should return consistent positive result
        const consistency = results.filter(Boolean).length / results.length;
        expect(consistency).toBeGreaterThan(0.8);
    });
    
    test('resists contradictory input', async () => {
        const nar = new NAR();
        
        // Strong initial belief
        await nar.input('(fire --> hot). {1.0, 0.95}');
        
        // Weak contradictory input
        await nar.input('(fire --> cold). {0.8, 0.3}');
        
        // Query after contradiction
        await nar.input('(fire --> hot)?');
        const result = await nar.runCycles(10);
        
        // Original belief should dominate (epistemic anchor)
        const belief = result.find(t => 
            t.term.toString().includes('fire --> hot')
        );
        expect(belief?.truthValue?.frequency).toBeGreaterThan(0.7);
    });
});
```

---

## Implementation Schedule

| Week | Phase | Actions | Deliverables | Pivot Criteria |
|------|-------|---------|--------------|----------------|
| **1** | **Baseline** | Setup harnesses, run initial benchmarks | Baseline scores for BFCL, harness working | If harness setup takes >3 days: simplify to single benchmark |
| | | Implement `function_translator.js` | NAL↔JSON translation working | |
| | | Add MCP tools (teach, set-goal, get-trace) | 9 tools available | |
| **2** | **RLFP** | Implement `autonomous_loop.js` | 10K cycles/day running | If BFCL <50%: prioritize translation layer fixes |
| | | Implement `llm_evaluator.js` | Synthetic evaluation working | |
| | | BFCL Multi-Turn evaluation | Score ≥60% | |
| **3** | **Scale** | AgentBench subset setup | Harness for OS/DB/KG | If Multi-Turn <50%: focus on stateful reasoning |
| | | Run autonomous loop for 7 days | 70K+ cycles completed | |
| | | Epistemic stability tests | SeNARS > LLM-only on consistency | |
| **4** | **Demonstrate** | GAIA Level 1 baseline | Initial scores | |
| | | Compile results | Scientific report draft | |
| | | Policy adapter integration | Measurable improvement from RLFP | |

> **Key Insight**: Week 1 focuses on *measurement infrastructure*. Knowing where we stand enables targeted improvement.

---

## Pivot Strategies

| Scenario | Indicator | Pivot Action |
|----------|-----------|--------------|
| Translation layer fails | BFCL <40% | Simplify to keyword matching, add LM-assisted translation |
| RLFP not improving | No score improvement over 7 days | Increase rubric diversity, add human-in-loop sampling |
| Epistemic drift | Constitutional fallback triggers >50% | Reduce batch size, increase human audit frequency |
| AgentBench too hard | OS/DB scores <30% | Focus on KG environment only (closer to NAL strengths) |

---

## File Structure

```
benchmarks/
├── bfcl/                       # BFCL test data (downloaded)
│   ├── simple_function_v4.json
│   └── multi_turn_v4.json
├── agentbench/                 # AgentBench subset
│   ├── os.json
│   ├── db.json
│   └── kg.json
└── gaia/                       # GAIA Level 1 (Week 4)

tests/benchmarks/
├── bfcl_harness.js             # NEW (~120 lines)
├── agentbench_harness.js       # NEW (~100 lines)
├── epistemic_stability.test.js # NEW (~50 lines)
└── run_benchmarks.js           # NEW (~50 lines) - CLI runner

agent/src/mcp/
├── Server.js                   # MODIFY (+50 lines)
├── function_translator.js      # NEW (~80 lines)
└── ...

agent/src/rlfp/
├── autonomous_loop.js          # NEW (~80 lines)
├── llm_evaluator.js            # NEW (~60 lines)
├── synthetic_preference.js     # NEW (~100 lines) 
├── PreferenceCollector.js      # EXISTING
├── RLFPLearner.js              # EXISTING
├── ReasoningPolicyAdapter.js   # EXISTING (integrate)
└── ReasoningTrajectoryLogger.js # EXISTING

tests/agentic/
├── level1.test.js              # NEW (~50 lines)
├── level2.test.js              # NEW (~50 lines)
└── level3.test.js              # NEW (~50 lines)
```

**Total New Code**: ~740 lines

---

## Dependencies

```json
// Required in package.json (most already present)
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",  // MCP Server (EXISTING)
    "zod": "^3.22.0"                          // Schema validation (EXISTING)
  },
  "devDependencies": {
    "jest": "^29.0.0"                         // Testing (EXISTING)
  }
}
```

**Optional (for production LLM evaluation)**:
- Ollama installed locally (free, recommended for dev)
- OpenAI API key (for verification runs)

---

## npm Scripts

```json
// Add to package.json "scripts"
{
  "bench:bfcl-single": "node tests/benchmarks/run_benchmarks.js bfcl-single",
  "bench:bfcl-multi": "node tests/benchmarks/run_benchmarks.js bfcl-multi",
  "bench:agentbench": "node tests/benchmarks/run_benchmarks.js agentbench",
  "bench:epistemic": "jest tests/benchmarks/epistemic_stability.test.js",
  "bench:all": "node tests/benchmarks/run_benchmarks.js all",
  "bench:setup": "./scripts/download_benchmarks.sh",
  "rlfp:autonomous": "node agent/src/rlfp/autonomous_loop.js",
  "test:agentic": "jest tests/agentic --verbose"
}
```

**Usage**:
```bash
# First-time setup: download benchmark datasets
npm run bench:setup

# Run BFCL Single-Turn (Week 1 baseline)
npm run bench:bfcl-single

# Run epistemic stability tests (SeNARS advantage)
npm run bench:epistemic

# Run all benchmarks with report
npm run bench:all

# Start autonomous learning loop
npm run rlfp:autonomous
```

---

## Success Metrics

| Metric | Week 1 | Week 2 | Week 3 | Week 4 |
|--------|--------|--------|--------|--------|
| **BFCL Single-Turn** | Baseline | ≥70% | ≥75% | ≥80% |
| **BFCL Multi-Turn** | — | ≥60% | ≥65% | ≥70% |
| **AgentBench (avg)** | — | — | ≥50% | ≥55% |
| **Epistemic Stability** | Baseline | ≥90% | ≥95% | ≥95% |
| **GAIA Level 1** | — | — | — | Baseline |
| **Autonomous cycles/day** | — | 10,000 | 25,000 | 50,000+ |
| **MCP tools available** | 9 | 9 | 9 | 9 |

> **Primary Success Indicators**:
> 1. Epistemic stability significantly higher than LLM-only (SeNARS's unique value)
> 2. Multi-turn scores improve over single-turn (stateful reasoning advantage)
> 3. Measurable improvement from RLFP over 4 weeks

---

## Safety Architecture

### Existing Safeguards
- `Safety.validateInput()` — PII scrubbing, injection prevention
- Circuit breakers in LM integration
- AIKR resource limits in Reasoner

### Additional Gates

| Gate | Trigger | Action |
|------|---------|--------|
| Alignment drift | LLM eval <50% on rubric | Pause loop, flag for review |
| Resource runaway | >1GB RAM or CPU >80% sustained | AIKR throttle kicks in |
| Self-mod regression | Test failure after code change | Rollback, log, alert |
| Prompt injection | Constitutional invariant violated | Hard stop, human review |

### Constitutional Invariants (from existing design)

```narsese
(human_safety --> priority_1)! {1.0, 1.0}
((self --> modification) --> (constrained_by * safety))! {1.0, 1.0}
```

These are **immutable beliefs** that cannot be overridden by inference. The `{1.0, 1.0}` truth value means absolute frequency and absolute confidence — the epistemic anchor.

---

## Self-Modification Scope

| Level | Capability | Status | Gate |
|-------|-----------|--------|------|
| 1 | Read-only code analysis | ✅ Safe | None |
| 2 | Narsese belief modification | ✅ Core | Constitutional invariants |
| 3 | Preference model updates | ✅ RLFP | Alignment drift check |
| 4 | Propose code changes | 🔄 Planned | Human review required |
| 5 | Autonomous code modification | ❌ Future | Test gate + human approval |

> **Principle**: SeNARS modifies *knowledge* autonomously. It *proposes* code modifications for human review.

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|-----------|
| LLM Provider? | Local Ollama (llama3.2) for dev, cloud for verification |
| Cycle Rate? | 10K/day achievable (7/min with batching) |
| Self-Modification Scope? | Knowledge: autonomous. Code: human-gated. |
| Benchmark Adoption? | Standard benchmarks first (BFCL), SeNARS-specific (epistemic) second |

---

## References

| Resource | Purpose |
|----------|---------|
| [BFCL Leaderboard](https://berkeleyfunction.ai/) | Function-calling benchmarks |
| [AgentBench](https://github.com/THUDM/AgentBench) | Multi-environment agent eval |
| [GAIA](https://huggingface.co/datasets/gaia-benchmark) | Real-world assistant tasks |
| [MCP Spec](https://modelcontextprotocol.io/) | AI assistant integration |
| [README.vision.md](README.vision.md) | SeNARS cognitive architecture |
| [agent/src/rlfp/README.md](agent/src/rlfp/README.md) | RLFP implementation details |

---

## Why This Approach Works

1. **Minimal New Code** — ~740 lines vs. thousands
2. **Maximum Reuse** — All core components exist and are tested
3. **Observable Progress** — Benchmark scores provide external verification
4. **Safe by Design** — Constitutional invariants + circuit breakers + human gates
5. **Incremental Value** — Each week delivers measurable capability
6. **Compound Intelligence** — RLFP loop enables genuine self-improvement
7. **Unique Advantage** — Epistemic stability is SeNARS's differentiator vs pure LLMs

> *"Compound intelligence is not about matching LLMs on their terms. It's about demonstrating capabilities they structurally cannot achieve: consistency, epistemic stability, and self-improving reasoning."*
