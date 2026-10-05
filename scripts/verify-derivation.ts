#!/usr/bin/env tsx
/**
 * Standalone Derivation Verifier — CLI over the trusted kernel's proof checker.
 * The proof itself lives in `@senars/core/verify-derivation`, so CI and the
 * runtime settle every record with the same algebra and the same findings.
 *
 * Usage: pnpm exec tsx scripts/verify-derivation.ts <record.json> [--strict] [--epsilon 1e-6]
 * <record.json> holds one DerivationRecord or an array of them.
 * Exit 0 when every record verifies, 1 otherwise.
 */
import { readFileSync } from 'node:fs';
import { DerivationRecordSchema } from '@senars/core/schemas';
import { verifyRecord } from '@senars/core/verify-derivation';
import { z } from 'zod';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error('Usage: verify-derivation.ts <record.json> [--strict] [--epsilon N]');
  process.exit(2);
}

const strict = rest.includes('--strict');
const epsilon = Number(rest[rest.indexOf('--epsilon') + 1] ?? NaN);
const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
const parsed = z.array(DerivationRecordSchema).safeParse(raw);
const records = parsed.success ? parsed.data : [DerivationRecordSchema.parse(raw)];

let failed = 0;
for (const record of records) {
  const result = verifyRecord(record, {
    strict,
    epsilon: Number.isNaN(epsilon) ? undefined : epsilon,
  });
  console.log(
    `${result.ok ? 'PASS' : 'FAIL'} ${result.derivationId} (truth verified: ${result.truthVerified}, skipped: ${result.truthSkipped})`
  );
  for (const message of result.errors) console.log(`  ${message}`);
  if (!result.ok) failed++;
}
console.log(`${records.length - failed}/${records.length} records verified.`);
process.exit(failed > 0 ? 1 : 0);
