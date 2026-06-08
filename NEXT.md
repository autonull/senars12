# SeNARS Agent — Final Redemption Plan

> **Target:** Transform `src/agent/` from 1,944 lines of bloated abstraction
> into **~550 lines across 5 files** that enable autonomous cognition without
> unnecessary classes or abstraction layers.

---

## 1. Executive Summary

**The Problem:** The Agent layer has 1,944 lines across 21 files. Most are
overengineered classes for concepts that could be functions or plain data.

**The Solution:** 
- **NAR stays untouched** — the reasoning engine is the product
- **Agent becomes ~550 lines in 5 files** — inline what doesn't need a class
- **Keep genuine cognitive infrastructure** — summarization, metrics, episodic logging
- **Remove implementation bloat** — EventBuses, TTL classes, optimization theater, LM hallucination

**The Result:** A cognitive adapter that routes input, drives LM+tools, maintains
conversation state, and gets out of NAR's way.

---

## 2. What Stays (And Why)

### 2.1 NAR Core — 100% Keep

`src/nar/` (~1.5M lines) is excellent. Untouched:
- InferenceController, Reasoner, RuleProcessor
- Memory with Focus/Archive/LinkManager
- CognitiveController with strategy registry
- Pipeline streaming architecture
- LM integration via LMRule abstraction
- Tool system with adapters

### 2.2 Model Layer — Keep As-Is

`src/agent/model/` (~280 lines):
- **ModelRunner.ts** (180 lines) — Clean LM adapter + tool loop with event stream
- **ToolDispatcher.ts** (100 lines) — Tool execution with artifact/error tracking

These are well-designed, focused, and don't need changes.

### 2.3 Input Routing — Keep, Trim

`src/agent/routing.ts` (~80 lines):
- Keep: Narsese parser detection, command detection, NL fallback, Route discriminated union
- Remove: RouteSignal tracking, RouteContext, NLAnalyzer intents array

---

## 3. What Changes (And How)

### 3.1 AIAgent — The Core (~300 lines)

**Old:** AIAgent.ts (226 lines) + EpisodePreparer (55) + EpisodeFinalizer (64) + EpisodeRecorder (57) + AgentWiring (124) = 526 lines of episode orchestration.

**New:** Single `agent.ts` (~300 lines) with AIAgent class that:
- Routes input (narsese → NAR, NL → LM)
- Builds prompts with NAR context (inline prompt building)
- Runs LM + tools via ModelRunner
- Maintains conversation state (inline history + pinned arrays)
- Records episodes (inline bounded log)
- Tracks routing metrics (inline Map)

**Key insight:** WorkingMemory, ConversationState, EpisodeLog don't need to be
separate classes. They're data structures with 2-3 methods each. Inline them.

```typescript
// src/agent/agent.ts (~300 lines)
import { NAR } from '../nar/nar';
import { LMClient } from '../nar/lm/types';
import { route, type Route } from './routing';
import { buildTools } from '../nar/tools/adapters';
import { ModelRunner } from './model/ModelRunner';

export interface ConversationEntry { role: 'user' | 'assistant'; content: string; timestamp: number; }
export interface EpisodeRecord { id: string; input: string; response: string; concepts: string[]; routeKind: string; timestamp: number; }

export class AIAgent {
  private runner: ModelRunner;
  private history: ConversationEntry[] = [];
  private pinned: string[] = [];
  private routeCounts = new Map<string, number>();
  private episodeLog: EpisodeRecord[] = [];

  constructor(private nar?: NAR, private lm?: LMClient, maxLoops = 5) {
    this.runner = new ModelRunner({ lmClient: lm, maxLoops });
  }

  async chat(input: string): Promise<string> {
    const r = route(input);
    this.routeCounts.set(r.kind, (this.routeCounts.get(r.kind) ?? 0) + 1);

    if (r.kind !== 'nl') return this.handleDirect(input, r);
    return this.handleNL(input, r);
  }

  private async handleDirect(input: string, r: Route & { kind: 'narsese-belief' | 'narsese-question' | 'command' }): Promise<string> {
    if (r.kind === 'narsese-belief') {
      await this.nar?.input(r.narsese, 'belief');
      await this.nar?.run(5);
      this.logEpisode(input, `+ ${r.narsese}`, [r.narsese], r.kind);
      return `+ ${r.narsese}`;
    }
    if (r.kind === 'narsese-question') {
      const ans = this.nar?.getBeliefs().find(b => b.term.toString().includes(r.narsese));
      const text = ans ? `<${ans.term}> f=${ans.truth?.f.toFixed(2)} c=${ans.truth?.c.toFixed(2)}` : `No answer for: ${r.narsese}`;
      this.logEpisode(input, text, [], r.kind);
      return text;
    }
    const text = `[${r.command} ${r.args.join(' ')}]`;
    this.logEpisode(input, text, [], r.kind);
    return text;
  }

  private async handleNL(input: string, _r: Route): Promise<string> {
    const snapshot = this.buildSnapshot();
    const tools = buildTools(this.nar);
    const system = [
      'You are SeNARS — a neurosymbolic cognitive kernel.',
      'Call nar_believe or nar_query when formal logic is needed.',
      snapshot ? `\\n\\n## Cognitive State\\n${snapshot}` : '',
    ].filter(Boolean).join('\\n');

    const result = await this.runner.run({
      system,
      messages: [...this.history.slice(-20), { role: 'user', content: input }],
      tools,
    }).result;

    this.history.push({ role: 'user', content: input, timestamp: Date.now() });
    this.history.push({ role: 'assistant', content: result.text, timestamp: Date.now() });
    if (this.history.length > 40) this.history = this.history.slice(-40);

    for (const a of result.artifacts) {
      if (a.type === 'belief_added' && a.content) {
        this.pinned.push(a.content);
        if (this.pinned.length > 8) this.pinned = this.pinned.slice(-8);
      }
    }

    this.logEpisode(input, result.text, result.artifacts.map(a => a.content).filter(Boolean), _r.kind);
    return result.text;
  }

  private buildSnapshot(): string {
    if (!this.nar) return '';
    const attn = this.nar.attentionReport();
    const parts: string[] = [];
    if (this.pinned.length) {
      parts.push('Pinned beliefs:');
      for (const b of this.pinned) parts.push(`  - ${b}`);
    }
    if (attn.concepts.length) {
      parts.push('Attention focus:');
      for (const c of attn.concepts.slice(0, 10)) parts.push(`  - ${c.term} (p=${c.priority.toFixed(2)})`);
    }
    const questions = this.nar.getQuestions().slice(0, 5);
    if (questions.length) {
      parts.push('Open questions:');
      for (const q of questions) parts.push(`  ? ${q.term.toString()}`);
    }
    return parts.join('\\n');
  }

  private logEpisode(input: string, response: string, concepts: string[], routeKind: string): void {
    this.episodeLog.push({
      id: `${Date.now()}-${Math.random()}`,
      input, response, concepts, routeKind, timestamp: Date.now(),
    });
    if (this.episodeLog.length > 256) this.episodeLog = this.episodeLog.slice(-256);
  }

  getPolicy(): Record<string, number> {
    const out: Record<string, number> = {};
    const total = Math.max(1, [...this.routeCounts.values()].reduce((a, b) => a + b, 0));
    for (const [k, v] of this.routeCounts) out[k] = v / total;
    return out;
  }

  getRecentEpisodes(limit = 20): EpisodeRecord[] { return this.episodeLog.slice(-limit); }

  async summarize(lm: { generateText(prompt: string): Promise<string> }): Promise<void> {
    if (this.history.length <= 30) return;
    const toSummarize = this.history.slice(0, -10);
    const prompt = `Summarize: ${toSummarize.map(m => `${m.role}: ${m.content}`).join('\\n')}`;
    const summary = await lm.generateText(prompt);
    this.history = this.history.slice(-10);
    this.history.unshift({ role: 'assistant', content: `Summary: ${summary}`, timestamp: Date.now() });
  }
}
```

**What's gone:**
- WorkingMemory class (40 lines) → inline `pinned: string[]` and `history: ConversationEntry[]`
- ConversationState class (100 lines) → inline methods `logEpisode()`, `summarize()`
- EpisodeLog class (30 lines) → inline `episodeLog: EpisodeRecord[]` array
- EpisodePreparer/Finalizer/Recorder (176 lines) → inline into `chat()`, `handleDirect()`, `handleNL()`
- AgentWiring (124 lines) → DI is overkill for 5 dependencies

**What's kept:**
- Routing (via `route()` call)
- LM + tools (via ModelRunner)
- Conversation history (as array)
- Pinned beliefs (as array)
- Episodic logging (as array)
- Routing metrics (as Map)
- Summarization (as method)

### 3.2 Metrics Service — Functions, Not Class (~40 lines)

**Old:** SelfAnalyzerService.ts (682 lines) → v3 proposed 150 lines.

**New:** `src/agent/services/metrics.ts` (~40 lines) as plain functions:

```typescript
const routeCounts = new Map<string, number>();
const toolCounts = new Map<string, number>();

export function recordRoute(kind: string): void {
  routeCounts.set(kind, (routeCounts.get(kind) ?? 0) + 1);
  if (routeCounts.size > 20) routeCounts.delete(routeCounts.keys().next().value);
}

export function recordTool(name: string): void {
  toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);
  if (toolCounts.size > 20) toolCounts.delete(toolCounts.keys().next().value);
}

export function getPolicy(): Record<string, number> {
  const routeTotal = Math.max(1, [...routeCounts.values()].reduce((a, b) => a + b, 0));
  const toolTotal = Math.max(1, [...toolCounts.values()].reduce((a, b) => a + b, 0));
  return {
    routingWeights: Object.fromEntries([...routeCounts].map(([k, v]) => [k, v / routeTotal])),
    toolSelectionBias: Object.fromEntries([...toolCounts].map(([k, v]) => [k, v / toolTotal])),
  };
}

export function getSystemAnalysis(nar: NAR): { throughput: number; memoryUsage: number; concepts: number } {
  const stats = nar.getStatistics();
  return {
    throughput: 0, // Read from MetricsCollector if available
    memoryUsage: process.memoryUsage().heapUsed,
    concepts: stats.totalConcepts,
  };
}
```

**What's gone:** Class wrapper, optimization methods, correction methods, capability snapshots, performance trend calculations.

**What's kept:** Route/tool recording, policy computation, basic system metrics.

### 3.3 Request Composer — Inline Into Agent (~0 lines as separate file)

**Old:** RequestComposer.ts (184 lines) → v3 proposed 60 lines.

**New:** Inline into `agent.ts` as `buildSnapshot()` and system prompt building (already shown above).

**Rationale:** The prompt building logic is 20 lines. It doesn't need a separate file.

### 3.4 Cognitive Snapshot — Inline Into Agent (~0 lines as separate file)

**Old:** CognitiveSnapshot.ts (166 lines) → v3 proposed 40 lines.

**New:** Inline into `agent.ts` as `buildSnapshot()` method (already shown above).

**Rationale:** It's one function that calls `nar.attentionReport()`, `nar.getQuestions()`, `nar.getGoals()`. No cache, no TTL, no class needed.

### 3.5 Term Extractor — Inline When Needed (~0 lines as separate file)

**Old:** TermExtractor.ts (69 lines).

**New:** Inline when needed: `input.match(/\(([^)]+)\)/g) ?? []`.

**Rationale:** It's a regex and a loop. Doesn't need a file.

---

## 4. What Goes (And Why)

| Component | Lines | Why Delete |
|-|-|-|
| `ReflectionStage.ts` | 142 | LM self-review is circular. Default 'accept'. |
| `ConsolidationEngine.ts` | 266 | LM hallucinates beliefs with false certainty. |
| `AutonomousScheduler.ts` | 149 | Duplicates `nar.run()`. Use `setInterval`. |
| `InsightStream.ts` | 40 | Pub/sub over deleted scheduler. |
| `WorkingMemory.ts` | 151 | Inline as arrays. TTLs unused. |
| `ConversationState.ts` | 225 | Inline as methods. Summarization kept as function. |
| `EpisodePreparer.ts` | 55 | Inline into AIAgent. |
| `EpisodeFinalizer.ts` | 64 | Inline into AIAgent. |
| `EpisodeRecorder.ts` | 57 | Inline into AIAgent. |
| `AgentWiring.ts` | 124 | DI overkill for 5 dependencies. |
| `WorkingMemoryPersistence.ts` | 21 | Inline into AIAgent. |
| `SkillCatalog.ts` | 118 | Template literal. |
| `ReasoningTrace.ts` | 158 | `const trace = []` — no class needed. |
| `MetacognitiveMonitor.ts` | 310 | EventBus subscriptions, variance calculations. |
| `RequestComposer.ts` | 184 | Inline prompt building. |
| `CognitiveSnapshot.ts` | 166 | Inline snapshot building. |
| `TermExtractor.ts` | 69 | Regex inline. |
| `AttentionPrimer.ts` | 15 | Inline `concept.priority += 0.1`. |
| `types.ts` | ~200 | Types inline into respective files. |
| EventBus proliferation | ~200 | Direct callbacks. |

**Total deleted:** ~2,100 lines (including unused types and EventBus usage).

---

## 5. Target File Structure

```
src/agent/
├── agent.ts                  (~300 lines) AIAgent + inline WorkingMemory/ConversationState/EpisodeLog/prompt building
├── routing.ts                (~80 lines)  Route types + InputRouter
├── services/
│   └── metrics.ts            (~40 lines)  route/tool recording, policy, system analysis
└── model/
    ├── ModelRunner.ts        (~180 lines, KEEP)
    └── ToolDispatcher.ts     (~100 lines, KEEP)
```

**Total:** ~550 lines across 5 files (down from 1,944 lines across 21 files).

---

## 6. Autonomous Cognition — How It Actually Works

### 6.1 Background Inference

```typescript
// src/app.ts or src/bin/repl.ts
const nar = new NAR(config);
const agent = new AIAgent(nar, lmClient);

// One line. No scheduler class.
const bg = setInterval(() => nar.run(5), 60000);
if (bg.unref) bg.unref();
```

NAR's CognitiveController handles adaptation. NAR's Memory handles consolidation.
NAR's RuleProcessor handles LM rule selection. The Agent doesn't schedule — it
orchestrates.

### 6.2 Episodic Logging

```typescript
// In AIAgent.chat()
this.episodeLog.push({ id, input, response, concepts, routeKind, timestamp });
if (this.episodeLog.length > 256) this.episodeLog = this.episodeLog.slice(-256);

// For debugging/replay
agent.getRecentEpisodes(20);
```

No LM belief extraction. No consolidation engine. Just logging for debugging
and replay.

### 6.3 Conversation Summarization

```typescript
// In AIAgent, when history exceeds threshold
if (this.history.length > 40) {
  await this.summarize(lm); // Compresses to 10 messages + summary
}
```

Enables long-running dialogues without hitting context windows.

### 6.4 Metrics & Adaptation

```typescript
// In AIAgent.chat()
recordRoute(r.kind);
// In tool execution
recordTool(toolName);

// For system monitoring
const policy = getPolicy();
const analysis = getSystemAnalysis(nar);
```

Tracks behavioral patterns. No "optimization" — just observation.

---

## 7. Migration — 4 Days, Not 3 Weeks

### Day 1: Foundation

```bash
# Write new files
cat > src/agent/agent.ts << 'EOF'
# (300 lines from section 3.1)
EOF

cat > src/agent/routing.ts << 'EOF'
# (80 lines from InputRouter.ts, trimmed)
EOF

cat > src/agent/services/metrics.ts << 'EOF'
# (40 lines from section 3.2)
EOF

# Delete old files
rm -rf src/agent/AIAgent.ts src/agent/types.ts src/agent/cognition/ src/agent/request/ src/agent/services/SelfAnalyzerService.ts src/agent/autonomy/ src/agent/cycle/
```

### Day 2: Integration

```bash
# Update imports in entry points
# src/bin/repl.ts, src/bin/bot-ai.ts, src/app.ts
# Change: import { AIAgent } from './agent/AIAgent'
# To:      import { AIAgent } from './agent/agent'

# Fix type errors
pnpm run typecheck

# Run tests, note failures
pnpm run test:unit 2>&1 | tee test-failures.log
```

### Day 3: Test Fixes

```bash
# Update test imports
# Delete tests for deleted features:
rm tests/unit/agent/ReflectionStage.test.ts
rm tests/unit/agent/ConsolidationEngine.test.ts
rm tests/unit/agent/AutonomousScheduler.test.ts
rm tests/unit/agent/WorkingMemory.test.ts

# Update AIAgent tests to use new chat() API
# Most tests will need: new AIAgent(nar, lm) instead of complex wiring
```

### Day 4: Polish

```bash
pnpm run lint --fix
pnpm run typecheck
pnpm run test:unit
pnpm run test:integration

# Verify no imports of deleted modules
rg "from.*agent/(cognition|request|services/SelfAnalyzerService|autonomy)" src/
```

---

## 8. Success Criteria

1. **`src/agent/`** — exactly 5 files (agent.ts, routing.ts, services/metrics.ts, model/ModelRunner.ts, model/ToolDispatcher.ts). Total ≤ 600 lines.
2. **`NAR`** — zero changes.
3. **`pnpm run typecheck`** — passes.
4. **`pnpm run lint`** — passes.
5. **`pnpm run test:unit`** — passes (with updated tests).
6. **Chat works** — `pnpm run repl` accepts Narsese and NL.
7. **LM tools work** — `nar_believe` and `nar_query` called appropriately.
8. **Background inference works** — `setInterval(() => nar.run(5), 60000)` runs without scheduler class.
9. **Episodic logging works** — `agent.getRecentEpisodes(20)` returns log.
10. **Summarization works** — long conversations compress without losing coherence.
11. **No import of deleted modules** — `rg "from.*agent/(cognition|request|autonomy)"` returns nothing.
12. **Every belief in NAR** — from explicit input or inference, not LM hallucination.

---

## 9. Why This Is Worth Building

| Aspect | v1 (Conservative) | v2 (Aggressive) | v3 (Balanced) | v4 (Final) |
|-|-|-|-|-|
| Lines | ~600 | ~250 | ~900 | ~550 |
| Files | 10 | 2 | 12 | 5 |
| WorkingMemory | Simplify | Delete | Keep class | Inline as arrays |
| ConversationState | Simplify | Delete | Keep class | Inline as methods |
| SelfAnalyzer | Cut 50% | Delete | Keep class (150 lines) | Functions (40 lines) |
| EpisodeLog | Bounded array | Delete | Keep class | Inline array |
| RequestComposer | Simplify | Delete | Keep (60 lines) | Inline into agent |
| CognitiveSnapshot | Simplify | Delete | Keep (40 lines) | Inline into agent |
| Migration | 4 phases | One afternoon | 3 weeks | 4 days |

**v4 is the ideal balance:**
- Keeps genuine cognitive infrastructure (summarization, metrics, episodic logging)
- Removes implementation bloat (classes for simple data structures)
- Achieves elegance through discipline, not deletion count
- Ready to build in 4 days, not 3 weeks
- ~550 lines that do real work, not ~250 lines that are minimal or ~900 lines that are cautious

---

## Appendix A — The 5 Files

### A.1 `src/agent/agent.ts` (~300 lines)

See section 3.1 for full implementation.

### A.2 `src/agent/routing.ts` (~80 lines)

```typescript
export type RouteKind = 'narsese-belief' | 'narsese-question' | 'command' | 'nl';

export type Route =
  | { kind: 'narsese-belief'; narsese: string; concepts: string[] }
  | { kind: 'narsese-question'; narsese: string; concepts: string[] }
  | { kind: 'command'; command: string; args: string[] }
  | { kind: 'nl'; intent: string; concepts: string[]; ambiguity: number };

export function route(input: string): Route {
  // Narsese detection, command detection, NL fallback
  // ~80 lines total
}
```

### A.3 `src/agent/services/metrics.ts` (~40 lines)

See section 3.2 for full implementation.

### A.4 `src/agent/model/ModelRunner.ts` (~180 lines, KEEP)

No changes. Keep as-is.

### A.5 `src/agent/model/ToolDispatcher.ts` (~100 lines, KEEP)

No changes. Keep as-is.

---

**This is the plan. Build it.**