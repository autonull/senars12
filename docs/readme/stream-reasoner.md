### Stream Reasoner

Async derivation streams with backpressure and CPU throttling:

- **Premise sources**: priority-weighted, recency, novelty, fair, and focus-based sampling
  - Composite sources with configurable weights
- **Interleaved Execution** — Synchronous NAL inference continues while asynchronous LM requests are processed in background workers
  - CPU throttling & cooperative yielding
  - Configurable queue limits and derivation caps
- **Adaptive Backpressure** — Monitors `Bag<T>` pressure; drops or queues LM requests if CPU budget is exhausted
  - Backpressure-aware buffering
  - Bounded LLM-backed reasoning with pressure-driven flush

```typescript
import { StreamReasoner } from '@senars/nar/stream';

const reasoner = new StreamReasoner({ maxBatch: 10, highPressure: 0.8 });
// Derivations come from the NAR's one inference path, not from a stream pipeline:
for await (const task of nar.runStream(10, 100)) {
  // incremental derivations, honouring the configured strategies
}
```

**Exports:** `StreamReasoner`, types `LMBackend`, `LMRequest`, `ProvisionalBelief`, `StreamReasonerOptions` from `@senars/nar/stream`. The inference pipeline that used to live here (`createPipeline`, the `PremiseSource` classes, `derive`) is gone: it was a second inference path that ignored the strategy slots, so `runStream` now goes through the one `InferenceController` (the inference controller spec §14).
