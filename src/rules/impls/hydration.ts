import type { DerivationRecord } from '@senars/core/schemas/derivation-records';
import type { TaskAdmission } from '../../memory/ports/index.js';
import type { Term } from '../../terms/index.js';
import { Truth, termParser } from '../../terms/index.js';

export interface HydrationResult {
  applied: number;
  skipped: number;
}

export function hydrateRecord(memory: TaskAdmission, record: DerivationRecord): HydrationResult {
  let applied = 0;
  let skipped = 0;
  const seen = new Set<string>();
  for (const step of record.steps) {
    if (seen.has(step.conclusion)) {
      skipped++;
      continue;
    }
    seen.add(step.conclusion);
    try {
      const term = termParser.parse(step.conclusion) as Term;
      const ok = memory.addTask(
        term,
        'belief',
        Truth.create(step.truth.frequency, step.truth.confidence)
      );
      if (ok) applied++;
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { applied, skipped };
}
