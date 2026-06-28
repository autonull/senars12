# RESEARCH.md — SeNARS Research Agenda

> **For Academic Researchers, R&D Teams, and Innovation Labs**
>
> A structured research agenda exploiting the full potential of hybrid neuro-symbolic reasoning.

---

## Executive Summary

SeNARS (Semantic Non-Axiomatic Reasoning System) is a unique research platform positioned at the intersection of **formal logic**, **neural language models**, and **cognitive architecture**. It offers fertile ground for publishable research, novel product development, and competitive advantage in AI applications requiring:

- **Consistency** that LLMs cannot guarantee
- **Memory** that persists beyond context windows  
- **Explainability** via derivation traces
- **Uncertainty quantification** via truth values

This document outlines **research directions**, **experimental protocols**, and **exploitation strategies** for both academic and commercial contexts.

---

## Research Landscape: Where SeNARS Creates Value

```
                         ┌─────────────────────────────────────┐
                         │     EXPLAINABLE & CONSISTENT        │
                         │         (High Research Value)       │
                         │                                     │
                         │            ★ SeNARS                 │
                         │         (hybrid reasoning)          │
                         │                                     │
        ┌────────────────┼────────────────────────────────────┼────────────────┐
        │                │                                     │                │
 RIGID  │  Expert        │                                     │    Neural-     │  ADAPTIVE
SYSTEMS │  Systems       │                                     │    Symbolic    │  SYSTEMS
        │  (Cyc, etc.)   │                                     │    (emerging)  │
        │                │                                     │                │
        └────────────────┼────────────────────────────────────┼────────────────┘
                         │                                     │
                         │    Rule Engines      LLMs           │
                         │    (Drools)          (GPT, Claude)  │
                         │                                     │
                         └─────────────────────────────────────┘
                               BLACK BOX & INCONSISTENT
                                (Commercial Value)
```

**SeNARS occupies a research gap** — systems that are both adaptive AND explainable remain rare.

---

## Part I: Academic Research Agenda

### Track A: Theoretical Foundations

#### A1. Non-Axiomatic Logic Under Neural Enhancement

**Research Question**: How do LM-generated beliefs interact with NAL truth revision?

**Methodology**:
1. Inject LM-derived beliefs with calibrated confidence
2. Measure truth value stability under revision
3. Compare convergence properties to pure NAL

**Key Files**: `core/src/lm/`, `core/src/Truth.js`, `agent/src/rlfp/`

**Publication Venues**: IJCAI, AAAI, AGI Conference

**Experiments**:
```javascript
// Experiment: LM Belief Integration Dynamics
const brain = new NAR({ lm: { enabled: true } });
brain.input('(bird --> animal).');           // High confidence baseline
brain.input('(penguin --> bird).');          // Known fact

// LM generates: "(penguin --> flightless). %0.9;0.6%" 
// Track: How does this propagate through inheritance chains?
// Measure: Truth value drift over N reasoning cycles
```

---

#### A2. AIKR-Compliant Resource-Bounded Reasoning

**Research Question**: Optimal resource allocation under the Assumption of Insufficient Knowledge and Resources.

**Methodology**:
1. Vary `cpuThrottleInterval`, `maxDerivationDepth`, `memory.capacity`
2. Measure answer quality vs. computational budget
3. Derive Pareto frontiers for different task types

**Key Files**: `README.resources.md`, `core/src/nar/SystemConfig.js`

**Publication Venues**: IJCAI (Resource-Bounded Reasoning track), AAMAS

---

#### A3. Tensor Logic Integration

**Research Question**: When does differentiable reasoning outperform symbolic NAL?

SeNARS implements Tensor Logic (Domingos, 2025) enabling gradient-based learning of logical rules.

**Methodology**:
1. Create benchmark suite of reasoning tasks
2. Compare pure NAL, pure Tensor, and hybrid approaches
3. Identify task characteristics favoring each modality

**Key Files**: `core/src/functor/Tensor.js`, `core/src/functor/README.md`

**Publication Venues**: NeurIPS, ICML, ICLR

---

### Track B: Cognitive Architecture Research

#### B1. RLFP (Reinforcement Learning from Preferences)

**Research Question**: Can human preference feedback improve meta-reasoning?

SeNARS includes infrastructure for teaching the system *how* to think.

**Methodology**:
1. Collect reasoning trajectory annotations (`ReasoningTrajectoryLogger`)
2. Train preference models on path comparisons (`RLFPLearner`)
3. Measure improved task performance after RLFP training

**Key Files**: `agent/src/rlfp/`, `README.vision.md`

**Publication Venues**: AAAI, NeurIPS (RLHF workshop), HRI

**Experimental Setup**:
```javascript
// RLFP Experiment Protocol
import { ReasoningTrajectoryLogger, PreferenceCollector, RLFPLearner } from './agent/src/rlfp';

// 1. Collect reasoning traces
const logger = new ReasoningTrajectoryLogger(nar);
logger.startRecording();
// ... run reasoning tasks ...
const trajectories = logger.getTrajectories();

// 2. Collect preferences
const collector = new PreferenceCollector();
collector.presentPairwise(trajectories[i], trajectories[j], userFeedback);

// 3. Train preference model
const learner = new RLFPLearner();
learner.train(collector.getPreferences());

// 4. Integrate into policy
nar.setReasoningPolicy(learner.getPolicy());
```

---

#### B2. Dual Memory Architecture

**Research Question**: Optimal consolidation strategies for focus/long-term memory.

**Methodology**:
1. Vary consolidation parameters (`focus.size`, `diversityFactor`, `promotionThreshold`)
2. Track knowledge retention and retrieval accuracy
3. Compare to psychological models (Atkinson-Shiffrin, Baddeley)

**Key Files**: `core/src/memory/Focus.js`, `core/src/memory/MemoryConsolidation.js`

**Publication Venues**: Topics in Cognitive Science, Cognitive Systems Research

---

#### B3. Goal-Driven Behavior

**Research Question**: How does the Belief-Goal distinction enable autonomous agency?

**Methodology**:
1. Define goal hierarchies with varying urgency/importance
2. Measure goal achievement rate under resource constraints
3. Compare to BDI architectures and utility-maximizing agents

**Key Files**: `core/src/reason/strategy/GoalDrivenStrategy.js`, `README.vision.md`

**Publication Venues**: AAMAS, AGI, ATAL

---

### Track C: Applied Research

#### C1. LLM Grounding & Consistency

**Research Question**: Can SeNARS eliminate LLM contradictions in multi-turn conversations?

**Methodology**:
1. Create contradiction-inducing prompt sequences
2. Compare standalone LLM vs. SeNARS-grounded LLM
3. Measure contradiction rate, answer stability

**Key Files**: `core/src/lm/LM.js`, `core/src/lm/NarseseTranslator.js`

**Publication Venues**: ACL, EMNLP, EACL

**Benchmark Script**:
```javascript
// Consistency Benchmark
const scenarios = [
  { context: 'legal', prompts: [...] },
  { context: 'medical', prompts: [...] }
];

for (const scenario of scenarios) {
  const llmResponses = await runLLMOnly(scenario.prompts);
  const senarResponses = await runWithSeNARS(scenario.prompts);
  
  console.log('LLM contradictions:', countContradictions(llmResponses));
  console.log('SeNARS contradictions:', countContradictions(senarResponses));
}
```

---

#### C2. Explainable AI in High-Stakes Domains

**Research Question**: Does derivation-trace explainability satisfy regulatory requirements?

**Domains**: Healthcare (FDA), Finance (GDPR Art. 22), Legal (AI Act)

**Methodology**:
1. Map SeNARS derivation traces to regulatory explainability requirements
2. Conduct user studies with domain experts
3. Measure explanation satisfaction and trust calibration

**Key Files**: `core/src/Stamp.js`, trace export utilities

**Publication Venues**: FAccT, AIES, domain-specific journals

---

#### C3. Knowledge Discovery & Reasoning

**Research Question**: What implicit knowledge can SeNARS discover from explicit statements?

**Methodology**:
1. Input domain knowledge (medical, legal, scientific)
2. Query for derived implications
3. Validate discoveries with domain experts

**Experiment**:
```javascript
// Knowledge Discovery Experiment
brain.learn('(aspirin --> antiplatelet).');
brain.learn('(antiplatelet --> bloodThinner).');
brain.learn('(bloodThinner --> bleedingRisk).');
brain.learn('(surgery --> bleedingRisk_concern).');

// What does SeNARS discover?
const insights = brain.query('(aspirin --> ?consequence)?');
// Expected: Derives aspirin --> bleedingRisk with reasoning trace
```

---

## Part II: Business & Industry Exploitation

### Application Domain Matrix

| Domain | SeNARS Advantage | Target Market | Revenue Model |
|--------|-----------------|---------------|---------------|
| **Legal Tech** | Explainable precedent reasoning | Law firms, courts | SaaS, licensing |
| **Healthcare AI** | Consistent diagnostic support | Hospitals, EMR vendors | Enterprise licensing |
| **Finance/Compliance** | Auditable decision-making | Banks, regulators | Enterprise + consulting |
| **Education** | Observable reasoning pedagogy | EdTech, universities | Platform licensing |
| **Industrial IoT** | Consistent sensor fusion | Manufacturing, energy | Embedded licensing |
| **Autonomous Systems** | Goal-driven planning | Robotics, drones | Licensing + integration |

---

### B1. Enterprise Integration Patterns

#### Pattern 1: LLM Enhancement Layer

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   User      │─────→│   SeNARS    │─────→│    LLM      │
│   Query     │      │  (Grounding)│      │  (Response) │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                     ┌──────┴──────┐
                     │  Persistent │
                     │   Memory    │
                     └─────────────┘
```

**Value Proposition**: Consistent, memory-persistent LLM applications.

**Integration**:
```javascript
// LangChain Tool Integration
import { SeNARSTool } from 'senars/adapters/langchain';

const tools = [
  new SeNARSTool({
    name: 'reason',
    description: 'Query persistent knowledge base with logical reasoning'
  })
];

const agent = new Agent({ tools });
```

---

#### Pattern 2: Decision Audit Trail

Every SeNARS derivation includes a complete evidence chain:

```javascript
const result = await brain.ask('(recommend_treatment --> ?for_patient_X)?');

console.log(result.proof);
// [
//   { step: 1, premise: '(symptoms --> condition_Y)', source: 'input' },
//   { step: 2, rule: 'deduction', derived: '(patient_X --> has_condition_Y)' },
//   { step: 3, premise: '(condition_Y --> treatment_Z)', source: 'kb' },
//   { step: 4, conclusion: '(recommend_treatment --> treatment_Z)', confidence: 0.87 }
// ]
```

**Regulatory Value**: GDPR Article 22, FDA 21 CFR Part 11, EU AI Act compliance.

---

#### Pattern 3: Knowledge Portability

```yaml
# enterprise-knowledge.sbook
name: Corporate Policy Engine
version: 2.1.0
domain: hr-policy
statements:
  - "(remote_work --> allowed). %1.0;0.95%"
  - "(overtime --> requires_approval). %1.0;0.90%"
  - "(expense_limit --> 500_usd). %1.0;0.99%"
dependencies:
  - base-legal-compliance.sbook
```

**Business Value**: Portable, versioned, auditable organizational knowledge.

---

### B2. Competitive Positioning

| Competitor | Weakness SeNARS Addresses |
|------------|---------------------------|
| **Pure LLMs (GPT, Claude)** | No persistence, contradictions, no proof |
| **Rule Engines (Drools, CLIPS)** | No learning, no uncertainty handling |
| **Knowledge Graphs (Neo4j)** | No autonomous inference, no goals |
| **Expert Systems (legacy)** | Brittleness, maintenance burden |

**SeNARS Defensible Advantages**:
1. **Hybrid reasoning** — NAL + LM + Tensor Logic
2. **Built-in RLFP** — Learns *how* to reason better
3. **Open substrate** — Fork and customize freely
4. **AIKR compliance** — Works with bounded resources

---

### B3. IP & Commercialization Strategy

**Open Core Model**:

| Component | License | Revenue Opportunity |
|-----------|---------|---------------------|
| SeNARS Core | Open Source (MIT/Apache) | Community adoption |
| Enterprise Connectors | Commercial | Licensing fees |
| Cloud Deployment | Hosted | SaaS subscriptions |
| Support & Training | Services | Consulting revenue |
| Certified Knowledge Packs | Curated | Content licensing |

**Academic Licensing**: Free for research with citation requirements.

---

## Part III: Experimental Protocols

### Protocol 1: Benchmark Suite

**Name**: SeNARS-Bench

**Tasks**:
1. **Consistency** — Answer stability across reformulations
2. **Memory** — Knowledge retention across sessions
3. **Explainability** — Derivation trace quality
4. **Speed** — Inference latency under load
5. **Discovery** — Novel derivation rate

**Execution**:
```bash
npm run benchmark          # Full suite
npm run benchmark:consistency
npm run benchmark:memory
npm run benchmark:speed
```

---

### Protocol 2: User Studies

**Study A: Explainability Satisfaction**
- Population: Domain experts (N=30+)
- Task: Evaluate SeNARS explanations vs. LLM explanations
- Measures: Satisfaction (Likert), trust calibration, task completion

**Study B: Learning Effectiveness**
- Population: Students (N=50+)  
- Task: Learn reasoning concepts with/without SeNARS visualization
- Measures: Concept retention, transfer to new problems

**Study C: RLFP Annotation Quality**
- Population: MTurk/Prolific (N=100+)
- Task: Pairwise preference judgments on reasoning traces
- Measures: Inter-annotator agreement, policy improvement

---

### Protocol 3: Ablation Studies

**Variables**:
- LM enabled/disabled
- RLFP trained/untrained
- Tensor Logic enabled/disabled
- Strategy: Bag / Prolog / Goal-Driven / Analogical

**Metrics**:
- Answer accuracy
- Reasoning depth
- Computational cost
- Explanation quality

**Execution**:
```javascript
const strategies = ['BagStrategy', 'PrologStrategy', 'GoalDrivenStrategy'];
const configs = [
  { lm: false, rlfp: false, tensor: false },  // Pure NAL baseline
  { lm: true, rlfp: false, tensor: false },   // +LM
  { lm: true, rlfp: true, tensor: false },    // +RLFP
  { lm: true, rlfp: true, tensor: true }      // Full system
];

for (const strategy of strategies) {
  for (const config of configs) {
    const results = await runBenchmark({ strategy, ...config });
    record(results);
  }
}
```

---

## Part IV: Resources & Getting Started

### For Researchers

1. **Read**: `README.intro.md` → `README.architecture.md` → `README.core.md`
2. **Run**: `npm test` (verify 99.8% pass rate)
3. **Explore**: `node repl/src/Repl.js` (interactive experimentation)
4. **Trace**: Use `reasoner.on('derivation', ...)` to capture reasoning
5. **Publish**: Cite as per citation format below

### For R&D Teams

1. **Integrate**: Start with `core/src/SeNARS.js` facade (when available)
2. **Connect**: Use MCP server for AI assistant integration
3. **Monitor**: WebSocket monitor for real-time visualization
4. **Scale**: Review `README.resources.md` for resource tuning
5. **Customize**: Fork and extend for domain-specific needs

### Citation

```bibtex
@software{senars2024,
  title = {SeNARS: Semantic Non-Axiomatic Reasoning System},
  year = {2024},
  url = {https://github.com/automenta/senars11},
  note = {Hybrid neuro-symbolic reasoning platform}
}
```

---

## Part V: Roadmap for Research Exploitation

### Year 1: Foundation

| Quarter | Academic Focus | Business Focus |
|---------|----------------|----------------|
| Q1 | Establish benchmark suite, submit first paper | Pilot with 2-3 design partners |
| Q2 | RLFP user study | Enterprise connector development |
| Q3 | Tensor Logic comparison study | First SaaS beta |
| Q4 | Workshop at AGI/AAAI | Commercial launch |

### Year 2: Expansion

| Quarter | Academic Focus | Business Focus |
|---------|----------------|----------------|
| Q1 | Multi-domain transfer study | Vertical solution (legal/medical) |
| Q2 | Cognitive architecture comparison | Certification partnership |
| Q3 | Distributed reasoning | Enterprise scaling |
| Q4 | Comprehensive survey paper | Market expansion |

---

## Appendix A: Key Files Reference

| Research Area | Key Files |
|---------------|-----------|
| Core Reasoning | `core/src/nar/NAR.js`, `core/src/reason/` |
| Truth & Logic | `core/src/Truth.js`, `core/src/Stamp.js` |
| Memory | `core/src/memory/Memory.js`, `core/src/memory/Focus.js` |
| LM Integration | `core/src/lm/LM.js`, `core/src/lm/NarseseTranslator.js` |
| RLFP | `agent/src/rlfp/` |
| Tensor Logic | `core/src/functor/Tensor.js` |
| Strategies | `core/src/reason/strategy/` |
| MCP Server | `agent/src/mcp/` |
| Benchmarks | `benchmarks/` |
| Tests | `tests/` |

---

## Appendix B: Publication Target Summary

| Venue | Type | Deadline | SeNARS Topics |
|-------|------|----------|---------------|
| IJCAI | Conference | Jan | Resource-bounded reasoning, NAL theory |
| AAAI | Conference | Sep | RLFP, cognitive architecture |
| NeurIPS | Conference | May | Tensor Logic, neural-symbolic |
| ACL | Conference | Jan | LLM grounding, consistency |
| AGI | Conference | Various | Full system, philosophy |
| FAccT | Conference | Jan | Explainability, fairness |
| AAMAS | Conference | Oct | Goal-driven agents, multi-agent |

---

> **The unique opportunity**: SeNARS is one of few systems offering hybrid reasoning with explainability, consistency, AND adaptability. The research space is open. The applications are underexplored. Move fast.
