### Natural Language Services

```typescript
import { NLUnderstandingService, NLGenerationService, ContextAssembler } from '@senars/nar/nl';

// Convert natural language to Narsese CANDIDATES (multi-hypothesis)
const understanding = new NLUnderstandingService(lmService);
const candidates = await understanding.understand("Cats are mammals. Whiskers is a cat.");
// Returns: FormalizationCandidate[] with term, confidence, sourceSpans, ambiguityFlags

// Convert Narsese results to natural language
const generation = new NLGenerationService(lmService);
const answer = await generation.generate({
  query: '(whiskers --> ?what)?',
  beliefs: [...],
  trace: [...]
});

// Ask in plain English
const answer = await nar.askNaturalLanguage("What is Whiskers?");
```

**Key Features:**
- **Multi-candidate formalization** — LLM returns `FormalizationBatch` with per-candidate `sourceSpans` + `ambiguityFlags` (negation, modal, quantifier, temporal). Kernel admits each candidate provisionally; no single authoritative parse.
- **Single-flight LM dedup** (`SingleFlight`) — concurrent identical `understand()` calls share one request; failures clear the slot for retry.
- **Unified `translateCached` path** — cache → single-flight LM → record; legacy string cache entries safely ignored.
- **Per-candidate spans** — `locateSpan` maps verbatim `sourceText` to exact offsets; ambiguity flags become span-local.
