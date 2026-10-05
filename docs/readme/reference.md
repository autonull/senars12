## Reference

### Testing & CI

```bash
# Run all tests
pnpm run test

# Unit tests only
pnpm run test:unit

# With coverage
pnpm run test --coverage

# End-to-end smoke tests
pnpm exec tsx scripts/execute-turn-smoke.ts      # Real LM agent.executeEpisode
pnpm exec tsx scripts/cli-smoke.ts               # Full cognitive pipeline
```

**Test Structure:**

```
tests/nar/
├── unit/              # 30+ unit test files
├── e2e/               # 6 end-to-end test suites
├── property/          # Property-based testing
├── benchmark.test.ts  # Performance benchmarks
├── rlfp.test.ts       # RLFP integration
├── stream.test.ts     # Streaming execution
```

### Extensibility & Ecosystem

#### Embed Pattern (Minimal Integration)

```javascript
import { SeNARS } from 'senars';
const brain = new SeNARS();
brain.learn('(cats --> mammals).');
const answer = await brain.ask('(whiskers --> ?what)?');
// { answer: 'mammals', truth: {f: 0.81, c: 0.73}, proof: [...] }
```

**Framework adapters:** Express, React (`useSeNARS`), LangChain, MCP

#### Research & Development Tooling

- **Reasoning trace export** — JSON-LD, GraphML, Mermaid for analysis and publication
- **Strategy A/B testing framework** — pluggable derivation/attention/sampling strategies with metrics
- **RLFP annotation web UI** — human preference collection for reward model training

#### Knowledge Portability

- **Knowledge Book format** (`.sbook` YAML) — portable, versioned knowledge packages
- **Import/export:** Narsese, RDF/OWL, JSON-LD, Natural Language

<details>
<summary><b>Complete API Export / Entry Point Index</b></summary>

| Category | Key Exports | Entry Points |
|----------|-------------|--------------|
| **Core NAR** | `NAR`, `createNAR`, `Memory`, `TaskManager` | `@senars/nar` |
| **Terms** | `TermBuilder`, `termParser`, `Truth`, `Stamp` | `@senars/nar` |
| **Rules** | `NALRules`, `NALExtendedRules`, `RuleProcessor`, `MetaRules` | `@senars/nar` |
| **Agent (NAR)** | `createAgent`, `Agent`, `NAREngine` | `@senars/nar/agent` |
| **Cognitive** | `CognitiveController`, `runCounterfactual`, `RLFPLearner` | `@senars/nar/cognitive` |
| **Cognitive Params** | `CognitiveParameters`, `DEFAULT_COGNITIVE_PARAMETERS`, `FAST_COGNITIVE_CONFIG`, `LM_HEAVY_CONFIG` | `@senars/nar` (internal) |
| **Strategies** | `SamplingStrategy`, `DerivationStrategy`, `AttentionModel` | `@senars/nar` (internal) |
| **NL** | `NLUnderstandingService`, `NLGenerationService` | `@senars/nar/nl` |
| **Tools** | `ToolManager`, `discoverTools`, `ExplainTool`, `SelfTools` | `@senars/nar/tools` |
| **Learning** | `SchemaInductor` | `@senars/nar/learning` |
| **Self-Reasoning** | `ReasoningAboutReasoning`, `SelfAnalyzer`, `MetacognitiveMonitor` | `@senars/nar/self` |
| **Cognitive Analyzers** | `capabilities`, `performance`, `quality`, `reasoning-patterns`, ... | `@senars/nar/cognitive/analyzers` |
| **Grounding** | `GroundingPipeline`, `SourceQuality` | `@senars/nar` (internal) |
| **Streaming** | `StreamReasoner` (LM batching queue) | `@senars/nar/stream` |
| **Commands** | `narCommands`, `rlfpCommands`, `selfCommands`, `configCommands`, `memoryCommands`, `lmCommands`, `episodesCommands` | `@senars/nar/commands` |
| **LM Rules** | `LMRules`, `LMRule`, `LMRuleFactory`, `symbolicFallbacks`, `TraceAbstractor`, `ShadowValidator`, `attemptLMCorrection`, `embeddingRuntime` | `@senars/nar/lm` |
| **Cycle-path ports** | `ModelRule`, `ModelRuleSelector`, `TextGenerator`, `EmbeddingRuntime` | `@senars/nar/rules/types`, `@senars/nar/ports`, `@senars/nar/memory/embedding` — what the core names instead of the layer |
| **Cooperation** | `CognitiveTaskDelegation`, `CognitiveTaskResult`, `createDelegation`, `handleDelegationMessage` | `@senars/nar/cooperation` |
| **MeTTa** | `createMeTTa`, `parseMeTTa`, `EGraph`, `MeTTaRuntime` | `@senars/metta` |
| **MeTTa (tool)** | `MettaEngine` (tool executor only), `MettaCommandParser` (chat command parsing) | `@senars/metta/agent` |
| **Focus-Game-Reflex Kernel** | `Bag`, `Focus`, `FocusBag`, `GameFocus`, `MetaFocus`, `PerceptionGate`, `ActionGate`, `RewardGate`, `Reflex`, `TabularQReflex`, `Negotiator`, `Game`, `MetaGame`, `SelfMetaGame` | `@senars/nar` (new architecture) |
| **Games** | `SeededRNG`, `GridWorldGame`, `BanditGame`, `SnakeGame`, `TetrisGame`, `Game2048`, `TicTacToeGame` (+`minimax`), `renderGame` | `@senars/nar/game` |
| **Arcade** | `FocusScheduler`, `LMReflex`, `actionGrammar`, `BrierHarness`, `createOpenSystemOneManifold`, `open-systemone` manifold provider | `@senars/nar/focus`, `@senars/nar/lm/system-one`, `@senars/nar/eval/*` |
| **RL Library** | `QBeliefStore`, `RewardBeliefAdapter`, `BeliefPerceptionAdapter`, `GoalActionAdapter`, `RLParityHarness`, `ManifoldReflex`, `ManifoldUCBReflex`, `ManifoldRLAgent` | `@senars/nar/rl` |
| **System One** | `HEAD_SPECS`, `createHeadById`, `ConfidenceRouter`, `truthProbability`, `compositeScore`, `judgeCascade`, `createWakeGate`, `createTraceGrader`, `SystemOneManifold`, `EmbeddingCache` | `@senars/nar/lm/system-one` |
| **Cycle Trace** | `CycleTrace`, `CYCLE_STAGES`, `CycleStage`, `findStageOverlaps`, `findInCycleProposals` | `@senars/nar/proposal/cycle-trace` |
| **Observability (OTel)** | `initOtel`, `shutdownOtel`, `emitEvent`, `getTracer`, `OtelConfig` | `@senars/nar/otel` |
| **WASI Sandbox** | `CapabilitySpace`, `createWasiSandbox`, `createWasmModuleSandbox`, `createNodeVMSandbox`, `WasiSandboxOptions`, `WasmModuleOptions` | `@senars/nar/capability` |
| **Core Agent** | `Agent`, `createAgent`, `LLMCortex`, `MemoryService` | `@senars/core` |
| **Agent Subsystems** | `ToolRegistry`, `PolicyEngine`, `ApprovalService`, `KnowledgeManager` | `@senars/core` |
| **Event Logs** | `InMemoryEventLog`, `SqliteEventLog` | `@senars/core` |
| **Session Mgmt** | `InMemorySessionManager`, `JsonlSessionManager` | `@senars/core` |
| **Model Runner** | `ModelRunner`, `ToolCall`, `ModelEvent` | `@senars/core` |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp`, `CognitiveDelta` | `@senars/core/protocol` |
| **IO** | `ConnectionManager`, `bindAgentToConnection` | `@senars/io` |
| **API** | `HTTPAdapter`, `WebSocketAdapter`, `registerNARTools`, `registerAgentAPI` | `senars` (root package) |
| **UI** | `startAgentUI` | `@senars/ui` |
| **Config** | `loadConfig`, `loadConfigFromEnv` | `senars` (root package) |
| **Shared Utils** | `EventBus`, `CommandRegistry`, `generateId`, `clamp`, `sleep` | `@senars/util` |
| **Shared Types** | `CognitiveEvent`, `Connection`, `LMService`, `Episode` | `@senars/util` |
| **Errors** | `SenarsError`, `ConfigError`, `TransportError`, `PolicyViolation` | `@senars/util` |

</details>
