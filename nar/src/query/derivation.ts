/**
 * TODO32 M8: the read-side join between the derivation recorder and `Answer`.
 *
 * Pure on purpose — it takes drained records and a conclusion term and returns a
 * verified derivation or nothing. An unverifiable trace is *omitted, never
 * shown*: a trace a reader cannot check is worse than no trace, because it reads
 * as evidence.
 */

import type { DerivationRecord } from '@senars/core/schemas';
import { verifyRecord } from '@senars/core/verify-derivation';
import { termKey, termParser } from '../terms';
import type { VerifiedDerivation } from './api';

/**
 * The recorded conclusion is the last step's conclusion, not the record's
 * `goalTerm` — that is the first premise. Matching the wrong field attaches a
 * trace for a different question.
 */
const conclusionOf = (record: DerivationRecord): string | undefined =>
  record.steps[record.steps.length - 1]?.conclusion;

export const selectVerifiedDerivation = (
  records: readonly DerivationRecord[],
  conclusionNarsese: string
): VerifiedDerivation | undefined => {
  const target = termKey(termParser.parse(conclusionNarsese));
  for (const record of records) {
    const conclusion = conclusionOf(record);
    if (!conclusion || termKey(termParser.parse(conclusion)) !== target) continue;
    const verification = verifyRecord(record, { strict: true, epsilon: 1e-6 });
    return verification.ok ? { record, verification } : undefined;
  }
  return undefined;
};