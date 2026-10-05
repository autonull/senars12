### Event Sourcing & Provenance

The kernel is **event-sourced**: the SQLite/JSONL Event Log is the cryptographic source of truth. The JSON state file (`nar-state`) serves as a **checkpoint/snapshot** for fast bootstrapping, allowing the system to resume without replaying the entire event history from genesis. `persistState: true` enables this snapshot layer; it does not replace the event log.

Every logical step is recorded as a derivation trace. If the agent concludes "The server is down," the log contains the exact syllogism and truth-value computation that produced the conclusion — a complete, independently checkable audit trail.

#### Derivation Recorder & Standalone Verifier

```typescript
import { NAR, createNAR } from '@senars/nar';

const nar = createNAR({ /* ... */ });
nar.getRuleProcessor().setConfig({ recorderEnabled: true });

// Run reasoning — recorder captures derivation records
await nar.run(100);

const records = nar.getRuleProcessor().getRecorder().drain();
// Each record: { derivationId, steps[{ruleId, premises, conclusion, truth, premiseTruths, independence, ...}], finalTruth, ... }

// Standalone verification (zero NAR engine deps)
import { verifyRecord } from '@senars/core/verify-derivation';
for (const r of records) {
  const result = verifyRecord(r, { strict: true, epsilon: 1e-6 });
  console.log(result.ok ? 'VALID' : 'INVALID', result.errors);
}
```

- `DerivationRecorder` (opt-in, bounded: 200 steps/record, 200 records) emits `DerivationRecord` with step-level `premiseTruths`, `evidenceLineage`, `independence`
- `@senars/core/verify-derivation` — the one proof checker. Shape comes from `DerivationRecordSchema`; proof comes from `verifyRecord`, which re-computes the NAL truth algebra, validates substitution grounding, the lineage DAG, and the revision independence flag. The truth table is transcribed rather than imported from the engine, and `core` depends on nothing but `util` and its own schemas, so a verifier bug cannot hide behind an engine bug. That independence is now measured rather than asserted: `tests/unit/core/verifier-drift.test.ts` pins the table's known divergences against the engine's own arithmetic, so drift is reported rather than accumulated.
- `scripts/verify-derivation.ts` — CLI over the same checker (`pnpm exec tsx scripts/verify-derivation.ts <record.json> --strict`). CI runs it on every change.
