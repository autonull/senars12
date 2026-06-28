# Engineering Roadmap: Neuro-Symbolic LM Integration

**Objective:** Production-quality hybrid reasoning with clear observability and graceful degradation.

---

## Status Summary

| Area | Status |
|------|--------|
| CircuitBreaker | ✅ Complete - `core/src/util/CircuitBreaker.js` + `LM.js` integration |
| Provider Registry | ✅ Complete - Multi-provider with fallback |
| Streaming | ✅ Complete - `TransformersJSProvider._streamPipeline()` |
| Tool Calling | ✅ Complete - JSON-based tool parsing in provider |
| Narsese Translation | ✅ Complete - `NarseseTranslator.js` |
| EventBus Logging | ✅ Complete - Available in all LM demos |
| **Debug Mode** | ✅ Complete - Configurable debug events via EventBus |
| **Latency Metrics** | ✅ Complete - TTFT, throughput, memory tracking in `LMStats.js` |
| **Output Validation** | ✅ Complete - Empty output + Narsese validation |
| **Examples** | ✅ Complete - 3 new demos + comprehensive README |

---

## 1. Observability Improvements ✅ COMPLETED

**Goal:** Debug silent failures, understand model behavior.

### 1.1 Inference Telemetry ✅
- [x] Basic streaming output capture in `_streamPipeline`
- [x] **Latency metrics**: TTFT (Time To First Token), total inference time
- [x] **Token throughput**: Log `tokens/sec` during generation
- [x] **Memory usage**: Track peak memory during model load

**Implementation**: ✅ `LMStats.js` extended with `avgFirstTokenLatency`, `avgTokensPerSecond`, `peakMemoryUsageMB`

### 1.2 Debug Mode for TransformersJSProvider ✅
- [x] Debug logging exists
- [x] **Make configurable**: Added `debug: true` config option
- [x] **Structured output**: Emit events via `EventBus.emit('lm:debug', {...})`

**Implementation**: ✅ `BaseProvider` now supports `eventBus` and `_emitDebug()` helper

---

## 2. Error Handling Enhancements ✅ COMPLETED

**Goal:** Fail clearly, degrade gracefully.

### 2.1 Output Validation ✅
- [x] CircuitBreaker protects against repeated failures
- [x] **Empty output detection**: `EmptyOutputError` with configurable behavior
- [x] **Narsese validation**: Detects Narsese patterns, validates syntax, emits warnings

**Implementation**: ✅ `LM._validateOutput()` with `validation.emptyOutput` and `validation.narsese` config

### 2.2 Model Load Failures
- [x] Basic try/catch in `_initialize()`
- [x] **Timeout protection**: Fail if model load exceeds configured timeout (default: 60s)
- [ ] **Disk space check**: Warn if cache directory < 2GB free *(Deferred)*

**Implementation**: ✅ `BaseProvider._withTimeout()` method wraps model loading with configurable timeout. Events emitted: `lm:model-load-start`, `lm:model-load-complete`, `lm:model-load-timeout`.

---

## 3. Model Compatibility *(Priority: Low - Defer)*

**Context:** T5 models (current default) use text-to-text, not chat templates.

### 3.1 Recommended Models for Hybrid Reasoning

| Model | Size | Task | Notes |
|-------|------|------|-------|
| `Xenova/LaMini-Flan-T5-248M` | 248M | text2text | ✅ Current default, good for summaries |
| `Xenova/LaMini-Flan-T5-783M` | 783M | text2text | Better quality, slower |
| `Xenova/distilgpt2` | 82M | text-gen | Fast, less accurate |

### 3.2 Chat Model Support *(Deferred)*
- [ ] Add `ChatProvider` wrapper for instruct models
- [ ] Implement basic message formatting (no full Jinja2 needed)

**Note:** Full Jinja2 template support is overkill for current use cases. Most ONNX-exported models include their own tokenizer chat templates.

---

## 4. Architectural Improvements *(Priority: Medium)*

### 4.1 Background Reasoning Stream *(Future)*
- [ ] **Async thought queue**: Decouple LM calls from REPL blocking
- [ ] **Streaming display**: Show partial results during long generations

**Location**: `agent/src/Agent.js` or new `ThoughtStream.js`

### 4.2 Translation Consistency Tests *(Future)*
- [ ] **Round-trip test**: `Narsese → English → Narsese`
- [ ] Add to integration tests: `tests/integration/`

---

## 5. Example Improvements ✅ COMPLETED

### 5.1 Working Examples (Verified)
- ✅ `lm/minimal-inference.js` - **NEW**: Simplest LM demo
- ✅ `lm/streaming-demo.js` - **NEW**: Incremental token streaming
- ✅ `lm/circuit-breaker-demo.js` - **NEW**: CircuitBreaker in action
- ✅ `lm/demo-transformers-js.js` - Basic LM demo
- ✅ `lm/README.md` - **NEW**: Comprehensive documentation
- ✅ `narsgpt/production-lm.js` - Production patterns
- ✅ `repl/example-agent-repl.js` - Full agent demo

### 5.2 Completed Items ✅
- [x] **Minimal LM test**: Single inference, no agent, no NARS
- [x] **Streaming demo**: Show tokens appearing incrementally
- [x] **Error handling demo**: CircuitBreaker in action
- [x] **Documentation**: Comprehensive README with config, metrics, troubleshooting

---

## 6. Provider Scope

| Provider | Status | Priority |
|----------|--------|----------|
| **Transformers.js** | Primary | ✅ Test thoroughly |
| **Ollama** | Optional | Test if available |
| OpenAI | ❌ Out of scope | Not tested |

### 6.1 Transformers.js Notes
- **Cold start**: First inference downloads model (~500MB for 248M), cache in `~/.cache/huggingface/`
- **Memory**: Expect ~1-2GB RAM during inference
- **CPU only**: No GPU acceleration in Node.js (WASM backend)

### 6.2 Ollama Notes *(Optional)*
- Requires `ollama serve` running on `localhost:11434`
- Test with: `ollama pull llama3.2:1b` (smallest)
- Falls back gracefully if unavailable

---

## 7. Broken Examples Triage

**Location**: `examples/broken/`

| Category | Count | Action |
|----------|-------|--------|
| SessionEngine imports | 10 files | ⚠️ Requires refactor - Documented |
| Redundant stream demos | 3 files | ⚠️ Can delete - Consolidated into `advanced/` |

**Decision**: Defer cleanup. Keep `examples/broken/README.md` as documentation.

---

## 8. Performance Expectations

| Model | Cold Start | Warm Inference | Memory |
|-------|------------|----------------|--------|
| LaMini-Flan-T5-248M | ~30-60s | ~2-5s | ~1.5GB |
| LaMini-Flan-T5-783M | ~60-90s | ~5-10s | ~3GB |
| distilgpt2 | ~10-20s | ~1-2s | ~500MB |

> **Note**: Cold start includes model download on first run. Subsequent runs use cached model.

---

## 9. Future Enhancements *(Optional)*

These items could be added in future iterations based on user needs:

### 9.1 Model Management
- [ ] **Model load timeout**: Add 60s timeout protection
- [ ] **Disk space validation**: Check cache directory has > 2GB free
- [ ] **Model preloading**: Background model initialization
- [ ] **Model cleanup**: Tool to clear cached models

### 9.2 Advanced Streaming
- [ ] **Async thought queue**: Non-blocking background reasoning
- [ ] **Progress callbacks**: Real-time generation progress
- [ ] **Cancellation support**: Ability to stop long-running generations

### 9.3 Enhanced Validation
- [ ] **Round-trip translation tests**: Narsese ↔ English consistency
- [ ] **Semantic validation**: Verify output makes sense for prompt
- [ ] **Quality metrics**: Track output quality over time

### 9.4 Chat Model Support
- [ ] **ChatProvider wrapper**: Support for instruct/chat models
- [ ] **Message formatting**: Basic chat template support
- [ ] **Conversation history**: Multi-turn dialogue support

### 9.5 Monitoring & Analytics
- [ ] **Dashboard**: Real-time LM metrics visualization
- [ ] **A/B testing**: Compare different models/prompts
- [ ] **Cost tracking**: Monitor resource usage
- [ ] **Performance profiling**: Detailed latency breakdowns

---

## Dependencies

- `@huggingface/transformers` - Local inference (required)
- `onnxruntime-node` - ONNX runtime (auto-installed)
- `ollama` - Optional, for Ollama provider testing

---

*Last Updated: 2024-12-18*
*Status: Phase 1-2 Complete (Observability & Error Handling)*
