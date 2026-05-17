# SeNARS Bot Plan

## Goal

Make SeNARS act as an intelligent, autonomous chatbot with LM-powered conversation, SeNARS reasoning, and
attention-driven memory — achieving feature parity with OmegaClaw's core capabilities while leveraging SeNARS's superior
NAL engine and tooling.

## Current State

SeNARS has:

- **NAL engine**: 65+ rules (NAL-1 through NAL-5) with full truth-value operations
- **Memory system**: Focus → Concepts → Archive three-tier with link-based associations
- **Link layers**: `LinkManager` with `Layer` base class and `TermLayer` (symbolic links via `LinkBag`)
- **Tool system**: 11 tools (Calculate, Sleep, ReadFile, WriteFile, HTTP, Search, Reason, Explain, Learn, Timer,
  Process)
- **LM integration**: Provider registry (Anthropic/Ollama/TransformersJS), LM rules, enrichment, feedback
- **Channels**: IRC, HTTP, WebSocket, CLI, MCP
- **Self-reasoning**: SelfAnalyzer, SelfOptimizer, MetacognitiveMonitor
- **ChatResponder**: LM-powered conversational responses with context injection
- **SemanticStrategy**: Placeholder for embedding-based premise formation (interface exists, no provider)

## Gap Analysis (vs OmegaClaw)

| OmegaClaw Feature                 | SeNARS Status                                                                | Action                                        |
|-----------------------------------|------------------------------------------------------------------------------|-----------------------------------------------|
| Continuous autonomous loop        | Partial (externally driven)                                                  | **ADD** — AgenticLoop                         |
| Vector embedding memory           | Interface exists (`SemanticStrategy`, `linkCapacity: semantic`), no provider | **ADD** — `EmbeddingLayer` as NARS Link Layer |
| Episodic trace (persistent)       | Partial (in-memory `ReasoningTrace` only)                                    | **ADD** — File-backed history                 |
| Web search                        | Partial (memory-only `SearchTool`)                                           | **ADD** — BraveSearchTool                     |
| Parenthesis repair for LLM output | Missing                                                                      | **ADD** — Response repair                     |
| Multi-channel (Telegram/Slack)    | IRC only                                                                     | **SKIP** — per user directive                 |
| PLN engine                        | N/A                                                                          | **SKIP** — NAL covers it                      |
| Additional LM providers           | 3 tiers sufficient                                                           | **SKIP** — per user directive                 |
| Self-improvement (code rewrite)   | Partial (parameter tuning)                                                   | **SKIP** — per user directive                 |
| Remote agent delegation           | Missing                                                                      | **DEFER** — low priority                      |
| Docker deployment                 | Missing                                                                      | **DEFER** — operational                       |

## Architecture: EmbeddingLayer as NARS Link Layer with LanceDB

### Design Principle

In senars11, `EmbeddingLayer` was a parallel component with brute-force O (n²) similarity. In senars12, we integrate it
properly as a **Layer** within the existing `LinkManager` architecture — backed by **LanceDB** for efficient vector
search. This means:

- `EmbeddingLayer` extends `Layer`, implementing `add()`, `get()`, `remove()` using LanceDB ANN search
- LanceDB is embedded (no server), native Node.js, persistent on disk
- Links created from LanceDB results are stored in the `LinkBag` with `priority = similarity`
- The `LinkBag` handles NARS-native lifecycle: decay, forgetting, priority-based eviction
- LanceDB handles efficient retrieval; LinkBag handles NARS semantics

### Layer Architecture

```
LinkManager
  ├── TermLayer ("term")          — symbolic links from NAL derivations
  └── EmbeddingLayer ("semantic") — vector-proximity links via LanceDB ANN search
        │
        └── LanceDB table
              └── columns: term (string), embedding (vector[384]), metadata (json)
                    └── ANN index for fast similarity search
```

### How It Works

1. **On concept creation**: `Memory.addConcept()` → `EmbeddingLayer.indexConcept()` generates embedding, upserts into
   LanceDB table
2. **On retrieval**: `EmbeddingLayer.findSimilar()` → LanceDB ANN search returns top-K similar terms → creates/updates
   links in `LinkBag` with `priority = similarity`
3. **On reasoning**: `SemanticStrategy` queries `EmbeddingLayer.getLinks(concept)` → returns NARS links from `LinkBag`,
   sourced from LanceDB similarity
4. **On forgetting**: Links in the embedding layer decay and are evicted from the `LinkBag` by priority — NARS
   lifecycle. LanceDB vectors persist for re-indexing if concepts are reactivated.
5. **Persistence**: LanceDB table persists to `.cache/vectors/`. Embeddings survive restarts. Links are regenerated on
   demand from LanceDB + concept set.

### Why LanceDB

- **Embedded, no server**: Single npm package, zero-config, stores data in local directory
- **Native Node.js**: First-class `@lancedb/lancedb` package, no Python/FFI required
- **ANN search**: IVF/PQ indexes scale to 100K+ vectors; brute-force only up to ~1K
- **Persistent**: Vectors survive restarts; no need to regenerate from concept terms
- **Lightweight**: ~50MB binary, no external services

### Embedding Generation

- Use `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2` (384-dim, fast, good quality)
- Lazy initialization on first use
- LRU cache (configurable size, default 1000) to avoid recomputing hot terms
- Mock fallback: deterministic hash-based embeddings for testing/no-model scenarios

## Implementation Plan

### Phase 1: Brave Search Tool

**File**: `src/nar/tools/BraveSearchTool.ts`

- New tool: `brave-search` with params `{query: string, count?: number}`
- Uses Brave Search API (`api.brave.com`)
- Returns structured results: `{title, url, snippet}` as Narsese beliefs
- Requires `BRAVE_API_KEY` env var
- Falls back to existing `SearchTool` (memory search) if API key missing
- Register in `nar.ts` TOOL_DEFS array

**Config** in `senars.config.json`:

```json
"tools": {
  "braveSearch": {
    "apiKeyEnv": "BRAVE_API_KEY",
    "defaultCount": 5
  }
}
```

### Phase 2: EmbeddingLayer (Semantic Link Layer)

**Files to create**:

- `src/nar/memory/links/EmbeddingLayer.ts` — the Layer implementation

**Files to modify**:

- `src/nar/memory/links/index.ts` — export EmbeddingLayer
- `src/nar/memory/links/LinkManager.ts` — register "semantic" layer as EmbeddingLayer
- `src/nar/memory/memory.ts` — generate embeddings on concept add, expose embedding layer
- `src/nar/memory/embedding.ts` — embedding generator (TransformersJS + mock fallback)
- `src/nar/reason/strategies/semantic.ts` — use EmbeddingLayer via LinkManager instead of placeholder
- `src/nar/memory/links/types.ts` — add embedding-specific fields to LinkEntry

**EmbeddingLayer design**:

```
EmbeddingLayer extends Layer
  ├── db: LanceDB connection           — persistent vector store
  ├── table: LanceDB table             — columns: term, embedding, metadata
  ├── embeddingCache: Map<string, number[]> — LRU cache for hot terms
  ├── similarityThreshold: number      — min similarity to create link (default 0.6)
  ├── maxLinksPerConcept: number       — cap links per concept (default 20)
  │
  ├── add(sourceHash, targetHash, {sourceTerm, targetTerm, similarity})
  │     — creates link entry with priority = similarity
  │     — stored in LinkBag with priority-based forgetting
  │
  ├── get(sourceHash, {minPriority, maxResults})
  │     — returns links from LinkBag sorted by similarity (priority)
  │
  ├── indexConcept(term: Term)
  │     — generates embedding for term
  │     — upserts into LanceDB table (term, vector, metadata)
  │     — LanceDB ANN search finds similar existing terms
  │     — creates links for pairs above threshold
  │
  ├── findSimilar(term: Term, topK: number)
  │     — LanceDB ANN search → returns concepts ranked by cosine similarity
  │     — used by SemanticStrategy for premise formation
  │
  └── removeConcept(term: Term)
        — deletes from LanceDB table
        — removes all links for term from LinkBag
```

**Integration points**:

- `Memory.addConcept()` → calls `embeddingLayer.indexConcept()` (async, non-blocking)
- `Memory.consolidate()` → calls `embeddingLayer.applyDecay()` (via LinkManager)
- `Memory.removeConcept()` → calls `embeddingLayer.removeConcept()`
- `SemanticStrategy.selectSecondary()` → uses `embeddingLayer.findSimilar()` via LinkManager
- LM rules (e.g., analogical reasoning) → use `embeddingLayer.findSimilar()` for context enrichment

**Config** in `senars.config.json`:

```json
"memory": {
  "enableEmbeddings": true,
  "embeddingModel": "Xenova/all-MiniLM-L6-v2",
  "vectorStorePath": ".cache/vectors",
  "similarityThreshold": 0.6,
  "maxLinksPerConcept": 20,
  "embeddingCacheSize": 1000
}
```

**Dependency**: `@lancedb/lancedb` (new), `@huggingface/transformers` (already installed).

### Phase 3: Persistent Episodic Memory

**File**: `src/nar/memory/EpisodicMemory.ts`

- Append-only JSONL file: `.cache/episodes/YYYY-MM-DD.jsonl`
- Each entry: `{timestamp, type, content, metadata}`
- Types: `input` (user message), `response` (bot reply), `belief_added` (user asserted fact), `question` (user asked),
  `tool_call` (name + args + result summary), `error`
- Query API: `getEpisodes(timeRange?, type?, limit?)`
- Auto-rotate daily, auto-prune after N days (configurable)
- Note: Derived beliefs are NOT logged — they flow into memory/attention naturally. If a derived belief matters, it
  surfaces to attention and may trigger a response, which IS logged.

**Integration points**:

- `Agent.router` (message middleware) → log `input` and `response` events
- `NAR.believe()` → log `belief_added`
- `ToolManager.execute()` → log `tool_call` with result summary
- Error boundaries → log `error`

**Config**:

```json
"episodic": {
  "enabled": true,
  "basePath": ".cache/episodes",
  "retentionDays": 30,
  "maxEntriesPerFile": 10000
}
```

### Phase 4: Agentic Loop

**Files**:

- `src/agent/AgenticLoop.ts` — main loop controller
- `src/agent/MessageQueue.ts` — async queue bridging event-driven channels to polling loop

**Architecture**: Channels are event-driven (push), not pollable. A `MessageQueue` bridges this:

```
Connections (IRC, WS, HTTP, MCP)
  └── onMessage(handler) → pushes IOMessage into MessageQueue

AgenticLoop
  └── queue.drain() → processes messages through router
```

**Loop**:

```
loop(turn):
  1. Drain MessageQueue → process each through router (commands, beliefs, questions, chat)
  2. If messages processed: reset idle counter to maxInputTurns
  3. If idle counter > 0:
     a. Run NAR reasoning steps
     b. Run LM enrichment if enabled
  4. If idle counter == 0 AND time > nextWakeAt:
     a. Grant maxWakeTurns for self-initiated work
     b. Run proactive enrichment
     c. Run self-analysis
     d. Run memory consolidation
  5. Sleep(sleepInterval)
  6. Recurse: loop(turn + 1)
```

**Config**:

```json
"loop": {
  "maxInputTurns": 50,
  "maxWakeTurns": 3,
  "sleepIntervalMs": 1000,
  "wakeupIntervalMs": 60000,
  "reasoningStepsPerTurn": 3
}
```

**Integration**:

- `bot.ts` starts AgenticLoop after all connections are up
- `repl.ts` uses existing interactive mode (no loop needed)
- Graceful shutdown via existing signal handler

### Phase 5: Response Repair

**File**: `src/nar/lm/response-repair.ts`

- Fixes common LLM output issues before parsing:
    - Balance parentheses in Narsese output
    - Fix unquoted arguments in structured output
    - Strip markdown code fences
    - Handle truncated JSON
- Used by LMRule task generation and ChatResponder
- Non-destructive: only repairs if parsing fails

## File Change Summary

| File                                     | Action  | Description                                       |
|------------------------------------------|---------|---------------------------------------------------|
| `src/nar/tools/BraveSearchTool.ts`       | **NEW** | Brave Search API tool                             |
| `src/nar/tools/index.ts`                 | MODIFY  | Export BraveSearchTool                            |
| `src/nar/nar.ts`                         | MODIFY  | Add BraveSearchTool to TOOL_DEFS                  |
| `src/nar/memory/links/EmbeddingLayer.ts` | **NEW** | Semantic vector link layer backed by LanceDB      |
| `src/nar/memory/links/index.ts`          | MODIFY  | Export EmbeddingLayer                             |
| `src/nar/memory/links/LinkManager.ts`    | MODIFY  | Register "semantic" as EmbeddingLayer             |
| `src/nar/memory/links/types.ts`          | MODIFY  | Add similarity field to LinkEntry                 |
| `src/nar/memory/embedding.ts`            | **NEW** | TransformersJS embedding generator                |
| `src/nar/memory/memory.ts`               | MODIFY  | Integrate embedding on concept add/remove         |
| `src/nar/reason/strategies/semantic.ts`  | MODIFY  | Use EmbeddingLayer via LinkManager                |
| `src/nar/memory/EpisodicMemory.ts`       | **NEW** | File-backed episodic trace                        |
| `src/nar/nar.ts`                         | MODIFY  | Integrate EpisodicMemory logging                  |
| `src/agent/AgenticLoop.ts`               | **NEW** | Continuous autonomous loop                        |
| `src/agent/MessageQueue.ts`              | **NEW** | Async queue bridging channels → loop              |
| `src/bin/bot.ts`                         | MODIFY  | Start AgenticLoop + wire channels to MessageQueue |
| `src/nar/lm/response-repair.ts`          | **NEW** | LLM output repair utilities                       |
| `src/nar/lm/rules.ts`                    | MODIFY  | Use response repair                               |
| `src/nar/lm/parser.ts`                   | MODIFY  | Add repair-aware parsing                          |
| `src/agent/ChatResponder.ts`             | MODIFY  | Use response repair                               |
| `senars.config.json`                     | MODIFY  | Add all new config sections                       |
| `src/config/defaults.ts`                 | MODIFY  | Add new defaults                                  |

## Dependencies

```json
{
  "@lancedb/lancedb": "^0.22.0"
}
```

`@huggingface/transformers` already installed for embedding model.

## Execution Order

Phases 1–4 are **independent** and can be developed/merged in parallel:

| Phase           | Dependencies            | Notes                                         |
|-----------------|-------------------------|-----------------------------------------------|
| BraveSearchTool | None                    | Standalone tool                               |
| EmbeddingLayer  | None                    | Requires `@lancedb/lancedb` install           |
| Response Repair | None                    | Standalone utility                            |
| Episodic Memory | None                    | Standalone file I/O                           |
| AgenticLoop     | Benefits from all above | Needs MessageQueue; wires everything together |

Each phase is independently testable and can be merged separately.
