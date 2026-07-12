# SeNARS — Unified Cognitive Architecture Plan (Supersedes NEXT.agent3.md)

> **Status**: Pivot from "vertical slice with real NAR" to **single unified cognitive agent** that seamlessly blends NAR + MeTTa reasoning. User never chooses engine; system routes by intent/capability.

---

## North Star (the seamless thing)

**One command:** `pnpm senars` (or `pnpm demo:unified`) boots a single cognitive agent.  
**One graph:** Nodes from NAR beliefs and MeTTa atoms coexist, color-coded only for debugging.  
**One chat:** User types; the agent *reasons* with the best engine for each turn — NAR for inheritance/abduction, MeTTa for pattern matching/skills, both for hybrid — and replies in natural language.  
**One config:** Single `senars.config.json` with no `engine` field.  
**One lens picker:** Lenses auto-filter to what the active subgraph supports.  
**Zero cognitive burden:** User thinks "I'm talking to an intelligent agent." Engine is an implementation detail.

---

## Core Unification Principles

| Principle | Old Way | New Way |
|-----------|---------|---------|
| **Entry point** | `startWebUI(nar)` or `startWebUI(metta)` | `startUnifiedAgent(config)` |
| **User mental model** | "NAR agent" / "MeTTa agent" | "My cognitive agent" |
| **Routing** | Manual (user picks) | Automatic (intent → capability match) |
| **Graph** | Separate projections | Single unified graph, engine-tagged nodes |
| **Chat** | Per-engine chat handlers | Single chat → coordinator → best engine |
| **Config** | Engine-specific schemas | Unified schema, engine-specific sections optional |
| **Lenses** | Per-engine registry | Unified registry, capability-gated |
| **Bootstrap** | Separate belief/atom lists | Single declarative knowledge seed |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNIFIED AGENT                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  COGNITIVE COORDINATOR                      │  │
│  │  • Intent classification (LLM or rule-based)               │  │
│  │  • Capability registry (what each engine can do)           │  │
│  │  • Route: single engine, parallel, or sequential pipeline  │  │
│  │  • Fuse results → unified CognitiveEvent stream            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│        ┌───────────────────┼───────────────────┐               │
│        ▼                   ▼                   ▼               │
│  ┌──────────┐        ┌──────────┐        ┌──────────┐        │
│  │   NAR    │        │  MeTTa   │        │  FUTURE  │        │
│  │  Engine  │        │  Engine  │        │ Engines  │        │
│  │          │        │          │        │          │        │
│  │ • Belief │        │ • Atom   │        │ • ...    │        │
│  │ • Drive  │        │ • Skill  │        │          │        │
│  │ • Goal   │        │ • LTM    │        │          │        │
│  │ • RLLP   │        │ • Query  │        │          │        │
│  └──────────┘        └──────────┘        └──────────┘        │
│        │                   │                   │               │
│        └───────────────────┼───────────────────┘               │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              UNIFIED GRAPH PROJECTION                       │  │
│  │  Single graph: nodes = { id, type, engine, ...data }      │  │
│  │  Lenses: score(all nodes) → filter → style → delta        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    UI LAYER (unchanged)                     │  │
│  │  graph-viewport, node-detail-drawer, lens-controller, chat │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pillar 1 — Cognitive Coordinator (The Brain)

### 1.1 Capability Registry (Single Source of Truth)

```typescript
// core/src/UnifiedCapabilities.ts
export interface EngineCapability {
  engine: 'nar' | 'metta' | string;
  supports: {
    // Reasoning modes
    inheritance: boolean;      // NAR: <A --> B>
    similarity: boolean;       // NAR: <A <-> B>, MeTTa: pattern match
    abduction: boolean;        // NAR: backward inference
    deduction: boolean;        // NAR: forward inference
    patternMatch: boolean;     // MeTTa: (match ...)
    rewrite: boolean;          // MeTTa: (rewrite ...)
    skillExecution: boolean;   // MeTTa: (skill ...)
    query: boolean;            // Both: ask questions
    // Memory
    beliefRevision: boolean;   // NAR: truth revision
    longTermMemory: boolean;   // MeTTa: LTM
    episodicMemory: boolean;   // Both
    // Drives/Goals
    drives: boolean;           // NAR only
    goals: boolean;            // Both
    // Meta
    selfReasoning: boolean;    // NAR
    autonomyLoop: boolean;     // Both
  };
  // Natural language triggers for auto-routing
  triggers: {
    keywords: string[];        // e.g., ["believe", "inherit", "abduce"] → NAR
    patterns: RegExp[];        // e.g., /^skill:/ → MeTTa
    examples: string[];        // Few-shot for LLM classifier
  };
}

export const CAPABILITY_REGISTRY: EngineCapability[] = [
  {
    engine: 'nar',
    supports: {
      inheritance: true,
      similarity: true,
      abduction: true,
      deduction: true,
      patternMatch: false,
      rewrite: false,
      skillExecution: false,
      query: true,
      beliefRevision: true,
      longTermMemory: false,
      episodicMemory: true,
      drives: true,
      goals: true,
      selfReasoning: true,
      autonomyLoop: true,
    },
    triggers: {
      keywords: ['believe', 'inherit', 'abduce', 'drive', 'goal', 'truth', 'confidence', 'revision'],
      patterns: [/^<.*-->/],
      examples: [
        '<bird --> animal>.',
        'What inherits from animal?',
        'Set goal: find food.',
      ],
    },
  },
  {
    engine: 'metta',
    supports: {
      inheritance: false,
      similarity: true,  // via pattern matching
      abduction: false,
      deduction: false,
      patternMatch: true,
      rewrite: true,
      skillExecution: true,
      query: true,
      beliefRevision: false,
      longTermMemory: true,
      episodicMemory: true,
      drives: false,
      goals: false,
      selfReasoning: false,
      autonomyLoop: true,
    },
    triggers: {
      keywords: ['skill', 'match', 'rewrite', 'query', 'remember', 'recall', 'atom', 'space'],
      patterns: [/^skill:/, /^\(match /, /^\(rewrite /, /^\(query /],
      examples: [
        '(skill fetch-url "https://api.example.com")',
        '(match (atom $x) (-> $x (process $x)))',
        'remember (meeting notes "discussed budget")',
      ],
    },
  },
];
```

### 1.2 Intent Classifier (Routes User Input)

```typescript
// core/src/IntentClassifier.ts
export type Intent = {
  primaryEngine: 'nar' | 'metta' | 'hybrid';
  confidence: number;
  reasoning: string;           // For debug/transparency
  subIntents?: Intent[];       // For pipeline routing
};

export class IntentClassifier {
  constructor(
    private registry: EngineCapability[],
    private llmClassifier?: LLMBasedClassifier  // Optional, for complex inputs
  ) {}

  classify(input: string, context?: ConversationContext): Intent {
    // Fast path: keyword/pattern matching
    const scores = this.registry.map(cap => ({
      engine: cap.engine,
      score: this.keywordScore(input, cap.triggers),
    }));
    const best = scores.sort((a, b) => b.score - a.score)[0];

    // If ambiguous or complex, escalate to LLM
    if (best.score < 0.6 || this.isComplex(input)) {
      return this.llmClassify(input, context);
    }

    return {
      primaryEngine: best.engine as 'nar' | 'metta',
      confidence: best.score,
      reasoning: `Keyword match: ${best.engine}`,
    };
  }

  private keywordScore(input: string, triggers: EngineCapability['triggers']): number {
    const lower = input.toLowerCase();
    let score = 0;
    for (const kw of triggers.keywords) if (lower.includes(kw)) score += 0.3;
    for (const pat of triggers.patterns) if (pat.test(input)) score += 0.5;
    return Math.min(score, 1.0);
  }

  private isComplex(input: string): boolean {
    return input.includes(' and ') || input.includes(' then ') || input.split(' ').length > 30;
  }

  private async llmClassify(input: string, context?: ConversationContext): Promise<Intent> {
    // Use a small/fast model or structured output from main LLM
    // Returns { primaryEngine, confidence, reasoning, subIntents? }
  }
}
```

### 1.3 Unified Cognitive Coordinator

```typescript
// core/src/UnifiedCognitiveCoordinator.ts
import type { CognitiveEventSource, CognitiveEvent, AgentCapabilities } from './CognitiveCoordinator.js';
import type { Connection } from './Transport.js';
import { IntentClassifier, CAPABILITY_REGISTRY } from './IntentClassifier.js';
import type { NAR } from '@senars/nar';
import type { MettaAgent } from '@senars/metta/agent';

export interface UnifiedAgentConfig {
  nar?: NAR;
  metta?: MettaAgent;
  llmClassifier?: LLMBasedClassifier;
  defaultEngine?: 'nar' | 'metta' | 'auto';
}

export class UnifiedCognitiveCoordinator implements CognitiveEventSource {
  #nar: NAR | null;
  #metta: MettaAgent | null;
  #classifier: IntentClassifier;
  #listeners = new Set<(e: CognitiveEvent) => void>();
  #transports = new Set<Connection>();
  #chatHistory: ChatMessage[] = [];

  constructor(config: UnifiedAgentConfig) {
    this.#nar = config.nar ?? null;
    this.#metta = config.metta ?? null;
    this.#classifier = new IntentClassifier(CAPABILITY_REGISTRY, config.llmClassifier);
  }

  // --- CognitiveEventSource interface ---

  start(): void {
    this.#nar?.getEventBus?.()?.on('*', this.#forwardEvent.bind(this, 'nar'));
    this.#metta?.on('*', this.#forwardEvent.bind(this, 'metta'));
    this.#nar?.start?.();
    this.#metta?.start?.();
  }

  stop(): void {
    this.#nar?.stop?.();
    this.#metta?.stop?.();
  }

  submit(input: string, correlationId: string): void {
    const intent = this.#classifier.classify(input, { history: this.#chatHistory });
    this.#routeInput(input, intent, correlationId);
  }

  on(event: string | '*', handler: (e: CognitiveEvent) => void): void {
    this.#listeners.add(handler);
  }

  off(event: string | '*', handler: (e: CognitiveEvent) => void): void {
    this.#listeners.delete(handler);
  }

  health() { /* aggregate health */ }

  capabilities(): AgentCapabilities[] {
    const caps: AgentCapabilities[] = [];
    if (this.#nar) caps.push(this.#buildCapabilities('nar'));
    if (this.#metta) caps.push(this.#buildCapabilities('metta'));
    return caps;
  }

  mount(transport: Connection): void {
    this.#transports.add(transport);
    transport.onMessage(async (msg) => {
      const correlationId = crypto.randomUUID();
      this.submit(msg.text, correlationId);
    });
  }

  unmount(transport: Connection): void {
    this.#transports.delete(transport);
  }

  chat(input: string, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    // Single chat entry point — routes to best engine
    return this.#unifiedChat(input, opts);
  }

  // --- Internal routing ---

  async #routeInput(input: string, intent: Intent, correlationId: string): Promise<void> {
    switch (intent.primaryEngine) {
      case 'nar':
        this.#submitToNAR(input, correlationId);
        break;
      case 'metta':
        this.#submitToMeTTa(input, correlationId);
        break;
      case 'hybrid':
        // Parallel or sequential pipeline
        await this.#runHybridPipeline(input, intent.subIntents!, correlationId);
        break;
    }
  }

  #submitToNAR(input: string, correlationId: string): void {
    if (!this.#nar) { this.#fallbackToMeTTa(input, correlationId); return; }
    this.#nar.input(input);  // NAR handles Narsese or NL via its pipeline
    this.#emit({ engine: 'nar', type: 'input', term: input, source: 'transport', timestamp: Date.now(), correlationId });
  }

  #submitToMeTTa(input: string, correlationId: string): void {
    if (!this.#metta) { this.#fallbackToNAR(input, correlationId); return; }
    this.#metta.submit(input, correlationId);
  }

  async #runHybridPipeline(input: string, subIntents: Intent[], correlationId: string): Promise<void> {
    // Example: "believe <bird --> animal> and then run skill fetch-bird-data"
    // → NAR belief revision → MeTTa skill execution → fuse results
    for (const sub of subIntents) {
      await this.#routeInput(input, sub, correlationId);
    }
  }

  #forwardEvent(engine: 'nar' | 'metta', event: CognitiveEvent): void {
    this.#emit({ ...event, engine });
  }

  #emit(event: CognitiveEvent): void {
    for (const l of this.#listeners) {
      try { l(event); } catch { /* ignore */ }
    }
  }

  #buildCapabilities(engine: 'nar' | 'metta'): AgentCapabilities {
    // Map engine-specific caps to unified schema
  }

  async *#unifiedChat(input: string, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    const intent = this.#classifier.classify(input, { history: this.#chatHistory });
    this.#chatHistory.push({ role: 'user', content: input, engine: intent.primaryEngine });

    let response = '';
    if (intent.primaryEngine === 'nar' && this.#nar) {
      // NAR chat via its LMChatService
      for await (const chunk of this.#narChat(input, opts)) {
        response += chunk.text ?? '';
        yield chunk;
      }
    } else if (this.#metta) {
      for await (const chunk of this.#metta.chat(input, opts)) {
        response += chunk.text ?? '';
        yield chunk;
      }
    } else {
      yield { kind: 'text-delta', text: '[No engine available]' };
    }
    this.#chatHistory.push({ role: 'agent', content: response, engine: intent.primaryEngine });
    return response;
  }
}
```

---

## Pillar 2 — Unified Graph Projection (Single Graph View)

### 2.1 Unified Node/Edge Schema

```typescript
// ui/src/server/unified-graph.ts
export interface UnifiedNodeData extends GraphNodeDataView {
  engine: 'nar' | 'metta' | 'hybrid';  // NEW: engine tag for debugging/filtering
  // NAR-specific (present when engine === 'nar')
  truth?: { frequency: number; confidence: number };
  stamp?: { id: string; creationTime: number };
  // MeTTa-specific (present when engine === 'metta')
  atom?: string;           // S-expression
  space?: string;          // MeTTa space
  skill?: string;          // If node is a skill
  // Hybrid: both sets of fields can coexist
}

export interface UnifiedEdgeData {
  source: string;
  target: string;
  weight: number;
  type: 'inheritance' | 'similarity' | 'instance' | 'derivation' | 'skill' | 'pattern' | 'rewrite';
  engine: 'nar' | 'metta' | 'hybrid';
  directed: boolean;
  // Engine-specific metadata
  meta?: Record<string, unknown>;
}
```

### 2.2 Unified Graph Builder

```typescript
// ui/src/server/unified-graph-bridge.ts
export class UnifiedGraphBridge {
  #nar: NAR | null;
  #metta: MettaAgent | null;
  #state: UnifiedBridgeState;
  #sendFn: ((msg: IncomingFromServer) => void) | null = null;

  constructor(nar?: NAR, metta?: MettaAgent) {
    this.#nar = nar ?? null;
    this.#metta = metta ?? null;
    this.#state = { nodes: new Map(), edges: new Map(), seqId: 0 };
  }

  // Called by coordinator on every cognitive event
  handleEvent(event: CognitiveEvent): void {
    const ops = this.#projectEvent(event);
    if (ops.length) this.#sendDelta(ops);
  }

  // Initial sync from both engines
  syncFromEngines(): void {
    const ops: GraphOp[] = [];

    // NAR concepts → nodes + relation edges
    if (this.#nar) {
      for (const concept of this.#nar.listConcepts()) {
        const term = concept.term.toString();
        ops.push(...this.#narConceptToNode(term, concept));
        ops.push(...this.#narRelationsToEdges(term));
      }
    }

    // MeTTa atoms → nodes + pattern edges
    if (this.#metta) {
      // MeTTa doesn't have a simple listConcepts; iterate spaces
      for (const space of this.#metta.listSpaces?.() ?? ['default']) {
        for (const atom of this.#metta.getAtoms(space) ?? []) {
          ops.push(this.#mettaAtomToNode(atom, space));
        }
        for (const skill of this.#metta.getSkills?.() ?? []) {
          ops.push(this.#mettaSkillToNode(skill));
        }
      }
    }

    this.#sendDelta(ops);
  }

  #projectEvent(event: CognitiveEvent): GraphOp[] {
    const ops: GraphOp[] = [];

    switch (event.type) {
      case 'derivation':
      case 'concept:activated':
        ops.push(this.#narDerivationToNode(event));
        ops.push(...this.#narRelationsToEdges(event.term));
        break;
      case 'skill:executed':
        ops.push(this.#mettaSkillToNode(event.skill));
        break;
      case 'drive:changed':
      case 'goal:resolved':
      case 'conflict:detected':
        ops.push(this.#narSpecialToNode(event));
        break;
      // MeTTa-specific events would be added here
    }

    return ops;
  }

  // --- Focus/Lens/History work identically to cognitive-bridge.ts ---
  // But filter/project over UNIFIED node set
}
```

### 2.3 Lens System: Capability-Gated, Engine-Agnostic

```typescript
// core/src/UnifiedLensRegistry.ts
export interface UnifiedLensSpec extends LensSpec {
  // Which engines this lens works with (default: all)
  engines?: ('nar' | 'metta')[];
  // Required node fields (for validation)
  requires?: string[];
}

export class UnifiedLensRegistry {
  #specs = new Map<string, UnifiedLensSpec>();

  register(spec: UnifiedLensSpec): void {
    this.#specs.set(spec.id, spec);
  }

  getApplicableLenses(engine?: 'nar' | 'metta'): UnifiedLensSpec[] {
    return [...this.#specs.values()].filter(s =>
      !engine || !s.engines || s.engines.includes(engine)
    );
  }

  // Built-in lenses that work across engines
  static builtins(): UnifiedLensSpec[] {
    return [
      {
        id: 'belief',
        label: 'Beliefs',
        description: 'What the system knows (NAR beliefs + MeTTa atoms)',
        engines: ['nar', 'metta'],
        modulation: { /* score by confidence/priority */ },
      },
      {
        id: 'goal',
        label: 'Goals',
        description: 'Active goals and drives',
        engines: ['nar'],  // Only NAR has explicit goals/drives
        modulation: { /* score by goal relevance */ },
      },
      {
        id: 'skill',
        label: 'Skills',
        description: 'Executable skills and procedures',
        engines: ['metta'],
        modulation: { /* score by skill recency/success */ },
      },
      {
        id: 'contradiction',
        label: 'Conflicts',
        description: 'Contradictions and tensions',
        engines: ['nar', 'metta'],  // MeTTa: conflicting atoms
        modulation: { /* score by contradiction strength */ },
      },
      {
        id: 'memory',
        label: 'Memory',
        description: 'Episodic and long-term memories',
        engines: ['nar', 'metta'],
        modulation: { /* score by recency/importance */ },
      },
    ];
  }
}
```

---

## Pillar 3 — Unified Configuration (Single Config Surface)

```json
// senars.config.json (user-facing, NO engine field)
{
  "identity": { "name": "senars", "persona": "curious assistant" },
  "reasoning": {
    "mode": "auto",                    // auto | nar | metta | hybrid
    "nar": { "cyclesPerStep": 10, "truthRevision": true },
    "metta": { "maxRecursionDepth": 100, "space": "default" }
  },
  "memory": {
    "episodic": { "enabled": true, "maxEntries": 10000 },
    "longTerm": { "enabled": true, "path": ".cache/ltm" }
  },
  "skills": {
    "autoRegister": true,
    "directories": ["./skills", "./custom-skills"]
  },
  "llm": {
    "provider": "openai-compatible",
    "model": "gpt-4o-mini",
    "temperature": 0.3
  },
  "ui": {
    "defaultLens": "belief",
    "viewportMode": "2d",
    "showEngineTags": false          // Debug only
  }
}
```

```typescript
// core/src/UnifiedConfig.ts
export const UnifiedConfigSchema = z.object({
  identity: z.object({ name: z.string(), persona: z.string() }).optional(),
  reasoning: z.object({
    mode: z.enum(['auto', 'nar', 'metta', 'hybrid']).default('auto'),
    nar: NARConfigSchema.partial().optional(),
    metta: MettaConfigSchema.partial().optional(),
  }).optional(),
  memory: z.object({ /* merged episodic/LTM */ }).optional(),
  skills: z.object({ /* unified skill config */ }).optional(),
  llm: z.object({ /* single LLM config */ }).optional(),
  ui: z.object({ /* UI preferences */ }).optional(),
});
```

---

## Pillar 4 — Unified Bootstrap (One Command, One Knowledge Seed)

### 4.1 Declarative Knowledge Seed

```typescript
// core/src/UnifiedBootstrap.ts
export interface KnowledgeSeed {
  // NAR beliefs (Narsese)
  beliefs?: string[];
  // MeTTa atoms (S-expressions)
  atoms?: Array<{ space: string; atom: string }>;
  // MeTTa skills
  skills?: Array<{ name: string; op: GroundedOp }>;
  // Cross-engine links (optional)
  links?: Array<{ narTerm: string; mettaAtom: string; relation: 'equiv' | 'impl' }>;
}

export const DEFAULT_SEED: KnowledgeSeed = {
  beliefs: [
    '<sky --> blue>.',
    '<bird --> animal>.',
    '<robin --> bird>.',
    '<(*, sky, blue) --> color>.',  // NAR compound
  ],
  atoms: [
    { space: 'default', atom: '(color blue)' },
    { space: 'default', atom: '(isa robin bird)' },
    { space: 'default', atom: '(isa bird animal)' },
  ],
  skills: [
    { name: 'fetch-wiki', op: fetchWikiSkill },
    { name: 'calculate', op: calculateSkill },
  ],
};

export async function bootstrapUnified(nar?: NAR, metta?: MettaAgent): Promise<void> {
  if (nar) {
    for (const b of DEFAULT_SEED.beliefs) await nar.believe(b);
    await nar.run(5);  // Generate derivations
  }
  if (metta) {
    for (const a of DEFAULT_SEED.atoms) await metta.learn(a.atom, a.space);
    for (const s of DEFAULT_SEED.skills) metta.registerSkill(s.name, s.op);
  }
}
```

### 4.2 One-Command Launch

```typescript
// ui/src/server/unified-index.ts
export async function startUnifiedAgent(options: {
  configPath?: string;
  port?: number;
  clientDist?: string;
}): Promise<TestServer> {
  // 1. Load unified config
  const config = await loadUnifiedConfig(options.configPath);

  // 2. Create engines per config
  const nar = config.reasoning?.mode !== 'metta' ? createNAR(config.reasoning.nar) : null;
  const metta = config.reasoning?.mode !== 'nar' ? createMettaAgent(config.reasoning.metta) : null;

  // 3. Create unified coordinator
  const coordinator = new UnifiedCognitiveCoordinator({ nar, metta });

  // 4. Create unified graph bridge
  const bridge = new UnifiedGraphBridge(nar, metta);

  // 5. Bootstrap knowledge
  await bootstrapUnified(nar, metta);
  bridge.syncFromEngines();

  // 6. Start HTTP+WS server with unified bridge
  return startUnifiedWebUI(coordinator, bridge, options);
}
```

```json
// package.json (root)
{
  "scripts": {
    "senars": "tsx src/bin/unified-agent.ts",
    "demo:unified": "pnpm --filter @senars/ui dev:unified",
    "dev:unified": "concurrently -n coord,ui \"pnpm --filter @senars/core start:coordinator\" \"pnpm --filter @senars/ui dev\""
  }
}
```

---

## Pillar 5 — UI: Seamless User Experience

### 5.1 Chat: Single Input, Smart Routing

```typescript
// ui/src/client/components/unified-chat.ts
// User sees ONE chat input. No engine selector.
// System shows subtle routing hint: "🧠 NAR" | "⚡ MeTTa" | "🔀 Hybrid"
```

### 5.2 Graph: Unified with Optional Engine Badge

```typescript
// ui/src/client/utils/unified-node-style.ts
export function getNodeStyle(node: UnifiedNodeData): CytoscapeStyle {
  const base = { /* shared style */ };

  // ONLY if user enables "Show Engine Tags" in settings
  if ($showEngineTags.get()) {
    return {
      ...base,
      'background-color': node.engine === 'nar' ? '#00d4aa' : '#a855f7',
      'border-color': node.engine === 'nar' ? '#00ffcc' : '#d8b4fe',
    };
  }

  // Default: style by lens, NOT engine
  return applyLensStyle(base, node, $activeLens.get());
}
```

### 5.3 Lens Picker: Auto-Filters to Active Subgraph

```typescript
// ui/src/client/components/lens-controller.ts
// When NAR subgraph empty → hide 'goal', 'drive' lenses
// When MeTTa subgraph empty → hide 'skill', 'pattern' lenses
// 'belief', 'memory', 'contradiction' always shown if any data
```

### 5.4 Config Panel: Unified, Collapsible Engine Sections

```typescript
// ui/src/client/components/config-hud.ts
// Single config panel:
// ┌ Identity ┐
// ┌ Reasoning ┐  → mode: [auto ▼]  (nar|metta|hybrid sections auto-collapse when mode=single)
// ┌ Memory ┐
// ┌ Skills ┐
// ┌ LLM ┐
// ┌ UI ┐
```

---

## Pillar 6 — Testing: Unified Smoke Test

```typescript
// tests/e2e/unified-smoke.test.ts
test('unified agent: boot + chat + graph grows', async () => {
  const server = await startUnifiedAgent({ port: 0, bootstrap: true });
  const ws = new WebSocket(`ws://localhost:${server.address().port}`);

  // 1. Initial state has BOTH engines' bootstrap data
  await expectWSMessage(ws, 'cognitive.delta', delta => {
    expect(delta.ops.some(op => op.data.engine === 'nar')).toBe(true);
    expect(delta.ops.some(op => op.data.engine === 'metta')).toBe(true);
  });

  // 2. Narsese input → NAR path
  ws.send(JSON.stringify({ type: 'chat.user', content: '<cat --> animal>.' }));
  await expectWSMessage(ws, 'cognitive.delta', delta => {
    expect(delta.ops.some(op => op.data.engine === 'nar')).toBe(true);
  });

  // 3. MeTTa skill input → MeTTa path
  ws.send(JSON.stringify({ type: 'chat.user', content: 'skill:fetch-wiki "cat"' }));
  await expectWSMessage(ws, 'cognitive.delta', delta => {
    expect(delta.ops.some(op => op.data.engine === 'metta')).toBe(true);
  });

  // 4. Natural language → auto-route (LLM classifier)
  ws.send(JSON.stringify({ type: 'chat.user', content: 'What animals are birds?' }));
  await expectWSMessage(ws, 'chat.agent.stream');  // Response streams

  // 5. Focus works across unified graph
  ws.send(JSON.stringify({ type: 'focus.set', term: 'bird' }));
  await expectWSMessage(ws, 'cognitive.delta', delta => {
    expect(delta.meta?.truncated).toBe(false);
    // Focused subgraph includes NAR + MeTTa nodes related to 'bird'
  });
});
```

---

## Migration Path (From NEXT.agent3.md)

| Item | Status | Action |
|------|--------|--------|
| `CognitiveBridge` | ✅ Done | → **Deprecate** → Replace with `UnifiedGraphBridge` |
| `startWebUI(nar)` | ✅ Done | → **Wrap** in `startUnifiedAgent({ nar })` |
| `bootstrapNAR` | ✅ Done | → **Merge** into `bootstrapUnified` |
| Revision history | ✅ Done | → Works for NAR; add MeTTa LTM history |
| Focus filtering | ✅ Done (Option A) | → Works on unified graph |
| Smoke test | ✅ Done | → **Extend** to `unified-smoke.test.ts` |
| `pnpm web` | ✅ Done | → **Add** `pnpm senars` unified entry |

---

## File-Level Change Checklist

### New Files (Core Unification)
- [ ] `core/src/UnifiedCapabilities.ts` — Capability registry + triggers
- [ ] `core/src/IntentClassifier.ts` — Keyword + LLM routing
- [ ] `core/src/UnifiedCognitiveCoordinator.ts` — Single CognitiveEventSource
- [ ] `core/src/UnifiedConfig.ts` — Unified config schema + loader
- [ ] `core/src/UnifiedBootstrap.ts` — Declarative knowledge seed
- [ ] `core/src/UnifiedLensRegistry.ts` — Capability-gated lenses

### New Files (UI/Server)
- [ ] `ui/src/server/unified-graph.ts` — Unified node/edge types
- [ ] `ui/src/server/unified-graph-bridge.ts` — Projects both engines → single graph
- [ ] `ui/src/server/unified-index.ts` — Unified server entry point
- [ ] `ui/src/client/components/unified-chat.ts` — Single chat with routing hint
- [ ] `ui/src/client/utils/unified-node-style.ts` — Engine-agnostic styling

### Modified Files
- [ ] `package.json` (root) — Add `senars` and `demo:unified` scripts
- [ ] `senars.config.json` — Migrate to unified schema
- [ ] `ui/src/server/index.ts` — Export `startUnifiedAgent`, keep old for compat
- [ ] `core/src/CognitiveCoordinator.ts` — Extend for unified coordinator
- [ ] `ui/src/client/core/store.ts` — Add `$showEngineTags` atom
- [ ] `ui/src/client/components/lens-controller.ts` — Auto-filter by active engines

### Tests
- [ ] `tests/e2e/unified-smoke.test.ts` — Replaces `webui-smoke.test.ts`
- [ ] `tests/unit/core/intent-classifier.test.ts`
- [ ] `tests/unit/core/unified-coordinator.test.ts`
- [ ] `tests/unit/server/unified-graph-bridge.test.ts`

---

## Definition of Done (Seamless Unification)

- [ ] `pnpm senars` → single process: coordinator + NAR + MeTTa + UI server
- [ ] User types `<bird --> animal>.` → graph grows (NAR path)
- [ ] User types `skill:fetch-wiki "bird"` → graph grows (MeTTa path)
- [ ] User types "What color is the sky?" → auto-routes, streams answer
- [ ] Graph shows unified nodes; engine badge ONLY in debug mode
- [ ] Lens picker shows only applicable lenses for current subgraph
- [ ] Config panel has NO engine selector; mode: auto|nar|metta|hybrid
- [ ] `pnpm test:e2e:smoke` (unified) passes deterministically
- [ ] `pnpm test` → all green (1025+ tests)
- [ ] Zero user-facing references to "NAR" or "MeTTa" in default UI

---

## Future Extensibility (Post-Unification)

The unified architecture makes adding new engines trivial:

```typescript
// To add a new engine (e.g., Python ML, Rust rule engine, WASM):
// 1. Implement CognitiveEventSource interface
// 2. Add entry to CAPABILITY_REGISTRY with triggers
// 3. Add engine-specific node/edge projection in UnifiedGraphBridge
// 4. Register engine-specific lenses in UnifiedLensRegistry
// 5. Add config section in UnifiedConfigSchema
// 6. Update bootstrap to seed new engine
// DONE. No UI changes needed.
```

---

*Supersedes `NEXT.agent3.md`. Strategy: **Unify first, impress second.** The vertical slice is the unified agent itself.*