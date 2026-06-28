# EVOLVE: Evolutionary Learning via Optimized Reasoning and Validation Engine

> **Mission**: Transform SeNARS reasoning rules into a self-improving system through supervisor-guided optimization, RLFP principles, and SENI-inspired observation.

---

## Executive Summary

EVOLVE generalizes `ruminate.js` into a comprehensive **reasoning rule optimization system**. A supervisor LLM evaluates rule configurations, examines outputs, and proposes improvements—creating a continuous loop where reasoning gets better over time.

**Core Capabilities:**
1. **Supervisor-Guided Optimization** — LLM evaluates and proposes rule changes via tool-use
2. **Multi-Model Architecture** — Separate models for supervision (powerful) and reasoning (fast/small)
3. **Rule Versioning** — Git-based tracking of rule configurations and experiment histories
4. **RLFP Integration** — Preference-based learning from reasoning trajectory comparisons
5. **SENI Dashboard** — Real-time observatory for monitoring experiments and discoveries

---

## Purpose and Ultimate Potential

### Why EVOLVE?

Current LM rules in SeNARS have static prompts that may be suboptimal. Manual tuning is slow and doesn't scale. EVOLVE automates this:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         THE EVOLVE LOOP                              │
│                                                                       │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐   │
│   │  Rules   │────▶│  Execute │────▶│ Evaluate │────▶│  Evolve  │   │
│   │ v1.0     │     │ Reasoning│     │ Outputs  │     │  Rules   │   │
│   └──────────┘     └──────────┘     └──────────┘     └────┬─────┘   │
│        ▲                                                   │         │
│        └───────────────────────────────────────────────────┘         │
│                           Rules v1.1                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Ultimate Potential

| Capability | Description |
|------------|-------------|
| **Self-Improving Reasoning** | Rules that get better without human intervention |
| **Domain Adaptation** | Auto-tune rules for specific problem domains |
| **Emergent Strategies** | Discover novel reasoning patterns through exploration |
| **Compound Intelligence** | Measurable trajectory through benchmark space |

---

## Architecture

### Multi-Model Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EVOLVE ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌───────────────────────────────────────────────────────────────┐ │
│   │                    SUPERVISOR LAYER                            │ │
│   │  Model: GPT-4o / Claude-3.5 / Llama-70B (powerful, slow)      │ │
│   │  Role: Evaluate traces, propose rule changes, guide search    │ │
│   │                                                                 │ │
│   │  Tools: analyze_trace, propose_mutation, score_comparison,    │ │
│   │         get_rule_config, set_rule_config, run_experiment      │ │
│   └───────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│   ┌───────────────────────────────────────────────────────────────┐ │
│   │                    REASONING LAYER                             │ │
│   │  Model: Granite-micro / Phi-3 / Qwen-2.5-1B (fast, cheap)     │ │
│   │  Role: Execute NAL+LM rules, generate traces                  │ │
│   │                                                                 │ │
│   │  Components: NAR, LM Rules, Focus Manager, Rule Engine        │ │
│   └───────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│   ┌───────────────────────────────────────────────────────────────┐ │
│   │                    EVALUATION LAYER                            │ │
│   │  Metrics: Logic, Efficiency, Novelty, Stability               │ │
│   │  Benchmarks: BFCL, AgentBench, Epistemic Stability            │ │
│   │                                                                 │ │
│   │  Storage: Trajectory logs, experiment history, leaderboards   │ │
│   └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Supervisor Tool Interface

The supervisor LLM controls optimization through structured tool calls:

```javascript
// Supervisor tools for rule optimization
const SUPERVISOR_TOOLS = [
    {
        name: "analyze_trace",
        description: "Analyze a reasoning trace for quality and patterns",
        parameters: { traceId: "string", depth: "shallow|deep" }
    },
    {
        name: "get_rule_config",
        description: "Get current configuration for a rule",
        parameters: { ruleId: "string" }
    },
    {
        name: "propose_mutation",
        description: "Propose a change to a rule configuration",
        parameters: {
            ruleId: "string",
            mutation: { field: "string", oldValue: "any", newValue: "any" },
            rationale: "string"
        }
    },
    {
        name: "run_experiment",
        description: "Run a controlled experiment comparing rule versions",
        parameters: {
            name: "string",
            baselineConfig: "object",
            variantConfig: "object",
            testCases: "number",
            metrics: ["logic", "efficiency", "novelty", "stability"]
        }
    },
    {
        name: "apply_mutation",
        description: "Apply a tested mutation to the active rule set",
        parameters: { mutationId: "string", requiresApproval: "boolean" }
    }
];
```

---

## Application Entry-Points

### 1. CLI: `evolve` Command

```bash
# Start an optimization session
npm run evolve -- --supervisor ollama:llama3.2 --reasoner ollama:granite-micro

# Run with specific focus
npm run evolve -- --focus "LMHypothesisGenerationRule" --epochs 100

# Multi-iteration optimization (silent during runs)
npm run evolve -- --mode multi-iter --iterations 1000 --report-interval 100

# Single-step analysis mode
npm run evolve -- --mode single-step --trace-id abc123 --verbose
```

### 2. Programmatic API

```javascript
import { Evolver } from './evolve/Evolver.js';

const evolver = new Evolver({
    supervisor: { provider: 'openai', model: 'gpt-4o-mini' },
    reasoner: { provider: 'ollama', model: 'granite-4.0-micro' },
    rules: ['hypothesis-generation', 'goal-decomposition', 'narsese-translation'],
    rlfpEnabled: true,
    seniFeedback: true
});

await evolver.initialize();

// Run optimization session
const results = await evolver.optimize({
    epochs: 50,
    testCases: 100,
    targetMetric: 'logic',
    minImprovement: 0.05
});

console.log(`Improvement: ${results.improvement}%`);
console.log(`Best config: ${JSON.stringify(results.bestConfig)}`);
```

### 3. SENI Dashboard Integration

The EVOLVE system integrates with the SENI observatory dashboard:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  E V O L V E   D A S H B O A R D                           [🔴 LIVE] Epoch 47 ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  ┌─ RULE PERFORMANCE ───────────────────────────────────────────────────────┐  ║
║  │  hypothesis-generation  ████████████████████░░░░  78.2% (+4.1↑)          │  ║
║  │  goal-decomposition     ██████████████████████░░  82.4% (+1.8↑)          │  ║
║  │  narsese-translation    ████████████████████████  91.3% (OPTIMAL)        │  ║
║  │  concept-elaboration    ██████████████████░░░░░░  68.5% (MUTATING...)    │  ║
║  └──────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                 ║
║  ┌─ ACTIVE EXPERIMENT ──────┐  ┌─ MUTATION QUEUE ────────────────────────┐    ║
║  │  🧬 "Prompt Refinement"  │  │  #1 temp 0.8→0.6 (concept-elaboration)  │    ║
║  │  Epoch: 47/100           │  │  #2 max_tokens 200→300 (hypothesis)     │    ║
║  │  Mutations tested: 12    │  │  #3 prompt rewrite (goal-decomposition) │    ║
║  │  Improvements: 4         │  │  [+ 5 pending human approval]           │    ║
║  └──────────────────────────┘  └─────────────────────────────────────────┘    ║
║                                                                                 ║
║  ┌─ SUPERVISOR REASONING ────────────────────────────────────────────────────┐ ║
║  │  💭 "The hypothesis rule's temperature of 0.8 produces too much          │ ║
║  │      variation. Testing 0.6 to improve consistency while maintaining     │ ║
║  │      creativity. Previous experiments show sweet spot around 0.65."      │ ║
║  └───────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
║  [🎯 New Experiment] [📊 History] [🔧 Rules] [⚙️ Config] [👤 Approve Queue]   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Core Optimization Enhancements

### Rule Versioning and Experiment Tracking

```javascript
// evolve/RuleVersioner.js
export class RuleVersioner {
    constructor(repoPath = '.evolve/rules') {
        this.repoPath = repoPath;
        this.git = simpleGit(repoPath);
    }

    async saveVersion(ruleId, config, metadata) {
        const version = {
            timestamp: Date.now(),
            ruleId,
            config,
            metadata, // experiment results, supervisor rationale
            parent: await this.getCurrentVersion(ruleId)
        };
        
        const path = `${this.repoPath}/${ruleId}.json`;
        await fs.writeFile(path, JSON.stringify(version, null, 2));
        
        await this.git.add(path);
        await this.git.commit(`[${ruleId}] ${metadata.summary || 'Update'}`);
        
        // Auto-tag milestones
        if (metadata.improvement > 0.1) {
            await this.git.addTag(`milestone-${ruleId}-${Date.now()}`);
        }
        
        return version;
    }

    async getHistory(ruleId, limit = 50) {
        const log = await this.git.log({ file: `${ruleId}.json`, maxCount: limit });
        return log.all;
    }

    async rollback(ruleId, commitHash) {
        await this.git.checkout(commitHash, [`${ruleId}.json`]);
        return this.loadVersion(ruleId);
    }
}
```

### Human-in-the-Loop Oversight

```javascript
// evolve/ApprovalGate.js
export class ApprovalGate {
    constructor(config = {}) {
        this.mode = config.mode || 'auto'; // 'auto' | 'approve-major' | 'approve-all'
        this.majorThreshold = config.majorThreshold || 0.1; // 10% change = major
        this.pendingApprovals = [];
    }

    async evaluate(mutation) {
        const magnitude = this.calculateMagnitude(mutation);
        
        if (this.mode === 'auto' && magnitude < this.majorThreshold) {
            return { approved: true, auto: true };
        }
        
        // Queue for human review
        const approval = {
            id: crypto.randomUUID(),
            mutation,
            magnitude,
            requestedAt: Date.now(),
            status: 'pending'
        };
        
        this.pendingApprovals.push(approval);
        this.emitApprovalRequest(approval);
        
        return { approved: false, approvalId: approval.id };
    }

    // Dashboard UI for approval
    getComparisonView(approvalId) {
        const approval = this.pendingApprovals.find(a => a.id === approvalId);
        return {
            before: approval.mutation.oldValue,
            after: approval.mutation.newValue,
            rationale: approval.mutation.rationale,
            simulatedImpact: approval.mutation.simulatedScores
        };
    }
}
```

### Advanced Exploration Strategies

```javascript
// evolve/strategies/index.js

// 1. Genetic Programming for rule mutation/crossover
export class GeneticStrategy {
    constructor(config) {
        this.populationSize = config.populationSize || 20;
        this.mutationRate = config.mutationRate || 0.1;
        this.crossoverRate = config.crossoverRate || 0.3;
    }

    evolvePopulation(population, fitness) {
        // Tournament selection
        const selected = this.tournamentSelect(population, fitness);
        
        // Crossover
        const offspring = this.crossover(selected);
        
        // Mutation
        return offspring.map(ind => 
            Math.random() < this.mutationRate ? this.mutate(ind) : ind
        );
    }

    mutate(individual) {
        // Mutate prompt, temperature, max_tokens, etc.
        const mutableFields = ['temperature', 'max_tokens', 'prompt', 'priority'];
        const field = mutableFields[Math.floor(Math.random() * mutableFields.length)];
        
        return { ...individual, [field]: this.mutateField(field, individual[field]) };
    }
}

// 2. Bayesian Optimization for hyperparameters
export class BayesianStrategy {
    constructor(config) {
        this.bounds = config.bounds || {
            temperature: [0.1, 1.0],
            max_tokens: [50, 500],
            priority: [0.1, 1.0]
        };
        this.observations = [];
    }

    suggestNext() {
        // Use Gaussian Process to model the objective function
        // Maximize Expected Improvement
        return this.maximizeAcquisition();
    }

    observe(params, score) {
        this.observations.push({ params, score });
    }
}

// 3. Diversity Maintenance
export class DiversityMaintainer {
    constructor(config) {
        this.minDiversity = config.minDiversity || 0.3;
        this.archive = [];
    }

    shouldAddToArchive(individual, fitness) {
        // Novelty search: add if sufficiently different from archive
        const novelty = this.calculateNovelty(individual);
        return novelty > this.minDiversity || fitness > this.getArchiveBest();
    }

    calculateNovelty(individual) {
        if (this.archive.length === 0) return 1.0;
        
        const distances = this.archive.map(a => this.distance(individual, a));
        const kNearest = distances.sort((a, b) => a - b).slice(0, 5);
        return kNearest.reduce((a, b) => a + b, 0) / kNearest.length;
    }
}
```

---

## Integration with Existing Rules

### Current LM Rules (Starting Point)

| Rule | File | Prompt Quality | Priority |
|------|------|---------------|----------|
| `hypothesis-generation` | `LMHypothesisGenerationRule.js` | Basic | High |
| `goal-decomposition` | `LMGoalDecompositionRule.js` | Good | High |
| `narsese-translation` | `LMNarseseTranslationRule.js` | Minimal | Critical |
| `concept-elaboration` | `LMConceptElaborationRule.js` | Basic | Medium |
| `belief-revision` | `LMBeliefRevisionRule.js` | Basic | Medium |
| `explanation-generation` | `LMExplanationGenerationRule.js` | Good | Low |

### Bidirectional NAL↔LM Conversion

```javascript
// evolve/NALLMBridge.js
export class NALLMBridge {
    constructor(parser, termFactory) {
        this.parser = parser;
        this.termFactory = termFactory;
    }

    // NAL → Natural Language (for LM context)
    narseseToNL(narsese) {
        const templates = {
            '-->': (s, p) => `${s} is a type of ${p}`,
            '<->': (s, p) => `${s} is similar to ${p}`,
            '==>': (s, p) => `if ${s} then ${p}`,
            '&&': (s, p) => `${s} and ${p}`,
            '||': (s, p) => `${s} or ${p}`
        };
        // Parse and translate recursively
        return this.translate(narsese, templates);
    }

    // Natural Language → NAL (from LM output)
    nlToNarsese(text) {
        // Use LM to translate, then validate with parser
        const prompt = `Convert to Narsese: "${text}"
Examples:
"cats are animals" => <cat --> animal>.
"birds can fly" => <bird --> [fly]>.`;
        
        return this.validateNarsese(result);
    }
}
```

### Output Filters

```javascript
// evolve/filters/index.js
export const OutputFilters = {
    // Remove markdown formatting
    stripMarkdown: (text) => text.replace(/[*_`#]/g, ''),
    
    // Extract first sentence
    firstSentence: (text) => text.split(/[.!?]/)[0] + '.',
    
    // Parse JSON safely
    parseJSON: (text) => {
        const match = text.match(/\{[^}]+\}/);
        return match ? JSON.parse(match[0]) : null;
    },
    
    // Validate Narsese syntax
    validateNarsese: (text, parser) => {
        try { return parser.parse(text) ? text : null; }
        catch { return null; }
    },
    
    // Length limit
    truncate: (maxLen) => (text) => text.slice(0, maxLen),
    
    // Chain filters
    chain: (...filters) => (text) => 
        filters.reduce((t, f) => t && f(t), text)
};

// Usage in rule config
const ruleConfig = {
    outputFilter: OutputFilters.chain(
        OutputFilters.stripMarkdown,
        OutputFilters.firstSentence,
        OutputFilters.truncate(200)
    )
};
```

---

## RLFP Integration

### Connecting to Existing RLFP Components

```javascript
// evolve/RLFPIntegration.js
import { ReasoningTrajectoryLogger } from '../agent/src/rlfp/ReasoningTrajectoryLogger.js';
import { RLFPLearner } from '../agent/src/rlfp/RLFPLearner.js';

export class EvolveRLFP {
    constructor(evolver) {
        this.evolver = evolver;
        this.logger = new ReasoningTrajectoryLogger(evolver.nar);
        this.learner = new RLFPLearner(evolver.nar);
    }

    async collectTrajectoryPair(goal, configA, configB) {
        // Run with config A
        this.evolver.applyConfig(configA);
        this.logger.startTrajectory();
        await this.evolver.nar.input(goal);
        await this.evolver.nar.runCycles(20);
        const trajectoryA = this.logger.endTrajectory();

        // Run with config B
        this.evolver.applyConfig(configB);
        this.logger.startTrajectory();
        await this.evolver.nar.reset();
        await this.evolver.nar.input(goal);
        await this.evolver.nar.runCycles(20);
        const trajectoryB = this.logger.endTrajectory();

        return { trajectoryA, trajectoryB, goal };
    }

    async evaluateAndLearn(pairs) {
        // Use supervisor to evaluate pairs
        const preferences = await this.evolver.supervisor.evaluatePairs(pairs);
        
        // Update RLFP model
        this.learner.updateModel(preferences);
        
        return preferences;
    }
}
```

---

## SENI Principles Applied

### Intelligence Emergence Equation for Rules

```
R(t) = N × f_a × f_i × f_s × L

Where:
  N   = Number of rule applications per time unit
  f_a = Fraction producing valid outputs (accuracy)
  f_i = Fraction improving over baseline (improvement rate)
  f_s = Fraction maintaining epistemic stability
  L   = Lifetime of improvement trajectory
  
  R(t) = "Rule optimization signal strength"
```

### Discovery Detection for Rules

```javascript
// Flag when a rule mutation produces significantly better results
class RuleDiscoveryDetector {
    async evaluate(mutation, experiment) {
        const isDiscovery = 
            experiment.improvement > 0.15 ||  // >15% improvement
            experiment.novelPatterns > 3 ||   // New reasoning patterns
            experiment.stabilityGain > 0.1;   // Epistemic improvement
        
        if (isDiscovery) {
            return {
                type: 'rule_discovery',
                mutation,
                why: this.explainDiscovery(mutation, experiment),
                score: experiment.overallScore
            };
        }
        return null;
    }
}
```

---

## Logging and Debugging

### Depth Control System

```javascript
// evolve/LogController.js
export const LogLevel = {
    SILENT: 0,      // Multi-iteration: only final results
    SUMMARY: 1,     // Per-epoch summaries
    NORMAL: 2,      // Key events (mutations, improvements)
    VERBOSE: 3,     // All reasoning steps
    TRACE: 4        // Full LM prompts/responses
};

export class LogController {
    constructor(level = LogLevel.NORMAL) {
        this.level = level;
        this.buffer = [];
    }

    setForMode(mode) {
        this.level = mode === 'multi-iter' ? LogLevel.SILENT : LogLevel.VERBOSE;
    }

    log(level, category, message, data = {}) {
        if (level <= this.level) {
            const entry = { timestamp: Date.now(), level, category, message, data };
            this.buffer.push(entry);
            
            if (this.level >= LogLevel.NORMAL) {
                console.log(this.format(entry));
            }
        }
    }

    // Structured tracing for post-mortem analysis
    captureReasoningChain(trace) {
        return {
            steps: trace.map(s => ({
                type: s.type,
                content: s.type === 'lm_response' ? s.content.slice(0, 100) : s,
                timestamp: s.timestamp
            })),
            supervisorRationale: trace.supervisorNotes,
            probabilisticSamples: this.sampleIntermediateStates(trace)
        };
    }
}
```

---

## Datasets and Training Sources

### Recommended Datasets

| Dataset | Source | Purpose | Adaptation |
|---------|--------|---------|------------|
| **BFCL** | Berkeley | Function calling | Test NAL→JSON translation |
| **AgentBench** | THUDM | Multi-environment | Knowledge graph reasoning focus |
| **CommonsenseQA** | HuggingFace | Commonsense | Convert to Narsese assertions |
| **ARC Challenge** | AI2 | Science reasoning | Test inference chains |
| **LogiQA** | HuggingFace | Logical reasoning | Direct Narsese mapping |
| **Wason Selection** | Custom | Rule-based logic | NAL syllogism validation |

### Dataset Adapters

```javascript
// evolve/datasets/adapters.js
export const DatasetAdapters = {
    huggingface: async (datasetName, split = 'test') => {
        // One-click import from HuggingFace
        const response = await fetch(
            `https://datasets-server.huggingface.co/rows?dataset=${datasetName}&split=${split}`
        );
        return response.json();
    },
    
    bfcl: (testCase) => ({
        input: testCase.user_query,
        expectedNarsese: `(call * (${testCase.function} * ...))!`,
        expectedOutput: testCase.expected_output
    }),
    
    commonsenseqa: (item) => ({
        premises: item.question.choices.map(c => 
            `(${c.label} --> possible_answer).`
        ),
        goal: `(correct_answer --> ?x)?`,
        expected: item.answerKey
    })
};
```

---

## File Structure

```
evolve/
├── Evolver.js                    # Main orchestrator
├── Supervisor.js                 # LLM supervisor with tool interface
├── RuleVersioner.js              # Git-based versioning
├── ApprovalGate.js               # Human-in-the-loop oversight
├── LogController.js              # Logging depth control
├── NALLMBridge.js                # Bidirectional NAL↔LM conversion
├── RLFPIntegration.js            # Connect to existing RLFP
│
├── strategies/
│   ├── GeneticStrategy.js        # Evolutionary algorithms
│   ├── BayesianStrategy.js       # Bayesian optimization
│   └── DiversityMaintainer.js    # Novelty search
│
├── filters/
│   └── index.js                  # Output filter chains
│
├── datasets/
│   ├── adapters.js               # Dataset import adapters
│   └── generators.js             # Synthetic test case generation
│
├── dashboard/
│   ├── EvolvePanel.js            # SENI dashboard integration
│   ├── MutationQueue.js          # Approval queue UI
│   └── ExperimentHistory.js      # Version history viewer
│
└── cli/
    └── evolve.js                 # CLI entry point

.evolve/                          # Data directory
├── rules/                        # Versioned rule configs (git repo)
├── experiments/                  # Experiment logs
├── discoveries/                  # Flagged improvements
└── checkpoints/                  # Model checkpoints
```

---

## Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **1. Foundation** | Week 1 | `Evolver.js`, `Supervisor.js` with basic tools, `LogController.js` |
| **2. Versioning** | Week 2 | `RuleVersioner.js`, git integration, rollback support |
| **3. Strategies** | Week 3 | Genetic, Bayesian, diversity strategies |
| **4. Dashboard** | Week 4 | SENI integration, approval queue, experiment viewer |
| **5. RLFP** | Week 5 | Full RLFP integration, trajectory comparison UI |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start Ollama with supervisor and reasoner models
ollama pull llama3.2      # Supervisor
ollama pull granite-micro # Reasoner

# Run first optimization session
npm run evolve -- --epochs 10 --verbose

# View dashboard
npm run seni:start
# Navigate to Evolve tab
```

---

## References

- [ruminate.js](file:///home/me/senars11/examples/ruminate.js) — Starting point
- [seni.md](file:///home/me/senars11/seni.md) — SENI observatory principles
- [agentic_superintelligence.md](file:///home/me/senars11/agentic_superintelligence.md) — Autonomous loop design
- [README.vision.md](file:///home/me/senars11/README.vision.md) — RLFP architecture vision
- [LM Rules](file:///home/me/senars11/core/src/reason/rules/lm) — Current rule implementations
- [RLFP Components](file:///home/me/senars11/agent/src/rlfp) — Existing RLFP infrastructure
